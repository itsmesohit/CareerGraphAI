# API Documentation — CareerGraph AI

The CareerGraph API provides the backend services for autonomous career graph reasoning, user workspaces, and job applications.

- **Base URL**: `http://localhost:3001/api/v1`
- **Swagger UI**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- **Health Probes**: `http://localhost:3001/api/health` and `http://localhost:3001/api/health/ready`

---

## 1. Authentication & Security (Spec Section 5)

Authentication uses short-lived JWT access tokens (15-minute lifespan) paired with rotating refresh tokens (7-day lifespan) stored in `httpOnly`, `Secure`, `SameSite=Lax` cookies.

### Invariants & Protection Rules
1. **Passwords**: Hashed with **Argon2id** (64MB memory, 3 iterations, 1 parallelism).
2. **OTP Generation**: Cryptographically secure 6-digit numeric codes generated with `crypto.randomInt`.
3. **OTP Storage**: Stored **only as SHA-256 hashes**. Plaintext codes are never stored or logged.
4. **Single-Use & Expiry**: OTPs expire in **10 minutes** and are marked `usedAt` upon consumption.
5. **Lockout Threshold**: Maximum **5 verification attempts** before an OTP is locked out.
6. **Rate Limiting & Cooldown**:
   - **60-second cooldown** between OTP requests for the same email and purpose.
   - Maximum **3 OTP sends per 15 minutes** per email.
   - Maximum **10 OTP sends per 15 minutes** per IP address.
7. **Purposes**: Non-interchangeable: `VERIFY_EMAIL`, `LOGIN`, `RESET_PASSWORD`, `CHANGE_EMAIL`, `SENSITIVE_ACTION`.
8. **Token Rotation & Reuse Detection**:
   - Every refresh exchanges the current refresh token for a brand new token.
   - Presenting a previously revoked or rotated token indicates a **token reuse attack**. The API immediately invalidates **all sessions in that token family**.

---

## 2. Endpoints Reference

### Public Marketing
- `GET /api/v1/marketing/stats`: Aggregate platform counters (candidates, applications sent, active roles, response rate).
- `GET /api/v1/marketing/activity`: Live anonymized feed of application/match telemetry.

### Authentication
- `POST /api/v1/auth/register`: Register new candidate with name, email, and Argon2id password. Dispatches `VERIFY_EMAIL` OTP.
- `POST /api/v1/auth/verify-otp`: Confirms 6-digit code against SHA-256 hash. Returns `{ user, accessToken }` and sets `cg_refresh_token` cookie.
- `POST /api/v1/auth/resend-otp`: Requests a fresh OTP adhering to cooldown and send limits.
- `POST /api/v1/auth/login`: Password login with Argon2id check. Unverified accounts receive a fresh OTP and prompt.
- `POST /api/v1/auth/login/otp-request`: Dispatches passwordless 6-digit login code.
- `POST /api/v1/auth/login/otp-verify`: Verifies passwordless login code and establishes session.
- `POST /api/v1/auth/refresh`: Rotates refresh token from cookie or body. Detects token reuse.
- `POST /api/v1/auth/logout`: Revokes current refresh token and clears cookie.

### Sessions & Identity (Protected via `Authorization: Bearer <token>`)
- `GET /api/v1/auth/me`: Current profile and session details.
- `GET /api/v1/auth/sessions`: List active devices and login sessions.
- `DELETE /api/v1/auth/sessions/:id`: Revoke a specific session.
- `POST /api/v1/auth/sessions/revoke-others`: Terminate all other sessions across devices.

### System Health
- `GET /api/health`: Liveness probe.
- `GET /api/health/ready`: Readiness probe inspecting PostgreSQL (`SELECT 1`) and Redis (`PING`).

---

## 3. Profile & Onboarding Endpoints (Phase 2, Spec Sections 6, 7, 8)

All profile and onboarding endpoints require `Authorization: Bearer <accessToken>`.

### Candidate Profile & Facts
- `GET /api/v1/profile`: Returns full candidate profile with relations (`experiences`, `educations`, `skills`, `projects`, `certifications`, `preferences`, `answers`) and live completeness score.
- `PUT /api/v1/profile`: Updates candidate basic identity and contact (`headline`, `phone`, `locationCity`, `locationCountry`, `linkedinUrl`, `githubUrl`, `portfolioUrl`).
- `GET /api/v1/profile/completeness`: Calculates profile completeness score (0–100%) across 6 categories with specific missing fields and actionable suggestions.

