# Setting the sidebar order and hiding unused sections

## Why this is a separate step, not a code change

The target order (`WorkflowPlan.md` §2.2) mixes native Medusa sections with our own
extension routes. Native sections (`Orders`, `Products`, `Inventory`, `Customers`,
`Promotions`, `Price lists`) are rendered from a hardcoded array in `@medusajs/dashboard`'s
`useCoreRoutes()` and always render as one fixed block **before** any extension route — no
`rank` or `nested` value we set in `defineRouteConfig` can move an extension item above a
native one, or interleave the two.

Medusa 2.18 has a second, independent mechanism for exactly this: layout customization. It
stores a flat `order` number and a `hidden` flag per sidebar entry, and neither cares
whether the entry is native or an extension. Verified against the actual source:

- Zone key for the main sidebar: `"sidebar"` — the `widgetsZonePrefix` passed to
  `LayoutComposer` in `main-layout.tsx`, **not** `"main-sidebar"` (that constant,
  `CUSTOMIZE_IDS.MAIN_SIDEBAR`, only names which composer enters edit mode — it is not the
  API zone key).
- Top-level entry ID scheme: `core:nav:${path}`. The `nav:${path}` comes from
  `<LayoutComposer.Entry id={...}>` in `SidebarRoutes`, and `buildCoreEntries` prefixes
  every entry key with `core:`.
- **Child entry ID scheme: `nav-child:${parentPath}:${childPath}` — with no `core:`
  prefix.** Children are not composer entries; `NavSubItems` computes the id itself and
  looks it up directly in `activePreference.widgets[id]` (`isHidden`, `orderChildren`).
  Both segments are full paths, so an extension child reads
  `nav-child:/denni-prace:/denni-prace/nove`.
- Ordering: a plain numeric sort key, ties broken by source order, defaulting to `0` when
  unset.
- Endpoint: `POST /admin/layouts/:zone/configuration`, validated by
  `AdminSetLayoutConfiguration` — body is `{ is_default: boolean, configuration: { widgets:
  Record<string, { order?, hidden?, section? }> } }`. Keys are free-form strings, so an id
  for a route that does not exist yet is stored and simply ignored until it does.

`is_default: true` writes the **system default** — every admin user on this store sees this
order, not just the one who set it. That is a shared, persisted, hard-to-reverse write, so
it is deliberately not run automatically. Either apply it yourself with the payload below,
or do the equivalent by dragging entries in the admin's layout-edit mode (pencil icon in
the top bar → Main sidebar) and saving as default — both produce the same stored state.

## Target structure (WorkflowPlan.md §2.2)

```
Přehled                                        /prehled              ← exists after P2-3
Denní práce                                    /denni-prace
 ├ Nové · Připravujeme · K odeslání · Odesláno · Problém s platbou
Objednávky                                     /orders
 └ Drafts                                      /draft-orders         ← plugin, English label
Zakázková výroba                               /zakazkova-vyroba
 ├ Zakázky · Produkty na zakázku
Sklad                                          /inventory
 ├ Rezervace · Nízký stav · Vyprodáno
Produkty                                       /products
 ├ Možnosti produktů · Kolekce a kategorie · Balíčky
 └ (hidden) Kolekce, Kategorie
Recenze                                        /reviews
Sezónní výběry                                 /sezonni-vybery
Propagace                                      /promotions
 └ Kampaně
Zákazníci                                      /customers
 └ Skupiny zákazníků
(hidden) Ceníky, Sanity CMS, Segment Analytics
Nastavení                                      /settings             ← separate footer, untouched
```

`Nastavení` is rendered by `UtilitySection`, outside the composer zone, so it is not part
of this payload and cannot be reordered or hidden here. That matches §2.2, which wants it
left alone.

## When to apply

The payload contains `core:nav:/prehled`, which only becomes visible once **P2-3** ships
the dashboard page. Applying it before then is harmless — the entry is inert — so either
apply once after Phase 2 deploys, or apply now and again after, whichever fits the deploy
schedule. Everything else in it exists as of Phase 1.

## Payload

