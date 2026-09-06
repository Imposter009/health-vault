# OWASP Top 10 (2021) Self-Review — Health Vault

**Date:** 2026-08-22  
**Reviewer:** Phase 9 automated review  
**Scope:** `backend/`, `gateway/` source code  
**Format:** what was checked · pass/fail · severity · file:line for failures

---

## A01 — Broken Access Control

**What was checked:**
- How user ID is resolved in all controller endpoints
- Whether storage keys prevent path traversal
- Whether cross-user document/metric access is enforced at the data layer

**Result: PASS**

| Check | Evidence |
|-------|----------|
| User ID source | All controllers call `auth.getName()` (JWT `sub` claim) — never a request param or body field |
| Document storage keys | Format: `{userId}/randomUUID.ext` — client filename never used as object key (`DocumentService.java:82`) |
| Cross-user enforcement | `findByIdAndUserIdAndDeletedAtIsNull(id, userId)` used for all document lookups (`DocumentService.java:149,172,181,206`) |
| Metric scoping | Dashboard queries include `WHERE user_id = ?` with the JWT-derived userId (`DashboardService.java:38`) |

---

## A02 — Cryptographic Failures

**What was checked:**
- AES-256-GCM IV handling
- Password hashing algorithm
- Refresh token storage pattern
- JWT signing algorithm and minimum key length
- Default/placeholder secrets

**Result: PASS (with 2 informational notes)**

| Check | Evidence |
|-------|----------|
| Field encryption | AES-256-GCM, 12-byte `SecureRandom` IV per call, 128-bit GCM tag — correct (`EncryptionService.java:50-54`) |
| IV reuse | Fresh IV per encrypt call — never reused |
| Password hashing | BCryptPasswordEncoder — confirmed (`SecurityConfig.java`) |
| Refresh token storage | 32-byte `SecureRandom` raw token, SHA-256 hashed before DB storage — raw value never persisted (`TokenService.java:53-68`) |
| JWT algorithm | HMAC-SHA256 (HS256), minimum 32-char key enforced at startup (`JwtConfig.java:28`) |
| Access token TTL | 15 minutes (`application.yml:82`) |
| Refresh token TTL | 30 days, configurable (`application.yml:83`) |

**Info:** `application.yml:81` — `JWT_SECRET` defaults to a known placeholder string. This is an env-var override (`${JWT_SECRET:placeholder-...}`) documented as dev-only. Not exploitable in a correctly deployed instance, but the placeholder is a known string and would be a critical finding in production if not overridden.

**Info:** `application.yml:113` — `DOCUMENT_ENCRYPTION_KEY` similarly defaults to a dev-only Base64 key, documented in the YAML comment. Same note applies.

---

## A03 — Injection

**What was checked:**
- Database query patterns (native SQL vs. parameterized)
- File extension and storage key construction
- MIME type validation
- Manual JSON construction

**Result: PASS**

| Check | Evidence |
|-------|----------|
| SQL injection | No `nativeQuery = true` found; all queries through JPA `findBy*` or `JdbcTemplate` with `?` placeholders (`DashboardService.java`) |
| Storage key injection | `extractExtension()` strips all non-`[a-z0-9]` chars (`DocumentService.java:245`); key uses `UUID.randomUUID()` — no client filename in object path |
| MIME injection | Apache Tika reads magic bytes; client `Content-Type` header only used as fallback if Tika fails (`DocumentService.java:232-238`) |
| JSON construction | `sendUnauthorized()` in `JwtAuthenticationFilter.java:71` builds JSON via string concat, but `message` is always a hardcoded string — no user input is concatenated |

---

## A04 — Insecure Design

**What was checked:**
- Rate limiting design
- Refresh token rotation
- JWT revocation on logout
- Upload flow ordering (validate-before-store)

**Result: PASS**

| Check | Evidence |
|-------|----------|
| Rate limiting — gateway | Redis token-bucket per route: login 1 rps/burst 5, register 2 rps/burst 5, upload 5 rps/burst 10 (`gateway/application.yml:36-76`) |
| Rate limiting — backend | `RateLimitFilter` with Redis sliding window on `/api/auth/**` as defence-in-depth |
| Refresh token rotation | Old token revoked in DB before new pair issued (`AuthService.java:113-116`) |
| JWT blacklisting | Access token `jti` added to Redis with remaining TTL on logout (`TokenService.java:75-88`) |
| Upload validation order | Size check → Tika MIME check → stream to MinIO → DB persist (`DocumentService.java:60-145`) |

---

## A05 — Security Misconfiguration

**What was checked:**
- Spring Security actuator permit configuration
- CORS wildcard settings
- Default secrets in config
- Error messages (information leakage)

**Result: FAIL — 1 finding**

### Finding A05-001 · Severity: MEDIUM

**File:** `backend/src/main/java/com/healthvault/config/SecurityConfig.java:54`

```java
.requestMatchers("/actuator/**").permitAll()
```

**What it means:** All actuator endpoints under `/actuator/**` are publicly accessible without authentication. In the prod profile, exposure is restricted to `health`, `info`, and `prometheus` (via `application-prod.yml`), but these three endpoints remain unauthenticated.

