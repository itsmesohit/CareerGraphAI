# Implementation Plan & Phase Checklists — CareerGraph AI

This plan tracks the 12 build phases outlined in [PRODUCT_SPEC.md](PRODUCT_SPEC.md). It is updated at the conclusion of each phase.

---

## Phase 1: Foundation (Completed)
*Spec references: Section 3 (Entities, System of Record, Data Stores), Section 4 (Multi-tenancy & Roles), Section 5 (Authentication & Account Security), Section 11 (Development Rules & Monorepo Structure)*

- [x] **Docs & ADRs**
  - [x] Create `docs/PLAN.md` (Checklists for Phases 1–12)
  - [x] Create `docs/DECISIONS.md` with ADR-001 (Monorepo), ADR-002 (Homebrew services vs Docker), ADR-003 (Auth & OTP Security), ADR-004 (Dual-store Outbox)
  - [x] Create `docs/BLOCKERS.md` with credential safety findings & service availability
- [x] **Monorepo Scaffold**
  - [x] Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.env.example`, `.env`
  - [x] `infra/docker-compose.yml` & `.github/workflows/ci.yml`
  - [x] `packages/shared`: Common Zod schemas, DTOs, enums (Auth, Roles, OTP purposes), errors
  - [x] `packages/db`: Prisma schema with PostgreSQL, client export, migrations, seed
  - [x] `apps/api`: Express + TypeScript, Zod env validation, middleware (CORS, Helmet, CSRF, rate-limit, auth), OpenAPI docs
  - [x] `apps/worker`: BullMQ worker skeleton connected to Redis
  - [x] `apps/web`: React + Vite + TypeScript + Tailwind CSS + TanStack Query + React Router app shell
- [x] **Authentication & Security (Spec Section 5)**
  - [x] Sub-task 1.1: Argon2id password hashing with strength validation
  - [x] Sub-task 1.2: 6-digit numeric OTP generation (`crypto.randomInt`)
  - [x] Sub-task 1.3: OTP storage as SHA-256 hash, 10-minute expiry, single-use enforcement
  - [x] Sub-task 1.4: Rate limits: max 5 verification attempts, max 3 sends per 15 min per email & IP, 60s cooldown
  - [x] Sub-task 1.5: Distinct OTP purposes: `VERIFY_EMAIL`, `LOGIN`, `RESET_PASSWORD`, `CHANGE_EMAIL`, `SENSITIVE_ACTION`
  - [x] Sub-task 1.6: JWT access token (15m) + rotating refresh token (7d) in `httpOnly` cookie with token-family reuse detection
  - [x] Sub-task 1.7: Device & active session tracking with "log out other devices"
  - [x] Sub-task 1.8: Mail delivery interface: Mailpit for local development, Resend / SMTP in production
  - [x] Sub-task 1.9: OpenAPI 3.0 specification & Swagger UI at `/api/docs`
  - [x] Sub-task 1.10: Health endpoints `/api/health` and `/api/health/ready`
- [x] **Frontend App Shell & Design System**
  - [x] Sub-task 1.11: Public marketing landing page with live platform statistics & activity ticker
  - [x] Sub-task 1.12: Registration with real-time validation & OTP entry step
  - [x] Sub-task 1.13: Login (password & passwordless OTP)
  - [x] Sub-task 1.14: Session dashboard (view active devices, logout current / other sessions)
  - [x] Sub-task 1.15: Dynamic responsive navigation bar with authenticated state
- [x] **Testing & Quality Assurance**
  - [x] Sub-task 1.16: Unit & integration tests (Vitest + Supertest) for:
    - User registration → OTP send → verify → login
    - OTP expiration & attempt limit lockout
    - Resend rate limit & cooldown enforcement
    - Refresh token rotation & reuse revocation
  - [x] Sub-task 1.17: Typecheck, lint, and full test suite passing cleanly

---

## Phase 2: Profile & Onboarding (Completed)
*Spec references: Section 6 (Onboarding & Candidate Profile), Section 7 (Universal Application Question Bank), Section 8 (Document & Resume Intelligence)*

- [x] **Data Model & Migrations (packages/db & packages/shared)**
  - [x] Sub-task 2.1: Extend Prisma schema for Candidate Profile (`Profile`, `Experience`, `Education`, `Skill`, `Project`, `Certification`, `Preferences`, `OnboardingState`) with fact source, verification status (`UNVERIFIED`, `USER_VERIFIED`, `SUPERSEDED`), and timestamps
  - [x] Sub-task 2.2: Add `CanonicalQuestion` and `CandidateAnswer` models (scope, variants, sensitivity)
  - [x] Sub-task 2.3: Shared Zod schemas & DTOs for parsed resume extraction, profile CRUD, questions, and completeness score
  - [x] Sub-task 2.4: Seed canonical universal question bank (150+ realistic job application questions across 10 categories)
- [x] **Resume Parsing & Intelligence Engine (apps/api)**
  - [x] Sub-task 2.5: Multipart upload endpoint (`/api/v1/resumes/upload`) with type/size validation (PDF, DOCX)
  - [x] Sub-task 2.6: PDF & DOCX text extraction pipeline (`pdf-parse`, `mammoth`)
  - [x] Sub-task 2.7: LLM structured extraction service with robust deterministic fallback for zero-dependency operation
- [x] **Profile & Question Bank API (apps/api)**
  - [x] Sub-task 2.8: Profile CRUD endpoints (`GET/PUT /api/v1/profile`, experiences, education, skills, projects, preferences)
  - [x] Sub-task 2.9: Fact verification mutation (`PATCH /api/v1/profile/facts/:id/verify`)
  - [x] Sub-task 2.10: Question bank retrieval and answer submission (`GET /api/v1/questions`, `POST /api/v1/questions/answers`)
  - [x] Sub-task 2.11: Onboarding state persistence (`GET/PUT /api/v1/onboarding/state`)
  - [x] Sub-task 2.12: Profile completeness calculator & actionable suggestions engine (`GET /api/v1/profile/completeness`)
- [x] **Frontend Onboarding & Profile UI (apps/web)**
  - [x] Sub-task 2.13: Resumable 5-step Onboarding Wizard (Upload Resume → Side-by-side Fact Review → Job Preferences → Core Question Pack → Automation Mode)
  - [x] Sub-task 2.14: Side-by-side Resume Review screen (raw text/preview vs extracted UNVERIFIED facts with 1-click verification)
  - [x] Sub-task 2.15: Profile management workspace (view and edit all sections with completeness meter & suggestions)
  - [x] Sub-task 2.16: Interactive Question Bank explorer with scoped answers
- [x] **Testing & Quality Assurance**
  - [x] Sub-task 2.17: Vitest & Supertest suite for resume parsing, fact extraction, verification flow, question answering, and completeness scoring
  - [x] Sub-task 2.18: Typecheck, lint, and full test suite passing cleanly

---

## Phase 3: Graph Memory & Outbox Projection (Completed)
*Spec references: Section 9 (Dual Store Pattern), Section 10 (Transactional Outbox), Section 11 (FalkorDB Graph Memory & Triple-Tier Memory)*

- [x] **Graph Database Client & Engine (packages/db)**
  - [x] Sub-task 3.1: FalkorDB client manager with dual-mode support (Live FalkorDB socket probe + in-memory Cypher engine fallback)
  - [x] Sub-task 3.2: Comprehensive in-memory Cypher engine supporting node/edge indexing, parameterized MERGE/MATCH/CREATE, multi-hop path traversals, cross-process Redis cache backing, and tenant filtering
  - [x] Sub-task 3.3: Typed Cypher query builders & traversal tools (Candidate, Experience, Skill, Project, Evidence, Job, Requirement)
  - [x] Sub-task 3.4: Triple-Tier memory model implementation (`EPISODIC`, `SEMANTIC`, `PROCEDURAL`) with provenance, verification status, and expiry
- [x] **Transactional Outbox Architecture (packages/db & apps/api)**
  - [x] Sub-task 3.5: Transactional outbox emitter service (`outboxService.ts`) creating atomic `OutboxEvent` records on all profile/fact mutations
  - [x] Sub-task 3.6: Integrate outbox emission into profile service (profile update, experience, education, skills, projects, certifications, verification status toggles)
- [x] **Idempotent Graph Projection Worker (apps/worker)**
  - [x] Sub-task 3.7: BullMQ projection processor consuming `outbox-projections` queue
  - [x] Sub-task 3.8: Idempotent event projector translating each `OutboxEvent` into Cypher graph operations with state tracking (`PENDING` → `PROCESSED` / `FAILED`)
  - [x] Sub-task 3.9: Recurring outbox sweeper to ensure zero lost events even if Redis reconnects
- [x] **Graph Memory API & Multi-Hop Operations (apps/api)**
  - [x] Sub-task 3.10: Candidate Graph endpoints (`GET /api/v1/graph/nodes`, `GET /api/v1/graph/stats`, `GET /api/v1/graph/evidence-paths`)
  - [x] Sub-task 3.11: Triple-Tier Memory CRUD endpoints (`GET/POST /api/v1/graph/memories`)
  - [x] Sub-task 3.12: Full Graph Rebuild endpoint & CLI tool (`POST /api/v1/graph/rebuild` and `pnpm --filter @careergraph/db db:graph-rebuild`)
- [x] **Frontend Knowledge Graph Explorer (apps/web)**
  - [x] Sub-task 3.13: Interactive Graph Visualization screen (`/graph`) displaying candidate nodes, skills, roles, and proof edges
  - [x] Sub-task 3.14: Triple-tier memory viewer and multi-hop match explanation paths panel
- [x] **Testing & Quality Assurance**
  - [x] Sub-task 3.15: Automated integration tests (`apps/api/src/tests/graph_memory.test.ts`) covering outbox events, graph projections, triple-tier memory, multi-hop queries, and tenant isolation
  - [x] Sub-task 3.16: Typecheck, lint, and full monorepo test suite passing cleanly

---

## Phase 4: Job Discovery Engine (Completed)
*Spec references: Section 9 (Job Discovery Engine), Section 10 (Matching Engine Inputs), docs/JOB_SOURCES.md*

- [x] **Data Model & Shared Schemas (packages/db & packages/shared)**
  - [x] Sub-task 4.1: Prisma schema expansion with `JobPosting`, `JobRequirement`, `SavedSearch`, and associated enums (`JobSourceProvider`, `JobPostingStatus`, `JobRemoteType`, `SeniorityLevel`)
  - [x] Sub-task 4.2: Shared TypeScript types, interfaces, and Zod schemas (`JobSourceCapabilities`, `JobSearchQuery`, `NormalizedJob`, `JobFilterQuerySchema`, `JobUrlImportSchema`, `SavedSearchSchema`)
- [x] **JobSource Interface & Live Board Adapters (apps/api & apps/worker)**
  - [x] Sub-task 4.3: Canonical `JobSource` interface (`searchJobs`, `getJobDetails`, `normalizeJob`, `getCapabilities`, `healthCheck`)
  - [x] Sub-task 4.4: Remotive live adapter connecting to `https://remotive.com/api/remote-jobs`
  - [x] Sub-task 4.5: Greenhouse public boards adapter with curated tech company board registry (Stripe, Figma, Cloudflare, GitLab, etc.)
  - [x] Sub-task 4.6: Lever public postings adapter with curated board registry
  - [x] Sub-task 4.7: Adzuna adapter with environment credential awareness (`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`) and graceful degraded state
  - [x] Sub-task 4.8: Direct URL import & HTML/JSON-LD extractor with user-pasted description fallback (no prohibited scraping of LinkedIn/Indeed)
