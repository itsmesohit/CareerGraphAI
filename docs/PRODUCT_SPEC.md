# MASTER BUILD SPEC — CareerGraph AI
## Agentic Job Discovery, Auto-Apply & Application Tracking SaaS (B2C + B2B)

---------------------------------------------------------------------
## 0. HOW YOU (THE AI ENGINEER) MUST WORK
---------------------------------------------------------------------

Act as a senior team of: full-stack engineer, AI agent architect, graph database
engineer, DevOps/SRE engineer, security engineer, and SaaS product designer.

Your job is to BUILD a working, tested, deployable, multi-tenant SaaS product,
not to write plans, mockups, or sample snippets.

Working rules:
1. This file is the source of truth: docs/PRODUCT_SPEC.md.
2. Maintain docs/PLAN.md as a phase checklist. Update it at the end of every phase.
3. Record every non-trivial technical decision as a short ADR in docs/DECISIONS.md.
4. Record every external blocker (missing API key, OAuth verification, paid
   access) in docs/BLOCKERS.md, with the exact steps the owner must take.
5. Work in vertical slices. After every slice, run typecheck, lint, unit tests,
   integration tests, and the app itself. Fix failures before moving on.
6. No fake implementations: no empty handlers, no hardcoded results, no buttons
   that do nothing, no placeholder success messages, no fake metrics.
7. When a third-party integration cannot be activated, do three things:
   - implement the real interface;
   - add a clearly labeled development mock (UI badge "DEV MOCK");
   - document the blocker and continue.
8. Make sensible defaults for engineering choices and document them. Ask the
   owner only for genuine product or business decisions.
9. Never commit secrets. Never log tokens, OTPs, passwords, or resume contents.
10. Prefer boring, well-maintained libraries. Pin versions. Verify that APIs and
    packages exist before using them; do not invent endpoints or package names.
11. Begin by inspecting the repository. Then write PLAN.md. Then immediately
    implement Phase 1. Do not stop after planning.

---------------------------------------------------------------------
## 1. PRODUCT OVERVIEW
---------------------------------------------------------------------

Working name: CareerGraph AI

Promise:
"Build your career profile once. Your AI agent continuously finds relevant jobs,
remembers everything about your career, prepares truthful tailored applications,
applies through permitted channels according to your rules, contacts recruiters
with your approval, and tracks every application step in one dashboard. It asks
you only when information, authorization, or a decision is missing."

Customer segments (all must be supported by the same codebase):
1. Individual job seekers: freshers, experienced professionals, career switchers.
2. Colleges and universities: placement cells managing student cohorts.
3. Coaching institutes, bootcamps, and training providers: managing learner batches.
4. Other organizations (NGOs, outplacement firms): generic "Organization" type.

Revenue model: subscription plans for individuals, plus per-seat or bulk plans
for organizations, plus optional add-on credits.

---------------------------------------------------------------------
## 2. NON-NEGOTIABLE PRINCIPLES
---------------------------------------------------------------------

- Truthfulness. Never invent skills, experience, metrics, employers, degrees,
  salary details, or legal eligibility. AI-generated text may only rephrase or
  select verified facts.
- Consent and control. Default mode is APPROVAL_REQUIRED. Auto-apply only
  happens when the user explicitly enables it for channels where automation is
  permitted.
- Platform respect.
  - Never bypass CAPTCHA, MFA, bot detection, rate limits, or Terms of Service.
  - Never disguise automation.
  - Pause and request human intervention instead.
- Tenant isolation. No user or organization can ever access another's data.
  Enforce this server-side and in every DB and graph query.
- Auditability. Every agent decision and external action is traceable to
  evidence, inputs, and an actor.
- Untrusted input. Job descriptions, web pages, emails, resumes, and API
  responses are untrusted data. They must never alter instructions,
  permissions, or approval requirements (prompt-injection defense).
- Honest UI. Clearly distinguish confirmed facts, AI suggestions, missing info,
  pending approvals, confirmed submissions, and uncertain or failed submissions.

---------------------------------------------------------------------
## 3. TECH STACK & REPOSITORY STRUCTURE
---------------------------------------------------------------------

Monorepo: pnpm workspaces + Turborepo, TypeScript strict mode everywhere.

### Repository layout

apps/
  web/          React + Vite + TS + Tailwind + shadcn/ui (Radix) + TanStack Query
                + React Router + React Hook Form + Zod + React Flow + Recharts
  api/          Node.js + Express + TS, REST, Zod validation, OpenAPI generation
  worker/       BullMQ workers (discovery, parsing, matching, applying, email, billing)
  extension/    Chrome MV3 extension (assisted autofill) — Phase 7+
packages/
  shared/       Zod schemas, DTOs, enums, constants shared by web/api/worker/extension
  db/           Prisma schema + client + migrations + seed (PostgreSQL)
  graph/        FalkorDB client wrapper, schema init, parameterized Cypher queries
  agents/       Orchestrator, agents, tool registry, LLM provider abstraction
  job-sources/  JobSource interface + adapters
  integrations/ Gmail, Microsoft Graph, payments, email delivery, storage
  ui/           (optional) shared UI components
infra/          docker-compose, Dockerfiles, deployment configs
docs/           PRODUCT_SPEC, PLAN, DECISIONS, BLOCKERS, API, GRAPH_SCHEMA,
                RUNBOOK, DEMO

### Data stores

- PostgreSQL (Prisma) is the SYSTEM OF RECORD for:
  - users, auth, organizations, memberships, profiles, answers, documents
    metadata;
  - applications, workflow state, billing, usage, audit logs, notifications.
