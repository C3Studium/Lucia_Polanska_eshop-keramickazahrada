# Model 1 — Backend: carrier integrations + iDoklad invoicing

You are working in `/Users/matejforejt/Documents/GitHub/Lucia_Polanska_eshop-keramickazahrada/backend`
(Medusa 2.18, TypeScript). Czech ceramics e-shop, launching 09/2026. Admin UI text
is Czech, code and comments English. Do NOT commit — leave all changes in the
working tree. Do NOT add npm dependencies (use `fetch`); do NOT edit `package.json`.

Three other models work in this repo in parallel. **File ownership — you may edit:**
- `backend/src/modules/ceskaPostaFulfillment/**`
- `backend/src/modules/zasilkovnaFulfillment/**`
- `backend/src/modules/resend/**` (you are the ONLY model allowed here)
- `backend/medusa-config.js` (you are the ONLY model allowed here)
- `backend/.env.template`
- NEW files you create: `backend/src/modules/idoklad/**` (or `src/lib/idoklad*`),
  new subscribers `backend/src/subscribers/issue-invoice*.ts`, new admin widget
  `backend/src/admin/widgets/order-invoice.tsx`, new unit tests.

Do NOT touch: `src/api/**`, `src/lib/constants.ts`, `src/admin/routes/**`,
existing subscribers, jobs, other workflows. If a task seems to need them, note
it in your final report instead.

Read every file before editing it. Verify each claim below against the code —
fix what is actually there, not what this brief says.

## A. Balíkovna — implement the ČP nAPI (B2BZasilka) for real

Today `src/modules/ceskaPostaFulfillment/service.ts` is record-only: even with
`BALIKOVNA_API_*` set, `createFulfillment` (~line 313-337) logs a warning and
falls back to `mode: "manual"`, `labels: []`. API credentials arrive in 2 days —
build the integration now, env-gated, so it activates the moment the env vars land.

Context: `docs/TODO-carrier-account.md` (env table: `BALIKOVNA_API_URL`,
`BALIKOVNA_API_TOKEN`, `BALIKOVNA_API_SECRET`, `BALIKOVNA_CUSTOMER_ID`),
`src/api/admin/merchant-orders/[orderId]/label/route.ts` (already reads
`fulfillment.labels` and shows the Balíkovna destination — no changes needed there).
Balíkovna label address rule: `BALÍKOVNA, {zip} {name}` from order metadata
`balikovna_point_zip` / `balikovna_point_name` (zip is the depot's, never the
street address PSČ). Service codes: NB (Balíkovna), DR (Balík Do ruky) — see
`CP_SERVICE_CODES` in the service.

Build:
1. **A dedicated client** `src/modules/ceskaPostaFulfillment/napi-client.ts`
   implementing the ČP B2B nAPI operations: `sendParcels` (parcel booking →
   parcel/tracking number), `getParcelLabel` (PDF), `cancelParcel`, plus the
   HMAC request signing (Authorization header per ČP B2B spec: token +
   SHA-256/HMAC signature of timestamp+content — implement behind a small
   `signRequest()` you can adjust when the official YAML spec is in hand).
   Base URL from `BALIKOVNA_API_URL` (prod `https://b2b.postaonline.cz/restapi/...`).
   Every request/response typed; errors surfaced as thrown `MedusaError`s with
   Czech messages — never swallowed, never fake success.
2. **Wire it into the provider**: when `hasCredentials()` is true,
   `createFulfillment` books the parcel (recipient from delivery address; for
   Balíkovna options the destination is the pickup point — zip/name from order
   metadata; weight already computed by the service), stores the returned
   tracking number, downloads the label PDF, uploads it via the file module
   (MinIO is configured) and returns it in `labels: [{url, tracking_number}]`.
   Keep the record-only fallback when credentials are absent — that behaviour
   and its honest Czech messaging must not regress.
3. `validateFulfillmentData`: for Balíkovna options require the pickup point
   (zip+name in cart/order metadata) and fail with a clear Czech message.
4. `cancelFulfillment`: call `cancelParcel` when the fulfillment was booked
   (has a parcel number in `data`); keep the current no-op + log for manual mode.
5. `getFulfillmentDocuments`: return stored labels.
6. **Tests**: unit-test the client against a mocked `fetch` (signing, booking
   happy path, API error propagation, label download) and the provider's
   fallback logic. Mark the exact wire format with a short comment where it must
   be re-verified against the official spec when keys arrive.

## B. Zásilkovna (Packeta) — make the provider honest

`src/modules/zasilkovnaFulfillment/service.ts` is a broken first draft. Verify
and fix ALL of these (they are real-money bugs):
- constructor signature `(options)` — Medusa passes `(container, options)`;
- `PACKETA_API_KEY.toString()` throws when the env var is unset — must degrade
  to a disabled/record-only mode with a Czech log, never a 500;
