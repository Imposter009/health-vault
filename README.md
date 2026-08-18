# Health Vault

Health Vault is a personal health and medical record vault — a secure, self-hosted platform that lets individuals store, manage, and share their health records (lab results, prescriptions, imaging, immunisations, etc.) with full audit trails and end-to-end encryption. The backend is a Spring Boot 3.x REST API backed by PostgreSQL, and the frontend is an Angular 16 PWA.

> **Current phase: Phase 4 (Async OCR pipeline).** Phases 0–4 complete. See [PROGRESS.md](PROGRESS.md) for full detail.

---

## Repository Structure

```
health-vault/
├── backend/                  Spring Boot 3.3.5 (Java 17, Maven, PostgreSQL 15.4)
│   ├── src/main/java/com/healthvault/
│   │   ├── HealthVaultApplication.java
│   │   ├── common/
│   │   │   └── EncryptionService.java        ← AES-256-GCM field-level encryption
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
│   │       └── V5__document_extractions.sql  ← processed_at, document_extractions table
│   └── pom.xml
├── frontend/                 Angular 16.2.15 PWA (standalone components)
│   └── src/app/
│       ├── auth/             ← login, register, interceptor, guard
│       ├── metrics/          ← metric entry form, list, dashboard (Chart.js)
│       └── documents/        ← upload, list, viewer (PDF iframe + image zoom)
├── infra/
│   └── docker/
│       └── docker-compose.yml   ← Postgres 15.4 + Redis 7 + MinIO
├── .github/
│   └── workflows/ci.yml         ← backend-build + frontend-build jobs
├── .env.example                 ← all environment variables (copy → .env)
├── PROGRESS.md                  ← phase-by-phase dev log and AC verification
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

### 1. Copy and edit the environment file

```bash
cp .env.example .env
# Open .env — set JWT_SECRET (min 32 chars), DOCUMENT_ENCRYPTION_KEY (base64 of 32 bytes)
# The defaults in .env.example are safe for local dev only — never use in production
```

### 2. Start infrastructure services

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Wait for all three containers to report healthy:

```bash
docker compose -f infra/docker/docker-compose.yml ps
```

| Service  | Port | Purpose |
|----------|------|---------|
| postgres | 5432 | Primary database (PostgreSQL 15.4) |
| redis    | 6379 | JWT blacklist + rate-limit window |
| minio    | 9000 / 9001 | Document object storage — API / console |
| kafka    | 9092 | Async OCR event bus (KRaft, no Zookeeper) |

### 3. Start the backend

```bash
cd backend
mvn package -DskipTests
java -jar target/healthvault-backend-0.0.1-SNAPSHOT.jar --server.port=8098
# Or: ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Flyway applies all migrations (V1–V5) automatically on startup.

Verify:

```bash
curl http://localhost:8098/api/health
# → {"status":"UP","service":"health-vault-backend"}

curl http://localhost:8098/actuator/health
# → {"status":"UP"} (or degraded without Redis — app still functions)
```

### 4. Start the frontend

```bash
cd frontend
npm install --legacy-peer-deps
ng serve --port 4299
```

Open [http://localhost:4299](http://localhost:4299) — register, log in, and access Metrics, Dashboard, or Documents from the profile page.

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

---

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs two jobs on every push and PR:
- **backend-build** — `mvn -B verify -DskipTests` on JDK 21
- **frontend-build** — `npm ci && npm run build` on Node LTS

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

## Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Monorepo scaffold, health check end-to-end | ✅ Complete |
| 1 | Authentication — JWT, refresh tokens, rate-limit | ✅ Complete |
| 2 | Health metric tracking — CRUD + Chart.js dashboard | ✅ Complete |
| 3 | Document vault — MinIO upload, AES-256-GCM field encryption, presigned URLs | ✅ Complete |
| **4 (current)** | Async OCR pipeline — Kafka KRaft, Tika text extraction, health metric auto-extraction | ✅ Complete |
| 5 | Audit trail — immutable event log |
| 6 | Sharing & permissions — time-limited access grants |
| 7 | PWA offline, push notifications |
| 8 | Containerisation, Kubernetes manifests, production hardening |
