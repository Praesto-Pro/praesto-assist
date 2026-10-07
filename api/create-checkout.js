import { validateSignup, liveConfigReady } from '../lib/pricing.js';
import { createCheckoutSession, ensureRecurringPrice } from '../lib/stripe.js';
export async function POST(request) {
  if (!liveConfigReady()) return Response.json({ error: 'Secure checkout is not active yet. No payment has been collected.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const allowedOrigin = new URL(process.env.SITE_URL).origin;
  if (request.headers.get('origin') !== allowedOrigin) return Response.json({ error: 'Please submit this form from the Praesto Assist site.' }, { status: 403 });
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) return Response.json({ error: 'Invalid request format.' }, { status: 415 });
  if (Number(request.headers.get('content-length') || 0) > 8192) return Response.json({ error: 'Request is too large.' }, { status: 413 });
  let signup;
  try { signup = validateSignup(await request.json()); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Invalid enrollment request.' }, { status: 400 }); }
  try {
    await ensureRecurringPrice(process.env.STRIPE_PRICE_ID);
    const session = await createCheckoutSession(signup, { origin: allowedOrigin, termsUrl: process.env.SERVICE_TERMS_URL });
    const url = new URL(session.url || '');
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Invalid payment checkout destination');
    return Response.json({ url: session.url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Checkout creation unavailable:', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'Secure checkout is temporarily unavailable. No payment has been collected.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
