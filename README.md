# Praesto Assist Agent landing page and Stripe-ready signup

A responsive no-dependency website for **Praesto Assist landing-page content v0.7 (sales-first copy for owner-led businesses; commercial device-block pricing retained from v0.5)**. This package includes the marketing page, price calculator, business signup form, a protected Stripe Checkout session creator, checkout-status route, webhook receiver, and a Vtiger fulfillment handoff contract.

**No Stripe charges or Vtiger records are created by the delivered preview.** Live checkout is explicitly disabled until every required integration and service-release gate is complete.

## Preview locally

Prerequisite: Node.js 20+.

```bash
npm run dev
# Open http://localhost:4173
npm test
```

No dependency installation required. The front-end can be inspected as a plain HTML/CSS/JS project; local API endpoints require `npm run dev`.

## Key commercial rules

- $99/month per **started block of 10 enrolled computers**: `max(1, ceil(computers / 10)) × $99`.
- Named users are access control, not a price meter. A shared or spare enrolled computer counts.
- One subscribed block minimum even with zero enrolled devices.
- Self-onboarding costs $0 upfront. Human-assisted onboarding costs $199 per started 10-computer block, normally $500 per block, as a one-time service billed separately with approval. The calculator and signup show the fee, savings, and subscription separately. No onboarding amount is added to Stripe automatically.
- Included service is best-effort OpenFrame/Fae AI assistance for **any reported issue on an enrolled computer**, limited by technical access, AI capability, non-destructive operation, and safety approval. The six feature cards show examples, **not an enforceable catalog**. Potentially dangerous AI-proposed actions require Praesto technician safety review, which **is included and not billable**. If the AI cannot resolve the issue, optional human-led troubleshooting/remediation requires separate scope and spending authorization. Phone and email remain human intake, not the included AI channel. Proactive RMM/monitoring/patching/backup/security operations are not included.
- In the signup calculator, the selected computer count is the customer's **initial expected capacity**. The **billing entitlement and future block adjustments must use confirmed enrolled computers in Vtiger**. The signup form itself cannot count enrolled devices.
- Productivity platform choices: Microsoft 365, Google Workspace, or Other. Environment compatibility is verified before enrollment.
- Initial device eligibility and approved OS/runbook matrix must be validated in onboarding.
- No broad unlimited-support or human-SLA claims.

## Go-live configuration

Deploy the root folder to a Vercel project (plain static site plus functions in `api/`). Set these environment variables in the deployment environment, **never commit secrets**:

| Variable | Purpose |
|---|---|
| `ACCEPT_LIVE_SIGNUPS=true` | Final explicit launch switch, default off. |
| `SITE_URL` | Canonical HTTPS origin of the landing page, e.g. `https://assist.yourdomain.com`. Must match browser Origin. |
| `STRIPE_SECRET_KEY` | Stripe secret API key (test before live). |
| `STRIPE_PRICE_ID` | A Stripe monthly recurring USD per-unit Price of **exactly $99.00**. Server independently verifies it before creating checkout. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for Stripe webhook at `/api/stripe-webhook`. |
| `FULFILLMENT_WEBHOOK_URL` | HTTPS URL receiving signed checkout/renewal/cancellation events and reconciling them to Vtiger. |
| `FULFILLMENT_WEBHOOK_SECRET` | Random server-side key for authenticating event handoffs. |
| `SERVICE_TERMS_URL` | HTTPS URL of final legally reviewed published service terms, including the technician-review and optional paid-escalation boundaries. |
| `PRIVACY_URL` | HTTPS URL of final reviewed privacy notice and related data processing disclosures. |
| `STRIPE_AUTOMATIC_TAX` | Optional `true` only after configuring Stripe Tax and eligibility. |

**If any required variable is missing, signup responds with HTTP 503 and does not create a payment.** Do not change this failure policy just to enable a demo. The supplied `terms.html` and `privacy.html` are explicit **draft placeholders**. The `/api/terms` and `/api/privacy` routes redirect to finalized external legal pages when configured.

### Stripe setup

1. In Stripe, create a product `Praesto Assist Device Block`, price `$99.00 USD`, recurring **monthly**, with quantity representing the number of 10-device blocks. Copy `price_...` into `STRIPE_PRICE_ID`.
2. Test using `sk_test_...`, a test price, and Stripe test webhook signing secret. The landing site shows the customer an estimate; Stripe hosts card entry and collects required billing address / tax ID where applicable.
3. Configure webhook events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Webhook signature is HMAC-SHA256 verified against the **raw request body** before any handoff. Unsupported event types are ignored.
5. Forwarded fulfillment messages have `X-Praesto-Event-ID` and `X-Praesto-Event-Signature` HMAC-SHA256 headers. The destination must verify the signature, **deduplicate event IDs durably**, and fetch current Stripe subscription/payment status before provisioning or altering entitlements.
6. **Do not mark a Stripe checkout complete just because a browser reaches `/welcome.html`.** The webhook and Vtiger reconciliation are authoritative. For asynchronous payment methods, do not grant entitlement until payment is confirmed.
7. Return non-2xx from the Vtiger fulfillment receiver when it has not durably stored the event. The relay returns 503, allowing Stripe retry. Build a dead-letter/reconciliation path before go-live.

