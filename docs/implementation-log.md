# Implementation log — admin operating plan

Append-only record of the `WorkflowPlan.md` §24 roadmap implementation, one entry
per task. This log is the resume point for any future session: it should be
truthful and complete enough that nothing else needs to be re-derived.

Branch: `feat/admin-operating-plan` (off `main` at `1b599d7`).
Gate for every task: `cd backend && pnpm typecheck && pnpm build`.

---

## Baseline — before any change   (2026-08-04)

- Files: none (verification only).
- Gate: typecheck ✓ (0 errors) · build ✓ (backend 5.40 s, admin 17.93 s).
- Notes: `main` was green before the branch was cut, so any later breakage is
  attributable to this work. There is no lint in this backend (audit §11) and
  none was added. No jest config / test script exists yet — the first task that
  requires a test adds one (§5.4 of the brief).

---

## P0-1 — runtime facts   (2026-08-04)   **BLOCKED — needs Matěj**

- Files: `backend/scripts/p0-runtime-facts.mjs` (new, read-only collector).
- Native used: admin read endpoints only (`/admin/stock-locations`,
  `/admin/fulfillment-providers`, `/admin/shipping-options`, `/admin/orders`)
  plus the repo's own `/admin/made-to-order/products`.
- Custom added: the collector script. Justification: the facts are runtime state,
  not source — there is no way to derive them from the repo.
- Deviations: none.
- Gate: n/a (no compiled code changed; the script is standalone ESM run by node).

### Why it is blocked

The deployment is reachable and healthy, but no admin credentials exist anywhere
in the repo or env files, and the admin API correctly rejects unauthenticated
reads:

| Check | Result |
| --- | --- |
| `GET https://backend-production-81e2.up.railway.app/health` | `200` |
| `GET …/admin/stock-locations` (no auth) | `401` |
| `backend/.env` `DATABASE_URL` host | `postgres-qd3s.railway.internal` — Railway-private, `NXDOMAIN` from outside |
| `backend/.env` | no `MEDUSA_ADMIN_EMAIL` / `MEDUSA_ADMIN_PASSWORD` |

So neither the admin API nor the database is reachable from a development
machine without credentials Matěj holds.

### What Matěj needs to run

From `backend/`, with his own admin login:

```bash
BACKEND_URL=https://backend-production-81e2.up.railway.app \
ADMIN_EMAIL='<his admin e-mail>' \
ADMIN_PASSWORD='<his admin password>' \
node scripts/p0-runtime-facts.mjs
```

It prints a ready-to-paste `§0-notes` markdown block. The script authenticates
once and then issues **only GET requests** — it cannot modify anything.

The equivalent raw requests, if he prefers curl (`$T` = the token returned by the
first call):

```bash
BASE=https://backend-production-81e2.up.railway.app

T=$(curl -s -X POST "$BASE/auth/user/emailpass" \
     -H 'content-type: application/json' \
     -d '{"email":"…","password":"…"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# 1 — stock locations (plan §10 assumes exactly one workshop)
curl -s -H "authorization: Bearer $T" "$BASE/admin/stock-locations?fields=id,name&limit=100"

# 2 — fulfilment providers actually registered at runtime
curl -s -H "authorization: Bearer $T" "$BASE/admin/fulfillment-providers?limit=100"

# 3 — shipping options ↔ provider ids, and whether a COD option exists (D1)
curl -s -H "authorization: Bearer $T" \
  "$BASE/admin/shipping-options?fields=id,name,provider_id,shipping_profile_id,price_type,data&limit=200"

# 4 — made-to-order products + their variants' manage_inventory (feeds P6-6)
curl -s -H "authorization: Bearer $T" "$BASE/admin/made-to-order/products?limit=50"

# 5 — orders with shipping methods, to count unshipped Packeta ones (P0-4 → P4-5)
curl -s -H "authorization: Bearer $T" \
  "$BASE/admin/orders?order=-created_at&limit=100&offset=0&fields=id,display_id,status,fulfillment_status,payment_status,created_at,shipping_methods.id,shipping_methods.name,shipping_methods.shipping_option_id"
```

### Consequence for sequencing

Per the brief §5.7, work continues on everything that does not consume P0-1
findings. **Not started until the findings exist:** Phase 4 (carriers — P4-1 needs
the shipping-option ↔ provider mapping to keep identifiers compatible, P4-5 needs
the Packeta order count) and P6-6 (MTO `manage_inventory` alignment). Everything
in P1, P2, P3, P5 and the rest of P6 is independent of it.

---

## P0-4 — Packeta order count   (2026-08-04)   **BLOCKED — folded into P0-1**

- The decisions part of P0-4 was already resolved as D1–D8 (§26); the only
  remaining work was the count of unshipped Packeta-method orders, which needs
  the same admin access as P0-1 and is step 5 of the collector script above.
- Static half done here: the Packeta shipping options are identified by
  `provider_id` — the provider registers as `id: "packeta"` with
  `static identifier = "packeta"` (`backend/medusa-config.js:138-141`,
  `backend/src/modules/zasilkovnaFulfillment/service.ts:9`), so its options carry
  `provider_id = "packeta_packeta"`. The script matches on that plus the option
  name, so it stays correct even if the composed id differs at runtime.

---

## P0-2 — Czech locale   (2026-08-04)   partially blocked (prod click is Matěj's)

- Files: none (verification + this entry).
- Native used: the dashboard's built-in i18n and the user profile language field.
- Custom added: none.
- Deviations: none.
- Gate: n/a (no code changed).

### Verified statically in the installed dashboard

- Czech **is** a shipped dashboard language: `code: "cs"` appears in the
  `languages` array in `@medusajs/dashboard/dist/chunk-QJ63TWAK.mjs` (33 locales
  total). The plan's claim holds.
- The Czech translation bundle carries the nav/domain strings the plan quotes,
  including `draftOrders.domain = "Koncepty objednávek"`
  (`@medusajs/dashboard/dist/chunk-QIJSUXW3.mjs:77809`).
- The language selector lives on the profile page — the translation keys
  `profile.domain` and `profile.fields.languageLabel` are in
  `dist/profile-detail-OZCZHICI.mjs` / `profile-edit-64K4WLW7.mjs`.

### Click path for Matěj (production — §7.1, his action)

Admin → **Nastavení** (`/settings`) → **Profil** (`/settings/profile`) →
**Upravit** → field **Jazyk** → **Čeština** → Uložit. It is a per-user
preference, so it must be set on **the client's own admin user**, not on Matěj's.
Screenshot the sidebar afterwards for the acceptance note.

### Open i18n gap list

| Surface | Gap | Severity | Where it is handled |
| --- | --- | --- | --- |
| Draft-order plugin sidebar item | Hardcoded English `label: "Drafts"` with `nested: "/orders"` (`@medusajs/draft-order/.medusa/server/src/admin/index.mjs:1000-1001`). The plugin never reads the dashboard's `draftOrders.domain` key, so setting the locale to Czech does **not** relabel it — §2.2 wants „Koncepty objednávek". | medium — the word means nothing to a Czech non-technical user | decided in P1-4 (see below) |
| Draft-order plugin screens | Also hardcoded English inside: `breadcrumb: () => "Draft Orders"` (:939), `"Create Draft Order"` (:7996), `"Draft Order #"` (:9124). Not fixable without patching the plugin. | medium | out of scope — flagged, not fixed |
| Custom admin routes | Already Czech in every `defineRouteConfig` label (Denní práce + 5 children, Balíčky, Kolekce a kategorie, Recenze, Výroba na zakázku). | none | — |
| Developer-tool routes | „Sanity CMS" and „Segment Analytics" stay English on purpose — they are hidden from the client's sidebar per §2.2. | none | P1-4 hides them |

**Decision deferred to P1-4:** the only way to show „Koncepty objednávek" is to
hide the plugin's `Drafts` entry via the sidebar Layout Configuration and add a
label-only extension route under `/orders` that redirects to `/draft-orders`
(the pattern already used for the old `/merchant-orders` URL). That is a nav
change, so it belongs with the rest of the sidebar work rather than here.

**Blocked part:** actually setting the language and taking the screenshot needs
the client's admin account on production — Matěj's click, per brief §7.1.

---

## P0-3 — env inventory   (2026-08-04)

- Files: `backend/src/lib/constants.ts` (added `DEV_NOTIFICATION_EMAIL`,
  `OWNER_NOTIFICATION_EMAIL`, `BALIKOVNA_API_URL|KEY|SECRET|CUSTOMER_ID`;
  documented `PACKETA_API_KEY` as legacy per D8), `backend/.env.template`,
  `docs/env-inventory.md` (new).
- Native used: none (configuration only).
- Custom added: six optional env constants. Native Medusa has no place for
  merchant notification recipients or a carrier's B2B credentials — they are
  deployment configuration, not commerce state.
- Deviations: none. The `BALIKOVNA_API_*` names are placeholders as the plan
  specifies; P4-2 confirms them against the official B2B documentation and
  renames if the real API differs. Nothing depends on them until then because
  the provider's record-only fallback is the default.
