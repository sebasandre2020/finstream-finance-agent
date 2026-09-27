"""Gmail IMAP Watcher and Ingestion Bridge."""

import email
import imaplib
import logging
import uuid
from datetime import UTC, datetime
from email.header import decode_header

from src.schemas.email import EmailTransactionResult, GmailSyncResponse
from src.schemas.transaction import TransactionWebhookPayload
from src.services.email_parser import email_parser_service
from src.services.idempotency import idempotency_service
from src.services.kafka_producer import kafka_producer_service

logger = logging.getLogger("EmailWatcher")


class EmailWatcherService:
    """Connects to Gmail via IMAP, discovers banking emails, and routes to Kafka."""

    @staticmethod
    def _decode_header_str(raw_header: str | None) -> str:
        if not raw_header:
            return ""
        decoded_parts = decode_header(raw_header)
        result = []
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                try:
                    result.append(part.decode(encoding or "utf-8", errors="replace"))
                except Exception:
                    result.append(part.decode("latin1", errors="replace"))
            else:
                result.append(str(part))
        return "".join(result)

    @staticmethod
    def _extract_body_from_message(msg: email.message.Message) -> str:
        """Extracts text content from a multipart or single-part MIME message."""
        text_parts = []
        html_parts = []

        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition") or "")
                if "attachment" in content_disposition:
                    continue

                try:
                    payload = part.get_payload(decode=True)
                    if not payload:
                        continue
                    charset = part.get_content_charset() or "utf-8"
                    decoded_text = payload.decode(charset, errors="replace")
                    if content_type == "text/plain":
                        text_parts.append(decoded_text)
                    elif content_type == "text/html":
                        html_parts.append(decoded_text)
                except Exception as e:
                    logger.debug("Failed to decode email part: %s", e)
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                decoded_text = payload.decode(charset, errors="replace")
                if msg.get_content_type() == "text/html":
                    html_parts.append(decoded_text)
                else:
                    text_parts.append(decoded_text)

        # Prefer plain text if available, fallback to HTML
        if text_parts:
            return "\n".join(text_parts)
        if html_parts:
            return "\n".join(html_parts)
        return ""

    async def sync_gmail_inbox(
        self,
        email_address: str,
        app_password: str,
        account_id: uuid.UUID | None = None,
        max_emails: int = 10,
        unread_only: bool = True,
    ) -> GmailSyncResponse:
        """
        Connects to Gmail IMAP, extracts recent transaction emails,
        and pipes them directly into the Kafka ingestion pipeline.
        """
        clean_pwd = app_password.replace(" ", "")
        acct_id = account_id or uuid.UUID("b0000000-0000-0000-0000-000000000001")
        acct_str = str(acct_id)

        mail: imaplib.IMAP4_SSL | None = None
        try:
            # 1. Establish SSL connection to Gmail
            mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
            mail.login(email_address, clean_pwd)
            mail.select("INBOX")

            # 2. Search query
            search_criterion = "UNSEEN" if unread_only else "ALL"
            status, msg_ids = mail.search(None, search_criterion)
            if status != "OK" or not msg_ids[0]:
                return GmailSyncResponse(
                    connected=True,
                    total_inspected=0,
                    transactions_found=0,
                    ingested_count=0,
                    duplicates_count=0,
                    results=[],
                )

            id_list = msg_ids[0].split()
            # Inspect most recent messages first
            target_ids = list(reversed(id_list))[:max_emails]

            results: list[EmailTransactionResult] = []
            ingested_count = 0
            duplicates_count = 0

            for mail_id in target_ids:
                status, data = mail.fetch(mail_id, "(RFC822)")
                if status != "OK" or not data or not data[0]:
                    continue

                raw_email_bytes = data[0][1]
                msg = email.message_from_bytes(raw_email_bytes)

                subject = self._decode_header_str(msg.get("Subject"))
                sender = self._decode_header_str(msg.get("From"))
                body = self._extract_body_from_message(msg)

                # Parse transaction
                res = await email_parser_service.parse_email(
                    raw_body=body, sender=sender, subject=subject
                )

                if res.is_transaction and res.amount and res.ext_transaction_id:
                    results.append(res)

                    # Deduplication via Redis
                    is_new = await idempotency_service.check_and_set(
                        account_id=acct_str,
                        ext_transaction_id=res.ext_transaction_id,
                    )
                    if not is_new:
                        duplicates_count += 1
                        logger.info(
                            "Duplicate email transaction ignored: %s",
                            res.ext_transaction_id,
                        )
                        continue

                    # Pipe into Kafka pipeline
                    tracking_id = f"evt_eml_{uuid.uuid4().hex[:12]}"
                    now_dt = datetime.now(UTC)

                    webhook_payload = TransactionWebhookPayload(
                        account_id=acct_id,
                        ext_transaction_id=res.ext_transaction_id,
                        amount=res.amount,
                        currency=res.currency,
                        raw_description=res.raw_description
                        or res.merchant
                        or "EMAIL TX",
                        transaction_time=res.transaction_time or now_dt,
                        metadata={
                            "parser": res.parser_used,
                            "card": res.card_or_account,
                            "source": "gmail_sync",
                        },
                    )

                    envelope = {
                        "tracking_id": tracking_id,
                        "received_at": now_dt.isoformat(),
                        "payload": webhook_payload.model_dump(mode="json"),
                    }
                    await kafka_producer_service.publish_transaction_event(
                        account_id=acct_str,
                        ext_transaction_id=res.ext_transaction_id,
                        payload=envelope,
                    )
                    ingested_count += 1
                    logger.info(
                        "✅ Ingested transaction from email via Kafka: %s ($%.2f)",
                        res.merchant,
                        res.amount,
                    )

            return GmailSyncResponse(
                connected=True,
                total_inspected=len(target_ids),
                transactions_found=len(results),
                ingested_count=ingested_count,
                duplicates_count=duplicates_count,
                results=results,
            )

        except imaplib.IMAP4.error as imap_err:
            logger.error("Gmail IMAP authentication error: %s", imap_err)
            return GmailSyncResponse(
                connected=False,
                total_inspected=0,
                transactions_found=0,
                ingested_count=0,
                duplicates_count=0,
                results=[],
                error=f"IMAP Authentication failed. Verify your email and 16-character Google App Password: {imap_err}",
            )
        except Exception as e:
            logger.error("Gmail sync unexpected error: %s", e)
            return GmailSyncResponse(
                connected=False,
                total_inspected=0,
                transactions_found=0,
                ingested_count=0,
                duplicates_count=0,
                results=[],
                error=str(e),
            )
        finally:
            if mail:
                try:
                    mail.close()
                    mail.logout()
                except Exception:
                    pass


email_watcher_service = EmailWatcherService()
