import { createHmac } from 'node:crypto';
import { verifyStripeSignature, fulfillmentPayload } from '../lib/webhook.js';
export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const handoff = process.env.FULFILLMENT_WEBHOOK_URL;
  const handoffSecret = process.env.FULFILLMENT_WEBHOOK_SECRET;
  if (!secret || !handoff || !handoffSecret) return Response.json({ error: 'Webhook not configured.' }, { status: 503 });
  let raw;
  try { raw = await request.text(); }
  catch { return Response.json({ error: 'Unreadable request.' }, { status: 400 }); }
  if (raw.length > 250000) return Response.json({ error: 'Event too large.' }, { status: 413 });
  if (!verifyStripeSignature(raw, request.headers.get('stripe-signature'), secret)) return Response.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  let event;
  try { event = JSON.parse(raw); }
  catch { return Response.json({ error: 'Invalid event.' }, { status: 400 }); }
  const payload = fulfillmentPayload(event);
  if (!payload) return Response.json({ received: true, ignored: true });
  // Fail closed: do not tell Stripe 'delivered' unless Vtiger ingestion confirms receipt.
  // CRM consumer MUST idempotently handle event_id and reconcile authoritative Stripe state.
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256',handoffSecret).update(body).digest('hex');
  try {
    const result = await fetch(handoff, { method:'POST', headers: { 'Content-Type': 'application/json', 'X-Praesto-Event-Signature':signature, 'X-Praesto-Event-ID':String(event.id) }, body, signal: AbortSignal.timeout(10000) });
    if (!result.ok) throw new Error(`Handoff returned ${result.status}`);
    return Response.json({ received: true });
  } catch(error) {
    console.error('Stripe webhook handoff failed:', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'Fulfillment temporarily unavailable.' }, { status: 503 });
  }
}
