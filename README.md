# Health Vault

Health Vault is a personal health and medical record vault — a secure, self-hosted platform that lets individuals store, manage, and share their health records (lab results, prescriptions, imaging, immunisations, etc.) with full audit trails and end-to-end encryption. The backend is a Spring Boot 3.x REST API backed by PostgreSQL, and the frontend is an Angular 16 PWA.

> **This is Phase 0 (scaffold only).** No business logic yet. The goal of this phase is a working monorepo skeleton with a live health-check round-trip from browser to backend.

---

## Repository Structure

```
health-vault/
├── backend/                  Spring Boot 3.x (Java 21, Maven, PostgreSQL)
│   ├── src/main/java/com/healthvault/
│   │   ├── HealthVaultApplication.java
│   │   ├── controller/HealthController.java   ← GET /api/health
│   │   └── config/SecurityConfig.java
│   ├── src/main/resources/
│   │   ├── application.yml                   ← base config
│   │   ├── application-local.yml             ← localhost services
│   │   ├── application-docker.yml            ← docker-compose services
│   │   ├── application-prod.yml              ← env-var-only, no hardcoded secrets
│   │   └── db/migration/V1__init.sql         ← Flyway bootstrap
│   └── pom.xml
├── frontend/                 Angular 16 PWA (standalone, routing, SCSS)
│   └── src/app/health-check/ ← default route — live backend status display
├── infra/
│   └── docker/
│       └── docker-compose.yml   ← Postgres 16 + Redis 7 + MinIO
├── .github/
│   └── workflows/ci.yml         ← backend-build + frontend-build jobs
├── .env.example                 ← all environment variables (copy → .env)
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

## Running Locally (Phase 0)

### 1. Copy and edit the environment file

```bash
cp .env.example .env
# Open .env and set real passwords — the defaults in .env.example are placeholders only
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
| postgres | 5432 | Primary database |
| redis    | 6379 | Cache / session store (Phase 2+) |
| minio    | 9000 / 9001 | Object storage — API / console |

### 3. Start the backend

```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
# Windows: mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local
```

Flyway will automatically apply `V1__init.sql` on startup and create the `healthvault` schema.

Verify:

```bash
curl http://localhost:8080/api/health
# → {"status":"UP","service":"health-vault-backend"}

curl http://localhost:8080/actuator/health
# → {"status":"UP"}
```

### 4. Start the frontend

```bash
cd frontend
npm start
```

Open [http://localhost:4200](http://localhost:4200) — the page shows the live backend status returned from `GET /api/health`.

---

## Environment Variables

All variables are documented in [`.env.example`](.env.example). Key groups:

| Group | Variables |
|-------|-----------|
| Spring profile | `SPRING_PROFILES_ACTIVE` |
| PostgreSQL | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` |
| Redis | `REDIS_HOST`, `REDIS_PORT` |
| MinIO | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME` |
| JWT | `JWT_SECRET`, `JWT_EXPIRY_MS` |

---

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs two jobs on every push and PR:
- **backend-build** — `mvn -B verify -DskipTests` on JDK 21
- **frontend-build** — `npm ci && npm run build` on Node LTS

The workflow file is ready; activate it by adding a GitHub remote once one is configured.

---

## Roadmap

| Phase | Scope |
|-------|-------|
| **0 (current)** | Monorepo scaffold, health check end-to-end |
| 1 | User & auth domain — registration, login, JWT |
| 2 | Health record CRUD — documents, categories, search |
| 3 | Sharing & permissions — time-limited access grants |
| 4 | File storage — MinIO upload/download with encryption |
| 5 | Audit trail — immutable event log |
| 6 | PWA offline, push notifications |
| 7 | Containerisation, Kubernetes manifests, production hardening |