- [x] **Ingestion, Normalization & Deduplication Pipeline**
  - [x] Sub-task 4.9: Multi-tier deduplication pipeline (Provider ID -> Normalized URL -> SHA-256 fingerprint of `lower(company):lower(title):lower(location)`)
  - [x] Sub-task 4.10: Deterministic requirement extraction & caching (required vs preferred skills, hard constraints, weights)
  - [x] Sub-task 4.11: Graph outbox integration (`JOB_INGESTED` / `JOB_UPDATED` projected to FalkorDB / in-memory graph)
- [x] **Job Discovery API & Saved Searches (apps/api)**
  - [x] Sub-task 4.12: Job feed endpoints (`GET /api/v1/jobs`, `GET /api/v1/jobs/:id`) with faceted search, pagination, and sorting
  - [x] Sub-task 4.13: Job import & discovery triggers (`POST /api/v1/jobs/import-url`, `POST /api/v1/jobs/discover`)
  - [x] Sub-task 4.14: Saved searches CRUD & auto-generation from candidate profile preferences (`/api/v1/jobs/saved-searches`)
  - [x] Sub-task 4.15: Source catalog & health telemetry endpoint (`GET /api/v1/jobs/sources`)
  - [x] Sub-task 4.16: Listing freshness re-verification endpoint (`POST /api/v1/jobs/:id/verify-freshness`)
