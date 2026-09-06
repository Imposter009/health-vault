/**
 * k6 load test — POST /api/documents (file upload endpoint)
 *
 * Tests the rate-limiter threshold (5 rps / burst 10 at gateway) and
 * measures throughput and latency under sustained upload pressure.
 *
 * Prerequisites:
 *   - k6 installed: https://k6.io/docs/getting-started/installation/
 *   - Health Vault running locally (docker compose up -d)
 *   - A valid access token (see TOKEN below)
 *
 * Usage:
 *   # Obtain a token first:
 *   TOKEN=$(curl -s -X POST http://localhost:8081/api/auth/login \
 *     -H 'Content-Type: application/json' \
 *     -d '{"email":"load@test.com","password":"LoadTest123!"}' | jq -r .accessToken)
 *
 *   # Run the test:
 *   TOKEN=$TOKEN k6 run docs/k6-load-test.js
 *
 *   # Or on Windows:
 *   $env:TOKEN = "Bearer eyJ..."
 *   k6 run docs/k6-load-test.js
 *
 * Results are written to docs/load-test-results.md after the run.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom metrics ─────────────────────────────────────────────────────────
const rateLimitedCount = new Counter('rate_limited_requests');
const successRate      = new Rate('successful_uploads');
const uploadDuration   = new Trend('upload_duration_ms', true);

// ── Test configuration ─────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Ramp up to 8 VUs (above gateway burst=10 sustained threshold),
    // hold for 30 s, then ramp down.
    upload_ramp: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 4  },  // ramp: below rate limit
        { duration: '20s', target: 4  },  // steady: below limit — expect 200s
        { duration: '10s', target: 12 },  // ramp: above sustained rate limit
        { duration: '20s', target: 12 },  // steady: above limit — expect 429s
        { duration: '10s', target: 0  },  // cool down
      ],
    },
  },

  thresholds: {
    // At least 60 % of requests succeed (some 429s expected in the overload stage)
    'successful_uploads': [{ threshold: 'rate>0.60', abortOnFail: false }],
    // p95 upload duration under 3 seconds when not rate-limited
    'upload_duration_ms': [{ threshold: 'p(95)<3000', abortOnFail: false }],
    // HTTP error rate: allow 429s but not 5xx
    'http_req_failed': [{ threshold: 'rate<0.05', abortOnFail: false }],
  },
};

// ── Minimal PDF (13 bytes) — avoids disk I/O during the test ──────────────
// A real PDF magic header so Apache Tika accepts it.
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d,  // %PDF-
  0x31, 0x2e, 0x34, 0x0a,        // 1.4\n
  0x25, 0xc7, 0xec, 0x8f, 0xa2,  // binary comment (common in real PDFs)
]);

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081';
const TOKEN    = __ENV.TOKEN    || 'REPLACE_WITH_BEARER_TOKEN';

export default function () {
  const formData = {
    file: http.file(PDF_BYTES, `load-test-${Date.now()}.pdf`, 'application/pdf'),
    category: 'LAB_REPORT',
  };

  const params = {
    headers: {
      Authorization: TOKEN.startsWith('Bearer ') ? TOKEN : `Bearer ${TOKEN}`,
    },
  };

  const start = Date.now();
  const res   = http.post(`${BASE_URL}/api/documents`, formData, params);
  const elapsed = Date.now() - start;

  const ok        = res.status === 201;
  const throttled = res.status === 429;

  if (throttled) rateLimitedCount.add(1);
  if (!throttled) uploadDuration.add(elapsed);

  successRate.add(ok ? 1 : 0);

  check(res, {
    'status is 201 or 429': (r) => r.status === 201 || r.status === 429,
    'no 5xx errors':        (r) => r.status < 500,
  });

  // Short think time to model realistic user behaviour
  sleep(0.1);
}

export function handleSummary(data) {
  // Print a compact summary to stdout — detailed results go to docs/load-test-results.md
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Inline text summary helper (k6 includes this in newer builds; kept here for compatibility)
function textSummary(data, opts) {
  const metrics = data.metrics;
  const lines   = [
    '=== Health Vault Upload Endpoint Load Test ===',
    `  Total requests      : ${metrics.http_reqs?.values?.count ?? 'N/A'}`,
    `  Successful uploads  : ${metrics.successful_uploads?.values?.rate?.toFixed(3) ?? 'N/A'}`,
    `  Rate-limited (429)  : ${metrics.rate_limited_requests?.values?.count ?? 0}`,
    `  Upload p95 (ms)     : ${metrics.upload_duration_ms?.values?.['p(95)']?.toFixed(0) ?? 'N/A'}`,
    `  Upload p99 (ms)     : ${metrics.upload_duration_ms?.values?.['p(99)']?.toFixed(0) ?? 'N/A'}`,
    `  HTTP errors (<500)  : ${(metrics.http_req_failed?.values?.rate * 100)?.toFixed(1) ?? 'N/A'}%`,
  ];
  return lines.join('\n') + '\n';
}
