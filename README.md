# Real-Time Multi-Account Financial Categorizer & Intelligence Agent

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_+_pgvector-4169E1.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-3.7-231F20.svg?logo=apachekafka&logoColor=white)](https://kafka.apache.org)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2+-FF6F00.svg)](https://langchain-ai.github.io/langgraph/)
[![Langfuse](https://img.shields.io/badge/Langfuse-Telemetry-000000.svg?logo=opentelemetry&logoColor=white)](https://langfuse.com)
[![AWS ECS Fargate](https://img.shields.io/badge/AWS-ECS_Fargate-FF9900.svg?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/ecs/)
[![Docker](https://img.shields.io/badge/Docker-Compose_Ready-2496ED.svg?logo=docker&logoColor=white)](https://docker.com)

> **30-Second Recruiter Summary:**
> A production-grade distributed personal finance intelligence platform that ingests raw banking webhooks across multi-bank accounts, guarantees deduplication and idempotency via an Apache Kafka pipeline, classifies cryptic transactions using a self-correcting **LangGraph reflection agent**, and streams verified records and budget anomaly alerts to a **React 19** dashboard via Server-Sent Events (SSE).

---

## 🎯 Executive Overview

```
+----------------------------------------------------------------------------------------------------+
|                                  SYSTEM PIPELINE ARCHITECTURE                                      |
|                                                                                                    |
|   [Bank Webhooks] ----> [FastAPI Ingestion] ----> [Apache Kafka] ----> [Agentic Worker]           |
|                                                                               |                    |
|                                                                       (LangGraph Agent)            |
|                                                                       - Merchant Entity Match      |
|                                                                       - pgvector Similarity        |
|                                                                       - Reflection / Validation    |
|                                                                               |                    |
|   [React 19 Dashboard] <---- [SSE Stream] <---- [PostgreSQL (ACID)] <---------+                    |
+----------------------------------------------------------------------------------------------------+
```

### The Problem Being Solved
Users maintaining checking, credit, and savings accounts across multiple banking institutions face:
1. **Cryptic & Truncated Payee Descriptors:** Bank strings like `SQ *COFFEE-STN-412 SAN FR` or `CHKPNT #9942 SEATTLE` prevent automated standard matching.
2. **Inconsistent Category Taxonomies:** Bank A labels an expense "Dining", Bank B labels it "Merchandise - Food", creating fragmented reporting.
3. **Silent Subscription Creep & Outlier Anomalies:** Recurring stealth charges or sudden 400% spikes go undetected until monthly statements arrive.
4. **Data Race Conditions & Duplication:** Retry storms from banking webhooks cause duplicate expense entries without idempotent processing.

### The Solution Architecture
`multi-account-finance-agent` decouples real-time ingestion from compute-heavy AI inference:
* **Ingestion Tier:** Asynchronous FastAPI endpoint validates bank HMAC signatures and issues an immediate `202 Accepted` after producing to a Kafka topic partitioned by `account_id`.
* **Streaming Backbone:** Apache Kafka guarantees sequential ordering per account and handles webhook burst loads with zero loss.
* **Agentic Reflection Engine:** A containerized worker running a LangGraph cyclic state machine extracts clean merchant entities, executes a fallback cosine similarity search against `pgvector` historical embeddings, reflects on classification confidence, and flags outliers.
* **Real-Time Delivery:** State changes commit to PostgreSQL and immediately emit over a Server-Sent Events (SSE) channel to a React 19 UI with sub-second feedback.

---

## 🌐 Live 24/7 Cloud Deployment ($0.00 USD Always Free)

The complete multi-container stack runs 24/7 in production on an **Oracle Cloud Infrastructure (OCI) Always Free Ampere A1 VM** (4 OCPU ARM64, 24 GB RAM, 50 GB NVMe SSD) with automated SSL edge routing via Cloudflare Tunnel:

* **Production Web App (Cloudflare HTTPS):** [https://institutions-done-timing-induction.trycloudflare.com](https://institutions-done-timing-induction.trycloudflare.com)
* **Direct Cloud Address:** [http://161.153.9.52:3000](http://161.153.9.52:3000)
* **Interactive API Documentation (Swagger / OpenAPI):** [http://161.153.9.52:3000/docs](http://161.153.9.52:3000/docs)
* **Telemetry & LLM Tracing (Langfuse):** [http://161.153.9.52:3001](http://161.153.9.52:3001)

### 🌿 Dual-Branch Repository Strategy
* **`main` (Active):** Production 24/7 Always Free deployment on Oracle Cloud Infrastructure + Docker Compose + automated GitHub Actions continuous deployment pipeline.
* **`OriginalLocalSolution`:** Preserves the original local simulation and AWS enterprise architecture (ECS Fargate + MSK + RDS pgvector) as originally planned.

---

## 🏗️ Architectural Highlights

| Dimension | Enterprise Specification |
| :--- | :--- |
| **Ingestion Latency SLA** | `< 25ms` (Webhook receipt -> Kafka ACK) |
| **End-to-End Processing SLA** | `< 1200ms` (Webhook ingestion -> Agent resolution -> SSE Client Delivery) |
| **Idempotency Guarantee** | Redis distributed lock + PostgreSQL unique hash key `(account_id, ext_transaction_id)` |
| **AI Reliability** | LangGraph reflection loop with deterministic guardrails (no invalid categories) |
| **Observability** | Full trace tracking, token usage, and latency attribution via Langfuse + OpenTelemetry |
| **Deployment Target** | 24/7 Oracle Cloud Always Free (Ampere ARM64 4 OCPU, 24 GB RAM) & AWS ECS Fargate compatible |
| **CI/CD Pipeline** | Automated GitHub Actions with PyTest (45 tests), Linters, and SSH/rsync continuous deployment |

---

## 📂 Multi-Tier Technical Documentation

Navigate the enterprise technical specifications:

* 🖥️ **[Visual Feature Walkthrough & Screenshots (features-walkthrough.md)](./docs/features-walkthrough.md):** End-to-end visual walkthrough with browser screenshots covering Dashboard, Activity, Spending Plan, Anomalies, Dark Mode, Spanish i18n, and Mobile views.
* 📐 **[System Architecture (Architecture.md)](./Architecture.md):** Complete component topology, cloud network boundaries, caching layers, and failure recovery modes.
* 🧩 **[Class & Entity Design (Class.md)](./Class.md):** OOP patterns (Strategy, Factory, Adapter for LLM providers), Pydantic schemas, and SQLAlchemy / Timescale data models.
* 📚 **[Documentation Directory (Index.md)](./Index.md):** Master index linking to granular API contracts and worker deep dives.
* 🔐 **[Google Sign-In & Security Isolation (google-sign-in.md)](./docs/google-sign-in.md):** OAuth 2.0 configuration, session isolation, and token encryption specifications.
* 🔌 **Granular API Specifications:**
  * [POST /api/v1/webhooks/transactions](./docs/api/webhooks_ingest.md)
  * [GET /api/v1/transactions](./docs/api/transactions_api.md)
  * [GET /api/v1/stream/events (SSE)](./docs/api/sse_stream.md)
* ⚙️ **Service & Worker Internals:**
  * [Kafka Consumer Group Service](./docs/services/kafka_consumer_service.md)
  * [LangGraph Reflection & Entity Resolution Agent](./docs/services/langgraph_reflection_agent.md)
  * [pgvector Semantic Merchant Resolver](./docs/services/pgvector_merchant_resolver.md)
  * [Real-Time Anomaly Detection Engine](./docs/services/anomaly_detection_engine.md)
* 🚀 **[Operations & Runbook (Operations.md)](./Operations.md):** Local setup (`docker-compose up`), Terraform provisioning, and telemetry guide.

---

## ⚡ Quickstart (Local Production Sandbox)

### Prerequisites
* Docker Engine 26+ & Docker Compose v2.20+
* Python 3.12+ (optional for local dev)
* Node.js 20+ (optional for frontend dev)

```bash
# 1. Clone the repository
git clone https://github.com/your-username/multi-account-finance-agent.git
cd multi-account-finance-agent

# 2. Configure environment
cp .env.example .env

# 3. Spin up complete infrastructure stack (Kafka, Postgres + pgvector, App, Worker, React, Langfuse)
docker compose up --build -d

# 4. Verify system health
curl http://localhost:8000/health
```

* **Web UI:** `http://localhost:3000`
* **FastAPI Docs (Swagger):** `http://localhost:8000/docs`
* **Langfuse Tracing:** `http://localhost:3001`

## Everyday dashboard

The FinStream interface offers a responsive overview, category spending breakdown,
searchable activity, account/currency/period filters, transaction details, CSV export,
amount privacy, a monthly spending target, and an unusual-purchase review queue.
An explicit **Explore a demo** button loads separate sample activity without writing
to the backend. Mobile navigation sits at the bottom of the screen.

### Run and verify the frontend

Use Node.js 24.15+ (also used by the frontend container and CI):

```sh
cd frontend
npm ci
npm run dev
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The dev server proxies `/api` to `localhost:8000`. Browser tests start an isolated
Vite server on port 3100 and use controlled API fixtures. The suite covers desktop
and mobile flows, accessibility, exports, storage persistence, API failures,
currency separation, and pagination. Backend tests can run in the existing API
container with `docker compose exec -T api python -m pytest tests -q`.

### Data behavior

- Summaries describe **loaded activity**, not bank balances. Use **Load older
  activity** to extend history; filters apply to loaded records.
- Currencies are kept separate. Positive amounts are expenses/payments; negative
  amounts are deposits/credits/refunds, following the existing API contract.
- Monthly targets cover all loaded transactions for the selected currency in the
  current month, regardless of activity filters. Refunds do not reduce gross spending.
- Targets and reviewed flags persist in this browser's local storage, with separate
  demo targets and user-specific storage. They are not synchronized between devices. Transaction data is not
  written to local storage.
- Live events are merged with history and deduplicated. A 30-second foreground
  refresh provides a fallback because the existing API and worker broadcaster is
  in-memory and does not transmit between processes. Cross-process real-time
  delivery remains a backend limitation.
- Google sign-in and read-only Gmail banking imports are restored, with per-user
  transaction access. See [Google sign-in setup and migration](docs/google-sign-in.md).
