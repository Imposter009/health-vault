# Health Vault — Postman Collection

Covers every REST endpoint implemented in the Health Vault backend through Phase 10, generated
directly from the `@RestController` classes, request/response DTOs, and validation annotations
in `backend/src/main/java` — not from design docs. **Local development only** (`localhost`);
this is not meant for use against any deployed environment as-is.

## Files

| File | Purpose |
|---|---|
| `health-vault.postman_collection.json` | The collection — 7 folders, ~39 requests |
| `health-vault.postman_environment.json` | The `health-vault - Local` environment |
| `fixtures/sample-lab-report.pdf` | Small synthetic PDF for the Upload Document request |
| `fixtures/unsupported-file.txt` | Plain-text file for the "unsupported MIME type" negative case |
| `fixtures/oversized-file.pdf` | Sparse (zero-filled) file just over the 25MB upload limit |

## Import

1. Open Postman → **Import** → select both `health-vault.postman_collection.json` and
   `health-vault.postman_environment.json`.
2. Select the **health-vault - Local** environment from the environment dropdown (top-right).
3. Make sure the local stack is running (Core API on `:8080`, Gateway on `:8081`, plus
   Postgres/Redis/MinIO/Kafka — see the repo's own `SETUP.md`).

## Running the collection

Recommended order (this is also the order the folders appear in, top to bottom):

```
00 - Health & Status  →  01 - Auth  →  02 - Health Metrics  →  03 - Documents
→  04 - Audit Log  →  05 - AI  →  06 - Negative & Edge Cases
```

Use **Collection Runner** (or Newman) and run the whole collection start to finish. The `01 - Auth`
folder's **Login** request populates `{{accessToken}}`/`{{refreshToken}}` in the environment;
every other authenticated request inherits the Bearer token from the collection root, so nothing
needs to be copy-pasted manually.

```bash
npx newman run health-vault.postman_collection.json -e health-vault.postman_environment.json
```

If your npm is pointed at a private/company registry that doesn't mirror `newman`, point at the
public registry just for this command:

```bash
npx --registry https://registry.npmjs.org/ newman run health-vault.postman_collection.json -e health-vault.postman_environment.json
```

### Important ordering note: Logout is last in the Auth folder

The Auth folder deliberately runs **Logout after Get Current User**, not before it. Logout
blacklists the access token immediately — running it earlier would break every folder that comes
after it in a full top-to-bottom run. If you need to test logout in isolation, re-run **Login**
afterward to get a fresh session before continuing with the rest of the collection.

### Re-running from scratch

**Register**'s pre-request script appends a timestamp to `{{userEmail}}` on every run, so you can
re-run the entire collection repeatedly without hitting a duplicate-email 409 on Register itself.
The `06 - Negative & Edge Cases → Register - Duplicate Email` request intentionally reuses
whatever `{{userEmail}}` currently holds (i.e. the one just created this run) to prove the 409
path — that one is *supposed* to conflict.

### Two requests need an async-capable Postman/Newman

`Access Protected Endpoint - Expired/Blacklisted Token` and `Login - Rate Limit Exceeded` use
`await pm.sendRequest(...)` in their pre-request scripts to set up real server-side state (a
genuinely blacklisted token; five burst login attempts) before the main request runs. This needs
**Postman ≥ v10** or **Newman ≥ v6**. Both scripts fail safely (they never crash the run) if the
setup calls can't reach the server — the main request just runs with whatever fallback state was
set, and its own assertion reports the mismatch.

## The AI folder is conditional on server config

`05 - AI → AI Feature Status` always works. Everything else in that folder — Summarize Document,
RAG Chat, Trend Narration — requires the server to be started with `AI_FEATURES_ENABLED=true` and
a valid `OPENAI_API_KEY`; otherwise a catch-all controller returns `503` for the whole `/api/ai/**`
tree (except `/api/ai/status`). Each request's test script branches on the response code so the
collection still passes with useful information either way, rather than hard-failing when AI is
off (which is the local dev default).

## Fixture file paths after import

Postman stores an **absolute local path** for file-upload fields, which is not portable across
machines and does not travel with a JSON export. After importing this collection on a new machine,
if the `file` field on **Upload Document**, **Upload - Oversized File**, or
**Upload - Unsupported MIME Type** shows empty or red:

1. Open the request → **Body** tab.
2. Click the file field and re-select the corresponding file under this repo's `postman/fixtures/`
   folder (paths are relative to this `postman/` directory: `fixtures/sample-lab-report.pdf`, etc.).

## What's in `fixtures/sample-lab-report.pdf`

A minimal, hand-built single-page PDF containing only placeholder text (clearly marked as a
synthetic test fixture, `Glucose: 95 mg/dL`, `Blood Pressure: 120/80 mmHg`, `Heart Rate: 72 bpm`).
It contains no real personal or health information. Because it's a real (if minimal) PDF with
extractable text, uploading it also doubles as a manual way to exercise the Phase 4 OCR/extraction
pipeline — poll **Get Document Status** after upload to watch it move from `UPLOADED` →
`PROCESSING` → `PROCESSED`.

## Scope and limits

This collection is a manual/exploratory testing aid and living API reference — every request
carries lightweight `pm.test(...)` assertions (status code, key response fields, pagination
envelope shape where relevant). It is **not** a replacement for the Playwright/Testcontainers
suites from Phase 8 and doesn't attempt that level of rigor.