### Experience, Education, Skills & Projects CRUD
- `POST /api/v1/profile/experiences`: Add experience item (`company`, `title`, `startDate`, `endDate`, `metrics`, `technologies`, `source`, `verificationStatus`).
- `PUT /api/v1/profile/experiences/:id`: Update experience item.
- `DELETE /api/v1/profile/experiences/:id`: Delete experience item.
- `POST /api/v1/profile/educations`: Add education credential.
- `PUT /api/v1/profile/educations/:id`: Update education credential.
- `DELETE /api/v1/profile/educations/:id`: Delete education credential.
- `POST /api/v1/profile/skills`: Add skill fact with proficiency and category.
- `DELETE /api/v1/profile/skills/:id`: Delete skill.
- `POST /api/v1/profile/projects`: Add portfolio project with tech stack.
- `DELETE /api/v1/profile/projects/:id`: Delete portfolio project.

### Fact Verification (Side-by-Side Verification Screen)
- `PATCH /api/v1/profile/facts/:factType/:factId/verify`: Toggles verification status (`USER_VERIFIED` vs `UNVERIFIED`) for a specific fact.
- `POST /api/v1/profile/facts/verify-all`: Marks all pending unverified facts across experiences, education, skills, and projects as `USER_VERIFIED` in one click.

### Career Preferences & Automation Strategy
- `GET /api/v1/profile/preferences`: Retrieve candidate preferences and target constraints.
- `PUT /api/v1/profile/preferences`: Update target titles, locations, remote preference, salary range, notice period, and automation mode (`STRICT_APPROVAL`, `BATCH_REVIEW`, `FULL_AUTO`).

### Resume Upload & Intelligence Engine
- `POST /api/v1/resumes/upload`: Multipart upload for `.pdf`, `.docx`, or `.txt` resumes (up to 10MB). Automatically parses raw text via `pdf-parse`/`mammoth`, structures entities with deterministic heuristic extraction + LLM, and populates facts into the candidate profile marked as `UNVERIFIED` for side-by-side user review.

### Canonical Universal Question Bank (150+ Questions)
- `GET /api/v1/questions`: Retrieve canonical universal questions (query parameters: `coreOnly=true` for onboarding pack, `category` for specific sections).
- `GET /api/v1/questions/answers`: Retrieve candidate answers submitted so far.
- `POST /api/v1/questions/answers`: Save or update candidate answers with scope (`GLOBAL`, `PER_COUNTRY`, `PER_COMPANY`, `PER_ROLE_TYPE`).

### Resumable Onboarding Wizard
- `GET /api/v1/onboarding/state`: Retrieves current onboarding step (1 to 5), completion status, and completed steps list.
- `PUT /api/v1/onboarding/state`: Saves wizard progression so candidates can pause and resume onboarding anytime.

### Knowledge Graph & Triple-Tier Memory (Spec Section 11)
- `GET /api/v1/graph/nodes`: Retrieves the candidate's career knowledge subgraph (nodes and connecting edges) filtered strictly by tenant ID.
- `GET /api/v1/graph/stats`: Returns telemetry statistics (engine mode `LIVE` / `IN_MEMORY`, total node/edge counts, breakdown by label and edge type).
- `GET /api/v1/graph/memories`: Retrieves triple-tier memories (`EPISODIC`, `SEMANTIC`, `PROCEDURAL`) with optional `?type=` query parameter filter.
- `POST /api/v1/graph/memories`: Records a new memory node (persisted via Transactional Outbox and projected immediately to FalkorDB / in-memory engine).
- `GET /api/v1/graph/evidence-paths?jobId=<id>`: Multi-hop Cypher traversal returning explainable proof paths (`Candidate -> Experience/Project -> DEMONSTRATES -> Skill <- REQUIRES_SKILL <- Requirement <- REQUIRES <- Job`).
- `POST /api/v1/graph/rebuild`: Triggers complete subgraph reconstruction from PostgreSQL source-of-truth records for the authenticated candidate.
- `POST /api/v1/graph/sync`: Sweeps pending transactional outbox events to sync all pending projections.

