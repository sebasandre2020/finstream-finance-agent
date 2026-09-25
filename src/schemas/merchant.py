"""Pydantic schemas for merchant entity catalog and vector resolutions."""

import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class MerchantEntityCreate(BaseModel):
    """Schema for registering a newly learned merchant into the vector catalog."""
    normalized_name: str = Field(..., min_length=2, max_length=255)
    default_category: str = Field(..., min_length=2, max_length=100)
    default_subcategory: Optional[str] = Field(None, max_length=100)
    embedding: List[float] = Field(..., min_length=1536, max_length=1536)


class MerchantEntityResponse(BaseModel):
    """Catalog response representing a recognized merchant."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    normalized_name: str
    default_category: str
    default_subcategory: Optional[str]
    occurrence_count: int
    created_at: datetime
    last_seen_at: datetime


class MerchantResolutionResult(BaseModel):
    """Output contract for vector semantic lookup and entity extraction."""
    matched_merchant_name: Optional[str] = None
    assigned_category: str
    assigned_subcategory: Optional[str] = None
    similarity_score: float = Field(ge=0.0, le=1.0)
    is_exact_match: bool = False
    is_vector_match: bool = False
    requires_reflection: bool = False