- [x] **Frontend Job Discovery Feed (apps/web)**
  - [x] Sub-task 4.17: Responsive Job Feed page (`/jobs`) with keyword search, multi-select filters (Remote, Seniority, Min salary, Provider), and job cards
  - [x] Sub-task 4.18: Job Detail slide-out/modal with sanitized description, requirement pill badges, and direct apply action
  - [x] Sub-task 4.19: URL Import & Quick-Paste modal for candidate-provided postings
  - [x] Sub-task 4.20: Saved Searches manager with 1-click "Auto-Generate from Profile" button
  - [x] Sub-task 4.21: Job Sources & Integrations status drawer
- [x] **Documentation & Testing**
  - [x] Sub-task 4.22: Create `docs/JOB_SOURCES.md` documenting auth, rate limits, freshness, coverage, attribution, and apply capabilities
  - [x] Sub-task 4.23: Update `docs/API.md` and OpenAPI documentation
  - [x] Sub-task 4.24: Automated integration tests (`apps/api/src/tests/job_discovery.test.ts`) covering search, deduplication, URL import, requirement extraction, and saved searches
  - [x] Sub-task 4.25: Monorepo typecheck, lint, and full test suite passing cleanly

---

## Phase 5: Deterministic Matching Engine
- [x] **Data Contracts & Matching Types (packages/shared)**
  - [x] Sub-task 5.1: Define matching domain interfaces & Zod schemas (`MatchScoreResult`, `MatchBreakdown`, `MatchedSkillEvidence`, `MissingRequirement`, `MatchScoringWeights`, `MatchExplainQuerySchema`)
- [x] **Deterministic Scoring Engine Service (apps/api)**
  - [x] Sub-task 5.2: Implement `matchingService.ts` with weighted multi-factor deterministic scoring (Required skills, Preferred skills, Seniority, Title similarity, Location/remote fit, Compensation)
  - [x] Sub-task 5.3: Hard constraint evaluator (strict elimination for work authorization, blocked companies, salary floors, and mandatory degree requirements)
  - [x] Sub-task 5.4: Multi-hop graph evidence path integration querying FalkorDB / inMemEngine (`Job -> REQUIRES -> Requirement -> REQUIRES_SKILL -> Skill <- DEMONSTRATES <- Experience/Project <- Candidate`)
  - [x] Sub-task 5.5: Grounded explanation generator producing transparent, deterministic summaries and actionable next steps
- [x] **Matching API Endpoints (apps/api)**
  - [x] Sub-task 5.6: Mount `/api/v1/matches` routes (`GET /jobs/:jobId`, `GET /top`, `POST /recalculate`)
  - [x] Sub-task 5.7: Update OpenAPI schemas and `docs/API.md`
- [x] **Frontend Match Breakdown & Career Graph Explorer (apps/web)**
  - [x] Sub-task 5.8: Job cards in `/jobs` feed with color-coded Match % badges and Disqualification pills
  - [x] Sub-task 5.9: Match Explanation Modal with factor gauge, skill evidence chips, missing requirements, and disqualifier reasons
  - [x] Sub-task 5.10: Interactive React Flow Career Graph Explorer in `/graph` and modal with multi-hop proof path highlighting
- [x] **Testing & Quality Assurance**
  - [x] Sub-task 5.11: Comprehensive automated tests (`apps/api/src/tests/matching_engine.test.ts`) covering all scoring factors, disqualifiers, graph paths, and API endpoints
  - [x] Sub-task 5.12: Monorepo typecheck, lint, and full test suite verification

---

## Phase 6: Application Workflow & Human-in-the-Loop
- [x] **Database Models & Migrations (packages/db)**
  - [x] Sub-task 6.1: Define Prisma models (`Application`, `ApplicationEvent`, `MissingInfoRequest`, `InterviewSchedule`) with enums (`ApplicationStage`, `WorkflowStatus`, `ExecutionMode`, `SubmissionChannel`, `MissingInfoStatus`)
  - [x] Sub-task 6.2: Run Prisma migration and generate typed Prisma Client
- [x] **Shared Data Contracts & Validation Schemas (packages/shared)**
  - [x] Sub-task 6.3: Create `packages/shared/src/application.ts` defining DTOs and Zod validation schemas (`CreateApplicationSchema`, `UpdateApplicationStageSchema`, `ResolveMissingInfoSchema`, `ApproveApplicationSchema`, `BulkApproveSchema`, `AddInterviewScheduleSchema`)
  - [x] Sub-task 6.4: Export application domain contracts in `packages/shared/src/index.ts` and build package
- [x] **Application State Machine & Specialist Agents (apps/api)**
  - [x] Sub-task 6.5: Implement `applicationStateMachine.ts` with persisted status transitions, guards, immutable audit event logging, and SHA-256 canonical content hashing
  - [x] Sub-task 6.6: Implement specialist agents (`resumeTailoringAgent`, `coverLetterAgent`, `questionAnsweringAgent`) with grounded retrieval from FalkorDB / profile without hallucination
  - [x] Sub-task 6.7: Implement `orchestratorService.ts` executing the end-to-end preparation pipeline, duplicate detection, and automated missing-info pause
- [x] **Missing-Information Inbox & Approval Center Services (apps/api)**
  - [x] Sub-task 6.8: Implement `missingInfoService.ts` for managing scoped questions, answer persistence to universal bank, and graph memory projection
  - [x] Sub-task 6.9: Implement `approvalCenterService.ts` with strict content-hash verification, draft modifications, and bulk approvals
  - [x] Sub-task 6.10: Implement `applicationTrackerService.ts` with Kanban / Table / Calendar stage querying, interview scheduling, and manual fallback packet generator
- [x] **API Endpoints & OpenAPI Documentation (apps/api)**
  - [x] Sub-task 6.11: Mount `/api/v1/applications` routes (CRUD, stages, prepare, packet, interviews, notes)
  - [x] Sub-task 6.12: Mount `/api/v1/missing-info` routes (list, resolve with scopes, skip)
  - [x] Sub-task 6.13: Mount `/api/v1/approvals` routes (list, approve with content-hash, reject, bulk-approve)
  - [x] Sub-task 6.14: Update `docs/API.md` and OpenAPI specification
- [x] **Worker Task Queue Integration (apps/worker)**
  - [x] Sub-task 6.15: Implement BullMQ worker handler for async application preparation jobs and email notification triggers
- [x] **Frontend Application Suite (apps/web)**
  - [x] Sub-task 6.16: Build `ApplicationsPage.tsx` with Kanban Board, Table View, Calendar View, stage mover, and detail drawer
  - [x] Sub-task 6.17: Build `ApprovalsPage.tsx` with content-hash badge, tailored package inspector, bulk approval, and reject actions
  - [x] Sub-task 6.18: Build `MissingInfoPage.tsx` with question queue, reason badge, suggested answer, scope selector, and unblock action
  - [x] Sub-task 6.19: Update navigation header and routes in `App.tsx`