- FalkorDB is the AGENT MEMORY AND REASONING GRAPH: skills, evidence,
  requirements, matches, decisions, task coordination, episodic, semantic,
  and procedural memory.
- Postgres → FalkorDB sync uses the transactional OUTBOX PATTERN:
  - profile and job mutations write an outbox event in the same Postgres
    transaction;
  - a worker projects events into FalkorDB idempotently;
  - provide a full "rebuild graph for user" command.
- Redis + BullMQ: queues, rate limiting, short-lived OTP and session caches.
- S3-compatible private object storage (Cloudflare R2, AWS S3, or MinIO
  locally): resumes and generated documents, accessed via short-lived
  signed URLs only.
- Embeddings: pgvector in Postgres, used for question-bank matching and
  semantic search. If FalkorDB vector indexing is used instead, document it.

### AI layer

- LLM provider abstraction with structured JSON output validated by Zod.
- Separate model configs for: extraction, matching explanation, writing,
  classification.
- Per-tenant token metering.
- Typed tool registry. Every tool has: schema, authorization check, timeout,
  bounded permissions.
- MCP server exposure is optional.

### Other services

- Email delivery: Resend, AWS SES, or an SMTP provider, behind an interface.
  Use Mailpit locally.
- Observability: pino structured logs, Sentry, OpenTelemetry traces,
  health endpoints.

---------------------------------------------------------------------
## 4. MULTI-TENANCY, ROLES & PERMISSIONS
---------------------------------------------------------------------

### Entities

- User
- Organization: type = COLLEGE | COACHING | COMPANY | OTHER
- OrgMembership
- Cohort (batch, department, year)
- CohortMembership
- Seat
- Invitation

### Model

- Every user has a personal candidate workspace (their profile and applications).
- A user may be linked to zero or more organizations through memberships.
- Organizations pay for seats. Students and learners consume seats.

### Roles (RBAC, enforced in API middleware and service layer)

- SUPER_ADMIN: platform operator (you).
- ORG_OWNER: billing, settings, admins.
- ORG_ADMIN: placement officer or coaching admin. Manages cohorts, invites,
  and aggregate analytics.
- MENTOR: counselor or trainer. Reviews assigned students' profiles,
  resumes, and drafts, only with consent.
- CANDIDATE: the job seeker.

### Organization features

- Invite students by email, by bulk CSV upload (with validation report), by
  shareable invite link, or by verified email-domain auto-join
  (e.g. @college.edu).
- Cohorts and batches with filters (department, graduation year, course).
- Seat assignment, revocation, and reassignment. Behavior when seats run out.
- Org-level policies:
  - default automation mode;
  - max applications per day;
  - allowed and blocked companies;
  - require mentor review before submission (optional).
- White-labeling: org logo, name, primary color, and optionally a custom
  subdomain (e.g. abc-college.careergraph.ai).
- Announcements and opportunities: org admins can post curated jobs or
  drives to cohorts.

### Consent-based visibility

- The org sees aggregate analytics by default.
- The org sees individual-level application data only if the student grants
  consent (granular toggles: profile, applications, outcomes).
- Consent can be revoked at any time. All consent changes are audited.

### Lifecycle

- When a student leaves an org or a seat expires, the student keeps their
  personal data and account, falls back to the Free plan, and the org loses
  access.

### Testing

- Write automated tests proving cross-tenant and cross-org access is
  impossible at the API, DB, and graph layers.

---------------------------------------------------------------------
## 5. AUTHENTICATION & ACCOUNT SECURITY
---------------------------------------------------------------------

### Sign-up methods

- Email + password, with mandatory email OTP verification before access.
- Passwordless email OTP login.
- Google OAuth sign-in (Microsoft optional).

### OTP specification

- 6-digit numeric code, cryptographically random.
- Stored only as a hash. Expires in 10 minutes. Single use.
- Max 5 verification attempts. Max 3 sends per 15 minutes per email and per IP.
- Resend cooldown of 60 seconds.
- Never log OTP values.
- Purposes are distinct and non-interchangeable: VERIFY_EMAIL, LOGIN,
  RESET_PASSWORD, CHANGE_EMAIL, SENSITIVE_ACTION.

### Passwords

- Hashed with argon2id.
- Strength validation.
- Breached-password check (k-anonymity HIBP API) if feasible.

### Sessions

- Short-lived access token plus rotating refresh token in an httpOnly,
  Secure, SameSite cookie.
- Refresh-token reuse detection.
- Device and session list with "log out other devices."

### Additional security

- Optional TOTP 2FA, with recovery codes.
- Account lockout and backoff on repeated failures.
- Login and security event emails (new device, password changed).
- Password reset via OTP or signed link.
- Email change requires re-verification.
- CSRF protection for cookie-authenticated mutations.
- Account deletion: requires re-authentication, a grace period, then hard
  delete of personal data across Postgres, FalkorDB, object storage, and
  queues.

---------------------------------------------------------------------
## 6. ONBOARDING & CANDIDATE PROFILE ("create once, reuse forever")
---------------------------------------------------------------------

### Onboarding wizard

Steps (resumable, saves progress):
1. Upload resume.
2. Review the auto-extracted profile.
3. Set preferences.
4. Answer the core question pack.
5. Connect integrations (optional).
6. Choose automation mode.

### Profile sections (all editable, versioned)

- Personal: full name, preferred name, pronouns (optional), phone, email,
  DOB (optional, sensitive), address, city, state, country.
