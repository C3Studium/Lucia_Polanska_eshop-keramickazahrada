# CHECK — full backend audit (read-only)

You are auditing `/Users/matejforejt/Documents/GitHub/Lucia_Polanska_eshop-keramickazahrada/backend`
(Medusa 2.18, TypeScript) — the backend of a Czech ceramics e-shop launching
09/2026. Your job is a COMPLETE production-readiness audit. You change NO
source code. Your only write is your report:
`docs/sprint-2026-08-14/report-backend.md` (repo root relative). A parallel
model audits the storefront; treat `../storefront` as read-only reference
(grep it to verify callers, never report storefront-only issues).

Your report drives 4 implementation prompts written afterwards. The goal state:
**both halves code-complete so that only the Balíkovna nAPI and iDoklad
credentials need to be dropped into Railway env vars.** Precision matters more
than volume — every claim with `file:line`, every uncertainty labeled.

## Decisions already made (audit against these, don't relitigate)

- **Packeta stays in code but is NOT offered** — no shipping option until the
  client decides. The provider must still be safe/correct code.
- **Lucia is NOT plátce DPH** — nothing may claim VAT; prices are final.
  Flag every DPH/VAT mention in backend code, e-mail templates, admin UI.
- **iDoklad is deferred** — built fully as the LAST change (creds exist).
  Don't investigate beyond confirming nothing exists; it is out of scope for
  the 4 prompts.
- **Kurzy bookings go through a contact form** (name, phone, e-mail, message)
  on the storefront — investigate what backend endpoint exists or is needed
  (see D3).
- **Doprava-a-platba page becomes dynamic**: real shipping options + per-option
  packaging-cost range (min–max across products; packaging price per product
  lives in the DB) — investigate the data model (see D2).

## A. Verify the prior audit (2026-08-14) — confirm, correct, or refute each

Confirmed already by a human: (a) `medusa-config.js:30` destructures
`STOREFRONT_URL` from `src/lib/constants.ts` which no longer exports it (only a
comment ~line 28) → `admin.storefrontUrl` undefined → reset-password mails fall
back to `https://storefront.com`; (b) `backend/.env` is git-ignored and
untracked. Re-verify the rest:

1. `src/modules/zasilkovnaFulfillment/service.ts` — constructor `(options)`
   instead of `(container, options)`; `PACKETA_API_KEY.toString()` throws when
   unset; `cod: Math.round(Number(order?.total))` unconditional (COD on prepaid
   orders); `weight: 2.5` hardcoded; catch returns fake success
   (`packeta_response: "Packeta API response"`); `apiPassword` logged in
   plaintext; `cancelFulfillment` empty; `labels: []`.
2. `src/modules/ceskaPostaFulfillment/service.ts` — record-only seam ~313-337
   (creds set → still falls back to manual), `cancelFulfillment` no-op,
   `validateFulfillmentData` pass-through, no tracking number ever produced;
   `src/subscribers/customer-emails.ts` ~295 sends `order-shipment` with
   `trackingNumber: ""` and no manual entry exists anywhere.
3. Order lifecycle gaps: `src/lib/order-edit-rules.ts` enforced only in
   `src/api/store/orders/[id]/edit/route.ts` (native admin order-edit endpoints
   unguarded — list the exact native routes that need middleware);
   ~320-334 promises a refund with no mechanism (`refund_due` doesn't exist);
   `cod_allowed` enforced nowhere at checkout completion; dobírka has no
   CZ-only check; `src/api/admin/made-to-order/orders/[orderId]/actions/route.ts`
   cancel (~600-625) refunds nothing, mails nobody, and emits
   `made-to-order.cancelled` which has no subscriber;
   `src/modules/dobirkaPayment/service.ts` `refundPayment` only stamps
   `refunded: true`; return-request decide route creates no native return/
   refund/restock and has a hardcoded atelier address (~line 21).
4. Hygiene: `debugAuthMiddleware` in `src/api/middlewares.ts` ~42-57 + three
   wishlist mounts; auth/body logging in wishlists/reviews routes; dead
   `src/workflows/get-payment-url.ts` (fake Comgate payload); starter stubs
   `src/api/{admin,store}/custom/route.ts`; duplicate Sanity sync subscribers
   (`product-sync.ts` + `sanity-product-sync.ts`); `product.delete.ts` → no-op
   Algolia step; GET-that-writes `src/api/store/carts/[id]/metadata/route.ts`
   (+ `packeta-workflow.ts`) — grep storefront for callers; unauthenticated
   `src/api/key-exchange/route.ts` — grep storefront for usage;
   `src/modules/segment/service.ts` throws on missing key while registered
   unconditionally (boot crash); `src/workflows/steps/track-event.ts` random
   anonymousId per event; hardcoded localhost in `src/admin/lib/sdk.ts`,
   `src/admin/routes/sanity/page.tsx`, `src/admin/widgets/express-checkout-widget.tsx`;
   ~25 boot console.logs in `constants.ts`/`medusa-config.js`; debug-schedule
   comments in `check-restock.ts` and `send-abandoned-cart-notification.ts`.
5. Resend: templates existing but never sent (delivery-failed, password-changed,
   email-change, sign-in-notification, account-change, address-added,
   payment-cancelled); `ORDER_REFUNDED` mapped but never emitted;
   `via.placeholder.com` default in `order-review.tsx`; `example.com` default in
   `merchant-daily-summary.tsx`; ~20 templates defaulting to hardcoded
   `https://keramickazahrada.cz/...`; `// WIP` type block in `service.ts` ~104.

## B. Fresh full sweep — what the prior audit missed

Walk ALL of `src/` (api routes incl. every middleware entry, workflows, jobs,
subscribers, modules, links, admin routes+widgets) hunting anything not
production-ready: unfinished flows, promises made in UI copy with no mechanism
behind them, money paths that can drift (bigNumber misuse, rounding), missing
auth on custom routes, race-prone metadata writes, events emitted with no
consumer and consumers listening to never-emitted events, jobs that assume
state that doesn't exist, migrations pending, admin UI actions calling
endpoints that don't exist (and vice versa). Also `integration-tests/`: which
suites exist and what they'd catch. Ignore cosmetics (placeholder attributes,
empty-state copy).

