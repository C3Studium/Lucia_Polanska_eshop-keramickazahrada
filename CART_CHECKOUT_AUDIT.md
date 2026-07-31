# Cart & checkout design audit

Date: 2026-07-28

## Awwwards references

1. [CaiYawen Ceramics](https://www.awwwards.com/sites/caiyawen-ceramics) — the closest
   tonal reference for Keramická zahrada: a nearly monochrome ceramic portfolio,
   large image fields, clean navigation, and restrained scroll/mouse motion. Use it
   for atmosphere and pacing, not for commerce mechanics.
2. [Tesoro — Slide-out Cart](https://www.awwwards.com/inspiration/slide-out-cart-tesoro)
   — a focused reference for a cart that behaves as a compact layer over the page
   on both desktop and mobile. Use its clear edge anchoring and product-first
   hierarchy; the layer must never depend on a negative offset that clips it.
3. [Not-Another-Bill](https://www.awwwards.com/sites/not-another-bill) — a commerce
   reference built around clean, minimal, photography-led layouts and a two-column
   product/cart rhythm. Use its separation of product content and decision content.
4. [DIGITRON — Checkout and Payment](https://www.awwwards.com/inspiration/easy-search-and-navigation-digitron-3d-immersive-site)
   — a reference that explicitly documents desktop, mobile, add-to-cart, checkout,
   payment, and notification states. Use its continuity across steps and strong
   active-state feedback, while avoiding its more immersive 3D treatment here.

## Existing store language

- Warm ivory and clay-tinted surfaces, dark olive/charcoal actions, hairline rules.
- Sentient serif for expressive headings; Sansation for compact operational copy.
- Rounded, floating navigation “objects” above spacious editorial compositions.
- Motion is tactile and directional: magnetic icons, vertical masked text swaps,
  gentle scale, and scroll-led reveals.
- The product/store page lets photography carry the emotion while labels remain
  small, tracked, and almost archival.

## Problems found

- The navbar cart is positioned with `right: -200px` outside checkout, which makes
  the panel visibly clip beyond the viewport at common desktop widths.
- Cart/checkout surfaces partially use the atelier language but still contain
  generic white cards, blue focus rings, utility typography, and inconsistent
  radii. The transition feels like leaving the store for a back-office form.
- The cart has hierarchy, but weak wayfinding: item count, delivery reassurance,
  and the relationship between products and the sticky total are not explicit.
- Checkout step headings and controls compete visually; completed, active, and
  upcoming states need clearer rhythm.
- Country is treated as a user-entered choice even though `[countryCode]` already
  defines the storefront context. Asking again adds friction and permits mismatches.
- Express checkout is a stack of generic UI cards with mixed English/Czech labels,
  strong drop shadows, and no visual progress line. It also lets stored client
  region state override the route context.

## Design and motion specification

### Shared visual system

- Canvas: warm paper `#eee8d6`; surfaces: translucent warm ivory; ink: `#212222`.
- Structure: 1px ink rules at 14–22% opacity instead of heavy boxed cards.
- Type: Sentient serif for page/section titles, Sansation for controls and metadata.
- Labels: 10–12px uppercase, 0.14–0.18em tracking; body copy remains sentence case.
- Actions: dark olive pill, 48–54px high, with the existing vertical masked text
  transition. Focus uses a clay outline, never browser-blue.
- Motion: 220–520ms, `cubic-bezier(.76,0,.24,1)`. Panels reveal with opacity plus
  12–18px translation; avoid large parallax during payment. Respect reduced motion.

### Navbar cart

- Anchor the panel to the viewport-safe right edge and clamp its width to available
  space. Cap its height and scroll only the item list.
- Preserve the floating, translucent object quality of the navbar.
- Use a short downward reveal; product removal and totals remain stable in place.

### Cart page

- Add an editorial heading band with item count and a short handmade-product note.
- Keep a product-led wide column and a sticky summary/checkout column.
- Use rules and breathing room rather than nested cards; make the checkout action
  the single strongest element.

### Checkout

- Use a calm two-column layout: sequential form at left, sticky order context at
  right, collapsing to summary-first on small screens.
- Give every step the same serif heading, rule spacing, warm transparent surface,
  and clear completed/edit state.
- Country is derived from `[countryCode]`, submitted as a hidden value, and shown
  as a read-only “delivery market” label.

### Express checkout (mobile-first)

- The entire experience is a single column with `max-width: 640px`.
- Add a compact brand header, progress counter, and numbered accordion steps.
- Active steps expand with a 16px reveal; completed steps show a quiet check state.
- Product, address, delivery, and payment use consistent Czech labels and controls.
- Region/country are derived from `[countryCode]`; no second country or region
  selector is displayed.

## Acceptance criteria

- Navbar cart is fully visible at desktop and mobile viewport edges.
- Cart and checkout read as the same brand as the store page.
- `/[countryCode]/checkout` submits that route country without a country selector.
- Express checkout never exceeds 640px and follows the route country on first load.
- Keyboard focus is visible and reduced-motion users do not receive large movement.
