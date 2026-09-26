"""Sub-Millisecond Semantic Merchant Resolution using pgvector HNSW Index."""

import logging
from typing import Optional, Tuple, List
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.config import settings

logger = logging.getLogger("PgVectorMerchantResolver")


class PgVectorMerchantResolver:
    """Fast-path semantic cache for previously resolved merchants."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def find_closest_merchant(
        self,
        query_embedding: List[float],
        threshold: Optional[float] = None
    ) -> Optional[Tuple[str, str, Optional[str], float]]:
        """
        Executes an approximate nearest-neighbor query using pgvector HNSW cosine distance (<=>).
        Returns: (normalized_name, default_category, default_subcategory, similarity)
        """
        threshold = threshold or settings.PGVECTOR_SIMILARITY_THRESHOLD
        
        # Set ef_search for optimal query accuracy/latency balance
        await self.session.execute(text("SET LOCAL hnsw.ef_search = 40;"))

        # In pgvector: cosine distance d = 1 - cosine_similarity
        # Therefore: similarity = 1 - (embedding <=> :vector)
        sql = text("""
            SELECT 
                normalized_name,
                default_category,
                default_subcategory,
                1.0 - (embedding <=> CAST(:query_vec AS vector)) AS similarity
            FROM merchant_entities
            ORDER BY embedding <=> CAST(:query_vec AS vector) ASC
            LIMIT 1;
        """)

        vector_str = "[" + ",".join(str(f) for f in query_embedding) + "]"
        result = await self.session.execute(sql, {"query_vec": vector_str})
        row = result.fetchone()

        if row and row.similarity >= threshold:
            logger.debug(
                "pgvector Cache Hit: '%s' matched with similarity %.4f (threshold: %.2f)",
                row.normalized_name, row.similarity, threshold
            )
            return (
                row.normalized_name,
                row.default_category,
                row.default_subcategory,
                float(row.similarity)
            )

        return None

    async def upsert_merchant(
        self,
        normalized_name: str,
        category: str,
        subcategory: Optional[str],
        embedding: List[float]
    ) -> None:
        """Saves a newly categorized merchant into the pgvector cache."""
        vector_str = "[" + ",".join(str(f) for f in embedding) + "]"
        sql = text("""
            INSERT INTO merchant_entities (
                normalized_name, 
                default_category, 
                default_subcategory, 
                embedding, 
                occurrence_count, 
                created_at, 
                last_seen_at
            )
            VALUES (
                :name, 
                :cat, 
                :subcat, 
                CAST(:embedding AS vector), 
                1, 
                NOW(), 
                NOW()
            )
            ON CONFLICT (normalized_name) DO UPDATE SET
                occurrence_count = merchant_entities.occurrence_count + 1,
                last_seen_at = NOW();
        """)
        await self.session.execute(
            sql,
            {
                "name": normalized_name,
                "cat": category,
                "subcat": subcategory,
                "embedding": vector_str
            }
        )
        await self.session.commit()
