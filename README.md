# Keramická zahrada — e-shop for a ceramicist

Full e-commerce for a Czech ceramicist: custom storefront, custom admin, launching end of August 2026.

**Staging:** [storefront-production-0b10.up.railway.app/cz](https://storefront-production-0b10.up.railway.app/cz/) · **Design:** [Figma](https://www.figma.com/design/dL1RAWsbxKeh4yrPpZQPyW/Moment%C3%A1ln%C3%AD-Projekt?node-id=0-1)

One principle drove the whole build: **the workflow architecture follows how the owner actually works.**

She is a one-person studio. She throws pots, glazes them, packs them, and drives to the post office. So the admin is not a CRUD dashboard over database tables — it is a model of her day. Orders move through five stages (`received → working → shipping → shipped`, plus `payment_problem`), and those stay five separate queues instead of one filtered table, because they map to physically different activities: the wheel, the pack table, the post-office run. Merging them would put work she cannot act on yet in front of work she can.

Everything else follows from that decision — which numbers land on the overview screen, which jobs run overnight, which widgets sit on Medusa's own order and product pages.

## Architecture

Two halves in one repo: a custom Next.js storefront, and a Medusa backend I extended heavily.

**Storefront** — [`storefront/`](storefront/). Next.js 15 App Router, React 19, TypeScript. Routes are namespaced by country (`/[countryCode]`) and split into three layout groups: `(main)`, `(checkout)`, and `(express-checkout)` — a separate one-page flow for buying a single piece. Route segments are Czech (`/o-mne`, `/vyroba`, `/kurzy`, `/doprava-a-platba`) because Czech customers read the URLs. Editorial content comes from Sanity with the Studio embedded at `/studio`. It talks to Medusa over the JS SDK; a few Next route handlers under `src/app/api` cover what needs a server session.
<img width="1728" height="1117" alt="Screenshot 2026-08-09 at 6 19 12" src="https://github.com/user-attachments/assets/31d39464-7a77-46ac-8a42-05b4336bd0f2" />
<img width="1728" height="1117" alt="Screenshot 2026-08-09 at 6 19 27" src="https://github.com/user-attachments/assets/293cce5f-46df-450a-93e9-7bdd8c4ee25d" />
<img width="1728" height="1117" alt="Screenshot 2026-08-09 at 6 19 51" src="https://github.com/user-attachments/assets/03553ef1-3893-433f-b5dc-674987022b29" />
<img width="1728" height="1117" alt="Screenshot 2026-08-09 at 6 20 08" src="https://github.com/user-attachments/assets/80fce314-0773-4640-ae0d-43c6ad69a4f0" />
<img width="1728" height="1117" alt="Screenshot 2026-08-09 at 6 20 23" src="https://github.com/user-attachments/assets/10136e69-6e4c-46b2-96df-2e94537c78f8" />
<img width="1728" height="1117" alt="Screenshot 2026-08-09 at 6 20 40" src="https://github.com/user-attachments/assets/6329acf0-f7e9-4949-af57-8e209241cf32" />


**Backend** — [`backend/`](backend/), Medusa 2.18 (headless commerce). I chose Medusa deliberately. Payments, order state, refunds and GDPR belong in a proper commerce engine that is maintained and audited — not in code I hand-roll for one client. I wanted the liability-heavy parts to be someone else's solved problem, so my time could go into the layer that is actually specific to this shop.

**What the engine gives me:** cart, order, payment and fulfillment primitives, the product/pricing/inventory modules, the admin shell, migrations tooling.

**What I built on top of it:**

- **20 custom modules** with their own models and **22 migrations** — [`merchant-order`](backend/src/modules/merchant-order/) (the five-stage day), [`made-to-order`](backend/src/modules/made-to-order/) (commissions, where the customer chooses how much of a deposit to pay up front), `bundled-product`, `merchant-catalog`, `product-review`, `restock`, `price-watch`, `return-request`, `wishlist`, `newsletter`.
- **Czech-market providers** the engine doesn't ship: `comgate` for payments, `zasilkovnaFulfillment` (Packeta) and `ceskaPostaFulfillment` (Balíkovna) for delivery, plus `pickupFulfillment` for personal collection and `dobirkaPayment` for cash on delivery.
- **A custom admin UI** — [40 route pages across 23 sections](backend/src/admin/routes/) and [16 widgets](backend/src/admin/widgets/) injected into Medusa's own screens. `Přehled` is the hub: one screen with tabs for daily work, payments, products, reviews, discounts, stock, returns, commissions and email. The routes are named in Czech because she is the only person who will ever use them.
- **[26 workflows](backend/src/workflows/)**, 20 module links, 13 event subscribers and **[12 scheduled jobs](backend/src/jobs/)** — restock alerts, abandoned carts, balance-payment reconciliation, production deadlines, failed-email watch, daily and weekly summaries.
- **Infrastructure**: Resend for transactional email, MinIO for files, Segment for analytics, Redis for the event bus and workflow engine, Postgres. Deployed on Railway with a healthcheck endpoint.

## Admin preview

The admin is the part of this project I'd most want you to look at, and it's the part the staging link can't show you — it sits behind auth.

<img width="1728" height="1117" alt="Screenshot 2026-08-09 at 6 17 02" src="https://github.com/user-attachments/assets/3fb7f1b3-74f8-4474-879c-e257534f9d17" />
<img width="1728" height="1117" alt="Screenshot 2026-08-09 at 6 17 32" src="https://github.com/user-attachments/assets/d2d1607e-2881-4e06-9b94-4f34a4c745fc" />
<img width="1728" height="1117" alt="Screenshot 2026-08-09 at 6 18 39" src="https://github.com/user-attachments/assets/908f8780-a426-4fdc-ab2a-fc350f794013" />


Everything shown there runs on **test data**. The products, orders, customer names and amounts are seeded for demonstration — no real customer information appears in any screenshot.

## SCSS architecture

[`storefront/src/styles/system/`](storefront/src/styles/system/) holds the tokens and the API — breakpoints, colours, the typography scale, mixins, shortcuts, cascade layers — and emits no CSS of its own, so importing it anywhere is free. Everything else is co-located: 154 `.scss` and `.module.scss` files sitting next to the components they style.

[`scripts/sync-styles.js`](storefront/scripts/sync-styles.js) runs before both `dev` and `build`. It injects the responsive shortcut API into every SCSS file, repairs relative paths when a file is moved or renamed, and regenerates `_generated-styles.scss` — so `globals.scss` stays a short, stable entrypoint instead of a hand-maintained import list that rots.


Breakpoints are emitted as [CSS cascade layers](storefront/src/styles/system/_layers.scss) rather than plain media queries. That's what makes device-qualified stops work: a phone in landscape matches a tablet breakpoint on width alone, so the phone-specific stop sits in a later layer and wins without a specificity hack.

## Stack

| | |
|---|---|
| **Storefront** | Next.js 15 (App Router), React 19, TypeScript, SCSS, Framer Motion, Lenis |
| **Backend** | Medusa 2.18, TypeScript, PostgreSQL, Redis |
| **Content** | Sanity (embedded Studio, product sync workflow) |
| **Payments** | Comgate, cash on delivery |
| **Delivery** | Packeta (Zásilkovna), Balíkovna (Česká pošta), personal collection |
| **Services** | Resend, MinIO, Segment |
| **Testing** | Playwright (e2e), Jest (backend unit + integration), axe-core |
| **Infra** | Railway, pnpm |

## Running it

```bash
# storefront — needs a running Medusa backend
cd storefront
pnpm install
pnpm dev            # http://localhost:8000
```

`pnpm dev` runs the style sync, starts a watcher for structural SCSS changes, and boots Next on port 8000. Backend setup is in [`backend/README.md`](backend/README.md).

---

Built by Matěj Forejt. Design and build, end to end.