- [x] **Testing & Quality Assurance**
  - [x] Sub-task 6.20: Automated tests (`apps/api/src/tests/application_lifecycle.test.ts`) covering state transitions, content-hash security gate, missing-info scoped resolution, approval execution, and tracker updates
  - [x] Sub-task 6.21: Monorepo typecheck, lint, and full test suite verification

---

## Phase 7: Assisted Apply & Automation Channels
- [x] **Data Contracts & Validation Schemas (`packages/shared`)**
  - [x] Sub-task 7.1: Define Zod schemas and DTOs for autofill payload, Playwright submission, status reporting, and procedural memory (`packages/shared/src/automation.ts`)
- [x] **Idempotency & Replay Prevention (`apps/api`)**
  - [x] Sub-task 7.2: Redis-backed (with memory fallback) atomic lock acquisition, TTL, and cached response replayer (`apps/api/src/services/automation/idempotencyService.ts`)
- [x] **Procedural Memory & Selector Engine (`apps/api`)**
  - [x] Sub-task 7.3: ATS detection (Greenhouse, Lever, Ashby, generic), baseline selector catalog, FalkorDB procedural memory query & persistence (`apps/api/src/services/automation/proceduralMemoryService.ts`)
- [x] **Grounded Autofill Payload Service (`apps/api`)**
  - [x] Sub-task 7.4: Assemble candidate profile, tailored bullets, cover letter, screening answers, and SHA-256 contentHash verification gate (`apps/api/src/services/automation/autofillPayloadService.ts`)
- [x] **Playwright Server-Side Automation Engine (`apps/api`)**
  - [x] Sub-task 7.5: Headless automation runner with content-hash integrity verification, idempotency locking, confirmation ID generation, and safety circuit breakers on CAPTCHA / MFA / rate limits halting into `NEEDS_INTERVENTION` (`apps/api/src/services/automation/playwrightAutomationService.ts`)
- [x] **API Automation Endpoints (`apps/api`)**
  - [x] Sub-task 7.6: Mount `/api/v1/automation` endpoints for payload retrieval, Playwright submission, extension result reporting, and procedural memory learning (`apps/api/src/routes/automationRoutes.ts`)
- [x] **Chrome MV3 Browser Extension (`apps/extension`)**
  - [x] Sub-task 7.7: Manifest V3 compliant configuration with side panel, activeTab, and background service worker (`apps/extension/manifest.json`, `apps/extension/service-worker.js`)
  - [x] Sub-task 7.8: In-page floating HUD badge and intelligent form field classifier with synthetic event dispatchers (`apps/extension/content.js`, `apps/extension/content.css`)
  - [x] Sub-task 7.9: Copilot Side Panel UI with role preview, match fit %, content-hash badge, tailored bullets, cover letter, screening answers, and submission reporting (`apps/extension/sidepanel.html`, `apps/extension/sidepanel.css`, `apps/extension/sidepanel.js`, `apps/extension/README.md`)
- [x] **Testing & Verification**
  - [x] Sub-task 7.10: Automated tests (`apps/api/src/tests/assisted_apply_automation.test.ts`) covering autofill payload, hash tamper rejection, CAPTCHA circuit breaker, successful Playwright submission, idempotency replay, procedural memory recording, and extension status reporting
  - [x] Sub-task 7.11: Monorepo full test suite (7/7 suites, 65/65 tests passed), typecheck, and frontend build

---

## Phase 8: Email Integration & Recruiter Outreach
- [x] **Database Schema & Migrations (`packages/db`)**
  - [x] Sub-task 8.1: Define enums (`IntegrationProvider`, `IntegrationStatus`, `OutreachStatus`, `EmailClassificationCategory`) and models (`UserIntegration`, `RecruiterOutreach`, `InboundEmailEvent`, and calendar fields on `InterviewSchedule`) in `prisma/schema.prisma`
  - [x] Sub-task 8.2: Synchronize PostgreSQL schema via `prisma db push` and regenerate Prisma client
- [x] **Data Contracts & Validation Schemas (`packages/shared`)**
  - [x] Sub-task 8.3: Define Zod schemas and DTOs for mail/calendar integrations (`packages/shared/src/integrations.ts`)
  - [x] Sub-task 8.4: Define Zod schemas and DTOs for grounded recruiter outreach drafts, content-hash approval, sending, and quota tracking (`packages/shared/src/outreach.ts`)
  - [x] Sub-task 8.5: Define Zod schemas and DTOs for inbound email classification, application matching, and manual resolution (`packages/shared/src/inboundEmails.ts`)
  - [x] Sub-task 8.6: Define Zod schemas and DTOs for interview scheduling, round prep questions, and calendar sync (`packages/shared/src/interviews.ts`)
- [x] **Envelope Encryption & Secure Credential Store (`apps/api`)**
  - [x] Sub-task 8.7: Implement AES-256-GCM envelope encryption with per-credential Data Encryption Key (DEK) wrapped with Master Key Encryption Key (KEK) and auth-tag validation (`apps/api/src/services/integrations/tokenEncryptionService.ts`)
  - [x] Sub-task 8.8: Implement OAuth 2.0 URL generators for Gmail API & Microsoft Graph with minimal least-privilege scopes, cryptographic state parameter generation & validation, and secure token purging on disconnect (`apps/api/src/services/integrations/integrationOAuthService.ts`)
- [x] **Recruiter Outreach Generator & Cryptographic Approval Gate (`apps/api`)**
  - [x] Sub-task 8.9: Grounded draft generator extracting candidate graph evidence, computing SHA-256 `contentHash`, invalidating approvals on edits, enforcing daily quota (25/day), appending anti-spam opt-out notes, and logging episodic outreach memory to FalkorDB (`apps/api/src/services/outreach/recruiterOutreachService.ts`)
- [x] **Inbound Email Status Classifier (`apps/api`)**
  - [x] Sub-task 8.10: Deterministic keyword & pattern classifier across 4 categories (`APPLICATION_ACKNOWLEDGED`, `INTERVIEW_INVITATION`, `OFFER_RECEIVED`, `REJECTION`), auto-matching applications and confidence-gated stage progression (`apps/api/src/services/inbound/inboundEmailClassifierService.ts`)
- [x] **Interview Scheduling & RFC 5545 Calendar Sync (`apps/api`)**
  - [x] Sub-task 8.11: Interview schedule persistence, round-type specific prep questions generator, RFC 5545 `.ics` iCalendar file generator with alarms, and Google/Microsoft calendar synchronization (`apps/api/src/services/interviews/interviewService.ts`)
