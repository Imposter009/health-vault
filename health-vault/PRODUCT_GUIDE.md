# Health Vault — Product Guide

> A personal health and medical record vault. Secure, private, always yours.

---

## Table of Contents

1. [What Is Health Vault?](#1-what-is-health-vault)
2. [Who Is It For?](#2-who-is-it-for)
3. [The Problem It Solves](#3-the-problem-it-solves)
4. [Key Features](#4-key-features)
5. [How to Use Health Vault — Step by Step](#5-how-to-use-health-vault--step-by-step)
   - [Creating Your Account](#step-1-creating-your-account)
   - [Logging In](#step-2-logging-in)
   - [Tracking Health Metrics](#step-3-tracking-health-metrics)
   - [Viewing Your Health Dashboard](#step-4-viewing-your-health-dashboard)
   - [Uploading Medical Documents](#step-5-uploading-medical-documents)
   - [Viewing and Downloading Documents](#step-6-viewing-and-downloading-documents)
   - [Automatic Data Extraction from Documents](#step-7-automatic-data-extraction-from-documents)
   - [Viewing Your Activity Log](#step-8-viewing-your-activity-log)
6. [Security and Privacy](#6-security-and-privacy)
7. [Feature Summary Table](#7-feature-summary-table)
8. [Frequently Asked Questions](#8-frequently-asked-questions)

---

## 1. What Is Health Vault?

**Health Vault** is a secure, self-hosted personal health management platform. It gives individuals a single private place to:

- Store and organise medical documents (lab reports, prescriptions, imaging, discharge summaries)
- Track health metrics over time (blood pressure, blood glucose, weight, cholesterol, etc.)
- Visualise health trends through charts and dashboards
- Automatically extract health readings from uploaded documents using OCR (optical character recognition)
- See a complete audit trail of every action performed on their account

Think of it as a **personal medical record vault** — the digital equivalent of a locked filing cabinet for your health data, but searchable, visual, and accessible from any device.

---

## 2. Who Is It For?

| User | How They Benefit |
|------|-----------------|
| **Individuals managing chronic conditions** | Centralised tracking of blood glucose, blood pressure, or cholesterol across multiple visits and labs |
| **Families caring for elderly relatives** | Secure document store for prescriptions, discharge letters, and care plans |
| **People who see multiple specialists** | One place to bring all reports — no more hunting through email attachments |
| **Health-conscious individuals** | Long-term trend charts showing how lifestyle changes affect key health markers |
| **Anyone who wants data privacy** | Self-hosted — your health data never touches a third-party cloud you don't control |

---

## 3. The Problem It Solves

Most people manage health records the same way they did 20 years ago: a folder of paper documents, PDFs scattered across email, screenshots in a phone camera roll. The result:

- **Lost records** — can't find the blood test result from six months ago
- **No trend visibility** — each GP or specialist only sees a snapshot; no one sees the full picture
- **Privacy risk** — records forwarded over email, stored in consumer cloud drives
- **Manual re-entry** — typing numbers from lab reports into spreadsheets to see trends
- **No audit trail** — no way to know who accessed what, or when

Health Vault addresses all five problems in a single platform.

---

## 4. Key Features

### Secure Account Management
- Email + password registration with full JWT-based authentication
- Short-lived access tokens (15 minutes) with long-lived rotating refresh tokens (30 days)
- Explicit logout invalidates your session immediately — no lingering access

### Health Metric Tracking
- Log readings manually for any of the supported metric types:
  - Blood pressure (systolic/diastolic)
  - Blood glucose
  - Weight and BMI
  - Body temperature
  - Heart rate / SpO₂
  - Cholesterol (total, LDL, HDL, triglycerides)
- Add a timestamp and optional notes to each reading
- Edit or delete any reading

### Health Dashboard
- Line and bar charts showing metric trends over time (powered by Chart.js)
- Filter by metric type and date range
- Aggregated averages, highs, and lows per period (daily / weekly / monthly)

### Medical Document Vault
- Upload PDFs, JPEGs, and PNGs (up to 25 MB per file)
- Documents are stored securely in MinIO object storage
- Original filename is encrypted at rest (AES-256-GCM) — even a database breach does not reveal your filenames
- Categories: **Lab Report**, **Prescription**, **Imaging**, **Discharge Summary**, **Insurance**, **Other**
- View PDFs inline or download via a time-limited secure link (valid 5 minutes)

### Automatic Health Data Extraction (OCR)
- When you upload a document, Health Vault automatically reads it in the background
- Numeric health values (e.g. "Glucose: 5.4 mmol/L", "BP: 128/84") are extracted and added to your metric history automatically
- Works on embedded-text PDFs immediately; works on scanned images when Tesseract OCR is installed
- No waiting — the upload completes instantly and extraction happens asynchronously

### Activity & Access Log
- Every sensitive action on your account is recorded: logins, logouts, document uploads, views, deletes, metric changes
- You can view your own activity log at any time from your profile
- Filter by event type (e.g. "show me all document access events") or date range
- Failed login attempts are also recorded — you can see if someone has been trying to access your account

### API Gateway with Rate Limiting
- All requests pass through a gateway that enforces rate limits
- Login endpoint: maximum 5 attempts per minute per IP (brute-force protection)
- Document upload: rate-limited per user to prevent abuse
- Returns a clear error message if a limit is reached

---

## 5. How to Use Health Vault — Step by Step

### Step 1: Creating Your Account

1. Open Health Vault in your browser (e.g. `http://localhost:4299` in local deployment)
2. Click **Register** or navigate to `/register`
3. Enter your **full name**, **email address**, and a **strong password**
4. Click **Create Account**
5. You will be taken directly to your profile page — no email verification required for initial setup

> Your password is stored as a salted hash (bcrypt) — Health Vault never stores your password in plain text.

---

### Step 2: Logging In

1. Navigate to the **Login** page (`/login`)
2. Enter your email and password
3. Click **Sign In**

You will receive two tokens:
- **Access token** — used for all API requests; expires in 15 minutes
- **Refresh token** — used to get a new access token; expires in 30 days

The app handles token refresh automatically in the background. You will not be asked to log in again until your refresh token expires.

**Signing out:** Click **Sign Out** on the profile page. This immediately invalidates your session — your access token is blacklisted and your refresh token is revoked.

> **Security note:** If you log in from a new device or browser, the previous session remains active until its tokens expire. Session management across devices is planned for a future release.

---

### Step 3: Tracking Health Metrics

**To log a new metric:**

1. From your profile page, click **My Metrics**
2. Click **Add Metric** (or navigate to `/metrics/new`)
3. Select the **metric type** (e.g. Blood Pressure, Weight, Blood Glucose)
4. Enter the **value(s)** — for blood pressure, enter systolic and diastolic separately
5. Set the **date and time** of the reading (defaults to now)
6. Optionally add **notes** (e.g. "after morning walk", "fasting")
7. Click **Save**

**To view all your metrics:**

1. Click **My Metrics** from the profile page
2. Use the **filters** at the top to narrow by metric type or date range
3. Metrics are shown as a paginated list, newest first

**To edit or delete a metric:**

- Click on any metric entry to open it
- Use **Edit** to update the value, date, or notes
- Use **Delete** to remove it (soft delete — the entry is hidden but recoverable by admins if needed)

---

### Step 4: Viewing Your Health Dashboard

1. From the profile page, click **Dashboard**
2. The dashboard shows **line charts** for each metric type that has data
3. Use the **date range selector** to zoom into a period (e.g. last 30 days, last 6 months)
4. Hover over any point on a chart to see the exact value and date
5. Use the **metric type filter** to focus on one type at a time

**What the dashboard tells you:**

| Chart feature | What it shows |
|---|---|
| Line chart | Individual readings plotted over time |
| Average line | Rolling average — useful for spotting trends |
| Highlighted range | Min/max band for the selected period |

> **Tip:** If you have uploaded lab reports and the OCR extraction has completed, those readings appear on the dashboard automatically — you don't need to enter them manually.

---

### Step 5: Uploading Medical Documents

1. From the profile page, click **Documents**
2. Click **Upload Document**
3. Select a file from your device (PDF, JPEG, or PNG; maximum 25 MB)
4. Choose a **category** from the dropdown:
   - Lab Report
   - Prescription
   - Imaging
   - Discharge Summary
   - Insurance
   - Other
5. Click **Upload**

The upload completes immediately. The document appears in your list with status **Uploaded**.

In the background, Health Vault begins reading the document to extract any health metric values. The status changes to **Processing** and then to **Processed** when complete. If no metrics could be extracted, it shows **Processed (0 metrics found)**.

**Supported file types:**

| Type | Extension | Notes |
|---|---|---|
| PDF | `.pdf` | Embedded text extracted instantly; scanned-image PDFs require Tesseract OCR |
| JPEG | `.jpg`, `.jpeg` | Processed via OCR |
| PNG | `.png` | Processed via OCR |

> **Size limit:** 25 MB per file. Split large multi-page scans into smaller files if needed.

---

### Step 6: Viewing and Downloading Documents

**To view your documents:**

1. Click **Documents** from the profile page
2. All your uploaded documents are listed, newest first
3. Use the **category filter** or **status filter** to narrow the list

**To view a document inline (PDF viewer):**

1. Click the document name or the **View** button
2. PDFs open in a full-screen viewer inside the app
3. Images open with zoom controls

**To download a document:**

1. Click **Download** on any document
2. A secure, time-limited link is generated (valid for 5 minutes)
3. The file downloads directly from storage

> **Privacy:** Download links expire automatically after 5 minutes and cannot be reused. Each click on Download generates a fresh link.

**To delete a document:**

1. Click **Delete** on the document you want to remove
2. Confirm the deletion
3. The document is removed from your list and permanently deleted from storage

> **Note:** Deletion is immediate and permanent for the stored file. The metadata entry (that a document existed) is retained for audit purposes but the actual file bytes are erased.

---

### Step 7: Automatic Data Extraction from Documents

When you upload a lab report or clinical document, Health Vault reads it automatically and looks for recognisable health values.

**What gets extracted:**

| Value type | Example text it recognises | Metric type created |
|---|---|---|
| Blood glucose | `Glucose: 5.4 mmol/L` | Blood Glucose |
| Blood pressure | `BP: 128/84 mmHg` | Blood Pressure |
| Total cholesterol | `Total Cholesterol: 5.2 mmol/L` | Cholesterol |
| Heart rate | `HR: 72 bpm` | Heart Rate |
| Weight | `Weight: 74.5 kg` | Weight |

**How to check extraction status:**

1. Open the document list
2. The **Status** column shows the extraction state:
   - `Uploaded` — document received, extraction not yet started
   - `Processing` — OCR is running
   - `Processed` — complete; check the metric count shown
   - `Failed` — extraction encountered an error (the upload is still safe; extraction can be retried)

**After extraction:** Any values found appear in your **My Metrics** list and on the **Dashboard** automatically, labelled with source = *Document*.

> **Tip:** For best results, upload the original PDF from your lab rather than a photo. Embedded-text PDFs extract instantly and with 100% accuracy; photographed documents depend on image quality.

---

### Step 8: Viewing Your Activity Log

The activity log is a complete, tamper-evident record of everything that has happened on your account.

**To view your activity log:**

1. From the profile page, click **Activity & Access Log**
2. Your events are grouped by day, newest first

**What events are recorded:**

| Event | When it appears |
|---|---|
| Signed in | Every successful login |
| Failed sign-in attempt | Every failed login attempt (wrong password or unknown email) |
| Signed out | Every explicit logout |
| Account created | When you registered |
| Document uploaded | Every file upload |
| Document viewed | Every time a download link is generated (i.e. you viewed or downloaded a file) |
| Document deleted | Every file deletion |
| Health metric added | Every new manual metric entry |
| Health metric updated | Every edit to an existing metric |
| Health metric deleted | Every metric deletion |

**Filtering your log:**

- Use the **Event type** dropdown to see only one category (e.g. all document access events)
- Use the **From** and **To** date pickers to see a specific period
- Click **Clear** to reset all filters

**What to look for:**

- A `Failed sign-in attempt` entry that you don't recognise means someone tried to log into your account with the wrong password
- A `Document viewed` entry at a time when you were not using the app may indicate unexpected access
- Entries are shown with the originating IP address — if a known event shows an unexpected IP, investigate

> **Privacy:** You can only see your own activity log. No other user or standard account can see your events.

---

## 6. Security and Privacy

### How your data is protected

| Protection | How it works |
|---|---|
| **Passwords** | Stored as bcrypt hashes with a cost factor of 10 — irreversible even if the database is breached |
| **Session tokens** | Short-lived JWT access tokens (15 min) + rotating refresh tokens (30 days) stored as SHA-256 hashes |
| **Logout** | Access token is immediately blacklisted in Redis; refresh token is revoked in the database |
| **Document filenames** | Encrypted with AES-256-GCM before storage — a database breach does not reveal your filenames |
| **Document files** | Stored in an isolated object storage bucket (MinIO); accessible only via time-limited presigned URLs |
| **Document URLs** | Expire in 5 minutes and are single-use equivalent — each Download click generates a fresh URL |
| **OCR-extracted text** | Encrypted before storage in the database |
| **Rate limiting** | Login attempts are rate-limited by IP — 5 attempts per minute; upload requests are rate-limited per user |
| **Audit trail** | Every sensitive action is recorded in an immutable audit log |
| **File type validation** | Server re-detects MIME type from file content (Apache Tika) — renaming a `.exe` to `.pdf` is rejected |

### Self-hosted = your data, your control

Health Vault is designed to run on infrastructure you control. Your health data does not pass through any third-party cloud service unless you configure it that way (e.g. using AWS S3 instead of local MinIO). There is no analytics, no telemetry, and no data sharing.

### What Health Vault does not currently provide

- Multi-user sharing / access grants (planned for a future release)
- End-to-end encryption between browser and server (standard TLS is assumed; add a TLS-terminating reverse proxy in front for production)
- Two-factor authentication (planned)
- Regulatory compliance certification (HIPAA, ISO 27001) — the design follows best practices but has not been audited by a third party

---

## 7. Feature Summary Table

| Feature | Available Now | Notes |
|---------|:-------------:|-------|
| Account registration and login | ✅ | |
| JWT session management with refresh tokens | ✅ | |
| Secure logout (token blacklisting) | ✅ | |
| Manual health metric logging | ✅ | |
| Health dashboard with trend charts | ✅ | |
| Medical document upload (PDF, JPEG, PNG) | ✅ | Up to 25 MB |
| AES-256-GCM filename encryption at rest | ✅ | |
| Document inline viewer | ✅ | |
| Time-limited secure download links | ✅ | 5-minute TTL |
| Automatic health metric extraction from documents | ✅ | OCR via Apache Tika |
| Audit trail (activity & access log) | ✅ | |
| Rate-limited API gateway | ✅ | |
| Document sharing with other users | 🔜 | Planned — Phase 6 |
| Two-factor authentication | 🔜 | Planned |
| Mobile PWA offline support | 🔜 | Planned — Phase 7 |
| Push notifications (document processed, etc.) | 🔜 | Planned — Phase 7 |

---

## 8. Frequently Asked Questions

**Q: Can I access Health Vault from my phone?**  
A: Yes. The Angular frontend is a Progressive Web App (PWA) that is responsive and works in mobile browsers. Full offline support is planned for a future release.

**Q: What happens if I upload a document and OCR extraction fails?**  
A: The document is safely stored regardless. The status shows `Failed` for the extraction step only. You can still view and download the document. Manual metric entry is always available as a fallback.

**Q: Can I export my data?**  
A: Data export is not yet a built-in feature. As a workaround, the API endpoints (`GET /api/metrics`, `GET /api/documents`) can be called directly with your access token to retrieve all your data as JSON. A one-click export feature is planned.

**Q: Is there a limit on how many documents I can store?**  
A: No application-level limit. Practical limits depend on the storage capacity of the MinIO instance (or S3 bucket) configured by whoever is hosting it.

**Q: What happens to my data if I delete my account?**  
A: Account deletion is not yet available through the UI — it is performed by an administrator. When an account is deleted, the database row is removed and all associated documents are deleted from storage. The audit log retains entries with a null user ID (the link between the log and the user is severed).

**Q: Can someone else see my documents or metrics?**  
A: No. Every data query is filtered by your user ID, which is sourced from your validated JWT — it cannot be spoofed through request parameters. Your data is invisible to other accounts.

**Q: What if I forget my password?**  
A: Password reset is not yet available through the UI. An administrator can reset the password directly in the database. Self-service password reset (via email link) is planned.

**Q: How do I know if someone has accessed my account without my knowledge?**  
A: Check your **Activity & Access Log** from the profile page. Failed login attempts and all document access events are recorded with timestamps and IP addresses.

---

*Health Vault Product Guide — v1.5 (Phases 0–5)*  
*Last updated: August 2026*
