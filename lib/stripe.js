import crypto from 'node:crypto';
import { PLAN_PRICE_CENTS } from './pricing.js';
const STRIPE_BASE = 'https://api.stripe.com/v1';
export async function stripeFetch(path, { method = 'GET', params, secret = process.env.STRIPE_SECRET_KEY, fetchFn = fetch } = {}) {
  const response = await fetchFn(STRIPE_BASE + path, {
    method,
    headers: { Authorization: `Bearer ${secret}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    ...(params ? { body: new URLSearchParams(params).toString() } : {}),
    signal: AbortSignal.timeout(12000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Do not expose Stripe's raw response to the user; it may include operational data.
    throw new Error(`Payment provider request failed (${response.status}).`);
  }
  return data;
}
export async function ensureRecurringPrice(priceId) {
  const price = await stripeFetch('/prices/' + encodeURIComponent(priceId));
  if (!price.active || price.type !== 'recurring' || price.currency !== 'usd' ||
      price.unit_amount !== PLAN_PRICE_CENTS || price.recurring?.interval !== 'month' ||
      price.recurring?.interval_count !== 1 || price.billing_scheme !== 'per_unit') {
    throw new Error('The configured Stripe price does not match the $99 monthly device block.');
  }
  return true;
}
export async function createCheckoutSession(data, { origin, termsUrl }) {
  const params = {
    mode: 'subscription',
    'line_items[0][price]': process.env.STRIPE_PRICE_ID,
    'line_items[0][quantity]': String(data.blocks),
    customer_email: data.email,
    billing_address_collection: 'required',
    'tax_id_collection[enabled]': 'true',
    client_reference_id: crypto.randomUUID(),
    success_url: `${origin}/welcome.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#signup`,
    'metadata[plan]': 'praesto-assist-v0.5',
    'metadata[company]': data.company,
    'metadata[contact]': data.contact,
    'metadata[contact_phone]': data.phone,
    'metadata[tenant]': data.tenant,
    'metadata[initial_computers]': String(data.computers),
    'metadata[initial_blocks]': String(data.blocks),
    'metadata[setup_preference]': data.setup,
    'metadata[consent_timestamp]': new Date().toISOString(),
    'metadata[terms_url]': termsUrl,
    'subscription_data[metadata][plan]': 'praesto-assist-v0.5',
    'subscription_data[metadata][initial_blocks]': String(data.blocks),
    'subscription_data[metadata][initial_computers]': String(data.computers),
  };
  if (process.env.STRIPE_AUTOMATIC_TAX === 'true') params['automatic_tax[enabled]'] = 'true';
  return stripeFetch('/checkout/sessions', { method: 'POST', params });
}
export async function retrieveCheckoutSession(id) {
  return stripeFetch('/checkout/sessions/' + encodeURIComponent(id));
}
