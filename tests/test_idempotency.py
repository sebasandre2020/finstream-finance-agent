from src.services.idempotency import IdempotencyService

def test_idempotency_key_generation_deterministic():
    acct = "b0000000-0000-0000-0000-000000000001"
    tx_id = "plaid_tx_998811"
    
    key1 = IdempotencyService.generate_key(acct, tx_id)
    key2 = IdempotencyService.generate_key(acct, tx_id)
    
    assert key1 == key2
    assert key1.startswith("idempotency:tx:")

def test_idempotency_key_different_for_different_txs():
    acct = "b0000000-0000-0000-0000-000000000001"
    key1 = IdempotencyService.generate_key(acct, "tx_1")
    key2 = IdempotencyService.generate_key(acct, "tx_2")
    assert key1 != key2
