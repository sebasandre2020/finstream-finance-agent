"""Application Configuration and Environment Settings."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Application
    ENV: str = Field(default="development", description="Deployment environment")
    DEBUG: bool = Field(default=False)
    LOG_LEVEL: str = Field(default="INFO")
    SECRET_KEY: str = Field(default="dev-secret-key-change-in-production")
    WEBHOOK_SIGNING_SECRET: str = Field(default="local-test-hmac-secret-12345")

    # PostgreSQL Database + pgvector
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgrespassword@localhost:5432/finance_db",
        description="Async SQLAlchemy database URL",
    )
    DATABASE_POOL_SIZE: int = Field(default=20)
    DATABASE_MAX_OVERFLOW: int = Field(default=10)

    # Redis (Locks & Rate Limiting)
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    IDEMPOTENCY_TTL_SECONDS: int = Field(default=86400, description="24 hours")

    # Apache Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = Field(default="localhost:9092")
    KAFKA_RAW_TRANSACTIONS_TOPIC: str = Field(default="raw-transactions")
    KAFKA_DLQ_TOPIC: str = Field(default="raw-transactions-dlq")
    KAFKA_CONSUMER_GROUP: str = Field(default="finance-agent-categorizer-group")

    # AI & LLM Provider
    LLM_PROVIDER: str = Field(
        default="openai", description="openai | anthropic | minimax"
    )
    OPENAI_API_KEY: str | None = Field(default=None)
    ANTHROPIC_API_KEY: str | None = Field(default=None)
    MINIMAX_API_KEY: str | None = Field(default=None)
    MINIMAX_BASE_URL: str = Field(default="https://api.minimax.io/v1")
    MINIMAX_MODEL: str = Field(default="MiniMax-M3")
    EMBEDDING_MODEL: str = Field(default="text-embedding-3-small")
    EMBEDDING_DIMENSIONS: int = Field(default=1536)
    PGVECTOR_SIMILARITY_THRESHOLD: float = Field(default=0.92)

    # Langfuse Observability
    LANGFUSE_PUBLIC_KEY: str | None = Field(default=None)
    LANGFUSE_SECRET_KEY: str | None = Field(default=None)
    LANGFUSE_HOST: str = Field(default="http://localhost:3001")


settings = Settings()
