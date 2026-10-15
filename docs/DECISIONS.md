# Architecture Decision Records (ADR) — CareerGraph AI

This document logs significant technical decisions made during the design and implementation of CareerGraph AI.

---

## ADR-001: Monorepo Structure with pnpm Workspaces & Turborepo

### Status
Accepted

### Context
CareerGraph AI requires coordinated development across an API server, background BullMQ workers, a web frontend, a future Chrome extension, and shared packages (types, DB schema, graph queries, agents).

### Decision
Use a monorepo managed with **pnpm workspaces** and **Turborepo**:
- `apps/api`: Express + TypeScript REST API
- `apps/web`: React 18 + Vite + TypeScript + Tailwind CSS
- `apps/worker`: BullMQ background job processor
- `packages/shared`: Shared Zod schemas, DTOs, and constants
- `packages/db`: Prisma schema, PostgreSQL client, and migrations
- `infra/`: Docker compose configuration for containerized deployment

### Consequences
- Single version of shared types and domain schemas across all tiers.
- Fast, cached builds via Turborepo.
- Strict package isolation prevents circular dependencies.

---

## ADR-002: Local Development via Native macOS Homebrew Services

### Status
Accepted

### Context
Docker is not currently installed on the host macOS environment (`zsh: command not found: docker`). Attempting to force Docker execution causes immediate environment failure.

### Decision
For local development, utilize native Homebrew background services already installed and verified on the host:
- **PostgreSQL 16**: Running on `localhost:5432`, database `careergraph`, owner `careergraph`
- **Redis 7**: Running on `localhost:6379`
- **Mailpit**: Running on `localhost:1025` (SMTP) and `localhost:8025` (Web UI & HTTP API)

Production container definitions remain in `infra/docker-compose.yml` and Dockerfiles for deployment.

### Consequences
- Zero-latency local execution without virtualization overhead.
- Test suites run directly against local database and Redis services.
- Real SMTP emails can be inspected locally via Mailpit at `http://localhost:8025`.

---

## ADR-003: Authentication, OTP Security & Session Management

### Status
Accepted

### Context
Section 5 of `PRODUCT_SPEC.md` mandates strict authentication requirements:
- Mandatory email OTP verification before access
- 6-digit numeric cryptographically secure OTP
- OTPs stored only as hashes, 10-minute expiry, single-use
- Rate limits: max 5 attempts, max 3 sends per 15 minutes, 60s cooldown
- Distinct OTP purposes (`VERIFY_EMAIL`, `LOGIN`, `RESET_PASSWORD`, etc.)
- Argon2id password hashing
- Short-lived JWT access tokens + rotating refresh tokens in `httpOnly` cookies with reuse detection

### Decision
1. **Password Hashing**: Use `argon2` (argon2id variant) with minimum memory/iteration security parameters.
2. **OTP Generation & Storage**: Generate 6-digit numeric codes with `crypto.randomInt(100000, 1000000)`. Store only `crypto.createHash('sha256').update(code).digest('hex')` in PostgreSQL. Clear upon verification.
3. **Rotating Refresh Tokens**: Issue random refresh tokens, store their SHA-256 hash with user ID, family ID, device info, and expiration. If an already-used or revoked refresh token is presented, revoke the entire token family (reuse detection).
4. **Transport**: Access tokens returned in JSON responses; refresh tokens stored in `httpOnly`, `Secure`, `SameSite=Strict` cookies.

### Consequences
- Complete compliance with Section 5 security standards.
- OTP values are never stored or logged in plain text.
- Token theft is mitigated by automatic session revocation upon token reuse.

---

## ADR-004: Dual-Store Pattern: PostgreSQL System of Record & FalkorDB Graph Memory

### Status
Accepted

### Context
Section 3 and 11 define PostgreSQL as the System of Record and FalkorDB as the Agent Memory and Reasoning Graph. Data must never get out of sync.

### Decision
Implement the **Transactional Outbox Pattern**:
- All mutations (profile updates, job discoveries, applications) write outbox events to the `OutboxEvent` table in PostgreSQL within the same database transaction.
- Background workers read unprocessed outbox events, project them idempotently into FalkorDB Cypher nodes and relationships, and mark events as processed.
- Graph queries are never string-concatenated; all use parameterized Cypher with injected tenant IDs.

### Consequences
- Guarantees eventual consistency between relational tables and graph nodes.
- Graph can be completely rebuilt at any time from PostgreSQL outbox and entity tables.

---

## ADR-005: AI Layer via OpenAI-Compatible Endpoint (NVIDIA NIM, z-ai/glm-5.3)

### Status
Accepted

### Context
Phases 1–11 implemented the application-preparation specialists (resume tailoring, cover letters, screening answers) and matching deterministically. The product now needs an interactive LLM copilot and higher-quality document drafting. The team has NVIDIA NIM API credentials for the `z-ai/glm-5.3` model served through an OpenAI-compatible REST surface. The zero-hallucination policy (Spec §12) and the adversarial prompt-injection defenses (Spec §22) must still hold, and CI/test runs must stay deterministic and offline.

