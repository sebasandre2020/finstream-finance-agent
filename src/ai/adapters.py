"""LLM Adapter Pattern and Model Factory."""

import json
import logging
import math
import random
from abc import ABC, abstractmethod
from typing import Any

import httpx

from src.core.config import settings

logger = logging.getLogger("LLMAdapters")


class BaseLLMAdapter(ABC):
    """Abstract interface for LLM operations and embeddings."""

    @abstractmethod
    async def generate_embedding(self, text: str) -> list[float]:
        """Generate a 1536-dimensional dense embedding vector."""

    @abstractmethod
    async def classify_and_reflect(
        self,
        raw_description: str,
        amount: float,
        candidate_merchant: str,
        critique_history: list[str] | None = None,
    ) -> dict[str, Any]:
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


class OpenAIAdapter(BaseLLMAdapter):
    """OpenAI API implementation using structured JSON output."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.openai.com/v1"

    async def generate_embedding(self, text: str) -> list[float]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "input": text,
            "model": settings.EMBEDDING_MODEL,
            "dimensions": settings.EMBEDDING_DIMENSIONS,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{self.base_url}/embeddings", headers=headers, json=payload
            )
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0]["embedding"]

    async def classify_and_reflect(
        self,
        raw_description: str,
        amount: float,
        candidate_merchant: str,
        critique_history: list[str] | None = None,
    ) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
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
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions", headers=headers, json=payload
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)


class MiniMaxAdapter(BaseLLMAdapter):
    """MiniMax API implementation using OpenAI-compatible chat endpoint."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.minimax.io/v1",
        model: str = "MiniMax-M3",
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def generate_embedding(self, text: str) -> list[float]:
        # MiniMax subscription token plan does not provide a 1536-d embedding endpoint.
        # We generate a deterministic 1536-d dense vector matching the seeded merchant vectors.
        rng = random.Random(text)
        vec = [rng.gauss(0, 1) for _ in range(settings.EMBEDDING_DIMENSIONS)]
        norm = math.sqrt(sum(x * x for x in vec))
        return [x / norm for x in vec]

    async def classify_and_reflect(
        self,
        raw_description: str,
        amount: float,
        candidate_merchant: str,
        critique_history: list[str] | None = None,
    ) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
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

Respond ONLY with a valid JSON object matching this schema, without markdown formatting or code blocks:
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
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions", headers=headers, json=payload
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]

            # 1. Clean <think>...</think> reasoning blocks from MiniMax-M3 / DeepSeek models
            import re

            content_clean = re.sub(
                r"<think>.*?</think>", "", content, flags=re.DOTALL
            ).strip()

            # 2. Extract JSON from markdown code fence if present
            if "```" in content_clean:
                match = re.search(
                    r"```(?:json)?\s*(\{.*?\})\s*```", content_clean, flags=re.DOTALL
                )
                if match:
                    content_clean = match.group(1).strip()
                else:
                    lines = content_clean.split("\n")
                    lines = [
                        line for line in lines if not line.strip().startswith("```")
                    ]
                    content_clean = "\n".join(lines).strip()

            # 3. Locate enclosing JSON object if preamble/postscript text exists
            if (
                not content_clean.startswith("{")
                and "{" in content_clean
                and "}" in content_clean
            ):
                start_idx = content_clean.find("{")
                end_idx = content_clean.rfind("}")
                content_clean = content_clean[start_idx : end_idx + 1]

            return json.loads(content_clean)


class MockLLMAdapter(BaseLLMAdapter):
    """Deterministic offline adapter for unit testing and local development without API keys."""

    async def generate_embedding(self, text: str) -> list[float]:
        rng = random.Random(text)
        vec = [rng.gauss(0, 1) for _ in range(1536)]
        norm = math.sqrt(sum(x * x for x in vec))
        return [x / norm for x in vec]

    async def classify_and_reflect(
        self,
        raw_description: str,
        amount: float,
        candidate_merchant: str,
        critique_history: list[str] | None = None,
    ) -> dict[str, Any]:
        text = raw_description.upper()
        if "COFFEE" in text or "STARBUCKS" in text or "BLUE BOTTLE" in text:
            return {
                "merchant_name": candidate_merchant or "Coffee Shop",
                "category": "Food & Dining",
                "subcategory": "Coffee Shops",
                "confidence": 0.96,
                "critique": "High confidence match based on brand and typical spend profile.",
                "is_valid": True,
            }
        elif "UBER" in text or "LYFT" in text:
            return {
                "merchant_name": "Uber" if "UBER" in text else "Lyft",
                "category": "Transportation",
                "subcategory": "Rideshare & Taxis",
                "confidence": 0.98,
                "critique": "Verified rideshare transaction.",
                "is_valid": True,
            }
        elif "SHELL" in text or "CHEVRON" in text or "GAS" in text:
            return {
                "merchant_name": "Shell Oil" if "SHELL" in text else "Chevron",
                "category": "Transportation",
                "subcategory": "Gas & Fuel",
                "confidence": 0.94,
                "critique": "Gas station merchant. Amount is consistent with fuel fill-up.",
                "is_valid": True,
            }
        elif "NETFLIX" in text or "SPOTIFY" in text:
            return {
                "merchant_name": "Netflix" if "NETFLIX" in text else "Spotify",
                "category": "Entertainment & Leisure",
                "subcategory": "Streaming Subscriptions",
                "confidence": 0.99,
                "critique": "Identified digital recurring subscription.",
                "is_valid": True,
            }
        else:
            return {
                "merchant_name": candidate_merchant or "Unknown Merchant",
                "category": "Shopping & Retail",
                "subcategory": "General Merchandise",
                "confidence": 0.85,
                "critique": "General retail classification assigned based on generic descriptor.",
                "is_valid": True,
            }


class LLMAdapterFactory:
    """Factory to instantiate the appropriate LLM provider adapter."""

    @staticmethod
    def get_adapter() -> BaseLLMAdapter:
        provider = (settings.LLM_PROVIDER or "").lower()

        # MiniMax Provider
        if (
            provider == "minimax" or settings.MINIMAX_API_KEY
        ) and settings.MINIMAX_API_KEY:
            logger.info(
                "Initializing MiniMaxAdapter (model=%s, url=%s)",
                settings.MINIMAX_MODEL,
                settings.MINIMAX_BASE_URL,
            )
            return MiniMaxAdapter(
                api_key=settings.MINIMAX_API_KEY,
                base_url=settings.MINIMAX_BASE_URL,
                model=settings.MINIMAX_MODEL,
            )

        # OpenAI Provider
        if (
            settings.OPENAI_API_KEY
            and settings.OPENAI_API_KEY != "your-openai-api-key-here"
            and provider == "openai"
        ):
            logger.info("Initializing OpenAIAdapter")
            return OpenAIAdapter(api_key=settings.OPENAI_API_KEY)

        logger.info(
            "Initializing MockLLMAdapter (No external API key provided or LLM_PROVIDER is mock)"
        )
        return MockLLMAdapter()
