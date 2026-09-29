"""Regression coverage for stable history cursors (including equal timestamps)."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from src.api.v1.transactions import decode_cursor, encode_cursor, list_transactions


def test_cursor_round_trip_and_invalid_cursor():
    timestamp = datetime(2026, 9, 27, tzinfo=UTC)
    transaction_id = uuid.uuid4()
    assert decode_cursor(encode_cursor(timestamp, transaction_id)) == (
        timestamp,
        transaction_id,
    )
    with pytest.raises(HTTPException) as error:
        decode_cursor("not-a-cursor")
    assert error.value.status_code == 400


@pytest.mark.asyncio
async def test_history_cursor_uses_timestamp_and_id_as_a_strict_pair():
    timestamp = datetime(2026, 9, 27, tzinfo=UTC)
    transaction_id = uuid.UUID("00000000-0000-0000-0000-000000000020")
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    db = SimpleNamespace(execute=AsyncMock(return_value=result))
    response = await list_transactions(
        account_id=None,
        category=None,
        is_anomaly=None,
        cursor=encode_cursor(timestamp, transaction_id),
        limit=2,
        db=db,
        user=SimpleNamespace(id=uuid.uuid4()),
    )
    query = db.execute.call_args.args[0]
    sql = str(
        query.compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    assert "transactions.transaction_time <" in sql
    assert "transactions.transaction_time =" in sql
    assert "transactions.id <" in sql
    assert "transactions.id !=" not in sql
    assert response.has_more is False
