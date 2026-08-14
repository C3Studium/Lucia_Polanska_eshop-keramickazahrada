# Model 2 — Backend: order lifecycle (edit/refund/cancel/tracking) + production hygiene

You are working in `/Users/matejforejt/Documents/GitHub/Lucia_Polanska_eshop-keramickazahrada/backend`
(Medusa 2.18, TypeScript). Czech ceramics e-shop, launching 09/2026. Admin UI text
is Czech, code and comments English. Do NOT commit — leave all changes in the
working tree. Do NOT add npm dependencies; do NOT edit `package.json`.

Three other models work in this repo in parallel. **File ownership — you may edit:**
- `backend/src/api/**` (all routes + `middlewares.ts`)
- `backend/src/lib/**` (incl. `constants.ts`, `order-edit-rules.ts`)
- `backend/src/admin/routes/**` and `backend/src/admin/lib/**` and existing
  `backend/src/admin/widgets/**` EXCEPT a new `order-invoice.tsx` another model creates
- `backend/src/subscribers/**`, `backend/src/jobs/**`, `backend/src/workflows/**`
- `backend/src/modules/segment/**`, `backend/src/modules/dobirkaPayment/**`,
  `backend/src/modules/comgate/**` (read mostly; small fixes allowed)

Do NOT touch: `medusa-config.js`, `.env.template`, `src/modules/resend/**`,
`src/modules/ceskaPostaFulfillment/**`, `src/modules/zasilkovnaFulfillment/**`,
anything iDoklad. If a task seems to need them, note it in your report instead.

Read every file before editing. Verify each claim below against the code.
The storefront repo half (`../storefront`) is READ-ONLY for you — grep it to
verify callers, never edit it.

## A. Fix the broken storefront URL (launch blocker — verified)

`medusa-config.js:30` destructures `STOREFRONT_URL` from `src/lib/constants.ts`,
but that export was removed (only a comment at ~line 28 remains) → 
`admin.storefrontUrl` is `undefined` → `src/subscribers/handle-reset-password.ts`
falls back to `https://storefront.com` and mails customers reset links pointing
at a third-party domain, token included.

Fix in `constants.ts` (you must not edit medusa-config): re-export
`STOREFRONT_URL` derived from the same env the rest of the codebase uses
(`STOREFRONT_PUBLIC_URL` — see `src/lib/storefront-url.ts`). Then fix
`handle-reset-password.ts` itself: build the link via the `storefront-url.ts`
helpers (add a `resetPasswordLink()` there next to `verifyEmailLink()`, same
encoding care, unit-tested in `src/lib/__tests__/storefront-url.unit.spec.ts`),
and make a missing env LOUD (log error, skip send) instead of mailing a wrong
domain. Remove the `// WIP` comment.

## B. Admin order-edit governance + „Vrátit rozdíl"

The three rules in `src/lib/order-edit-rules.ts` (no MTO lines, order must not
empty, settlement matrix) run only on the customer route
`src/api/store/orders/[id]/edit/route.ts`. Native admin order-edit endpoints
are ungoverned, and a customer edit that lowers the total prints „Rozdíl X Kč
vám vrátíme na kartu" + tells the merchant to refund „jedním klikem" — but no
such click exists.

1. **Middleware guard**: in `src/api/middlewares.ts`, add matchers for the
   native admin order-edit endpoints (`/admin/order-edits*` and the order-edit
   confirm routes — find the exact paths Medusa 2.18 exposes) that run the
   MTO-line ban and dobírka `cod_allowed` check from `order-edit-rules.ts`.
   Same Czech error messages as the store route. Unit-test the rule functions
   for the new call sites.
2. **Refund owed tracking**: when the customer edit route computes a negative
   settlement (~line 320-334), persist it: `order.metadata.refund_due` (amount,
   reason, created_at). Same for any admin path that produces an overpayment.
3. **„Vrátit rozdíl" in Objednávky+** (`src/admin/routes/objednavky/page.tsx`):
   on orders with `refund_due`, show the amount and a button that calls a new
   endpoint `POST /api/admin/merchant-orders/[orderId]/refund-difference` →
   uses the ComGate service's existing `refundPayment` (idempotent, over-refund
   guarded — see `src/modules/comgate/service.ts` ~line 423) for card payments;
   for dobírka/pickup payments it records a manual-refund instruction instead
   (she sends money herself) and marks it done. Clear `refund_due` on success,
   stamp `refund_history` in metadata. Toasts + failure reasons in Czech.
   Notify the customer with the already-mapped `order-refunded` template by
   emitting the notification the same way other admin routes send e-mails —
   do NOT edit the resend module; if the template key turns out not to be
   emittable without touching it, leave the e-mail out and report it.
4. **Dobírka enforcement at checkout**: `cod_allowed` is enforced only inside
   the edit route. Add server-side enforcement at cart completion (the workflow
   hook / completion path this codebase already extends — find where
   cart.metadata propagates to order and add validation there): a cart whose
   payment session is dobírka and whose items include a `cod_allowed === false`
   product must fail with a Czech message before order creation. Also enforce
   CZ-only dobírka (shipping address country) — `medusa-config` claims it but
   nothing checks it. Unit tests.