- Gate: typecheck ✓ · build ✓ (backend 6.25 s, admin 16.82 s) · tests: none yet.
- Notes for Matěj: no secrets committed — only names and semantics. Local
  `backend/.env` was deliberately **not** modified; empty and absent behave
  identically. Add the two notification addresses in Railway when convenient
  (see `docs/env-inventory.md` → „What Matěj needs to do").

---

### Phase 0 summary   (2026-08-04)

**Done:** P0-2 (static half), P0-3 (complete).
**Blocked on Matěj:** P0-1 and P0-4 (need admin credentials — see the P0-1 entry
for the exact read-only script and curl list), plus the production click of P0-2.

**Smoke checklist for Railway (after Matěj deploys this branch):**

1. Deploy succeeds — the added constants are all optional, so nothing new is
   asserted at boot. Watch the log line `[Constants] Loading constants.ts…` and
   confirm the service reaches `/health` = 200.
2. `GET /health` on the backend service returns 200.
3. Run `node scripts/p0-runtime-facts.mjs` (see the P0-1 entry) and paste the
   printed block into `WorkflowPlan.md` as the `§0-notes` appendix.
4. Set the client user's admin language to Czech (Nastavení → Profil → Upravit →
   Jazyk → Čeština) and screenshot the sidebar.

**Open items:** Phase 4 (all tasks) and P6-6 stay unstarted until the §0-notes
findings exist. Everything else proceeds.

---

## P1-1 — merchant-settings accessor (A3)   (2026-08-04)

- Files: `backend/src/lib/merchant-settings.ts` (new),
  `backend/src/lib/__tests__/merchant-settings.unit.spec.ts` (new),
  `backend/jest.config.js` (new), `backend/package.json` (`test:unit` script).
- Native used: `updateStoresWorkflow` (`@medusajs/medusa/core-flows`) for writes;
  the store module service for reads. No direct module writes, no SQL.
- Custom added: one accessor file. Native Medusa has no generic settings store —
  `@medusajs/settings` is layout/view configuration only (A3 verified this) — so
  a shop-global preferences bag has nowhere native to live. It is held in
  `store.metadata.merchant_settings`, which *is* native storage written through a
  native workflow.

### Storage decision — `store.metadata` wins, no migration

A3 required evaluating `store.metadata` before creating a table. It works, so
**the plan's only migration is gone** and no `merchant-settings` module exists:

- `store.metadata` is a nullable JSON column
  (`@medusajs/store/dist/models/store.js:16`) and `updateStoresWorkflow` accepts
  `{ selector: { id }, update: { metadata } }`.
- Nothing else in this repo writes `store.metadata`, so the `merchant_settings`
  sub-key cannot collide, and writes preserve any other key anyway.
- Every consumer (subscriber, job, route) has a container, so reads work
  everywhere.

Trade-offs found, none blocking: a metadata write replaces the whole object (so
`setMerchantSettings` re-reads and merges), and each read costs one query against
a single-row table (settings are consumed by daily jobs and page loads, not hot
loops — and A3 forbids caching them). Both are documented in the file header
along with what would count as a concrete blocker later.

### Shape

Closed allowlist of exactly the six A3 keys, each with its own zod schema, all in
one `KEY_SCHEMAS` object — adding a setting means editing that object and nothing
else. Reads are forgiving (a corrupted value falls back to its default and logs a
warning, unknown keys are dropped) so bad data cannot take the shop down; writes
are strict (`z.strictObject(...).partial()`, unknown key throws `MedusaError
INVALID_DATA`). The pure core — `parseMerchantSettings`,
`applyMerchantSettingsPatch`, `buildStoreMetadata` — is separated from the two
container functions, which is what makes the round-trip unit-testable without a
database.

Defaults seeded in code, so they are readable through the accessor before
anything is ever written: threshold 3 ks, parcel 2,5 kg (D2), review request
after 10 days, „Výroba začala" e-mail off (§16 #7), daily digest on, no
onboarding dismissals.

### Test infrastructure (first task that needed it)

`jest.config.js` + `pnpm test:unit` added — the repo had jest, `@swc/jest` and
`@medusajs/test-utils` in devDependencies plus two orphaned unit specs, but no
config and no script, so nothing ever ran. The config is deliberately minimal
(swc transform, `**/__tests__/**/*.unit.spec.ts`). `tsconfig.json` excludes
`__tests__`, so specs are not part of `pnpm typecheck` — that is the
pre-existing convention and was left alone. Integration tests with
`@medusajs/test-utils` arrive in P11-4. **The gate is now typecheck + build +
`pnpm test:unit` for every following task.**

- Deviations: none. A3's preferred storage was viable, so the fallback module was
  not built.
- Gate: typecheck ✓ · build ✓ (backend 6.27 s, admin 17.14 s) · tests: 25 passed
  in 4 suites (the 2 pre-existing specs included, still green).

---

## P1-2 — move the made-to-order section   (2026-08-04)

- Files: `backend/src/admin/routes/made-to-order/page.tsx` → moved (git mv) to
  `backend/src/admin/routes/zakazkova-vyroba/produkty/page.tsx`;
  `backend/src/admin/routes/made-to-order/page.tsx` recreated as a redirect stub;
  `backend/src/admin/routes/zakazkova-vyroba/page.tsx` (new section landing);
  `backend/src/admin/routes/zakazkova-vyroba/zakazky/page.tsx` (new route, filled
  in by P6-1).
- Native used: `defineRouteConfig` + the dashboard's parent-path child grouping.
- Custom added: nothing beyond the pages themselves.

### What changed

The profile manager was nested under Produkty as „Výroba na zakázku", which split
the made-to-order workflow: profiles lived under products and the actual
commissions lived nowhere. It is now „Produkty na zakázku" under a top-level
**Zakázková výroba** section with its two §2.2 children. `nested` had to go —
the dashboard refuses to render children of a route that declares it
(the same constraint that made Denní práce top-level).

The old `/made-to-order` URL is a redirect stub with **no** `config` export, so
it stays reachable for bookmarks without appearing twice in the sidebar — the
`/merchant-orders` pattern.

### Verified in the built admin bundle

```
/zakazkova-vyroba            nested: undefined  rank: 20   (menu item)
/zakazkova-vyroba/zakazky    nested: undefined  rank: 10   (menu item)
/zakazkova-vyroba/produkty   nested: undefined  rank: 20   (menu item)
/made-to-order               route present, NO menu item   (redirect)
```

- Deviations: two, both small and within the plan's intent.
  1. P1-2's file list names only `{page, produkty/page}.tsx`, but its acceptance
     is „sidebar shows section+**children**" and §2.2 lists two. The `zakazky`
     route is therefore created here as well; P6-1 still builds the queue itself.
  2. The `zakazky` shell does **not** render §19's „Žádná zakázka" empty state.
     There is no list endpoint yet (`/admin/made-to-order/orders` serves a single
     commission by id — P6-1 adds the list), so the page cannot know whether it
     is empty, and claiming it is would be a lie over real commissions. It shows
     the explanatory half of the §19 text, which is true either way, plus the
     link to Produkty na zakázku. P6-1 restores the full empty state once it can
     tell.
- Gate: typecheck ✓ · build ✓ (backend 5.41 s, admin 15.77 s) · tests: 25 passed.
- Notes for Matěj: the sidebar order is still the default one — the §2.2
  interleaving with native items is P1-4 + your „Default view" apply.

---

## P1-3 — Sklad children, reviews tabs, seasonal selections   (2026-08-04)

- Files: `backend/src/admin/routes/sklad-nizky-stav/page.tsx` (new),
  `backend/src/admin/routes/sklad-vyprodano/page.tsx` (new),
  `backend/src/admin/routes/sezonni-vybery/page.tsx` (new),
  `backend/src/admin/routes/reviews/page.tsx` (tabs),
  `backend/src/api/admin/reviews/route.ts` (status filter),
  `backend/src/admin/lib/format.ts` (`formatDate`).
- Native used: `nested: "/inventory"` route placement; `validateAndTransformQuery`'s
  `req.filterableFields` for the review status filter; `query.graph` for both lists.
- Custom added: three pages and one query parameter. No new module, no migration.

### Reviews — tabs by Czech status

`GetAdminReviewsSchema` gained an optional `status` enum with the model's literal
Czech values (`src/modules/product-review/models/review.ts` — diacritics
included). Anything in a validated query that is not limit/offset/fields/order
lands in `req.filterableFields`
(`@medusajs/framework/dist/http/utils/validate-query.js:72`), so the route just
forwards those to `query.graph` — no hand-rolled filter parsing.

The page now has three tabs, „Čekají na schválení" first because it is the only
one with work in it. Switching tabs resets pagination and the selection, which
otherwise carry over into a list they do not belong to. Empty states are real
here: the endpoint returns a count, so „Žádné recenze nečekají" is only claimed
when it is true.

Two §17 cleanups on the way through: the **ID column is gone** (technical
identifiers must never appear on custom pages — AC-8), and so is the status
column, which repeats the active tab on every row. The English header „Product"
became „Produkt".

### Sezónní výběry

