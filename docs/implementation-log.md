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
