export const PLAN_PRICE_CENTS = 9900;
export const COMPUTERS_PER_BLOCK = 10;
export const MAX_COMPUTERS = 10000;
export function computeBlocks(computers) {
  if (!Number.isInteger(computers) || computers < 0 || computers > MAX_COMPUTERS) throw new RangeError('Invalid computer count');
  return Math.max(1, Math.ceil(computers / COMPUTERS_PER_BLOCK));
}
export function validateSignup(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid enrollment request.');
  const v = {};
  for (const [key, max] of [['company',100], ['contact',100], ['email',180], ['phone',30]]) {
    if (typeof body[key] !== 'string' || body[key].length > max || (key !== 'phone' && !body[key].trim())) throw new Error('Please provide valid business contact details.');
    v[key] = body[key].trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) throw new Error('Please enter a valid work email.');
  if (body.website) throw new Error('Enrollment request could not be accepted.');
  if (!['microsoft365','googleworkspace'].includes(body.tenant)) throw new Error('Choose a supported productivity platform.');
  if (!['self','assisted'].includes(body.setup)) throw new Error('Choose a setup method.');
  if (body.authority !== true || body.scope !== true || body.terms !== true) throw new Error('Please review the required acknowledgments.');
  v.computers = body.computers;
  v.blocks = computeBlocks(v.computers);
  v.tenant = body.tenant;
  v.setup = body.setup;
  return v;
}
export function liveConfigReady(env = process.env) {
  const required = ['STRIPE_SECRET_KEY','STRIPE_PRICE_ID','STRIPE_WEBHOOK_SECRET','FULFILLMENT_WEBHOOK_URL','FULFILLMENT_WEBHOOK_SECRET','SITE_URL','SERVICE_TERMS_URL','PRIVACY_URL'];
  if (env.ACCEPT_LIVE_SIGNUPS !== 'true') return false;
  if (!required.every(k => typeof env[k] === 'string' && env[k].trim())) return false;
  try {
    const site = new URL(env.SITE_URL); const fulfillment = new URL(env.FULFILLMENT_WEBHOOK_URL);
    const terms = new URL(env.SERVICE_TERMS_URL); const privacy = new URL(env.PRIVACY_URL);
    if ([site,fulfillment,terms,privacy].some(url => url.protocol !== 'https:')) return false;
    if (!/^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY)) return false;
    if (!env.STRIPE_PRICE_ID.startsWith('price_')) return false;
    return true;
  } catch { return false; }
}
