"""OAuth and tenant isolation against a disposable PostgreSQL test database.
Set AUTH_TEST_DATABASE_URL to an isolated database; never uses the application DB.
"""

import os
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from src.api.session import SESSION_COOKIE, token_digest
from src.api.v1 import auth, stream, transactions
from src.db.models import Account, GoogleUserSession, Transaction
from src.db.session import get_db
from src.services.google_auth_service import GoogleAuthService
from src.services.sse_broadcaster import sse_broadcaster

URL = os.environ.get("AUTH_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not URL, reason="Requires isolated AUTH_TEST_DATABASE_URL"
)


@pytest_asyncio.fixture
async def state(monkeypatch):
    assert URL and "test" in URL.rsplit("/", 1)[-1]
    engine = create_async_engine(URL, poolclass=NullPool)
    async with engine.begin() as connection:
        for table in (
            GoogleUserSession.__table__,
            Account.__table__,
            Transaction.__table__,
        ):
            await connection.run_sync(
                lambda conn, t=table: t.create(conn, checkfirst=True)
            )
    async with engine.connect() as connection:
        outer = await connection.begin()
        db = AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        now = datetime.now(UTC)
        users, accounts, rows = [], [], []
        for index in range(2):
            user = GoogleUserSession(
                id=uuid.uuid4(),
                google_subject=f"sub-{uuid.uuid4()}",
                email=f"{uuid.uuid4()}@example.test",
                name=f"User {index}",
                access_token="fake-google-token",
                session_token=token_digest(f"token-{index}"),
                session_expires_at=now + timedelta(days=1),
            )
            account = Account(
                id=uuid.uuid4(),
                user_id=user.id,
                institution_name="Same bank",
                account_number_mask="*1234",
                currency="PEN",
            )
            row = Transaction(
                id=uuid.uuid4(),
                account_id=account.id,
                ext_transaction_id=f"tx-{index}",
                amount=10 + index,
                raw_description=f"Private purchase {index}",
                category="Groceries",
                confidence_score=1,
                is_anomaly=False,
                transaction_time=now,
                processed_at=now,
            )
            db.add_all([user, account, row])
            users.append(user)
            accounts.append(account)
            rows.append(row)
        await db.commit()
        app = FastAPI()
        for router in (auth.router, transactions.router, stream.router):
            app.include_router(router, prefix="/api/v1")

        async def dependency():
            yield db

        app.dependency_overrides[get_db] = dependency
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            yield SimpleNamespace(
                db=db, client=client, users=users, accounts=accounts, rows=rows
            )
        await db.close()
        await outer.rollback()
    await engine.dispose()


@pytest.mark.asyncio
async def test_finances_require_sign_in_and_are_isolated(state):
    c = state.client
    for path in [
        "/transactions",
        f"/transactions/{state.rows[0].id}",
        "/stream/events",
    ]:
        assert (await c.get("/api/v1" + path)).status_code == 401
    c.cookies.set(SESSION_COOKIE, "token-0")
    response = await c.get("/api/v1/transactions")
    assert response.status_code == 200
    assert [row["id"] for row in response.json()["data"]] == [str(state.rows[0].id)]
    assert (
        await c.get(f"/api/v1/transactions?account_id={state.accounts[1].id}")
    ).json()["data"] == []
    assert (await c.get(f"/api/v1/transactions/{state.rows[1].id}")).status_code == 404
    c.cookies.set(SESSION_COOKIE, "token-1")
    assert [
        row["id"] for row in (await c.get("/api/v1/transactions")).json()["data"]
    ] == [str(state.rows[1].id)]


@pytest.mark.asyncio
async def test_logout_csrf_and_session_revocation(state):
    c = state.client
    c.cookies.set(SESSION_COOKIE, "token-0")
    assert (
        await c.post("/api/v1/auth/logout", headers={"Origin": "https://attacker.test"})
    ).status_code == 403
    assert (await c.get("/api/v1/auth/me")).status_code == 200
    assert (
        await c.post(
            "/api/v1/auth/logout", headers={"Origin": auth.settings.FRONTEND_URL}
        )
    ).status_code == 200
    c.cookies.set(SESSION_COOKIE, "token-0")
    assert (await c.get("/api/v1/auth/me")).status_code == 401
    assert (await c.get("/api/v1/transactions")).status_code == 401


@pytest.mark.asyncio
async def test_oauth_rejects_missing_mismatched_and_replayed_state(state, monkeypatch):
    exchange = AsyncMock()
    monkeypatch.setattr(GoogleAuthService, "exchange_code_for_tokens", exchange)
    redis = SimpleNamespace(getdel=AsyncMock(return_value=None))
    monkeypatch.setattr(
        auth.idempotency_service, "get_client", AsyncMock(return_value=redis)
    )
    c = state.client
    for query, cookie in [
        ("state=a&code=x", None),
        ("state=a&code=x", "b"),
        ("state=a&code=x", "a"),
    ]:
        c.cookies.clear()
        if cookie:
            c.cookies.set(auth.STATE_COOKIE, cookie)
        response = await c.get("/api/v1/auth/google/callback?" + query)
        assert response.status_code == 303
        assert "state" in response.headers["location"]
    exchange.assert_not_awaited()


