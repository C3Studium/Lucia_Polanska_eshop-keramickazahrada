# Opus implementation brief — Keramická zahrada admin operating plan

Read this whole brief before touching anything. Then follow §11 (Start here).

## 1. Mission

You are the implementing engineer for the approved admin operating plan of **Keramická zahrada** — a handmade-ceramics e-shop (Medusa **2.18.0** backend in `backend/`, Next.js storefront in `storefront/`, deployed on Railway) run by one ~50-year-old, non-technical, Czech-speaking ceramicist. The design phase is complete and approved. **Do not redesign anything. Implement `WorkflowPlan.md`, phase by phase, exactly as specified.**

The goal every task serves: *one situation → one clear next action*, in Czech, with Medusa's machinery invisible to her.

Your human counterpart is **Matěj** (developer, owner of this repo). He holds all credentials, env values and deploy rights. The ceramicist never talks to you.

## 2. Documents — authority order

1. **`WorkflowPlan.md`** — the authoritative spec: 26 sections, §24 roadmap (phases P0–P12 with task IDs `P<phase>-<n>`), §25 acceptance criteria, §26 decisions **D1–D8** and amendments **A1–A3**. D/A entries supersede any conflicting sentence anywhere else in the document.
2. **Installed source** (`backend/node_modules/@medusajs/*`) and the repo itself — ground truth for what exists today. The plan's factual claims were verified against source at file:line on 2026-08-04. Trust them; re-verify only the specific claim you are about to build on.
3. **`docs/denni-prace-audit.md`** — background: the architecture audit plus §9 implementation log of what is already built and green (Slices 0–8). Read §9–§12 before coding. Do not re-derive its findings and do not re-audit the backend — the commissioning explicitly prohibits rereading everything.
4. **Official Medusa 2.18 docs** (reference URLs in audit §7) — for any native API you use. Never guess an API shape: read the installed source or the docs first.

**Deviation protocol** (when the plan conflicts with reality): verify against installed source → implement the plan's *intent* in the minimally different correct way → record the deviation in the implementation log (§9 below). If the conflict would change a D/A decision, user-visible behavior, or the data model — **stop and ask Matěj** instead.

## 3. Non-negotiable rules

