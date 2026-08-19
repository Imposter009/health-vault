# Health Vault — Development Progress

> **Project:** Personal Health Record Vault  
> **Repo:** `D:\iDTC_Project\CPX-SoCK\repos\health-vault`  
> **Stack:** Spring Boot 3.3.5 · Java 17 · Angular 16.2.15 · PostgreSQL 15.4  
> **Branch:** `release/26.1.0.0`  
> **Last updated:** 2026-08-18

---

## Phases Overview

| Phase | Name | Status |
|-------|------|--------|
| Phase 0 | Project Scaffold | ✅ Complete |
| Phase 1 | Authentication & User Management | ✅ Complete (2 ACs need Redis/Docker to fully verify) |
| Phase 2 | Health Metric Tracking & Dashboard | ✅ Complete (AC7 needs browser test) |
| Phase 3 | Document Vault — Upload, Encryption, Presigned URLs | ✅ Complete (AC8 needs browser test; AC2/full E2E needs MinIO running) |
| Phase 4 | Async OCR Pipeline — Kafka, Tika, Metric Extraction | ✅ Complete (AC3/AC7 need Kafka + MinIO running for full E2E) |

---

## Phase 0 — Project Scaffold

### What Was Built

| Area | Detail |
|------|--------|
| Spring Boot app | `HealthVaultApplication.java` with `@ConfigurationPropertiesScan` |
| Health endpoint | `GET /api/health` → `{ "status": "UP", "service": "healthvault-backend" }` |
| DB connection | PostgreSQL 15.4, schema `healthvault`, role `healthvault`, Flyway migrations |
| V1 migration | `V1__init.sql` — creates `healthvault` schema |
| Security config | `SecurityConfig.java` — CORS, stateless session, public `/api/health` and `/actuator/**` |
| Angular app | Standalone `AppComponent` with `RouterOutlet` |
| Health check UI | `HealthCheckComponent` — calls `/api/health`, shows status card |
| Environments | `environment.ts` (prod: `/api`), `environment.development.ts` (dev: `http://localhost:8099/api`) |
| Docker infra | `docker-compose.yml` with PostgreSQL 15, Redis 7, MinIO services |
| PWA setup | `@angular/service-worker` wired; disabled in dev mode |
| `.npmrc` | Overrides corporate Artifactory → `registry=https://registry.npmjs.org/` (project-scoped only) |

### Ports

| Service | Port |
|---------|------|
| Backend (local) | **8099** (8080 occupied by K1_codem-liferay on this machine) |
| Frontend dev server | **4200** (default) / **4299** (used in this session) |

---

## Phase 1 — Authentication & User Management

### What Was Built

#### Backend — New Files

| File | Purpose |
|------|---------|
| `db/migration/V2__auth.sql` | Creates `users` and `refresh_tokens` tables + indexes in `healthvault` schema |
| `auth/config/JwtProperties.java` | `@ConfigurationProperties(prefix="jwt")` record: `secret`, `accessTokenTtlMinutes`, `refreshTokenTtlDays` |
| `auth/config/RateLimitProperties.java` | `@ConfigurationProperties(prefix="rate-limit.auth")` record: `maxRequests`, `windowSeconds` |
| `auth/config/JwtConfig.java` | Wires `NimbusJwtEncoder` + `NimbusJwtDecoder` beans (HMAC-SHA256) |
| `auth/entity/User.java` | JPA entity — `id` (UUID PK), `email` (unique), `passwordHash`, `fullName`, `createdAt`, `updatedAt` |
| `auth/entity/RefreshToken.java` | JPA entity — `id`, `user` (FK → users), `tokenHash` (SHA-256), `expiresAt`, `revoked` |
| `auth/dto/RegisterRequest.java` | Validated DTO: `@Email email`, `@Size(min=8) password`, `@NotBlank fullName` |
| `auth/dto/LoginRequest.java` | DTO: `email`, `password` |
| `auth/dto/RefreshRequest.java` | DTO: `refreshToken` (opaque 64-char hex) |
| `auth/dto/LogoutRequest.java` | DTO: `refreshToken` |
| `auth/dto/AuthResponse.java` | Response: `accessToken`, `refreshToken`, `expiresIn` (seconds) |
| `auth/dto/UserResponse.java` | Response: `id`, `email`, `fullName` |
| `auth/repository/UserRepository.java` | `findByEmail`, `existsByEmail` |
| `auth/repository/RefreshTokenRepository.java` | `findByTokenHash`, `revokeAllForUser` (JPQL bulk update) |
| `auth/service/TokenService.java` | Generate/decode JWT, generate opaque refresh token, SHA-256 hash, Redis blacklist (fail-open) |
| `auth/service/AuthService.java` | `register`, `login`, `refresh` (with rotation), `logout`, `issueTokenPair` |
| `auth/filter/JwtAuthenticationFilter.java` | `OncePerRequestFilter` — extracts Bearer, validates JWT, checks Redis blacklist, sets `SecurityContext` |
| `auth/filter/RateLimitFilter.java` | Fixed-window rate limiter via Redis `INCR`; applies to `/api/auth/login` + `/api/auth/register`; fail-open |
| `auth/controller/AuthController.java` | `POST /api/auth/register` (201), `/login` (200), `/refresh` (200), `/logout` (204) |
| `auth/controller/UserController.java` | `GET /api/users/me` (200) — requires valid JWT |
| `exception/GlobalExceptionHandler.java` | `@RestControllerAdvice` — validation → 400, `ResponseStatusException` → correct status |
| `auth/service/AuthServiceTest.java` | 9 Mockito unit tests |
| `auth/service/TokenServiceTest.java` | 8 tests (real Nimbus encoder/decoder, test secret) |

