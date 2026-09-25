"""LLM Adapter Pattern and Model Factory."""

import json
import logging
import math
import random
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
import httpx
from src.core.config import settings

logger = logging.getLogger("LLMAdapters")


class BaseLLMAdapter(ABC):
    """Abstract interface for LLM operations and embeddings."""

    @abstractmethod
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate a 1536-dimensional dense embedding vector."""
        pass

    @abstractmethod
    async def classify_and_reflect(
        self,
        raw_description: str,
        amount: float,
        candidate_merchant: str,
        critique_history: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Classifies transaction and performs self-critique.
        Returns: {
            "merchant_name": str,
            "category": str,
            "subcategory": str,
            "confidence": float,
            "critique": str,
            "is_valid": bool
        }
        """
        pass


class OpenAIAdapter(BaseLLMAdapter):
    """OpenAI API implementation using structured JSON output."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.openai.com/v1"

    async def generate_embedding(self, text: str) -> List[float]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "input": text,
            "model": settings.EMBEDDING_MODEL,
            "dimensions": settings.EMBEDDING_DIMENSIONS
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{self.base_url}/embeddings", headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0]["embedding"]

    async def classify_and_reflect(
        self,
        raw_description: str,
        amount: float,
        candidate_merchant: str,
        critique_history: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        system_prompt = (
            "You are a Principal Financial Analyst and Taxonomy Classifier. "
            "Analyze the bank transaction description and assign a canonical merchant name, "
            "standard category, and subcategory. Reflect on ambiguous clues (e.g. gas station vs convenience store food)."
        )
        user_prompt = f"""
Raw Description: {raw_description}
Amount: ${amount:.2f}
Candidate Extracted Merchant: {candidate_merchant}
Previous Critiques: {json.dumps(critique_history or [])}

Respond ONLY in valid JSON matching this schema:
{{
    "merchant_name": "Canonical Brand Name",
    "category": "Food & Dining | Transportation | Utilities & Bills | Shopping & Retail | Entertainment & Leisure | Healthcare & Wellness | Financial & Fees | Income & Transfers",
    "subcategory": "Specific Subcategory",
    "confidence": 0.0 to 1.0,
    "critique": "Analysis of categorization confidence and edge case evaluation",
    "is_valid": true or false
}}
"""
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)


class MockLLMAdapter(BaseLLMAdapter):
    """Deterministic offline adapter for unit testing and local development without API keys."""

    async def generate_embedding(self, text: str) -> List[float]:
        rng = random.Random(text)
        vec = [rng.gauss(0, 1) for _ in range(1536)]
        norm = math.sqrt(sum(x * x for x in vec))
        return [x / norm for x in vec]

    async def classify_and_reflect(
        self,
        raw_description: str,
        amount: float,
        candidate_merchant: str,
        critique_history: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        text = raw_description.upper()
        if "COFFEE" in text or "STARBUCKS" in text or "BLUE BOTTLE" in text:
            return {
                "merchant_name": candidate_merchant or "Coffee Shop",
                "category": "Food & Dining",
                "subcategory": "Coffee Shops",
                "confidence": 0.96,
                "critique": "High confidence match based on brand and typical spend profile.",
                "is_valid": True
            }
        elif "UBER" in text or "LYFT" in text:
            return {
                "merchant_name": "Uber" if "UBER" in text else "Lyft",
                "category": "Transportation",
                "subcategory": "Rideshare & Taxis",
                "confidence": 0.98,
                "critique": "Verified rideshare transaction.",
                "is_valid": True
            }
        elif "SHELL" in text or "CHEVRON" in text or "GAS" in text:
            return {
                "merchant_name": "Shell Oil" if "SHELL" in text else "Chevron",
                "category": "Transportation",
                "subcategory": "Gas & Fuel",
                "confidence": 0.94,
                "critique": "Gas station merchant. Amount is consistent with fuel fill-up.",
                "is_valid": True
            }
        elif "NETFLIX" in text or "SPOTIFY" in text:
            return {
                "merchant_name": "Netflix" if "NETFLIX" in text else "Spotify",
                "category": "Entertainment & Leisure",
                "subcategory": "Streaming Subscriptions",
                "confidence": 0.99,
                "critique": "Identified digital recurring subscription.",
                "is_valid": True
            }
        else:
            return {
                "merchant_name": candidate_merchant or "Unknown Merchant",
                "category": "Shopping & Retail",
                "subcategory": "General Merchandise",
                "confidence": 0.85,
                "critique": "General retail classification assigned based on generic descriptor.",
                "is_valid": True
            }


class LLMAdapterFactory:
    """Factory to instantiate the appropriate LLM provider adapter."""

    @staticmethod
    def get_adapter() -> BaseLLMAdapter:
        if settings.OPENAI_API_KEY and settings.LLM_PROVIDER == "openai":
            return OpenAIAdapter(api_key=settings.OPENAI_API_KEY)
        else:
            logger.info("Initializing MockLLMAdapter (No external API key provided or LLM_PROVIDER != openai)")
            return MockLLMAdapter()
