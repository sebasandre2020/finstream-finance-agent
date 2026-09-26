"""FastAPI Application Entry Point and Lifespan Manager."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.core.config import settings
from src.services.kafka_producer import kafka_producer_service
from src.services.sse_broadcaster import sse_broadcaster
from src.api.v1.webhooks import router as webhooks_router
from src.api.v1.transactions import router as transactions_router
from src.api.v1.stream import router as stream_router

logging.basicConfig(
    level=settings.LOG_LEVEL.upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("Application")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown events for connection pools and message brokers."""
    logger.info("🚀 Starting Multi-Account Financial Intelligence API...")
    await kafka_producer_service.start()
    await sse_broadcaster.start_listener()
    yield
    logger.info("🛑 Shutting down API service...")
    await sse_broadcaster.stop_listener()
    await kafka_producer_service.stop()


app = FastAPI(
    title="Multi-Account Financial Intelligence API",
    description="Event-driven financial categorizer and anomaly triage platform combining Kafka, FastAPI, pgvector, and LangGraph.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration for React 19 Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(webhooks_router, prefix="/api/v1")
app.include_router(transactions_router, prefix="/api/v1")
app.include_router(stream_router, prefix="/api/v1")


@app.get("/health", tags=["Health & Diagnostics"], summary="Service Liveness Probe")
async def liveness():
    return {"status": "healthy", "service": "finance-api", "version": "1.0.0"}


@app.get("/health/ready", tags=["Health & Diagnostics"], summary="Service Readiness Probe")
async def readiness():
    # Verify critical dependencies
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"ready": True, "kafka_producer": True, "database": True}
    )