Read-only overview over the API that already exists, grouped into §13's three
tabs. Grouping is derived client-side from `publication_status` **and** the
dates, because a published selection whose `ends_at` has passed is over
regardless of what the status column still says (the auto-archive job in P9-4
catches up later). No „+ Nový výběr" button yet — P9-3 builds the wizard, and a
button that opens nothing is worse than no button.

### Sklad children

Both routes are `nested: "/inventory"`, which is one of the six paths the
dashboard accepts, and neither has children — so they do not hit the
„nested route cannot have children" constraint.

- Deviations: one, applied consistently. P1-3's acceptance says „pages render
  empty states §19", and Sezónní výběry and Recenze do exactly that. **Nízký
  stav and Vyprodáno do not**: their data endpoint (`/admin/inventory-alerts`)
  arrives in P7-1, so those pages cannot know whether anything is low or sold
  out. Printing „Zásoby jsou v pořádku" over genuinely low stock would be a
  false all-clear on the one page whose whole job is to warn — the same class of
  mistake §20 rejects for „delivered" without a carrier signal. They show the
  true explanatory text and a link to the native stock page instead, and P7-1
  restores the §19 empty states once they can be verified. Same reasoning as the
  Zakázky shell in P1-2.
- Gate: typecheck ✓ · build ✓ (backend 5.59 s, admin 15.91 s) · tests: 25 passed.

### Generated sidebar verified in the built bundle

```
/denni-prace              rank 0     /zakazkova-vyroba          rank 20
/reviews                  rank 10    /sezonni-vybery            rank 40
/merchant-catalog         rank 10  nested /products
/bundled-products         rank 30  nested /products
/sklad-nizky-stav         rank 10  nested /inventory
/sklad-vyprodano          rank 20  nested /inventory
+ 5 Denní práce children, 2 Zakázková výroba children
```

---

## P1-4 — sidebar default layout payload   (2026-08-04)   apply is Matěj's

- Files: `backend/scripts/set-sidebar-order.md` (rewritten for the §2.2 target).
- Native used: `POST /admin/layouts/sidebar/configuration` — the Layout
  Configuration mechanism, which is the only thing that can interleave native and
  extension sidebar items (§2.1).
- Custom added: none. Nav ordering stays out of code entirely.

### Id schemes verified in installed source (one plan detail sharpened)

- Top level: `core:nav:${path}`. `SidebarRoutes` renders
  `<LayoutComposer.Entry id={`nav:${route.to}`}>` and `buildCoreEntries`
  (`chunk-Z3OGJXAM.mjs`) prefixes every entry key with `core:`.
- Children: **`nav-child:${parentPath}:${childPath}`, with no `core:` prefix** —
  children are not composer entries at all. `NavSubItems` builds the id itself
  (`childId = (to) => \`nav-child:${parentTo}:${to}\``) and reads
  `activePreference.widgets[id]` directly through `isHidden` / `orderChildren`.
  Both segments are full paths, so a Denní práce child is
  `nav-child:/denni-prace:/denni-prace/nove` — not a bare slug.
