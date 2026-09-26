"""Unified Financial Expense Taxonomy Specification."""

from enum import StrEnum


class PrimaryCategory(StrEnum):
    FOOD_AND_DINING = "Food & Dining"
    TRANSPORTATION = "Transportation"
    UTILITIES_AND_BILLS = "Utilities & Bills"
    SHOPPING_AND_RETAIL = "Shopping & Retail"
    HEALTHCARE_AND_WELLNESS = "Healthcare & Wellness"
    ENTERTAINMENT_AND_LEISURE = "Entertainment & Leisure"
    FINANCIAL_AND_FEES = "Financial & Fees"
    INCOME_AND_TRANSFERS = "Income & Transfers"
    UNCATEGORIZED = "Uncategorized"


FINANCIAL_TAXONOMY: dict[PrimaryCategory, list[str]] = {
    PrimaryCategory.FOOD_AND_DINING: [
        "Coffee Shops",
        "Restaurants & Dining",
        "Groceries & Supermarkets",
        "Fast Food",
        "Bars & Nightlife",
        "Food Delivery",
    ],
    PrimaryCategory.TRANSPORTATION: [
        "Gas & Fuel",
        "Rideshare & Taxis",
        "Public Transit",
        "Tolls & Parking",
        "Automotive Maintenance",
        "Airlines & Flights",
    ],
    PrimaryCategory.UTILITIES_AND_BILLS: [
        "Electric & Gas",
        "Water & Sewage",
        "Internet & Cable",
        "Mobile Phone",
        "Waste Management",
    ],
    PrimaryCategory.SHOPPING_AND_RETAIL: [
        "Clothing & Apparel",
        "Electronics & Software",
        "Home Goods & Furniture",
        "General Merchandise",
        "Sporting Goods",
    ],
    PrimaryCategory.HEALTHCARE_AND_WELLNESS: [
        "Pharmacies & Medicine",
        "Doctors & Clinics",
        "Dental & Vision",
        "Gym & Fitness",
    ],
    PrimaryCategory.ENTERTAINMENT_AND_LEISURE: [
        "Streaming Subscriptions",
        "Movies & Theaters",
        "Concerts & Events",
        "Gaming & Apps",
    ],
    PrimaryCategory.FINANCIAL_AND_FEES: [
        "Bank Fees",
        "Interest Charges",
        "Investment Services",
        "Loan Payments",
    ],
    PrimaryCategory.INCOME_AND_TRANSFERS: [
        "Payroll & Direct Deposit",
        "Internal Account Transfer",
        "Refunds & Reimbursements",
        "Dividends & Interest",
    ],
    PrimaryCategory.UNCATEGORIZED: ["Manual Review Needed", "Ambiguous Payee"],
}


def get_all_subcategories() -> list[str]:
    subcats = []
    for subs in FINANCIAL_TAXONOMY.values():
        subcats.extend(subs)
    return subcats
