// CareerGraph AI Background Service Worker (Manifest V3)

const API_BASE = 'http://localhost:3001/api/v1';

// Configure side panel to open on action click
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.warn('[CareerGraph Extension] SidePanel setup error:', err));
}

// Listen for messages from content scripts and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_API_BASE') {
    sendResponse({ apiBase: API_BASE });
    return true;
  }

  if (message.type === 'FETCH_AUTOFILL_PAYLOAD') {
    (async () => {
      try {
        const stored = await chrome.storage.local.get(['cg_access_token', 'cg_active_application_id']);
        const token = stored.cg_access_token;
        const applicationId = message.applicationId || stored.cg_active_application_id;

        if (!token || !applicationId) {
          sendResponse({
            success: false,
            error: 'Not authenticated or no active application selected',
          });
          return;
        }

        const res = await fetch(`${API_BASE}/automation/payload/${applicationId}?currentUrl=${encodeURIComponent(message.currentUrl || '')}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await res.json();
        if (!res.ok) {
          sendResponse({ success: false, error: data.error || 'Failed to fetch payload' });
          return;
        }

        sendResponse({ success: true, payload: data.payload });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep message channel open for async response
  }

  if (message.type === 'REPORT_SUBMISSION_RESULT') {
    (async () => {
      try {
        const stored = await chrome.storage.local.get(['cg_access_token']);
        const token = stored.cg_access_token;

        if (!token) {
          sendResponse({ success: false, error: 'Not authenticated' });
          return;
        }

        const res = await fetch(`${API_BASE}/automation/report-result`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message.data),
        });

        const data = await res.json();
        if (!res.ok) {
          sendResponse({ success: false, error: data.error || 'Failed to report result' });
          return;
        }

        sendResponse({ success: true, application: data.application });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'CAPTURE_JOB') {
    (async () => {
      try {
        const stored = await chrome.storage.local.get(['cg_access_token']);
        const token = stored.cg_access_token;

        if (!token) {
          sendResponse({
            success: false,
            error: 'Not signed in — open the CareerGraph side panel and paste your token.',
          });
          return;
        }

        const res = await fetch(`${API_BASE}/extension/jobs/capture`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message.data),
        });

        const data = await res.json();
        if (!res.ok) {
          sendResponse({ success: false, error: data.message || 'Failed to capture job' });
          return;
        }

        sendResponse({ success: true, message: data.message, isNew: data.isNew, job: data.job });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep message channel open for async response
  }

  if (message.type === 'RECORD_PROCEDURAL_MEMORY') {
    (async () => {
      try {
        const stored = await chrome.storage.local.get(['cg_access_token']);
        const token = stored.cg_access_token;
        if (!token) return;

        await fetch(`${API_BASE}/automation/procedural-memory`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message.data),
        });
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
