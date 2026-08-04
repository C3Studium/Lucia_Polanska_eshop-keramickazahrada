# Setting the requested sidebar order

## Why this is a separate step, not a code change

`Denní práce`, `Orders`, `Reviews`, `Promotions`, `Price lists`, `Products`, `Inventory`,
`Customers` mixes native Medusa sections with our own extension routes. Native sections
(`Orders`, `Products`, `Inventory`, `Customers`, `Promotions`, `Price lists`) are rendered
from a hardcoded array in `@medusajs/dashboard`'s `useCoreRoutes()` and always render as
one fixed block **before** any extension route — no `rank` or `nested` value we set in
`defineRouteConfig` can move an extension item above a native one, or interleave the two.

Medusa 2.18 has a second, independent mechanism for exactly this: layout customization.
It stores a flat `order` number per sidebar entry, and that ordering does not care whether
the entry is native or an extension. Verified against the actual source:

- Zone key for the main sidebar: `"sidebar"` — the `widgetsZonePrefix` passed to
  `LayoutComposer` in `main-layout.tsx`, **not** `"main-sidebar"` (that constant,
  `CUSTOMIZE_IDS.MAIN_SIDEBAR`, only names which composer enters edit mode — it is not the
  API zone key).
- Entry ID scheme: `core:nav:${path}`, e.g. `core:nav:/orders`, `core:nav:/denni-prace`
  (`components/layout-composer/entries.ts:83-90`, `components/layout/main-layout/
  main-layout.tsx:333,338`).
- Ordering: a plain numeric sort key, ties broken by source order, defaulting to `0`
  when unset (`components/layout-composer/entries.ts:141-172`).
- Endpoint: `POST /admin/layouts/:zone/configuration`, validated by
  `AdminSetLayoutConfiguration` — body is
  `{ is_default: boolean, configuration: { widgets: Record<string, { order?, hidden?,
  section? }> } }` (`@medusajs/medusa/dist/api/admin/layouts/[zone]/configuration/
  validators.js`).

`is_default: true` writes the **system default** — every admin user on this store sees
this order, not just the one who set it. That is a shared, persisted, hard-to-reverse
write, so it is deliberately not something run automatically here. Either apply it
yourself with the payload below, or do the equivalent by dragging entries in the admin's
layout-edit mode (pencil icon in the top bar → Main sidebar) and saving as default —
both produce the same stored state.

## Target order

```
0  Searchbar                (kept first — it is a control, not a destination)
1  Denní práce
2  Orders
3  Reviews
4  Promotions
5  Price lists
6  Products
7  Inventory
8  Customers
9  Sanity CMS               (unchanged position — not mentioned in the request)
10 Segment Analytics        (unchanged position — not mentioned in the request)
```

## Payload

```bash
curl -X POST "$BACKEND_URL/admin/layouts/sidebar/configuration" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{
    "is_default": true,
    "configuration": {
      "widgets": {
        "core:Searchbar":         { "order": 0 },
        "core:nav:/denni-prace":  { "order": 1 },
        "core:nav:/orders":       { "order": 2 },
        "core:nav:/reviews":      { "order": 3 },
        "core:nav:/promotions":   { "order": 4 },
        "core:nav:/price-lists":  { "order": 5 },
        "core:nav:/products":     { "order": 6 },
        "core:nav:/inventory":    { "order": 7 },
        "core:nav:/customers":    { "order": 8 },
        "core:nav:/sanity":       { "order": 9 },
        "core:nav:/segment":      { "order": 10 }
      }
    }
  }'
```

Get `$ADMIN_JWT` from `POST /auth/user/emailpass` (or however you already authenticate),
and set `$BACKEND_URL` to the running instance you want this applied to.

## Rollback

```bash
curl -X DELETE "$BACKEND_URL/admin/layouts/sidebar/configuration" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

Clears the system default and falls back to source order (native block, then extension
items sorted by `rank` — which is exactly what Slice 5 already produces: Denní práce
first among extensions, then Reviews, Sanity CMS, Segment Analytics, all after the native
block).