## C. MTO cancellation actually settles

`src/api/admin/made-to-order/orders/[orderId]/actions/route.ts` `cancel` action
(~line 600-625): cancels production + unpaid payment requests, but never
refunds a paid deposit, sends no customer e-mail, and emits
`made-to-order.cancelled` which has NO subscriber.

1. On cancel with a captured deposit: record `refund_due` (B.2) so it surfaces
   in Objednávky+ with the same „Vrátit rozdíl" flow (card → ComGate refund).
2. New subscriber for `made-to-order.cancelled` → customer e-mail via an
   already-registered template (`payment-cancelled` is registered in the resend
   provider — verify its key in `src/modules/resend/service.ts` READ-ONLY and
   use it; if none fits, report instead of editing the module).
3. `src/modules/dobirkaPayment/service.ts` `refundPayment` stamps
   `refunded: true` silently — extend the data it records (amount, at) so the
   admin flow in B.3 can display what must be returned manually.

## D. Tracking number — manual entry until the carrier API is live

Customers currently get shipment e-mails with `trackingNumber: ""`
(`src/subscribers/customer-emails.ts` ~line 295) and there is no way to enter
one. In `confirm-merchant-handover` workflow (`src/workflows/confirm-merchant-handover.ts`)
accept an optional tracking number + carrier, create the shipment with it, and
add the input in Objednávky+ where handover is confirmed (small inline input,
optional — she types it from the podací lístek; when the Balíkovna API lands it
arrives automatically and the input stays as override). The shipment e-mail
then carries the real number and the ČP tracking URL when present; when absent,
the e-mail must not render an empty tracking row (verify how the template
handles "" — fix the DATA you send, not the template).

## E. Production hygiene sweep (verify each, then fix)

- `src/api/middlewares.ts` ~42-57: delete `debugAuthMiddleware` and its three
  wishlist mounts; strip the auth-context/Authorization-slice logging in
  `src/api/store/customers/me/wishlists/route.ts` and the body/actor logging in
  `src/api/store/reviews/route.ts` + `src/api/store/customers/me/reviews/route.ts`.
- Delete `src/workflows/get-payment-url.ts` (dead scaffolding with fake Comgate
  payload) — grep first to confirm nothing imports it.
- Delete the starter stubs `src/api/admin/custom/route.ts` and
  `src/api/store/custom/route.ts`.
- Duplicate Sanity sync: `src/subscribers/product-sync.ts` and
  `src/subscribers/sanity-product-sync.ts` both run the same workflow on
  product.created/updated — keep one, delete the other.
- `src/subscribers/product.delete.ts` fires a workflow whose only step is a
  no-op Algolia placeholder (`src/workflows/steps/delete-products-from-algolia.ts`)
  — no Algolia client exists; delete subscriber + workflow + step.
- `src/api/store/carts/[id]/metadata/route.ts`: a GET that WRITES shipping
  metadata via `src/workflows/packeta-workflow.ts`. Grep the storefront
  (read-only) for callers; the current checkout posts cart metadata directly.
  If nothing calls it, delete route + workflow; if something does, convert to
  POST and report the storefront callsite for the storefront models.
- `src/api/key-exchange/route.ts`: unauthenticated route handing out the
  publishable key. Grep the storefront for usage; if unused, delete; if used,
  keep but note it in the report (publishable keys are public by design — no
  over-engineering).
- `src/modules/segment/service.ts` ~17-22: throws when `writeKey` is missing
  while the provider registers unconditionally → boot crash. Make it degrade:
  warn once and no-op sends when the key is absent.
- `src/workflows/steps/track-event.ts`: random `anonymousId` per event — derive
  a stable id (customer id / cart id when available) so sessions stitch.
- Hardcoded localhost in shipped admin code: `src/admin/lib/sdk.ts` (backend URL
  fallback), `src/admin/routes/sanity/page.tsx` (`http://localhost:8000/studio/`),
  `src/admin/widgets/express-checkout-widget.tsx` (`http://localhost:8000/...`).
  Route them through the mechanism the admin already uses for the backend URL
  (`RAILWAY_PUBLIC_DOMAIN_VALUE` bake / storefront URL from settings) so prod
  links work.
- `src/lib/constants.ts` + boot-time diagnostics: reduce the ~25 presence
  console.logs to one compact summary line (keep the information, lose the noise).
- Jobs cosmetics: remove the "change to * * * * * for debugging" leftovers in
  `src/jobs/check-restock.ts` and `src/jobs/send-abandoned-cart-notification.ts`.
- `src/api/admin/return-requests/[id]/decide/route.ts` ~21: hardcoded atelier
  return address — move to the merchant settings/env pattern used elsewhere.

## Gate (run at the end, fix what breaks)

```
cd backend
npx tsc --noEmit
npx jest --testPathPattern 'unit' --silent   # match how existing unit tests run — check package.json scripts first
npx medusa build
```
All three must pass (≈310 existing unit tests must stay green; add tests for
order-edit guards, refund-due flow, dobírka enforcement, storefront-url).
If a concurrent model's run collides on build artifacts, rerun. Finish with a
short report: what changed, what you deleted, anything left for Matěj.
