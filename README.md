# Health Vault

Health Vault is a personal health and medical record vault — a secure, self-hosted platform that lets individuals store, manage, and share their health records (lab results, prescriptions, imaging, immunisations, etc.) with full audit trails and end-to-end encryption. The backend is a Spring Boot 3.x REST API backed by PostgreSQL, and the frontend is an Angular 16 PWA.

> **Current phase: Phase 7 (Observability).** Phases 0–7 in progress. See [PROGRESS.md](PROGRESS.md) for full detail.

---

## Repository Structure

```
health-vault/
├── backend/                  Spring Boot 3.3.5 (Java 17, Maven, PostgreSQL 15.4)
│   ├── src/main/java/com/healthvault/
│   │   ├── HealthVaultApplication.java
│   │   ├── common/
│   │   │   └── EncryptionService.java        ← AES-256-GCM field-level encryption
│   │   ├── audit/                            ← audit trail (Phase 5)
│   │   │   ├── AuditAction.java              ← 11-action enum
│   │   │   ├── AuditResourceType.java
│   │   │   ├── entity/AuditLog.java          ← JSONB metadata, nullable user_id
│   │   │   ├── repository/                   ← JpaSpecificationExecutor + specs
│   │   │   ├── service/AuditService.java     ← REQUIRES_NEW, fail-open
│   │   │   ├── dto/AuditLogResponse.java
│   │   │   └── controller/AuditLogController.java
│   │   ├── auth/                             ← JWT auth, refresh tokens, rate-limit
│   │   ├── metrics/                          ← health metric CRUD + dashboard
│   │   ├── documents/                        ← secure document upload/download + status
│   │   └── ingestion/                        ← async OCR pipeline (Kafka + Tika)
│   │       ├── config/KafkaConfig.java       ← NewTopic beans
│   │       ├── consumer/                     ← @KafkaListener on document.uploaded
│   │       ├── event/                        ← DocumentUploadedEvent, DocumentProcessedEvent
│   │       ├── extractor/                    ← MetricExtractor strategy + 4 implementations
│   │       ├── repository/
│   │       └── service/                      ← OcrService, MetricExtractionService, IngestionService
│   ├── src/main/resources/
│   │   ├── application.yml                   ← base config (JWT, MinIO, Kafka, encryption)
│   │   ├── application-local.yml             ← localhost services
│   │   ├── application-docker.yml            ← docker-compose services
│   │   ├── application-prod.yml              ← env-var-only, no hardcoded secrets
│   │   └── db/migration/
│   │       ├── V1__init.sql                  ← schema bootstrap
│   │       ├── V2__auth.sql                  ← users + refresh_tokens
│   │       ├── V3__health_metrics.sql        ← health_metrics (JSONB)
│   │       ├── V4__documents.sql             ← documents (encrypted_filename BYTEA)
│   │       ├── V5__document_extractions.sql  ← processed_at, document_extractions table
│   │       └── V6__audit_logs.sql            ← audit_logs (JSONB metadata, two indexes)
│   └── pom.xml
├── gateway/                  Spring Cloud Gateway 2023.0.3 (WebFlux, port 8081)
│   ├── src/main/java/com/healthvault/gateway/
│   │   ├── GatewayApplication.java
│   │   └── config/
│   │       ├── KeyResolverConfig.java        ← ipKeyResolver + userOrIpKeyResolver
│   │       └── RateLimitErrorFilter.java     ← JSON body on 429
│   ├── src/main/resources/
│   │   ├── application.yml                   ← routes, rate-limit config, globalcors
│   │   ├── application-local.yml
│   │   └── application-docker.yml
│   └── pom.xml
├── frontend/                 Angular 16.2.15 PWA (standalone components)
│   └── src/app/
│       ├── auth/             ← login, register, interceptor, guard
│       ├── metrics/          ← metric entry form, list, dashboard (Chart.js)
│       ├── documents/        ← upload, list, viewer (PDF iframe + image zoom)
│       └── audit-log/        ← activity log view (filter, day-grouping, pagination)
├── infra/
│   └── docker/
│       └── docker-compose.yml   ← Postgres 15.4 + Redis 7 + MinIO + Kafka
├── .github/
│   └── workflows/ci.yml         ← backend-build + frontend-build + gateway-build jobs
├── .env.example                 ← all environment variables (copy → .env)
├── PROGRESS.md                  ← phase-by-phase dev log and AC verification
├── SETUP.md                     ← local and higher-env setup guide
└── README.md
```

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Java | 17 LTS (17.0.6+ tested; 21 supported if locally installed) |
| Maven | 3.9+ (or use the included `mvnw` wrapper) |
| Node.js | LTS (20.x tested) |
| npm | 9+ |
| Docker Desktop | Latest stable |

