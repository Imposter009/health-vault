# Health Vault — Setup Guide

Complete setup instructions for local development and higher environments (staging / production).

---

## Table of Contents

1. [Local Development](#local-development)
   - [Prerequisites](#1-prerequisites) — Java, Docker Desktop, Node.js, Angular CLI, IntelliJ, Maven, pgAdmin
   - [Environment File](#2-environment-file)
   - [Start Infrastructure](#3-start-infrastructure-docker)
   - [Start Backend](#4-start-the-backend)
   - [Start Gateway](#5-start-the-gateway)
   - [Start Frontend](#6-start-the-frontend)
   - [Optional — Tesseract](#7-optional--tesseract-for-image-ocr)
   - [Verify Everything Is Running](#8-verify-everything-is-running)
2. [Higher Environments (Staging / Production)](#higher-environments-staging--production)
   - [PostgreSQL](#postgresql)
   - [Redis](#redis)
   - [MinIO or S3](#minio--s3)
   - [Kafka](#kafka)
   - [Secrets](#secrets)
   - [Tesseract](#tesseract)
   - [Spring Profile](#spring-profile)
   - [SASL Config for Managed Kafka](#sasl-config-for-managed-kafka)
3. [What Is Automatic](#what-is-automatic-no-manual-action-needed)
4. [Environment Variable Reference](#environment-variable-reference)
5. [Port Reference](#port-reference)

---

## Local Development

### 1. Prerequisites

Install everything below before starting. **PostgreSQL, Redis, MinIO, and Kafka do NOT need to be installed separately — Docker runs all of them.**

---

#### Java 17 (required — backend runtime)

Download: https://adoptium.net → choose **Temurin 17 (LTS)** → Windows x64 Installer

Run the installer. On the "Custom Setup" screen, enable **"Set JAVA_HOME variable"**.

Verify:
```bash
java -version
# java version "17.x.x"
```

---

#### Docker Desktop (required — runs Postgres, Redis, MinIO, Kafka)

Download: https://www.docker.com/products/docker-desktop

Run the installer, restart when prompted. Make sure Docker Desktop is **running in the system tray** before you do anything else — the whale icon must be visible and steady (not animating).

Verify:
```bash
docker --version
docker compose version
```

> You do **not** need to install PostgreSQL, pgAdmin, Redis, or any other database/broker separately. Docker Compose starts all four infrastructure services with a single command. If you want a visual database browser, pgAdmin 4 is available below (optional).

---

#### Node.js 20 LTS (required — Angular frontend)

Download: https://nodejs.org → choose **20.x LTS** → Windows Installer

npm (the package manager) is bundled with Node — no separate install.

Verify:
```bash
node --version
# v20.x.x
npm --version
# 10.x.x
```

---

#### Angular CLI (required — to run `ng serve`)

After Node.js is installed, run once in any terminal:

```bash
npm install -g @angular/cli@16
```

Verify:
```bash
ng version
# Angular CLI: 16.x.x
```

---

#### IntelliJ IDEA (recommended — backend IDE)

Download: https://www.jetbrains.com/idea/download → **Community Edition** is free and sufficient.

After installing, open the `backend/` folder as a project. IntelliJ auto-detects Maven and imports dependencies. To run the backend from IntelliJ:

1. Open `HealthVaultApplication.java`
2. Click the green ▶ button next to the `main` method
3. In the run configuration, add VM option: `-Dspring-boot.run.profiles=local`

Alternatively, use the terminal commands in step 4 below — IntelliJ is optional.

---

#### Maven (optional — only if not using IntelliJ or the bundled wrapper)

The repo includes a Maven wrapper (`mvnw` / `mvnw.cmd`) — **you can run `./mvnw` instead of `mvn` everywhere in this guide** without installing Maven globally.

If you prefer a global install: https://maven.apache.org/download.cgi → Binary zip → extract → add `bin/` to PATH.

Verify:
```bash
mvn -version
# Apache Maven 3.9.x
```

---

#### pgAdmin 4 (optional — visual database browser)

Only needed if you want to browse or query the PostgreSQL database through a GUI.

Download: https://www.pgadmin.org/download/pgadmin-4-windows

After Docker is running, connect pgAdmin to:

| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `healthvault` |
| Username | `healthvault` |
| Password | `changeme_local_dev` |

---

#### Quick verify — all tools at once

```bash
java -version && docker --version && docker compose version && node --version && ng version --skip-confirmation
```

All five should print version numbers without errors before you continue.

---

### 2. Environment File

Copy the example file and edit as needed:

```bash
cp .env.example .env
```

For **local development the defaults work as-is** — no changes are required. The table below explains what each value does so you can adjust if needed:

| Variable | Local Default | Notes |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `local` | Do not change for local dev |
| `POSTGRES_DB` | `healthvault` | Database name |
| `POSTGRES_USER` | `healthvault` | Database user |
| `POSTGRES_PASSWORD` | `changeme_local_dev` | Fine for local only |
| `DB_URL` | `jdbc:postgresql://localhost:5432/healthvault` | Backend datasource URL |
| `DB_USERNAME` | `healthvault` | Backend DB user |
| `DB_PASSWORD` | `changeme_local_dev` | Backend DB password |
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `MINIO_ENDPOINT` | `http://localhost:9000` | MinIO S3 API |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO username |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO password |
| `MINIO_BUCKET_NAME` | `health-vault-documents` | Auto-created on backend startup |
| `MINIO_PRESIGNED_URL_EXPIRY_MINUTES` | `5` | Download link lifetime |
| `DOCUMENT_MAX_SIZE_BYTES` | `26214400` | 25 MB max upload |
| `DOCUMENT_ENCRYPTION_KEY` | _(local dev placeholder)_ | AES-256-GCM key — **replace in any real env** |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka broker address |
| `JWT_SECRET` | `changeme-replace...` | HS256 signing key — **replace in any real env** |
| `JWT_ACCESS_TOKEN_TTL_MINUTES` | `15` | Access token lifetime |
| `JWT_REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh token lifetime |
| `RATE_LIMIT_AUTH_MAX_REQUESTS` | `5` | Max login attempts per window |
| `RATE_LIMIT_AUTH_WINDOW_SECONDS` | `60` | Rate-limit window |
| `GATEWAY_PORT` | `8081` | Port the gateway listens on |
| `CORE_API_URL` | `http://localhost:8080` | URL the gateway forwards /api/** to |
| `GATEWAY_RATE_LOGIN_REPLENISH` | `1` | Login rate-limit: tokens added per second |
| `GATEWAY_RATE_LOGIN_BURST` | `5` | Login rate-limit: max burst |
| `GATEWAY_RATE_REGISTER_REPLENISH` | `2` | Register rate-limit: tokens/sec |
| `GATEWAY_RATE_REGISTER_BURST` | `5` | Register rate-limit: max burst |
| `GATEWAY_RATE_UPLOAD_REPLENISH` | `5` | Document upload rate-limit: tokens/sec |
| `GATEWAY_RATE_UPLOAD_BURST` | `10` | Document upload rate-limit: max burst |

> **Never commit `.env`** — it is listed in `.gitignore`. Only `.env.example` (with safe placeholders) is committed.

---

### 3. Start Infrastructure (Docker)

Health Vault depends on four external services — PostgreSQL, Redis, MinIO, and Kafka. Rather than installing these directly on your machine, they run as isolated Docker containers defined in `infra/docker/docker-compose.yml`. Docker Desktop manages their lifecycle; you get a clean, reproducible environment in one command.

**Why each service is needed:**

| Service | What it is | What Health Vault uses it for |
|---|---|---|
| **PostgreSQL** | Relational database | Stores users, health metrics, document metadata, audit logs, and refresh tokens. All tables are created automatically by Flyway on first backend startup. |
| **Redis** | In-memory key-value store | Two jobs: (1) JWT blacklist — when you log out, your access token is added here so it can't be reused before it expires; (2) rate-limit counters — the gateway uses Redis token buckets to enforce per-IP/per-user request limits. |
| **MinIO** | S3-compatible object storage | Stores the actual document files (PDFs, images) uploaded by users. The database only holds encrypted metadata; the raw bytes live in MinIO. Download links are presigned MinIO URLs that expire in 5 minutes. |
| **Kafka** | Event streaming / message bus | Decouples document upload from OCR processing. When you upload a file, the backend immediately returns a 201 and publishes a `document.uploaded` event to Kafka. A separate consumer picks it up, runs OCR via Apache Tika, and publishes a `document.processed` event. This keeps uploads fast regardless of how long OCR takes. |

Start all four services:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

The `-d` flag runs containers in the background (detached). Wait for all containers to report healthy:

```bash
docker compose -f infra/docker/docker-compose.yml ps
```

Expected output — all four should show `healthy`:

```
NAME                    STATUS
healthvault-postgres    Up (healthy)
healthvault-redis       Up (healthy)
healthvault-minio       Up (healthy)
healthvault-kafka       Up (healthy)
```

> Kafka takes the longest (~30 seconds) because it initialises its KRaft metadata log on first start. If it shows `starting`, wait 10 seconds and re-run `ps`.

**MinIO web console:** open `http://localhost:9001` in your browser and log in with `minioadmin` / `minioadmin`. You can browse uploaded documents here, though it is not required for normal use.

**Useful Docker commands:**

```bash
# Stream logs from a specific service (useful for debugging)
docker logs healthvault-kafka -f
docker logs healthvault-postgres -f

# Stop all services (data volumes are kept — safe for day-to-day use)
docker compose -f infra/docker/docker-compose.yml stop

# Restart after stopping
docker compose -f infra/docker/docker-compose.yml start

# Full reset — stops containers AND deletes all data volumes (clean slate)
# Use this if you want to start fresh or if Flyway migrations are in a bad state
docker compose -f infra/docker/docker-compose.yml down -v
```

> After `down -v` (data wipe), Flyway will re-run all migrations (V1–V7) and re-seed the demo users on next backend startup. Nothing needs to be done manually.

---

### 4. Start the Backend

```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Or if you have Maven installed globally:

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

**On first startup, the following happen automatically — no manual action needed:**

| What | How |
|---|---|
| DB schema + all tables | Flyway runs migrations V1 → V7 automatically |
| Demo users seeded | V7 migration inserts three pre-built accounts (see [Demo Credentials](#demo-credentials) below) |
| MinIO bucket `health-vault-documents` | `MinioConfig` creates it on `ApplicationReadyEvent` if missing |
| Kafka topics `document.uploaded` + `document.processed` | Spring `NewTopic` beans in `KafkaConfig` create them on startup |

Verify the backend is up:

```bash
curl http://localhost:8080/api/health
# Expected: {"status":"UP","service":"health-vault-backend"}
```

The backend runs on port **8080** by default. To use a different port:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=local -Dspring-boot.run.arguments=--server.port=8098
```

---

### 5. Start the Gateway

The gateway (Spring Cloud Gateway) sits in front of the Core API. The Angular frontend sends all `/api/**` requests to the gateway on port **8081**, which rate-limits and proxies them to the Core API on 8080.

```bash
cd gateway
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

Or with the Maven wrapper from the backend (if you haven't installed Maven globally):

```bash
cd gateway
../backend/mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Verify the gateway is up:

```bash
curl http://localhost:8081/actuator/health
# Expected: {"status":"UP"}
```

> **Redis must be running** before starting the gateway — it uses Redis for rate-limit token buckets. If Redis is down, the gateway starts but rate limiting will fail open (requests are allowed through with a warning log).

> **Starting order:** Postgres → Redis → MinIO → Kafka → Core API → Gateway → Frontend.

---

### 6. Start the Frontend

```bash
cd frontend
npm install --legacy-peer-deps
ng serve --port 4299
```

Open [http://localhost:4299](http://localhost:4299) in your browser. All API calls go to the gateway on `http://localhost:8081`.

> `--legacy-peer-deps` is required because some Angular 16 peer dependencies have not formally declared compatibility with each other.

---

### 7. Optional — Tesseract (for image OCR)

Tesseract enables OCR on scanned images and image-only PDFs. **Without it, embedded-text PDFs still work fine** — Tika uses PDFBox for those. Only install Tesseract if you need scanned-image extraction.

**Windows:**

1. Download installer from [UB-Mannheim Tesseract](https://github.com/UB-Mannheim/tesseract/wiki)
2. Run the installer — select "English" language pack (minimum)
3. Add the install directory (e.g. `C:\Program Files\Tesseract-OCR`) to your `PATH`
4. Verify: `tesseract --version`

**Linux / WSL:**

```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-eng
tesseract --version
```

**macOS:**

```bash
brew install tesseract
```

> Without Tesseract, scanned documents will still be marked `PROCESSED` with 0 metrics extracted — the pipeline degrades gracefully, it does not crash.

---

### Demo Credentials

Three users are pre-seeded by migration V7 and are ready to use the moment the backend starts. No registration step needed.

| Name | Email | Password | Notes |
|---|---|---|---|
| Admin User | `admin@healthvault.local` | `Admin@1234` | Full access — good for exploring all features |
| Demo User | `demo@healthvault.local` | `Demo@1234` | General-purpose demo account |
| Patient User | `patient@healthvault.local` | `Patient@1234` | Simulates a typical end user |

> These accounts exist for local development and demos only. **Remove or disable them before any production deployment.**

---

### 8. Verify Everything Is Running

Run through this checklist after first-time setup:

```bash
# 1. Core API health check
curl http://localhost:8080/api/health
# Expected: {"status":"UP","service":"health-vault-backend"}

# 2. Gateway health check
curl http://localhost:8081/actuator/health
# Expected: {"status":"UP"}

# 3. Login with a pre-seeded demo user (through gateway)
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@healthvault.local","password":"Demo@1234"}'
# Copy the accessToken from the response

# 4. View the audit log (replace <token> with the token from step 3)
curl http://localhost:8081/api/audit-log/me \
  -H "Authorization: Bearer <token>"
# Expected: {"content":[{"action":"LOGIN_SUCCESS",...}],"totalElements":1,...}

# 5. Open the Angular UI at http://localhost:4299
#    Log in with demo@healthvault.local / Demo@1234
#    Try uploading a PDF, then visit "Activity & Access Log" from the profile page
```

---

## Higher Environments (Staging / Production)

Set `SPRING_PROFILES_ACTIVE=prod`. The `prod` profile has **no hardcoded defaults** — startup fails immediately if any required environment variable is missing.

All infrastructure below must be provisioned and env vars set **before** starting the backend.

---

### PostgreSQL

**Recommended:** AWS RDS PostgreSQL 15+, Azure Database for PostgreSQL, or Google Cloud SQL.

**Steps:**

1. Provision a PostgreSQL 15+ instance
2. Run the following once against the new instance:

```sql
CREATE DATABASE healthvault;
\c healthvault

CREATE SCHEMA IF NOT EXISTS healthvault;

CREATE USER healthvault_app WITH PASSWORD 'use-a-strong-password-here';
GRANT CONNECT ON DATABASE healthvault TO healthvault_app;
GRANT ALL PRIVILEGES ON SCHEMA healthvault TO healthvault_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA healthvault TO healthvault_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA healthvault TO healthvault_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA healthvault
    GRANT ALL ON TABLES TO healthvault_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA healthvault
    GRANT ALL ON SEQUENCES TO healthvault_app;
```

3. Set environment variables:

```env
DB_URL=jdbc:postgresql://<host>:5432/healthvault
DB_USERNAME=healthvault_app
DB_PASSWORD=<strong-password>
```

> **Tables are created automatically** by Flyway (migrations V1–V7) on backend startup. Do not create tables manually.

**Connection pool (prod profile defaults):**

| Setting | Value |
|---|---|
| `maximum-pool-size` | 20 |
| `minimum-idle` | 5 |
| `connection-timeout` | 30 s |
| `max-lifetime` | 30 min |

Adjust in `application-prod.yml` if needed.

---

### Redis

**Recommended:** AWS ElastiCache (Redis 7), Azure Cache for Redis, or self-hosted Redis 7+.

**Steps:**

1. Provision a Redis 7+ instance with password authentication enabled
2. Set environment variables:

```env
REDIS_HOST=<your-redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>
```

> Redis is used for JWT blacklisting (logout) and rate-limit counters. The app degrades gracefully if Redis is temporarily unavailable — logout may not immediately invalidate tokens, and rate limiting may be bypassed. For production, ensure Redis is highly available.

---

### MinIO / S3

Choose one option:

#### Option A — MinIO (self-hosted)

1. Deploy MinIO (single-node or distributed cluster)
2. Create a service account with read/write access
3. Set environment variables:

```env
MINIO_ENDPOINT=http://<minio-host>:9000
MINIO_ACCESS_KEY=<service-account-key>
MINIO_SECRET_KEY=<service-account-secret>
MINIO_BUCKET_NAME=health-vault-documents
MINIO_PRESIGNED_URL_EXPIRY_MINUTES=5
```

> **Bucket is auto-created** by the backend on first startup. No manual bucket creation needed.

#### Option B — AWS S3

1. Create an S3 bucket (e.g. `health-vault-documents-prod`)
2. Create an IAM user or role with the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:GetBucketLocation",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::health-vault-documents-prod",
        "arn:aws:s3:::health-vault-documents-prod/*"
      ]
    }
  ]
}
```

3. Set environment variables:

```env
MINIO_ENDPOINT=https://s3.amazonaws.com
MINIO_ACCESS_KEY=<IAM-access-key-id>
MINIO_SECRET_KEY=<IAM-secret-access-key>
MINIO_BUCKET_NAME=health-vault-documents-prod
MINIO_PRESIGNED_URL_EXPIRY_MINUTES=5
```

> When using S3, create the bucket manually in the AWS Console — the SDK's `makeBucket` call is S3-compatible but the bucket must already exist in the correct region.

---

### Kafka

#### Option A — Managed Kafka (recommended for prod)

Options: Confluent Cloud, AWS MSK, Azure Event Hubs (Kafka protocol), Redpanda.

**Steps:**

1. Create a Kafka cluster (minimum 3 brokers for production)
2. Create two topics:

| Topic | Partitions | Replication Factor | Retention |
|---|---|---|---|
| `document.uploaded` | 4–8 (scale to consumer count) | 2–3 | 7 days |
| `document.processed` | 4–8 | 2–3 | 7 days |

3. Create a service account / API key with produce + consume permissions on both topics
4. Set environment variable:

```env
KAFKA_BOOTSTRAP_SERVERS=broker1:9092,broker2:9092,broker3:9092
```

5. **Add SASL/TLS config to `application-prod.yml`** (not included by default — must be added):

```yaml
spring:
  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS}
    properties:
      security.protocol: SASL_SSL
      sasl.mechanism: SCRAM-SHA-256
      sasl.jaas.config: >
        org.apache.kafka.common.security.scram.ScramLoginModule required
        username="${KAFKA_USERNAME}"
        password="${KAFKA_PASSWORD}";
    ssl:
      trust-store-type: JKS
      # trust-store-location / password if using custom CA
```

Add `KAFKA_USERNAME` and `KAFKA_PASSWORD` to your secret manager and env vars.

> For Confluent Cloud, use `SASL_SSL` + `PLAIN` mechanism instead of `SCRAM-SHA-256`. Check your provider's docs for exact JAAS config.

#### Option B — Self-hosted Kafka (3-broker cluster)

Same as local Docker setup but with:
- 3+ brokers
- Replication factor ≥ 2
- SSL enabled
- Topics created with partition count matching consumer instances

---

### Secrets

**These must be regenerated for every real environment.** Never use the placeholders from `.env.example` outside local dev.

| Secret | How to generate | Requirement |
|---|---|---|
| `JWT_SECRET` | `openssl rand -base64 48 \| tr -d '='` | ≥ 32 characters |
| `DOCUMENT_ENCRYPTION_KEY` | `openssl rand -base64 32` | Exactly 32 bytes (base64-encoded) |
| `DB_PASSWORD` | Strong random password | No minimum — use 24+ chars |
| `MINIO_SECRET_KEY` | Strong random string | No minimum — use 24+ chars |
| `REDIS_PASSWORD` | Strong random string | No minimum — use 24+ chars |

**Store all secrets in a secret manager, not in files or env vars on disk:**
- AWS: Secrets Manager or Parameter Store
- Azure: Key Vault
- GCP: Secret Manager
- Self-hosted: HashiCorp Vault

> **Critical — `DOCUMENT_ENCRYPTION_KEY`:** This key encrypts all stored document filenames and all OCR-extracted text. If you lose it, all existing documents become permanently unreadable. Back it up securely. Key rotation is a planned future feature — there is no re-encryption utility built yet.

---

### Tesseract

Install on the server or container where the backend runs:

```bash
# Debian / Ubuntu (e.g. inside a Dockerfile)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*
```

```bash
# RHEL / Amazon Linux
yum install -y tesseract tesseract-langpack-eng
```

Without Tesseract, scanned image documents will produce 0 extracted metrics but will not fail — the pipeline marks them `PROCESSED` with `metricsExtractedCount = 0`.

---

### Gateway (Phase 5)

Deploy the gateway as a separate service. It must be able to reach the Core API URL and the Redis instance.

**Environment variables for the gateway process:**

```env
GATEWAY_PORT=8081
CORE_API_URL=http://<core-api-host>:8080
REDIS_HOST=<your-redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>

# Rate-limit tuning — adjust to match your expected traffic
GATEWAY_RATE_LOGIN_REPLENISH=1
GATEWAY_RATE_LOGIN_BURST=5
GATEWAY_RATE_REGISTER_REPLENISH=2
GATEWAY_RATE_REGISTER_BURST=5
GATEWAY_RATE_UPLOAD_REPLENISH=5
GATEWAY_RATE_UPLOAD_BURST=10
```

**CORS:** The gateway's `globalcors` config allows `http://localhost:*` for local dev. For production, update `allowedOriginPatterns` in `gateway/src/main/resources/application.yml` to match your actual frontend domain(s).

**Startup order:** Redis and Core API must be reachable before the gateway handles traffic. In Kubernetes, use readiness probes on the Core API service and Redis to gate gateway pod startup.

> The gateway and Core API share the same Redis instance — both use it, the gateway for rate limiting and the Core API for JWT blacklisting. No separate Redis instance is needed.

---

### Spring Profile

Set this in your deployment environment (container env var, ECS task definition, Kubernetes secret, etc.):

```env
SPRING_PROFILES_ACTIVE=prod
```

The `prod` profile:
- Has no hardcoded DB/Redis/Kafka defaults — fails fast on missing vars
- Exposes only `/health` and `/info` actuator endpoints
- Sets log level to `INFO` (not DEBUG)
- Enables Hikari connection pool with prod-appropriate sizing

---

## What Is Automatic (No Manual Action Needed)

In both local and production environments, the following are handled automatically by the application on startup:

| Thing | Mechanism |
|---|---|
| Database tables (V1–V7) | Flyway migrations run on every startup; safe to re-run (checksummed) |
| Demo users seeded | V7 migration inserts `admin@`, `demo@`, and `patient@healthvault.local` — runs only once |
| MinIO bucket creation | `MinioConfig.initBucket()` runs on `ApplicationReadyEvent`; creates the bucket if it does not exist |
| Kafka topic creation (`document.uploaded`, `document.processed`) | Spring `NewTopic` beans in `KafkaConfig`; Kafka Admin API creates topics on startup |
| Kafka consumer group registration | Auto-registered on first message consumed |
| `audit_logs` table | Included in V6 migration — no manual SQL needed |

---

## Environment Variable Reference

Complete list of all environment variables the application reads:

| Variable | Required | Local Default | Description |
|---|---|---|---|
| `SPRING_PROFILES_ACTIVE` | Yes | `local` | Spring profile: `local`, `docker`, or `prod` |
| `DB_URL` | Yes | `jdbc:postgresql://localhost:5432/healthvault` | JDBC connection URL |
| `DB_USERNAME` | Yes | `healthvault` | Database username |
| `DB_PASSWORD` | Yes | `changeme_local_dev` | Database password |
| `POSTGRES_DB` | Docker only | `healthvault` | Used by Docker Compose to initialise Postgres container |
| `POSTGRES_USER` | Docker only | `healthvault` | Used by Docker Compose |
| `POSTGRES_PASSWORD` | Docker only | `changeme_local_dev` | Used by Docker Compose |
| `REDIS_HOST` | Yes | `localhost` | Redis hostname |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | Prod | _(empty)_ | Redis auth password; required in prod |
| `MINIO_ENDPOINT` | Yes | `http://localhost:9000` | MinIO / S3 endpoint URL |
| `MINIO_ACCESS_KEY` | Yes | `minioadmin` | MinIO / S3 access key |
| `MINIO_SECRET_KEY` | Yes | `minioadmin` | MinIO / S3 secret key |
| `MINIO_BUCKET_NAME` | No | `health-vault-documents` | Bucket name for document storage |
| `MINIO_PRESIGNED_URL_EXPIRY_MINUTES` | No | `5` | Lifetime of document download links |
| `DOCUMENT_MAX_SIZE_BYTES` | No | `26214400` | Max upload file size (25 MB) |
| `DOCUMENT_ENCRYPTION_KEY` | Yes | _(local dev placeholder)_ | Base64-encoded 32-byte AES-256-GCM key |
| `KAFKA_BOOTSTRAP_SERVERS` | No | `localhost:9092` | Kafka broker address(es) |
| `KAFKA_USERNAME` | Prod only | — | Kafka SASL username (if using managed Kafka) |
| `KAFKA_PASSWORD` | Prod only | — | Kafka SASL password (if using managed Kafka) |
| `JWT_SECRET` | Yes | _(local dev placeholder)_ | HS256 signing key — minimum 32 characters |
| `JWT_ACCESS_TOKEN_TTL_MINUTES` | No | `15` | Access token expiry |
| `JWT_REFRESH_TOKEN_TTL_DAYS` | No | `30` | Refresh token expiry |
| `RATE_LIMIT_AUTH_MAX_REQUESTS` | No | `5` | Max auth attempts per window (Core API endpoint-level) |
| `RATE_LIMIT_AUTH_WINDOW_SECONDS` | No | `60` | Rate-limit sliding window size (Core API) |
| `GATEWAY_PORT` | No | `8081` | Gateway listen port |
| `CORE_API_URL` | No | `http://localhost:8080` | Core API URL (gateway forwards here) |
| `GATEWAY_RATE_LOGIN_REPLENISH` | No | `1` | Login: tokens added per second |
| `GATEWAY_RATE_LOGIN_BURST` | No | `5` | Login: burst capacity |
| `GATEWAY_RATE_REGISTER_REPLENISH` | No | `2` | Register: tokens per second |
| `GATEWAY_RATE_REGISTER_BURST` | No | `5` | Register: burst capacity |
| `GATEWAY_RATE_UPLOAD_REPLENISH` | No | `5` | Document upload: tokens per second |
| `GATEWAY_RATE_UPLOAD_BURST` | No | `10` | Document upload: burst capacity |

---

## Port Reference

| Service | Port | Used By |
|---|---|---|
| **Gateway** | **8081** | **Frontend Angular app (all /api/** requests)** |
| Backend API (Core) | 8080 | Gateway (proxied); also accessible directly for debugging |
| Frontend dev server | 4299 | Browser (local dev only) |
| PostgreSQL | 5432 | Backend Spring Boot |
| Redis | 6379 | Backend Spring Boot (JWT blacklist) + Gateway (rate limiting) |
| MinIO API (S3) | 9000 | Backend Spring Boot + presigned URL downloads |
| MinIO Console | 9001 | Browser (admin UI — local dev / ops only) |
| Kafka | 9092 | Backend Spring Boot producer + consumer |
| Kafka Controller | 9093 | Internal Kafka KRaft (not exposed externally) |

---

*Health Vault Setup Guide — Phases 0–5 complete*
*Last updated: August 2026*
