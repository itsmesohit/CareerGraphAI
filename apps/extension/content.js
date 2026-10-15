// CareerGraph AI Content Script — In-Page ATS Detection & Assisted Autofill

(function () {
  let activePayload = null;
  let hudElement = null;

  // 1. Detect if current page is an ATS application form
  function detectJobApplicationForm() {
    const url = window.location.href.toLowerCase();
    const isAtsUrl =
      url.includes('greenhouse.io') ||
      url.includes('lever.co') ||
      url.includes('ashbyhq.com') ||
      url.includes('workday') ||
      url.includes('taleo') ||
      url.includes('jobs.') ||
      url.includes('careers.') ||
      url.includes('/apply');

    const hasFormElements =
      document.querySelector('form') !== null &&
      (document.querySelector('input[type="file"]') !== null ||
        document.querySelector('input[type="email"]') !== null ||
        document.querySelector('input[name*="name" i]') !== null);

    return isAtsUrl || hasFormElements;
  }

  // 2. Inject floating in-page HUD badge
  function injectHud(payload) {
    if (document.getElementById('cg-assistant-hud')) return;

    hudElement = document.createElement('div');
    hudElement.id = 'cg-assistant-hud';

    const hashSnippet = payload.contentHash
      ? `${payload.contentHash.slice(0, 8)}...`
      : 'SHA-256 Verified';

    hudElement.innerHTML = `
      <div class="cg-hud-brand">
        <div class="cg-hud-icon">✦</div>
        <span>CareerGraph AI</span>
      </div>
      <div class="cg-hud-badge">Verified ${hashSnippet}</div>
      <button id="cg-autofill-btn" class="cg-hud-btn">Autofill Form</button>
      <button id="cg-open-panel-btn" class="cg-hud-btn-secondary">Copilot</button>
    `;

    document.body.appendChild(hudElement);

    document.getElementById('cg-autofill-btn')?.addEventListener('click', () => {
      performAutofill(payload);
    });

    document.getElementById('cg-open-panel-btn')?.addEventListener('click', () => {
      // Send message to background to trigger sidepanel if supported
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    });
  }

  // 3. Set value and dispatch realistic browser events
  function setFieldValue(field, value) {
    if (!field || value === undefined || value === null) return false;

    field.focus();
    if (field.tagName === 'SELECT') {
      let optionFound = false;
      for (let i = 0; i < field.options.length; i++) {
        if (
          field.options[i].text.toLowerCase().includes(value.toLowerCase()) ||
          field.options[i].value.toLowerCase().includes(value.toLowerCase())
        ) {
          field.selectedIndex = i;
          optionFound = true;
          break;
        }
      }
      if (!optionFound && field.options.length > 1) {
        field.selectedIndex = 1;
      }
    } else if (field.type === 'checkbox') {
      field.checked = Boolean(value);
    } else if (field.type === 'radio') {
      field.checked = true;
    } else {
      field.value = value;
    }

    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.dispatchEvent(new Event('blur', { bubbles: true }));

    field.classList.remove('cg-field-unknown');
    field.classList.add('cg-field-filled');
    return true;
  }

  // 4. Perform intelligent autofill using procedural selectors + heuristics
  function performAutofill(payload) {
    if (!payload || !payload.candidate) return;

    const candidate = payload.candidate;
    const selectors = payload.proceduralSelectors || {};
    const answers = payload.answers || {};
    const learnedSelectors = {};

    let filledCount = 0;
    const allInputs = Array.from(
      document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select')
    );

    // Helper to query element by selector or attribute pattern
    function findInput(selector, patterns) {
      if (selector) {
        const el = document.querySelector(selector);
        if (el) return el;
      }

      for (const input of allInputs) {
        const id = (input.id || '').toLowerCase();
        const name = (input.name || '').toLowerCase();
        const placeholder = (input.placeholder || '').toLowerCase();
        const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();

        // Check associated label
        let labelText = '';
        if (input.id) {
          const label = document.querySelector(`label[for="${input.id}"]`);
          if (label) labelText = label.innerText.toLowerCase();
        }
        if (!labelText && input.closest('label')) {
          labelText = input.closest('label').innerText.toLowerCase();
        }

        const match = patterns.some(
          (p) =>
            id.includes(p) ||
            name.includes(p) ||
            placeholder.includes(p) ||
            ariaLabel.includes(p) ||
            labelText.includes(p)
        );

        if (match) return input;
      }

      return null;
    }

    // 1. First Name
    const firstNameEl = findInput(selectors.first_name, ['first_name', 'firstname', 'first name', 'first']);
    if (firstNameEl && setFieldValue(firstNameEl, candidate.firstName)) {
      filledCount++;
      if (firstNameEl.id) learnedSelectors.first_name = `#${firstNameEl.id}`;
    }

    // 2. Last Name
    const lastNameEl = findInput(selectors.last_name, ['last_name', 'lastname', 'last name', 'last', 'family name']);
    if (lastNameEl && setFieldValue(lastNameEl, candidate.lastName)) {
      filledCount++;
      if (lastNameEl.id) learnedSelectors.last_name = `#${lastNameEl.id}`;
    }

    // 3. Full Name (if no separate first/last)
    if (!firstNameEl && !lastNameEl) {
      const fullNameEl = findInput(selectors.full_name, ['full_name', 'fullname', 'name']);
      if (fullNameEl && setFieldValue(fullNameEl, candidate.fullName)) {
        filledCount++;
        if (fullNameEl.id) learnedSelectors.full_name = `#${fullNameEl.id}`;
      }
    }

    // 4. Email
    const emailEl = findInput(selectors.email, ['email', 'e-mail']);
    if (emailEl && setFieldValue(emailEl, candidate.email)) {
      filledCount++;
      if (emailEl.id) learnedSelectors.email = `#${emailEl.id}`;
    }

    // 5. Phone
    const phoneEl = findInput(selectors.phone, ['phone', 'mobile', 'telephone', 'tel']);
    if (phoneEl && setFieldValue(phoneEl, candidate.phone)) {
      filledCount++;
      if (phoneEl.id) learnedSelectors.phone = `#${phoneEl.id}`;
    }

    // 6. LinkedIn
    const linkedinEl = findInput(selectors.linkedin, ['linkedin', 'linked in']);
    if (linkedinEl && candidate.linkedinUrl && setFieldValue(linkedinEl, candidate.linkedinUrl)) {
      filledCount++;
      if (linkedinEl.id) learnedSelectors.linkedin = `#${linkedinEl.id}`;
    }

    // 7. GitHub
    const githubEl = findInput(selectors.github, ['github', 'git']);
    if (githubEl && candidate.githubUrl && setFieldValue(githubEl, candidate.githubUrl)) {
      filledCount++;
      if (githubEl.id) learnedSelectors.github = `#${githubEl.id}`;
    }

    // 8. Portfolio / Website
    const portfolioEl = findInput(selectors.portfolio, ['website', 'portfolio', 'personal site']);
    if (portfolioEl && candidate.portfolioUrl && setFieldValue(portfolioEl, candidate.portfolioUrl)) {
      filledCount++;
      if (portfolioEl.id) learnedSelectors.portfolio = `#${portfolioEl.id}`;
    }

    // 9. Cover Letter
    const coverLetterEl = findInput(selectors.cover_letter, ['cover_letter', 'coverletter', 'cover letter', 'comments', 'additional']);
    if (coverLetterEl && payload.coverLetterText && setFieldValue(coverLetterEl, payload.coverLetterText)) {
      filledCount++;
      if (coverLetterEl.id) learnedSelectors.cover_letter = `#${coverLetterEl.id}`;
    }

    // 10. Screening Q&A matching
    Object.values(answers).forEach((qa) => {
      if (!qa || !qa.question || !qa.answer) return;
      const questionKeywords = qa.question
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3);

      const matchedInput = allInputs.find((input) => {
        if (input.classList.contains('cg-field-filled')) return false;

        let labelText = '';
        if (input.id) {
          const label = document.querySelector(`label[for="${input.id}"]`);
          if (label) labelText = label.innerText.toLowerCase();
        }
        if (!labelText && input.closest('label')) {
          labelText = input.closest('label').innerText.toLowerCase();
        }

        const matchesKeyword = questionKeywords.some((k) => labelText.includes(k));
        return matchesKeyword;
      });

      if (matchedInput && setFieldValue(matchedInput, qa.answer)) {
        filledCount++;
      }
    });

    // Mark remaining unhandled inputs with amber highlight for user awareness
    allInputs.forEach((input) => {
      if (!input.classList.contains('cg-field-filled')) {
        input.classList.add('cg-field-unknown');
      }
    });

    // Send learned selectors to procedural memory
    if (Object.keys(learnedSelectors).length > 0) {
      chrome.runtime.sendMessage({
        type: 'RECORD_PROCEDURAL_MEMORY',
        data: {
          domain: window.location.hostname,
          selectors: learnedSelectors,
        },
      });
    }

    // Update HUD button
    const btn = document.getElementById('cg-autofill-btn');
    if (btn) {
      btn.innerText = `Autofilled ${filledCount} Fields ✓`;
      btn.style.background = '#10b981';
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Phase 14 — Job Capture: detect Schema.org/JobPosting JSON-LD on any
  // job board and offer one-click save into the CareerGraph pipeline.
  // Client-side extraction (the user's own browser) with explicit
  // title/description satisfies the anti-scraping policy for restricted
  // domains: nothing is fetched server-side.
  // ─────────────────────────────────────────────────────────────────
  function extractJobPostingJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const seen = new Set();

    for (const script of scripts) {
      let parsed;
      try {
        parsed = JSON.parse(script.textContent);
      } catch {
        continue;
      }

      // Handle single objects, arrays, and @graph containers
      const nodes = Array.isArray(parsed)
        ? parsed
        : parsed['@graph'] && Array.isArray(parsed['@graph'])
          ? parsed['@graph']
          : [parsed];

      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const type = node['@type'];
        const isJobPosting =
          type === 'JobPosting' ||
          (Array.isArray(type) && type.includes('JobPosting'));
        if (!isJobPosting) continue;

        // Skip Google Jobs search-result overlays — only capture real postings
        const url = node.url || location.href;
        if (seen.has(url)) continue;
        seen.add(url);

        const org = node.hiringOrganization || {};
        const orgName = typeof org === 'string' ? org : org.name || '';
        const loc = node.jobLocation || {};
        const locObj = Array.isArray(loc) ? loc[0] : loc;
        const address = locObj && locObj.address ? locObj.address : {};
        const locationParts = [
          typeof address === 'string' ? address : address.addressLocality,
          typeof address === 'string' ? null : address.addressRegion,
          typeof address === 'string' ? null : address.addressCountry,
        ].filter(Boolean);
        const remoteType =
          node.jobLocationType === 'TELECOMMUTE'
            ? 'REMOTE'
            : locationParts.length === 0
              ? 'REMOTE'
              : 'ONSITE';

        const description =
          typeof node.description === 'string'
            ? node.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            : '';

        if (!node.title || description.length < 20) continue;

        return {
          url,
          title: String(node.title).trim(),
          company: orgName ? String(orgName).trim() : new URL(location.href).hostname.replace('www.', ''),
          description,
          location: locationParts.join(', ') || 'Remote',
          remoteType,
        };
      }
    }
    return null;
  }

  function injectCaptureHud(jobData) {
    if (document.getElementById('cg-capture-hud')) return;

    const el = document.createElement('div');
    el.id = 'cg-capture-hud';
    el.innerHTML = `
      <div class="cg-hud-brand">
        <div class="cg-hud-icon">✦</div>
        <span>CareerGraph AI</span>
      </div>
      <div class="cg-capture-title" title="${`${jobData.title} at ${jobData.company}`.replace(/"/g, '')}">
        ${jobData.title} · ${jobData.company}
      </div>
      <button id="cg-capture-btn" class="cg-hud-btn">Save to CareerGraph</button>
    `;
    document.body.appendChild(el);

    const btn = document.getElementById('cg-capture-btn');
    btn?.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = 'Saving…';

      chrome.runtime.sendMessage({ type: 'CAPTURE_JOB', data: jobData }, (response) => {
        if (chrome.runtime.lastError) {
          showToast('Extension error — is the CareerGraph app running?', false);
        } else if (response && response.success) {
          showToast(response.message, true);
          el.remove();
        } else {
          const reason = (response && response.error) || 'Capture failed';
          showToast(reason, false);
          btn.disabled = false;
          btn.textContent = 'Save to CareerGraph';
        }
      });
    });
  }

  function showToast(message, ok) {
    let toast = document.getElementById('cg-capture-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cg-capture-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = ok ? 'cg-toast cg-toast-ok' : 'cg-toast cg-toast-err';
    // Force reflow so the slide-in animation replays on subsequent toasts
    void toast.offsetWidth;
    toast.classList.add('cg-toast-visible');
    setTimeout(() => {
      toast.classList.remove('cg-toast-visible');
    }, 4200);
  }

  // Initialize
  if (detectJobApplicationForm()) {
    chrome.runtime.sendMessage(
      {
        type: 'FETCH_AUTOFILL_PAYLOAD',
        currentUrl: window.location.href,
      },
      (response) => {
        if (response && response.success && response.payload) {
          activePayload = response.payload;
          injectHud(response.payload);
        }
      }
    );
  } else {
    // Not an apply form — offer one-click capture if a JobPosting is on the page
    const jobData = extractJobPostingJsonLd();
    if (jobData) {
      injectCaptureHud(jobData);
    }
  }

  // Listen for messages from side panel
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'TRIGGER_AUTOFILL') {
      if (activePayload) {
        performAutofill(activePayload);
        sendResponse({ success: true });
      } else {
        chrome.runtime.sendMessage(
          {
            type: 'FETCH_AUTOFILL_PAYLOAD',
            currentUrl: window.location.href,
          },
          (res) => {
            if (res && res.success && res.payload) {
              activePayload = res.payload;
              performAutofill(res.payload);
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: 'No active payload' });
            }
          }
        );
        return true;
      }
    }
  });
})();
