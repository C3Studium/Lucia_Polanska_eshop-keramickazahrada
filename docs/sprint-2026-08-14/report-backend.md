# Backend audit report — 2026-08-14

Read-only audit of `backend/` (Medusa 2.18). Baseline established: `npm run typecheck`
exits clean; `npm run test:unit` → **21/21 suites, 310/310 tests pass** (~6 s).
All paths below are relative to `backend/` unless prefixed. Anything not verified
first-hand is labeled **UNVERIFIED**.

---

## 1. Confirmed

Prior-audit items re-verified against the current tree. One line each, `file:line`.

**Human-confirmed items (re-checked for line accuracy):**

- (a) `medusa-config.js:30` imports `STOREFRONT_URL` from `lib/constants`; `src/lib/constants.ts:25–34` is now only a comment (no export) → `admin.storefrontUrl` (`medusa-config.js:89`) is `undefined` → customer reset links fall back to `https://storefront.com` (`src/subscribers/handle-reset-password.ts:21,26,49`).
- (b) `backend/.env` git-ignored and untracked — previously human-confirmed, not re-tested.

**A1 — `src/modules/zasilkovnaFulfillment/service.ts` (all confirmed):**

- Constructor is `(options)` instead of `(container, options)` — `service.ts:10`.
- `PACKETA_API_KEY.toString()` throws when env unset — `service.ts:39` (`PACKETA_API_KEY` is optional, `src/lib/constants.ts:178`).
- `cod: Math.round(Number(order?.total) || 0)` unconditional — COD attached to every order incl. prepaid — `service.ts:49`.
- `weight: 2.5` hardcoded — `service.ts:51`.
- Catch swallows the API error and falls through to fake success `packeta_response: "Packeta API response"` — `service.ts:86–97`.
- `apiPassword` logged in plaintext (whole request body) — `service.ts:59`.
- `cancelFulfillment` empty — `service.ts:100–102`.
- `labels: []` on both return paths — `service.ts:83,96`.
- Additionally: `validateFulfillmentData` pure pass-through — `service.ts:22–24`.

**A2 — `src/modules/ceskaPostaFulfillment/service.ts` + shipment mail:**

- Record-only seam with credentials set: warns and still returns `mode: "manual"` + `pending_carrier_integration: true` — `service.ts:313–337` (documented P4-2 seam).
- `cancelFulfillment` no-op (`return {}`; warns in api mode) — `service.ts:360–372`.
- No tracking number is ever produced; `labels: []` on both paths — `service.ts:309,336`.
- `src/subscribers/customer-emails.ts:295` sends `order-shipment` with `trackingNumber: label?.tracking_number ?? ""`; no manual tracking entry exists anywhere in the admin (verified by grep across `src/admin` and the merchant-orders routes).

**A3 — order lifecycle gaps:**

