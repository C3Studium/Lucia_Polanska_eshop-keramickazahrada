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
