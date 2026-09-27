"""Hybrid Email Parser: Deterministic Regex + LLM Fallback for Peruvian Banking Notifications."""

import hashlib
import html
import logging
import re
from datetime import UTC, datetime, timedelta, timezone

from src.ai.adapters import LLMAdapterFactory
from src.schemas.email import EmailTransactionResult

logger = logging.getLogger("EmailTransactionParser")

SPANISH_MONTHS = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "setiembre": 9,
    "septiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}


class EmailTransactionParser:
    """Extracts structured financial transactions from banking emails and receipts."""

    def __init__(self):
        self.llm_adapter = LLMAdapterFactory.get_adapter()

    @staticmethod
    def clean_html_to_text(raw_content: str) -> str:
        """Strips HTML markup, scripts, CSS styles, decodes entities, converts table cells to key-values, and normalizes spacing."""
        if not raw_content:
            return ""
        # 1. Strip CSS style blocks and script blocks
        text = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", raw_content)
        text = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", text)
        # 2. Replace line breaks and block element closings with newlines
        text = re.sub(r"(?i)<br\s*/?>", "\n", text)
        text = re.sub(r"(?i)</(?:p|div|tr|h\d|li)>", "\n", text)
        # 3. Convert table cells to key-value pairs (separate label and value cells with a colon)
        text = re.sub(r"(?i)</(?:td|th)>", " : ", text)
        # 4. Strip all remaining HTML tags
        text = re.sub(r"<[^>]+>", " ", text)
        # 5. Decode HTML entities (&nbsp;, &aacute;, etc.)
        text = html.unescape(text)
        # 6. Clean up redundant colons caused by cell tags
        text = re.sub(r":\s*:", ":", text)
        # 7. Collapse consecutive spaces while preserving line breaks
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
        return "\n".join(line for line in lines if line)

    @staticmethod
    def is_financial_notification(
        sender: str | None, subject: str | None, body: str
    ) -> bool:
        """Determines if the email is likely an authentic bank transaction alert (filtering out reminders and promos)."""
        text = f"{sender or ''} {subject or ''} {body}".lower()

        # 1. Explicitly REJECT reminder, alert, promo, loan offers, or failed transaction emails
        reject_keywords = [
            # Automatic debit reminders
            "no te olvides",
            "tienes un débito automático pronto",
            "tienes un debito automatico pronto",
            "recuerda que tu aporte",
            "recordatorio",
            "se realizará del",
            "se realizara del",
            "asegurate de tener saldo",
            "asegúrate de tener saldo",
            # Loan / Credit offers & disbursements (not purchases or spending)
            "tu crédito ya está disponible",
            "tu credito ya esta disponible",
            "el crédito que solicitaste",
            "el credito que solicitaste",
            "crédito aprobado",
            "credito aprobado",
            "monto solicitado",
            "tcea (costo efectivo)",
            "pide tu préstamo",
            "pide tu prestamo",
            "solicita tu crédito",
            "solicita tu credito",
            "tu préstamo ya está",
            "tu prestamo ya esta",
            # Promotional / Marketing
            "pagar con google pay te trae este regalo",
            "sigue disfrutando cientos de beneficios",
            "disfruta cientos de beneficios",
            "descuento exclusivo",
            "promoción exclusiva",
            "promocion exclusiva",
            "aprovecha este fin de semana",
            "¿ya tienes tu soat?",
            "actualizaciones en linkedin",
            "invitación para conectar",
            "notificaciones de seguridad",
            # Rejected / Failed transactions
            "la compra con tu tarjeta bbva ha sido rechazada",
            "ha sido rechazada",
            "ha sido rechazado",
            "compra rechazada",
            "operación rechazada",
            "operacion rechazada",
        ]
        if any(rk in text for rk in reject_keywords):
            return False

        # 2. Known financial senders in Peru and payment providers
        financial_domains = [
            "bcp.com.pe",
            "viabcp.pe",
            "viabcp.com",
            "yape.com.pe",
            "yape.pe",
            "notificacionesbcp.com.pe",
            "bcp.pe",
            "email.bcp.com.pe",
            "avisosbcp.com.pe",
            "bbva.com.pe",
            "bbva.pe",
            "bancofalabella.com",
            "interbank.pe",
            "scotiabank.com.pe",
            "paypal.com",
            "stripe.com",
        ]
        if any(domain in (sender or "").lower() for domain in financial_domains):
            return True

        # 3. Common Spanish/English transactional trigger keywords
        transactional_keywords = [
            "constancia de operaci",
            "consumo con tu tarjeta",
            "realizaste un consumo",
            "notificación de consumo",
            "notificacion de consumo",
            "notificación de operación",
            "notificacion de operacion",
            "transferencia a terceros",
            "transferencia exitosa",
            "transferencia entre",
            "pago de servicio",
            "pago de servicios",
            "plineaste",
            "te plinearon",
            "plin",
            "yapeaste",
            "te yapearon",
            "te yapeó",
            "enviaste un yape",
            "confirmación de pago",
            "compra aprobada",
            "compra por internet",
            "cargo en cuenta",
            "tarjeta cmr",
            "comprobante de pago",
        ]
        return any(keyword in text for keyword in transactional_keywords)

    @staticmethod
    def _extract_amount_and_currency(text: str) -> tuple[float | None, str]:
        """
        Robustly extracts financial amount and currency from text snippet.
        Supports: S/., S/, PEN, US$, $, USD, with standard comma/period digit formatting.
        """
        m = re.search(
            r"(?:Monto|Importe|Total|Importe total|Monto pagado|Monto transferido|Monto de la operación|Total del consumo|Valor)\s*:?\s*(?:de)?\s*(S/\.?|US\$|\$|PEN|USD)?\s*([\d,]+(?:\.\d{2})?)",
            text,
            re.IGNORECASE,
        )
        if not m:
            m = re.search(
                r"(?:de\s+)?(S/\.?|US\$|\$)\s*([\d,]+(?:\.\d{2})?)",
                text,
                re.IGNORECASE,
            )

        if not m:
            return None, "PEN"

        sym = (m.group(1) or "").strip().upper()
        currency = "USD" if ("$" in sym or "US" in sym) else "PEN"

        raw_num = m.group(2).replace(",", "")
        try:
            return float(raw_num), currency
        except ValueError:
            return None, "PEN"

    def _parse_plin(
        self,
        text: str,
        subject: str | None,
        email_id: str | None = None,
        email_date_header: datetime | None = None,
    ) -> EmailTransactionResult | None:
        """Regex parser for PLIN transfers (sent or received via BBVA, Interbank, or Scotiabank)."""
        upper_text = text.upper()
        if not (
            "PLIN" in upper_text
            or "PLINEASTE" in upper_text
            or "TE PLINEARON" in upper_text
        ):
            return None

        # Check for rejection
        if (
            "RECHAZADA" in upper_text
            or "RECHAZADO" in upper_text
            or "NO SE PUDO REALIZAR" in upper_text
        ):
            return None

        plin_match = re.search(
            r"Plineaste\s*(?:de\s*)?(S/\.?|\$|US\$)?\s*([\d,]+(?:\.\d{2})?)\s*a\s*([^\n\r:]+)",
            text,
            re.IGNORECASE,
        )
        if not plin_match:
            return None

        currency_sym = (plin_match.group(1) or "").strip().upper()
        currency = "USD" if ("$" in currency_sym or "US" in currency_sym) else "PEN"
        try:
            amount = float(plin_match.group(2).replace(",", ""))
        except ValueError:
            return None

        beneficiary = plin_match.group(3).strip()

        # Destination app (e.g. Yape, Plin)
        dest_app = re.search(r"Destino\s*:\s*([^\n\r:]+)", text, re.IGNORECASE)
        dest_suffix = f" (vía {dest_app.group(1).strip()})" if dest_app else ""
        merchant = f"Plin - {beneficiary}{dest_suffix}"

        op_match = re.search(
            r"Número de operación\s*:\s*([a-zA-Z0-9]+)", text, re.IGNORECASE
        )
        op_num = op_match.group(1) if op_match else None

        tx_time = self._extract_transaction_datetime(
            text, fallback_dt=email_date_header
        )

        if op_num:
            ext_id = f"plin_{op_num}"
        elif email_id:
            ext_id = f"plin_{email_id}"
        else:
            ext_id = f"plin_{hashlib.sha256(f'{merchant}_{amount}_{tx_time}'.encode()).hexdigest()[:14]}"

        return EmailTransactionResult(
            is_transaction=True,
            merchant=merchant,
            amount=amount,
            currency=currency,
            transaction_time=tx_time,
            card_or_account="Plin Digital Wallet",
            operation_type="DEBIT",
            parser_used="regex_plin",
            confidence=0.99,
            raw_description=f"PLIN {beneficiary}",
            ext_transaction_id=ext_id,
            metadata={"source": "plin_transfer", "operation_number": op_num},
        )

    def _parse_falabella_cmr(
        self,
        text: str,
        subject: str | None,
        email_id: str | None = None,
        email_date_header: datetime | None = None,
    ) -> EmailTransactionResult | None:
        """Regex parser for Banco Falabella CMR Card consumption notifications."""
        upper_text = text.upper()
        if not (
            "CMR" in upper_text
            or "BANCO FALABELLA" in upper_text
            or "FALABELLA" in upper_text
        ):
            return None

        merchant_match = re.search(
            r"(?:^|\n)\s*Comercio\s*:\s*([^\n\r]+)",
            text,
            re.IGNORECASE,
        )
        amount, currency = self._extract_amount_and_currency(text)

        if not (merchant_match and amount):
            return None

        merchant = merchant_match.group(1).strip().rstrip(" :.-")

        # Card mask (e.g. 447410******4422 -> 4422)
        card_match = re.search(
            r"Tarjeta\s*:\s*[^\n\r]*?(?:\*{2,}|\.{2,}|terminada en\s*)(\d{4})",
            text,
            re.IGNORECASE,
        )
        card_last4 = card_match.group(1) if card_match else None

        # Operation number
        op_match = re.search(
            r"Número de operación\s*:\s*([a-zA-Z0-9]+)", text, re.IGNORECASE
        )
        op_num = op_match.group(1) if op_match else None

        tx_time = self._extract_transaction_datetime(
            text, fallback_dt=email_date_header
        )

        if op_num:
            ext_id = f"cmr_{op_num}"
        elif email_id:
            ext_id = f"cmr_{email_id}"
        else:
            ext_id = f"cmr_{hashlib.sha256(f'{merchant}_{amount}_{tx_time}'.encode()).hexdigest()[:14]}"

        return EmailTransactionResult(
            is_transaction=True,
            merchant=merchant,
            amount=amount,
            currency=currency,
            transaction_time=tx_time,
            card_or_account=f"Card ****{card_last4}" if card_last4 else "CMR Card",
            operation_type="DEBIT",
            parser_used="regex_falabella_cmr",
            confidence=0.99,
            raw_description=f"CMR CARD: {merchant}",
            ext_transaction_id=ext_id,
            metadata={"source": "falabella_cmr", "operation_number": op_num},
        )

    def _parse_bbva_card(
        self,
        text: str,
        subject: str | None,
        email_id: str | None = None,
        email_date_header: datetime | None = None,
    ) -> EmailTransactionResult | None:
        """Regex parser for BBVA debit/credit card consumptions and QR merchant payments."""
        upper_text = text.upper()
        subj_upper = (subject or "").upper()
        if not ("BBVA" in upper_text or "BBVA" in subj_upper):
            return None
        if not (
            "CONSUMO" in upper_text
            or "CONSUMO" in subj_upper
            or "PAGAR CON QR" in upper_text
            or "PAGO A COMERCIOS" in upper_text
            or "PAGO A COMERCIOS" in subj_upper
            or "VISA COMPRAS" in upper_text
        ):
            return None

        # Check for rejection
        if "RECHAZADA" in upper_text or "RECHAZADO" in upper_text:
            return None

        # BBVA sends both 'Has realizado un consumo con tu tarjeta BBVA' AND 'BBVA - Constancia de pago a comercios con QR'
        # for QR payments linked to cards. Skip the QR receipt if it's already a card payment to prevent duplicate.
        if (
            "CONSTANCIA DE PAGO A COMERCIOS CON QR" in subj_upper
            or "PAGAR CON QR" in upper_text
            or "PAGO A COMERCIOS CON QR" in upper_text
        ):
            if (
                "VISA" in upper_text
                or "TARJETA" in upper_text
                or "VISA COMPRAS" in upper_text
            ):
                return EmailTransactionResult(
                    is_transaction=False,
                    parser_used="bbva_qr_card_duplicate_skip",
                    confidence=1.0,
                    metadata={"reason": "Card QR duplicate of card consumption alert"},
                )

        merchant_match = re.search(
            r"Comercio\s*[:\s]*([^\n\r]+)",
            text,
            re.IGNORECASE,
        )
        amount, currency = self._extract_amount_and_currency(text)
        if not (merchant_match and amount):
            return None

        merchant = merchant_match.group(1).strip().rstrip(" :.-")

        card_match = re.search(
            r"(?:Número de tarjeta|tarjeta terminada en)\s*[:\s•*]*(\d{4})",
            text,
            re.IGNORECASE,
        )
        card_last4 = card_match.group(1) if card_match else None

        op_match = re.search(
            r"(?:ID de compra|Número de operación|N° de operación|N° Operación)\s*[:\s]*([a-zA-Z0-9]+)",
            text,
            re.IGNORECASE,
        )
        op_num = op_match.group(1) if op_match else None

        tx_time = self._extract_transaction_datetime(
            text, fallback_dt=email_date_header
        )

        if op_num:
            ext_id = f"bbva_{op_num}"
        elif email_id:
            ext_id = f"bbva_card_{email_id}"
        else:
            ext_id = f"bbva_card_{hashlib.sha256(f'{merchant}_{amount}_{tx_time}'.encode()).hexdigest()[:14]}"

        return EmailTransactionResult(
            is_transaction=True,
            merchant=merchant,
            amount=amount,
            currency=currency,
            transaction_time=tx_time,
            card_or_account=f"Card ****{card_last4}" if card_last4 else "BBVA Card",
            operation_type="DEBIT",
            parser_used="regex_bbva_card",
            confidence=0.99,
            raw_description=f"BBVA CARD: {merchant}",
            ext_transaction_id=ext_id,
            metadata={
                "source": "bbva_card",
                "operation_number": op_num,
                "card_last4": card_last4,
            },
        )

    def _parse_bcp_card_consumption(
        self,
        text: str,
        subject: str | None,
        email_id: str | None = None,
        email_date_header: datetime | None = None,
    ) -> EmailTransactionResult | None:
        """Regex parser for BCP debit/credit card consumption alerts."""
        upper_text = text.upper()
        subj_upper = (subject or "").upper()
        if (
            "BBVA" in upper_text
            or "BBVA" in subj_upper
            or "CMR" in upper_text
            or "FALABELLA" in upper_text
        ):
            return None

        if not (
            "COMERCIO" in upper_text
            or "CONSUMO" in upper_text
            or "CREDIMÁS" in upper_text
            or "TARJETA" in upper_text
            or "ESTABLECIMIENTO" in upper_text
            or "EMPRESA" in upper_text
        ):
            return None

        merchant_match = re.search(
            r"(?:^|\n)\s*(?:Comercio|Establecimiento|Empresa|Lugar|Negocio|Tienda)\s*:\s*([^\n\r]+)",
            text,
            re.IGNORECASE,
        )
        amount, currency = self._extract_amount_and_currency(text)

        if not (merchant_match and amount):
            return None

        merchant = merchant_match.group(1).strip()
        # Clean merchant name from trailing technical keywords and delimiters
        merchant = (
            re.sub(
                r"\s*-\s*(?:Canal|POS|Internet|Vía).*$",
                "",
                merchant,
                flags=re.IGNORECASE,
            )
            .strip()
            .rstrip(" :.-")
        )

        # Masked card across multiline table layouts
        card_match = re.search(
            r"(?:Tarjeta|Débito|Crédito|Cuenta)[\s\S]*?(?:\*{2,}|\.{2,}|terminada en\s*)(\d{4})",
            text,
            re.IGNORECASE,
        )
        card_last4 = card_match.group(1) if card_match else None

        # Operation number
        op_match = re.search(
            r"(?:Número de operación|N° de operación|N° Operación)\s*:\s*([a-zA-Z0-9]+)",
            text,
            re.IGNORECASE,
        )
        op_num = op_match.group(1) if op_match else None

        # Timestamp
        tx_time = self._extract_transaction_datetime(
            text, fallback_dt=email_date_header
        )

        if op_num:
            ext_id = f"bcp_{op_num}"
        elif email_id:
            ext_id = f"bcp_card_{email_id}"
        else:
            ext_id = f"bcp_card_{hashlib.sha256(f'{merchant}_{amount}_{tx_time}'.encode()).hexdigest()[:14]}"

        return EmailTransactionResult(
            is_transaction=True,
            merchant=merchant,
            amount=amount,
            currency=currency,
            transaction_time=tx_time,
            card_or_account=f"Card ****{card_last4}" if card_last4 else None,
            operation_type="DEBIT",
            parser_used="regex_bcp_card",
            confidence=0.98,
            raw_description=f"BCP CARD: {merchant}",
            ext_transaction_id=ext_id,
            metadata={"source": "bcp_card_email", "operation_number": op_num},
        )

    def _parse_bcp_service_payment(
        self,
        text: str,
        subject: str | None,
        email_id: str | None = None,
        email_date_header: datetime | None = None,
    ) -> EmailTransactionResult | None:
        """Regex parser for BCP bill and utility payments (SEDAPAL, Luz del Sur, Telecom, etc.)."""
        upper_text = text.upper()
        if not (
            "PAGO DE SERVICIO" in upper_text
            or "PAGO DE SERVICIOS" in upper_text
            or "PAGO SERVICIO" in upper_text
            or "PAGO DE RECIBO" in upper_text
        ):
            return None

        empresa_match = re.search(
            r"(?:^|\n)\s*(?:Empresa|Institución|Servicio|Empresa o Institución)\s*:\s*([^\n\r]+)",
            text,
            re.IGNORECASE,
        )
        amount, currency = self._extract_amount_and_currency(text)

        if not (empresa_match and amount):
            return None

        empresa = empresa_match.group(1).strip().rstrip(" :.-")
        tx_time = self._extract_transaction_datetime(
            text, fallback_dt=email_date_header
        )

        op_match = re.search(
            r"(?:Número de operación|N° Operación)\s*:\s*([a-zA-Z0-9]+)",
            text,
            re.IGNORECASE,
        )
        op_num = op_match.group(1) if op_match else None

        if op_num:
            ext_id = f"bcp_svc_{op_num}"
        elif email_id:
            ext_id = f"bcp_svc_{email_id}"
        else:
            ext_id = f"bcp_svc_{hashlib.sha256(f'{empresa}_{amount}_{tx_time}'.encode()).hexdigest()[:14]}"

        return EmailTransactionResult(
            is_transaction=True,
            merchant=empresa,
            amount=amount,
            currency=currency,
            transaction_time=tx_time,
            card_or_account="BCP Pago Servicios",
            operation_type="DEBIT",
            parser_used="regex_bcp_service_payment",
            confidence=0.98,
            raw_description=f"BCP PAGO SERVICIO: {empresa}",
            ext_transaction_id=ext_id,
            metadata={
                "source": "bcp_service_payment_email",
                "operation_number": op_num,
            },
        )

    def _parse_yape(
        self,
        text: str,
        subject: str | None,
        email_id: str | None = None,
        email_date_header: datetime | None = None,
    ) -> EmailTransactionResult | None:
        """Regex parser for Yape payments (sent or received)."""
        upper_text = text.upper()
        subj_upper = (subject or "").upper()

        # Reject loan disbursements, credit offers or promotions
        if (
            "CRÉDITO" in upper_text
            or "CREDITO" in upper_text
            or "PRESTAMO" in upper_text
            or "PRÉSTAMO" in upper_text
            or "BENEFICIOS" in upper_text
            or "PROMOCIÓN" in upper_text
            or "PROMOCION" in upper_text
        ):
            return None

        is_sent = (
            "¡YAPEASTE!" in upper_text
            or "YAPEASTE" in upper_text
            or "ENVIASTE DINERO" in upper_text
            or "ENVIASTE A" in upper_text
            or "¡YAPEASTE!" in subj_upper
        )
        is_received = (
            "¡TE YAPEARON!" in upper_text
            or "TE YAPEARON" in upper_text
            or "TE YAPEÓ" in upper_text
            or "TE YAPEÉ" in upper_text
            or "RECIBISTE DINERO" in upper_text
            or "¡TE YAPEARON!" in subj_upper
        )

        if not (is_sent or is_received):
            return None

        op_type = "CREDIT" if is_received else "DEBIT"

        dest_match = re.search(
            r"(?:^|\n)\s*(?:Enviaste dinero a|Enviaste a|Destino|Te yape[oó]|Recibiste dinero de|Nombre|Para|De)\s*:\s*([^\n\r]+)",
            text,
            re.IGNORECASE,
        )
        amount, currency = self._extract_amount_and_currency(text)

        if not amount:
            return None

        op_num_match = re.search(
            r"(?:Nro\.? de Operaci[oó]n|Operaci[oó]n N[°o]?|N° Operación)\s*:?\s*(\d+)",
            text,
            re.IGNORECASE,
        )
        op_num = op_num_match.group(1) if op_num_match else None

        if not dest_match and not op_num:
            return None

        merchant = (
            dest_match.group(1).strip().rstrip(" :.-")
            if dest_match
            else ("Contacto Yape" if not is_received else "Remitente Yape")
        )

        tx_time = self._extract_transaction_datetime(
            text, fallback_dt=email_date_header
        )

        if op_num:
            ext_id = f"yape_{op_num}"
        elif email_id:
            ext_id = f"yape_{email_id}"
        else:
            ext_id = f"yape_{hashlib.sha256(f'{merchant}_{amount}_{tx_time}'.encode()).hexdigest()[:14]}"

        return EmailTransactionResult(
            is_transaction=True,
            merchant=f"Yape - {merchant}",
            amount=amount,
            currency="PEN",
            transaction_time=tx_time,
            card_or_account="Yape Digital Wallet",
            operation_type=op_type,
            parser_used="regex_yape",
            confidence=0.99,
            raw_description=f"YAPE {merchant}",
            ext_transaction_id=ext_id,
            metadata={"source": "yape_notification", "operation_number": op_num},
        )

    def _parse_bcp_transfer(
        self,
        text: str,
        subject: str | None,
        email_id: str | None = None,
        email_date_header: datetime | None = None,
    ) -> EmailTransactionResult | None:
        """Regex parser for BCP third-party, own-account, or interbank transfers."""
        upper_text = text.upper()
        if not ("TRANSFERENCIA" in upper_text or "CONSTANCIA" in upper_text):
            return None

        beneficiary_match = re.search(
            r"(?:^|\n)\s*(?:Beneficiario|Destino|Nombre del titular|Titular|Destinatario|Para|A la cuenta de|Cuenta destino)\s*:\s*([^\n\r]+)",
            text,
            re.IGNORECASE,
        )
        amount, currency = self._extract_amount_and_currency(text)

        if not (beneficiary_match and amount):
            return None

        beneficiary = beneficiary_match.group(1).strip().rstrip(" :.-")

        account_match = re.search(
            r"(?:Cuenta Origen|Desde la cuenta|Desde|Cuenta de cargo)\s*:?\s*([^\n\r]+)",
            text,
            re.IGNORECASE,
        )
        acct_source = (
            account_match.group(1).strip().rstrip(" :.-") if account_match else None
        )

        op_match = re.search(
            r"(?:Número de operación|N° Operación)\s*:\s*([a-zA-Z0-9]+)",
            text,
            re.IGNORECASE,
        )
        op_num = op_match.group(1) if op_match else None

        tx_time = self._extract_transaction_datetime(text)

        if op_num:
            ext_id = f"bcp_trf_{op_num}"
        elif email_id:
            ext_id = f"bcp_trf_{email_id}"
        else:
            ext_id = f"bcp_trf_{hashlib.sha256(f'{beneficiary}_{amount}_{tx_time}'.encode()).hexdigest()[:14]}"

        return EmailTransactionResult(
            is_transaction=True,
            merchant=f"Transferencia - {beneficiary}",
            amount=amount,
            currency=currency,
            transaction_time=tx_time,
            card_or_account=acct_source,
            operation_type="DEBIT",
            parser_used="regex_bcp_transfer",
            confidence=0.97,
            raw_description=f"BCP TRANSFER TO {beneficiary}",
            ext_transaction_id=ext_id,
            metadata={"source": "bcp_transfer_email", "operation_number": op_num},
        )

    async def _parse_with_llm(
        self,
        text: str,
        sender: str | None,
        subject: str | None,
        email_id: str | None = None,
        email_date_header: datetime | None = None,
    ) -> EmailTransactionResult:
        """Fallback LLM extractor for unstructured emails or unfamiliar bank layouts."""
        combined_context = f"Sender: {sender or 'Unknown'}\nSubject: {subject or 'Unknown'}\n\nBody:\n{text[:2500]}"
        try:
            data = await self.llm_adapter.extract_transaction_from_text(
                combined_context
            )
            is_tx = bool(data.get("is_transaction", False))
            if not is_tx or not data.get("amount"):
                return EmailTransactionResult(
                    is_transaction=False,
                    parser_used="llm_fallback",
                    confidence=float(data.get("confidence", 0.0)),
                )

            merchant = data.get("merchant") or "Unknown Payee"
            amount = float(data.get("amount", 0.0))
            currency = str(data.get("currency") or "PEN").upper()

            raw_time = data.get("transaction_time")
            tx_time = email_date_header or datetime.now(UTC)
            if raw_time:
                try:
                    tx_time = datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass

            card_last4 = data.get("card_last4")
            # Always make ext_id deterministic using email_id if available!
            if email_id:
                ext_id = f"llm_{email_id}"
            else:
                ext_id = f"llm_{hashlib.sha256(f'{merchant}_{amount}_{tx_time.date()}'.encode()).hexdigest()[:14]}"

            return EmailTransactionResult(
                is_transaction=True,
                merchant=merchant,
                amount=amount,
                currency=currency,
                transaction_time=tx_time,
                card_or_account=f"Card ****{card_last4}" if card_last4 else None,
                operation_type=data.get("operation_type", "DEBIT"),
                parser_used="llm_fallback",
                confidence=float(data.get("confidence", 0.85)),
                raw_description=f"EMAIL: {merchant}",
                ext_transaction_id=ext_id,
                metadata={"source": "llm_extracted"},
            )
        except Exception as e:
            logger.warning("LLM email extraction fallback failed: %s", e)
            return EmailTransactionResult(
                is_transaction=False,
                parser_used="llm_fallback",
                confidence=0.0,
                metadata={"error": str(e)},
            )

    async def parse_email(
        self,
        raw_body: str,
        sender: str | None = None,
        subject: str | None = None,
        email_id: str | None = None,
        email_date_header: datetime | None = None,
    ) -> EmailTransactionResult:
        """
        Master extraction entrypoint.
        Executes fast deterministic regex templates first, falling back to LLM reasoning if needed.
        """
        clean_text = self.clean_html_to_text(raw_body)
        if not clean_text:
            return EmailTransactionResult(
                is_transaction=False, parser_used="none", confidence=0.0
            )

        # 1. Quick filter
        if not self.is_financial_notification(sender, subject, clean_text):
            return EmailTransactionResult(
                is_transaction=False, parser_used="none", confidence=0.0
            )

        # 2. Try Deterministic Regex Parsers
        # Tier 2.1: Plin (BBVA / Interbank / BCP)
        plin_res = self._parse_plin(
            clean_text, subject, email_id=email_id, email_date_header=email_date_header
        )
        if plin_res:
            return plin_res

        # Tier 2.2: Yape
        yape_res = self._parse_yape(
            clean_text, subject, email_id=email_id, email_date_header=email_date_header
        )
        if yape_res:
            return yape_res

        # Tier 2.3: Banco Falabella CMR
        cmr_res = self._parse_falabella_cmr(
            clean_text, subject, email_id=email_id, email_date_header=email_date_header
        )
        if cmr_res:
            return cmr_res

        # Tier 2.4: BBVA Card Consumption
        bbva_card_res = self._parse_bbva_card(
            clean_text, subject, email_id=email_id, email_date_header=email_date_header
        )
        if bbva_card_res:
            return bbva_card_res

        # Tier 2.5: BCP Service Payment (Bills, Utilities)
        svc_res = self._parse_bcp_service_payment(
            clean_text, subject, email_id=email_id, email_date_header=email_date_header
        )
        if svc_res:
            return svc_res

        # Tier 2.6: BCP Card Consumption
        card_res = self._parse_bcp_card_consumption(
            clean_text, subject, email_id=email_id, email_date_header=email_date_header
        )
        if card_res:
            return card_res

        # Tier 2.7: BCP Transfer
        trf_res = self._parse_bcp_transfer(
            clean_text, subject, email_id=email_id, email_date_header=email_date_header
        )
        if trf_res:
            return trf_res

        # 3. Fallback to LLM
        logger.info("Regex templates missed. Delegating email to LLM parser fallback.")
        return await self._parse_with_llm(
            clean_text,
            sender,
            subject,
            email_id=email_id,
            email_date_header=email_date_header,
        )

    def _extract_transaction_datetime(
        self, text: str, fallback_dt: datetime | None = None
    ) -> datetime:
        """Parses extracted date and optional time into a timezone-aware UTC datetime."""
        peru_tz = timezone(timedelta(hours=-5))

        # 1. Textual Spanish date with optional time and AM/PM:
        # e.g.: 26 de setiembre de 2026 - 09:28 PM  OR  23 de septiembre, 2026
        m_spanish = re.search(
            r"(\d{1,2})\s+de\s+([a-zA-Z]+)(?:,|\s+de)?\s+(\d{4})(?:\s*(?:-|,|a las|Hora:)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?",
            text,
            re.IGNORECASE,
        )
        if m_spanish:
            day = int(m_spanish.group(1))
            month = SPANISH_MONTHS.get(m_spanish.group(2).lower(), 1)
            year = int(m_spanish.group(3))
            has_time = bool(m_spanish.group(4))
            fb_local = fallback_dt.astimezone(peru_tz) if fallback_dt else None
            hour = (
                int(m_spanish.group(4))
                if has_time
                else (fb_local.hour if fb_local else 12)
            )
            minute = (
                int(m_spanish.group(5))
                if has_time
                else (fb_local.minute if fb_local else 0)
            )
            second = (
                int(m_spanish.group(6))
                if m_spanish.group(6)
                else (fb_local.second if fb_local else 0)
            )
            ampm = m_spanish.group(7)
            if ampm and has_time:
                ampm = ampm.upper()
                if ampm == "PM" and hour < 12:
                    hour += 12
                elif ampm == "AM" and hour == 12:
                    hour = 0
            try:
                dt = datetime(year, month, day, hour, minute, second, tzinfo=peru_tz)
                return dt.astimezone(UTC)
            except Exception:
                pass

        # 2. Falabella style: 26-setiembre-2026 ... Hora: 18:40
        m_fala = re.search(
            r"(\d{1,2})-([a-zA-Z]+)-(\d{4})(?:[\s\S]*?Hora\s*:\s*(\d{1,2}):(\d{2}))?",
            text,
            re.IGNORECASE,
        )
        if m_fala:
            day = int(m_fala.group(1))
            month = SPANISH_MONTHS.get(m_fala.group(2).lower(), 1)
            year = int(m_fala.group(3))
            has_time = bool(m_fala.group(4))
            fb_local = fallback_dt.astimezone(peru_tz) if fallback_dt else None
            hour = (
                int(m_fala.group(4))
                if has_time
                else (fb_local.hour if fb_local else 12)
            )
            minute = (
                int(m_fala.group(5))
                if has_time
                else (fb_local.minute if fb_local else 0)
            )
            try:
                dt = datetime(year, month, day, hour, minute, 0, tzinfo=peru_tz)
                return dt.astimezone(UTC)
            except Exception:
                pass

        # 3. Standard DD/MM/YYYY or DD-MM-YYYY format with optional time (including BBVA multiline ': Hora:')
        m_standard = re.search(
            r"(?:Fecha y hora|Fecha de operación|Fecha)[:\s]*(\d{2}[/-]\d{2}[/-]\d{4})[\s:]*(?:a las|-|Hora)?[:\s]*(\d{2}:\d{2}(?::\d{2})?)?\s*(AM|PM)?",
            text,
            re.IGNORECASE,
        )
        if m_standard:
            date_raw = m_standard.group(1).replace("-", "/")
            fb_local = fallback_dt.astimezone(peru_tz) if fallback_dt else None
            time_raw = m_standard.group(2)
            if time_raw:
                if len(time_raw.split(":")) == 2:
                    time_raw += ":00"
                hour, minute, second = map(int, time_raw.split(":"))
                ampm = m_standard.group(3)
                if ampm:
                    ampm = ampm.upper()
                    if ampm == "PM" and hour < 12:
                        hour += 12
                    elif ampm == "AM" and hour == 12:
                        hour = 0
            else:
                hour = fb_local.hour if fb_local else 12
                minute = fb_local.minute if fb_local else 0
                second = fb_local.second if fb_local else 0
            try:
                d, m, y = map(int, date_raw.split("/"))
                dt = datetime(y, m, d, hour, minute, second, tzinfo=peru_tz)
                return dt.astimezone(UTC)
            except Exception:
                pass

        return fallback_dt or datetime.now(UTC)


email_parser_service = EmailTransactionParser()