- Native children come from the hardcoded `useCoreRoutes()` array: `/products` →
  `/collections`, `/categories`, `/product-options`; `/inventory` →
  `/reservations`; `/customers` → `/customer-groups`; `/promotions` →
  `/campaigns`; `/orders` → **none** (the draft-orders entry is commented out
  upstream; the plugin's item is pushed in via its `nested: "/orders"`).
- The validator accepts free-form keys (`z.record(z.string(), { hidden?,
  section?, order? })`), so an id for a route that does not exist yet is stored
  and ignored until it does.
- `Nastavení` is rendered by `UtilitySection`, outside the composer zone, so it
  cannot be reordered or hidden by this payload — which is exactly what §2.2
  wants (Settings untouched, AC-10).

The payload was checked by parsing it as JSON: 32 entries, top-level order
matching §2.2 exactly, `/price-lists`, `/sanity`, `/segment` hidden plus the
native Kolekce/Kategorie children.

- Deviations: `core:nav:/prehled` is included although P2-3 has not built that
  page yet. Harmless (inert until the route exists) and it means the payload is
  the final one rather than something to redo. Documented in the file.
- Gate: typecheck ✓ · build ✓ (backend 6.03 s, admin 18.76 s) · tests: 25 passed.
- Notes for Matěj: **applying is yours** — `is_default: true` rewrites the
  sidebar for every admin user (§7.1). Staging first. The doc also records an
  open cosmetic decision about the plugin's English „Drafts" label with two
  options and a recommendation to leave it for now; your call, nothing depends
  on it.

---

### Phase 1 summary   (2026-08-04)

**Done:** P1-1 (settings accessor — and A3's preferred storage held, so the
plan's only migration no longer exists), P1-2 (Zakázková výroba promoted to a
top-level section, old URL redirects), P1-3 (Sklad children, reviews tabs,
seasonal-selection overview), P1-4 (sidebar payload written; applying is Matěj's).

Test infrastructure now exists: `pnpm test:unit`, 25 tests across 4 suites.
The gate from here on is **typecheck + build + test:unit**.

**Smoke checklist for Railway (after Matěj deploys this branch):**

1. Service boots — no new required env, so a boot failure would be unrelated.
   `GET /health` = 200.
2. Sidebar shows **Zakázková výroba** with two children (Zakázky, Produkty na
   zakázku), and **Sklad** now has Nízký stav and Vyprodáno under it. „Výroba na
   zakázku" is gone from under Produkty.
3. Open `/app/made-to-order` — it must redirect to
   `/app/zakazkova-vyroba/produkty`, and the profile manager must work exactly as
   before (open a product, edit deposit %, save).
4. Recenze shows three tabs, „Čekají na schválení" selected. Switch tabs and
   confirm the list changes and pagination resets. Approve one review from the
   pending tab and confirm it moves to „Schválené". No ID column anywhere.
5. Sezónní výběry loads. If selections exist they appear under the right tab
   (check one whose `ends_at` has passed — it belongs under Archivované even if
   its status still says published).
6. Apply the sidebar payload from `backend/scripts/set-sidebar-order.md` on
   staging, log in as a **second** admin user and confirm the §2.2 order and the
   hidden sections. Then production.
7. Nothing under Nastavení changed — spot-check one settings page.

**Open items:** P0-1/P0-4 findings still needed (blocks Phase 4 and P6-6). The
„Drafts" label decision is open. `/prehled` appears in the sidebar payload but
the page itself lands in P2-3.

---

## P2-1 — feed notification provider   (2026-08-04)

- Files: `backend/medusa-config.js`, `backend/package.json`,
  `backend/pnpm-lock.yaml`.
- Native used: `@medusajs/notification` + `@medusajs/notification-local`, which
  the admin bell already reads (`channel: "feed"`).
- Custom added: none — this is pure configuration.

### Two things found while doing it

1. **`@medusajs/notification-local` was not a declared dependency.** It resolved
   only because `.npmrc` carries `public-hoist-pattern[]=*@medusajs/*` and the
   package arrives transitively through `@medusajs/medusa`. Registering a
   provider on the strength of a hoisting rule is fragile, so it is now an
   explicit `"2.18.0"` dependency, matching how `notification-sendgrid` is
   already declared. `pnpm install` resolved it from the existing lockfile
   entry — three added lines, no version churn.
2. **The notification module itself was conditional on e-mail configuration.**
   It was registered only when Resend or SendGrid env existed, which also took
   the bell down with it — the bell reads the `feed` channel from this same
   module. The module is now registered unconditionally with the local provider
   always present (`channels: ["feed"]`, no configuration needed) and the two
   e-mail providers still conditional. In-app notifications no longer depend on
   whether e-mail happens to be set up.

- Deviations: none from the plan; item 2 is a correction the plan implies but
  does not spell out (§15 assumes registering the provider is enough to make the
  bell work — it would not have been, on an instance without e-mail env).
- Gate: typecheck ✓ · build ✓ (config loaded and constructed: „Config object
  created successfully"; backend 6.78 s, admin 19.15 s) · tests: 25 passed.
- Notes for Matěj: production has `RESEND_API_KEY`/`RESEND_FROM_EMAIL` set, so
  the notification module was already live there; this change only adds the feed
  provider next to Resend. Nothing about e-mail delivery changes.

---

## P2-2 — notify helper + first five merchant notifications   (2026-08-04)

- Files: `backend/src/lib/notify.ts` (new),
  `backend/src/lib/__tests__/notify.unit.spec.ts` (new),
  `backend/src/subscribers/merchant-notifications.ts` (new),
  `backend/src/modules/resend/emails/merchant-notification.tsx` (new),
  `backend/src/modules/resend/service.ts` (template registration + subject),
  `backend/src/workflows/create-review.ts` (emits `review.created`),
  `backend/src/api/hooks/payment/pp_comgate_comgate/route.ts` (emits
  `made-to-order.balance-paid`).
- Native used: `createNotifications` (dedupe, audit and delivery all come free),
  `emitEventStep`, the event bus, `getLastPaymentStatus`, `query.graph`.
- Custom added: the policy layer around notifications — dedupe keys, D7
  recipient routing, and the bell's actual payload contract. Native Medusa has
  no opinion about any of those.

### The bell's contract, verified rather than assumed

The dashboard queries `sdk.admin.notification.list({ to: [me.id, me.email, ""],
channel: "feed" })` and its renderer returns `null` when `data.title` is missing.
So a merchant notification must use `to: ""` — that is how a notification
addresses „whichever admin is looking" — and must always carry a title. Both are
enforced in `buildFeedNotification` instead of being remembered per subscriber.
The bell has no link support, so notifications are text only; the CTA lives on
Přehled.

Deduplication is native: `createNotifications` skips an `idempotency_key` it has
already sent and *retries* one whose previous attempt failed
(`notification-module-service.js:51-55`). Handlers therefore just re-send on
retry — the test asserts both calls emit identical keys rather than trying to be
clever about it.

### The five

| § | Notification | Event | Key |
| --- | --- | --- | --- |
| #1 | Nová zaplacená objednávka | `order.placed`, not a payment problem | `mn:new-order:{order}` |
| #3 | Nové zadání zakázky | `order.placed`, made-to-order | `mn:mto-new:{order}` |
| #9 | Připravená k odeslání | `merchant-order.stage-changed` → shipping | `mn:ready:{order}` |
| #7 | Doplatek přijat | `made-to-order.balance-paid` (new) | `mn:balpaid:{req}` |
| #14 | Recenze ke schválení | `review.created` (new) | `mn:review:{review}` |

Two details worth keeping: made-to-order is detected from the payment
collection's metadata, **not** from the `production_order` row — the subscriber
that creates that row listens to the same `order.placed` event, so reading its
output would be a race. And `items.*` is in the order projection because
`total` is computed and silently comes back as zero without it (trap 1).

Both new events are emitted rather than notified inline. For the ComGate
callback that is load-bearing: Comgate retries the whole notification if the
route does not return 2xx, so a notification problem must never fail a verified
payment.

- Deviations: one, deliberate. The plan budgets a single new e-mail template
  (`merchant-daily-summary`, P2-5), but D7 also requires per-event owner e-mails
  for #1 and #7, and §15 requires urgent e-mails for #10/#11/#15 in later
  phases. Rather than five near-identical templates, this adds **one generic
  `merchant-notification` template** (title, optional description, urgency
  marker, link to Přehled) and lets the subject travel in `data.subject`. The
  provider change is additive: a per-send subject wins over the template
  default, and templates that do not set one behave exactly as before. Without
  this, D7's inbox requirement could not be met at all and P3-5's urgent e-mail
  would have nothing to send.
- Gate: typecheck ✓ · build ✓ (backend 5.40 s, admin 15.55 s) · tests: **36
  passed** in 5 suites (11 new).
- Notes for Matěj: with `OWNER_NOTIFICATION_EMAIL` unset (the current state) the
  bell works and the e-mails are skipped with a logged warning, exactly as D7
  specifies. Set the variable when you want the inbox copies.

### Found while working — fixed in P2-4, not here

The Resend provider returns `{}` instead of throwing when a template is missing
or the send fails (`src/modules/resend/service.ts`), so the notification row is
recorded as **success** even though nothing was sent. Notification #15 and the
whole `/prehled/emaily` page depend on `status = failure`, so P2-4 fixes it
there rather than widening this task.

---

## P2-2b — follow-ups requested by Matěj   (2026-08-04)

Three directions after reviewing P2-2's deviations. All three are implemented
here rather than deferred.

### 1. E-mail templates stay generic (approved)

The generic `merchant-notification` template is confirmed as the right shape —
the whole e-mail design is being reworked soon, so per-event templates would be
thrown away twice. No change needed; the deviation is now a decision.

### 2. Placeholder pages show a real empty state

Reversed from P1-2/P1-3's caution: Zakázky, Nízký stav and Vyprodáno now render
the §19 empty states. They are accurate today for a reason that will not last —
none of the three has a data source yet, so „nothing here" is the only possible
state — and P6-1 / P7-1 replace them with the real lists.

- New `src/admin/components/empty-state.tsx`: one component for every custom
  page, so they cannot drift apart (and P11-2 has something to build the
  onboarding cards on). Includes a `pieces()` helper because Czech counts three
  ways and „5 kusy" reads as a bug.
- Recenze and Sezónní výběry were refactored onto the same component.
- New `GET /admin/merchant-settings` (read-only) so the low-stock page can name
  the threshold it warns at instead of hardcoding 3 — the sentence stays true
  when P7-1 makes the value editable. It goes through the P1-1 accessor, so it
  cannot widen the A3 allowlist. Writing is deliberately not exposed until the
  „Hranice upozornění" drawer needs it (P7-1).

### 3. Failed e-mails are now recorded as failures, not successes

This is the defect flagged at the end of P2-2, fixed here because a silent
failure is unfixable by definition.

`ResendNotificationProviderService.send()` returned `{}` on both "template not
registered" and "Resend rejected the send". A returned result means the
notification module writes `status = success`
(`notification-module-service.js:100-102`), so a customer who never received an
order confirmation looked, in every record we keep, like one who did. It now
**throws**, which makes the module persist `status = failure` and rethrow
(`:95-99`) — the state that notification #15, `/prehled/emaily` (P2-4) and the
Přehled failure tile all read.

Two supporting changes it needs to be safe:

- `describeResendError()` turns both failure shapes into one readable line. The
  SDK reports API rejections as a returned `error` object but transport problems
  (DNS, timeout) as a *thrown* exception; the latter used to escape unlabelled,
  and the former logged as `[object Object]`. The error **name** is preserved
  because that is the part that says whose problem it is: `validation_error` /
  `missing_api_key` are ours, `rate_limit_exceeded` / `application_error` are
  Resend's.
- **Idempotency keys on the three existing e-mail sends**, which had none:
  `order-placed:{order_id}`, `restock:{subscription_id}`,
  `abandoned-cart:{cart_id}`. This is required by the fix, not incidental —
  failures now propagate, so the event bus and the daily jobs retry, and without
  a key each retry would be a *new* e-mail rather than another attempt at the
  same one. §18 already requires this ("Duplicate e-mails → native notification
  `idempotency_key` unique"); §16 claimed order-placed already had one, and it
  did not. The auth e-mails (§16 #19–25, "keep as-is") are left alone: their
  payload carries a fresh token each time, so there is no stable key to use.

- Gate: typecheck ✓ · build ✓ (backend 5.25 s, admin 15.87 s) · tests: **41
  passed** in 6 suites (5 new, covering the error description paths).
- Notes for Matěj: **no migrations.** Nothing in Phase 0–2 so far adds a table,
  a column or an index — the A3 decision put merchant settings in
  `store.metadata`, which is an existing JSON column, and everything else is
  subscribers, routes, pages and config. The `notification` module's own tables
  already exist on production, because it was registered there (Resend is
  configured); registering an extra *provider* does not change schema.

---

## P2-3 — operations summary endpoint + /prehled page   (2026-08-04)

- Files: `backend/src/api/admin/operations/summary/route.ts` (new),
  `backend/src/admin/routes/prehled/page.tsx` (new),
  `backend/src/lib/inventory-alerts.ts` (new),
  `backend/src/lib/__tests__/inventory-alerts.unit.spec.ts` (new),
  `backend/src/admin/components/merchant-order-queue.tsx` (exports `OrderRow`),
  rank renumbering in `denni-prace/page.tsx` and `reviews/page.tsx`.
- Native used: `getOrdersListWorkflow` (the only source of correct totals and
  computed `payment_status`), `query.graph` for reviews, price lists, seasonal
  selections and inventory levels, the notification module's own
  `listAndCountNotifications`, and the module services' indexed counts.
- Custom added: one read-only aggregation endpoint and one page. No stored
  aggregate, no cache, nothing written.

### Inventory rules extracted rather than inlined

`src/lib/inventory-alerts.ts` holds what counts as low or sold out, because
three later tasks need the identical answer (P7-1's endpoint and two pages,
P7-2's daily job) and three copies would drift within a week. Three decisions
worth recording:

- **Availability is `stocked − reserved`, computed here.** The level's
  `available_quantity` exists but is a *computed* model field, exactly the kind
  of projection that comes back silently empty (trap 1). Two plain columns and
  subtraction cannot surprise anyone.
- **Made-to-order is excluded by production profile, not by `manage_inventory`.**
  §10 assumes P6-6 will have set `manage_inventory = false` on those variants,
  but P6-6 is blocked behind P0-1. Reading the profiles makes the exclusion
  correct now *and* after that cleanup.
- **A `low_stock_threshold` of 0 is a deliberate override**, not a missing
  value — „warn me only when it is actually gone" is a reasonable thing to want
  for a slow-moving piece.

### Endpoint

One request feeds all thirteen tiles plus „Na řadě". The two failure counts are
**windowed to 7 days**: a notification has no resolved state, so an unwindowed
count would only ever grow and the „Vyžaduje pozornost" zone would never clear.
Carrier failures are identified by `trigger_type`, which the notify helper
derives from the dedupe key's second segment — so #10 (P3-5) will land in this
tile without further wiring. Outstanding balance money comes from the
made-to-order module's own request snapshots, never from re-deriving what a
customer owes.

### Page

Three zones in the order the day runs: what is broken, what is in progress, what
the shop needs. „Vyžaduje pozornost" renders **only when non-empty** — an
attention zone showing four zeroes is clutter, not reassurance. Tiles that would
be meaningless at zero (doplatek, vyprodáno, končí brzy) hide; tiles that are
part of the pipeline stay visible with their §19 empty-state sentence, because
„Žádné nové — máte klid ☕" is information.

„Na řadě" renders the **same `OrderRow` component** the queues use — now
exported for that purpose — so an order looks and behaves identically wherever
she meets it, including which single action it offers. Refetch is 30 s plus
window focus, since this page sits open on a workbench all day.

- Deviations: none from §4. Two small things done here that the plan leaves
  implicit: the shared inventory helper (P7-1 would otherwise duplicate it) and
  renumbering the top-level extension ranks (Přehled 0, Denní práce 10,
  Zakázková výroba 20, Recenze 30, Sezónní výběry 40) so the pre-layout default
  order is coherent — Přehled and Denní práce were both rank 0.
- Gate: typecheck ✓ · build ✓ (backend 5.33 s, admin 15.80 s) · tests: **55
  passed** in 7 suites (14 new, covering the threshold merge and both
  exclusions — which also pre-satisfies P7-1's listed tests).
- Notes for Matěj: still **no migrations**. `/prehled` now exists, so the
  `core:nav:/prehled` entry in the sidebar payload is no longer inert.

---

## P2-4 — failed-e-mail visibility   (2026-08-04)

- Files: `backend/src/api/admin/operations/emails/route.ts` (new),
  `backend/src/api/admin/notifications/[id]/retry/route.ts` (new),
  `backend/src/jobs/watch-failed-emails.ts` (new),
  `backend/src/admin/routes/prehled/emaily/page.tsx` (new).
- Native used: the notification module's records and `createNotifications`; the
  model's own `original_notification_id` column for chaining retries.
- Custom added: a list endpoint, a retry endpoint, a poller and a page.

### Why the list is not the native route

§22 suggests filtering the native `GET /admin/notifications`. Its validator
accepts `q`, `id`, `channel` and `to` — and nothing else, so there is no way to
ask it for the failures, which is the only question this page exists to answer.
`GET /admin/operations/emails?status=failure` does that instead; the rows are
the native records, only filtered and flattened.

### Retry semantics

A retry is a **new** notification pointing at the original through
`original_notification_id`, with a suffixed key (`…:r2`, `…:r3`). Re-sending
under the original key would work — the module retries a key whose previous
attempt failed — but it would overwrite the failure record and destroy the
evidence that anything went wrong.

The retry responds `{ sent: false, message }` with the provider's own words
rather than an HTTP error, and the page shows that message verbatim. This is
deliberate: **the failure reason is not stored anywhere.** The notification model
has `status` but no error column, so after the fact the only places the reason
exists are the server log and what a fresh attempt reports. „Nepodařilo se"
alone would not tell anyone whether it is a bad address or an expired API key.

### The poller

15-minute schedule, 90-minute lookback — comfortably wider than the interval, so
a missed run or a restart cannot leave a failure permanently unreported, and the
per-notification dedupe key (`mn:emailfail:{id}`) makes the overlap free. It is
a poller and not a subscriber because the module records the failure inside
`createNotifications` and emits no event for it. Routed to
`DEV_NOTIFICATION_EMAIL` (D7): a delivery failure is a technical problem, and
the person who can fix an unverified sending domain is Matěj.

### Verified in the built bundle

`/prehled/emaily` registers as a **route with no menu item** (§22: reached from
the Přehled tile, not the sidebar), and the renumbered ranks come out as
Přehled 0, Denní práce 10, Zakázková výroba 20, Recenze 30, Sezónní výběry 40.

- Deviations: the list endpoint is custom rather than the native notifications
  route, for the reason above. Recorded because §22 assumed otherwise.
- Gate: typecheck ✓ · build ✓ (backend 5.31 s, admin 16.23 s) · tests: 55 passed.
- Notes for Matěj: this closes the loop you asked for — a failed Resend call is
  now recorded as a failure (P2-2b), surfaced on Přehled and on this page, sent
  to your address as an urgent notification, and retryable with the real reason
  shown if it fails again. Still **no migrations**.

---

## P2-5 — daily summary   (2026-08-04)

- Files: `backend/src/jobs/send-daily-summary.ts` (new),
  `backend/src/modules/resend/emails/merchant-daily-summary.tsx` (new),
  `backend/src/modules/resend/service.ts` (template registration).
- Native used: `getOrdersListWorkflow` for takings (the only source of the
  computed `payment_status`), `query.graph` for drafts and carts,
  `createNotifications` for delivery and dedupe.
- Custom added: one job, one template.

Content is D7's, and its leanness is the point: yesterday's takings, the number
of unfinished purchases, a link to Přehled. Explicitly not an order report — the
orders belong in Denní práce, and a competing list in an inbox is how someone
ends up working from two places.

Details worth keeping: the window is **yesterday as a whole day**, not a rolling
24 hours, because a summary that means „since 07:05 yesterday" is impossible to
reconcile with anything. Unfinished purchases use the same definition the
existing abandoned-cart job uses (has an e-mail, has items, never completed,
untouched for a day) plus draft orders, so the two features cannot disagree. The
dedupe key is `mn:digest:{day}:{recipient}` — one digest per day per address
regardless of restarts or a changed schedule. It is skipped entirely when
`daily_digest_enabled` is off, and logs-and-returns when neither address is
configured (D7).

- Deviations: none.
- Gate: typecheck ✓ · build ✓ (backend 5.25 s, admin 15.60 s) · tests: 55 passed.

---

### Phase 2 summary   (2026-08-04)

**Done:** P2-1 (feed provider — plus lifting the notification module out of its
e-mail-only condition), P2-2 (notify helper + five notifications), P2-2b
(Matěj's follow-ups: failed e-mails recorded and shown, real empty states,
settings read route), P2-3 (summary endpoint + Přehled), P2-4 (failed-e-mail
page, retry, poller), P2-5 (daily summary).

Two new templates exist where the plan budgeted one: the generic
`merchant-notification` (approved by Matěj — one shape for every merchant alert
while the e-mail design is being reworked) and `merchant-daily-summary`.

**Smoke checklist for Railway (after Matěj deploys this branch):**

1. Service boots. `GET /health` = 200. The notification module is now registered
   unconditionally — the boot log should show no provider errors.
2. Open the bell (top bar). It should render without error even when empty.
3. Place a test order end to end. Within a moment the bell shows „Nová zaplacená
   objednávka #…", and — once `OWNER_NOTIFICATION_EMAIL` is set — the same
   arrives by e-mail. Placing it twice must never produce two bell entries for
   the same order.
4. Open **Přehled**. Tiles should match reality: compare „Nové objednávky" with
   the count on Denní práce → Nové, and „Recenze ke schválení" with the Recenze
   pending tab. „Vyžaduje pozornost" should be absent when nothing is wrong.
5. „Na řadě" shows up to five oldest orders with the same card and the same
   single action as the queue pages.
6. Force an e-mail failure to check the loop: temporarily set an invalid
   `RESEND_API_KEY` on staging, place an order, then open **Přehled → Nezdařené
   e-maily**. The row must be there marked „Nepodařilo se"; „Poslat znovu" must
   report Resend's actual reason. Restore the key and retry — it should succeed.
7. Leave the instance running past a quarter hour and confirm the
   `watch-failed-emails` job logged, and that a failure produced exactly one
   bell entry.
8. `/prehled/emaily` must **not** appear in the sidebar (it is reached from the
   tile).

**Open items:** P0-1/P0-4 findings still needed — they block Phase 4 and P6-6.
The „Drafts" label decision is still open. `OWNER_NOTIFICATION_EMAIL` /
`DEV_NOTIFICATION_EMAIL` are unset, so every merchant e-mail is currently
skipped with a logged warning (by design) while the bell works.

**Migrations: none, in any phase so far.** Nothing in Phase 0–2 adds a table, a
column or an index.

---

## P3-1 — cancelled orders leave the queues   (2026-08-04)

- Files: `backend/src/subscribers/reconcile-merchant-order.ts`.
- Native used: the `order.canceled` event (`@medusajs/utils/dist/core-flows/events.js:149`).
- Custom added: one handler on the existing reconciliation subscriber.
- Deviations: none.
- Gate: typecheck ✓ · build ✓ · tests: 55 passed.

`cancelled` is an outcome rather than a queue (`MERCHANT_ORDER_ACTIVE_STAGES`
excludes it), so reconciling to it is what actually removes the order from her
day. Two stages are left alone: an already-cancelled order (the transition step
no-ops anyway) and a shipped one — Medusa refuses to cancel an order with live
fulfilments, so reaching that combination would mean something else is wrong,
and un-shipping it would make the queue lie.

---

## P3-2, P3-3 — pagination, live refetch, backfill   (2026-08-04)

- Files: `backend/src/admin/components/merchant-order-queue.tsx`,
  `backend/src/admin/routes/denni-prace/page.tsx`,
  `backend/src/api/admin/merchant-orders/backfill/route.ts` (new).
- Native used: the module service's own paginated counts; `getOrdersListWorkflow`
  for the backfill scan (the only source of the computed `payment_status` the
  initial stage is derived from).
- Custom added: a paginated queue, a status/run endpoint pair, a banner.

Queues fetched 100 rows flat and never refreshed. They now page at 50 with the
total in the header, refetch every 30 s and on window focus, and keep the
previous page mounted while the next loads so the list does not collapse into
skeletons on every click.

Backfill covers orders placed before the merchant-order module existed: no stage
row means invisible in every queue — safe, but indistinguishable from having no
work. `GET` counts, `POST` creates. Both are idempotent (rows are only created
for orders that have none, never updated), draft orders are skipped because
completing one emits `order.placed` and takes the normal path, and a cancelled
order backfills straight to the outcome stage instead of resurfacing in „Nové"
years later.

- Deviations: two paths instead of the plan's `backfill-status` + separate
  endpoint — one path, two verbs. Verified safe against
  `/admin/merchant-orders/:orderId`: `RoutesSorter` orders
  global → wildcard → regex → **static** → params, so the static segment wins.
  The banner lives on the Denní práce overview rather than all five stage pages,
  because the check walks the order history and five scans for one answer is
  waste.
- Gate: typecheck ✓ · build ✓ · tests: 55 passed.

---

## P3-4, P3-5 — the A2 ship gate, the lock, and failure #10   (2026-08-04)

- Files: `backend/src/lib/ship-gate.ts` (new),
  `backend/src/lib/__tests__/ship-gate.unit.spec.ts` (new),
  `backend/src/workflows/steps/assert-ship-gate.ts` (new),
  `backend/src/workflows/ship-merchant-order.ts`,
  `backend/src/api/admin/merchant-orders/projection.ts`,
  `backend/src/api/admin/merchant-orders/route.ts`,
  `backend/src/api/admin/merchant-orders/[orderId]/route.ts`,
  `backend/src/api/admin/operations/summary/route.ts`,
  `backend/src/admin/components/merchant-order-queue.tsx`.
- Native used: `getEpsilonFromDecimalPrecision` + `defaultCurrencies` for the
  tolerance, `order.summary.pending_difference`, the `order_change` entity, the
  payment collections' own captured/refunded amounts, `acquireLockStep` /
  `releaseLockStep`.
- Custom added: the gate rules and the Czech reasons. Medusa has no opinion
  about whether an order is paid *enough* to leave the workshop.

### The rules are arithmetic, and that is the point

`payment_status === "captured"` is a snapshot, and the made-to-order flow
deliberately invalidates it: confirming a specification raises the total through
a native Order Edit *after* the deposit was captured, so the status still says
„captured" while the customer now owes more. Same after a partial refund. The
gate therefore compares numbers, in this order:

1. an open order change → blocked (checked first: every amount below would be
   measured against a total that is about to move)
2. captured − refunded ≥ payable total, within the currency's rounding error
3. `summary.pending_difference` is not a real amount
4. no payment collection still waiting for money
5. commissions: nothing outstanding on the production order

The tolerance is Medusa's own `getEpsilonFromDecimalPrecision(decimal_digits)`,
so CZK forgives a haléř and a zero-decimal currency like JPY forgives nothing —
rather than a hardcoded `0.005` that is wrong for both.

### One rule set, three consumers

`src/lib/ship-gate.ts` is pure — no container, no queries — because the same
rules have to hold in places that cannot share a call stack: the ship workflow
(here), the middleware on the native fulfilment route (P4-4, which exists
precisely because `createOrderFulfillmentWorkflow` offers only a post-hoc hook),
and the projection that decides whether the card even shows the button. Two
copies of a money rule is how a shop ships something it was not paid for.

The projection now carries `ship_block_reason`, computed by the same function,
so the UI hides the action for exactly the orders the backend would reject —
never one more, never one fewer — and tells her *why* instead of leaving her to
discover it through a rejection toast.

### The lock is safe to nest

`shipMerchantOrderWorkflow` now holds `merchant-order:{id}` for its whole run, so
a double click cannot start two fulfilment chains. That key is also taken by
`transitionMerchantOrderWorkflow`, which this workflow runs as a sub-workflow —
which would deadlock, except that `acquireLockStep` **skips itself when
`parentStepIdempotencyKey` is set and `executeOnSubWorkflow` is not**
(`acquire-lock.js:27-30`). The outer lock holds, the inner one stands down. The
lock is also released by the step's compensation if anything throws, so a
blocked or failed dispatch cannot leave the order wedged.

### Failure #10

A failed dispatch looks like success from across the workshop: the parcel is
packed and the order looks handled, but nothing left. The PATCH route now
catches, raises the urgent notification to `DEV_NOTIFICATION_EMAIL` and rethrows
so the merchant still sees the real error. The key is per order per hour, so
repeated clicking produces one alert rather than one per click while a failure
that persists into the next hour is reported again. A notification problem is
swallowed there on purpose — it must never replace the actual error.

- Deviations: none. Both `getEpsilonFromDecimalPrecision` and
  `summary.pending_difference` were verified present (the former in
  `@medusajs/utils/dist/totals/big-number.js`, re-exported through
  `@medusajs/framework/utils`; the latter is computed rather than a stored
  column, which is why it does not appear as a literal in the order package).
- Gate: typecheck ✓ · build ✓ (backend 6.63 s, admin 18.03 s) · tests: **78
  passed** in 8 suites (23 new, the full §22 matrix plus A2's three named cases:
  edited-after-capture, deposit-only capture, refund-then-reship).

---

### Phase 3 summary   (2026-08-04)

**Done:** all five tasks. AC-3 is now provable numerically at the unit level; the
UI-bypass half lands with P4-4's middleware.

**Smoke checklist for Railway (after Matěj deploys this branch):**

1. Cancel an order from the native page. It must disappear from its queue within
   30 s (or on focus) rather than sitting in „Nové".
2. With more than 50 orders in one stage, the queue pages at 50 and the header
   shows the total. Paging must not flash skeletons.
3. Open Denní práce. If older orders predate the queue, the banner appears —
   click „Načíst", confirm the count, then confirm the banner is gone and
   clicking again reports 0 created (idempotent).
4. **The gate.** Take a paid order in K odeslání: the „Vytvořit zásilku a
   odeslat" button is present. Then, on the native page, edit the order to
   increase its total and go back — the button must be gone and the card must
   say what is missing. `POST /admin/merchant-orders/:id` with
   `{"stage":"shipped"}` via curl must be rejected with the same Czech reason.
5. Ship a fully paid order and confirm on the native page that both a fulfilment
   **and** a shipment exist and `fulfillment_status` is `shipped`.
6. Double-click the ship button: exactly one shipment, no error.
7. Force a dispatch failure (an order whose shipping method has no stock
   location) and confirm the order stays in K odeslání, the toast carries the
   real reason, and a bell entry „Zásilku se nepodařilo vytvořit" appears.

**Open items:** unchanged — P0-1/P0-4 findings block Phase 4 and P6-6. **No
migrations in Phase 3 either.**

---

## P4-4 — the native fulfilment routes are guarded   (2026-08-04)

Pulled forward out of Phase 4 at Matěj's request. It depends only on P3-4, not
on the P0-1 carrier findings, so nothing about it was actually blocked.

- Files: `backend/src/lib/require-ship-gate.ts` (new),
  `backend/src/lib/__tests__/require-ship-gate.unit.spec.ts` (new),
  `backend/src/api/middlewares.ts`.
- Native used: `query.graph`; the routes themselves are Medusa's.
- Custom added: one middleware. It reuses the P3-4 rules verbatim, so the two
  doors cannot enforce different arithmetic.

### Why middleware

`createOrderFulfillmentWorkflow` exposes only `fulfillmentCreated`, which runs
*after* the fulfilment exists and inventory has moved. There is no `validate`
hook, so route middleware is the only place a native fulfilment can be refused
before it happens — which is why the plan carved this out as its own task.

Both native doors are covered:

- `POST /admin/orders/:id/fulfillments`
- `POST /admin/orders/:id/fulfillments/:fulfillment_id/shipments`

The queue's own path is unaffected: `shipMerchantOrderWorkflow` calls the native
workflows as **steps**, not over HTTP, so it never passes through this
middleware and is never gated twice.

The guard **fails closed** — a missing order id or an order that cannot be
loaded is refused rather than waved through. If the native route ever changes
shape, the failure mode is a blocked dispatch, not a silent bypass.

- Deviations: the plan lists only the fulfilments route; the shipments route is
  guarded too. A1 says `shipped` in any form must only ever follow a real
  shipment on a properly paid order, and leaving the shipment route open would
  have left exactly that hole.
- Gate: typecheck ✓ · build ✓ (backend 5.89 s, admin 17.21 s) · tests: **84
  passed** in 9 suites (6 new).

**AC-3 is now complete on both halves** — the workflow refuses, and the native
API refuses. Runbook §10c's known gap is closed.

---

## FIX — boot crash in `send-order-confirmation`   (2026-08-04)

- Files: `backend/src/workflows/send-order-confirmation.ts`,
  `backend/src/workflows/__tests__/composition.unit.spec.ts` (new).

### What broke

The idempotency key added in P2-2b was built with a template literal directly
inside the workflow composer:

```ts
idempotency_key: `order-placed:${id}`
```

`id` is not a string there — it is a `WorkflowData` placeholder for a value the
workflow will only have when it runs. Interpolating it coerces the placeholder
to a primitive, which throws `object is not a function` **while the module is
being imported**. `order-placed-email.ts` imports this workflow, Medusa loads
subscribers at boot, so the whole server failed to start. Migrations were fine
and unrelated — every module reported „up-to-date".

Fixed by building the payload inside `transform()`, which is what defers string
construction until the values are real. Property access (`orders[0].email`) was
always fine; only string building is not.

### Why the gate missed it, and what now closes it

`tsc` and `medusa build` **compile** workflow files without ever importing
them, so the composer never runs. And `WorkflowData<string>` is *typed* as
`string`, so the interpolation type-checks perfectly. Unit tests did not import
workflows either. The result: three green checks and a boot crash in
production.

`src/workflows/__tests__/composition.unit.spec.ts` now imports every file under
`src/workflows/` — one test per file, no behavioural assertions, because
importing *is* the test. It fails on exactly the class of error that got
through. Suite count went 9 → 10, tests 84 → **149**.

The other two idempotency keys added in P2-2b (`restock`, `abandoned-cart`) were
never affected: both are built inside `createStep`, which runs at execution time
with real values. The ship-workflow lock key and the `review.created` payload
already used `transform`.

- Gate: typecheck ✓ · build ✓ (backend 5.82 s, admin 18.29 s) · tests: **149
  passed** in 10 suites.

---

## UI-1 — Přehled becomes the one work section   (2026-08-04)

Requested by Matěj after seeing Phases 0–3 running. It is a deliberate
**deviation from §2.2**, recorded here and in `set-sidebar-order.md`.

- Files: `backend/src/admin/components/work-tabs.tsx` (new),
  `backend/src/admin/routes/prehled/prace/page.tsx` (new),
  `backend/src/admin/routes/prehled/zakazky/page.tsx` (new),
  `backend/src/admin/routes/prehled/page.tsx`,
  `backend/src/admin/routes/prehled/emaily/page.tsx`,
  `backend/src/admin/routes/denni-prace/**` (6 files → redirects),
  `backend/src/admin/routes/zakazkova-vyroba/{page,zakazky/page,produkty/page}.tsx`,
  `backend/src/admin/routes/merchant-orders/page.tsx`,
  `backend/src/admin/widgets/merchant-order-state.tsx`,
  `backend/scripts/set-sidebar-order.md`.

### The change

Everything the merchant does in a day now lives behind **one** sidebar item.
Přehled gained a tab bar: **Přehled · Denní práce · Zakázky · Odeslané e-maily**.
She has a single job — „what do I do now?" — and the old structure made her pick
a *section* before she could pick a *task*, which earned nothing.

Two things were kept against the simplest reading of the request:

1. **The dashboard stays the first tab.** Its whole value is the glance, and a
   glance that shares a screen with a workspace stops being one. Landing on
   Přehled still answers „co teď"; the work is one click away rather than one
   section away.
2. **The five stage queues stay separate**, as tabs within the Denní práce tab
   rather than one merged list. §2.3's reasoning still holds: the stages map to
   physically different activities (the pack table, the post-office run), and
   merging them would put work she cannot act on yet in front of work she can.

The stage lives in the query string (`/prehled/prace?krok=k-odeslani`), so a
queue stays addressable, bookmarkable and refresh-safe — the property the
separate routes bought, kept without the sidebar cost. Every Přehled tile and
the order-detail widget link to it.

### Knock-on: Zakázková výroba collapsed

With the commissions queue moved into Přehled, that section wrapped a single
child, which is noise. It is now the top-level item **„Produkty na zakázku"** at
`/zakazkova-vyroba`, rendering the same component; `/zakazkova-vyroba/produkty`
still resolves. The split is deliberate — the commissions are *work*, deciding
which products are made to order is *configuration*.

### Nothing breaks on an old link

All seven retired URLs are redirect stubs with no `config` export, so they stay
reachable and never appear twice in the sidebar: `/denni-prace` and its five
stage paths, plus `/zakazkova-vyroba/zakazky`. `/merchant-orders` was retargeted
to the new location too.

### Visual work Matěj asked for

- Tiles: taller (`min-h-[8.5rem]`), more padding, and the CTA pushed to the
  bottom with `mt-auto` so every card's action sits on the same line regardless
  of how much text is above it.
- Zone headers were small uppercase grey text, which read as decoration. They
  are real `Heading` elements now, each with a sentence saying what the group is
  for — „Obchod" alone told nobody anything.
- Header and section spacing opened up throughout; the tab bar is mounted in the
  loading and error states too, so the page does not jump as data arrives.

- Deviations: this task **is** the deviation. §2.2's sidebar and §2.3's
  „Denní práce keeps per-stage pages" are superseded for the section layout;
  the per-stage *separation* is preserved as tabs.
- Gate: typecheck ✓ · build ✓ (backend 5.44 s, admin 16.33 s) · tests: 149
  passed in 10 suites.

### Verified in the built bundle

Sidebar is now `/prehled` (rank 0), `/reviews`, `/sezonni-vybery`,
`/zakazkova-vyroba`, the two Sklad children and the two Produkty children —
**no Denní práce entry**. All seven retired paths are present as routes with no
menu item.

---

## UI-2 — Přehled tabs, Sezónní akce, Zakázky money   (2026-08-04)

Requested by Matěj. A second deliberate **deviation from §4**, which says
Přehled is „not analytics — nothing here needs a trend to act".

- Files: `src/api/admin/operations/statistics/route.ts` (new),
  `src/api/admin/operations/payments/route.ts` (new),
  `src/api/admin/made-to-order/orders/route.ts` (new),
  `src/admin/routes/prehled/{statistiky,platby}/page.tsx` (new),
  `src/admin/routes/prehled/zakazky/page.tsx`,
  `src/admin/routes/sezonni-vybery/page.tsx`,
  `src/admin/components/work-tabs.tsx`,
  `src/api/admin/operations/summary/route.ts`,
  `src/api/admin/merchant-catalog/seasonal-selections/route.ts`,
  `docs/plan-pay-in-full-for-commissions.md` (new).

### Where the analytics went, and why not on the dashboard

The trends live behind their own **Statistiky** tab rather than on Přehled. The
plan's reasoning still holds for the dashboard itself: a best-seller ranking
over a year is not something anybody acts on this morning, and putting it beside
„3 objednávky k zabalení" makes the urgent compete with the interesting.
Behind a tab, looking at it is a deliberate act. The first tab stays trend-free.

### Statistiky

Periods 30 d / 3 m / 6 m / 1 rok / vše, in the query string so a period is
linkable. Per period: takings, order count, average order value, abandoned
carts with a rate, and the ten best-selling products.

Three decisions worth recording:

- **Best sellers count paid orders only.** A piece that was ordered and never
  paid for was not sold, and letting it rank would make the list advise badly.
- **Empty carts are excluded** from the abandonment figure. „Started but never
  finished" is the question; a cart with no items is a page view.
- **The scan is capped** (5 000 orders, 20 000 carts) and the response says when
  it truncated. „Vše" grows forever, and an unbounded scan is a request that
  gets slower every month until it times out. A partial total presented as
  complete would be worse than saying so.

### Platby

Built on orders rather than payment tables, for two reasons that are easy to get
wrong: `payment_status` is computed inside `getOrdersListWorkflow` and available
nowhere else, and a *failed* payment often leaves no `payment` row at all — only
a collection that never completed — so a list built from payments would omit
exactly the rows the page exists to show. Read-only: refunds and captures stay
on the native order page, where Medusa's guards and audit trail are. A second
way to move money is what §18 exists to prevent.

### Zakázky — the money picture

Needed a list endpoint, which did not exist (P6-1 was going to build it), so
`GET /admin/made-to-order/orders` is added here read-only. Each commission shows
paid vs agreed as a bar with the shortfall named, because a commission is the
one order type where „paid" is a spectrum — deposit up front, balance on
completion — and the next step cannot be judged without seeing where a piece
sits on it. Money comes from the module's own payment-request snapshots.

**P6-1 still owns the actions** (confirm specification, start production,
request balance). This is the read-only half.

### Sezónní akce

Renamed from „Sezónní výběry" throughout the UI. Each row now lists its products
with thumbnails, and **marks the bundles** — a bundle is an ordinary product
with a `bundle` record linked to it, so nothing in the product row shows it,
but it matters: discounting a bundle discounts everything inside it, which the
page now says out loud. The link is traversed from the bundle side, the only
direction it has (`src/links/bundle-product.ts`).

### Dashboard: running discounts

One tile counting all four instruments (§13) — seasonal sales, price lists,
discount codes, automatic discounts — because they run independently and are
easy to forget once live. One tile rather than four; the breakdown is the hint.

### Planned, not built

`docs/plan-pay-in-full-for-commissions.md` records the „customer pays the whole
sum up front" feature Matěj asked to plan ahead. Key design decision captured
there: express it as *a deposit that equals the total*, not a new
`paid_in_full` flag — the ship gate, the Zakázky bar and the Přehled tile all
derive from `agreed_total − paid`, so that shape needs no new branches anywhere,
and a missed branch would be a way to ship an unpaid order. Three business
questions are left open for Matěj (refund policy, prepay discount, behaviour
when the price rises after confirmation).

- Gate: typecheck ✓ · build ✓ (backend 5.49 s, admin 16.59 s) · tests: 149
  passed in 10 suites.

---

## UI-3 — Sklad wired, Slevy overview, Zakázky actions   (2026-08-04)

Three gaps Matěj asked to close before Phase 5. This also completes **P7-1** and
most of **P6-1** ahead of their phases.

- Files: `src/api/admin/inventory-alerts/route.ts` (new),
  `src/api/admin/operations/discounts/route.ts` (new),
  `src/api/admin/merchant-settings/route.ts` (POST added),
  `src/admin/components/inventory-alert-list.tsx` (new),
  `src/admin/components/production-order-actions.tsx` (new),
  `src/admin/routes/prehled/slevy/page.tsx` (new),
  `src/admin/routes/sklad-{nizky-stav,vyprodano}/page.tsx`,
  `src/admin/routes/prehled/zakazky/page.tsx`,
  `src/admin/components/work-tabs.tsx`,
  `src/admin/routes/prehled/page.tsx`.

### 1. The Sklad contradiction is gone

The Přehled tile counted low stock correctly while the page said „Zásoby jsou v
pořádku" regardless — the rules existed and were unit-tested, only the page was
never wired. Both Sklad pages now render real rows from
`/admin/inventory-alerts`, which shares `lib/inventory-alerts.ts` with the tiles
and the daily job, so the two can no longer disagree.

Each row shows dostupné / skladem / rezervováno separately, because „6 on the
shelf, 5 already sold" is a different situation from „1 left" and she needs to
tell them apart. The shop-wide threshold is editable inline (§22's „Hranice:
{n} — Změnit") through `POST /admin/merchant-settings`, which validates against
the A3 allowlist in the accessor — no second schema to keep in sync.

### 2. Slevy a akce — the question that spans four pages

§13 describes four instruments that each live somewhere different. That is fine
while creating one and useless for „what is discounted right now?", which is the
question anyone actually asks. `/prehled/slevy` answers it in one list:
seasonal sales, price lists, discount codes, automatic discounts — with status
derived from **dates rather than a stored flag**, so a sale whose `ends_at`
passed reads „Skončilo" even before the archive job catches up.

Two things it deliberately does not do: a price list a seasonal sale owns is
skipped (it would otherwise appear twice, once as the sale and once as its
machinery), and **nothing is editable here**. Editing stays where each
instrument was created, so exactly one place can change a price.

### 3. Zakázky can now be worked, not just read

All five actions already existed on the actions route, guarded by
`requireStage`; what was missing was the UI. Each card now offers the one next
step for its stage — potvrdit zadání a cenu, začít výrobu, výroba dokončena,
požádat o doplatek, zrušit zakázku.

Details that matter:

- **Confirming a price is the only action with a form**, because it is the
  moment the agreed total is set and it rewrites the native order through an
  Order Edit chain. It shows what the customer will still owe as you type, and
  **refuses a price below what has already been paid** — that is a refund
  conversation, not a confirmation. (The server-side version of this check is
  P6-2; the client now states the reason.)
- **The two that move money confirm first.** Requesting a balance creates a real
  payment collection; the dialog says that clicking again re-sends the same link
  rather than making a new one, which is what the reuse-if-open behaviour
  actually does.
- **Cancel names the money.** If a deposit was paid, the dialog says how much and
  that refunding it will not happen by itself (D3).

- Deviations: P7-1 and the bulk of P6-1 are done early, out of phase order, at
  Matěj's request. P6-1's remaining piece is the „Připomenout doplatek" resend
  and the overdue badge (P6-5).
- Gate: typecheck ✓ · build ✓ (backend 5.31 s, admin 15.68 s) · tests: 149
  passed in 10 suites.

---

## F1 — pay a commission in full up front   (2026-08-04)   **HAS A MIGRATION**

Built from `docs/plan-pay-in-full-for-commissions.md` after Matěj answered the
refund question. Backend, database and e-mail only — the storefront *design* is
his, but everything it needs to call now exists.

- Files: `src/modules/made-to-order/models/product-production-profile.ts`,
  `src/modules/made-to-order/migrations/Migration20260804120000.ts` (new),
  `src/lib/balance-payment.ts` (new), `src/lib/balance-payment-link.ts` (new),
  `src/lib/__tests__/balance-payment-link.unit.spec.ts` (new),
  `src/workflows/steps/resolve-balance.ts` (new),
  `src/workflows/prepare-made-to-order-payment.ts`,
  `src/workflows/send-order-confirmation.ts`,
  `src/api/store/carts/[id]/production-payment-mode/route.ts` (new),
  `src/api/store/made-to-order/[orderId]/pay-balance/route.ts` (new),
  `src/api/admin/made-to-order/products/[productId]/route.ts`,
  `src/admin/routes/zakazkova-vyroba/produkty/page.tsx`,
  `src/modules/resend/emails/order-placed.tsx`, `src/api/middlewares.ts`.

### ⚠ Migration — the first one in this whole effort

`Migration20260804120000` adds `allow_full_prepayment` (boolean, default
`true`) to `product_production_profile`. **Written by hand**, because
`medusa db:generate` diffs against a live database and production is only
reachable from inside Railway. The statement is
`add column if not exists … default true`, so it is idempotent and safe to
re-run — which the deploy does on every boot.

Default `true` means every existing commission gains the option without anyone
editing products one at a time; she turns it off per product where taking six
weeks of money up front is not something she wants.

### How „paid in full" is represented — the decision that carries the feature

**As a deposit of 100 %, not as a flag.** `prepare-made-to-order-payment`
already computes a deposit percentage per line; when the cart asks to pay in
full it uses 100 instead of the profile's figure. Everything downstream —
`agreed_total − paid`, the A2 ship gate, the Zakázky bar, the „Čeká na doplatek"
tile, the `complete_production` branch that picks `ready_to_ship` over
`awaiting_balance` — is already derived from that sum, so **not one of them
needed a new branch**. A `paid_in_full` boolean would have had to be honoured in
each, and the one that got missed would have been a way to ship something
unpaid.

It also gives decision 3 for free: if she later raises the agreed price, the sum
goes positive again and the ordinary balance flow resumes on its own.

### The customer's side

- `GET|POST /store/carts/:id/production-payment-mode` — reads and sets the
  choice on `cart.metadata`. The GET returns both amounts and
  `can_pay_full`, so checkout never does deposit arithmetic itself; two
  implementations would drift and the customer would be shown a number they are
  not charged. „Pay everything" is offered only when *every* commission in the
  basket allows it — mixed permission would mean a button that does not do what
  it says.
- `GET /store/made-to-order/:orderId/pay-balance?token=…` — the e-mail button.
  A mail client can only send a plain GET with no credentials, so the link
  carries an HMAC of the order id under the server's own secret: unguessable, no
  new column, and useless against a different order. It redirects **straight to
  ComGate**, so inbox to payment page is one click.

  A side-effecting GET is a deliberate trade — it is the only shape an e-mail
  button has. It is safe because the effect is idempotent: an open request or
  collection is reused, so a prefetching mail client or three impatient clicks
  all land on the same payment. Failures redirect to the storefront with a
  reason rather than showing an API error to somebody who was trying to pay.

### One implementation of the balance link, not two

She can now create a balance link from the admin and the customer can create one
from an e-mail. Two implementations would mean two payment collections for one
balance — and a customer able to pay twice, with the second payment attached to
nothing. The reuse rules therefore live once in `src/lib/balance-payment.ts`
(`ensureBalancePaymentLink`), which both doors call.

### E-mail

The order-placed confirmation now carries „Zbývá doplatit {X}" and a **Doplatit**
button, shown **only when something is genuinely owed** — a commission paid in
full at checkout must never be asked for more, and an ordinary order never
reaches that branch at all.

- Deviations: none from the plan doc; decisions 2 and 3 there remain open and
  are marked as such, with the implemented default recorded.
- Gate: typecheck ✓ · build ✓ (backend 5.52 s, admin 15.91 s) · tests: **155
  passed** in 11 suites (6 new, covering token forgery and cross-order reuse).
- Notes for Matěj: **this deploy migrates.** Railway runs `db:migrate` before
  start, so the column is added on the way up. Nothing else in Phases 0–4
  touched the schema.