- `src/lib/order-edit-rules.ts` is enforced only in `src/api/store/orders/[id]/edit/route.ts` (`:199–201`, `:275`); `src/api/middlewares.ts` has no entry for any `/admin/order-edits*` path. Native routes that bypass the rules (all admin-authenticated, but no MTO-line/emptiness/settlement guard): `POST /admin/order-edits`, `POST /admin/order-edits/:id/items`, `POST /admin/order-edits/:id/items/item/:item_id`, `DELETE /admin/order-edits/:id/items/item/:item_id`, `POST /admin/order-edits/:id/request`, `POST /admin/order-edits/:id/confirm`, `DELETE /admin/order-edits/:id` (Medusa core; also the draft-order plugin's edit routes registered by `medusa-config.js:99–104`).
- Refund promised with no mechanism: `src/api/store/orders/[id]/edit/route.ts:320` tells the merchant „vraťte ho u objednávky jedním klikem" and `:333` tells the customer „Rozdíl X Kč vám vrátíme na kartu", but `refund_due` is only a transient JSON response field (`:330`) — never persisted to order/state metadata, and no admin code anywhere reads `refund_due` or triggers a refund workflow (repo-wide grep: only `lib/order-edit-rules.ts:70,84`, its test, and this route).
- `cod_allowed` enforced nowhere at checkout completion: the only enforcement is on order-edit add/swap (`edit/route.ts:227–235`). No cart-completion hook, no workflow hook, no middleware checks it; there is also no CZ-only dobírka check anywhere (repo grep for `cod_allowed`: admin UI + workbench flags routes + edit route only).
- MTO cancel refunds nothing and mails nobody: `src/api/admin/made-to-order/orders/[orderId]/actions/route.ts:600–625` flips stages, cancels unpaid payment-request rows, emits `made-to-order.cancelled` — which has **no subscriber** (see §3), and the native order is never cancelled so core `order.canceled` (which would mail the customer, `customer-emails.ts:546,567`) never fires either. Paid deposits stay untouched.
- `src/modules/dobirkaPayment/service.ts:116–126` `refundPayment` only stamps `refunded: true` / `refunded_at` (arguably correct for cash — but nothing surfaces the obligation).
- Return-request decide creates no native return/refund/restock and hardcodes the atelier address: `src/api/admin/return-requests/[id]/decide/route.ts:21` (`RETURN_ADDRESS`), decision at `:70–75`, only e-mails sent (`:84–118`). Known double-mail risk documented at `:78–83`.

**A4 — hygiene:**

- `debugAuthMiddleware` — `src/api/middlewares.ts:42–57`, mounted three times on wishlist routes `:325`, `:330`, `:335`.
- Auth/body logging: `src/api/store/customers/me/wishlists/route.ts:10–48` (incl. a **truncated Authorization JWT prefix** at `:48`), `src/api/store/reviews/route.ts:37,39,62`.
- Dead `src/workflows/get-payment-url.ts` with fake Comgate payload (`test: 1, price: 1000, refId: "order445566"`) — `:15–26`; zero importers repo-wide; its `console.log` even fires during the unit-test run.
- Starter stubs `src/api/admin/custom/route.ts:3–8` and `src/api/store/custom/route.ts:3–8`.
- Duplicate Sanity sync: `src/subscribers/product-sync.ts:15–17` and `src/subscribers/sanity-product-sync.ts:15–17` both subscribe `product.created`/`product.updated` and both run `sanitySyncProductsWorkflow` → **every product event syncs to Sanity twice**.
- `src/subscribers/product.delete.ts` → `src/workflows/steps/delete-products-from-algolia.ts:8–14` is an explicit no-op placeholder.
- GET-that-writes: `src/api/store/carts/[id]/metadata/route.ts:4–13` runs `src/workflows/packeta-workflow.ts` which **updates the shipping-address metadata** (`:36–41`); workflow is misleadingly named `"product-count"` (`:53`). Storefront caller: exactly one, `storefront/src/modules/checkout/components/shipping/index.tsx:109,137–144` — a "confirmation read-back" whose result is discarded, **but the GET's side-effect is the only thing that copies `packeta_pickup_point` onto the shipping address**. Removal/repair must be coordinated with the storefront.
- `src/api/key-exchange/route.ts:5–27` — unauthenticated GET returning the `Webshop` publishable key. Storefront uses it only in boot scripts (`storefront/scripts/run-next-with-storefront-env.js:50`, `storefront/scripts/await-backend.js:63`), never at app runtime. Low risk (publishable keys are semi-public) but nonstandard.
- `src/modules/segment/service.ts:17–22` throws when `writeKey` missing while the analytics module registers the provider **unconditionally** — `medusa-config.js:188–200` (no env guard) → boot crash risk when `SEGMENT_WRITE_KEY` unset.
- `src/workflows/steps/track-event.ts:19–22` — random `anonymousId` per event (useless analytics identity).
- Hardcoded localhost in admin UI: `src/admin/widgets/express-checkout-widget.tsx:18` (`http://localhost:8000/express-checkout/…` — the widget's whole purpose is copying this URL), `src/admin/routes/sanity/page.tsx:61` (`http://localhost:8000/studio/`, `// WIP` comment).
- Boot console noise: 17 `console.log/error` lines in `src/lib/constants.ts` + 13 in `medusa-config.js` = **30** (claim "~25" confirmed); they also pollute unit-test output.
- Debug-schedule comments: `src/jobs/check-restock.ts:13`, `src/jobs/send-abandoned-cart-notification.ts:12,71`.

**A5 — Resend:**

- 7 templates exist but are never sent (`delivery-failed`, `password-changed`, `email-change`, `sign-in-notification`, `account-change`, `address-added`, `payment-cancelled`) — not registered in the provider map; documented as deliberate/TODO in `src/modules/resend/service.ts:83–101`.
- `ORDER_REFUNDED` mapped (`service.ts:125`) but never emitted anywhere; documented deliberate at `:100–101`.
- `via.placeholder.com` default in `src/modules/resend/emails/order-review.tsx:29`.
- `example.com` defaults in `merchant-daily-summary.tsx:91` **and** `merchant-weekly-summary.tsx:152`.
- Hardcoded `https://keramickazahrada.cz/...` defaults across ~20 templates (e.g. `price-drop.tsx:34`, `payment-pending.tsx:31`, `order-review.tsx:30–32`, `payment-failed.tsx:32`, `return-approved.tsx:42`, `newsletter-signup.tsx:22,45`, `order-cancelled.tsx:50`, `order-delivered.tsx:56`, …). See §2 for the important nuance.
- `// WIP` type block — `src/modules/resend/service.ts:104–106`.

---

## 2. Corrected / refuted

1. **`src/admin/lib/sdk.ts` is no longer hardcoded to localhost.** `sdk.ts:3–8` uses `window.location.origin` in the browser; `http://localhost:9000` is only the SSR/build fallback. Prior-audit claim is stale — production admin is fine. (The other two localhost hits stand, §1.)
2. **`refund_due` does exist** — as a `Settlement` kind in `src/lib/order-edit-rules.ts:70,84`. What is missing is *persistence* (never written to any metadata) and *any consumer/mechanism*. The prior audit's conclusion (promise without mechanism) is right; its wording ("doesn't exist") is imprecise.
3. **`validateFulfillmentData` in ceskaPosta is not a pure pass-through** — it forwards `service_code` from the option (`service.ts:163–171`), which `createFulfillment`/`calculatePrice` depend on. Behavioral claim stands (no carrier-side validation), but "pass-through" undersells load-bearing code.
4. **ceskaPosta `cancelFulfillment` is a documented deliberate P4-2 seam** (`service.ts:360–372` + module doc `:14–59`), not an oversight like the Packeta one. Same behavior, lower severity.
5. **Native admin order-edit endpoints are not "open"** — they sit behind admin auth (core `/admin` middleware). The gap is *rule bypass* (MTO lines editable, order can be emptied, settlement matrix skipped), not missing authentication.
6. **The hardcoded template URLs are default-prop/preview values, not live values.** Real sends pass links built by `src/lib/storefront-url.ts` (single source: `STOREFRONT_PUBLIC_URL` → `MEDUSA_STOREFRONT_URL`, `:32–45`). Defaults only reach a customer when a caller omits the prop (e.g. `return-requests/[id]/decide/route.ts:97` spreads `orderLink` conditionally → template default kicks in when env unset). Severity: env-configuration risk, not a live bug.
7. **`shipment.created` with empty tracking is handled gracefully by the template**: `order-shipment.tsx:37,54` hides the tracking row and button on empty string. The mail is honest; what is missing is the manual tracking entry (D5). Caution: the template's *default* props are a fake `CZ123456789` (`order-shipment.tsx:29,32`) — safe today only because `customer-emails.ts:295–296` always passes `?? ""`.
8. **Packeta COD line has a `|| 0` guard** (`zasilkovnaFulfillment/service.ts:49`) — it won't be `NaN`, but COD is still attached unconditionally; claim otherwise stands.

---

## 3. New findings

### Blockers

- **B-1 — The deployed backend offers ZERO shipping options.** `GET /store/shipping-options?cart_id=…` returns `{"shipping_options":[]}` for a CZ-region cart containing items (both a real ceramics product and the seed t-shirt) with a `cz` shipping address, including with the storefront's exact `fields` query (`storefront/src/lib/data/fulfillment.ts:18–28`). Checkout cannot pass the shipping step in production today. Cause not determinable via store API (no admin access — likely missing sales-channel↔stock-location link, missing service-zone coverage, or deleted options): **UNVERIFIED which**. Evidence in §4.
- **B-2 — Every order-confirmation e-mail renders a „Daň" (tax) row** — a VAT claim by a non-plátce. `src/modules/resend/emails/order-placed.tsx:183` `<LedgerRow label="Daň" value={formatPrice(order.tax_total || 0)} />`, unconditional, fed by `src/workflows/send-order-confirmation.ts:32,35` (`tax_total`, `item_tax_total` — the latter fetched and never rendered). This is the **only** customer-visible tax mention in the backend (full sweep in §5/D6).
- **B-3 — The storefront contact form posts to a route that does not exist.** `storefront/src/modules/layout/ContactDialog/panel.tsx:55–56,140–151` POSTs `{name, email, phone?, message, website}` to `${BACKEND}/store/contact`; there is no `src/api/store/contact/` route (checked full route listing). Kurzy inquiries (D3) currently go nowhere. Note: the storefront also sends **no `x-publishable-api-key` header**, which the `/store` namespace requires — the endpoint spec in §5/D3 addresses both.

### Must-fix

- **M-1 — Client can lower a personalized product's price with negative dimensions.** `src/workflows/steps/get-custom-price.ts:34` computes `originalPrice + height*width*0.01`; `PostCustomPriceSchema` (`src/api/store/variants/[id]/price/route.ts:5–11`) is `z.number()` with no bounds, and the add-to-cart hook only checks presence/`isNaN` (`src/workflows/hooks/validate-personalized-product.ts:19–22`), while `POST /store/carts/:id/line-items-custom` accepts arbitrary metadata (`src/api/store/carts/[id]/line-items-custom/route.ts:7–11`) and sets `unit_price` from the result (`src/workflows/custom-add-to-cart.ts:35–45`). `height: -1000, width: 100` ⇒ price cut by 1000. Only affects products with `metadata.is_personalized`.
- **M-2 — `metadata.fragile` is a promise with no mechanism.** Schema comment says it "Forces the whole basket onto fragile carriage" (`src/api/admin/workbench/products/[productId]/flags/route.ts:39–40`; same claim `src/admin/routes/produkty-workbench/page.tsx:82`), but no checkout/shipping code reads it — it only decorates admin lists (`api/admin/workbench/products/route.ts:219`) and the ceskaPosta option list defines fragile *options* (`service.ts:143–156`) that nothing forces.
- **M-3 — Dobírka can never legally pass the ship gate.** `src/lib/ship-gate.ts:164–186` requires `captured − refunded ≥ total` before dispatch; dobírka money is captured only after the carrier settles (`src/modules/dobirkaPayment/service.ts:103–114`), so a dobírka order can only be dispatched by falsely capturing first. No dobírka exemption exists in `ship-gate.ts` / `require-ship-gate.ts`. Latent today (provider not enabled in any region — §4) but blocks the whole dobírka feature.
- **M-4 — Late balance reconciliation never mails the customer.** `src/jobs/reconcile-balance-payments.ts:160–196` marks a request `paid` and advances to `ready_to_ship` but calls `notifyMerchant` directly instead of emitting `made-to-order.balance-paid`, so `customer-emails.ts:187` (`onBalancePaid`) runs only on the webhook path (`src/api/hooks/payment/pp_comgate_comgate/route.ts:84–93`).
- **M-5 — `made-to-order.cancelled` has no subscriber** (emitted `actions/route.ts:621–624`; full subscriber inventory checked). Combined with A3 above: a cancelled commission produces no refund, no customer e-mail, and no native order cancellation.
- **M-6 — Stale `pp_pickup_pickup` still enabled on the CZ region** (runtime, §4) while the storefront explicitly retires it because "opening a session on it returns 500" (`storefront/src/lib/constants.tsx:16–28`). Needs removing from the region (admin action; no code).
- **M-7 — Commission diary readable/writable with only an order id.** `src/api/store/made-to-order/[orderId]/notes/route.ts:59–82` (GET) and `:84+` (POST) have no `authenticate` middleware — anyone holding an order ULID + the public publishable key reads customer notes/photos. Inconsistent with the explicit privacy stance for `/store/orders/:id/progress` (`src/api/middlewares.ts:347–359`). (`src/api/store/made-to-order/media/route.ts` is acceptably guarded by cart/order-id proof + size/type limits, `:31–101`.)
- **M-8 — ComGate payments hard-require `STOREFRONT_PUBLIC_URL`.** `resolveStorefrontReturnUrl` throws when unset (`src/modules/comgate/utils.ts:119–121`), called on every `initiatePayment` (`service.ts:271–285`). Must be present in Railway env or no card payment can start. (Same env also drives all e-mail links, `src/lib/storefront-url.ts:32–37`.) Runtime value **UNVERIFIED** (env not readable).
- **M-9 — Weekly merchant summary ignores the digest setting.** `src/jobs/send-weekly-summary.ts:60–71` has no `daily_digest_enabled`-style gate (daily job checks it, `send-daily-summary.ts:58–60`).
- **M-10 — `watch-price-drops` hardcodes `CURRENCY_CODE = "czk"`** (`src/jobs/watch-price-drops.ts:53`) — silently wrong for the EUR/PLN regions that exist in production (§4).
- **M-11 — `reconcile-balance-payments` resolves providers by string surgery** — ``container.resolve(`pp_${session.provider_id ?? ""}`.replace(/^pp_pp_/, "pp_"))`` (`src/jobs/reconcile-balance-payments.ts:148–151`), failures swallowed by the catch at `:232` → a mis-registered provider degrades to a silent no-op.
- **M-12 — ComGate webhook path never moves the merchant-order stage.** `src/api/hooks/payment/pp_comgate_comgate/route.ts:72–77` advances the *production* order but does not run `transitionMerchantOrderWorkflow`; only the admin action route does (`actions/route.ts:73–87`). The `payment.captured` reconcile subscriber (`src/subscribers/reconcile-merchant-order.ts:204–212`) papers over most cases — verify the balance-paid → „K odeslání" transition end-to-end before launch.

### Nice-to-have

- **N-1** — Dead setting `production_started_email_enabled` (`src/lib/merchant-settings.ts:71,116`): declared, defaulted, tested, read by nothing.
- **N-2** — Duplicate template enums `Templates` vs `EmailTemplates` (`src/modules/resend/service.ts:46–102` vs `:142–176`) — drift hazard.
- **N-3** — Dead admin endpoints (no admin-UI caller): `POST /admin/newsletter/campaigns` (`route.ts:46`), `POST /admin/newsletter/announce-bundle` (`route.ts:36`), `GET /admin/newsletter/subscribers` (`route.ts:16`) — i.e. **newsletter campaigns cannot be sent from any UI**; `GET /admin/custom`; `POST+GET+DELETE` halves of `merchant-catalog/collections[…]` (UI uses core `/admin/collections` instead — two contradictory access paths, `src/admin/routes/rozdeleni/page.tsx:235,253` vs `src/admin/routes/merchant-catalog/page.tsx:151`); `GET/DELETE /admin/merchant-catalog/seasonal-selections/:id`; `DELETE /admin/made-to-order/products/:productId`.
- **N-4** — Raw `fetch("/admin/uploads", …)` bypassing the sdk in `src/admin/components/production-diary.tsx:124` and `src/admin/routes/rozdeleni/page.tsx:264`; lowercase `method: "post"` in `src/admin/hooks/sanity.tsx:21,71`.
- **N-5** — `src/scripts/seed.ts` is the stale Medusa starter: seeds `["gb","de","dk","se","fr","es","it"]` — **no `cz`** (`seed.ts:31`) — plus per-country tax regions (`:88–95`); its apparel products are live in production (§4).
- **N-6** — Extra regions in production with `pp_system_default` enabled (Europe/EUR, Polsko/PLN — §4): "system default" is a manual no-op provider, i.e. an EU/PL customer could place an order with no real payment, and the storefront maps it as „Manuální platba (testovací)" (`storefront/src/lib/constants.tsx:65`).
- **N-7** — `GET /store/customers/by-email` permits registered-e-mail enumeration (boolean only — much improved per its own doc, `route.ts:4–15`; residual risk acceptable/low).
- **N-8** — `merchant-notifications.ts:141` discards every `merchant-order.stage-changed` with `stage !== "shipping"` — 3 emit sites pay for an event mostly dropped (by design, but worth knowing).
- **N-9** — Storefront/backend metadata-key mismatch: standard checkout saves only `packeta_pickup_point` while recap/order pages read `packeta_pickup_point_label` (`storefront/src/modules/checkout/components/shipping/index.tsx:120` vs `…/review/recap.tsx:17`); Balíkovna points are saved as `balikovna_point_*` cart metadata that **no backend code reads**.
- **N-10** — Integration tests: a single suite `integration-tests/http/api.spec.ts` (406 lines) — covers order-progress auth, storefront-called routes, provider registration ids, the *complete personal-pickup config chain* ("location → provider link → set → zone → 0 Kč option", `:176`), workbench detail routes, validated POST bodies, key-less e-mail routes, admin auth. It would have caught B-1's class of problem **if run against production config** — it builds its own fixtures, so it passes while production data is broken.

---

## 4. Runtime state (deployed backend, read-only)

Backend: `https://backend-production-81e2.up.railway.app` (from `storefront/.env.local`), publishable key `pk_b12c…9510`. Store-API GETs plus **one** throwaway cart (`cart_01KZZQKEMSHJCZE3HSAPYCWVQ4` — two line items and a bare `{country_code: "cz"}` address added; never completed; no admin API touched).

**Regions (`GET /store/regions?fields=*payment_providers`), trimmed:**

```
Europe            eur  [pp_system_default, pp_comgate_comgate]
Česká republika   czk  [pp_comgate_comgate, pp_osobni-odber_pickup, pp_pickup_pickup]
Polsko            pln  [pp_comgate_comgate, pp_system_default]
```

- `pp_osobni-odber_pickup` on CZ: **present** ✔
- Dobírka (`pp_dobirka_ceska-posta`): **absent** from every region ✘
- Comgate (`pp_comgate_comgate`): **present** ✔
- Stale `pp_pickup_pickup` still enabled on CZ (M-6); `pp_system_default` live on Europe+Polsko (N-6).

**Shipping options — the headline result:**

```
GET /store/shipping-options?cart_id=cart_01KZZQKEMSHJCZE3HSAPYCWVQ4
→ {"shipping_options":[]}
```

Returned `[]` in all four attempts: empty cart; cart + ceramics item (`vlci-mak`); cart + seed t-shirt; cart + items + `cz` shipping address + the storefront's exact `fields` parameter. Therefore, at runtime:

- Osobní odběr at 0 Kč: **NOT offered** (nothing is).
- Balíkovna option provider id = `ceska-posta-fulfillment_balikovna`: **UNVERIFIED at runtime** (no options returned; store API cannot list options without a matching cart, and admin API is out of bounds). In code the composite id is confirmed: identifier `ceska-posta-fulfillment` (`service.ts:100`) + registration id `balikovna` (`medusa-config.js:147`). Whether the re-point of `so_01K2JNAER4GEGP0R011HC37PWS` was performed: **UNVERIFIED** (id appears nowhere in the repo).
- `packeta_packeta` option offered: **NO** — correct per decisions (trivially, since nothing is offered).

**Demo data (`GET /store/products?limit=100&fields=handle,title`):** count **86**; the four Medusa seed apparel products are still published and returned: `t-shirt` (Medusa T-Shirt), `sweatpants`, `sweatshirt`, `shorts`. Product `metadata` is exposed on the store API (`?fields=metadata` works); sampled `vlci-mak` has `metadata: null` — i.e. **no `packaging_price` set on at least some live products**.

---

## 5. Implementation answers (D)

**D1 — Packaging cost per product.**
- **Key:** `product.metadata.packaging_price` — number, **CZK major units**, `min(0)`, `nullable` (null = "clear back to shop default"), written by `POST /admin/workbench/products/:productId/flags` (`src/api/admin/workbench/products/[productId]/flags/route.ts:45`, read-merge-write at `:78–85`) and by the Balení+ page (`src/admin/routes/baleni-workbench/page.tsx:94`) / shipping-profile editor (`src/admin/components/shipping-profile-editor.tsx:74`). Read back through `GET /admin/workbench/products` (`route.ts:222–224`).
- **Consumer:** `ceskaPostaFulfillment.calculatePrice` (`service.ts:214–278`): price = base + Σ(packaging × qty); base per `service_code` from options `base_price_czk` else defaults **90 CZK (NB/Balíkovna) / 150 CZK (DR/address)** (`:222–224`); per-product fallback `default_packaging_price_czk ?? 0` (`:259`); rounded to 2 dp (`:269`), `is_calculated_price_tax_inclusive: true`. Neither `base_price_czk` nor `default_packaging_price_czk` is passed in `medusa-config.js:148–153`, so the defaults are live. Calculation only applies to options whose `price_type` is `calculated` (data, not code — `service.ts:183–191`).
- **Store exposure:** `metadata` (and hence `packaging_price`, `cod_allowed`, `fragile`) is already visible on `GET /store/products` — but a min–max needs the whole catalog, so:
- **Spec — smallest read-only endpoint:** `GET /store/shipping-info` (new file `src/api/store/shipping-info/route.ts`, no auth beyond publishable key, `Cache-Control: public, max-age=300`). Response: `{ options: [{ id, name, provider_id, price_type, amount|null, service_code }], packaging: { min, max, priced_products, unpriced_products, default: 0 } }`. Implementation: `query.graph({ entity: "shipping_option", fields: ["id","name","price_type","provider_id","data","prices.amount","prices.currency_code"] })` filtered to non-return options; packaging min–max from `productModule.listProducts({}, { select: ["id","metadata"] })` over published products, using the same parse as `service.ts:252–257`. This also answers the per-option range: for `calculated` options the page renders "base + balení X–Y Kč".

**D2 — Shipping options for the doprava-a-platba page.** There is no cartless core store endpoint (core `GET /store/shipping-options` requires `cart_id` — and at runtime currently returns `[]` even with one, B-1). The page should consume the `options` array of the D1 endpoint above: `name`, `amount` (flat price from `prices` where `currency_code == "czk"`), `provider_id`, `price_type` (`flat` vs `calculated`; for `calculated`, show base from `data.service_code` mapping + packaging range). Current storefront page is fully hardcoded with stale prices and „včetně DPH" copy (`storefront/src/app/[countryCode]/(main)/doprava-a-platba/page.tsx:28–72,118–176`) — storefront model's scope, but the backend endpoint above is its prerequisite.

**D3 — Contact/inquiry endpoint.** None exists (B-3). Storefront already posts `{ name, email, phone?, message, website }` (honeypot field `website`) to `POST ${BACKEND}/store/contact` with `Content-Type: application/json` and **no publishable key** (`panel.tsx:140–151`). Spec — `src/api/store/contact/route.ts` + middlewares entry:
- zod: `name: string().min(1).max(200)`, `email: string().email()`, `phone: string().max(40).optional()`, `message: string().min(1).max(5000)`, `website: string().max(0).optional()` (honeypot: any content ⇒ return generic 200 without sending — same pattern as `GENERIC_RESPONSE` in `src/api/store/return-requests/route.ts:31`).
- Send via `notifyMerchant` (`src/lib/notify.ts`) with `audience: "owner"`, `email: true`, key `contact:{sha1(email+message)}` (dedupe double-submits), plus optional customer thanks via `sendCustomerEmail`. Rate limit: reuse the return-request approach (one open per identity) or a simple in-memory window; never reveal outcomes.
- Coordination note: `/store/*` demands `x-publishable-api-key` — either the storefront adds the header (one-line fix) or the route is mounted top-level like `src/api/newsletter/unsubscribe` / `src/api/made-to-order/[orderId]/pay-balance/route.ts:1–11` (the established pattern for header-less callers). Recommend: keep `/store/contact` + add the header in storefront.

**D4 — Refund plumbing.** Signatures confirmed in `src/modules/comgate/service.ts`:
- `refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput>` — `:423–476`; requires verified `PAID` (`:433–437`); idempotent via `input.context.idempotency_key` vs `data.lastRefundIdempotencyKey` (`:439–445`); over-refund guard vs `data.refundedAmountMinor` (`:448–455`); calls `POST /refund.json` (`:457–465`); returns updated provider `data` incl. `refundedAmountMinor` (`:467–475`). Amounts pass through `toComgateMinorUnits(input.amount, details.curr)`.
- `cancelPayment(input: CancelPaymentInput)` — `:478–507`; `PAID` ⇒ throws "use a refund" (`:489–493`); `AUTHORIZED` ⇒ `DELETE /preauth/...`, else `DELETE /payment/...` (`:495–499`).
- The „Vrátit rozdíl" flow should call core `refundPaymentWorkflow` (which reaches `refundPayment` with the payment's collection context) — **not** the provider directly.
- **Where `refund_due` should live:** `merchant_order_state.metadata.refund_due = { amount, currency_code, reason: "customer_edit", order_change_id, created_at }`. `merchant_order_state` (`src/modules/merchant-order/models/merchant-order-state.ts`) is already loaded by both the queue projection (`src/api/admin/merchant-orders/projection.ts`) and the order-detail widget (`src/admin/widgets/merchant-order-state.tsx`), and it is backend-owned state with a lock discipline (`transition-merchant-order.ts`) — unlike `order.metadata`, which native admin edits can clobber. Write it in `POST /store/orders/[id]/edit` at the `settlement.kind === "refund_due"` branch (`edit/route.ts:311–335`); clear it in the new admin refund action.

**D5 — Manual tracking entry.**
- **Workflow seam:** `src/workflows/confirm-merchant-handover.ts` — extend `ConfirmMerchantHandoverInput` (`:32–36`) with `tracking_number?: string; tracking_url?: string`, and pass `labels: [{ tracking_number, tracking_url: tracking_url ?? ČP trackandtrace URL, label_url: "" }]` into `createOrderShipmentWorkflow.runAsStep` (`:102–110`). `customer-emails.ts:285–297` then picks the label up automatically (`labels.tracking_number` is already queried at `:233–234`) and the e-mail's tracking button lights up with zero further change.
- **API seam:** `src/api/admin/merchant-orders/[orderId]/route.ts:113–116` — the `stage: "handover_confirmed"` branch; accept optional `tracking_number` in the body (`:87` type).
- **UI seam:** `src/admin/components/merchant-order-queue.tsx` — the `handover` mutation `:283–287` (body `{ stage: "handover_confirmed" }`) and the „předala dopravci" button `:519–520` on cards where `awaiting_handover` is true (projection: `src/api/admin/merchant-orders/projection.ts:139`). Put an optional text input („Podací číslo zásilky") next to that button and thread it through the mutation body.

**D6 — DPH sweep (complete).** Customer-visible: **exactly one** — `src/modules/resend/emails/order-placed.tsx:183` („Daň" ledger row; also rendered by its preview mock, `:255+`), fed by `src/workflows/send-order-confirmation.ts:32,35`. Admin UI: zero hits. Logic-only (correct as-is for a non-plátce): `is_calculated_price_tax_inclusive: true` in `ceskaPostaFulfillment/service.ts:218,226,270`. Seed script: `createTaxRegionsWorkflow` for non-CZ countries, no rate ⇒ 0 % (`src/scripts/seed.ts:17,88–95`). Everything else grep-matched was a false positive (`uploadPhoto`, „Snídaňový set", „Nejžádanější objekty"). Fix = delete the one row + the two projection fields. (Storefront has its own „včetně DPH" copy — that model's scope.)

---

## 6. Suggested split — two parallel, non-conflicting workstreams

**WS-1 „Money & order lifecycle"** (everything where an amount or an order state can drift). Owns:
- `src/lib/ship-gate.ts`, `src/lib/require-ship-gate.ts`, `src/lib/order-edit-rules.ts`
- `src/api/store/orders/[id]/edit/route.ts` (persist `refund_due` → state metadata)
- `src/api/admin/made-to-order/orders/[orderId]/actions/route.ts` (cancel → refund + mail; wire `made-to-order.cancelled` or cancel the native order)
- `src/api/admin/merchant-orders/**` + `src/admin/components/merchant-order-queue.tsx` (D5 tracking input; new „Vrátit rozdíl" action)
- `src/workflows/confirm-merchant-handover.ts`, `src/workflows/ship-merchant-order.ts`, `src/workflows/transition-merchant-order.ts`
- `src/jobs/reconcile-balance-payments.ts` (M-4, M-11), `src/jobs/send-weekly-summary.ts` (M-9), `src/jobs/watch-price-drops.ts` (M-10)
- `src/subscribers/customer-emails.ts` (+ new cancelled/balance-paid coverage), `src/subscribers/order-edit-payment.ts`
- `src/modules/dobirkaPayment/service.ts` + dobírka gate exemption + `cod_allowed`/CZ-only checkout enforcement (cart-completion hook)
- `src/api/middlewares.ts` (single owner: order-edit guards, remove `debugAuthMiddleware`, register new validators — WS-2 hands over its middleware entries as a patch note, not edits)
- `src/workflows/steps/get-custom-price.ts` + `src/workflows/hooks/validate-personalized-product.ts` + `src/api/store/variants/[id]/price/route.ts` (M-1 bounds)

**WS-2 „Storefront-facing API, e-mail & hygiene"** (new read-only surface + copy + cleanup). Owns:
- New `src/api/store/contact/route.ts` (D3) and `src/api/store/shipping-info/route.ts` (D1/D2)
- `src/modules/resend/**` (Daň row removal B-2, placeholder URL defaults, enum dedupe, template hygiene) + `src/workflows/send-order-confirmation.ts`
- `src/modules/zasilkovnaFulfillment/service.ts` (make dormant provider safe: constructor, no fake success, no secret logging, conditional COD, no hardcoded weight)
- `src/modules/segment/service.ts` + `medusa-config.js` analytics guard + boot-log cleanup in `medusa-config.js`/`src/lib/constants.ts`
- Deletions: `src/workflows/get-payment-url.ts`, `src/api/{admin,store}/custom/route.ts`, one of the duplicate Sanity subscribers, wishlist/reviews console logging, debug-schedule comments
- `src/admin/widgets/express-checkout-widget.tsx`, `src/admin/routes/sanity/page.tsx` (localhost), dead-endpoint pruning (N-3), `src/scripts/seed.ts`
- `src/api/store/carts/[id]/metadata/route.ts` + `src/workflows/packeta-workflow.ts` (decide with storefront: replace GET-that-writes; also the `balikovna_point_*` consumption)
- MTO notes auth (M-7) — route file only; its middleware entry is handed to WS-1's `middlewares.ts`

Conflict surface: only `src/api/middlewares.ts` (WS-1 owns the file; WS-2 contributes entries via its PR description) and `medusa-config.js` (WS-2 owns). Ops/admin-data tasks that belong to neither code stream: restore shipping options + sales-channel/stock-location link (B-1), remove `pp_pickup_pickup` from CZ region (M-6), decide Europe/Polsko regions (N-6), unpublish seed apparel, set `STOREFRONT_PUBLIC_URL`/`SEGMENT_WRITE_KEY`/`OWNER_NOTIFICATION_EMAIL` in Railway (M-8).