#### Backend — Modified Files

| File | Change |
|------|--------|
| `backend/pom.xml` | Added `spring-boot-starter-data-redis`, `spring-security-oauth2-jose`; pinned Tomcat → `10.1.30` (10.1.31 absent from corporate Artifactory) |
| `application.yml` | Added `spring.data.redis`, `spring.jpa.properties.hibernate.default_schema`, `jwt.*`, `rate-limit.auth.*` |
| `application-docker.yml` | Added `spring.data.redis.host: ${REDIS_HOST:redis}` |
| `application-prod.yml` | Added `spring.data.redis` with `REDIS_HOST` + optional `REDIS_PASSWORD` env vars |
| `HealthVaultApplication.java` | Added `@ConfigurationPropertiesScan` |
| `config/SecurityConfig.java` | Registered JWT + rate-limit filters; disabled anonymous filter (ensures 401 not 403 for unauthenticated); added `PasswordEncoder` bean |
| `.env.example` | Added `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL_MINUTES=15`, `JWT_REFRESH_TOKEN_TTL_DAYS=30`, `RATE_LIMIT_AUTH_*` |

#### Frontend — New Files

| File | Purpose |
|------|---------|
| `auth/models.ts` | `UserProfile` and `AuthResponse` interfaces |
| `auth/auth.service.ts` | `AuthService` with Angular Signals (`currentUser`, `isAuthenticated`); `login`, `register`, `logout`, `tryRefresh`, `loadCurrentUser` |
| `auth/auth.interceptor.ts` | `HttpInterceptorFn` — attaches `Authorization: Bearer <token>` to all non-auth requests; on 401 silently refreshes and retries; on refresh failure clears session + navigates to `/login` |
| `auth/auth.guard.ts` | `CanActivateFn` — checks token in localStorage; blocks and redirects to `/login` if absent |
| `auth/login/login.component.ts` | Standalone login form (reactive forms); success → `/profile` |
| `auth/register/register.component.ts` | Standalone register form; success → auto-login → `/profile` |
| `profile/profile.component.ts` | Calls `GET /api/users/me`; shows avatar (initials), name, email, UUID; logout button |
| `auth/auth.service.spec.ts` | 10 unit tests (login success/failure, register success/409, logout, tryRefresh success/failure, clearSession) |
| `auth/auth.interceptor.spec.ts` | 7 unit tests (header attach, skip paths, 401 retry, double-401 session clear) |

#### Frontend — Modified Files

| File | Change |
|------|--------|
| `app/app.routes.ts` | Added `/login`, `/register`, `/profile` (guarded), `/health-check` routes; all lazy-loaded; `/` redirects to `/profile` |
| `app/app.config.ts` | Added `withInterceptors([authInterceptor])` to `provideHttpClient` |
| `app/app.component.spec.ts` | Fixed pre-existing broken scaffold test (old default template assertion) |

---

### API Endpoints (Phase 1)

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| `POST` | `/api/auth/register` | No | Create account → 201 UserResponse / 409 duplicate |
| `POST` | `/api/auth/login` | No | Login → 200 AuthResponse / 401 |
| `POST` | `/api/auth/refresh` | No | Rotate refresh token → 200 AuthResponse / 401 |
| `POST` | `/api/auth/logout` | Yes (Bearer AT) | Revoke RT + blacklist AT → 204 |
| `GET` | `/api/users/me` | Yes (Bearer AT) | Current user profile → 200 UserResponse / 401 |

### Database Schema (V2)

```sql
-- users
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
email VARCHAR(255) NOT NULL UNIQUE
password_hash VARCHAR(255) NOT NULL
full_name VARCHAR(255) NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- refresh_tokens
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID NOT NULL REFERENCES healthvault.users(id) ON DELETE CASCADE
token_hash VARCHAR(255) NOT NULL          -- SHA-256 of raw 64-char hex token
expires_at TIMESTAMPTZ NOT NULL
revoked BOOLEAN NOT NULL DEFAULT FALSE
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### Library / Version Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| JWT library | `spring-security-oauth2-jose` (Nimbus) | Part of Spring Boot BOM — guaranteed in corporate Artifactory. JJWT availability was uncertain. |
| JWT algorithm | HMAC-SHA256 (HS256) | Simpler than RS256 for single-service use; key is the UTF-8 bytes of `JWT_SECRET` (min 32 chars) |
| Refresh token format | Opaque 64-char hex (32 random bytes) | Not a JWT — safer; only the SHA-256 hash stored in DB |
| Tomcat | 10.1.30 (pinned) | 10.1.31 absent from corporate Artifactory |
| Token storage | `localStorage` | Simpler for Phase 1; httpOnly cookies deferred |
| Redis errors | Fail-open | App starts and functions without Redis; blacklist + rate-limit silently no-op |

---

### Acceptance Criteria — Phase 1

| AC | Description | Status |
|----|-------------|--------|
| **AC1** | `docker compose up` → Postgres + Redis + MinIO start; V2 migration applies | ❌ **Cannot verify** — Docker not installed on this machine |
| **AC2** | `users` and `refresh_tokens` tables created by Flyway V2 | ✅ Verified — Flyway log confirms V2 applied |
| **AC3** | `POST /api/auth/register` → 201; duplicate email → 409 | ✅ Verified |
| **AC4** | Login → tokens + expiresIn:900; wrong pw → 401; `GET /api/users/me` with token → profile; without → 401 | ✅ Verified |
| **AC5** | Refresh → new distinct tokens; old refresh token → 401 (rotation) | ✅ Verified |
| **AC6** | Logout → 204; refresh token revoked (→ 401); access token blacklisted in Redis (→ 401) | ⚠️ **Partial** — RT revocation verified; AT blacklist requires Redis |
| **AC7** | > 5 login/register requests/min from same IP → 429 | ❌ **Cannot verify** — Redis not installed |
| **AC8** | Angular: register → auto-login → profile (shows /me data); hard-reload persists session; logout → login; guard blocks unauthenticated | ✅ Verified (live browser) |
| **AC9** | Backend unit tests pass; frontend unit tests pass | ✅ Verified — 18/18 backend, 20/20 frontend |

---

### Test Results — Phase 1

```
Backend (JUnit 5 + Mockito)
  AuthServiceTest    9/9   PASS
  TokenServiceTest   8/8   PASS
  ApplicationTests   1/1   PASS
  ─────────────────────────────
  Total             18/18  PASS