1. **Native data stays authoritative.** Every commerce-state mutation (orders, payments, fulfilment, shipments, inventory, products, price lists) goes through a native Medusa workflow. Never write to native tables via module services or SQL. Never store a copy of native state.
2. **Custom stays thin and additive.** Custom modules hold only overlay state (queue stage, presentation, thresholds). Before writing anything custom, state in the implementation log *why native Medusa cannot do it*.
3. **A1 — dispatch invariant:** `shipped` in any form (merchant stage, native fulfillment status, customer e-mail) is *only ever* produced by a real `createOrderShipmentWorkflow` run. Record-only carrier mode stops after `createOrderFulfillmentWorkflow`; the handover is an explicit merchant confirmation („Zásilku jsem předala dopravci") — spec §5.4.
4. **A2 — ship gate is numerical, not status-based:** captured − refunded ≥ payable total ± ε (`getEpsilonFromDecimalPrecision`) ∧ `order.summary.pending_difference ≤ ε` ∧ no active `order_change` ∧ no open payment collection awaiting money; MTO additionally outstanding = 0. Enforced in the ship workflow **and** as middleware on the native fulfilment route (P3-4/P4-4). `payment_status === "captured"` is display-only.
5. **A3 — settings restraint:** merchant settings only via the single typed accessor `src/lib/merchant-settings.ts` with the closed zod allowlist (6 keys listed in A3). Evaluate `store.metadata.merchant_settings` via native `updateStoresWorkflow` first; create the KV table only on a concrete, documented blocker. Never workflow truth, never per-entity state.
6. **Language split:** all user-visible strings (labels, helpers, buttons, e-mails, toasts, empty states) are **Czech** — use the literal strings the plan specifies. Code, comments, commit messages, log entries: English. The §17 terminology banlist (fulfillment, payment collection, reservation, metadata, workflow, technical IDs `order_…`/`ful_…`/`payses_…`) must never appear on custom pages.
7. **Untouched surfaces:** the Settings section, and every native page §22 lists as "untouched". Widgets may be *added* to native pages only where the plan says.
8. **Idempotency everywhere:** every external side effect (e-mail, feed notification, carrier call, payment link) uses the plan's dedupe key through the native notification `idempotency_key`, or a reuse-if-open pattern. Subscribers and jobs receive at-least-once delivery — every one must be safe to re-run.
9. **Behavior decisions are settled:** D1 no COD (carrier `cod` always 0) · D4 balance flow fully manual, no auto-reminders · D5 all reviews manually moderated · D6 unpaid orders never auto-cancelled · D7 notification routing DEV vs OWNER e-mail, empty env = skip with logged warning, never crash · D8 Packeta retired, Balíkovna B2B with graceful record-only fallback. Automation notifies; only she acts on money and cancellation.
10. **No fabricated green:** never weaken, skip, or fake a check to pass a gate. Report failures verbatim.

## 4. What already exists and is green — do not rebuild

Slices 0–8 (audit §9) are implemented, typechecked and built. Modify these only where a §24 task explicitly says so:

- `backend/src/modules/merchant-order/stages.ts` + `payment-state.ts` — stage machine, transitions, payment-problem derivation (single source of truth).
- `backend/src/workflows/transition-merchant-order.ts` — guarded transitions + `reconcile: true` flag for system facts.
- `backend/src/workflows/ship-merchant-order.ts` — ship orchestrator over native fulfilment/shipment workflows (P3-4/P3-5/P4-1 extend this file).
- `backend/src/subscribers/reconcile-merchant-order.ts` — fulfilment/shipment/cancel/capture reconciliation (P3-1 extends).
- `backend/src/subscribers/initialize-merchant-order.ts` — order.placed → initial stage by payment.
- `backend/src/api/admin/merchant-orders/…` — list/detail/PATCH routes + `projection.ts` flat DTO (uses `getOrdersListWorkflow`/`getOrderDetailWorkflow`).
- `backend/src/admin/routes/denni-prace/…` + `components/merchant-order-queue.tsx` + `widgets/merchant-order-state.tsx` — queue UI, stage pages, order-detail widget.
- `backend/src/admin/lib/format.ts` — money/date formatting (use this; see trap 3).
- Draft-order plugin registered in `medusa-config.js`; reviews page top-level; sidebar-order payload documented in `backend/scripts/set-sidebar-order.md` (P1-4 extends it).

Existing custom modules (keep, extend only as specified): merchant-order, made-to-order, merchant-catalog, bundled-product, product-review, restock, wishlist, comgate provider, resend templates (34 Czech e-mail templates in `backend/src/modules/resend/emails/` — P5 wires them; almost no new templates needed).

## 5. Execution protocol

1. **Order:** phases strictly in §24 order (P0 → P12); tasks within a phase in listed order unless truly independent. Do not reorder phases — §24 dependencies are load-bearing; reordering requires Matěj + a plan update.
2. **Per task:** read the plan sections the task cites and the files it touches → implement with minimal, in-style diffs → gate → log → commit. One task at a time.
3. **Gate after every task** (from `backend/`, it uses pnpm — running from the wrong cwd fails with "medusa: command not found"):
   ```bash
   cd backend && pnpm typecheck && pnpm build
   ```
   `pnpm build` (= `medusa build`) covers both the server and the admin bundle. Green before the next task, always. There is **no lint** in this backend — do not invent one and do not add ESLint (explicitly out of scope, audit §11).
4. **Tests:** write the tests each task lists. Reality check: jest 29, `@swc/jest` and `@medusajs/test-utils@2.18.0` are in devDependencies and unit specs exist (`src/modules/{bundled-product,comgate}/__tests__/*.unit.spec.ts`), **but there is no `jest.config` and no test script yet**. On the first task that requires a test, add a minimal jest config + `"test:unit"` script (follow Medusa's Testing Tools docs and the existing spec files' conventions), keep the existing specs green, and add test runs to your gate from then on. P11-4 later consolidates.
5. **Migrations:** the plan is engineered for **at most one** new table (P1-1 fallback only — and preferably zero, per A3). If any other task appears to need a migration, that is a spec conflict → deviation protocol. When one is legitimately needed: `npx medusa db:generate <module>` in `backend/`, review the generated migration, and note that the repo's `pnpm db:migrate` runs from `.medusa/server` (build first) against whatever DB the current env points at — **confirm it is a local/dev DB before running; never migrate production yourself.**
6. **Phase end:** append a phase summary to the implementation log including the phase's smoke-check list (from §24) written as concrete steps Matěj can run against Railway after he deploys. Then continue to the next phase — deploying is his, not yours; no phase's *code* is blocked on a prior phase's *deploy*.
7. **P0 specifics:** P0-1 needs read-only admin API access to the Railway deployment. Look for a usable backend URL + credentials in env/config first. If none: write the exact read-only requests (curl list) into the log for Matěj, mark P0-1 blocked, and proceed with P0-2/P0-3/P0-4's code- and doc-side parts and with Phase 1 tasks that don't consume P0-1 findings. Do **not** start P4 or P6-6 until P0-1 findings exist. P0-1 findings are appended to `WorkflowPlan.md` as a `§0-notes` appendix — the only edit to that file you are ever allowed to make on your own.

## 6. Git protocol

- At start, branch off `main`: `feat/admin-operating-plan`. All work happens there.
- One commit per completed, green task. Message format: `P2-3: operations summary endpoint + /prehled page` (+ body noting deviations if any).
- Pushing the feature branch is fine. **Never merge to or push `main`** — that is Matěj's deploy trigger and his call.
- Never commit secrets. Env docs (P0-3) contain variable *names* and mapping only.

## 7. Ask Matěj only for these (otherwise proceed autonomously)

1. Anything touching production: deploys, prod migrations, prod backfill runs, applying the sidebar layout `is_default`, setting the client user's language (P0-2 — give him the click path).
2. Spec conflicts that would change a D/A decision, user-visible behavior, or the data model (per §2 deviation protocol).
3. P0-1 runtime facts if no read-only access exists (hand him the exact requests).
4. Any destructive or hard-to-reverse operation not explicitly specified in the plan.

**Never block on these — build with the specified fallbacks:** `DEV_NOTIFICATION_EMAIL` / `OWNER_NOTIFICATION_EMAIL` values (empty = skip + logged warning, D7) · `BALIKOVNA_API_*` credentials (absent = record-only mode, D8/§5.4) · Packeta shipping-option removal in admin (Matěj's task, P4-5 sequencing) · storefront Balíkovna pickup-point picker (flagged external dependency — until it exists, Balíkovna options are address-delivery only, P4-3).

## 8. Known traps — verified the hard way during Slices 0–8

1. **`query.graph`/MikroORM silently drops unknown or mis-projected fields** (unknown prop → skipped, no error). A wrong projection yields empty/zero data that *typechecks fine*. `order.total` is computed and requires `items.*` in the fields list. Always assert data presence in tests, not just types.
2. **Computed `payment_status`/`fulfillment_status` exist only via `getOrdersListWorkflow`/`getOrderDetailWorkflow`** (`getLastPaymentStatus`/`getLastFulfillmentStatus` from `@medusajs/core-flows`). A plain `query.graph` on orders will not have them. The existing merchant-orders routes show the working pattern — copy it.
3. **`@medusajs/dashboard` exposes almost nothing publicly** (verified exports: `LayoutComposer`, `ConfigurableDataTable`, `createTableAdapter`, `defineCellRenderer`). Verify an export exists before importing; UI primitives come from `@medusajs/ui`; money/dates via `src/admin/lib/format.ts`.
4. **Admin routing constraints (all verified, §2.1):** native sidebar items are a fixed block before extension items — `rank` cannot interleave them; a route with `nested` cannot have children; `nested` accepts only 6 native paths; sidebar items cannot show badges; `/` hard-redirects to `/orders`. Cross-boundary ordering/hiding = Layout Configuration, zone **`sidebar`** (not `"main-sidebar"`), ids `core:nav:/<path>`, children `nav-child:<parent>:<to>`. Widget `.before`/`.after` zone suffixes are inert since 2.17.2.
5. **`createOrderFulfillmentWorkflow` has no pre-validation hook** (only post-hoc `fulfillmentCreated`). Pre-validating the native route is only possible via `src/api/middlewares.ts` (that's why P4-4 exists).
6. **Read-only module links are uni-directional** — query from the defining side. Working patterns exist: `production_order` by `order_id` filter; fulfillment → `order.id`; payment → `payment_collection.order.id` (see `reconcile-merchant-order.ts`).
7. **Merchant intents vs system facts:** intents go through the guarded transition workflow; facts (events, reconciliation) pass `reconcile: true` to skip the transition guard. Keep this separation for every new subscriber/job.
8. **E-mail sending is `createNotifications({ channel: "email", template, data, idempotency_key })`** — the resend provider maps template name → React Email component. Never call the resend SDK directly; the notification row is your audit + dedupe for free.
9. **Draft-order completion also emits `order.placed`** — subscribers must handle both origins idempotently (they already do; keep it that way).
10. **The bell reads channel `"feed"`** and `@medusajs/notification-local` is installed but *not registered* — P2-1 registers it in `medusa-config.js` with `channels: ["feed"]`.
11. **Czech review statuses are literal enum values** (`"čeká na schválení" | "schváleno" | "zamítnuto"`) — match exactly, diacritics included.
12. **Packeta provider is legacy (D8):** do not fix, extend, or reference it in new code. Its in-code comments about value/COD units are untrustworthy anyway. For Balíkovna B2B, read the official docs for endpoints/units — do not guess (P4-2).
13. **Import style for native workflows:** copy from working files (`ship-merchant-order.ts`, the merchant-orders routes) rather than guessing paths — they import from `@medusajs/medusa/core-flows` / `@medusajs/framework/*` in the shape this repo's TS config resolves.
14. **Repo layout:** backend uses **pnpm** (`backend/pnpm-lock.yaml`); the root `package-lock.json` is a different context. Run everything backend-related from `backend/`.

## 9. Implementation log — `docs/implementation-log.md`

Append-only; create it on your first task. One entry per task:

```
## P2-3 — operations summary endpoint + /prehled page   (2026-MM-DD)
- Files: <created/changed paths>
- Native used: <workflows/APIs>  ·  Custom added: <what + why native couldn't>
- Deviations: <none | what + why + plan intent preserved how>
- Gate: typecheck ✓ · build ✓ · tests: <n passed / details>
- Notes for Matěj: <only if action needed>
```

Phase end adds: `### Phase N summary` — tasks done, smoke checklist for Railway, open items. This log is the resume point for any future session — keep it truthful enough that a fresh session needs nothing else.

## 10. Reporting

End every working session with: current phase/task position · tasks completed since last report with gate results · deviations · items waiting on Matěj (from §7 only) · the next task you will start. Lead with the outcome, plain sentences, no jargon soup.

## 11. Start here

1. Read `WorkflowPlan.md` fully (872 lines). Then `docs/denni-prace-audit.md` §9–§12.
2. Baseline before any change: `cd backend && pnpm typecheck && pnpm build` — must be green. If it isn't, stop and report; do not fix unrelated breakage silently.
3. Create the branch (§6). Create `docs/implementation-log.md` with a baseline entry.
4. Begin **Phase 0** per §5.7. Then P1 → P12 in order.

The definition of done is `WorkflowPlan.md` §25 — all 14 acceptance criteria checked, with the prod-dependent ones (backfill, layout apply, locale, smoke on Railway) handed to Matěj as an exact runbook (P12).