**Risk:** `/actuator/prometheus` exposes Micrometer metrics including:
- `auth.login.count` by outcome — reveals whether the service is receiving login attempts
- `documents.uploaded.count` by category — reveals document activity
- JVM/system metrics (heap, threads, GC pauses)

An external observer can monitor the system's internal behaviour without any credentials.

**Fix:** Require authentication for all actuator endpoints except `/actuator/health/**` (which Docker/load-balancer healthchecks call unauthenticated). See Section 4 of this report for the applied fix.

---

**Other A05 checks:**

| Check | Result |
|-------|--------|
| CORS | `allowedOriginPatterns` restricted to `localhost:*` and `127.0.0.1:*` — not wildcard. Prod needs real origin list before deployment (not a current vuln) |
| Error messages | Login returns identical "Invalid credentials" for bad email and bad password — no user enumeration (`AuthService.java:71,78`) |
| Duplicate registration | Generic "An account with these details already exists" — email not confirmed as conflict field (`AuthService.java:47-49`) |

---

## A06 — Vulnerable and Outdated Components

**What was checked:** See `docs/dependency-scan-results.md` (Section 2 of Phase 9).

---

## A07 — Identification and Authentication Failures

**What was checked:**
- Failed login auditing
- Brute-force mitigation
- Password hashing
- Token validation
- Session invalidation on logout

**Result: PASS**

| Check | Evidence |
|-------|----------|
| Failed login audit | Both "user not found" and "bad password" paths call `auditService.record(LOGIN_FAILURE, ...)` (`AuthService.java:68-76`) |
| Login metrics | `auth.login.count` counter tagged by outcome — Prometheus alerts can fire on unusual failure rates (`AuthService.java:87-92`) |
| Brute-force mitigation | IP-keyed rate limiter at gateway: 1 req/s sustained, burst 5, for `/api/auth/login` |
| Password hashing | BCrypt |
| JWT validation | Spring Security `NimbusJwtDecoder` with signature verification on every request |
| Logout invalidation | Access token blacklisted in Redis; refresh token revoked in PostgreSQL |

---

## A08 — Software and Data Integrity

**What was checked:**
- File upload validation beyond Content-Type
- Deserialization patterns
- Kafka message integrity

**Result: PASS**

| Check | Evidence |
|-------|----------|
| MIME validation | Apache Tika reads file magic bytes — Content-Type header never trusted alone (`DocumentService.java:231-239`) |
| File allowlist | Only `application/pdf`, `image/jpeg`, `image/png` accepted (`application.yml:103-106`) |
| Extension sanitization | Regex `[^a-z0-9]` applied to extracted extension (`DocumentService.java:245`) |
| JSON deserialization | Jackson with explicit DTO records — no `Object` or `Map<String,Object>` deserialization from untrusted sources |
| Kafka messages | `StringDeserializer` + explicit `ObjectMapper.readValue(json, DocumentUploadedEvent.class)` — typed deserialization |

---

## A09 — Security Logging and Monitoring Failures

**What was checked:**
- Which events are audited
- Whether failed attempts are logged
- Metric instrumentation for security-relevant events

**Result: PASS**

| Event | Audited |
|-------|---------|
| User registration | `REGISTER` audit record |
| Login success | `LOGIN_SUCCESS` audit record |
| Login failure (user not found) | `LOGIN_FAILURE` audit record with `"reason":"user_not_found"` |
| Login failure (bad password) | `LOGIN_FAILURE` audit record with `"reason":"bad_password"` |
| Document upload | `DOCUMENT_UPLOADED` with filename, MIME, size |
| Document viewed (presigned URL) | `DOCUMENT_VIEWED` |
| Document deleted | `DOCUMENT_DELETED` |

**Note:** Audit log is persisted in PostgreSQL (`healthvault.audit_log`). For production, export to a SIEM (Splunk, ELK) is recommended so audit records cannot be tampered with by the same compromised DB connection.

---

## A10 — Server-Side Request Forgery (SSRF)

**What was checked:**
- Whether any user-controlled URL is fetched
- Gateway upstream URL configuration
- MinIO presigned URL generation

**Result: PASS**

| Check | Evidence |
|-------|----------|
| User-controlled URL fetch | No `RestTemplate`, `WebClient`, or HTTP client call that takes a user-supplied URL |
| Gateway upstream | `CORE_API_URL` is an admin-controlled env var (`gateway/application.yml:39`) — not user input |
| MinIO presigned URLs | Generated via MinIO SDK `GetPresignedObjectUrlArgs` with `Method.GET` — no user URL is opened; URL is returned to the caller, not fetched server-side |

---

## Summary

| Category | Status | Severity |
|----------|--------|----------|
| A01 Broken Access Control | PASS | — |
| A02 Cryptographic Failures | PASS | Info (dev defaults documented) |
| A03 Injection | PASS | — |
| A04 Insecure Design | PASS | — |
| A05 Security Misconfiguration | **FAIL** | **Medium** (A05-001) |
| A06 Vulnerable Components | See dependency scan | — |
| A07 Auth Failures | PASS | — |
| A08 Data Integrity | PASS | — |
| A09 Security Logging | PASS | — |
| A10 SSRF | PASS | — |

**1 finding requiring a fix.** Fix applied in Section 4 of Phase 9.
