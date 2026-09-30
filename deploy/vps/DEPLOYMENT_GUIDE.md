# Zero-Cost Production Deployment Guide
## Multi-Account Finance Agent

This document explains the zero-cost architecture implemented for the technical demo and provides the steps for ongoing 24/7 cloud deployment.

---

### 1. Active Technical Demo (Live 24/7 in Cloud)

The application is deployed 24/7 on an Oracle Cloud Infrastructure Always Free VM (Ampere A1 ARM64, 4 OCPU, 24 GB RAM) and accessible worldwide at **$0.00 USD cost**:

* **Live Frontend & Demo Dashboard (Cloudflare Tunnel HTTPS):**  
  👉 **`https://institutions-done-timing-induction.trycloudflare.com`**
* **Direct Cloud Public IP Address:**  
  👉 **`http://161.153.9.52:3000`**
* **Interactive API Documentation (Swagger):**  
  👉 **`http://161.153.9.52:3000/docs`**
* **Observability & Tracing (Langfuse):**  
  👉 **`http://161.153.9.52:3001`**

---

### 2. Architecture & Components

The unified stack runs the complete event-driven financial intelligence engine:

```mermaid
flowchart TD
    Client["5 Concurrent Users / Browsers"] -->|HTTPS (Port 443)| CF["Cloudflare Tunnel Edge"]
    CF --> Frontend["Nginx Reverse Proxy & Static Frontend (:3000)"]
    Frontend -->|/api/* & /docs| API["FastAPI Application (:8000)"]
    API --> Redis[("Redis 7 Cache (:6379)")]
    API --> Postgres[("PostgreSQL 16 + pgvector (:5432)")]
    API --> Kafka["Apache Kafka Broker (:9092 / :29092)"]
    Kafka <--> ZK["Zookeeper (:2181)"]
    Kafka --> Worker["LangGraph AI Agent Worker"]
    Worker --> OpenAI["OpenAI / MiniMax LLM API"]
    Worker --> Postgres
    Worker --> Langfuse["Langfuse Observability (:3001)"]
```

---

### 3. Verification & Load Test Results

#### A. Automated Concurrency Test (5 Simultaneous Users)
Executed via `scripts/load_test_concurrency.py` over public HTTPS:
* **Total Requests:** 100
* **Successful (HTTP 200 OK):** 100 (100.0%)
* **Failures / Errors:** 0
* **Throughput:** 15.8 req/sec
* **Median Latency (p50):** 204.1 ms
* **Tail Latency (p95):** 504.1 ms
* **Evaluation:** Ready for production-level 5-user concurrent traffic with zero dropped requests.

#### B. Frontend End-to-End & WCAG Accessibility
Executed via `frontend/scripts/smoke-local.mjs` (Playwright + Axe-Core):
* Automated checks passed:
  * Google OAuth configuration validated.
  * Anonymous access to protected financial endpoints verified (HTTP 401).
  * Interactive demo state ("Explore a demo") loads and renders cleanly.
  * Zero WCAG 2.1 AA accessibility violations.

---

### 4. 24/7 Cloud Deployment: Oracle Cloud Always Free (\$0 Forever)

To keep the application running 24/7 in the cloud without keeping your local machine powered on:

1. **Create an Oracle Cloud Always Free Account:**
   * Go to [oracle.com/cloud/free](https://www.oracle.com/cloud/free/).
   * Select an **Ampere A1 Compute Instance** (ARM64, up to 4 OCPUs, 24 GB RAM, 200 GB Storage). This tier is **100% free of charge forever**.

2. **Connect via SSH and Clone Repository:**
   ```bash
   git clone <YOUR_GIT_REPO_URL>
   cd multi-account-finance-agent
   ```

3. **Run the 1-Line Automated Setup Script:**
   ```bash
   chmod +x deploy/vps/setup_vps.sh
   ./deploy/vps/setup_vps.sh
   ```

4. **Access the Application:**
   * The setup script installs Docker, configures the firewall, provisions `.env`, and starts all 8 services.
   * You can view the live Cloudflare Tunnel URL anytime with:
     ```bash
     docker logs finance_tunnel --tail 20
     ```

---

### 5. Automated CI/CD Deployment with GitHub Actions

The repository includes a GitHub Actions continuous deployment workflow (`.github/workflows/ci-cd.yml`):

* **Trigger:** Every `git push` to `main` (e.g. after merging a Pull Request).
* **Pipeline Stages:**
  1. **Code Quality:** Ruff linter, Black code format check, Bandit security scan, ESLint frontend lint.
  2. **Automated Tests:** Starts isolated PostgreSQL 16 (`pgvector`) & Redis services, runs all 45 integration & unit tests via PyTest.
  3. **Cloud Deploy:** Authenticates to the Oracle Cloud Always Free VM using repository secrets (`ORACLE_HOST`, `ORACLE_USER`, `ORACLE_SSH_KEY`), synchronizes updated files via `rsync` (safely preserving `.env` and data volumes), rebuilds and restarts the updated containers (`api`, `worker`, `frontend`), runs database migrations, and verifies service readiness.

#### Required GitHub Secrets:
* `ORACLE_HOST`: Public IP of the Oracle Cloud VM (`161.153.9.52`).
* `ORACLE_USER`: SSH username (`ubuntu`).
* `ORACLE_SSH_KEY`: Private SSH key for automated deployment.