@pytest.mark.asyncio
async def test_verified_callback_preserves_identity_and_uses_httponly_cookie(
    state, monkeypatch
):
    user = state.users[0]
    redis = SimpleNamespace(getdel=AsyncMock(return_value="pending"))
    monkeypatch.setattr(
        auth.idempotency_service, "get_client", AsyncMock(return_value=redis)
    )
    monkeypatch.setattr(
        GoogleAuthService,
        "exchange_code_for_tokens",
        AsyncMock(
            return_value={
                "access_token": "fake-new-token",
                "refresh_token": "fake-refresh",
            }
        ),
    )
    monkeypatch.setattr(
        GoogleAuthService,
        "get_user_profile",
        AsyncMock(
            return_value={
                "sub": user.google_subject,
                "email": user.email,
                "email_verified": True,
                "name": "Signed In",
            }
        ),
    )
    state.client.cookies.set(auth.STATE_COOKIE, "state")
    response = await state.client.get(
        "/api/v1/auth/google/callback?state=state&code=test"
    )
    assert response.status_code == 303
    assert "session_token" not in response.headers["location"]
    assert "HttpOnly" in response.headers.get_list("set-cookie")[-1]
    assert "SameSite=lax" in response.headers.get_list("set-cookie")[-1]
    result = await state.client.get("/api/v1/auth/me")
    assert result.status_code == 200
    assert result.json()["id"] == str(user.id)
    assert "access_token" not in result.text and "session_token" not in result.text
    assert user.session_token.startswith("sha256:")


@pytest.mark.asyncio
async def test_stream_filters_other_users_transactions(state, monkeypatch):
    @asynccontextmanager
    async def factory():
        yield state.db

    monkeypatch.setattr(stream, "AsyncSessionLocal", factory)
    request = SimpleNamespace(is_disconnected=AsyncMock(return_value=False))
    generator = stream.event_generator(request, state.users[0])
    await anext(generator)
    await sse_broadcaster.broadcast(
        "transaction_processed",
        {"id": str(state.rows[1].id), "raw_description": "OTHER USER SECRET"},
    )
    await sse_broadcaster.broadcast(
        "transaction_processed",
        {"id": str(state.rows[0].id), "raw_description": "OWN PURCHASE"},
    )
    event = await anext(generator)
    assert "OWN PURCHASE" in event and "OTHER USER SECRET" not in event
    await generator.aclose()


@pytest.mark.asyncio
async def test_expired_session_and_unverified_google_identity_are_rejected(
    state, monkeypatch
):
    state.users[0].session_expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await state.db.commit()
    state.client.cookies.set(SESSION_COOKIE, "token-0")
    assert (await state.client.get("/api/v1/auth/me")).status_code == 401
    monkeypatch.setattr(
        auth.idempotency_service,
        "get_client",
        AsyncMock(
            return_value=SimpleNamespace(getdel=AsyncMock(return_value="pending"))
        ),
    )
    monkeypatch.setattr(
        GoogleAuthService,
        "exchange_code_for_tokens",
        AsyncMock(return_value={"access_token": "fake"}),
    )
    monkeypatch.setattr(
        GoogleAuthService,
        "get_user_profile",
        AsyncMock(
            return_value={
                "sub": "bad",
                "email": "unverified@example.test",
                "email_verified": False,
            }
        ),
    )
    state.client.cookies.set(auth.STATE_COOKIE, "state")
    response = await state.client.get(
        "/api/v1/auth/google/callback?state=state&code=test"
    )
    assert "sign_in_failed" in response.headers["location"]
    assert not any(
        cookie.startswith(SESSION_COOKIE + "=")
        for cookie in response.headers.get_list("set-cookie")
    )