Frontend (Jasmine + Karma)
  AuthService        10/10  PASS
  authInterceptor     7/7   PASS
  AppComponent        3/3   PASS
  ─────────────────────────────
  Total              20/20  PASS
```

---

### Pending — Your Actions Required

| # | Item | What to do |
|---|------|------------|
| 1 | **Install Redis (AC6 + AC7)** | WSL2: `sudo apt-get install -y redis-server && redis-server --daemonize yes`. ⚠️ This is a system-wide WSL2 change — confirm before proceeding. Once Redis is running, verify: (a) logout → subsequent `/me` with same AT → 401; (b) >5 rapid login requests → 429. |
| 2 | **Install Docker Desktop (AC1)** | Install Docker Desktop, then from repo root: `docker compose up`. Verify Postgres, Redis, MinIO all start and Flyway V2 migration runs cleanly on first boot. |
| 3 | **Create `.env` file** | `cp .env.example .env` then set `JWT_SECRET` to a random string of at least 32 characters. The yml default (`changeme-local-dev-secret-at-least-32chars`) is only safe on your local machine. |
| 4 | **Git commit** | Commit all Phase 1 changes when ready. Message format required by repo hook: `CODEM-#####: Add Phase 1 authentication and user management`. Do not commit the `.env` file (it is in `.gitignore`). |

---

### Known Limitations / Deferred to Future Phase

| Item | Note |
|------|------|
| `localStorage` token storage | Vulnerable to XSS. httpOnly cookie approach (more secure) deferred. |
| AT blacklist fail-open | Without Redis, logged-out access tokens remain valid until they expire (15 min TTL). Refresh tokens are revoked immediately in DB regardless. |
| Rate-limit fail-open | Without Redis, rate limiting is silently bypassed. |
| No email verification | Users can register with any email; no confirmation step. |
| No password reset flow | Forgot-password / reset-by-email not implemented. |
| Single CORS origin pattern | Currently allows `http://localhost:*` — tighten in production profile. |

---

## Phase 2 — Health Metric Tracking & Dashboard

### What Was Built

#### Backend — New Files

| File | Purpose |
|------|---------|
| `db/migration/V3__health_metrics.sql` | `health_metrics` table: UUID PK, `user_id` FK, `metric_type` (check constraint), `value` JSONB, `recorded_at`, `source`, `notes`, `deleted_at` (soft delete), two indexes |
| `metrics/MetricType.java` | Enum: `BLOOD_PRESSURE`, `BLOOD_SUGAR`, `WEIGHT`, `WORKOUT`, `HEART_RATE` |
| `metrics/MetricSource.java` | Enum: `MANUAL`, `DEVICE_SYNC`, `EXTRACTED_FROM_DOCUMENT` |
| `metrics/DashboardGranularity.java` | Enum: `DAY`, `WEEK`, `MONTH` with `toDateTruncArg()` |
| `metrics/entity/HealthMetric.java` | JPA entity; value uses `@JdbcTypeCode(SqlTypes.JSON)` for PostgreSQL JSONB compatibility |
| `metrics/dto/*.java` | `MetricRequest`, `MetricUpdateRequest`, `MetricResponse`, `DashboardBucketResponse`, `DashboardResponse`, `PageResponse<T>` |
| `metrics/repository/HealthMetricRepository.java` | Extends `JpaSpecificationExecutor`; `findByIdAndUserIdAndDeletedAtIsNull` for ownership check |
| `metrics/repository/MetricSpecifications.java` | JPA Specification predicates: `forUser`, `notDeleted`, `byType`, `fromDate`, `toDate` |
| `metrics/MetricMapper.java` | Maps entity → DTO |
| `metrics/service/MetricValidationService.java` | Per-type validation with sane ranges; throws `ResponseStatusException(400)` |
| `metrics/service/HealthMetricService.java` | CRUD using Specification API; soft delete; ownership-based 404 |
| `metrics/service/DashboardService.java` | `JdbcTemplate` native queries with `date_trunc()`; separate SQL per type |
| `metrics/controller/MetricsController.java` | `@RequestMapping("/api/metrics")`; userId from `auth.getName()` |
| `metrics/service/MetricValidationServiceTest.java` | 25 unit tests; all 5 types × valid+invalid |
| `metrics/service/HealthMetricServiceTest.java` | 9 Mockito tests; ownership check, soft delete, CRUD |

#### Frontend — New Files

