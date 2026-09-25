# Operations & Runbook: Multi-Account Financial Categorizer & Intelligence Agent

This runbook defines local development, day-2 operational commands, deployment routines, and production troubleshooting procedures.

---

## 1. Local Development Runbook

### 1.1 Environment Configuration (`.env`)
Create a `.env` file in the repository root:

```ini
# Application Core
ENV=development
LOG_LEVEL=info
SECRET_KEY=dev-secret-key-change-in-prod
WEBHOOK_SIGNING_SECRET=test-hmac-secret-12345

# Database (PostgreSQL 16 + pgvector)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/finance_db
DATABASE_POOL_SIZE=20

# Redis (Locks & Rate Limiting)
REDIS_URL=redis://localhost:6379/0

# Apache Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_CONSUMER_GROUP=finance-agent-categorizer-group

# AI & LLM Provider
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-your-key-here
ANTHROPIC_API_KEY=your-anthropic-key-optional

# Observability (Langfuse)
LANGFUSE_PUBLIC_KEY=pk-lf-local-test
LANGFUSE_SECRET_KEY=sk-lf-local-test
LANGFUSE_HOST=http://localhost:3001
```

### 1.2 Starting the Local Cluster
Spin up all infrastructure components (Postgres + pgvector, Kafka/Zookeeper, Redis, FastAPI App, Agentic Worker, React Frontend, and Langfuse):

```bash
# Build and start all services
docker compose up --build -d

# Verify container statuses
docker compose ps
```

### 1.3 Running Database Migrations
```bash
# Run Alembic migrations to create tables and vector indexes
docker compose exec api alembic upgrade head
```

### 1.4 Simulating Banking Webhooks (Test Harness)
We provide a Python simulation script to fire signed test webhooks:

```bash
# Run the mock transaction generator (sends 20 random transactions)
python scripts/simulate_bank_feed.py --count 20 --interval 0.5
```

---

## 2. Infrastructure as Code (Terraform Provisioning)

Production deployment on AWS is automated via Terraform in `deploy/terraform/`.

```bash
cd deploy/terraform

# 1. Initialize Terraform
terraform init

# 2. Plan deployment against AWS target
terraform plan -var-file="environments/prod.tfvars" -out=tfplan

# 3. Apply infrastructure (VPC, ECS, RDS, MSK)
terraform apply tfplan
```

### Core Resources Provisioned:
* `aws_vpc` with 3 public, 3 private application, and 3 isolated database subnets.
* `aws_ecs_cluster` & `aws_ecs_service` for API and Worker tasks.
* `aws_db_instance` (PostgreSQL 16 Multi-AZ) with `pgvector` enabled.
* `aws_msk_cluster` (Managed Streaming for Kafka, 3 brokers).
* `aws_elasticache_replication_group` (Redis 7 cluster mode).

---

## 3. Observability, Telemetry & Tracing

### 3.1 LLM Tracing with Langfuse
* Web UI accessible locally at: `http://localhost:3001`
* Every transaction categorized by LangGraph creates a trace displaying:
  * Prompt inputs & system instructions.
  * Extracted merchant name & vector search score.
  * Reflection iteration loops and critique rationale.
  * Exact latency per node and token costs.

### 3.2 Prometheus Metrics
The FastAPI service exposes `/metrics` for Prometheus scraping:
* `http_requests_total{status="200|401|422|500"}`
* `http_request_duration_seconds_bucket`
* `kafka_consumer_lag_records{topic="raw-transactions"}`
* `agent_reflection_loops_total`
* `anomalies_detected_total`

---

## 4. Operational Playbooks & Troubleshooting

### Scenario A: Kafka Consumer Lag Spikes (> 1,000 unread messages)
1. **Diagnosis:** Run `docker compose exec kafka kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group finance-agent-categorizer-group`
2. **Immediate Remediation:** Scale worker ECS tasks:
   ```bash
   aws ecs update-service --cluster finance-prod --service finance-worker --desired-count 6
   ```
3. **Check Circuit Breaker:** Verify in CloudWatch if upstream OpenAI/Anthropic latency has degraded, causing workers to slow down. If so, flip `FORCE_PGVECTOR_ONLY=true` in environment variables.

### Scenario B: Poison Pill Message Crashing Consumer
1. Verify error in worker logs: `docker compose logs worker --tail=100 | grep "DLQ"`
2. Poison pill is automatically diverted to `raw-transactions-dlq` after 3 failed attempts.
3. Inspect and replay DLQ messages once patched:
   ```bash
   python scripts/replay_dlq.py --max-messages 50
   ```

### Scenario C: PostgreSQL Vector Index Re-indexing
If query latency on `merchant_entities` degrades after ingesting 200,000+ new merchants:
```sql
REINDEX TABLE CONCURRENTLY merchant_entities;
```
