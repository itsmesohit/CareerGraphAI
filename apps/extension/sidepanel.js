// CareerGraph AI Side Panel Script

let currentPayload = null;
let currentAppId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const authSection = document.getElementById('auth-section');
  const appSection = document.getElementById('app-section');
  const packetSection = document.getElementById('packet-section');
  const authBadge = document.getElementById('auth-status-badge');
  const tokenInput = document.getElementById('token-input');
  const saveTokenBtn = document.getElementById('save-token-btn');
  const triggerAutofillBtn = document.getElementById('trigger-autofill-btn');
  const reportSubmittedBtn = document.getElementById('report-submitted-btn');
  const footerStatus = document.getElementById('footer-status-text');

  // Check stored credentials
  const stored = await chrome.storage.local.get(['cg_access_token', 'cg_active_application_id']);
  const token = stored.cg_access_token;

  if (token) {
    authBadge.innerText = 'Connected';
    authBadge.className = 'badge badge-authenticated';
    authSection.style.display = 'none';
    loadActiveApplication(token, stored.cg_active_application_id);
  } else {
    authBadge.innerText = 'Not Connected';
    authBadge.className = 'badge badge-unauthenticated';
    authSection.style.display = 'block';
  }

  // Save Token Handler
  saveTokenBtn?.addEventListener('click', async () => {
    const val = tokenInput.value.trim();
    if (!val) return;
    await chrome.storage.local.set({ cg_access_token: val });
    authBadge.innerText = 'Connected';
    authBadge.className = 'badge badge-authenticated';
    authSection.style.display = 'none';
    loadActiveApplication(val);
  });

  // Load Active Application & Payload
  async function loadActiveApplication(authToken, preferredAppId) {
    try {
      footerStatus.innerText = 'Scanning active application...';
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentUrl = tab?.url || '';

      const res = await fetch('http://localhost:3001/api/v1/applications?limit=20', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();

      if (!res.ok || !data.applications || data.applications.length === 0) {
        footerStatus.innerText = 'No applications found in tracker.';
        return;
      }

      // Find matching application for this site or default to first
      let matchedApp = data.applications.find(
        (a) => a.id === preferredAppId
      );

      if (!matchedApp && currentUrl) {
        matchedApp = data.applications.find(
          (a) =>
            currentUrl.toLowerCase().includes(a.company.toLowerCase()) ||
            (a.jobUrl && currentUrl.toLowerCase().includes(a.jobUrl.toLowerCase()))
        );
      }

      if (!matchedApp) {
        matchedApp = data.applications[0];
      }

      currentAppId = matchedApp.id;
      await chrome.storage.local.set({ cg_active_application_id: currentAppId });

      // Fetch Autofill Payload
      const payloadRes = await fetch(
        `http://localhost:3001/api/v1/automation/payload/${currentAppId}?currentUrl=${encodeURIComponent(currentUrl)}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      const payloadData = await payloadRes.json();

      if (payloadRes.ok && payloadData.payload) {
        currentPayload = payloadData.payload;
        renderApplication(matchedApp, payloadData.payload);
      } else {
        footerStatus.innerText = 'Could not load application payload';
      }
    } catch (err) {
      footerStatus.innerText = `Error: ${err.message}`;
    }
  }

  // Render application data into side panel
  function renderApplication(app, payload) {
    appSection.style.display = 'block';
    packetSection.style.display = 'block';

    document.getElementById('job-company').innerText = app.company;
    document.getElementById('job-title').innerText = app.jobTitle;
    document.getElementById('match-score-pill').innerText = `${app.matchScore}% Fit`;
    document.getElementById('content-hash-text').innerText = payload.contentHash
      ? `${payload.contentHash.slice(0, 16)}...`
      : 'Verified';

    // Tailored Bullets
    const bulletsList = document.getElementById('bullets-list');
    const bulletsCount = document.getElementById('bullets-count');
    if (payload.tailoredBullets && payload.tailoredBullets.length > 0) {
      bulletsCount.innerText = String(payload.tailoredBullets.length);
      bulletsList.innerHTML = payload.tailoredBullets
        .map((b) => `<div style="margin-bottom: 6px;">• ${b}</div>`)
        .join('');
    } else {
      bulletsCount.innerText = '0';
      bulletsList.innerHTML = '<span style="color: #64748b;">No tailored bullets generated.</span>';
    }

    // Cover Letter
    const coverLetterContent = document.getElementById('cover-letter-content');
    coverLetterContent.innerText = payload.coverLetterText || 'No cover letter drafted.';

    // Screening Q&A
    const qaList = document.getElementById('qa-list');
    const qaCount = document.getElementById('qa-count');
    const answers = Object.values(payload.answers || {});
    qaCount.innerText = String(answers.length);
    if (answers.length > 0) {
      qaList.innerHTML = answers
        .map(
          (qa) => `
          <div style="margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
            <strong style="color: #f1f5f9;">Q: ${qa.question}</strong><br/>
            <span style="color: #38bdf8;">A: ${qa.answer}</span>
          </div>`
        )
        .join('');
    } else {
      qaList.innerHTML = '<span style="color: #64748b;">No custom screening answers.</span>';
    }

    footerStatus.innerText = 'Application payload ready to autofill.';
  }

  // Trigger Autofill Button
  triggerAutofillBtn?.addEventListener('click', async () => {
    footerStatus.innerText = 'Executing in-page autofill...';
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AUTOFILL' }, (response) => {
      if (chrome.runtime.lastError) {
        footerStatus.innerText = 'Autofill script not found on tab. Try refreshing.';
      } else {
        footerStatus.innerText = 'Fields autofilled with verified facts ✓';
      }
    });
  });

  // Report Submitted Button
  reportSubmittedBtn?.addEventListener('click', async () => {
    if (!currentAppId) return;
    footerStatus.innerText = 'Reporting submission to tracker...';

    chrome.runtime.sendMessage(
      {
        type: 'REPORT_SUBMISSION_RESULT',
        data: {
          applicationId: currentAppId,
          status: 'SUBMITTED',
          channel: 'ASSISTED_EXTENSION',
        },
      },
      (response) => {
        if (response && response.success) {
          footerStatus.innerText = 'Application marked as Submitted ✓';
          reportSubmittedBtn.disabled = true;
          reportSubmittedBtn.innerText = 'Submitted ✓';
        } else {
          footerStatus.innerText = `Error: ${response?.error || 'Failed to report'}`;
        }
      }
    );
  });

  // Accordion Toggles
  function setupAccordion(btnId, contentId) {
    const btn = document.getElementById(btnId);
    const content = document.getElementById(contentId);
    if (!btn || !content) return;

    btn.addEventListener('click', () => {
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
      const chevron = btn.querySelector('.chevron');
      if (chevron) chevron.innerText = isHidden ? '▲' : '▼';
    });
  }

  setupAccordion('toggle-bullets-btn', 'bullets-list');
  setupAccordion('toggle-cover-letter-btn', 'cover-letter-content');
  setupAccordion('toggle-qa-btn', 'qa-list');
});
