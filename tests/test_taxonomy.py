from src.core.taxonomy import FINANCIAL_TAXONOMY, PrimaryCategory, get_all_subcategories

def test_financial_taxonomy_integrity():
    assert PrimaryCategory.FOOD_AND_DINING in FINANCIAL_TAXONOMY
    assert "Coffee Shops" in FINANCIAL_TAXONOMY[PrimaryCategory.FOOD_AND_DINING]
    assert "Gas & Fuel" in FINANCIAL_TAXONOMY[PrimaryCategory.TRANSPORTATION]
    assert "Streaming Subscriptions" in FINANCIAL_TAXONOMY[PrimaryCategory.ENTERTAINMENT_AND_LEISURE]

def test_get_all_subcategories_not_empty():
    subcats = get_all_subcategories()
    assert len(subcats) > 20
    assert "Coffee Shops" in subcats
    assert "Electric & Gas" in subcats
