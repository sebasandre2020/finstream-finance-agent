"""LangGraph Cyclic Reflection State Machine for Transaction Intelligence."""

import logging
import re
import uuid
from decimal import Decimal
from typing import TypedDict, List, Optional, Dict, Any

from langgraph.graph import StateGraph, END
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.adapters import LLMAdapterFactory, BaseLLMAdapter
from src.ai.pgvector_resolver import PgVectorMerchantResolver
from src.ai.anomaly_engine import AnomalyDetectionEngine

try:
    from langfuse.decorators import observe, langfuse_context
except ImportError:
    try:
        from langfuse import observe
        langfuse_context = None
    except ImportError:
        def observe(*args, **kwargs):
            def decorator(f):
                return f
            return decorator
        langfuse_context = None

logger = logging.getLogger("TransactionStateGraph")


class TransactionState(TypedDict):
    """Execution state for the LangGraph transaction categorization graph."""
    account_id: str
    ext_transaction_id: str
    amount: float
    raw_description: str
    candidate_merchant: str
    embedding: List[float]
    matched_from_cache: bool
    category: str
    subcategory: Optional[str]
    confidence_score: float
    reflection_iteration: int
    critique_history: List[str]
    is_valid: bool
    is_anomaly: bool
    anomaly_reason: Optional[str]


def clean_raw_description(raw: str) -> str:
    """Removes POS noise prefixes, store numbers, phone numbers, and addresses."""
    cleaned = raw.strip()
    # Strip common payment processor prefixes
    cleaned = re.sub(r'^(SQ\s*\*|TST\*\s*|PAYPAL\s*\*|SP\s*\*|CHECKOUT\s*\*|AMZN\s+MKTP\s+US\*)', '', cleaned, flags=re.IGNORECASE)
    # Strip store IDs like #412 or STORE 992
    cleaned = re.sub(r'#\d+|\bSTORE\s*\d+\b', '', cleaned, flags=re.IGNORECASE)
    # Strip trailing state and zip codes (e.g., CA 94102 US)
    cleaned = re.sub(r'\b[A-Z]{2}\s+\d{5}(\s+[A-Z]{2})?\b', '', cleaned)
    # Normalize whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned.title() if cleaned else raw.strip().title()