### Vtiger integration contract

The webhook forwards a JSON object including: `schema`, `event_id`, `event_type`, `occurred_at`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_object_id`, `stripe_status`, `payment_status`, `plan_metadata`, and `email` (where supplied by Stripe).

The Vtiger integration must establish and update: company, billing administrator, technical approver, spending approver, subscribed block count, confirmed enrolled device count, named-user roster, plan/service-description version, Stripe identifiers, and lifecycle state. Billing changes on **confirmed** device additions require billing-admin approval and Stripe subscription update/proration. Confirmed reductions take effect next renewal, not retrospectively.

**Not included in this source package:** live Vtiger API connector, OpenFrame enrollment/orchestration, final reviewed legal text, subscription-change portal, automated recurring reconciliation, or deployed domain. Those are integration and operating release gates, not functionality the preview should pretend to have.

## Security & launch checklist

- [ ] Final legal review including cancellation, fair use, refund and liability terms, privacy and processing arrangements.
- [ ] Confirm OpenFrame contract and AI consumption/overage terms.
- [ ] Validate which OpenFrame actions are safe and reversible on supported client OS builds, and **enforce a technician review gate** for potentially dangerous AI-proposed actions. Never allow destructive unreviewed behavior.
- [ ] Verify proactive modules that are not sold are disabled/hidden. Test that technician review is included and does not create a billing event; billable human intervention must require a **separate** approval after AI cannot resolve.
- [ ] Complete organization-scoped enrollment, device entitlement, tenant segregation, permission approvals and replay rejection.
- [ ] Configure audited Vtiger fulfillment receiver with durable event ID deduplication, customer mapping, and Stripe reconciliation.
- [ ] Add checkout endpoint abuse controls (WAF/rate limits/CAPTCHA) and operational alerts before public launch.
- [ ] Test Stripe webhook signatures, duplicate events, delayed payment, failed renewals, cancellations, subscription changes, and retry/delivery failures.
- [ ] Finalize human labor rates, hours, assisted setup fees, escalation process and operator queue.
- [ ] Complete 90-day historical ticket analysis and three-company pilot from blueprint.
- [ ] Smoke test desktop/mobile and keyboard accessibility. No passwords or device enrollment tokens should ever be requested on this signup form.

## Technical organization

- `index.html`, `styles.css`, `app.js`: landing page and client-side preview. The cost calculator is convenience only, never the server billing authority.
- `api/create-checkout.js`: validates company details, makes sure live configuration is complete, verifies Stripe Price amount/interval/currency, creates hosted subscription Checkout session.
- `api/stripe-webhook.js`, `lib/webhook.js`: Stripe signature check and reliable signed fulfillment callback.
- `api/checkout-status.js`, `welcome.html`: read-only checkout status, not proof of entitlement.
- `api/terms.js`, `api/privacy.js`: redirect to approved legal documents (or draft placeholders in preview).
- `lib/pricing.js`: canonical capacity/block calculation and form validation.
- `dev-server.mjs`: local preview and API adapter using Node built-in modules.
- `tests/landing.test.js`: pricing, consent, safety gate, signature and handoff tests.

Source of truth: v0.5 device-block commercial rules, **superseded for service scope and escalation by the user's 7 October 2026 clarification**: broad, non-destructive best-effort on enrolled computers; technician safety review included; human repair billable only after AI cannot resolve and the customer authorizes it. This changes customer-facing wording, not a claim that OpenFrame safety controls are already configured or validated.

## v0.7 copy revision

The page now addresses the owner of a small business without an IT employee: an interruption-heavy day of employee technology questions. The service is named **Praesto Assist Agent** in the site content. The six issue cards are everyday employee questions, not technical scope categories. All checkout calculations, consent gates, safety review requirements, paid escalation approvals and other backend controls remain unchanged.

## Taste design revision

The landing page follows the preserve-redesign guidance in [Taste](https://github.com/Leonxlnx/taste-skill/tree/main/skills/taste-skill). Design settings are variance 4, motion 2, and density 4: a restrained service website for small-business owners, implemented with the existing native HTML/CSS/JavaScript stack. The Praesto logo, routes, navigation labels, pricing rules, form field names/order, and consent text are preserved.

Semantic CSS tokens provide system-aware light/dark appearances with an optional saved preference. Panels use a 12px radius and controls use 8px. Keyboard focus is visible on the calculator and setup radios; setup choices use a fieldset/legend; estimate changes use one debounced live status region. Mobile navigation transfers focus to its destination and supports Escape. The hero photograph is AI-generated editorial imagery, not a customer photograph or product screenshot. It is stored locally as a compressed WebP; the interactive support illustration remains explicitly a demonstration.

Verification includes the existing checkout/pricing tests, browser checks at desktop and 320px widths, native required-field validation, calculator and radio keyboard interaction, and rendered-text contrast checks in both appearances. These checks do not constitute a complete WCAG conformance audit. Screen-reader combinations, text-spacing overrides, actual browser zoom, and Lighthouse/Core Web Vitals remain separate verification work. Final legal pages and production enrollment controls remain the existing launch gates.

### Interactive Praesto demo

The How it works section includes a scripted, Praesto-branded support workspace inspired by Flamingo's Fae IT Helper and approval safeguards. Direct link: `/#interactive-demo`. Four examples cover Outlook, Wi-Fi, performance, and printing. A typed issue routes to one of those examples; this is not a live AI chat. Follow-up answers branch between a targeted repair and technician review for broader symptoms.