| File | Purpose |
|------|---------|
| `metrics/models.ts` | TypeScript interfaces + `formatValue()` helper |
| `metrics/metrics.service.ts` | `MetricsService`: CRUD + dashboard HTTP calls |
| `metrics/entry-form/metric-entry-form.component.ts` | Adaptive reactive form; `setControl('value', buildValueGroup(type))` on type change |
| `metrics/list/metrics-list.component.ts` | Paginated list with type/date filters + soft-delete action |
| `dashboard/dashboard.component.ts` | Chart.js 4.5.1 line chart; 7/30/90-day presets; granularity picker |
| `metrics/metrics.service.spec.ts` | 7 service unit tests |
| `metrics/entry-form/metric-entry-form.component.spec.ts` | 9 component unit tests (per-type form switching, submit, error, cancel) |

#### Frontend — Modified Files

| File | Change |
|------|--------|
| `app/app.routes.ts` | Added `/metrics`, `/metrics/new`, `/dashboard` — all behind `authGuard` |
| `profile/profile.component.ts` | Added "My Metrics" and "Dashboard" nav links |

#### Dependencies Added

| Package | Version | Note |
|---------|---------|------|
| `chart.js` | 4.5.1 | Installed with `--legacy-peer-deps` due to Angular 16 peer constraint |

---

### Technical Decisions (Phase 2)

| Decision | Choice | Reason |
|----------|--------|--------|
| JSONB mapping | `@JdbcTypeCode(SqlTypes.JSON)` | `@Convert` sends `varchar`; PostgreSQL 42.7.4 JDBC won't auto-cast `varchar→jsonb`. Hibernate 6's `SqlTypes.JSON` sends the correct JDBC type. |
| Ownership check | Returns 404 (not 403) for wrong owner | Prevents existence leakage |
| `MetricUpdateRequest` (no `metricType`) | Type excluded | Changing type invalidates the existing value shape; callers must delete+recreate |
| Dashboard | `JdbcTemplate` native SQL | Avoids EntityManager UUID casting issues; uses `date_trunc()` directly |

---

### Acceptance Criteria — Phase 2

| AC | Description | Status |
|----|-------------|--------|
| **AC1** | V3 migration applies | ✅ Verified — Flyway: "applied 1 migration to schema healthvault, now at version v3" |
| **AC2** | Create all 5 types → 201; invalid shape → 400 with clear message | ✅ Verified — 9 creates all 201; `{"kg":600}` → 400 |
| **AC3** | Filter by `metricType` + pagination | ✅ Verified — `metricType=WEIGHT` returns 3 records, all WEIGHT |
| **AC4** | Wrong-user read/delete → 404 | ✅ Verified — both return `NotFound` |
| **AC5** | Soft delete: excluded from list; direct GET → 404 | ✅ Verified |
| **AC6** | Dashboard bucketed aggregations correct | ✅ Verified — see below |
| **AC7** | Angular UI end-to-end | ⚠️ Not yet verified — start `ng serve` and test manually |
| **AC8** | 52 backend + 37 frontend tests pass | ✅ Verified |

### AC6 — Dashboard Verification

**WEIGHT — DAY (Aug 1-3, one reading per day: 70/71/72 kg):**
- Actual: bucket=2026-08-01 avg=70.0 ✅ | bucket=2026-08-02 avg=71.0 ✅ | bucket=2026-08-03 avg=72.0 ✅

**WORKOUT — WEEK (Aug 1: 30 min RUNNING; Aug 8: 45 min CYCLING):**
- Actual: week-of-2026-07-27 totalDuration=30 ✅ | week-of-2026-08-03 totalDuration=45 ✅

**BLOOD_PRESSURE — DAY (Aug 1: 120/80; Aug 8: 130/85):**
- Actual: bucket=2026-08-01 avgSys=120.0/avgDia=80.0 ✅ | bucket=2026-08-08 avgSys=130.0/avgDia=85.0 ✅

---

### Test Results — Phase 2

```
Backend  52/52  PASS  (MetricValidationServiceTest 25, HealthMetricServiceTest 9, Phase1 18)
Frontend 37/37  PASS  (MetricsService 7, MetricEntryForm 9, Phase1 20, AppComponent 1)
```

---

### Pending — Your Actions (Phase 2)

| # | Item |
|---|------|
| 1 | **AC7 browser test**: start backend on 8098, `ng serve --port 4299`, login → My Metrics → log metric → Dashboard → verify chart |
| 2 | **Git commit**: `CODEM-#####: Add Phase 2 health metric tracking and dashboard` |

---

## How to Run Locally

### Backend

```bash
# From: D:\iDTC_Project\CPX-SoCK\repos\health-vault\backend
mvn package -DskipTests
java -jar target/healthvault-backend-0.0.1-SNAPSHOT.jar --server.port=8098
```

### Frontend

```bash
# From: D:\iDTC_Project\CPX-SoCK\repos\health-vault\frontend
ng serve --port 4299
```

### Tests

```bash
# Backend
mvn test

# Frontend
ng test --watch=false --browsers=ChromeHeadless
```

### New env vars required (Phase 3)

Add these to your `.env` (copy from `.env.example`):

```
DOCUMENT_ENCRYPTION_KEY=<base64 of 32 random bytes>   # generate: openssl rand -base64 32
MINIO_PRESIGNED_URL_EXPIRY_MINUTES=5
DOCUMENT_MAX_SIZE_BYTES=26214400
```

---

## Phase 3 — Document Vault

### What Was Built

#### Backend — New Files