- `cod: Math.round(Number(order?.total))` sent unconditionally — **every parcel
  is booked cash-on-delivery even when paid by card**. COD amount only when the
  order's payment is dobírka (see `src/modules/dobirkaPayment` for the provider
  id); otherwise 0/absent;
- `weight: 2.5` hardcoded — compute from items like ceskaPosta does (shared
  helper is fine, put it in the module you own);
- the `catch` returns fake success (`packeta_response: "Packeta API response"`)
  — a failed booking must throw;
- request body with `apiPassword` is logged in plaintext — remove; never log
  secrets or full payloads;
- `cancelFulfillment` empty body — implement (Packeta `cancelPacket`) or at
  minimum log honestly like ceskaPosta's manual mode;
- `labels: []` — fetch the label PDF (Packeta API `packetLabelPdf`) and return
  it the same way as A.2.
Keep it env-gated and registered; if Matěj decides to drop Packeta he will
unregister it himself (note in your report that this is pending his decision).

## C. iDoklad — invoice for every paid order (README §2 launch item)

Nothing exists yet (repo-wide: no invoice code). Build it env-gated on
`IDOKLAD_CLIENT_ID` / `IDOKLAD_CLIENT_SECRET` (keys arrive within days; until
set, the subscriber logs and skips — no failures).

1. **Client** (`src/modules/idoklad/` as a plain service or `src/lib/idoklad.ts`):
   OAuth2 client-credentials against `https://identity.idoklad.cz/server/connect/token`,
   API `https://api.idoklad.cz/v3/` — `IssuedInvoices` (create), fetch the PDF
   (`IssuedInvoices/{id}/GetPdf`), contact upsert (`Contacts`) by e-mail.
   Token cached until expiry. Typed, tested against mocked fetch.
2. **Trigger**: a subscriber on the payment-captured event (find the exact event
   the codebase already uses — see `src/subscribers/customer-emails.ts` for the
   payment-received wiring) issues the invoice once per order: line items with
   names, quantities, unit prices from the order (amounts are CZK; use the
   bigNumber `toNumber` helpers already used elsewhere), shipping as a line,
   discounts reflected. Dobírka orders: issue on handover instead — subscribe to
   the shipment/delivery event used by `confirm-merchant-handover` flow.
   Idempotency: stamp `order.metadata.idoklad_invoice_id` + `_number` +
   `_pdf_url` first-writer-wins; never issue twice (check metadata before create).
   VAT: parameterize on `IDOKLAD_VAT_PAYER=true|false` (default false —
   neplátce; Matěj confirms). Keep the mapping in one function with a comment.
3. **E-mail**: new Resend template `invoice-issued.tsx` following the existing
   brand template conventions in `src/modules/resend/emails/` (Czech copy:
   „Faktura k vaší objednávce"), registered in `src/modules/resend/service.ts`
   the same way as the others, sent by the subscriber with a link to the PDF
   (upload the PDF to MinIO via the file module and link that, so the link
   doesn't depend on iDoklad auth).
4. **Admin visibility**: new widget `src/admin/widgets/order-invoice.tsx` on the
   order detail page (zone `order.details.side.after` like existing widgets):
   shows invoice number + „Stáhnout PDF" + „Vystavit znovu" (re-issue only when
   none exists / after failure), and the failure reason when issuing failed.
   Czech UI. Follow the visual conventions of existing widgets.
5. `.env.template`: add `IDOKLAD_*`, `BALIKOVNA_API_*`, and the other env vars
   the template is missing (`COMGATE_*`, `RESEND_*`, `SEGMENT_WRITE_KEY`,
   `STOREFRONT_PUBLIC_URL`, `BACKEND_PUBLIC_URL`, `PACKETA_API_KEY`) with
   placeholder values and one-line comments. Never write real values.

## D. Resend module leftovers (you own this module)

- `service.ts` ~line 104: resolve the `// WIP: Create a type for the templates`
  block properly (typed template map).
- `emails/order-review.tsx` ~line 29: replace the `via.placeholder.com` default
  image with nothing (omit the img when no product image).
- `emails/merchant-daily-summary.tsx` ~line 91: drop the `https://example.com`
  default — derive from env like the other templates.
- Templates defaulting to `https://keramickazahrada.cz/...` literals: route them
  through the storefront-url helper/env so an unset `STOREFRONT_PUBLIC_URL` is
  loud (log) instead of silently pointing at the live domain.
- Do NOT rewrite e-mail copy — a human pass is scheduled separately.

## Gate (run at the end, fix what breaks)

```
cd backend
npx tsc --noEmit
npx jest --testPathPattern 'unit' --silent   # match how existing unit tests run — check package.json scripts first
npx medusa build
```
All three must pass. If a concurrent model's run collides with yours on build
artifacts, rerun. Finish with a short report: what you built, what is
TO-VERIFY when API keys arrive, and any decision you left for Matěj.