class TransactionAgentGraph:
    """Orchestrates the LangGraph agent lifecycle across database sessions."""

    def __init__(self, llm_adapter: Optional[BaseLLMAdapter] = None):
        self.llm = llm_adapter or LLMAdapterFactory.get_adapter()
        self.workflow = self._build_graph()

    def _build_graph(self):
        builder = StateGraph(TransactionState)

        # 1. Register Nodes
        builder.add_node("extract_entity", self._extract_entity_node)
        builder.add_node("vector_lookup", self._vector_lookup_node)
        builder.add_node("llm_reflection", self._llm_reflection_node)
        builder.add_node("upsert_merchant", self._upsert_merchant_node)
        builder.add_node("anomaly_detection", self._anomaly_detection_node)

        # 2. Define Edges and Conditional Branches
        builder.set_entry_point("extract_entity")
        builder.add_edge("extract_entity", "vector_lookup")

        builder.add_conditional_edges(
            "vector_lookup",
            self._cache_decision_edge,
            {
                "cache_hit": "anomaly_detection",
                "cache_miss": "llm_reflection"
            }
        )

        builder.add_conditional_edges(
            "llm_reflection",
            self._reflection_decision_edge,
            {
                "reflect_again": "llm_reflection",
                "approved": "upsert_merchant"
            }
        )

        builder.add_edge("upsert_merchant", "anomaly_detection")
        builder.add_edge("anomaly_detection", END)

        return builder.compile()

    # --- Node Implementations ---

    async def _extract_entity_node(self, state: TransactionState) -> Dict[str, Any]:
        """Extracts cleaned candidate merchant and generates embedding."""
        candidate = clean_raw_description(state["raw_description"])
        embedding = await self.llm.generate_embedding(candidate)
        return {
            "candidate_merchant": candidate,
            "embedding": embedding
        }

    async def _vector_lookup_node(self, state: TransactionState, session: AsyncSession = None) -> Dict[str, Any]:
        """Queries pgvector semantic cache for nearest resolved merchant."""
        # Note: session injection is handled via graph invoke context
        return state

    def _cache_decision_edge(self, state: TransactionState) -> str:
        """Determines if pgvector match bypassed the LLM."""
        return "cache_hit" if state.get("matched_from_cache", False) else "cache_miss"

    @observe(name="llm_reflection_node")
    async def _llm_reflection_node(self, state: TransactionState) -> Dict[str, Any]:
        """Invokes LLM reflection cycle to evaluate and classify unknown merchant."""
        iteration = state.get("reflection_iteration", 0) + 1
        history = list(state.get("critique_history", []))

        result = await self.llm.classify_and_reflect(
            raw_description=state["raw_description"],
            amount=state["amount"],
            candidate_merchant=state["candidate_merchant"],
            critique_history=history
        )

        history.append(f"Iteration {iteration}: {result.get('critique', '')}")

        return {
            "candidate_merchant": result.get("merchant_name", state["candidate_merchant"]),
            "category": result.get("category", "Shopping & Retail"),
            "subcategory": result.get("subcategory"),
            "confidence_score": float(result.get("confidence", 0.8)),
            "reflection_iteration": iteration,
            "critique_history": history,
            "is_valid": bool(result.get("is_valid", True))
        }

    def _reflection_decision_edge(self, state: TransactionState) -> str:
        """Loops back if confidence is low and iteration < 2."""
        if not state.get("is_valid", True) and state.get("reflection_iteration", 0) < 2:
            return "reflect_again"
        return "approved"

    async def _upsert_merchant_node(self, state: TransactionState) -> Dict[str, Any]:
        """Dummy pass-through; actual DB write occurs in the worker with the active session."""
        return state

    async def _anomaly_detection_node(self, state: TransactionState) -> Dict[str, Any]:
        """Dummy pass-through; actual anomaly calculation occurs in worker with active session."""
        return state

    @observe(name="transaction_reflection_graph")
    async def run(
        self,
        session: AsyncSession,
        account_id: str,
        ext_transaction_id: str,
        amount: Decimal,
        raw_description: str
    ) -> TransactionState:
        """Executes the complete state graph with database and resolver binding."""
        initial_state: TransactionState = {
            "account_id": account_id,
            "ext_transaction_id": ext_transaction_id,
            "amount": float(amount),
            "raw_description": raw_description,
            "candidate_merchant": "",
            "embedding": [],
            "matched_from_cache": False,
            "category": "Uncategorized",
            "subcategory": None,
            "confidence_score": 0.0,
            "reflection_iteration": 0,
            "critique_history": [],
            "is_valid": False,
            "is_anomaly": False,
            "anomaly_reason": None
        }

        # 1. Step 1: Entity cleaning and embedding
        clean_merchant = clean_raw_description(raw_description)
        embedding = await self.llm.generate_embedding(clean_merchant)
        initial_state["candidate_merchant"] = clean_merchant
        initial_state["embedding"] = embedding

        # 2. Step 2: Query pgvector semantic cache
        resolver = PgVectorMerchantResolver(session)
        match = await resolver.find_closest_merchant(embedding)

        if match:
            norm_name, cat, subcat, similarity = match
            initial_state["candidate_merchant"] = norm_name
            initial_state["category"] = cat
            initial_state["subcategory"] = subcat
            initial_state["confidence_score"] = similarity
            initial_state["matched_from_cache"] = True
            logger.info("⚡ pgvector Cache Hit for '%s' -> %s (%s)", clean_merchant, norm_name, cat)
        else:
            # 3. Step 3: Run LangGraph LLM reflection cycle
            logger.info("🧠 Running LangGraph Reflection cycle for unknown payee '%s'...", clean_merchant)
            final_graph_output = await self.workflow.ainvoke(initial_state)
            initial_state.update(final_graph_output)

            # Persist learned merchant to pgvector cache
            try:
                await resolver.upsert_merchant(
                    normalized_name=initial_state["candidate_merchant"],
                    category=initial_state["category"],
                    subcategory=initial_state["subcategory"],
                    embedding=initial_state["embedding"]
                )
            except Exception as e:
                logger.warning("Failed to upsert learned merchant entity: %s", e)

        # 4. Step 4: Run statistical anomaly detection
        anomaly_engine = AnomalyDetectionEngine(session)
        is_anom, reason = await anomaly_engine.evaluate_transaction(
            account_id=uuid.UUID(account_id),
            category=initial_state["category"],
            amount=amount
        )
        initial_state["is_anomaly"] = is_anom
        initial_state["anomaly_reason"] = reason

        return initial_state


transaction_agent_graph = TransactionAgentGraph()
