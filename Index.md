# Documentation Index: Multi-Account Financial Categorizer & Intelligence Agent

Welcome to the technical documentation registry for `multi-account-finance-agent`. This directory provides direct, deep-linked specifications across all system layers.

---

## 🏛️ System Core Specifications
* **[README.md](./README.md)** — Project elevator pitch, problem statement, key metrics, and local quickstart.
* **[Architecture.md](./Architecture.md)** — End-to-end component topology, AWS VPC/ECS Fargate layout, idempotency flow, and resilience modes.
* **[Class.md](./Class.md)** — Domain entities, OOP design patterns (Strategy, Adapter, Factory), and PostgreSQL + pgvector DDL.
* **[Operations.md](./Operations.md)** — Day-2 operational runbooks, local Docker compose environment, and Langfuse tracing.

---

## 🔌 API Specifications (`docs/api/`)
Detailed request/response contracts, schemas, headers, error codes, and SLAs.

| Document | Method & Path | Description | SLA Target |
| :--- | :--- | :--- | :--- |
| **[webhooks_ingest.md](./docs/api/webhooks_ingest.md)** | `POST /api/v1/webhooks/transactions` | Ingests raw banking webhooks, verifies HMAC signatures, and publishes to Kafka. | `< 25ms` |
| **[transactions_api.md](./docs/api/transactions_api.md)** | `GET /api/v1/transactions` | Paginated, multi-account filtered transaction query endpoint with sorting. | `< 50ms` |
| **[sse_stream.md](./docs/api/sse_stream.md)** | `GET /api/v1/stream/events` | Server-Sent Events stream for real-time frontend UI ledger updates and alerts. | `< 100ms` connect |

---

## ⚙️ Background Services & Worker Internals (`docs/services/`)
Algorithmic logic, concurrency models, state machines, and resilience strategies.

| Document | Service / Component | Core Responsibility |
| :--- | :--- | :--- |
| **[kafka_consumer_service.md](./docs/services/kafka_consumer_service.md)** | Kafka Consumer Group | Batch consumption, offset management, Dead Letter Queue (DLQ), and backpressure. |
| **[langgraph_reflection_agent.md](./docs/services/langgraph_reflection_agent.md)** | LangGraph Reflection Worker | Cyclic state machine, merchant entity extraction, self-correction reflection loop. |
| **[pgvector_merchant_resolver.md](./docs/services/pgvector_merchant_resolver.md)** | Semantic Resolver | HNSW index vector cosine similarity matching for past resolved merchant names. |
| **[anomaly_detection_engine.md](./docs/services/anomaly_detection_engine.md)** | Anomaly Detection | Rolling z-score and statistical outlier detection for transaction spending spikes. |

---

## 🚀 Infrastructure & CI/CD (`deploy/`)
* **[Docker Compose](../../multi-account-finance-agent/docker-compose.yml)** — Local environment orchestration (Kafka, Postgres/pgvector, Redis, FastAPI, Worker, React, Langfuse).
* **[GitHub Actions CI/CD](../../multi-account-finance-agent/.github/workflows/ci-cd.yml)** — Automated testing, linting, Docker image generation, and AWS ECS rollout.
* **[Terraform Modules](../../multi-account-finance-agent/deploy/terraform/)** — AWS production infrastructure as code (VPC, ECS, RDS, MSK).