- [x] **REST API Routes (`apps/api`)**
  - [x] Sub-task 8.12: Mount `/api/v1/integrations`, `/api/v1/outreach`, `/api/v1/inbound-emails`, and `/api/v1/interviews` in Express app
- [x] **Frontend Outreach & Mailbox Workspace (`apps/web`)**
  - [x] Sub-task 8.13: Add Phase 8 API client methods for integrations, outreach, inbound classification, and interviews (`apps/web/src/api/client.ts`)
  - [x] Sub-task 8.14: Build multi-tab `OutreachPage.tsx` with Recruiter Outreach composer & approval modal, Inbound Classifier stream & tester, Interview & Prep question manager with `.ics` export, and Mailbox OAuth Connection manager
  - [x] Sub-task 8.15: Wire `/outreach` route in `App.tsx` and add navigation tab in `Navbar.tsx`
- [x] **Testing & Quality Assurance**
  - [x] Sub-task 8.16: Automated tests (`apps/api/src/tests/email_outreach_integrations.test.ts`) covering envelope encryption, tamper rejection, OAuth flows, outreach generation, approval hash locks, quota bounds, inbound classification, auto-stage transitions, interview prep generation, and `.ics` download
  - [x] Sub-task 8.17: Monorepo test suite (8/8 test suites, 74/74 tests passed), typecheck, and Vite production bundle compilation

---

## Phase 9: Plans, Billing & Metering
- [x] **Database Schema & Migrations (`packages/db`)**
  - [x] Sub-task 9.1: Define enums (`PlanTier`, `BillingInterval`, `PaymentProviderType`, `SubscriptionStatus`, `InvoiceStatus`, `WebhookProcessStatus`) and models (`Plan`, `Subscription`, `Invoice`, `DailyUsageMeter`, `PaymentWebhookEvent`) in `prisma/schema.prisma`
  - [x] Sub-task 9.2: Synchronize PostgreSQL schema via `prisma db push` and rebuild `@careergraph/db` package
- [x] **Shared Contracts & Validation Schemas (`packages/shared`)**
  - [x] Sub-task 9.3: Define Zod schemas and DTOs for plan entitlements, checkout sessions, payment verification, subscriptions, GST invoices, and usage summaries (`packages/shared/src/billing.ts`)
  - [x] Sub-task 9.4: Export billing contracts through `packages/shared/src/index.ts` and compile `@careergraph/shared`
- [x] **Plan Catalog & Entitlements Engine (`apps/api`)**
  - [x] Sub-task 9.5: Implement database-driven plan seeding & catalog with structured entitlements (`discoveryRunsPerDay`, `matchedJobsVisible`, `preparedApplicationsPerMonth`, `autoApplyAllowancePerMonth`, `tailoredResumesPerMonth`, `aiTokensMonthly`, `outreachEmailsPerDay`, and feature gates) (`apps/api/src/services/billing/planService.ts`)
- [x] **Dual Payment Gateways & Local Dev Provider (`apps/api`)**
  - [x] Sub-task 9.6: Define `PaymentGatewayProvider` interface with Razorpay provider (HMAC-SHA256 signature verification, orders API), Stripe provider (checkout sessions, signature parsing), and FreeDev provider for instantaneous local development testing (`apps/api/src/services/billing/providers/`)
  - [x] Sub-task 9.7: Subscription lifecycle manager with upgrade/downgrade proration, cancellation at period end, and reactivations (`apps/api/src/services/billing/subscriptionService.ts`)
- [x] **GST Tax Invoices & Sequential Sequencing (`apps/api`)**
  - [x] Sub-task 9.8: Implement GST calculation engine (18% GST, CGST/SGST vs IGST state code detection, Indian GSTIN validation, HSN/SAC code 998314) and sequential numbering `CG-YYYY-XXXX` (`apps/api/src/services/billing/invoiceService.ts`)
  - [x] Sub-task 9.9: Render responsive, printable HTML GST Tax Invoices with supplier GSTIN, tax breakdown table, line items, and customer information
- [x] **Webhook Validation & Idempotency Ledger (`apps/api`)**
  - [x] Sub-task 9.10: Webhook processing engine with cryptographic signature verification and database idempotency ledger (`PaymentWebhookEvent`) preventing duplicate replays or double-crediting (`apps/api/src/services/billing/webhookService.ts`)
- [x] **Usage Meters & Quota Enforcement Middleware (`apps/api`)**
  - [x] Sub-task 9.11: Atomic daily & monthly usage counters (`DailyUsageMeter`) and quota telemetry calculations (`apps/api/src/services/billing/usageService.ts`)
  - [x] Sub-task 9.12: Express middleware `requireQuota` and `requireFeature` blocking requests with HTTP 403 `QUOTA_EXCEEDED` / `FEATURE_LOCKED` when limits are reached (`apps/api/src/middleware/quotaMiddleware.ts`)
- [x] **Billing REST Endpoints (`apps/api`)**
  - [x] Sub-task 9.13: Mount `/api/v1/billing` endpoints for plan listings, checkouts, payment verification, cancellation, usage meters, invoices, and webhook listeners in `apps/api/src/routes/billingRoutes.ts`
- [x] **Frontend Billing & Usage Workspace (`apps/web`)**
  - [x] Sub-task 9.14: Add billing client methods to `apps/web/src/api/client.ts`
  - [x] Sub-task 9.15: Build multi-tab `BillingPage.tsx` with Monthly/Annual plan toggle, INR/USD currency switcher, checkout modal with optional GSTIN capture, live color-coded quota meters, subscription renewal/cancel management, and downloadable GST Tax Invoices
  - [x] Sub-task 9.16: Wire `/billing` route in `App.tsx` and add Billing navigation tab in `Navbar.tsx`
- [x] **Testing & Verification**
  - [x] Sub-task 9.17: Automated tests (`apps/api/src/tests/billing_plans_metering.test.ts`) covering plan retrieval, checkout sessions, signature verification, 18% GST invoice generation, webhook idempotency, tamper rejection, usage recording, and cancellation
  - [x] Sub-task 9.18: Monorepo full test suite verification (9/9 suites, 83/83 tests passed), typecheck, and Vite production bundle compilation

---

