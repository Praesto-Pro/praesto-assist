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
    shortcuts.forEach((button) => { button.classList.toggle('selected', count === Number(button.dataset.devices)); });
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
  const menuButton = $('.mobile-menu');
  const menu = $('#mobile-navigation');
  menuButton.addEventListener('click', () => {
    const open = menu.hasAttribute('hidden');
    menu.toggleAttribute('hidden', !open);
    menuButton.setAttribute('aria-expanded', String(open));
  });
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    menu.setAttribute('hidden', ''); menuButton.setAttribute('aria-expanded', 'false');
  }));
  const demoResult = $('#demo-result');
  $('#demo-approve').addEventListener('click', () => {
    $('#demo-approval').hidden = true;
    demoResult.hidden = false;
    demoResult.textContent = '✓ Repair approved in this demo. A real agent would verify the result on your device.';
  });
  $('#demo-decline').addEventListener('click', () => {
    $('#demo-approval').hidden = true;
    demoResult.hidden = false;
    demoResult.textContent = '✓ Declined. No change would be made. You stay in control.';
  });
  const form = $('#signupForm');
  const alert = $('#formError');
  const submit = $('#submitButton');
  function showError(message) {
    alert.textContent = message;
    alert.hidden = false;
    alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