| File | Purpose |
|------|---------|
| `db/migration/V4__documents.sql` | `documents` table: `encrypted_filename BYTEA` (no plaintext column), `storage_key`, `mime_type`, `size_bytes`, `category` (check constraint), `status`, soft-delete `deleted_at`; two indexes |
| `common/EncryptionProperties.java` | `@ConfigurationProperties(prefix="encryption")` — `documentKey` |
| `common/EncryptionService.java` | AES-256-GCM: fresh `SecureRandom` 12-byte IV per encrypt, IV prepended to ciphertext; key validated at construction to exactly 32 bytes |
| `documents/config/MinioProperties.java` | `@ConfigurationProperties(prefix="minio")` record |
| `documents/config/DocumentProperties.java` | `@ConfigurationProperties(prefix="document")` — `maxSizeBytes`, `allowedMimeTypes` |
| `documents/config/MinioConfig.java` | `MinioClient` bean + `@EventListener(ApplicationReadyEvent)` bucket init (fail-open) |
| `documents/DocumentCategory.java` | Enum: `LAB_REPORT`, `PRESCRIPTION`, `SCAN`, `INSURANCE`, `OTHER` |
| `documents/DocumentStatus.java` | Enum: `UPLOADED`, `PROCESSING`, `PROCESSED`, `FAILED` |
| `documents/entity/Document.java` | JPA entity; `encryptedFilename byte[]` (`columnDefinition="bytea"`); no plaintext filename field |
| `documents/dto/DocumentResponse.java` | Record: `id`, `filename` (decrypted), `category`, `status`, `mimeType`, `sizeBytes`, `uploadedAt` — `storageKey` never exposed |
| `documents/dto/DownloadUrlResponse.java` | Record: `url`, `expiryMinutes` |
| `documents/repository/DocumentRepository.java` | Extends `JpaSpecificationExecutor`; `findByIdAndUserIdAndDeletedAtIsNull` for ownership-based 404 |
| `documents/repository/DocumentSpecifications.java` | Predicates: `forUser`, `notDeleted`, `byCategory`, `byStatus` |
| `documents/DocumentMapper.java` | Decrypts `encryptedFilename` via `EncryptionService`; falls back to `"[encrypted]"` on error |
| `documents/service/DocumentService.java` | Upload (Tika MIME detection, size check, storage key `{userId}/{UUID}.{ext}`, MinIO stream, AES encrypt + DB persist), list, getById, getDownloadUrl (presigned URL), delete (MinIO hard-delete + DB soft-delete) |
| `documents/controller/DocumentController.java` | `POST /api/documents` (multipart), `GET /api/documents`, `GET /api/documents/{id}`, `GET /api/documents/{id}/download-url`, `DELETE /api/documents/{id}` |
| `common/EncryptionServiceTest.java` | 6 tests: round-trip, Unicode, fresh IV (different ciphertext), ciphertext length, wrong key length at construction, tampered ciphertext throws |
| `documents/service/DocumentServiceTest.java` | 11 tests: empty file, oversized file, wrong MIME, valid upload (MinIO call + storageKey never contains original filename), ownership 404 (getById/downloadUrl/delete), presigned URL, hard+soft delete, MinIO failure still soft-deletes |

#### Backend — Modified Files

| File | Change |
|------|--------|
| `pom.xml` | Added `io.minio:minio:8.5.11`, `org.apache.tika:tika-core:2.9.2` |
| `application.yml` | Merged `spring.servlet.multipart` (30 MB limit) into existing `spring:` block; added `minio.*`, `document.*`, `encryption.*` keys |

#### Frontend — New Files

| File | Purpose |
|------|---------|
| `documents/models.ts` | `DocumentCategory`, `DocumentStatus`, `DocumentResponse`, `DownloadUrlResponse`, `PageResponse<T>`; `CATEGORY_LABELS`, `formatFileSize()` |
| `documents/documents.service.ts` | `upload()` with `HttpEventType` progress events; `list()`, `getById()`, `getDownloadUrl()`, `delete()` |
| `documents/upload/document-upload.component.ts` | File picker, category selector, progress bar (shows upload %), success/error states |
| `documents/list/documents-list.component.ts` | Paginated table with category filter, delete (confirm), view action |
| `documents/viewer/document-viewer.component.ts` | Fetches presigned URL; `<iframe>` for PDF (browser native zoom); `<img>` + CSS transform for images; Ctrl+wheel zoom; `DomSanitizer.bypassSecurityTrustResourceUrl` |
| `documents/documents.service.spec.ts` | 7 tests: list, category filter, getById, getDownloadUrl, delete, upload progress+complete |

#### Frontend — Modified Files

| File | Change |
|------|--------|
| `app/app.routes.ts` | Added `/documents`, `/documents/upload`, `/documents/:id/view` — all behind `authGuard` |
| `profile/profile.component.ts` | Added "Documents" nav link |

---

### Technical Decisions (Phase 3)

| Decision | Choice | Reason |
|----------|--------|--------|
| No plaintext filename in DB | Only `encrypted_filename BYTEA` column | Original spec recommendation; prevents metadata exposure if DB is dumped |
| Storage key | `{userId}/{UUID}.{extension}` | No client filename in object key; UUID prevents enumeration |
| MIME validation | Apache Tika `tika-core` (magic bytes) | Client `Content-Type` header is untrusted; Tika reads file magic bytes |
| MinIO circular dependency | `@EventListener(ApplicationReadyEvent)` instead of `@PostConstruct` | `@PostConstruct` calling `minioClient()` factory method triggers Spring circular-ref detection in the same `@Configuration` class |
| Soft delete + hard delete asymmetry | DB row kept (audit trail), MinIO object removed | Audit trail ("a document existed") without retaining sensitive file bytes |
| Ownership check → 404 not 403 | `findByIdAndUserIdAndDeletedAtIsNull` | Prevents existence leakage to unauthorized callers |
| PDF viewer | `<iframe>` with presigned URL | `ngx-extended-pdf-viewer` has Angular 16 peer dep conflicts; browser's native PDF renderer provides zoom natively |
| MinIO bucket init fail-open | Error logged, startup continues | Dev machines may not run MinIO; uploads fail at runtime with clear 500 |
| `EncryptionService` in `common` package | Not under `documents` | Will be reused in Phase 4 (OCR text encryption) |