## Phase 10: Multi-Tenant Organizations (Colleges & Coaching)
- [x] **Database Schema & Migrations (`packages/db`)**
  - [x] Sub-task 10.1: Define enums (`OrgType`, `UserRole`) and models (`Organization`, `Cohort`, `CohortMembership`, `StudentConsent`, `OrgInvitation`, `CampusDrive`, `CampusDriveApplication`) in `prisma/schema.prisma`
  - [x] Sub-task 10.2: Synchronize PostgreSQL schema via `prisma db push` and rebuild `@careergraph/db` package
- [x] **Shared Contracts & Validation Schemas (`packages/shared`)**
  - [x] Sub-task 10.3: Define Zod schemas and DTOs for organizations, policies, cohorts, invitations, bulk CSV reports, student privacy consents, campus placement drives, and cohort analytics (`packages/shared/src/organization.ts`)
  - [x] Sub-task 10.4: Export contracts through `packages/shared/src/index.ts` and compile `@careergraph/shared`
- [x] **Organization, Cohort & Seat Management Services (`apps/api`)**
  - [x] Sub-task 10.5: Organization creation with slug generation, owner role assignment, policy defaults, member listing, and member removal seat reclamation (`apps/api/src/services/organization/organizationService.ts`)
  - [x] Sub-task 10.6: Student cohort and batch management with department and graduation year tracking (`apps/api/src/services/organization/cohortService.ts`)
- [x] **Bulk CSV Admissions & Validation Pipeline (`apps/api`)**
  - [x] Sub-task 10.7: Bulk CSV parser with dry-run verification mode, seat capacity checks, duplicate email detection, token generation, and automatic cohort linking (`apps/api/src/services/organization/invitationService.ts`)
- [x] **Student Data Sovereignty & Consent Engine (`apps/api`)**
  - [x] Sub-task 10.8: Granular consent toggles (`shareProfile`, `shareApplications`, `shareResumes`, `shareOffers`, `allowMentorReview`) with immutable audit logging per DPDP Act and GDPR compliance (`apps/api/src/services/organization/consentService.ts`)
- [x] **Campus Placement Drives & Opportunity Board (`apps/api`)**
  - [x] Sub-task 10.9: Exclusive campus drive posting with CTC ranges, minimum CGPA eligibility, applicant tracking, and placement offer recording with compensation CTC (`apps/api/src/services/organization/campusDriveService.ts`)
- [x] **Placement Cell Aggregate Analytics & NIRF/NAAC CSV Export (`apps/api`)**
  - [x] Sub-task 10.10: Cohort placement rates, consent-gated median offered CTC calculations, recruiter skill-gap heatmaps, at-risk student early intervention queue, and official accreditation CSV export (`apps/api/src/services/organization/placementAnalyticsService.ts`)
- [x] **REST API Routes (`apps/api`)**
  - [x] Sub-task 10.11: Mount `/api/v1/organizations` routes in `apps/api/src/routes/organizationRoutes.ts`
- [x] **Frontend Placement Workspace (`apps/web`)**
  - [x] Sub-task 10.12: Add organization API client methods to `apps/web/src/api/client.ts`
  - [x] Sub-task 10.13: Build multi-tab `OrganizationPage.tsx` with Placement Analytics (NIRF metrics, skill gaps, at-risk students, CSV export), Cohorts & Batches, Student Roster & Invites (Bulk CSV modal with live dry-run validation report), Campus Drives (applicant review & offer drawer), Student Privacy & Consent toggles, and Org Policies
  - [x] Sub-task 10.14: Wire `/organizations` route in `App.tsx` and add Colleges & Orgs link in `Navbar.tsx`
- [x] **Testing & Verification**
  - [x] Sub-task 10.15: Automated tests (`apps/api/src/tests/multi_tenant_organizations.test.ts`) covering org creation, cohort creation, dry-run & commit bulk CSV, invite acceptance, consent toggling & audit logging, campus drive application & offer, placement analytics, CSV export, policies, and seat reclamation
  - [x] Sub-task 10.16: Monorepo test suite (10/10 test suites, 92/92 tests passed), typecheck, and Vite production bundle compilation

---

## Phase 11: Administration, Hardening & Security
- [x] **Database Schema & Migrations (`packages/db`)**
  - [x] Sub-task 11.1: Add `isSuspended`, `suspendedReason`, and `dataExportRequestedAt` to `User` model, and `actorId` with compound indexes to `AuditLog` in `prisma/schema.prisma`
  - [x] Sub-task 11.2: Synchronize PostgreSQL schema via `prisma db push` and rebuild `@careergraph/db` package
- [x] **Shared Contracts & Validation Schemas (`packages/shared`)**
  - [x] Sub-task 11.3: Define Zod schemas and DTOs for platform statistics, user administration, organization capacity management, audit log explorer, DPDP Act & GDPR data portability archives, account erasure requests, and prompt injection heuristics (`packages/shared/src/admin.ts`)
  - [x] Sub-task 11.4: Export contracts through `packages/shared/src/index.ts` and compile `@careergraph/shared`
- [x] **Super-Admin Governance & Telemetry (`apps/api`)**
  - [x] Sub-task 11.5: Aggregate system-wide metrics across PostgreSQL and FalkorDB, user directory searching, RBAC role assignment, account locking/suspension with session termination, and organization seat overrides (`apps/api/src/services/admin/adminService.ts`)
- [x] **Centralized Immutable Audit Service (`apps/api`)**
  - [x] Sub-task 11.6: Centralized audit logging helper and query engine with multi-facet filtering (action, actor, resource, date range) (`apps/api/src/services/admin/auditService.ts`)
- [x] **Privacy, DPDP Act 2023 & GDPR Compliance Service (`apps/api`)**
  - [x] Sub-task 11.7: Full machine-readable JSON data portability exporter (`exportUserData`) covering profiles, graph facts, applications, and invoices per DPDP Act §11 & GDPR Art 20 (`apps/api/src/services/compliance/complianceService.ts`)
  - [x] Sub-task 11.8: Irreversible Right to Erasure / Right to be Forgotten (`eraseUserAccount`) with confirmation safeguard phrase (`DELETE MY ACCOUNT PERMANENTLY`), FalkorDB Cypher candidate detachment/deletion, session revocation, and invoice customer PII anonymization per DPDP Act §12 & GDPR Art 17
- [x] **Adversarial Prompt-Injection Defense Engine (`apps/api`)**
  - [x] Sub-task 11.9: Heuristic detector and sanitization pipeline neutralizing instruction overrides, DAN jailbreaks, tool hijacking, zero-width evasion, and isolating untrusted content in `<UNTRUSTED_EXTERNAL_DATA>` tags (`apps/api/src/services/security/promptInjectionService.ts`)