---

## Running Locally

> Full step-by-step setup with prerequisites is in [SETUP.md](SETUP.md). The summary below assumes all tools are installed.

Health Vault needs **four processes running simultaneously**. Open four terminal windows and run one command per window in order.

### Step 1 — Environment file (once)

```bash
cp .env.example .env
```

Defaults work for local dev as-is. In any real deployment replace `JWT_SECRET`, `DOCUMENT_ENCRYPTION_KEY`, and `GRAFANA_ADMIN_PASSWORD`.

### Step 2 — Docker infrastructure (Terminal 1)

```bash
docker compose -f infra/docker/docker-compose.yml up -d
docker compose -f infra/docker/docker-compose.yml ps   # wait: all services healthy
```

| Service        | Port | Purpose |
|----------------|------|---------|
| postgres       | 5432 | Primary database |
| redis          | 6379 | JWT blacklist + rate-limit window |
| minio          | 9000 / 9001 | Document object storage |
| kafka          | 9092 | Async OCR event bus |
| prometheus     | 9090 | Metrics scraper |
| grafana        | 3000 | Pre-provisioned dashboards |
| zipkin         | 9411 | Distributed trace UI |
| redis-exporter | 9121 | Redis → Prometheus bridge |

### Step 3 — Backend on port 8080 (Terminal 2)

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

Wait for `Started HealthVaultApplication` before continuing. Flyway applies all DB migrations automatically on first startup.

### Step 4 — Gateway on port 8081 (Terminal 3)

> **Do not skip.** The frontend sends every API call to port 8081. Without the gateway the app will not work.

```bash
cd gateway
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

Wait for `Started GatewayApplication`.

### Step 5 — Frontend on port 4299 (Terminal 4)

```bash
cd frontend
npm install --legacy-peer-deps
ng serve --port 4299
```

Open [http://localhost:4299](http://localhost:4299) and log in with `demo@healthvault.local` / `Demo@1234`.

---

## Environment Variables

All variables are documented in [`.env.example`](.env.example). Key groups:

| Group | Variables |
|-------|-----------|
| Spring profile | `SPRING_PROFILES_ACTIVE` |
| PostgreSQL | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` |
| Redis | `REDIS_HOST`, `REDIS_PORT` |
| MinIO | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME`, `MINIO_PRESIGNED_URL_EXPIRY_MINUTES` |
| Kafka | `KAFKA_BOOTSTRAP_SERVERS` (default `localhost:9092`) |
| JWT | `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL_MINUTES`, `JWT_REFRESH_TOKEN_TTL_DAYS` |
| Encryption | `DOCUMENT_ENCRYPTION_KEY` (base64-encoded 32-byte AES key — field-level encryption for filenames and OCR text) |
| Document limits | `DOCUMENT_MAX_SIZE_BYTES` (default 26214400 = 25 MB) |
| Gateway | `GATEWAY_PORT` (default 8081), `CORE_API_URL` (default `http://localhost:8080`), rate-limit tuning vars |
| Observability | `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`, `ZIPKIN_ENDPOINT` |

---

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs three jobs on every push and PR:
- **backend-build** — `mvn -B verify -DskipTests` on JDK 17
- **frontend-build** — `npm ci && npm run build` on Node LTS
- **gateway-build** — `mvn -B verify -DskipTests` on JDK 17 (gateway module)