@pytest.mark.asyncio
async def test_gmail_import_namespaces_identical_bank_accounts_by_user(
    state, monkeypatch
):
    import base64
    from decimal import Decimal

    from sqlalchemy import select

    from src.services import google_auth_service as service

    @asynccontextmanager
    async def factory():
        yield state.db

    monkeypatch.setattr(service, "AsyncSessionLocal", factory)

    def handler(request):
        if request.url.path.endswith("/messages"):
            return httpx.Response(200, json={"messages": [{"id": "same-message"}]})
        return httpx.Response(
            200,
            json={
                "payload": {
                    "headers": [],
                    "body": {
                        "data": base64.urlsafe_b64encode(
                            b"sample banking email"
                        ).decode()
                    },
                }
            },
        )

    original_client = httpx.AsyncClient
    monkeypatch.setattr(
        service.httpx,
        "AsyncClient",
        lambda **kwargs: original_client(transport=httpx.MockTransport(handler)),
    )
    parsed = SimpleNamespace(
        is_transaction=True,
        amount=Decimal("15.00"),
        currency="PEN",
        merchant="Shop",
        card_or_account="Card ****1234",
        raw_description="BCP CARD Shop",
        metadata={"source": "BCP_CARD"},
        ext_transaction_id="same-transaction",
        transaction_time=datetime.now(UTC),
        parser_used="test",
        operation_type="DEBIT",
    )
    monkeypatch.setattr(
        service.email_parser_service, "parse_email", AsyncMock(return_value=parsed)
    )
    monkeypatch.setattr(
        service.idempotency_service, "check_and_set", AsyncMock(return_value=True)
    )
    publish = AsyncMock(return_value=True)
    monkeypatch.setattr(
        service.kafka_producer_service, "publish_transaction_event", publish
    )
    for user in state.users:
        result = await GoogleAuthService.sync_gmail_transactions(
            "fake-token", user_id=user.id
        )
        assert result["synced"] == 1
    account_ids = [
        uuid.UUID(call.kwargs["account_id"]) for call in publish.call_args_list
    ]
    assert account_ids[0] != account_ids[1]
    for index, account_id in enumerate(account_ids):
        owner = await state.db.scalar(
            select(Account.user_id).where(Account.id == account_id)
        )
        assert owner == state.users[index].id


@pytest.mark.asyncio
async def test_worker_persists_vector_cache_miss_hit_and_duplicate(state, monkeypatch):
    from sqlalchemy import func, select, text

    from src.ai.adapters import MockLLMAdapter
    from src.ai.graph import transaction_agent_graph
    from src.db.models import MerchantEntity
    from src.workers.consumer import KafkaAgentWorker

    await state.db.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    await state.db.run_sync(
        lambda session: MerchantEntity.__table__.create(
            session.connection(), checkfirst=True
        )
    )
    monkeypatch.setattr(transaction_agent_graph, "llm", MockLLMAdapter())
    worker = KafkaAgentWorker()
    account = state.accounts[0]
    envelope = {
        "payload": {
            "account_id": str(account.id),
            "ext_transaction_id": "regression-vector-1",
            "amount": "42.35",
            "raw_description": "Regression Merchant " + str(uuid.uuid4()),
            "transaction_time": datetime.now(UTC).isoformat(),
        }
    }
    await worker.process_record(envelope, state.db)
    await worker.process_record(envelope, state.db)
    envelope["payload"]["ext_transaction_id"] = "regression-vector-2"
    await worker.process_record(envelope, state.db)
    count = await state.db.scalar(
        select(func.count())
        .select_from(Transaction)
        .where(
            Transaction.account_id == account.id,
            Transaction.ext_transaction_id.like("regression-vector-%"),
        )
    )
    assert count == 2
    assert await state.db.scalar(select(func.count()).select_from(MerchantEntity)) > 0


@pytest.mark.asyncio
async def test_sync_status_is_scoped_to_authenticated_profile(state, monkeypatch):
    import json

    from src.services.idempotency import idempotency_service

    values = {
        f"gmail:sync-result:{state.users[0].id}": json.dumps(
            {"status": "success", "synced": 3}
        ),
        f"gmail:sync:{state.users[1].id}": "active-lock",
    }
    redis = SimpleNamespace(get=AsyncMock(side_effect=lambda key: values.get(key)))
    monkeypatch.setattr(
        idempotency_service, "get_client", AsyncMock(return_value=redis)
    )
    assert (
        await state.client.get("/api/v1/auth/google/sync-status")
    ).status_code == 401
    for index, expected in [(0, "success"), (1, "syncing")]:
        state.client.cookies.set(SESSION_COOKIE, f"token-{index}")
        response = await state.client.get("/api/v1/auth/google/sync-status")
        assert response.status_code == 200
        assert response.json()["status"] == expected


@pytest.mark.asyncio
async def test_failed_gmail_sync_records_error_and_releases_lock(state, monkeypatch):
    from src.services import gmail_realtime_poller as module

    redis = SimpleNamespace(set=AsyncMock(return_value=True), eval=AsyncMock())
    monkeypatch.setattr(
        module.idempotency_service, "get_client", AsyncMock(return_value=redis)
    )

    @asynccontextmanager
    async def session():
        yield state.db

    monkeypatch.setattr(module, "AsyncSessionLocal", session)
    user = state.users[0]
    user.token_expires_at = datetime.now(UTC) + timedelta(hours=1)
    await state.db.commit()
    monkeypatch.setattr(
        module.GoogleAuthService,
        "sync_gmail_transactions",
        AsyncMock(side_effect=TimeoutError),
    )
    with pytest.raises(TimeoutError):
        await module.gmail_realtime_poller.sync_user_now(user.id)
    assert redis.set.call_args.args[0] == f"gmail:sync-result:{user.id}"
    assert '"error"' in redis.set.call_args.args[1]
    redis.eval.assert_awaited_once()