- [x] **Rate Limiting & Security Hardening Middleware (`apps/api`)**
  - [x] Sub-task 11.10: Redis-backed (with sliding memory fallback) rate limiters for auth, API, and automation apply with RFC HTTP headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) (`apps/api/src/middleware/rateLimitMiddleware.ts`)
  - [x] Sub-task 11.11: Immediate account suspension check in `requireAuth` blocking compromised/suspended tokens with HTTP 403 `ACCOUNT_SUSPENDED` (`apps/api/src/middleware/authMiddleware.ts`)
- [x] **REST API Routes (`apps/api`)**
  - [x] Sub-task 11.12: Mount `/api/v1/admin` and `/api/v1/compliance` endpoints in `apps/api/src/app.ts`
- [x] **Frontend Super-Admin & Compliance Center (`apps/web`)**
  - [x] Sub-task 11.13: Add Phase 11 client methods to `apps/web/src/api/client.ts`
  - [x] Sub-task 11.14: Build multi-tab `AdminPage.tsx` with Platform Overview, User Directory & RBAC controls, Tenant Organizations capacity manager, Audit Log Explorer, Prompt-Injection Diagnostic Lab, and DPDP/GDPR Data Rights & Erasure Center
  - [x] Sub-task 11.15: Wire `/admin` and `/compliance` routes in `App.tsx` and conditionally display Admin badge in `Navbar.tsx` for `SUPER_ADMIN` users
- [x] **Testing & Verification**
  - [x] Sub-task 11.16: Automated tests (`apps/api/src/tests/admin_hardening_security.test.ts`) covering platform stats, RBAC updates, suspension lockout, seat overrides, data portability export, permanent erasure, prompt injection neutralization, and 429 rate limiting
  - [x] Sub-task 11.17: Full monorepo verification: 11/11 test suites passing (100/100 tests passed!), typecheck clean, and Vite production bundle compiled

---

## Phase 12: Production Deployment & Documentation
- [ ] Containerized deployment setup & CI/CD pipeline
- [ ] Health & readiness probes
- [ ] Complete API docs, GRAPH_SCHEMA, RUNBOOK, and DEMO walkthrough

---

## Phase 13: AI Layer via NVIDIA NIM (Completed)
*Spec references: Section 12 (Zero-Hallucination AI Layer), Section 22 (Adversarial Prompt-Injection Defense)*

- [x] **Provider Integration (OpenAI-compatible)**
  - [x] Sub-task 13.1: Add `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_ENABLED`, `AI_TEMPERATURE`, `AI_MAX_TOKENS` to `.env` (real NVIDIA NIM key), `.env.example` (placeholder), and the Zod env schema (`apps/api/src/config/env.ts`) — provider-agnostic: any OpenAI-compatible endpoint works
  - [x] Sub-task 13.2: Install `openai` SDK in `apps/api` and build the LLM client with single-shot + streaming chat completions, 45s timeout, and automatic test-environment bypass (`apps/api/src/services/ai/llmClient.ts`)
  - [x] Sub-task 13.3: Grounded system prompts for Resume Tailoring, Cover Letter, Question Answering, and the Career Copilot with the zero-hallucination guardrail and `<candidate_facts>` / `<UNTRUSTED_EXTERNAL_DATA>` boundaries (`apps/api/src/services/ai/prompts.ts`)
- [x] **AI Service — LLM-enhanced specialist agents with deterministic fallback**
  - [x] Sub-task 13.4: `AIService.tailorResume` — LLM tailoring with Zod-validated JSON output, grounding-enforcement (every bullet must reference a real experience/project token), highlighted-skills subset validation, and fallback to the deterministic `ResumeTailoringAgent` (`apps/api/src/services/ai/aiService.ts`)
  - [x] Sub-task 13.5: `AIService.draftCoverLetter` — LLM letter with signature + length validation, falling back to `CoverLetterAgent`
  - [x] Sub-task 13.6: `AIService.evaluateQuestions` — deterministic baseline always computed first (defines the question universe & missing-info contract), LLM may only answer known keys, merged over the baseline, falling back cleanly on any error
  - [x] Sub-task 13.7: Wire the orchestrator's finalize step through the AI service (`apps/api/src/services/applications/orchestratorService.ts`)
- [x] **Interactive Career Copilot**
  - [x] Sub-task 13.8: `AIService.copilotChat` / `copilotChatStream` — builds live grounding context from the candidate's verified profile, experiences, projects, skills, preferences, and application pipeline; user messages run through the Phase 11 prompt-injection sanitizer; SSE streaming with delta/done events
  - [x] Sub-task 13.9: REST routes `GET /api/v1/ai/status` (public), `GET/POST /api/v1/ai/copilot`, `POST /api/v1/ai/copilot/stream` mounted in `app.ts` (`apps/api/src/routes/aiRoutes.ts`)
  - [x] Sub-task 13.10: Shared Zod contracts for copilot messages, chat request/response, and AI status DTO (`packages/shared/src/ai.ts`)
  - [x] Sub-task 13.11: Floating AI Copilot chat widget in the web app for authenticated users with streaming render and mode badge (LLM vs deterministic fallback) (`apps/web/src/components/CopilotWidget.tsx`)
- [x] **Zero-hallucination guarantees**
  - [x] LLM disabled in test env → all existing tests stay deterministic and offline
  - [x] Any LLM failure/timeout/malformed output transparently falls back to the deterministic agents
  - [x] Every AI surface reports its mode (`LLM` | `DETERMINISTIC_FALLBACK`) and fallback reason

---

## Phase 14: Chrome Extension — Assisted Apply (Completed)
*Spec references: Section 9 (Job Sources & Discovery), Section 15 (Application Packet Autofill & Submission Relay)*

- [x] **Extension Auth Contract (dedicated session token)**
  - [x] Sub-task 14.1: `ExtensionService.login` — password login issuing a dedicated 7-day JWT backed by a real `Session` row (`userAgent: 'CareerGraph Chrome Extension (MV3)'`), so device-management revocation, admin suspension, and `requireAuth` session checks all apply (`apps/api/src/services/extension/extensionService.ts`)
  - [x] Sub-task 14.2: `GET /api/v1/extension/me` — popup summary card: user, profile completeness, pipeline count, open jobs, AI status
  - [x] Sub-task 14.3: Shared Zod contracts for extension login/session/account/capture (`packages/shared/src/extension.ts`)
  - [x] Sub-task 14.4: Mount `/api/v1/extension` routes with auth rate limiting (`apps/api/src/routes/extensionRoutes.ts`)