- Links: LinkedIn, GitHub, portfolio, website, LeetCode, Kaggle, Behance, etc.
- Work experience: employer, title, dates, location, employment type,
  responsibilities, achievements with metrics, technologies.
- Education: institution, degree, field, dates, CGPA or percentage, class
  10/12 details (common in Indian applications), backlogs.
- Certifications, licenses, courses.
- Skills: name, category, proficiency, years of use, last used, and evidence
  links. Must be linked to experiences and projects.
- Projects: role, description, tech stack, outcomes, links, ownership level.
- Achievements, publications, hackathons, awards, volunteering.
- Languages spoken, with proficiency.
- Job preferences:
  - target titles, seniority, industries, company size;
  - locations, remote/hybrid/onsite, relocation;
  - minimum and expected salary with currency (CTC, fixed vs variable for
    India);
  - notice period, earliest joining date;
  - employment type (full-time, internship, contract);
  - blocked companies.
- Work authorization: countries authorized, visa status, sponsorship need.

### Resume parsing

- Upload PDF or DOCX.
- Extract structured data with the LLM into Zod schemas.
- Show a side-by-side review screen. Each extracted fact is marked
  UNVERIFIED until the user confirms it.

### Data model rules

- Every fact has: source (resume_upload / user_input / agent_suggestion /
  org_import), verificationStatus (UNVERIFIED / USER_VERIFIED / SUPERSEDED),
  createdAt, updatedAt, and supersededBy.
- Profile Completeness Score with actionable suggestions, e.g. "Add metrics
  to 2 achievements."
- Corrections persist across sessions and propagate to the graph via the
  outbox.

---------------------------------------------------------------------
## 7. UNIVERSAL APPLICATION QUESTION BANK
---------------------------------------------------------------------

This is a core feature. Build a seeded, extensible taxonomy of questions that
job applications commonly ask. Each canonical question has: key, category,
answer type, sensitivity level, and example phrasings.

### Categories to seed (at least ~150 canonical questions)

- Identity & contact.
- Work authorization & visa: authorized to work, sponsorship now or future,
  visa type.
- Location & relocation, remote preference, willingness to travel.
- Compensation: current CTC, expected CTC, fixed/variable, negotiable,
  currency.
- Availability: notice period, buyout option, earliest start, serving notice.
- Experience: total years, years per skill/tool, management experience,
  domain experience.
- Education: highest degree, graduation year, CGPA/percentage, backlogs,
  gap years.
- Links & documents: portfolio, GitHub, references, writing samples.
- Motivation & behavioral (long-form, generated per job from verified facts):
  - why this company / role;
  - greatest achievement, a challenge you overcame, a conflict example,
    leadership example;
  - strengths and weaknesses;
  - "tell us about yourself";
  - cover-letter style answers.
- Legal & consent: background check consent, non-compete, previously employed
  here, relatives at company, how you heard about us.
- Voluntary self-identification (EEO: gender, ethnicity, disability, veteran)
  - SENSITIVE;
  - always offer "Prefer not to say";
  - never inferred, never auto-filled without explicit stored consent.
- Criminal history and other legally significant answers
  - SENSITIVE;
  - must always be answered explicitly by the user, never inferred.

### Answer model

- Fields: canonicalQuestionKey, value, variants (short / medium / long),
  scope, source, verificationStatus, lastUpdated, usageCount.
- Scope options: global, per-country, per-company, per-role-type.

### Question matching

- Map new real-world question text to canonical keys using:
  1. exact match;
  2. embedding similarity;
  3. LLM classification with a confidence threshold.
- Below threshold → missing-info inbox.

### Learning

- Every new question the user answers becomes reusable procedural memory,
  respecting its scope.

---------------------------------------------------------------------
## 8. DOCUMENTS: RESUMES, CVs, COVER LETTERS
---------------------------------------------------------------------

- Multiple resume versions with labels (e.g. "Backend", "Data", "Internship").
- A master profile drives generated documents.
- Tailored resume generation per job:
  - reorders and selects verified content;
  - rephrases for keywords;
  - never adds unverified claims;
  - shows a diff vs. the base version;
  - requires user approval before first use.
- ATS-friendly templates. PDF and DOCX export (server-side rendering).
- Cover letters: generated per job from verified facts, editable, versioned.
- ATS keyword check: compare a resume against a job description and show
  missing keywords, flagged as "only add if true."
- All files live in private storage, are virus/type-validated, size-limited,
  and served via signed URLs.

---------------------------------------------------------------------
## 9. JOB DISCOVERY ENGINE
---------------------------------------------------------------------

### Discovery inputs

1. Saved searches auto-generated from the profile, user-editable.
2. User-pasted job URLs (any site). Fetch, parse, and normalize where
   permitted. Otherwise create a manual job card from the pasted description.
3. Org-posted opportunities (campus drives, curated jobs).
4. Scheduled background discovery (per plan frequency).

### JobSource interface

Methods:
- searchJobs(query)
- getJobDetails(id)
- normalizeJob(raw)
- getCapabilities() — search / details / apply-supported / rate limits
- healthCheck()

### Adapters (implement those that are accessible; skip unavailable ones gracefully)

- Remotive API (remote jobs).
- Adzuna API (with registered credentials; supports India).
- Greenhouse public job-board API (per-company boards).
- Lever public postings API (per-company).
- Ashby and SmartRecruiters public job boards, if their public endpoints are
  verified to exist.
- Configurable paid aggregators via a generic adapter (subject to
  license/cost).
- A curated list of company career boards (seed list of companies using
  Greenhouse/Lever/Ashby).