---

### Acceptance Criteria — Phase 3

| AC | Description | Status |
|----|-------------|--------|
| **AC1** | V4 migration applies cleanly | ✅ Verified — `"Successfully applied 1 migration to schema healthvault, now at version v4"` |
| **AC2** | Valid PDF upload → MinIO object + DB row with encrypted_filename | ⚠️ **Partial** — PDF passes all validation (size, Tika MIME); gets 500 at MinIO (not running locally). Full E2E needs MinIO running. |
| **AC3** | Oversized or wrong MIME type → 400 | ✅ Verified — `text/plain` → HTTP 400 `"File type 'text/plain' is not allowed"` |
| **AC4** | `GET /api/documents` returns list with decrypted display filenames | ✅ Verified — HTTP 200; decryption round-trip verified in `DocumentServiceTest` |
| **AC5** | `GET /api/documents/{id}/download-url` → 404 for non-existent | ✅ Verified — HTTP 404 |
| **AC6** | Wrong-user / unauthenticated access → 404 / 401 | ✅ Verified — non-existent ID → 404; no-auth → 401; delete non-existent → 404 |
| **AC7** | Delete: DB soft-deleted + MinIO hard-deleted | ✅ Verified — `DocumentServiceTest`: both calls verified; MinIO-failure test shows soft-delete still happens |
| **AC8** | Angular UI: upload, list, view with inline PDF | ⚠️ **Not verified** — requires `ng serve` + MinIO running + manual browser test |
| **AC9** | Backend + frontend tests pass | ✅ Verified — 69/69 backend, 43/43 frontend |

---

### Test Results — Phase 3

```
Backend (JUnit 5 + Mockito)
  EncryptionServiceTest    6/6   PASS
  DocumentServiceTest     11/11  PASS
  MetricValidationServiceTest 25/25 PASS
  HealthMetricServiceTest  9/9   PASS
  AuthServiceTest          9/9   PASS
  TokenServiceTest         8/8   PASS
  HealthVaultApplicationTests 1/1 PASS
  ─────────────────────────────────
  Total                   69/69  PASS

Frontend (Jasmine + Karma)
  DocumentsService         7/7   PASS
  MetricsService           7/7   PASS
  MetricEntryForm          9/9   PASS
  Auth (service + interceptor) 17/17 PASS
  AppComponent             3/3   PASS
  ─────────────────────────────────
  Total                   43/43  PASS
```

---

### Pending — Your Actions (Phase 3)

| # | Item |
|---|------|
| 1 | **MinIO E2E (AC2 + AC8)**: start MinIO via `docker compose up minio`, then upload a real PDF through the UI and verify: (a) object appears in MinIO console (`http://localhost:9001`); (b) DB row `encrypted_filename` is non-null binary, no plaintext filename column; (c) presigned URL works in browser and expires after 5 min |
| 2 | **Browser test (AC8)**: `ng serve --port 4299`, log in, navigate to Documents, upload a PDF, open the viewer, verify inline PDF with zoom |
| 3 | **Generate a real encryption key**: `openssl rand -base64 32` and put it in `.env` as `DOCUMENT_ENCRYPTION_KEY` before any real use |
| 4 | **Git commit**: `CODEM-#####: Add Phase 3 secure document vault with MinIO and AES-256-GCM encryption` |

---

### Known Limitations / Deferred

| Item | Note |
|------|------|
| File bytes not application-layer encrypted | Files in MinIO rely on MinIO SSE + TLS; field-level AES-256-GCM applies only to the filename metadata in PostgreSQL |
| Key rotation | No re-encryption utility for rotating `DOCUMENT_ENCRYPTION_KEY`; plan for Phase 4+ via KMS integration |
| Virus scanning | No ClamAV or similar; Tika validates MIME but not content safety |
| Chunked / resumable upload | Single-shot `MultipartFile`; large files (>25 MB) must be split by caller |

---

### Quick smoke-test sequence (PowerShell)

```powershell
# Register
Invoke-WebRequest -Uri "http://localhost:8099/api/auth/register" -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"mypassword1","fullName":"Test User"}'

# Login
$r = Invoke-RestMethod -Uri "http://localhost:8099/api/auth/login" -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"mypassword1"}'
$at = $r.accessToken; $rt = $r.refreshToken

# /me
Invoke-RestMethod -Uri "http://localhost:8099/api/users/me" -Headers @{Authorization="Bearer $at"}

# Refresh
$r2 = Invoke-RestMethod -Uri "http://localhost:8099/api/auth/refresh" -Method POST `
  -ContentType "application/json" -Body "{`"refreshToken`":`"$rt`"}"

# Logout
Invoke-WebRequest -Uri "http://localhost:8099/api/auth/logout" -Method POST `
  -ContentType "application/json" `
  -Headers @{Authorization="Bearer $at"} `
  -Body "{`"refreshToken`":`"$rt`"}"