### Decision
1. **Provider abstraction**: Use the official `openai` npm SDK with `baseURL` pointed at `https://integrate.api.nvidia.com/v1` and `model: z-ai/glm-5.3`. Any OpenAI-compatible gateway (OpenAI, Groq, Together, OpenRouter, local vLLM/Ollama) can be swapped purely via env (`AI_BASE_URL`/`AI_MODEL`/`AI_API_KEY`).
2. **Credentials**: The real key lives only in git-ignored `.env`; `.env.example` ships an empty placeholder.
3. **Hard enablement gate**: `isLLMEnabled()` returns false when `NODE_ENV=test`, when `AI_ENABLED=false`, or when the key/base URL is missing — all AI-enhanced paths then use the deterministic agents. There is no test-network dependency and no silent paid-call risk in CI.
4. **Grounding enforcement**: Every LLM prompt receives candidate facts inside `<candidate_facts>` boundaries; external job text is pre-wrapped by the Phase-11 sanitizer inside `<UNTRUSTED_EXTERNAL_DATA>`; structured outputs are Zod-validated and post-checked (bullets must reference real tokens, highlighted skills ⊆ required skills, cover-letter signature must match).
5. **Transparent fallback**: Any LLM error, timeout, or malformed output falls back to the deterministic specialist agents; the copilot response carries a `mode: LLM | DETERMINISTIC_FALLBACK` badge so the UI can honestly show what generated the answer.

### Consequences
- Interactive copilot + streaming (SSE) available when configured; platform fully functional (and tests fully green) with the LLM off.
- No vendor lock-in; switching providers is a configuration change.
- Hallucination surface minimized by schema validation + grounding post-checks, but final human approval gates (Phase 7) remain the authoritative guardrail.

---

## ADR-006: Light Modern UI (Open-Source Aesthetic) as the Single Design Language

### Status
Accepted

### Context
The web app and extension shipped with a dark glassmorphism theme. The product direction calls for a light, modern, open-source-project-style aesthetic: white canvas, blueprint grid accents, crisp borders, and a small number of accent hues. The codebase has ~12,000 lines of TSX using Tailwind dark-theme tokens (`bg-[#060911]`, `bg-navy-*`, `text-slate-300/400`, `border-white/10`, `bg-white/5`).

### Decision
1. **Single light theme** (no dark-mode toggle): `body` canvas `#f8fafc`, slate ink hierarchy (`slate-900/600/500`), sky→indigo primary gradient, semantic accents (amber approvals, emerald orgs, rose admin).
2. **Token remap, not redesign**: a mechanical dark→light class migration across all 18 TSX files — `bg-[#060911]`→`bg-white`, `text-slate-400`→`text-slate-500`, `text-slate-300`→`text-slate-600`, `border-white/10|5`→`border-slate-200`, `bg-white/5|10`→`bg-slate-50|100` — preserving every layout and interaction; solid brand-gradient buttons intentionally keep `text-white` for contrast.
3. **Signature elements**: `.bg-grid` blueprint grid backdrop on the landing hero, mono-font status chips (open-source style), white cards with 1px slate borders replacing translucent glass.
4. **Design tokens stay in Tailwind/CSS**: no component-library migration; the same `tailwind.config.js` palette drives both themes' accents.

### Consequences
- One coherent, light, open-source-tool aesthetic across web + extension HUDs.
- `darkMode: 'class'` remains in the Tailwind config for a future dark-mode toggle without a migration.
- Screenshots/branding present a friendly, trustworthy SaaS look.

---

## ADR-007: Deterministic-First ATS Scoring with Grounded LLM Suggestions

**Status:** Accepted (Phase 16)

### Context
Candidates need immediate, trustworthy feedback on resume quality ("Will ATS parse this? Will a recruiter shortlist it?"). Commercial ATS checkers are opaque keyword-matchers. CareerGraph already holds the two highest-signal data sets for this: the raw resume text and the verified career graph (skills, experiences, projects, target roles).

### Decision
1. **Deterministic 7-category engine is the source of truth** — contact info, standard sections, action verbs, quantified impact, keyword match, readability/length, profile depth — each 0–100, averaged into a 0–100 score with A+–D grades. No network calls required; identical score for identical input.
2. **LLM only enriches suggestions** — when the AI layer is enabled, grounded prompts (profile facts + target-job skills, zero-hallucination guardrails) add role-specific improvement advice on top of deterministic suggestions; failures silently degrade to the deterministic set.
3. **Latest-resume semantics** — score/grade/full-report are persisted on `CandidateProfile` at every check, so `resumeAtsScore` always describes the newest uploaded resume; `GET /resumes/ats/latest` replays the stored report without recomputation.
4. **Profile assets stored on the profile row** — profile picture (data-URL), video intro (https URL), and cover letter (text) with strict Zod limits, surfaced through the same `GET /profile` read path as everything else.

### Consequences
- Scores are explainable, reproducible, and testable (11-test regression suite) — no vendor lock-in.
- Suggestions get smarter as the AI layer/target job context improves, without ever risking the score's integrity.
- Large base64 pictures inflate the profile row; a future ADR may move assets to object storage if payload sizes grow.
