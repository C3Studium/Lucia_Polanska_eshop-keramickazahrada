# TODO — before the shop is really open

The storefront model's audit (2026-08-05, `storefront-implementation-log.md`)
plus the state of the admin. Newest first; strike things out as they land.

## Matěj — admin configuration (no code)

These are clicks in the deployed admin, not commits. The providers exist in
code and are proven registered by the integration suite
(`integration-tests/http/api.spec.ts`); what is missing is attaching them to
the CZ region and a fulfillment set.

- [ ] **Add „Osobni Odber (PICKUP)" to the CZ region's payment providers.**
      Nastavení → Regiony → CZ → Poskytovatelé plateb. The provider id is
      `pp_osobni-odber_pickup`. It used to render as „Pickup (PICKUP)" — that
      is why it looked missing; renamed 2026-08-05, deploy first.
- [ ] **Create the Osobní odběr shipping option — in this exact order.** The
      whole chain is proven end to end by the integration suite („personal
      pickup can actually be configured"); the order matters because of step 1:

      1. **Nastavení → Místa a doprava → (dílna) → Poskytovatelé fulfillmentu →
         Přidat → „Osobni Odber".** This is the step that was missing: the
         create-shipping-option dialog lists only providers *added to the
         location* (`?stock_location_id=…`), so before this link the dropdown
         is empty — the provider is loaded and invisible. Nothing in the UI
         says so.
      2. On the same location enable the **Pickup** fulfillment set (Osobní
         odběr) and give it a service zone covering **Česko**.
      3. Now create the shipping option: provider „Osobni Odber", fulfillment
         option „Osobní odběr v dílně", **0 Kč**.

      If the provider still does not appear after step 1, the deploy predates
      the 2026-08-05 commits — check that first, not the config.
- [ ] **Verify shipping option prices** after the recent cost changes — each
      Balíkovna/Zásilkovna option carries its real price, and Osobní odběr
      stays 0.
- [ ] **Zásilkovna in the CZ region:** the audit found only
      `ceska-posta-fulfillment_*` options configured. If Packeta should be
      offered, its option needs creating too (`packeta_packeta`).

## Storefront model — unblocked by the latest deploy

Was blocked, is not any more. Re-point the model at the brief.

- [ ] **§4.5 + §8** — `GET /store/orders/:id/progress` was unpushed when the
      audit ran (G-1); it is deployed now. „Doplatit" in the account and order
      status can be built.
- [ ] **§7.1 restock** — `POST /store/restock-subscriptions` 500d on every
      payload (G-2): the route read `req.validatedBody` and no validator was
      ever registered, so the first property access threw. Fixed and covered by
      a test. Needs re-verifying end to end from the storefront.
- [ ] **§5 personal collection** — buildable once the two admin checkboxes
      above are done. The payment provider id in the brief is corrected to
      `pp_osobni-odber_pickup`.
- [ ] **§4.4 express checkout** — no blocker, just not built yet.
- [ ] **§7.2 price-drop copy** — one line where the wishlist is explained.

## Backend — known, deliberate leftovers

- [ ] **Balíkovna live credentials** — blocked on the ČP B2B account
      (`TODO-carrier-account.md`). The provider ships with the option
      re-pointing warning in that file.
- [ ] **ComGate out of test mode** — flip `COMGATE_TEST` when real payments
      should flow. Until then every payment is fake by design.
- [ ] **Personal-pickup order end to end** — no real order has run through
      `complete-personal-pickup` yet; needs the region config above, then one
      test order.
- [ ] **Price-drop job's first firing** — runs 07:30 daily; nobody has seen it
      fire yet. After the first morning with a price change, check
      Přehled → Odeslané e-maily.
- [ ] **Admin polish from the phase audit** — e-mail copy pass (P5-4),
      made-to-order product widget (P8-3), seasonal wizard (P9-3), onboarding
      cards (P11-2), a11y pass (P11-3).

## Storefront E2E (parked on purpose)

- [ ] **Playwright suite** — exists (43 files), runs against a disposable
      database. Two bugs in its reset script are fixed (a guard that could not
      guard, a port read from the host variable). Wire it up **after** the
      storefront model's UI lands, so the selectors it pins are the final ones.
