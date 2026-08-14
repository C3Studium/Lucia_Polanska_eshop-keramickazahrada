# Environment inventory — Railway service / variable mapping

Task **P0-3** of `WorkflowPlan.md` §24. Variable **names and meanings only** —
this file never contains values. Values live in Railway's variable editor and in
the untracked `backend/.env` / `storefront/.env.local`.

## Services

| Service | Purpose | Public URL | Notes |
| --- | --- | --- | --- |
| backend | Medusa 2.18 server + admin bundle | `https://backend-production-81e2.up.railway.app` | `/health` returns 200; `/admin/*` requires a user token |
| storefront | Next.js shop | (own Railway domain) | `storefront/railway.json`: start `npm run start`, healthcheck `/api/healthcheck` |
| postgres | Database | — | private hostname `postgres-qd3s.railway.internal` — **not reachable from outside Railway**, which is why P0-1 cannot be run from a dev machine |
| redis | Event bus + workflow engine | — | optional: without `REDIS_URL` Medusa falls back to in-memory (`medusa-config.js:193-208`) |

## Backend variables

Everything the backend reads goes through `backend/src/lib/constants.ts`; the
table follows that file's order.

### Core (required)

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET`, `COOKIE_SECRET` | Session/token signing — asserted at boot, missing value crashes |
| `ADMIN_CORS`, `STORE_CORS`, `AUTH_CORS` | Allowed origins |
| `JWT_EXPIRES_IN` | Token lifetime, default `30d` |
| `MEDUSA_WORKER_MODE` | `shared` \| `server` \| `worker` |
| `MEDUSA_DISABLE_ADMIN` | `true` disables the bundled admin |
| `BACKEND_PUBLIC_URL` / `RAILWAY_PUBLIC_DOMAIN_VALUE` | Public backend URL used for file URLs and admin config |
| `STOREFRONT_PUBLIC_URL` | Used for storefront links from admin |

### Integrations (optional — absent means the feature is off)

| Variable | Feature | Behaviour when absent |
| --- | --- | --- |
| `REDIS_URL` | Redis event bus + workflow engine | falls back to in-memory modules |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Resend e-mail provider (34 Czech templates) | **the whole notification module is not registered** (`medusa-config.js:209`) — no e-mails, no feed |
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | Alternative e-mail provider | not registered |
| `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` | Object storage for media | falls back to local disk storage |
| `SANITY_API_TOKEN`, `SANITY_PROJECT_ID`, `SANITY_STUDIO_URL` | Sanity CMS sync | module registered but calls fail |
| `SEGMENT_WRITE_KEY` | Segment analytics | provider registered without a key |
| `COMGATE_MERCHANT`, `COMGATE_SECRET`, `COMGATE_TEST`, `COMGATE_COUNTRY`, `COMGATE_CURRENCY`, `COMGATE_METHOD` | ComGate payments — the shop's only payment route (D1: prepaid, no COD) | payment sessions fail |
| `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe | provider not registered |
| `ALGOLIA_*`, `MEILISEARCH_*` | Search | unused by the backend modules currently registered |
| `PACKETA_API_KEY` | **Legacy** — Packeta is retired (D8) | provider dormant; do not use in new code |

### New in this plan

| Variable | Introduced by | Meaning | Behaviour when empty |
| --- | --- | --- | --- |
| `DEV_NOTIFICATION_EMAIL` | P0-3 (D7) | Matěj's address — technical failures: carrier/API errors, e-mail delivery failures, system errors (notifications #10, #11, #15) | that e-mail is **skipped with a logged warning**, never a crash |
| `OWNER_NOTIFICATION_EMAIL` | P0-3 (D7) | The owner's address — business events: new paid order, balance received, payment problems, stock digest, reviews (#1, #2, #3, #7, #8, #9, #12, #13, #14, #16, #17) | same |
| `BALIKOVNA_API_URL` | P0-3 (D8) | B2B endpoint base | provider runs in **record-only mode**: the fulfilment is created, no carrier call, no tracking, and dispatch requires the merchant's explicit „Zásilku jsem předala dopravci" confirmation (A1 / §5.4) |
| `BALIKOVNA_API_KEY` | P0-3 (D8) | B2B credential | same |
| `BALIKOVNA_API_SECRET` | P0-3 (D8) | B2B credential | same |
| `BALIKOVNA_API_CUSTOMER_ID` | P0-3 (D8) | Contract / customer number on the packets | same |
| `IDOKLAD_CLIENT_ID` | FINISHINGTODOLIST §1 | iDoklad API — client id (iDoklad app: Nastavení → Aplikace → API → Vygenerovat) | invoicing module **not registered**; every invoice trigger is a logged no-op |
| `IDOKLAD_CLIENT_SECRET` | FINISHINGTODOLIST §1 | iDoklad API — client secret (same place) | same |
| `IDOKLAD_APPLICATION_ID` | FINISHINGTODOLIST §1 | Application id from the iDoklad Developer portal (developer.idoklad.cz) — required by the current v3 client-credentials flow | token requests fall back to the legacy endpoint, which may stop working |
| `IDOKLAD_VAT_PAYER` | FINISHINGTODOLIST §1 | `true` only if Lucia ever registers for VAT | treated as `false` — neplátce DPH, documents without VAT |
| `IDOKLAD_NUMERIC_SEQUENCE_ID` | FINISHINGTODOLIST §1 | Pins the iDoklad číselná řada for issued invoices (ostrá řada at go-live) | agenda default sequence is used |
| `IDOKLAD_TEST_MODE` | FINISHINGTODOLIST §5 | Informational: the credentials above belong to a trial/test agenda (iDoklad has no sandbox — testing = separate free account); the admin widget shows a „Test" badge | treated as production credentials, no badge |

The daily summary (07:05) goes to **both** notification addresses; if both are
empty the digest job logs a warning and sends nothing.

The four `BALIKOVNA_API_*` names are placeholders created now so deployment is
not blocked later. P4-2 verifies them against the official Balíkovna/ČP B2B
documentation and renames them there if the real API differs — the record-only
fallback means nothing breaks in the meantime.

## Storefront variables (for reference)

`MEDUSA_BACKEND_URL` / `NEXT_PUBLIC_MEDUSA_BACKEND_URL`,
`MEDUSA_PUBLISHABLE_API_KEY` / `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_DEFAULT_REGION`, `NEXT_PUBLIC_SANITY_*`,
`REVALIDATE_SECRET`, `NEXT_PUBLIC_STRIPE_KEY`, the invoice details
(`CISLO_UCTU`, `IBAN`, `SWIFT_KOD`, `IDENTIFIKACNI_CISLO`, `SIDLO_ADRESA`,
`INTERNETOVA_ADRESA`) and the legacy `NEXT_PUBLIC_PACKETA_API_KEY` /
`NEXT_PUBLIC_PACKETA_SHIPPING_METHOD_ID`.

The two Packeta variables go away with D8 once the Balíkovna pickup-point picker
replaces the Packeta widget in checkout — a flagged storefront dependency,
outside admin scope.

## What Matěj needs to do

1. Add `DEV_NOTIFICATION_EMAIL` and `OWNER_NOTIFICATION_EMAIL` to the backend
   service in Railway. Empty is fine for now; nothing crashes without them.
2. Add the four `BALIKOVNA_API_*` variables when the B2B contract is active
   (P4-2). Until then leave them unset — shipping still works in record-only
   mode.
3. Nothing else changes. No existing variable is renamed or removed by this plan.