### Job Discovery Engine (Spec Section 9 & docs/JOB_SOURCES.md)
- `GET /api/v1/jobs`: Search and filter opportunities with faceted queries (`q`, `company`, `location`, `remoteType`, `seniority`, `minSalary`, `provider`, `status`, `skills`, `page`, `limit`, `sortBy`, `sortOrder`).
- `GET /api/v1/jobs/sources`: Catalog of all 5 registered adapters (Remotive, Greenhouse, Lever, Adzuna, Ashby), their capabilities, rate limits, and health status.
- `POST /api/v1/jobs/discover`: Triggers on-demand discovery cycle across live adapters with deduplication and graph indexing.
- `POST /api/v1/jobs/import-url`: Import job posting from direct URL or pasted card with compliance enforcement (blocks headless scraping on restricted sites).
- `GET /api/v1/jobs/saved-searches`: List candidate's active saved searches.
- `POST /api/v1/jobs/saved-searches`: Create custom saved search.
- `POST /api/v1/jobs/saved-searches/auto-generate`: Auto-generate saved searches from candidate profile preferences.
- `DELETE /api/v1/jobs/saved-searches/:id`: Delete a saved search.
- `GET /api/v1/jobs/:id`: Retrieve detailed job posting with extracted requirements breakdown.
- `POST /api/v1/jobs/:id/verify-freshness`: Re-verify if job listing is still live (marks `CLOSED` on 404/410).

### Deterministic Matching Engine (Spec Section 10)
- `GET /api/v1/matches/jobs/:jobId`: Computes explainable deterministic match evaluation for a single job against authenticated candidate (signals: verified skills, preferred skills, seniority, title similarity, location, compensation, hard constraint filters, and multi-hop Cypher evidence paths).
- `GET /api/v1/matches/top`: Computes and ranks candidate's top matched jobs from the open opportunities feed (`?limit=12&excludeEliminated=true&minScore=60`).
- `POST /api/v1/matches/recalculate`: Recalculates match scoring with custom candidate/organization weights.

### Application Lifecycle & Human-in-the-Loop (Spec Sections 12, 13, 14, 15)
- `GET /api/v1/applications`: Lists applications for Kanban, Table, and Calendar views (`?stage=APPLIED&q=Stripe`).
- `POST /api/v1/applications`: Initializes an application pipeline or saves job (`{ jobId, mode, notes }`).
- `GET /api/v1/applications/:id`: Retrieves full application detail with audit events, interview schedules, and packet.
- `PATCH /api/v1/applications/:id/stage`: Updates pipeline stage (Kanban drag-and-drop or manual status transition: `SAVED`, `PREPARING`, `APPLIED`, `SCREENING`, `INTERVIEWING`, `OFFERED`, `REJECTED`, `WITHDRAWN`).
- `POST /api/v1/applications/:id/prepare`: Orchestrates resume tailoring, cover letter drafting, and question answering.
- `GET /api/v1/applications/:id/packet`: Generates copyable manual application packet (Spec §13 channel E).
- `POST /api/v1/applications/:id/interviews`: Schedules an interview round (`{ roundName, roundType, scheduledAt, durationMinutes, meetingLink, interviewerNames }`).
- `POST /api/v1/applications/:id/notes`: Adds timestamped candidate notes or recruiter contact information.
- `GET /api/v1/missing-info`: Lists pending missing information requests across applications.
- `POST /api/v1/missing-info/:id/resolve`: Submits answer with scope (`GLOBAL`, `PER_COMPANY`, `PER_ROLE_TYPE`), persists to universal question bank and graph memory, and resumes application workflow.
- `POST /api/v1/missing-info/:id/skip`: Skips an optional question item.
- `GET /api/v1/approvals`: Lists all applications awaiting candidate approval (`AWAITING_APPROVAL`).
- `POST /api/v1/approvals/:id/approve`: Validates cryptographic SHA-256 `contentHash`, marks application approved, records episodic memory, and transitions to submitted.
- `POST /api/v1/approvals/:id/reject`: Rejects or cancels draft application.
- `POST /api/v1/approvals/bulk-approve`: Bulk approves multiple applications with per-item content-hash validation.

### Assisted Apply & Automation Channels (Phase 7, Spec Sections 16, 17)
- `GET /api/v1/automation/payload/:applicationId`: Retrieves grounded autofill payload for the Chrome MV3 Extension or Playwright runner, verified with SHA-256 `contentHash`.
- `POST /api/v1/automation/submit-playwright`: Server-side headless browser submission runner with `Idempotency-Key` header, anti-bot/CAPTCHA circuit breakers halting into `NEEDS_INTERVENTION`, and procedural memory logging.
- `POST /api/v1/automation/report-status`: Reports completion or interaction status from Chrome Extension side panel / content script (`SUBMITTED`, `FAILED`, `NEEDS_INTERVENTION`).
- `POST /api/v1/automation/procedural-memory`: Records learned ATS field selectors back to FalkorDB and PostgreSQL procedural memory.