Do NOT scrape LinkedIn, Indeed, Naukri, Glassdoor, or other sites whose terms
prohibit automated access. For those, support user-pasted URLs/descriptions
and the browser extension (user-initiated, in the user's own session).

### Source documentation

For each source, document in docs/JOB_SOURCES.md: authentication, rate limits,
freshness, coverage, attribution, retention limits, and apply capability.

### Ingestion pipeline

1. Discover.
2. Normalize to the JobPosting schema.
3. Validate.
4. Deduplicate (provider ID → normalized URL → company + title + location
   fingerprint).
5. Extract requirements (LLM → structured, cached per job).
6. Ingest into FalkorDB.
7. Match.
8. Rank.
9. Deliver to the feed and notifications.

### JobPosting schema

- internalId, provider, providerJobId
- company, title, description (sanitized)
- jobUrl, applyUrl
- location, remoteType, employmentType, seniority
- skills, qualifications
- salary range and currency
- postedAt, lastSeenAt, expiresAt
- attribution, capabilities, status (OPEN / STALE / CLOSED / UNKNOWN)

### Freshness

- Re-verify a listing is open before preparing or submitting.
- Mark stale jobs. Never present unverified listings as open.

---------------------------------------------------------------------
## 10. MATCHING ENGINE (deterministic + explainable)
---------------------------------------------------------------------

### Scoring

Use a weighted, configurable scoring function computed in code, not by the
LLM. Signals:
- required skills with verified evidence;
- preferred skills;
- experience and seniority fit;
- title similarity;
- project relevance;
- location/remote eligibility;
- compensation constraints;
- mandatory qualifications (hard filters);
- freshness;
- already-applied or duplicate status;
- company blocklist.

Hard constraints (work authorization, blocked company, below minimum salary
when salary is known, mandatory degree) are enforced as filters or flags,
never left to the LLM.

### Match result

- score and per-factor breakdown;
- matched skills with evidence paths;
- missing or uncertain requirements;
- supporting experiences and projects;
- disqualifiers;
- concise explanation (LLM may phrase it, using only the computed data);
- recommended next action.

### Other

- Preference changes trigger immediate re-ranking.
- Weights are configurable per user (advanced settings) and per org (default).

---------------------------------------------------------------------
## 11. FALKORDB GRAPH MEMORY
---------------------------------------------------------------------

Use the official client, parameterized Cypher only (never string-concatenated
user input), and stable IDs. Every user-owned node carries tenantId/userId.
Every query is scoped by the authenticated user's ID, injected server-side.

### Nodes

Candidate, Experience, Company, Education, Project, Skill, Evidence, Job,
Requirement, Question, Answer, Memory, Application, Decision, AgentTask,
WorkflowEvent, ResumeVersion, Organization, Cohort.

### Relationships (adapt as needed; document the final schema in docs/GRAPH_SCHEMA.md)

- (Candidate)-[:HAS_EXPERIENCE]->(Experience)-[:AT_COMPANY]->(Company)
- (Experience)-[:CONTRIBUTED_TO]->(Project)-[:DEMONSTRATES]->(Skill)
- (Evidence)-[:SUPPORTS]->(Skill)
- (Evidence)-[:FROM]->(Experience|Project|Education)
- (Job)-[:POSTED_BY]->(Company)
- (Job)-[:HAS_REQUIREMENT]->(Requirement)-[:REQUIRES_SKILL]->(Skill)
- (Skill)-[:RELATED_TO {weight}]->(Skill)   (e.g. Postgres ↔ SQL)
- (Candidate)-[:HAS_ANSWER]->(Answer)-[:ANSWERS]->(Question)
- (Candidate)-[:HAS_MEMORY]->(Memory)
- (Application)-[:FOR_JOB]->(Job)
- (Application)-[:USED_RESUME]->(ResumeVersion)
- (Application)-[:HAS_EVENT]->(WorkflowEvent)
- (Decision)-[:ABOUT]->(Job|Application)
- (Decision)-[:JUSTIFIED_BY]->(Evidence)
- (AgentTask)-[:DEPENDS_ON]->(AgentTask)
- (AgentTask)-[:HANDED_OFF_TO]->(AgentTask)
- (Candidate)-[:MEMBER_OF]->(Cohort)-[:PART_OF]->(Organization)

### Memory types

- Episodic: sessions, outcomes, corrections, workflow events, past decisions.
- Semantic: verified facts, skills, achievements, requirements, provenance.
- Procedural: question mappings, successful workflow patterns, per-site form
  mappings, recovery procedures, user-approved automation preferences.

Every memory has: owner, source, createdAt, verificationStatus, and
expiry/supersession metadata. LLM suggestions are never auto-promoted to
verified facts.

### Operations

- Upsert, retrieve (relevance + recency), correct, supersede, and resolve
  conflicts (ask the user when two facts conflict).

### Multi-hop queries (implemented as typed agent tools)

- Job → Requirement → Skill ← Evidence ← Project ← Experience ← Candidate
  (evidence for a match).
- Question → Answer (scoped) → provenance (can we truthfully answer this?).
- Skill gap analysis across all saved jobs (which missing skill unlocks the
  most jobs).

### Frontend graph explorer

- React Flow.
- Clickable nodes, relationship labels, evidence detail panel, and a
  "why this match" path highlight.

---------------------------------------------------------------------
## 12. AGENT ARCHITECTURE
---------------------------------------------------------------------

The orchestrator controls specialist agents through structured messages that
reference graph/DB entity IDs, not full chat histories. Task state, dependencies,
and handoffs are persisted (Postgres workflow tables + FalkorDB AgentTask nodes).

### Agents

- Orchestrator: starts and resumes workflows, loads authenticated context,
  dispatches tasks, enforces permissions and plan quotas, handles errors.
- Memory agent: retrieves, adds, updates, and supersedes facts; resolves
  conflicts by asking the user; explains provenance.
- Discovery & matching agent: builds search params, calls adapters, dedupes,
  extracts requirements, ranks, explains.
- Application agent: selects resume, maps questions to answers, drafts
  long-form answers and cover letters, identifies missing info, prepares
  submission packets, reports status.
- Outreach agent: finds context, drafts recruiter emails and follow-ups,
  requests approval, sends only approved content.
- Tracker agent: reads authorized mailbox messages, classifies application
  updates (received / assessment / interview / rejection / offer), proposes
  status changes, extracts interview dates.
- Career coach agent (optional, paid tiers):
  - skill-gap insights;
  - resume improvement suggestions;
  - interview prep questions per job, generated from the JD + profile.

### Rules

- Tools have explicit schemas, auth checks, timeouts, and bounded permissions.
- The LLM proposes. Deterministic code validates and executes.
- AI decisions, external actions, and DB mutations are separate steps, so no
  LLM output can bypass workflow rules, approvals, or quotas.

---------------------------------------------------------------------
## 13. APPLICATION CHANNELS & EXECUTION
---------------------------------------------------------------------

### Channels, in order of preference

A. Official APIs or endpoints that permit candidate-side submission.
   Verify per provider; do not assume.
B. Browser extension "Assisted Apply" (Chrome MV3):
   - runs in the user's own logged-in browser;
   - detects application forms;
   - autofills from the profile and question bank;
   - uploads the chosen resume;
   - highlights unknown fields;
   - the user reviews and clicks Submit (or auto-submit only where the site
     permits and the user enabled it);
   - reports the result back to the tracker;
   - learns per-site field mappings (procedural memory).
C. Server-side Playwright automation, ONLY for sites/ATS where automated
   submission is permitted. Pause on CAPTCHA, MFA, or unusual flows.
D. Email application: when a job says "send your CV to X", draft an email
   with the tailored resume via the connected mailbox (approval-gated).
E. Manual fallback:
   - generate a complete "application packet" (tailored resume, cover letter,
     answers with copy buttons, apply link);
   - the user applies and clicks "Mark as applied."

### Execution modes

- PREPARE_ONLY
- APPROVAL_REQUIRED (default)
- AUTO_APPLY (opt-in, per channel and category, only where permitted and all
  preconditions pass)

### User/org automation rules

- target titles, seniority, locations, companies (allow/block);
- minimum compensation, minimum match score;
- daily application cap;
- allowed channels;
- categories that always need approval.

### State machine (persisted, resumable after restart)

DISCOVERED
→ SAVED
→ QUEUED
→ JOB_VALIDATED
→ PROFILE_MATCHED
→ APPLICATION_PREPARED
→ WAITING_FOR_USER | AWAITING_APPROVAL
→ READY_TO_SUBMIT
→ SUBMITTING
→ SUBMITTED | SUBMISSION_UNCERTAIN | FAILED | NEEDS_INTERVENTION | CANCELLED

### Per-application steps

1. Re-verify the listing.
2. Check for duplicates and previous applications (fingerprint).
3. Check hard eligibility.
4. Retrieve graph memory.
5. Select or tailor the resume.
6. Map questions.
7. Draft answers.
8. Raise missing-info requests.
9. Persist user replies.
10. Prepare the submission.
11. Enforce the approval policy.
12. Submit via the allowed channel.
13. Confirm the result.
14. Store a full record (documents, answers, timestamps, channel, result).
15. Update the tracker and graph.

### Safety

- Idempotency keys on all external actions.
- On timeout → status check before any retry.
- Never blindly retry irreversible actions. SUBMISSION_UNCERTAIN requires user
  confirmation.

---------------------------------------------------------------------
## 14. APPLICATION TRACKING ("every step of every job")
---------------------------------------------------------------------

### Pipeline stages (customizable per user)

- Saved
- Preparing
- Applied
- Application Viewed / Acknowledged
- Online Assessment
- Interview Round N (multiple rounds, typed: HR / technical / managerial /
  assignment)
- Offer
- Accepted / Declined
- Rejected
- Withdrawn
- No Response (auto-suggested after a configurable number of days)

### Per-application detail page

- Full timeline of events: agent actions, user actions, emails, and status
  changes, each with source and timestamp.
- Documents and answers exactly as submitted (immutable snapshot).
- Contacts (recruiter, hiring manager), notes, and attachments.
- Interview schedule:
  - date/time, mode, link, prep notes, generated likely questions;
  - .ics export and optional Google/Outlook calendar sync.
- Offer details: CTC, joining date, deadline. Offer comparison view.
- Follow-up reminders and approval-gated follow-up email drafts.

### Email-based status detection (with mailbox connected)

- The tracker agent classifies relevant emails.
- It proposes the status change. It auto-applies only if the user enabled
  that and confidence is high.
- It always links the source email.

### Views and analytics

- Views: Kanban board, table view (filter/sort/search/export CSV), and
  calendar.
- Candidate analytics:
  - applications over time, response rate, interview rate, offer rate;
  - performance by source/channel/resume version;
  - top missing skills;
  - average time per stage.
- Only real data is shown. Empty states are honest.

---------------------------------------------------------------------
## 15. MISSING-INFO INBOX & APPROVAL CENTER
---------------------------------------------------------------------

### Missing-info request contents

- job and company;
- original question;
- why the info is missing or uncertain;
- evidence-backed suggestion (if any) with source;
- answer field;
- scope selector ("use for all future applications" / "only this company" /
  "only this time");
- "Save & resume."

### On answer

1. Validate.
2. Save to profile/answer bank.
3. Upsert graph nodes with provenance.
4. Resume the suspended workflow.
5. Reuse according to scope.

### Approval center

- Shows the exact submission or email: recipient/site, resume version,
  answers, cover letter, attachments.
- Approve, edit, or reject.
- Approval is bound to a content hash. Any change requires re-approval.
- Bulk approval for multiple applications, with a per-item summary.
- Org policy may route items to a MENTOR for review first.

### Notifications

- In-app, email, and optional daily digest.

---------------------------------------------------------------------
## 16. EMAIL INTEGRATION & RECRUITER OUTREACH
---------------------------------------------------------------------

### Mailbox connections

- Gmail API and Microsoft Graph via OAuth with minimal scopes, explained to
  the user before connecting.
- Never request or store mailbox passwords.
- Tokens are encrypted at rest (envelope encryption).
- Secure refresh, revocation, and disconnect that deletes tokens.
- Document Google restricted-scope verification and security assessment
  requirements, and Microsoft publisher verification, in docs/BLOCKERS.md.

### Outreach workspace

Inputs:
- recipient email (user-provided; do not scrape personal emails);
- job URL or description;
- optional context.

Outputs:
- personalized subject and body from verified achievements;
- attachments.

Flow:
- edit, approve, send (approval bound to exact content);
- record the send result;
- schedule follow-ups (approval-gated);
- track replies (if read scope granted).

Compliance and limits:
- per-user daily send limits;
- an unsubscribe/opt-out note where appropriate;
- honor anti-spam laws.

### Verification and OTP emails for job-site accounts

- Read only relevant messages, when authorized.
- Link them to the active workflow.
- Keep codes in short-lived protected memory; never log them.
- Stop and hand off to the user when human verification is required.

---------------------------------------------------------------------
## 17. DASHBOARDS
---------------------------------------------------------------------

### Candidate dashboard

- Today's top matches.
- Pending approvals.
- Missing-info requests.
- Upcoming interviews.
- Pipeline summary.
- Response/interview/offer rates.
- Profile completeness.
- Agent activity feed.
- Usage vs. plan limits.

### Org admin dashboard (placement cell / coaching)

- Seats used and available.
- Onboarding funnel (invited → registered → profile complete → actively
  applying).
- Cohort-level metrics: applications, interviews, offers, placement rate,
  top companies, top roles, median offered CTC (only for consenting
  students).
- Skill-gap heatmap across the cohort.
- At-risk students (inactive, low profile completeness).
- Export reports (CSV/PDF) for accreditation and placement records.
- Post opportunities and drives to cohorts. Track who applied.

### Mentor dashboard

- Assigned students, pending reviews, comments on resumes and drafts.

### Super-admin panel

- Users, orgs, plans, coupons, feature flags.
- Job-source health, queue dashboards (Bull Board), failed jobs.
- LLM cost by tenant.
- Abuse flags.
- Audit log search.
- Support access only with user consent and full audit.

---------------------------------------------------------------------
## 18. FRONTEND PAGES
---------------------------------------------------------------------

### Public

- Landing (with separate sections for Individuals / Colleges / Coaching)
- Pricing
- Login, Register, OTP verify, Forgot password
- Legal pages (Terms, Privacy, Refund policy — required by Indian payment
  gateways)
- Contact / demo request for organizations

### Candidate

1. Onboarding wizard
2. Dashboard
3. Profile
4. Question bank / Saved answers
5. Resumes & cover letters
6. Job feed
7. Job detail + match explanation
8. Application tracker (Kanban/table/calendar)
9. Application detail timeline
10. Missing-info inbox
11. Approval center
12. Outreach workspace
13. Career graph explorer
14. Agent activity & decision timeline
15. Integrations
16. Automation preferences
17. Subscription & usage
18. Notifications
19. Privacy (consent, export, deletion), Security (sessions, 2FA)

### Org

- Org dashboard
- Cohorts
- Students (list/detail with consent-gated fields)
- Invitations / CSV import
- Opportunities / drives
- Reports
- Org settings and branding
- Billing & seats
- Admins & mentors

### Mentor

- Assigned students
- Review queue

### Super admin

- As described in Section 17.

### UI requirements

- Responsive and mobile-friendly.
- Accessible (WCAG AA).
- Light/dark mode.
- Skeleton loaders, toasts, and honest empty states.
- Consistent design system.
- Status badges distinguishing VERIFIED / AI SUGGESTION / MISSING / PENDING /
  SUBMITTED (confirmed) / UNCERTAIN / FAILED / DEV MOCK.

---------------------------------------------------------------------
## 19. PLANS, BILLING & USAGE
---------------------------------------------------------------------

### Plans and entitlements

- Plans are DB-configured (editable in the super-admin panel), not hardcoded.
- Entitlements per plan:
  - job discovery runs/day and sources available;
  - matched jobs visible;
  - prepared applications/month and auto-apply allowance;
  - tailored resumes/month, AI credits (tokens);
  - outreach emails/day;
  - mailbox tracking, extension access, coach features, analytics depth.

### Seed plans (example values, owner will adjust)

- Individual: Free, Pro, Premium (monthly + annual discount).
- Organization:
  - College plan (per-seat annual, minimum seats);
  - Coaching plan (per-seat, per-batch duration);
  - Custom/Enterprise (contact sales).
- Add-ons: extra credit packs.

### Payments

- Razorpay for India (subscriptions + one-time).
- Stripe for international.
- Both behind a PaymentProvider interface.
- Webhooks are verified (signature), idempotent, and the source of truth.
  Never mark payment success from the client redirect.

### Billing features

- trials, coupons/promo codes;
- upgrade/downgrade with proration rules;
- cancellation at period end;
- failed-payment dunning with a grace period;
- GST-compliant invoices (GSTIN capture for orgs), downloadable PDFs;
- org billing: seat purchase, add seats, seat expiry, offline invoice /
  purchase-order flow for colleges (manual activation by super admin).

### Enforcement

- Quotas enforced in the backend (middleware + worker checks), with clear
  UI meters and upgrade prompts.
- Billing is fully optional in local dev (a "free-dev" provider).

---------------------------------------------------------------------
## 20. API DESIGN
---------------------------------------------------------------------

### Conventions

- REST under /api/v1.
- Zod validation on every input and output.
- OpenAPI spec generated and served at /api/docs.
- Cursor pagination.
- Structured errors {code, message, details, requestId}.
- Idempotency-Key header on mutating external-action endpoints.
- Rate limiting per IP, user, and org.
- Slow operations return {workflowId} immediately. Status via polling or
  SSE/WebSocket.

### Endpoint groups (implement fully; document the final list)

- auth: register, verify-otp, resend-otp, login, otp-login, refresh, logout,
  forgot/reset, sessions, 2fa, oauth callbacks
- profile, experiences, education, projects, skills, preferences
- questions, answers
- documents: resumes, cover letters, tailor, export
- jobs: search, discover, import-url, :id, save, dismiss
- matches: explain
- applications: create, list, :id, events, status, resume, decision,
  mark-applied
- inbox (missing info)
- approvals
- outreach: drafts, send, follow-ups
- memory: search, feedback/correction
- graph: paths for a job / application
- agent-tasks
- notifications
- integrations: connect, callback, disconnect
- extension: auth token exchange, autofill-data, report-result
- usage
- billing: plans, checkout, portal, webhooks/:provider, invoices
- org: orgs, members, invitations, csv-import, cohorts, seats, opportunities,
  analytics, reports, branding, consent
- admin: super-admin namespace, separately guarded
- health: /healthz, /readyz

---------------------------------------------------------------------
## 21. BACKGROUND WORKERS & RELIABILITY
---------------------------------------------------------------------

### Queues

- discovery
- parsing
- requirement-extraction
- matching
- graph-projection (outbox)
- application-prep
- submission
- email-sync
- notifications/digests
- billing-sync
- cleanup/retention

### Requirements

- Persisted workflow state; recovery after restart.
- Bounded retries with exponential backoff and jitter.
- Timeouts.
- Idempotency.
- Failed-job inspection.
- Per-user and per-org concurrency limits and rate limits.
- Cancellation.
- Graceful shutdown.
- Worker health checks.
- Scheduled jobs (repeatable) for discovery and digests.
- No blind retries of irreversible external actions.

---------------------------------------------------------------------
## 22. SECURITY, PRIVACY & COMPLIANCE
---------------------------------------------------------------------

### Security

- OWASP Top 10 coverage.
- Helmet, strict CORS, CSRF.
- Input validation and output encoding.
- Safe uploads: type sniffing, size limits, malware scan hook, private bucket.
- Field-level encryption for sensitive data (tokens, EEO/sensitive answers,
  DOB, phone).
- Least-privilege DB users.
- Secrets only via environment or secret manager.
- Dependency scanning, secret scanning, SAST in CI.

### Audit and prompt-injection defense

- Audit log of security events, admin actions, consent changes, approvals,
  and submissions.
- Prompt-injection defense:
  - external content is wrapped as data;
  - system policies are enforced in code;
  - tools cannot be invoked based on instructions found in external content.

### Privacy and compliance

- India DPDP Act 2023: consent notices, purpose limitation, data principal
  rights (access, correction, erasure), grievance contact.
- GDPR-style rights for international users.
- Full data export (JSON + files).
- Account and org deletion.
- Configurable retention policies.
- Org data-processing terms for institutional customers.
- Document all third-party terms (job sources, Google/Microsoft API policies,
  payment providers) in docs/COMPLIANCE.md before commercial launch.

---------------------------------------------------------------------
## 23. OBSERVABILITY & OPERATIONS
---------------------------------------------------------------------

- Structured logs with requestId, userId, and orgId (no PII or secret values).
- Sentry in web, api, and worker.
- OpenTelemetry traces across api → queue → worker → external calls.
- Metrics:
  - queue depth, job latency, LLM tokens and cost per tenant;
  - source health, submission success rates.
- docs/RUNBOOK.md: common incidents, rotating secrets, rebuilding graph
  projection, replaying failed jobs, restoring backups.

---------------------------------------------------------------------
## 24. DEPLOYMENT
---------------------------------------------------------------------

### Local

Docker Compose with:
- web, api, worker;
- postgres, redis, falkordb, minio, mailpit.

Also provide:
- health checks and volumes;
- seed scripts: demo users, demo org with cohort, question bank, synthetic
  jobs;
- one command to start: `pnpm dev` or `docker compose up`.

### Production

- Hosted frontend (CDN).
- Containerized api and worker.
- Managed Postgres with backups.
- Managed Redis.
- Persistent FalkorDB (FalkorDB Cloud or a persistent volume with backups).
- S3/R2 storage.
- HTTPS, restricted DB network access.
- Secrets in the platform's secret manager.
- Choose providers by current pricing and availability; document the choice
  and monthly cost estimate.

### CI/CD (GitHub Actions)

- Install, typecheck, lint, unit and integration tests (service containers).
- E2E tests (Playwright against the compose stack).
- Build images, run migrations, deploy.
- Post-deploy health check.

### Configuration

- .env.example lists all variables with safe placeholders.
- Config is validated at startup with Zod; fail fast with non-sensitive
  messages.

---------------------------------------------------------------------
## 25. TESTING & ACCEPTANCE CRITERIA
---------------------------------------------------------------------

Unit, integration, and E2E tests. Third-party services are mocked in automated
tests and labeled as mocks. Must demonstrate:

1. Register → email OTP verify → login → OTP rate limiting and expiry work.
2. Password reset and session revocation work.
3. Resume upload → parse → review → verified profile.
4. Question bank: new question mapped to a canonical key; unknown question
   → inbox.
5. Jobs fetched from ≥1 live source; multiple sources normalize to one
   schema; duplicates detected.
6. Graph contains candidate ↔ evidence ↔ skill ↔ requirement ↔ job paths;
   match explanation returned.
7. A correction persists across sessions and changes later behavior.
8. Workflow pauses on missing info and resumes after the answer.
9. Approval is bound to a content hash; an edit forces re-approval.
10. Submission is recorded as SUBMITTED only after confirmation;
    SUBMISSION_UNCERTAIN never triggers blind retry.
11. Outreach email cannot be sent without approval.
12. Email classifier proposes the correct status update (mocked emails).
13. Plan quotas are enforced server-side; webhook-driven subscription state
    changes work.
14. Org admin invites via CSV, assigns seats, sees aggregate analytics; cannot
    see non-consented individual data.
15. Cross-user and cross-org isolation tests pass at the API, DB, and graph
    layers.
16. Missing or invalid credentials produce actionable errors; the app still
    runs.
17. Clean clone → documented commands → app running locally.
18. Production deploy passes health checks.

---------------------------------------------------------------------
## 26. BUILD PHASES (execute in order; each ends with green tests + updated PLAN.md)
---------------------------------------------------------------------

Phase 1 — Foundation:
- monorepo, tooling, docker-compose, config validation, Prisma base schema;
- auth with email OTP, sessions, app shell with routing and design system;
- CI pipeline.

Phase 2 — Profile:
- onboarding wizard, resume upload/parse/review, full profile CRUD;
- question bank seed + answers, completeness score.

Phase 3 — Graph:
- FalkorDB schema, outbox projection, memory operations, tenant-isolation
  tests.

Phase 4 — Discovery:
- JobSource interface, first live adapter, normalization, dedup, requirement
  extraction, job feed, URL import.

Phase 5 — Matching:
- deterministic scoring, graph evidence paths, match explanation UI, graph
  explorer.

Phase 6 — Applications:
- workflow state machine, agents + tool registry, missing-info inbox,
  approvals, manual-fallback packet, tracker (Kanban/table/timeline).

Phase 7 — Execution channels:
- browser extension assisted apply;
- one permitted automated channel or email-apply.

Phase 8 — Email:
- Gmail/Microsoft OAuth, outreach workspace, status detection, reminders,
  interviews.

Phase 9 — Billing:
- plans/entitlements, quotas, Razorpay + Stripe, invoices, usage dashboard.

Phase 10 — Organizations:
- orgs, roles, invites/CSV, cohorts, seats, consent, org/mentor dashboards,
  branding, opportunities.

Phase 11 — Admin & hardening:
- super-admin panel, audit logs, export/delete, security review,
  observability, rate limits.

Phase 12 — Deploy & docs:
- production deploy, README, architecture diagram, GRAPH_SCHEMA, API docs,
  RUNBOOK, DEMO script.

Prioritize complete vertical slices over many half-built integrations.

---------------------------------------------------------------------
## 27. DEFINITION OF DONE
---------------------------------------------------------------------

### A new individual user can

- sign up with OTP;
- build a profile from a resume and verify facts;
- fill the question bank;
- discover and rank real jobs;
- inspect why a job matches (graph path);
- prepare a tailored application;
- answer missing-info requests and resume;
- approve and submit via a working permitted channel (or manual fallback);
- send approved recruiter outreach;
- track every stage, including interviews and offers;
- return later and see the agent remember corrections;
- manage their subscription.

### An organization can

- buy or activate seats;
- invite students in bulk;
- organize cohorts;
- post opportunities;
- view consent-respecting analytics;
- export reports.

### The platform operator can

- manage plans, orgs, users, sources, and queues from the super-admin panel.

### Overall

- Everything runs together in production with health checks, monitoring, and
  backups.
- Documentation is complete.

---------------------------------------------------------------------
## APPENDIX A — HACKATHON MODE (FalkorDB Graph Hacks)
---------------------------------------------------------------------

If preparing the hackathon submission:
- Primary track: Agent Memory & Coordination.
- Secondary track: Agents That Act on Connected Data.

FalkorDB must drive real decisions:
- multi-hop evidence retrieval;
- persistent cross-session memory;
- shared agent task state and handoffs;
- graph queries exposed as agent tools;
- traceable decisions;
- graph visualization tied to a live workflow.

Seed a synthetic demo candidate plus synthetic jobs.

Demo script:
1. Discover a job.
2. Traverse evidence.
3. Draft the application.
4. Agent asks for missing info.
5. User corrects a fact.
6. New session: the agent reuses the correction.
7. Show the decision path in the graph explorer.

Never claim a real submission unless confirmed. Verify current hackathon rules,
dates, and submission format before submitting.