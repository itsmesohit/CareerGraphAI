# CareerGraph AI — Chrome MV3 Assisted Apply Extension

Autonomous browser copilot for intelligent ATS form detection, grounded autofill from verified graph memory, one-click job capture, and cryptographic approval protection.

## Features
- **One-Click Job Capture (Phase 14)**: Detects Schema.org `JobPosting` JSON-LD on any job board (LinkedIn-style postings, company careers pages, aggregators) and shows a floating **Save to CareerGraph** button. Captured jobs flow through the standard normalize → dedup → ingest → graph projection pipeline via `POST /api/v1/extension/jobs/capture`. Because extraction happens client-side in your own browser with explicit title/description, restricted ATS domains that block server-side scraping are still importable.
- **ATS Form Detection**: Automatically identifies Greenhouse, Lever, Ashby, Workday, Taleo, and generic application forms.
- **In-Page Floating HUD**: Minimal glassmorphism badge with SHA-256 verified status pill and quick autofill.
- **Side Panel Copilot**: Side panel displaying matched role, fit score, grounded tailored bullets, cover letter, and screening answers.
- **Visual Field Highlights**:
  - Green outline: Successfully autofilled with verified candidate facts.
  - Amber outline: Unrecognized/unverified fields requiring human attention.
- **Procedural Memory Learning**: Automatically records learned form selectors for the company/ATS domain back to FalkorDB procedural memory.
- **Cryptographic Gate**: Autofill payload requires verified SHA-256 `contentHash` from candidate approval.

## Installation in Chrome / Chromium / Brave / Edge
1. Open `chrome://extensions` in your browser.
2. Enable **Developer mode** (toggle in the top right).
3. Click **Load unpacked**.
4. Select the `apps/extension` directory from this repository.
5. Click the extension icon in the toolbar to open the CareerGraph Copilot Side Panel!