## C. Runtime state of the deployed backend (careful, read-only)

The deployed backend URL and publishable key are in the storefront env
(`../storefront/.env.local` — `NEXT_PUBLIC_MEDUSA_BACKEND_URL` or equivalent in
`src/lib/config.ts`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`). Using ONLY store
API GETs (plus at most one throwaway cart POST if shipping options require a
cart id — never complete it, never touch admin APIs, never the DB directly):

1. **Regions**: payment providers on the CZ region — is `pp_osobni-odber_pickup`
   present? Is dobírka? Comgate?
2. **Shipping options**: list them with prices and provider ids. Verify:
   Osobní odběr exists at 0 Kč; the Balíkovna option's provider id is
   `ceska-posta-fulfillment_balikovna` (a re-point of
   `so_01K2JNAER4GEGP0R011HC37PWS` was required); is any `packeta_packeta`
   option still offered (it must NOT be, per decisions)?
3. **Demo data**: do the Medusa seed apparel products (shirts/sweatshirts/
   pants/merch handles) still return from `/store/products`? 
4. Record exact responses (trimmed) in the report. If the deployed backend is
   unreachable or the key is missing, say so and mark these UNVERIFIED.

## D. Investigations the implementation prompts need answered

1. **Packaging cost per product**: where exactly does it live (product/variant
   `metadata` keys? the baleni-workbench admin page and
   `ceskaPostaFulfillment`'s `calculatePrice` know) — document the exact keys,
   units, defaults, and whether the store API exposes them on products. If not
   exposed, spec the smallest read-only store endpoint that returns per-option
   packaging min–max so the storefront can render ranges.
2. **Shipping options for the storefront page**: what store-API shape the
   dynamic doprava-a-platba block can consume (option name, amount, provider) —
   including whether prices are flat or calculated.
3. **Contact/inquiry endpoint**: does any backend route serve the storefront
   contact form (grep storefront `ContactDialog` for its target)? If none, spec
   the minimal one (name, phone, e-mail, message → Resend mail to merchant +
   thanks; spam guard) for the kurzy inquiry form.
4. **Refund plumbing**: confirm `src/modules/comgate/service.ts` refund/cancel
   signatures (~423-508) the „Vrátit rozdíl" flow will call, and where
   `refund_due` metadata should live so both admin queue and order detail see it.
5. **Manual tracking entry**: exact seam in `confirm-merchant-handover.ts` and
   the Objednávky+ UI where a tracking-number input belongs.
6. **DPH sweep**: every place backend copy/e-mails/admin mention DPH — list for
   the neplátce rewrite.

## Report format (`docs/sprint-2026-08-14/report-backend.md`)

Markdown, these sections: **1. Confirmed** (finding + file:line, one line each)
· **2. Corrected/refuted** (what the prior audit got wrong, with proof) ·
**3. New findings** (severity-ranked: blocker / must / nice) · **4. Runtime
state** (C — verbatim evidence, UNVERIFIED where applicable) ·
**5. Implementation answers** (D — concrete: metadata keys, route paths,
signatures) · **6. Suggested split** (your opinion: how this backend work
divides into 2 parallel non-conflicting workstreams — file-ownership lists).

You may run `npx tsc --noEmit` and the unit suite to establish the green
baseline (report counts). No file edits, no commits, no installs.