The workflow file is ready; activate it by adding a GitHub remote once one is configured.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | Service health check |
| `POST` | `/api/auth/register` | No | Register → 201 |
| `POST` | `/api/auth/login` | No | Login → tokens |
| `POST` | `/api/auth/refresh` | No | Rotate refresh token |
| `POST` | `/api/auth/logout` | Yes | Revoke tokens → 204 |
| `GET` | `/api/users/me` | Yes | Current user profile |
| `POST` | `/api/metrics` | Yes | Log a health metric → 201 |
| `GET` | `/api/metrics` | Yes | List metrics (paged, filterable) |
| `GET` | `/api/metrics/dashboard` | Yes | Bucketed aggregations for chart |
| `GET` | `/api/metrics/{id}` | Yes | Single metric |
| `PUT` | `/api/metrics/{id}` | Yes | Update metric value |
| `DELETE` | `/api/metrics/{id}` | Yes | Soft delete metric → 204 |
| `POST` | `/api/documents` | Yes | Upload document (multipart) → 201 |
| `GET` | `/api/documents` | Yes | List documents (paged, filterable) |
| `GET` | `/api/documents/{id}` | Yes | Document metadata |
| `GET` | `/api/documents/{id}/download-url` | Yes | Presigned MinIO URL (5 min TTL) |
| `GET` | `/api/documents/{id}/status` | Yes | OCR processing status + metrics extracted count |
| `DELETE` | `/api/documents/{id}` | Yes | Soft-delete DB row + hard-delete MinIO object → 204 |
| `GET` | `/api/audit-log/me` | Yes | Current user's audit log (paged, filterable by action/date) |

> **Note:** In Phase 5, all `/api/**` requests are routed through the gateway on **port 8081**, which adds rate limiting and CORS before forwarding to the Core API on 8080.

## Observability (Phase 7)

The full observability stack starts with `docker compose up` alongside the existing infra services.

### Access points

| Tool | URL | Purpose |
|------|-----|---------|
| Grafana | http://localhost:3000 | Dashboards (login with `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` from `.env`) |
| Prometheus | http://localhost:9090 | Raw metrics, target status, PromQL scratchpad |
| Zipkin | http://localhost:9411 | Distributed traces — find a trace by `X-Request-ID` header value |

### Grafana dashboards

Four dashboards are pre-provisioned at Grafana startup — no manual import needed.

| Dashboard | What it answers |
|-----------|----------------|
| **Request Latency & Error Rate** | p50/p95/p99 latency per route for Core API and gateway; 5xx error rate; throughput (req/s) |
| **Upload & Ingestion Throughput** | Uploads per minute by category; upload and processing duration distribution; PROCESSED vs FAILED ratio; in-flight / stuck document indicator |
| **Auth & Security Signals** | Login success/failure rate per minute; failure ratio gauge (early brute-force signal); rate-limiter 429s by route |
| **JVM & System Health** | Heap used/max, GC pause rate, thread count, and process CPU for both modules |

### Correlation IDs

Every request carries a single `X-Request-ID` header that unifies three systems:

- **Response header** — returned to the client on every response from the gateway
- **Structured logs** — appears as `requestId` (Core API) and is the Micrometer `traceId` (gateway) in JSON log lines
- **Zipkin trace** — the trace ID in Zipkin equals the `X-Request-ID` value

To trace a request end-to-end:
1. Capture `X-Request-ID` from any API response header.
2. Open Zipkin at `http://localhost:9411/zipkin/traces/<X-Request-ID>` to see the full gateway → Core API → Postgres span.
3. Or grep structured logs: `docker logs healthvault-backend 2>&1 | jq 'select(.requestId == "<id>")'`

> **Note:** Kafka publish/consume boundaries are not traced — trace propagation across the document.uploaded / document.processed topics is deferred to when the worker is split into a separate service.

### Prod profile actuator surface

In production, only these actuator endpoints are exposed — nothing else:

```
/actuator/health
/actuator/info
/actuator/prometheus
```

### Grafana credentials

Set `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` in your `.env` file before starting the stack. Defaults in `.env.example` are `admin` / `changeme_grafana` — **change these before any internet-facing deployment**.

---

## Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Monorepo scaffold, health check end-to-end | ✅ Complete |
| 1 | Authentication — JWT, refresh tokens, rate-limit | ✅ Complete |
| 2 | Health metric tracking — CRUD + Chart.js dashboard | ✅ Complete |
| 3 | Document vault — MinIO upload, AES-256-GCM field encryption, presigned URLs | ✅ Complete |
| 4 | Async OCR pipeline — Kafka KRaft, Tika text extraction, health metric auto-extraction | ✅ Complete |
| 5 | API Gateway (Spring Cloud Gateway, Redis rate-limit) + Audit Trail (immutable event log, self-service view) | ✅ Complete |
| **7 (current)** | Observability — Micrometer, Prometheus, Grafana, structured JSON logging, correlation IDs, Zipkin tracing | 🔄 In progress |
| 8 | Containerisation, Kubernetes manifests, production hardening |