- [x] **Job Capture (in the wild)**
  - [x] Sub-task 14.5: `POST /api/v1/extension/jobs/capture` — accepts Schema.org/JobPosting JSON-LD extracted from any job board, runs it through the same `scrapeOrConstructJob` → dedup → requirement extraction → FalkorDB graph projection pipeline as URL import (`isNew` flag → 201 Created vs 200 OK)
  - [x] Sub-task 14.6: Content script detects JobPosting JSON-LD (skips Google Jobs search overlays), renders a floating "Save to CareerGraph" HUD + toast feedback (`apps/extension/content.js`, `content.css`)
- [x] **Assisted-Apply Side Panel**
  - [x] Sub-task 14.7: Manifest V3 side panel with token setup, application packet inspection, form-autofill trigger, and submission report flow (`apps/extension/sidepanel.html/.css/.js`)
  - [x] Sub-task 14.8: Service worker relays capture/autofill messages between content script, side panel, and the API (`apps/extension/service-worker.js`)
  - [x] Sub-task 14.9: Extension README with load-unpacked instructions and API contract summary (`apps/extension/README.md`)

---

## Phase 15: Light Modern UI — Open-Source Aesthetic (Completed)
*Spec references: Section 10 (Design System)*

- [x] **Design tokens**
  - [x] Sub-task 15.1: Light design system in `apps/web/src/index.css` — white base, slate ink, `.bg-grid` blueprint grid backdrop, redesigned `.glass-panel` with layered soft shadows, refined `::selection` and scrollbars
  - [x] Sub-task 15.2: Systematic dark→light class remap across all 18 TSX surfaces: `text-white → text-slate-900`, `text-slate-400 → text-slate-500/600`, `text-slate-300 → text-slate-700`, `text-slate-200 → text-slate-800`, `border-white/10 → border-slate-200`, `border-white/5 → border-slate-100`, `bg-white/5 → bg-slate-50`, `bg-navy-*/bg-[#060911] → bg-white`, `hover:text-white → hover:text-slate-900` (solid colored/gradient buttons keep white text)
- [x] **Signature surfaces**
  - [x] Sub-task 15.3: Landing page hero with blueprint grid backdrop, tech-chip badges (open-source stack, FalkorDB, z-ai/glm-5.3 via NVIDIA NIM), and light CTA pair
  - [x] Sub-task 15.4: Navbar restyled to light glass with sky-600 active states and light hover chips
  - [x] Sub-task 15.5: Floating Copilot widget styled to match the light system
- [x] **Verification**
  - [x] Sub-task 15.6: Full monorepo verification — typecheck, lint, tests, production builds all green after the retheme

---

## Phase 16: Resume ATS Score, Profile Assets & Latest-First Ordering (Completed)
*Spec references: Section 8 (Document & Resume Intelligence), Section 6 (Candidate Profile)*

- [x] **Data Model & Contracts**
  - [x] Sub-task 16.1: Extend `CandidateProfile` with `rawResumeText`, `resumeFileName`, `resumeUploadedAt`, `resumeAtsScore`, `resumeAtsGrade`, `resumeAtsCheckedAt`, `resumeAtsReport` (Json), `profilePictureUrl`, `videoIntroUrl`, `coverLetterText` — pushed via `prisma db push`
  - [x] Sub-task 16.2: Shared ATS contracts in `packages/shared/src/profile.ts` — `AtsBreakdownItemDto`, `AtsSuggestionDto` (HIGH/MEDIUM/LOW), `ResumeAtsReportDto` (score, grade A+–D, 7-category breakdown, keyword matches, suggestions, LLM/deterministic mode), `AtsCheckRequestSchema` (optional `targetJobId`), `ProfileAssetsInputSchema` (data-URL picture ≤2.6M chars, https video URL ≤2M, cover letter ≤8000 chars), and DTO extensions on `CandidateProfileDTO`
- [x] **ATS Scoring Engine (`apps/api/src/services/ats/atsService.ts`)**
  - [x] Sub-task 16.3: Deterministic 7-category scorer — Contact Info, Standard Sections, Action Verbs, Quantified Impact, Keyword Match (profile skills or target job skills), Readability & Length, Profile Depth — each 0–100, averaged to a 0–100 score with A+/A/B/C/D grading
  - [x] Sub-task 16.4: Deterministic suggestions generator (missing-contact links, weak-section hints, verb/quantifier coaching, missing keywords) enriched by grounded LLM suggestions (profile + target-role aware, zero-hallucination guarded) when the AI layer is enabled
  - [x] Sub-task 16.5: Persistence — every check stores score/grade/timestamps/full report on the profile; latest score always reflects the latest uploaded resume
- [x] **REST API (`apps/api`)**
  - [x] Sub-task 16.6: `POST /api/v1/resumes/upload` now stores raw text + filename + upload time on the profile (extends the existing parse→graph pipeline)
  - [x] Sub-task 16.7: `POST /api/v1/resumes/ats-check` (auth) — scores latest resume, optional `targetJobId` for role-specific keyword alignment; 400 `NO_RESUME` before upload
  - [x] Sub-task 16.8: `GET /api/v1/resumes/ats/latest` (auth) — returns latest score, grade, timestamps, resume filename, and the full persisted report
  - [x] Sub-task 16.9: `PUT /api/v1/profile/assets` (auth) — saves profile picture, video intro URL, and cover letter text with Zod validation
- [x] **Profile Ordering Fix**
  - [x] Sub-task 16.10: `profileService` now returns experiences and educations latest-first (current roles first, then start/completion year descending) via `sortExperiencesLatestFirst`/`sortEducationsLatestFirst` helpers applied in every profile read path — fixes all consumers (web, extension, agents)
- [x] **Web UI (`apps/web`)**
  - [x] Sub-task 16.11: New "Resume & ATS" tab in ProfileManager — resume upload (auto-scores on upload), circular score ring with grade, 7-category breakdown bars, matched/missing keyword chips, and severity-coded improvement suggestions
  - [x] Sub-task 16.12: New "Assets & Intro" tab — profile picture upload (base64 data-URL preview), video intro URL capture with guidance, and cover letter editor, all persisted via `PUT /profile/assets`
  - [x] Sub-task 16.13: Client methods `checkResumeAts`, `getLatestResumeAts`, `updateProfileAssets` in `apps/web/src/api/client.ts`
- [x] **Testing & Verification**
  - [x] Sub-task 16.14: Dedicated regression suite `apps/api/src/tests/ats.test.ts` — 11 tests covering latest-report null-state, NO_RESUME guard, auth enforcement, upload persistence, all-7-category scoring, persisted-report round-trip, profile score exposure, asset save + validation, and latest-first experience/education ordering
  - [x] Sub-task 16.15: Full monorepo verification — typecheck, lint, all test suites, production builds
