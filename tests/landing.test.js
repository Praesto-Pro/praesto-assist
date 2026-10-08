import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { computeBlocks, validateSignup, liveConfigReady } from '../lib/pricing.js';
import { POST as checkout } from '../api/create-checkout.js';
import { verifyStripeSignature, fulfillmentPayload } from '../lib/webhook.js';
const signup = {
  company:'Example Co',contact:'Jane Tester',email:'jane@example.com',phone:'',
  computers:25,tenant:'microsoft365',setup:'self',authority:true,scope:true,terms:true,website:''
};
test('device blocks round up, with a one-block minimum', () => {
  for (const [count,expected] of [[0,1],[1,1],[10,1],[11,2],[20,2],[21,3],[25,3],[100,10]]) assert.equal(computeBlocks(count),expected);
  assert.throws(()=>computeBlocks(-1));
  assert.throws(()=>computeBlocks(1.3));
});
test('roster access is not a price input; 25 computers means $297',()=>{
  const data = validateSignup(signup);
  assert.equal(data.blocks,3);
  assert.equal(data.blocks*99,297);
  assert.equal(data.company,'Example Co');
});
test('rejects missing consent, unsupported tenant, bot and invalid email',()=>{
  assert.throws(()=>validateSignup({...signup,scope:false}));
  assert.throws(()=>validateSignup({...signup,tenant:'unknown-platform'}));
  assert.throws(()=>validateSignup({...signup,website:'https://spam.example'}));
  assert.throws(()=>validateSignup({...signup,email:'not-email'}));
});
test('live checkout defaults to disabled without all launch settings',()=>{
  assert.equal(liveConfigReady({ACCEPT_LIVE_SIGNUPS:'false'}),false);
});
test('checkout safely returns no-charge error if integration is not active',async()=>{
  const old = process.env.ACCEPT_LIVE_SIGNUPS;
  process.env.ACCEPT_LIVE_SIGNUPS='false';
  try {
    const req = new Request('http://localhost/api/create-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(signup)});
    const result = await checkout(req);
    assert.equal(result.status,503);
    assert.match((await result.json()).error,/No payment has been collected/i);
  } finally { if (old===undefined) delete process.env.ACCEPT_LIVE_SIGNUPS; else process.env.ACCEPT_LIVE_SIGNUPS=old; }
});
test('Stripe webhook verifies raw bytes and rejects replay or tampering',()=>{
  const raw=JSON.stringify({id:'evt_123',type:'checkout.session.completed'}),now=1800000000,secret='whsec_test';
  const signature=createHmac('sha256',secret).update(`${now}.${raw}`).digest('hex');
  const header=`t=${now},v1=${signature}`;
  assert.equal(verifyStripeSignature(raw,header,secret,now),true);
  assert.equal(verifyStripeSignature(raw+' ',header,secret,now),false);
  assert.equal(verifyStripeSignature(raw,header,secret,now+400),false);
});
test('fulfillment passes event id for idempotent Vtiger processing',()=>{
  const payload=fulfillmentPayload({id:'evt_test',type:'checkout.session.completed',created:1800,data:{object:{id:'cs_test',customer:'cus_1',subscription:'sub_1',payment_status:'paid',metadata:{initial_blocks:'2'}}}});
  assert.equal(payload.event_id,'evt_test');
  assert.equal(payload.plan_metadata.initial_blocks,'2');
  assert.equal(payload.stripe_subscription_id,'sub_1');
  assert.equal(fulfillmentPayload({type:'other'}),null);
});
test('live checkout derives 3 Stripe units from 25 computers and validates $99 price', async()=>{
  const keys=['ACCEPT_LIVE_SIGNUPS','SITE_URL','STRIPE_SECRET_KEY','STRIPE_PRICE_ID','STRIPE_WEBHOOK_SECRET','FULFILLMENT_WEBHOOK_URL','FULFILLMENT_WEBHOOK_SECRET','SERVICE_TERMS_URL','PRIVACY_URL'];
  const oldEnv=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const oldFetch=global.fetch;
  Object.assign(process.env,{
    ACCEPT_LIVE_SIGNUPS:'true',SITE_URL:'https://assist.example.com',STRIPE_SECRET_KEY:'sk_test_mocked',
    STRIPE_PRICE_ID:'price_mock',STRIPE_WEBHOOK_SECRET:'whsec_mock',
    FULFILLMENT_WEBHOOK_URL:'https://vtiger.example.com/events',FULFILLMENT_WEBHOOK_SECRET:'secret_test',
    SERVICE_TERMS_URL:'https://assist.example.com/final-terms',PRIVACY_URL:'https://assist.example.com/final-privacy'
  });
  let quantity=null;
  global.fetch=async(url,opts)=>{
    if (String(url).includes('/prices/')) return new Response(JSON.stringify({active:true,type:'recurring',currency:'usd',unit_amount:9900,recurring:{interval:'month',interval_count:1},billing_scheme:'per_unit'}),{status:200});
    if (String(url).endsWith('/checkout/sessions')) {
      const data=new URLSearchParams(opts.body);
      quantity=data.get('line_items[0][quantity]');
      assert.equal(data.get('mode'),'subscription');
      assert.equal(data.get('customer_email'),'jane@example.com');
      assert.equal(data.get('metadata[initial_computers]'),'25');
      assert.equal(data.get('line_items[0][price]'),'price_mock');
      assert.equal(data.has('line_items[1][price]'),false);
      return new Response(JSON.stringify({url:'https://checkout.stripe.com/c/pay/mock'}),{status:200});
    }
    throw new Error('Unexpected Stripe API endpoint');
  };
  try {
    assert.equal(liveConfigReady(),true);
    for (const tenant of ['microsoft365','googleworkspace','other']) {
      const req=new Request('https://assist.example.com/api/create-checkout',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://assist.example.com'},body:JSON.stringify({...signup,tenant})});
      const res=await checkout(req);
      assert.equal(res.status,200);
      assert.equal(quantity,'3');
      assert.equal((await res.json()).url,'https://checkout.stripe.com/c/pay/mock');
    }
  } finally {
    global.fetch=oldFetch;
    for(const key of keys){if(oldEnv[key]===undefined) delete process.env[key];else process.env[key]=oldEnv[key];}
  }
});

test('landing page describes broad AI best effort and included safety review, with no closed catalog promise',()=>{
  const html=readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const terms=readFileSync(new URL('../terms.html', import.meta.url), 'utf8');
  assert.match(html,/any issue affecting an enrolled computer/i);
  assert.match(html,/technician safety review is included/i);
  assert.match(html,/separate approval|without authorization/i);
  assert.match(html,/not a restricted catalog/i);
  assert.doesNotMatch(html,/service covers only the current published/i);
  assert.doesNotMatch(html,/six focused types of assistance/i);
  assert.match(terms,/included technician safety review/i);
});


test('sales copy addresses owners and consistently names Praesto Assist Agent, without the engineer phrase',()=>{
  const html=readFileSync(new URL('../index.html', import.meta.url),'utf8');
  assert.match(html,/Stop being the/);
  assert.match(html,/office IT person/i);
  assert.match(html,/Praesto Assist Agent/);
  assert.match(html,/employees ask for help directly/i);
  assert.doesNotMatch(html,/AI IT engineer|your AI engineer|the AI engineer/i);
  assert.match(html,/technician safety review/i);
  assert.match(html,/without authorization/i);
});
