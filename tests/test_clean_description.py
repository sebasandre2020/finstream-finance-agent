from src.ai.graph import clean_raw_description


def test_clean_raw_description_strip_square_prefix():
    raw = "SQ *BLUE BOTTLE COFFEE HAYES VALLEY CA 94102 US"
    cleaned = clean_raw_description(raw)
    assert "Square" not in cleaned
    assert "Blue Bottle Coffee" in cleaned
    assert "94102" not in cleaned


def test_clean_raw_description_strip_store_number():
    raw = "STARBUCKS STORE #0482 SEATTLE WA"
    cleaned = clean_raw_description(raw)
    assert "Starbucks" in cleaned
    assert "#0482" not in cleaned


def test_clean_raw_description_strip_paypal():
    raw = "PAYPAL *NETFLIX.COM"
    cleaned = clean_raw_description(raw)
    assert "Netflix.Com" in cleaned


def test_clean_raw_description_strip_peruvian_bank_prefixes():
    assert clean_raw_description("BCP CARD: RAPPI PERU") == "Rappi Peru"
    assert clean_raw_description("YAPE CARLOS SANCHEZ") == "Carlos Sanchez"
    assert clean_raw_description("BCP TRANSFER TO: JUAN PEREZ") == "Juan Perez"
    assert clean_raw_description("TRANSFERENCIA A: LUZ DEL SUR") == "Luz Del Sur"