Diagnostic and repair steps appear sequentially, with reduced-motion preferences skipping delays. Visitors explicitly approve or decline changes, verify outcomes, and inspect a simulated ticket with their description, follow-up answer, diagnostic and action history. New requests cancel any pending sequence. The demo never accesses a computer or submits a ticket. Paid human troubleshooting remains subject to separate scope and cost approval.

Verified local resolution, failed repair handoff, broader network handoff, printer decline and reconsideration, typed issue routing, switching scenarios during diagnostics, keyboard interaction, mobile layout without horizontal overflow, and light/dark appearance. Existing automated tests cover pricing, checkout gates, and commercial copy.

### UI UX Pro Max review

Installed the reusable skill in `C:/Users/Praesto Dev/.codex/skills/ui-ux-pro-max` from `nextlevelbuilder/ui-ux-pro-max-skill` (including local scripts, data, references, and license). Applied targeted UX searches for error summaries, compact labels, and unobscured focus; retained the existing plain HTML/CSS/JS stack and brand design.

Review fixes: linked signup error summary with persistent inline errors and `aria-invalid`/`aria-describedby`; summary focus after failed submission; visible demo message label and 16px input text; readable demo metadata; 44px mobile menu target; hover/pressed feedback; asynchronous diagnostics retain focus when visitors move elsewhere.

Verified 375/768/1024/1440px widths, light/dark computed text contrast, keyboard error navigation and clearing, and focus preservation during diagnostics. These checks are not a WCAG certification. Screen reader, zoom/text-spacing overrides, and performance lab testing remain unverified. Terms/privacy endpoints still return placeholders; launch configuration and integration gates remain necessary before accepting paid subscriptions.

### Taste frontend pass (8 October 2026)

Applied `design-taste-frontend` in preserve mode: DESIGN_VARIANCE 4, MOTION_INTENSITY 2, VISUAL_DENSITY 4. Retained the native HTML/CSS/JS architecture, brand artwork, information architecture, title/description, form fields, and consent/legal copy. Functional demo behavior remains outside this skill's marketing-page scope.

Refinements: self-hosted Manrope variable font (Latin WOFF2, about 24KB; OFL in `assets/fonts/Manrope-OFL.txt`), two-line hero headline with 16-word supporting copy, shared Tabler icon family for marketing features/actions, a capabilities introduction beside a two-column feature list, consistent spacing and stronger muted text contrast. Existing Tabler MIT license covers the added icons. No runtime font requests to third-party services.

Verified widths 320/375/768/1024/1440, two-line hero and visible CTA at each tested size, normal desktop nav height under 80px, light/dark computed text contrast, keyboard demo decline, calculator $297 for 25 computers, signup error focus, FAQ keyboard activation, and all 10 existing tests. PageSpeed's Lighthouse endpoint returned HTTP 429, so Core Web Vitals/performance scores remain unverified.

### Responsive assets and first paint

The hero uses 360/540/720/1080/1448px WebP candidates with sizes matching the CSS grid, plus a matching responsive preload. Both wordmarks use lossless 180/360/540px WebP candidates; original branding assets remain available. Intrinsic image dimensions reserve the existing aspect ratios.

`npm run build` regenerates the first-screen CSS in `index.html` from `styles.css`, preserving source order and media overrides. The complete stylesheet loads asynchronously with a no-JavaScript fallback. Edit `styles.css` as the source of truth; the build also runs before local development/tests and during Vercel deployment. No third-party origins need preconnection.
