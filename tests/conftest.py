"""Pytest Fixtures and Configuration."""

import pytest
import os

# Set testing environment variables before importing application modules
os.environ["ENV"] = "testing"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/test_finance_db"
os.environ["REDIS_URL"] = "redis://localhost:6379/1"
os.environ["WEBHOOK_SIGNING_SECRET"] = "test-secret-key-12345"
os.environ["LLM_PROVIDER"] = "mock"
