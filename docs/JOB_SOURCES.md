# Job Sources Specification & Registry — CareerGraph AI

This document catalogs all supported job sources, live board adapters, and user-initiated ingestion channels per Spec Section 9.

---

## 1. Source Capabilities Matrix

| Source Provider | Type | Auth Required | Rate Limits | Coverage | Freshness Verification | Apply Capability | Attribution |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Remotive** | Public API | None | ~1 req / sec | Worldwide Remote Tech (Engineering, Product, DevOps) | Verified publication dates; checked on discovery | External Apply URL | Powered by Remotive API |
| **Greenhouse** | Public ATS Boards | None | Standard HTTP limits per board | High-growth & enterprise tech companies (e.g. Stripe, Figma, Cloudflare, GitLab) | Re-verified via board JSON timestamp | Direct ATS application URL | Greenhouse Job Board |
| **Lever** | Public Postings API | None | Standard HTTP limits | Modern tech companies (e.g. Spotify, Atlassian, Palantir, Brex) | Active status queried via API | Direct ATS application URL | Lever Postings API |
| **Adzuna** | Aggregator API | App ID & Key | 250 requests / day (free tier) | Global aggregator (India, United States, United Kingdom) | Redirect URL validated | Redirect to Publisher | Powered by Adzuna API |
| **Ashby** | Public ATS Boards | None | Standard HTTP limits | Modern startups & scaleups (e.g. Linear, Retool, Vanta, Ramp) | Published timestamp verified | Direct ATS application URL | Ashby Job Board API |
| **User URL / Paste** | User Ingestion | User Session | User-initiated; 30 imports / hour | Any site (Company careers pages, general boards) | HEAD request to verify HTTP 200 vs 404/410 | User provided URL | User Submitted Opportunity |

---

## 2. Ethical Scraping & Compliance Rules

Per Spec Section 9:
> **CRITICAL RULE**: Do **NOT** scrape LinkedIn, Indeed, Naukri, Glassdoor, or other sites whose terms of service prohibit automated scraping.

For restricted job sites:
1. **Direct Scraping Block**: The system blocks headless background scrapers from accessing `linkedin.com`, `indeed.com`, `naukri.com`, `glassdoor.com`, `ziprecruiter.com`.
2. **User-Initiated Import**: If a candidate imports a URL from these domains, the system requires the candidate to provide the title and description directly, or use the CareerGraph Chrome Extension which runs strictly inside the user's authenticated browser session.
3. **Attribution & Transparency**: All ingested jobs retain their original provider source, apply link, and attribution notice.

---

## 3. Detailed Source Documentation

### 3.1. Remotive API
- **Endpoint**: `https://remotive.com/api/remote-jobs`
- **Authentication**: None (free & open public endpoint).
- **Rate Limits**: 1 request/second recommended.
- **Coverage**: Curated remote software engineering, product, and design roles.
- **Fields Extracted**: Title, company name, clean description, candidate location, tags, salary range, publication timestamp.
- **Deduplication**: Provider ID (`remotive_<id>`), URL, and SHA-256 fingerprint.

### 3.2. Greenhouse Public Boards
- **Endpoint**: `https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs`
- **Authentication**: None (open public board metadata).
- **Curated Boards Seed List**: `stripe`, `figma`, `cloudflare`, `gitlab`, `discord`, `airbnb`, `dropbox`, `hashicorp`.
- **Fields Extracted**: Title, company, location name, clean HTML content, departments, offices, updated timestamp.
- **Apply Capability**: Generates direct application deep-links (`#app`).

### 3.3. Lever Public Postings
- **Endpoint**: `https://api.lever.co/v0/postings/{company}?mode=json`
- **Authentication**: None.
- **Curated Boards Seed List**: `spotify`, `atlassian`, `palantir`, `brex`.
- **Fields Extracted**: Text, company, location, commitment (full-time/part-time), plain description, hosted URL.

### 3.4. Adzuna API
- **Endpoint**: `https://api.adzuna.com/v1/api/jobs/{country}/search/{page}`
- **Authentication**: `ADZUNA_APP_ID` & `ADZUNA_APP_KEY` environment variables.
- **Country Support**: India (`in`), United States (`us`), United Kingdom (`gb`).
- **Graceful Degradation**: When credentials are not supplied, adapter reports `standby` in `getCapabilities()`, healthCheck returns false, and searches return empty without causing server errors.

### 3.5. Ashby ATS Boards
- **Endpoint**: `https://api.ashbyhq.com/posting-api/job-board/{organization}`
- **Authentication**: None.
- **Curated Companies**: `linear`, `retool`, `vanta`, `ramp`.
- **Fields Extracted**: Title, department, location, descriptionHtml, jobUrl.

### 3.6. Direct URL Import & HTML/JSON-LD Scraper
- **Input**: User-provided HTTP/HTTPS URL.
- **JSON-LD Schema**: Extracts Schema.org `JobPosting` structured objects (`title`, `hiringOrganization.name`, `description`, `jobLocation`, `baseSalary`).
- **OpenGraph & Meta Fallback**: Extracts `<meta property="og:title">`, `<meta property="og:description">`, `<title>`.
- **Manual Card Fallback**: If external website blocks scrapers or returns 403 (e.g. Cloudflare Bot Management), allows candidate to paste the job description text directly.

---

## 4. Freshness Policy

- A job's status is initialized as `OPEN`.
- The system re-verifies listing availability (`POST /api/v1/jobs/:id/verify-freshness`) via an HTTP HEAD request prior to application preparation.
- If the listing returns HTTP `404` or `410`, the job status is immediately transitioned to `CLOSED`.
- Jobs that have not been observed across discovery runs in 30 days are flagged as `STALE`.