```bash
curl -X POST "$BACKEND_URL/admin/layouts/sidebar/configuration" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{
    "is_default": true,
    "configuration": {
      "widgets": {
        "core:Searchbar":                 { "order": 0 },

        "core:nav:/prehled":              { "order": 1 },
        "core:nav:/denni-prace":          { "order": 2 },
        "core:nav:/orders":               { "order": 3 },
        "core:nav:/zakazkova-vyroba":     { "order": 4 },
        "core:nav:/inventory":            { "order": 5 },
        "core:nav:/products":             { "order": 6 },
        "core:nav:/reviews":              { "order": 7 },
        "core:nav:/sezonni-vybery":       { "order": 8 },
        "core:nav:/promotions":           { "order": 9 },
        "core:nav:/customers":            { "order": 10 },

        "core:nav:/price-lists":          { "order": 11, "hidden": true },
        "core:nav:/sanity":               { "order": 12, "hidden": true },
        "core:nav:/segment":              { "order": 13, "hidden": true },

        "nav-child:/denni-prace:/denni-prace/nove":               { "order": 0 },
        "nav-child:/denni-prace:/denni-prace/pripravujeme":       { "order": 1 },
        "nav-child:/denni-prace:/denni-prace/k-odeslani":         { "order": 2 },
        "nav-child:/denni-prace:/denni-prace/odeslano":           { "order": 3 },
        "nav-child:/denni-prace:/denni-prace/problem-s-platbou":  { "order": 4 },

        "nav-child:/orders:/draft-orders":                        { "order": 0 },

        "nav-child:/zakazkova-vyroba:/zakazkova-vyroba/zakazky":  { "order": 0 },
        "nav-child:/zakazkova-vyroba:/zakazkova-vyroba/produkty": { "order": 1 },

        "nav-child:/inventory:/reservations":                     { "order": 0 },
        "nav-child:/inventory:/sklad-nizky-stav":                 { "order": 1 },
        "nav-child:/inventory:/sklad-vyprodano":                  { "order": 2 },

        "nav-child:/products:/product-options":                   { "order": 0 },
        "nav-child:/products:/merchant-catalog":                  { "order": 1 },
        "nav-child:/products:/bundled-products":                  { "order": 2 },
        "nav-child:/products:/collections":                       { "order": 3, "hidden": true },
        "nav-child:/products:/categories":                        { "order": 4, "hidden": true },

        "nav-child:/promotions:/campaigns":                       { "order": 0 },
        "nav-child:/customers:/customer-groups":                  { "order": 0 }
      }
    }
  }'
```

Get `$ADMIN_JWT` from `POST /auth/user/emailpass` (or however you already authenticate),
and set `$BACKEND_URL` to the running instance you want this applied to. Apply it on
staging first and click through the sidebar before doing the same on production.

Hiding is purely visual — the routes stay reachable by direct URL, so nothing breaks. The
composed page at `/merchant-catalog` creates and edits the same native collection records
through native workflows, and it links out to the technical detail per row, which is why
the native Kolekce/Kategorie children are hidden rather than kept as a second path to the
same concept.

## Open cosmetic item — the „Drafts" label

The draft-order plugin hardcodes its sidebar label as English `"Drafts"`
(`@medusajs/draft-order/.medusa/server/src/admin/index.mjs:1000`) and never reads the
dashboard's Czech `draftOrders.domain = "Koncepty objednávek"`, so setting the user's
language to Czech does **not** relabel it. §2.2 asks for „Koncepty objednávek".

Two options, neither urgent:

1. **Leave it** (what this payload does). One English word in the sidebar. Note that every
   screen behind it is hardcoded English too („Create Draft Order", „Draft Order #"), so
   relabelling only the entrance does not make the feature Czech.
2. **Relabel via a proxy route**: hide `nav-child:/orders:/draft-orders` and add an
   extension route `/koncepty-objednavek` with `nested: "/orders"` that redirects to
   `/draft-orders`. Costs a synthetic route, and the sidebar highlight will not follow to
   the real page — a small oddity on every visit.

Recommendation: option 1 until manual orders actually get used; revisit if she starts
creating them regularly.

## Rollback

```bash
curl -X DELETE "$BACKEND_URL/admin/layouts/sidebar/configuration" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

Clears the system default and falls back to source order: the native block first, then
extension items sorted by `rank` (Denní práce, Zakázková výroba, Recenze, Sezónní výběry,
Sanity CMS, Segment Analytics), with `nested` extensions appearing under their native
parent.
