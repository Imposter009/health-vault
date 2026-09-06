# Dependency Vulnerability Scan Results — Health Vault

**Date:** 2026-08-22  
**Tools:** OWASP Dependency-Check (Maven plugin, skip=true by default), npm audit  
**Scope:** `backend/`, `gateway/` (Java), `frontend/` (npm)

---

## Java — OWASP Dependency-Check

**Plugin version:** 10.0.4  
**Configuration:** `backend/pom.xml`, `gateway/pom.xml`

The plugin is wired but skipped by default to avoid the 60+ second NVD API download in every CI run.

**To run manually:**

```bash
# Backend
cd backend
mvn org.owasp:dependency-check-maven:check -Ddependency-check.skip=false

# Gateway
cd gateway
mvn org.owasp:dependency-check-maven:check -Ddependency-check.skip=false
```

Reports are written to `target/dependency-check-report.html` and `.json`.

**To add to CI (add to the `security` job in `.github/workflows/ci.yml`):**

```yaml
- name: OWASP Dependency-Check (backend)
  working-directory: backend
  run: mvn org.owasp:dependency-check-maven:check -Ddependency-check.skip=false
  env:
    NVD_API_KEY: ${{ secrets.NVD_API_KEY }}
```

**Key Spring Boot 3.3.5 dependency notes:**
- Spring Boot 3.3.5 ships a curated BOM with regular CVE patches — baseline is current as of this build
- Spring Security 6.3.x included via Boot BOM — recent, no known critical CVEs
- Tomcat pinned to 10.1.30 (`<tomcat.version>`) — see CLAUDE.md note; update when Artifactory caches 10.1.31+
- Nimbus JOSE+JWT and Bouncy Castle versions managed by Boot BOM

---

## Frontend (npm) — npm audit

**Date run:** 2026-08-22  
**Command:** `npm audit --json` in `frontend/`

### Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 34 |
| Moderate | 16 |
| Low | 7 |
| **Total** | **58** |

### Analysis

**All 58 vulnerabilities are in dev/build dependencies or in the Angular 16.x framework**, which is **locked at 16.x** per the project's explicit constraint (CLAUDE.md: "Angular 16.x"). Upgrading to fix these requires `npm audit fix --force`, which would jump to Angular 22.x — a major breaking change not justified by the risk.

| Finding | Affected Package | Risk in Health Vault | Decision |
|---------|-----------------|----------------------|----------|
| XSRF token leakage via protocol-relative URLs | `@angular/common <=19.2.25` | Not exploitable — Health Vault uses no protocol-relative URLs (`//example.com/...`). All API calls go to the same-origin gateway. | Accept (blocked by Angular 16.x pin) |
| DoS via OOM in `formatDate()` | `@angular/common` | Not exploitable — date formatting is in the dashboard component; no user-controlled format string. Input is an ISO date string from the API. | Accept |
| `HttpTransferCache` data leakage / state poisoning | `@angular/common` | Not exploitable — `HttpTransferCache` requires Angular Universal (SSR). Health Vault is a plain SPA with no SSR. | Accept |
| Webpack `buildHttp` SSRF (critical) | `webpack 5.49.0-5.104.0` | Not exploitable — `buildHttp` is webpack's `experiments.buildHttp` feature for importing HTTP resources at build time. Health Vault does not use this feature. | Accept |
| `uuid` missing buffer bounds check | `uuid <11.1.1` | In `webpack-dev-server` (dev-only dependency). Not present in production bundle. | Accept |

### Fix path (future)

When Angular 16.x support window closes, upgrade to the latest Angular LTS (currently 18.x or 19.x) in a dedicated frontend-upgrade branch, re-run `npm audit`, and address residuals. That work is logged as a roadmap item.

### Production bundle audit

The vulnerabilities reported by `npm audit` are in `devDependencies` or Angular packages that are included in the compiled output but not exploitable through Health Vault's usage patterns. The production Nginx container does not ship `node_modules/` — only the compiled `dist/frontend/browser/` output.

---

## Dependabot Configuration

`.github/dependabot.yml` wires GitHub's automated dependency update PRs for both npm and Maven.

---

## CI Integration

The `security` job in `.github/workflows/ci.yml` runs:
1. `npm audit --audit-level=critical` — fails only on critical vulnerabilities
2. OWASP Dependency-Check for Java (requires NVD_API_KEY secret)

The `--audit-level=critical` flag means CI fails if a new critical npm vulnerability is introduced. The current critical (webpack SSRF) is a known false-positive accepted above — add an `.nsprc` or `audit-ci.json` suppression if it becomes a blocker in CI.
