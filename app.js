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
  const form = $('#signupForm');
  const alert = $('#formError');
  const submit = $('#submitButton');
  const fieldErrors = new Map();
  const fieldLabels = {
    company: 'Business name', contact: 'Your full name', email: 'Work email', tenant: 'Productivity platform', signupDevices: 'Computer count',
    'consent-authority': 'Business authorization', 'consent-scope': 'Support scope acknowledgment', 'consent-terms': 'Terms and privacy acknowledgment'
  };
  function validationMessage(field) {
    field.setCustomValidity('');
    if (field.required && field.type !== 'checkbox' && !field.value.trim()) field.setCustomValidity('Please complete this field.');
    if (field.validity.valid) return '';
    if (field.type === 'checkbox') return 'Confirm ' + fieldLabels[field.id].toLowerCase() + ' to continue.';
    if (field.validity.typeMismatch) return 'Enter a valid work email address, such as name@company.com.';
    if (field.type === 'number') return 'Enter a whole number between 0 and 10,000.';
    if (field.id === 'tenant') return 'Choose Microsoft 365 or Google Workspace.';
    return 'Enter ' + fieldLabels[field.id].toLowerCase() + '.';
  }
  function clearFieldError(field) {
    const error = fieldErrors.get(field);
    if (!error) return;
    error.remove();
    field.removeAttribute('aria-invalid');
    const descriptions = (field.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== error.id);
    if (descriptions.length) field.setAttribute('aria-describedby', descriptions.join(' ')); else field.removeAttribute('aria-describedby');
    fieldErrors.delete(field);
  }
  function markFieldError(field, message) {
    clearFieldError(field);
    const error = document.createElement('p');
    error.id = field.id + '-error';
    error.className = 'field-error';
    error.textContent = message;
    const row = field.closest('.consent-row');
    if (row) row.after(error); else field.closest('.field').append(error);
    field.setAttribute('aria-invalid', 'true');
    const previous = field.getAttribute('aria-describedby');
    field.setAttribute('aria-describedby', [previous, error.id].filter(Boolean).join(' '));
    fieldErrors.set(field, error);
  }
  function errorSummary(focus = false) {
    if (!fieldErrors.size) { alert.hidden = true; return; }
    const title = document.createElement('strong');
    title.textContent = 'Please check ' + fieldErrors.size + (fieldErrors.size === 1 ? ' field.' : ' fields.');
    const list = document.createElement('ul');
    fieldErrors.forEach((error, field) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#' + field.id;
      link.textContent = fieldLabels[field.id] + ': ' + error.textContent;
      link.addEventListener('click', event => { event.preventDefault(); field.focus(); field.scrollIntoView({block:'center',behavior:'auto'}); });
      item.append(link); list.append(item);
    });
    alert.replaceChildren(title, list);
    alert.hidden = false;
    if (focus) alert.focus();
  }
  form.addEventListener('input', event => {
    const field = event.target;
    if (fieldErrors.has(field)) {
      const message = validationMessage(field);
      if (!message) { clearFieldError(field); errorSummary(); }
    }
  });
  form.addEventListener('change', event => {
    const field = event.target;
    if (fieldErrors.has(field) && !validationMessage(field)) { clearFieldError(field); errorSummary(); }
  });
  function showError(message) {
    alert.textContent = message;
    alert.hidden = false;
    alert.focus();
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alert.hidden = true;
    Array.from(fieldErrors.keys()).forEach(clearFieldError);
    form.querySelectorAll('[required]').forEach(field => {
      const message = validationMessage(field);
      if (message) markFieldError(field, message);
    });
    if (fieldErrors.size) { errorSummary(true); return; }
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