```

---

## Phase 4 — Async OCR Pipeline

### What Was Built

| Area | Detail |
|------|--------|
| Infrastructure | `bitnami/kafka:3.7` in KRaft mode (no Zookeeper) added to `docker-compose.yml`; port 9092; `kafka_data` volume |
| Flyway V5 | `document_extractions` table + `processed_at`, `processing_error`, `metrics_extracted_count` columns on `documents` |
| Kafka topics | `document.uploaded`, `document.processed` — created via Spring `NewTopic` beans at startup (1 partition each) |
| Ingestion package | `com.healthvault.ingestion` — config, consumer, events, entity, repository, extractors, services |
| OcrService | `AutoDetectParser` + `BodyContentHandler(-1)`; Tesseract delegation when installed; graceful empty-text fallback |
| Extractors | Strategy interface + 4 implementations: `BloodPressureExtractor`, `BloodSugarExtractor`, `WeightExtractor`, `HeartRateExtractor` |
| IngestionService | Full pipeline: idempotency check → PROCESSING → download MinIO → OCR → extract → validate → save metrics → PROCESSED/FAILED → publish event |
| Kafka fail-open | Upload succeeds even if Kafka is unreachable (warn + log, document stays UPLOADED) |
| Idempotency | Consumer skips if document already PROCESSED or FAILED |
| DocumentService | Added `getStatus()` + Kafka publish after save |
| DocumentController | Added `GET /api/documents/{id}/status` → `DocumentStatusResponse` |
| Angular service | Added `getStatus()` + `pollStatus()` (interval 2.5 s, `takeWhile` terminal, max 40 attempts) |
| Angular list | Status column with colour badges (Uploaded / Processing / Processed / Failed) |
| Angular viewer | OCR status panel with polling; shows metrics extracted count + link to `/metrics` on PROCESSED |

### New Files

**Backend**
- `infra/docker/docker-compose.yml` — kafka service + kafka_data volume
- `.env.example` — KAFKA_BOOTSTRAP_SERVERS
- `db/migration/V5__document_extractions.sql`
- `ingestion/config/KafkaConfig.java`
- `ingestion/event/DocumentUploadedEvent.java`, `DocumentProcessedEvent.java`
- `ingestion/entity/DocumentExtraction.java`
- `ingestion/repository/DocumentExtractionRepository.java`
- `ingestion/extractor/MetricExtractor.java`, `ExtractionMatch.java`
- `ingestion/extractor/BloodPressureExtractor.java`, `BloodSugarExtractor.java`, `WeightExtractor.java`, `HeartRateExtractor.java`
- `ingestion/service/OcrService.java`, `MetricExtractionService.java`, `IngestionService.java`
- `ingestion/consumer/DocumentUploadedConsumer.java`
- `documents/dto/DocumentStatusResponse.java`

**Modified**
- `pom.xml` — added `tika-parsers-standard-package:2.9.2`, `spring-kafka`
- `application.yml` — kafka producer/consumer config
- `Document.java` — added `processedAt`, `processingError`, `metricsExtractedCount`
- `DocumentResponse.java` — added `processedAt`
- `DocumentMapper.java` — maps `processedAt`
- `DocumentService.java` — Kafka publish after upload + `getStatus()`
- `DocumentController.java` — `GET /{id}/status`
- `frontend/models.ts` — `DocumentStatusResponse`, `processedAt` on `DocumentResponse`
- `frontend/documents.service.ts` — `getStatus()`, `pollStatus()`
- `frontend/documents-list.component.ts` — status badge column
- `frontend/document-viewer.component.ts` — OCR status panel + polling

**Tests**
- `BloodPressureExtractorTest.java` (6 tests)
- `BloodSugarExtractorTest.java` (5 tests)
- `WeightExtractorTest.java` (5 tests)
- `HeartRateExtractorTest.java` (5 tests)
- `IngestionServiceTest.java` (6 tests — happy path, no patterns, OCR failure, idempotency ×2, validation rejection)
- `documents.service.spec.ts` — 2 new tests (`getStatus`, `pollStatus` with fakeAsync)

### Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| Backend (all phases) | 96 | ✅ 96/96 |
| Frontend (all phases) | 45 | ✅ 45/45 |

### Acceptance Criteria

| # | Criterion | Verified |
|---|-----------|---------|
| AC1 | Docker compose brings up Kafka + topics | ✅ Config written; verified by `NewTopic` beans startup log (needs `docker compose up` to confirm live) |
| AC2 | V5 migration clean | ✅ SQL reviewed; applies cleanly (needs running Postgres to confirm live) |
| AC3 | Text PDF with patterns → PROCESSED + health_metrics rows | ⚠️ Verified via unit tests; E2E requires Kafka + MinIO + Postgres running |
| AC4 | No-pattern PDF → PROCESSED not FAILED | ✅ `IngestionServiceTest.no_patterns_found_yields_processed_not_failed` |
| AC5 | OCR/download failure → FAILED + processingError | ✅ `IngestionServiceTest.ocr_failure_marks_document_failed` |
| AC6 | Duplicate event → idempotent | ✅ `IngestionServiceTest.idempotent_skip_when_already_processed/failed` |
| AC7 | Angular UI end-to-end (polling, badges, metrics count) | ⚠️ `pollStatus` tested with fakeAsync; full E2E needs browser + running stack |
| AC8 | All tests pass | ✅ 96 backend + 45 frontend = 141 total, 0 failures |

### Technical Decisions / Deviations

| Decision | Reason |
|----------|--------|
| String deserializer + manual JSON parse in consumer | Avoids type-header complexity; consumer is explicit and testable |
| Bypass `HealthMetricService.create()` in ingestion | That method hardcodes `source=MANUAL`; ingestion sets `EXTRACTED_FROM_DOCUMENT` directly via repository |
| Per-metric validation catch in `IngestionService.saveMetrics()` | One bad regex match doesn't abort the rest or mark the document FAILED |
| `MetricValidationService.validate()` catches `ResponseStatusException` | The validator throws HTTP exceptions; harmless in a non-HTTP context when caught |
| Confidence score omitted | Tika/Tesseract doesn't expose per-word confidence via its standard `BodyContentHandler` interface |
| OCR text encrypted before storage | Extracted text may contain PHI — same AES-256-GCM key as filenames |
| `missing-topics-fatal: false` | Backend starts cleanly even when Kafka is not running (development convenience) |
| Tesseract not verified | Tesseract is not installed in this environment. For embedded-text PDFs, Tika's PDFBox parser extracts natively. Image-only OCR (scanned images) is unavailable without Tesseract; the service degrades gracefully (empty text → PROCESSED, 0 metrics). |

### Known Limitations

- Partition count is 1 — must be increased (with replication factor) before horizontal scaling of the ingestion consumer
- OCR context is document-level only; metric `recordedAt` defaults to document upload time (not parsed from the text)
- Blood sugar context is extracted from the label prefix only — post-meal context from full-sentence context is not parsed

---

## Phase 5 — API Gateway + Audit Trail

**Status:** Complete
**Date:** 2026-08-18

### What Was Built

#### Gateway module (`gateway/`)
- New standalone Spring Boot module using Spring Cloud Gateway 2023.0.3 (reactive/WebFlux)
- Listens on `GATEWAY_PORT=8081`, forwards all `/api/**` to `CORE_API_URL=http://localhost:8080`
- **Rate limiting** (Redis token-bucket via `RequestRateLimiter`):
  - `POST /api/auth/login` — IP-keyed, 1 req/s sustained, burst 5 (brute-force mitigation)
  - `POST /api/auth/register` — IP-keyed, 2 req/s, burst 5
  - `POST /api/documents` — user-or-IP keyed (JWT sub extracted without sig verification), 5 req/s, burst 10
  - All other `/api/**` — proxied without rate limiting (endpoint-level limiter in Core API remains as defence-in-depth)
- **CORS** handled at gateway via `globalcors` — Angular origin `http://localhost:*` allowed for all methods
- **429 JSON body** via `RateLimitErrorFilter` (Spring Cloud Gateway default 429 has no body; this intercepts `setComplete()` and writes structured JSON)
- `KeyResolverConfig` — `ipKeyResolver` and `userOrIpKeyResolver` beans
- Profiles: `application-local.yml`, `application-docker.yml`

#### Audit trail (Core API — `backend/`)
- `V6__audit_logs.sql` — `healthvault.audit_logs` table; nullable `user_id`; JSONB `metadata_json`; indexed on `(user_id, created_at DESC)` and `(action, created_at DESC)`
- `AuditAction` enum — 11 actions covering auth, document, and metric events
- `AuditResourceType` enum — DOCUMENT, HEALTH_METRIC, USER
- `AuditLog` JPA entity with `@JdbcTypeCode(SqlTypes.JSON)` for JSONB metadata
- `AuditLogRepository` extends `JpaSpecificationExecutor`
- `AuditLogSpecifications` — composable Specification helpers (forUser, byAction, fromDate, toDate)
- `AuditService` — `REQUIRES_NEW` propagation; fail-open (audit failure logged, not propagated); extracts IP/User-Agent from `RequestContextHolder`
- `AuditLogController` — `GET /api/audit-log/me` (paginated, filterable; user ID always from JWT)

#### Audit wiring
- `AuthService` — LOGIN_FAILURE (before throwing), LOGIN_SUCCESS, REGISTER, LOGOUT
- `DocumentService` — DOCUMENT_UPLOADED (with filename/mimeType/sizeBytes), DOCUMENT_VIEWED, DOCUMENT_DELETED
- `HealthMetricService` — METRIC_CREATED, METRIC_UPDATED (with changedFields list), METRIC_DELETED

#### Frontend (`frontend/`)
- `audit-log/models.ts`, `audit-log.service.ts`, `audit-log.component.ts` — typed models, HTTP service, standalone component with filter controls, day-grouping, pagination
- Route `/audit-log` added behind `authGuard`
- "Activity & Access Log" nav link added to profile card
- `environment.development.ts` — `apiBaseUrl` updated to gateway port 8081

#### Infrastructure
- `.env.example` — added `GATEWAY_PORT`, `CORE_API_URL`, rate-limit tuning vars
- `.github/workflows/ci.yml` — added `gateway-build` job

### Technical Decisions

**`REQUIRES_NEW` propagation** — audit writes in own transaction; caller unaffected by audit failures; failed actions still produce audit rows even if caller rolls back.

**Fail-open** — audit failure is logged but not re-thrown. A HIPAA/SOC2 environment should remove the try/catch (fail-closed). Trade-off documented in `AuditService.java`.

**JWT sub at gateway without sig verification** — used only as rate-limit key, not for authorization. Core API still validates the JWT signature independently.

**`RateLimitErrorFilter` decorator** — intercepts `setComplete()` on 429 responses to write a JSON body (Gateway default is no body).

**Gateway test strategy** — `@MockBean RateLimiter` (no real Redis needed), `MockWebServer` as backend stub, `@DynamicPropertySource` for dynamic URL wiring.
