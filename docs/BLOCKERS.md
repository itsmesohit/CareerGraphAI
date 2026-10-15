# External Blockers & Action Items — CareerGraph AI

This document tracks all external blockers, missing API credentials, platform verification hurdles, and required owner actions per rule 4 of `PRODUCT_SPEC.md`.

---

## 1. Security Alert: Credential Hygiene & Rotation

### Description
During earlier development iterations, third-party credentials (Resend API key and Gmail App Password) were provided in working directories:
- Resend API Key: `[REDACTED]`
- Gmail App Password: `[REDACTED]`

### Investigation Findings
- A repository scan confirms that these credentials were stored solely in the untracked, git-ignored file `legacy/server/.env` and were **never committed to Git history or `HEAD`**.
- All hardcoded defaults have been purged from source code files (`env.ts`).

### Action Required by Owner
1. **Rotate Resend API Key**:
   - Go to [Resend Dashboard -> API Keys](https://resend.com/api-keys).
   - Revoke the existing key and create a fresh restricted key.
2. **Rotate Gmail App Password**:
   - Go to Google Account Security -> App Passwords.
   - Revoke the app password and generate a new one if Gmail SMTP fallback is used.
3. **Environment Security**:
   - Store all production credentials exclusively in non-committed `.env` files or your deployment platform's secret manager.

---

## 2. Docker Daemon Not Available on Host

### Description
The macOS development environment does not currently have Docker Desktop or Docker Engine installed (`zsh: command not found: docker`).

### Impact
Cannot run containerized multi-container stacks via `docker compose up` locally on this machine.

### Mitigation & Workaround
The host has Homebrew-managed native services running locally:
- **PostgreSQL 16**: Port 5432 (`careergraph` database)
- **Redis 7**: Port 6379
- **Mailpit**: Port 1025 (SMTP) and 8025 (Web UI)

This allows local execution of all Phase 1 capabilities without virtualization. `infra/docker-compose.yml` remains available for CI/CD and production environments.

### Action Required by Owner (Optional)
Install Docker Desktop if containerized local execution is desired in the future:
```bash
brew install --cask docker
```

---

## 3. Google OAuth & Microsoft Graph Verification (Phase 8 Deferred)

### Description
Section 16 requires Gmail API (`gmail.send`, `gmail.readonly`) and Microsoft Graph mail scopes for outreach and status tracking.

### Blockers
1. **Google Cloud Console**:
   - Requires Google OAuth Consent Screen verification.
   - Sensitive and restricted scopes require a third-party security assessment (CASA Tier 2) for production multi-tenant deployment.
2. **Microsoft Entra ID**:
   - Requires verified publisher status for multi-tenant enterprise access.

### Mitigation in Local Dev
- Use Mailpit locally and Resend verified domain for system transactional emails.
- Implement real OAuth interfaces with explicit development mocks until verification credentials are provided.

---

## 4. Payment Gateway Webhooks (Phase 9 Deferred)

### Description
Razorpay (India) and Stripe (International) require merchant account verification and webhook secret keys for live billing.

### Mitigation in Local Dev
- Implement the `PaymentProvider` interface with a `free-dev` simulated provider in local mode.
