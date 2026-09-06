# Load Test Results — POST /api/documents (Upload Endpoint)

**Date:** 2026-08-22  
**Tool:** k6 (script: `docs/k6-load-test.js`)  
**Endpoint:** `POST /api/documents` via gateway (`http://localhost:8081/api/documents`)  
**Objective:** Verify the gateway rate-limiter fires at the configured threshold and measure upload throughput/latency under load.

---

## How to Re-Run

```bash
# 1. Start the stack
docker compose up -d

# 2. Create a test user (once)
curl -s -X POST http://localhost:8081/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"load@test.com","password":"LoadTest123!","fullName":"Load Tester"}'

# 3. Obtain a token
TOKEN=$(curl -s -X POST http://localhost:8081/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"load@test.com","password":"LoadTest123!"}' | jq -r .accessToken)

# 4. Run k6  (Windows: set TOKEN=... && k6 run ...)
TOKEN=$TOKEN k6 run docs/k6-load-test.js
```

---

## Rate-Limiter Configuration (Under Test)

| Parameter | Value | Source |
|-----------|-------|--------|
| Replenish rate | 5 req/s | `GATEWAY_RATE_UPLOAD_REPLENISH=5` |
| Burst capacity | 10 tokens | `GATEWAY_RATE_UPLOAD_BURST=10` |
| Key resolver | `userOrIpKeyResolver` | Per-user when JWT present |
| Algorithm | Redis token bucket | Spring Cloud Gateway `RequestRateLimiter` |

---

## Expected Behaviour (Design Verification)

The k6 scenario ramps VUs in two stages:

| Stage | VUs | Expected outcome |
|-------|-----|-----------------|
| 0–30 s (ramp + hold at 4 VUs) | 4 | Below 5 rps sustained — all requests `201 Created` |
| 30–60 s (ramp + hold at 12 VUs) | 12 | Above burst capacity — mix of `201` and `429 Too Many Requests` |
| 60–70 s (cool down) | 0 → 0 | — |

**Rate-limiter confirms:**
- At 4 VUs with 0.1 s sleep, effective RPS ≈ 4×10 = 40 req/s raw but burst absorbs up to 10 tokens → some 429s expected even at 4 VUs if requests burst
- The design is validated when 429s appear above the burst cap and disappear when VUs drop back

---

## Thresholds Defined in Script

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| `successful_uploads` | `rate > 0.60` | ≥60 % of requests succeed across the test (includes the overload stage) |
| `upload_duration_ms p(95)` | `< 3000 ms` | Non-throttled uploads complete within 3 s at p95 |
| `http_req_failed` | `rate < 0.05` | 5xx error rate stays below 5 % — 429s are not counted as failures |

---

## Note: Results Not Captured Here

The k6 test is designed to run **against a live stack**. Because Docker Desktop was not active during Phase 9 development, a live run was not captured in this document.

**To capture results** and paste them here, run the k6 script as shown above and copy the k6 end-of-test summary into the block below.

```
[paste k6 output here]
```

---

## Interpreting Results

| Observation | What it means |
|-------------|---------------|
| `rate_limited_requests` counter grows sharply at 12 VUs | Rate limiter is active — expected |
| `upload_duration_ms p(95)` stays < 3 s when not throttled | MinIO write + DB persist is within acceptable latency |
| `http_req_failed` > 5 % | 5xx errors; check MinIO / Kafka availability |
| 100 % of requests `201` at 12 VUs | Rate limiter not firing — check Redis connectivity in gateway |
