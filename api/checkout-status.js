import { retrieveCheckoutSession } from '../lib/stripe.js';
export async function GET(request) {
  if (!process.env.STRIPE_SECRET_KEY) return Response.json({ error: 'Payment verification is not configured.' }, { status: 503 });
  const id = new URL(request.url).searchParams.get('session_id');
  if (!id || !/^cs_(test|live)_[a-zA-Z0-9]{10,}$/.test(id)) return Response.json({ error: 'Invalid checkout reference.' }, { status: 400 });
  try {
    const session = await retrieveCheckoutSession(id);
    return Response.json({ status: session.status, payment_status: session.payment_status }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Unable to verify checkout right now.' }, { status: 503 }); }
}
