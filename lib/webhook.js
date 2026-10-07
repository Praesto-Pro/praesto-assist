import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifyStripeSignature(raw, header, secret, nowSeconds = Math.floor(Date.now()/1000)) {
  if (!header || !secret || typeof header !== 'string') return false;
  const parts = header.split(',').map(part => part.trim().split('='));
  const stamp = parts.find(([k])=> k==='t')?.[1];
  const signatures = parts.filter(([k]) => k==='v1').map(([,v])=>v);
  if (!stamp || !/^\d{10,}$/.test(stamp) || Math.abs(nowSeconds - Number(stamp)) > 300) return false;
  const expected = createHmac('sha256',secret).update(stamp + '.' + raw,'utf8').digest('hex');
  return signatures.some(s => {
    if (!/^[a-f0-9]{64}$/.test(s)) return false;
    return timingSafeEqual(Buffer.from(s,'hex'),Buffer.from(expected,'hex'));
  });
}
export function fulfillmentPayload(event) {
  const object = event.data?.object || {};
  const supported = new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','invoice.paid','invoice.payment_failed','customer.subscription.updated','customer.subscription.deleted']);
  if (!supported.has(event.type)) return null;
  const customer = object.customer;
  const subscription = object.subscription || (event.type.startsWith('customer.subscription.') ? object.id : null);
  return {
    event_id: event.id,
    event_type: event.type,
    occurred_at: event.created,
    stripe_customer_id: typeof customer === 'string' ? customer : customer?.id || null,
    stripe_subscription_id: typeof subscription === 'string' ? subscription : subscription?.id || null,
    stripe_object_id: object.id,
    stripe_status: object.status || null,
    payment_status: object.payment_status || null,
    plan_metadata: object.metadata || {},
    email: object.customer_email || object.customer_details?.email || null,
    // Recipient must deduplicate event_id and fetch the current Stripe subscription
    // before granting/changing entitlement. Never provision merely on a redirect.
    schema: 'praesto-assist-stripe-event-v1'
  };
}
