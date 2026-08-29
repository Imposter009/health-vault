# Phase 6 — PWA / Offline Support: Manual Test Checklist

## Prerequisites

The production build must be served (not `ng serve` — dev mode skips the service worker):

```bash
# In frontend/
ng build --configuration=production
npx serve dist/frontend -l 4302
# Open: http://localhost:4302
```

---

## AC-1: Service Worker Registered

**DevTools → Application → Service Workers**

- [ ] `ngsw-worker.js` appears with status **activated and running**
- [ ] Scope: `http://localhost:4302/`

---

## AC-2: App Shell Loads Offline

1. Load the app online and navigate around (login page, dashboard).
2. DevTools → Network → **Offline** checkbox ✓
3. Hard-refresh (`Ctrl+Shift+R`) — or just navigate away and back.

- [ ] The app shell renders (no "Cannot reach site" browser error page)
- [ ] Login page is visible
- [ ] The **⚡ You're offline** banner appears at the bottom

---

## AC-3: Cached Metrics Visible Offline

1. While online: open the **Dashboard** and wait for chart data to load.
2. Go offline (DevTools → Network → Offline).
3. Reload the page.

- [ ] Dashboard shows previously loaded metric data (from service worker cache)
- [ ] Offline banner is visible
- [ ] No "Failed to load dashboard" error (data came from cache)

---

## AC-4: Previously-Viewed Document Available Offline

1. While online: open **Documents** → click any document to open the viewer.
   - The viewer fetches and caches the document bytes in IndexedDB.
2. Go offline.
3. Navigate back to the document viewer for the same document.

- [ ] Document is displayed with an **"Viewing offline copy cached on [date]"** notice
- [ ] The document content renders correctly from IndexedDB cache

---

## AC-5: Not-Yet-Viewed Document Shows Correct Message

1. While offline: navigate to a document that was **never opened** in the viewer.

- [ ] The viewer shows: **"This document is not available offline yet. Connect to the internet to view it."**
- [ ] No error or blank screen

---

## AC-6: Offline Banner Appears / Disappears

1. Load the app online — no banner visible.
2. Go offline (DevTools → Network → Offline) — banner appears.
3. Go online (uncheck Offline) — banner disappears.

- [ ] Banner visible when offline
- [ ] Banner hidden when online
- [ ] Transitions are immediate (no page reload needed)

---

## AC-7: Forms Disabled Offline

**Document Upload:**
1. Go offline.
2. Navigate to **Documents → Upload**.

- [ ] Upload form is hidden
- [ ] "📵 Connect to the internet to upload documents." message shown
- [ ] Link back to Documents list is shown

**Metric Entry Form:**
1. Go offline.
2. Navigate to **Metrics → Add new**.

- [ ] Metric form is hidden
- [ ] "📵 Connect to the internet to add new entries." message shown

---

## AC-8: Dashboard Refreshes on Reconnect

1. Open the Dashboard while online (note the data displayed).
2. Go offline.
3. Come back online.

- [ ] Dashboard data reloads automatically (no manual refresh needed)
- [ ] No "Failed to load dashboard" error shown

---

## AC-9: App Installable

DevTools → Application → Manifest

- [ ] Manifest is valid (no errors shown)
- [ ] All 8 icon sizes listed (72, 96, 128, 144, 152, 192, 384, 512)
- [ ] Chrome address bar shows an **Install app** (⊕) button
- [ ] Clicking Install shows an install dialog; the app installs to the desktop/taskbar

---

## Lighthouse PWA Audit

Run from the command line (Chrome must not have the tab open while auditing):

```bash
npx lighthouse http://localhost:4302 --only-categories=pwa --chrome-flags="--headless" --output=html --output-path=./lighthouse-pwa.html
open lighthouse-pwa.html
```

Or run from Chrome DevTools: **Lighthouse tab → Categories: PWA only → Analyze page load**

**Expected score:** ≥ 90 (target: 100 for fully compliant PWA)

Categories covered by the audit:
| Criterion | Expected |
|-----------|----------|
| Registers a service worker | ✅ |
| Web app manifest meets installability requirements | ✅ |
| Has a `<meta name="theme-color">` | ✅ |
| Redirects HTTP to HTTPS | N/A (localhost) |
| Works offline | ✅ (app shell cached) |
| Provides a valid `apple-touch-icon` | ✅ (manifest icons) |

---

## Known Limitations (by design)

| Limitation | Reason |
|------------|--------|
| Document bytes not cached by service worker | MinIO presigned URLs expire in 5 min; cached via IndexedDB instead |
| Auth endpoints not cached | Caching login responses would be a security risk |
| Audit log not cached | Must always reflect current server state |
| Max 20 documents in offline cache | Controlled by `MAX_CACHED_DOCS` in `offline-document-cache.service.ts` |
