(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const currency = (amount) => '$' + amount.toLocaleString('en-US');
  const blocksFor = (devices) => Math.max(1, Math.ceil(devices / 10));
  const normalize = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(10000, Math.floor(parsed))) : 10;
  };
  const countInput = $('#deviceCount');
  const signupCount = $('#signupDevices');
  const shortcuts = Array.from(document.querySelectorAll('[data-devices]'));
  let announcementTimer;
  let hasEstimate = false;
  function updateEstimate(devices, source) {
    const count = normalize(devices);
    const blocks = blocksFor(count);
    const price = 99 * blocks;
    if (source !== 'calculator') countInput.value = count;
    if (source !== 'signup') signupCount.value = count;
    $('#calc-price').textContent = price.toLocaleString('en-US');
    $('#calc-total').textContent = currency(price);
    $('#calc-blocks').textContent = blocks + (blocks === 1 ? ' block' : ' blocks');
    $('#calc-capacity').textContent = (blocks * 10).toLocaleString('en-US') + ' computers';
    $('#calc-description').textContent = 'Coverage for up to ' + (blocks * 10).toLocaleString('en-US') + ' enrolled computers';
    $('#calc-start').innerHTML = 'Get started at ' + currency(price) + '/mo <span aria-hidden="true">→</span>';
    $('#form-estimate-price').textContent = currency(price);
    $('#form-estimate-blocks').textContent = blocks + (blocks === 1 ? ' block' : ' blocks') + ' · up to ' + (blocks * 10).toLocaleString('en-US') + ' computers';
    shortcuts.forEach((button) => {
      const selected = count === Number(button.dataset.devices);
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    if (hasEstimate) {
      clearTimeout(announcementTimer);
      announcementTimer = setTimeout(() => {
        $('#estimate-status').textContent = 'Estimated subscription: ' + currency(price) + ' per month before tax, covering up to ' + (blocks * 10) + ' computers.';
      }, 350);
    }
    hasEstimate = true;
  }
  countInput.addEventListener('input', () => { if (countInput.value !== '') updateEstimate(countInput.value, 'calculator'); });
  countInput.addEventListener('change', () => updateEstimate(countInput.value));
  signupCount.addEventListener('input', () => { if (signupCount.value !== '') updateEstimate(signupCount.value, 'signup'); });
  signupCount.addEventListener('change', () => updateEstimate(signupCount.value));
  $('#dec-devices').addEventListener('click', () => updateEstimate(normalize(countInput.value) - 1));
  $('#inc-devices').addEventListener('click', () => updateEstimate(normalize(countInput.value) + 1));
  shortcuts.forEach((button) => button.addEventListener('click', () => updateEstimate(Number(button.dataset.devices))));
  document.querySelectorAll('[name=setup]').forEach((input) => input.addEventListener('change', () => {
    document.querySelectorAll('.radio-option').forEach((row) => row.classList.toggle('chosen', row.querySelector('input').checked));
  }));
  $('#year').textContent = new Date().getFullYear();
  const themeButton = $('#theme-toggle');
  const darkPreference = window.matchMedia('(prefers-color-scheme: dark)');
  function updateThemeButton() {
    const theme = document.documentElement.dataset.theme;
    const dark = theme ? theme === 'dark' : darkPreference.matches;
    const label = dark ? 'Use light appearance' : 'Use dark appearance';
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
    $('#theme-moon').hidden = dark;
    $('#theme-sun').hidden = !dark;
  }
  themeButton.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme;
    const dark = theme ? theme === 'dark' : darkPreference.matches;
    const nextTheme = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    try { localStorage.setItem('praesto-theme', nextTheme); } catch { /* Appearance works when storage is unavailable. */ }
    updateThemeButton();
  });
  darkPreference.addEventListener('change', updateThemeButton);
  updateThemeButton();
  const menuButton = $('.mobile-menu');
  const menu = $('#mobile-navigation');
  menuButton.addEventListener('click', () => {
    const open = menu.hasAttribute('hidden');
    menu.toggleAttribute('hidden', !open);
    menuButton.setAttribute('aria-expanded', String(open));
  });
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    menu.setAttribute('hidden', ''); menuButton.setAttribute('aria-expanded', 'false');
    const target = document.querySelector(link.getAttribute('href'));
    if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
  }));
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      menu.setAttribute('hidden', ''); menuButton.setAttribute('aria-expanded', 'false');
      menuButton.focus();
    }
  });
  // Scripted examples: this demo never connects to a computer or submits tickets.
  const scenarios = {
    email: {
      question: 'Outlook is frozen and I have a quote to send. Can you help?',
      finding: 'Outlook is not responding; the computer is online.',
      checks: 'App responsiveness and network connection.',
      proposal: 'Permission to restart Outlook?',
      impact: 'Save any open work first. Outlook will close and reopen; unsaved drafts may be lost. No files will be deleted.',
      action: 'Restarted Outlook with employee approval.',
      verify: 'In this example, Outlook reopened and responds again. Can you open your email and send your quote?'
    },
    wifi: {
      question: 'My laptop says it’s connected, but websites won’t load.',
      finding: 'Wi-Fi is connected, but the connection check failed.',
      checks: 'Wi-Fi connection and access to a test webpage.',
      proposal: 'Permission to reconnect Wi-Fi?',
      impact: 'Your connection will briefly drop. Finish any calls or uploads first. Saved networks and files will stay in place.',
      action: 'Reconnected Wi-Fi with employee approval.',
      verify: 'In this example, the connection check passed after reconnecting. Can you load a webpage now?'
    },
    slow: {
      question: 'My computer has suddenly become slow. Everything takes ages.',
      finding: 'A background app is using unusually high CPU.',
      checks: 'CPU usage, available memory, and app responsiveness.',
      proposal: 'Permission to close the unresponsive background app?',
      impact: 'Save your work in that app first; unsaved changes may be lost. Other apps stay open. No files will be deleted.',
      action: 'Closed the unresponsive app with employee approval.',
      verify: 'In this example, CPU usage returned to normal. Does your computer feel responsive again?'
    }
  };
  let selectedScenario = 'email';
  let attempted = false;
  const demoResult = $('#demo-result');
  function demoFocus(element) { element.focus({ preventScroll: true }); }
  function renderScenario(key) {
    selectedScenario = key;
    attempted = false;
    const scenario = scenarios[key];
    document.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === key)));
    $('#demo-question').textContent = scenario.question;
    $('#demo-reply').textContent = 'I’ll check what’s happening on your enrolled computer, then show you a proposed fix. You decide whether to proceed.';
    $('#demo-finding').textContent = scenario.finding;
    $('#demo-checks').textContent = scenario.checks;
    $('#demo-proposal').textContent = scenario.proposal;
    $('#demo-impact').textContent = scenario.impact;
    $('#demo-stage').textContent = '1 / 3 · Investigate and review';
    $('#demo-approval').hidden = false;
    demoResult.hidden = true;
    $('#demo-ticket').hidden = true;
  }
  function demoOutcome(title, copy, confirmation) {
    $('#demo-approval').hidden = true;
    demoResult.hidden = false;
    $('#demo-result-title').textContent = title;
    $('#demo-result-copy').textContent = copy;
    $('#demo-confirm').hidden = !confirmation;
    $('#demo-declined-actions').hidden = confirmation;
    demoFocus(demoResult);
  }
  $('#demo-start').addEventListener('click', () => {
    $('#demo-welcome').hidden = true;
    $('#demo-session').hidden = false;
    renderScenario('email');
    demoFocus(document.querySelector('[data-scenario="email"]'));
  });
  document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => renderScenario(button.dataset.scenario)));
  $('#demo-approve').addEventListener('click', () => {
    attempted = true;
    $('#demo-stage').textContent = '2 / 3 · Verify the fix';
    demoOutcome('Demo fix complete. Let’s check together.', scenarios[selectedScenario].verify, true);
  });
  $('#demo-decline').addEventListener('click', () => {
    $('#demo-stage').textContent = 'Paused · Your choice';
    demoOutcome('No changes made.', 'You can review the proposed fix again or see how Praesto prepares a technician handoff.', false);
  });
  $('#demo-reconsider').addEventListener('click', () => {
    renderScenario(selectedScenario);
    demoFocus($('#demo-approve'));
  });
  $('#demo-fixed').addEventListener('click', () => {
    $('#demo-stage').textContent = '3 / 3 · Resolved';
    $('#demo-result-title').textContent = 'Back to work.';
    $('#demo-result-copy').textContent = 'In this example, you confirmed the problem is resolved. The conversation, approved action, and result form the support record.';
    $('#demo-confirm').hidden = true;
    demoFocus(demoResult);
  });
  function showHandoff() {
    const scenario = scenarios[selectedScenario];
    $('#demo-stage').textContent = '3 / 3 · Technician handoff';
    demoResult.hidden = true;
    $('#demo-ticket').hidden = false;
    $('#demo-ticket-issue').textContent = scenario.question;
    $('#demo-ticket-checks').textContent = scenario.checks + ' Finding: ' + scenario.finding;
    $('#demo-ticket-action').textContent = attempted ? scenario.action + ' Employee reports the issue persists.' : 'Employee declined the proposed fix. No changes made.';
    demoFocus($('#demo-ticket'));
  }
  $('#demo-unresolved').addEventListener('click', showHandoff);
  $('#demo-request-review').addEventListener('click', showHandoff);
  $('#demo-reset').addEventListener('click', () => {
    $('#demo-session').hidden = true;
    $('#demo-welcome').hidden = false;
    demoFocus($('#demo-start'));
  });
  const form = $('#signupForm');
  const alert = $('#formError');
  const submit = $('#submitButton');
  function showError(message) {
    alert.textContent = message;
    alert.hidden = false;
    alert.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alert.hidden = true;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const devices = Number(signupCount.value);
    if (!Number.isInteger(devices) || devices < 0 || devices > 10000) {
      showError('Please enter a valid computer count between 0 and 10,000.');
      return;
    }
    if (window.location.protocol === 'file:') {
      showError('This is an interactive page preview. Secure checkout has not been connected; no payment has been collected.');
      return;
    }
    const data = new FormData(form);
    const payload = {
      company: String(data.get('company') || '').trim(),
      contact: String(data.get('contact') || '').trim(),
      email: String(data.get('email') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      tenant: data.get('tenant'),
      computers: devices,
      setup: data.get('setup'),
      authority: data.get('authority') === 'on',
      scope: data.get('scope') === 'on',
      terms: data.get('terms') === 'on',
      website: String(data.get('website') || '')
    };
    submit.disabled = true;
    submit.textContent = 'Preparing secure checkout…';
    try {
      const response = await fetch('/api/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Secure checkout is not available yet. No payment has been collected.');
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || !['checkout.stripe.com', 'checkout.stripe.com.'].includes(url.hostname)) throw new Error('The checkout destination could not be validated.');
      window.location.assign(url.href);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Checkout is unavailable. No payment has been collected.');
      submit.disabled = false;
      submit.innerHTML = 'Continue to secure checkout <span aria-hidden="true">↗</span>';
    }
  });
  updateEstimate(10);
})();