### Email Integration & Recruiter Outreach (Phase 8, Spec Sections 14, 16, 24)
- `GET /api/v1/integrations`: Lists active mail and calendar integrations for the authenticated candidate (tokens never exposed in plaintext).
- `GET /api/v1/integrations/oauth-url/:provider`: Generates OAuth 2.0 authorization URL with minimal scopes (`gmail.send`, `gmail.readonly`, `Mail.Send`, etc.) and cryptographic state verification.
- `POST /api/v1/integrations/oauth-callback`: Exchanges OAuth authorization code, encrypts tokens using AES-256-GCM envelope encryption (DEK + Master KEK), and persists integration.
- `POST /api/v1/integrations/connect-manual`: Configures manual or test integration credentials.
- `DELETE /api/v1/integrations/:id`: Disconnects integration and cryptographically purges tokens and encryption keys.
- `GET /api/v1/outreach`: Lists recruiter outreach drafts with status, recipient, and timestamps.
- `POST /api/v1/outreach/generate`: Generates grounded cold outreach message using candidate graph facts with computed SHA-256 `contentHash`.
- `GET /api/v1/outreach/quota`: Inspects daily outreach rate limit (25 sends/day quota).
- `PATCH /api/v1/outreach/:id`: Edits outreach draft subject or body (automatically invalidates previous approvals and updates `contentHash`).
- `POST /api/v1/outreach/:id/approve`: Cryptographically locks draft approval against exact SHA-256 `contentHash`.
- `POST /api/v1/outreach/:id/send`: Dispatches approved outreach via connected mailbox (Gmail API / Microsoft Graph), verifies content-hash integrity, enforces daily quota, appends anti-spam footer, and records episodic memory.
- `GET /api/v1/inbound-emails`: Lists inbound mailbox email events with categorization and application associations.
- `POST /api/v1/inbound-emails/classify`: Deterministically classifies incoming email text (`APPLICATION_ACKNOWLEDGED`, `INTERVIEW_INVITATION`, `OFFER_RECEIVED`, `REJECTION`), auto-matches applications, and auto-advances pipeline stages when confidence threshold is satisfied.
- `POST /api/v1/inbound-emails/:id/resolve`: Manually resolves an inbound email event, optionally applying suggested status transitions.
- `GET /api/v1/interviews`: Lists candidate interview rounds across applications.
- `POST /api/v1/interviews`: Schedules an interview round, automatically generates round-type specific preparation questions, and optionally synchronizes to calendar.
- `PATCH /api/v1/interviews/:id`: Updates interview details, status, or notes.
- `GET /api/v1/interviews/:id/ics`: Exports RFC 5545 compliant `.ics` iCalendar file with meeting alarms and video call links.

### Plans, Billing & Metering (Phase 9, Spec Sections 19, 20, 21)
- `GET /api/v1/billing/plans`: Lists all active subscription plans, pricing, intervals, and structured entitlement limits (`?tier=INDIVIDUAL`).
- `GET /api/v1/billing/subscription`: Retrieves candidate's active subscription, status (`ACTIVE`, `TRIALING`, `CANCELING`), renewal dates, and plan details.
- `POST /api/v1/billing/checkout`: Creates a checkout session for plan upgrade or purchase with optional corporate GSTIN/legal entity metadata.
- `POST /api/v1/billing/verify-payment`: Verifies payment signature (HMAC-SHA256), activates subscription, and generates a GST tax invoice.
- `POST /api/v1/billing/cancel`: Schedules subscription cancellation at current period end (`?atPeriodEnd=true`).
- `POST /api/v1/billing/reactivate`: Reactivates a pending cancelled subscription before period expiration.
- `GET /api/v1/billing/usage`: Real-time quota telemetry and usage meters for discovery runs, applications prepared, auto-applies, tailored resumes, outreach emails, and AI tokens.
- `POST /api/v1/billing/usage/record`: Atomically increments usage resource consumption.
- `GET /api/v1/billing/invoices`: Lists candidate's paid and draft invoices with tax amounts and status.
- `GET /api/v1/billing/invoices/:id`: Retrieves single invoice details.
- `GET /api/v1/billing/invoices/:id/download`: Renders and serves downloadable, printable HTML GST Tax Invoice (with SAC 998314 and 18% GST calculation).
- `POST /api/v1/billing/webhooks/razorpay`: Public webhook endpoint verifying Razorpay HMAC signatures, executing idempotent subscription activations, and recording event ledger.
- `POST /api/v1/billing/webhooks/stripe`: Public webhook endpoint verifying Stripe signatures and processing subscription events.


