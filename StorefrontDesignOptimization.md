# Storefront Design Optimization — Keramická zahrada V1.0 → V2.0

**Date:** 2026-08-04
**Scope:** storefront only (`storefront/`). No backend analysis, no code changes — this is the specification for the refinement pass.
**Method:** four full read-only sweeps of the codebase (information architecture, design system, motion & performance, buying journey) plus direct review of the type system, color tokens and motion orchestration. Every claim below is verified against source with `file:line`. Line numbers reflect the working tree on 2026-08-04 and will drift as code changes; the file paths are stable.
**Framing:** the current site is Version 1.0 of an approved design. This document specifies Version 2.0 — *the same website, same identity, same design language, same animation philosophy, noticeably more refined*. Nothing here is a redesign.

**The Final Rule applied throughout:** every recommendation carries value tags — `[usability]` `[readability]` `[accessibility]` `[conversion]` `[trust]` `[clarity]` `[maintainability]` `[performance]`. A recommendation that could not earn at least one tag was rejected and does not appear.

**What V2.0 deliberately keeps unchanged:**
- The brand: warm ceramics palette (ink `#212222`, sage `#BBB788`, olive `#747E62`, cream `#ffe8d6`, clay `#9a6f65`), Sentient display serif, the editorial "atelier archive" voice.
- The signature motion idea: the scroll-driven kiln-color journey on the homepage (`src/modules/home/HomeExperience/index.tsx:14-24` — dark → sage → warm cream → dark, with a travelling glaze glow). This is the most distinctive thing the site does. It stays.
- The tactile interaction language: masked/vertical label swaps, magnetic icons, clip-path reveals, the section-rail scrollbar concept.
- Per-surface atmosphere shifts (cream catalogue, ink product page, sage footer). This *is* the identity; V2.0 tokenizes it instead of removing it.

**Post-approval amendments (2026-08-04, Matěj) — these supersede any conflicting statement below:**

- **A-1 — Kontakt is a modal, not a page.** The navbar contact modal (currently living in `src/modules/home/Kurzy/CTA/`) stays the contact surface — chosen deliberately for conversion: it keeps the customer in context instead of navigating them away. It receives the full refit: working submit via the backend endpoint, dialog accessibility (focus trap, ESC, labeled ≥13px AA fields, fixed 2.1:1 placeholder), success/failure states, and promotion out of the Kurzy module into `layout/`. The footer "Kontakt" entry triggers the modal (the dead `/kontakt` href is removed, which also resolves that 404); no standalone route is created. Contact details remain permanently visible in the footer identity block, so reaching Lucia never *requires* opening a form.
- **A-2 — `/reklamacni-protokol` ships with a downloadable PDF.** The page every Czech e-shop must provide: short explanation + a download button for the official reklamační protokol form. The legal PDF itself is supplied by Matěj; the page ships with a clearly marked placeholder link until then.
- **A-3 — Desktop/laptop-first; the responsive/mobile port is the final phase of the entire project.** The storefront's own SCSS layer system (`src/styles/system/` — h-layer/v-layer landscape+portrait breakpoints) is built for a dedicated, granular responsive pass beyond a normal studio treatment, and that pass comes last. All §10 mobile items — including roadmap row 0.9 (mobile navigation), the PDP bottom buy bar, and bottom-sheet filters — move to that closing phase. Desktop floors and QA apply now; the already-mobile-first express checkout remains the campaign escape hatch for phone traffic in the meantime.

---

## 1. Executive Summary

**What V1.0 is.** An unusually ambitious editorial e-commerce build: a real art direction (not a template), three custom WebGL treatments including a Navier–Stokes fluid simulation, a bespoke scroll instrument replacing the browser scrollbar, per-surface color atmospheres, and a coherent motion vocabulary. The emotional register — calm, handcrafted, premium — is genuinely achieved on the homepage and product page at full attention on a fast machine. As a portfolio piece, it is top-decile ambition.

**What V1.0 is not yet.** A production store for its actual customers. The audit found three systemic gaps between the presentation layer and everything underneath it:

1. **Prototype seams shipped to production.** The header's main product navigation is hardcoded placeholder data — every link in the "Produkty" mega-menu goes to plain `/store` (`src/modules/layout/Navbar/productsButton/index.tsx:118`). The contact form and newsletter form accept input and silently discard it (`src/modules/home/Kurzy/CTA/index.tsx:70`, `src/modules/layout/Footer/index.tsx:315-318`). Two footer links 404 (`/kontakt`, `/reklamacni-protokol`). The payment-pending screen renders `<h1>pending page</h1>` (`src/app/[countryCode]/(main)/cart/[id]/pending/page.tsx:23`). Legal pages contain another company's boilerplate — "www.eshop.cheesemafia.cz" in the withdrawal policy, `gdpr@prochazkagroup.cz` in the privacy policy. The site declares `<html lang="en">`. For a 35–70 audience that buys on trust, each of these single-handedly ends a purchase.

2. **The "archival label" idiom is systematically hostile to the audience.** ≈254 sub-12px type declarations (146 of them at 7–11px), an alpha-muting convention that lands at 3.0–4.4:1 contrast on prices, variant labels, shipping information, and every form label; weight-300 body text on tinted surfaces; 10px uppercase tracked labels as the primary information carrier. The aesthetic is right; the floor is wrong. V2.0 keeps the idiom and raises the floor (§5, §7).

3. **The purchase mechanics are under-engineered relative to the presentation.** Add-to-cart can fail with zero feedback (`details.tsx:96-98`), quantity is hardcoded to 1, three different availability vocabularies contradict each other on one screen, the ComGate flow skips the order review step entirely and **no terms-of-service consent exists anywhere in the app**, the Packeta pickup point can be silently lost, and every backend error surfaces in raw English mid-checkout. There is no mobile navigation at all — the component exists but is imported nowhere (`src/modules/layout/Navbar/index.tsx:302`).

**The V2.0 thesis:** this site does not need more design. It needs its existing design *finished* — legible at the sizes its customers read, honest in its mechanics, calm in its motion defaults, and trustworthy in its details. Roughly 70% of the work in the roadmap (§14) is small, unglamorous, and high-certainty; almost none of it touches the visual identity.

**Awwwards verdict in one line:** Site-of-the-Day-nominee concept; currently loses on Usability and Content — and its own target customer feels that gap harder than any juror.

---

## 2. Overall Design Audit (jury scorecard)

Scored as an Awwwards jury member would before launch. Honest, per criterion, evidence-linked.

| Criterion | Score | Assessment |
|---|---|---|
| Visual Design | **8/10** | Confident, distinctive, ownable. The kiln-journey background, ink product stage, and cream catalogue read as one brand. Loses points for the medusa-ui islands (default blue focus, generic radii) leaking into checkout surfaces. |
| Composition | **7.5/10** | Strong full-bleed editorial rhythm on home/PDP. `/store` hero eats a full viewport before showing a single product; long unconstrained line lengths on legal intros (~95ch, `legal/LegalDocument/style.module.scss:51`). |
| Typography (craft) | **7/10** | Sentient display work is beautiful; negative-tracked headlines are handled with taste. |
| Typography (deployment) | **3.5/10** | ≈254 sub-12px declarations; per-weight `font-family` names defeat the weight axis; `body` requests a font that doesn't exist (`globals.scss:152`); Sansation ships TTF-only. §5. |
| Hierarchy | **6/10** | Clear on the macro level (hero → sections; identity → media → purchase). Broken on the micro level: the price's VAT clause, variant labels and service notes — decision-critical data — are the smallest, faintest text on the page. §6. |
| Accessibility | **3/10** | Zero `prefers-reduced-motion` in 164 stylesheets and 99 motion files; form labels not programmatically associated (`input/index.tsx:60-77`); duplicate `id="checkbox"`; 36 `outline:none` with nine files offering no replacement; `<html lang="en">`; 16px checkbox targets. §7. |
| Motion | **7/10 concept, 4/10 governance** | The vocabulary is precise and on-brand. But: scroll is hard-blocked for 3 s on first load (`LenisContext.tsx:37-47`), 19 infinite animations never pause, ~120 scroll-bound MotionValues on one page, and no reduced-motion path (the hooks exist, commented out). §8. |
| Interaction | **6/10** | Buttons and reveals feel tactile. But hover is the only affordance for the products menu and card CTAs; touch users get no equivalent; add-to-cart gives almost no confirmation and no failure state. |
| Conversion | **4/10** | Every stage of the funnel has at least one self-inflicted leak: fake product menu → no sold-out badges → silent add failures → misleading "Celkem (bez DPH)" → skipped review step → debug pending page → confirmation without the pickup point. §9. |
| Performance | **3.5/10** | Fluid simulation on every route that never pauses; three simultaneous WebGL contexts on the homepage; 241 KB render-blocking global CSS; 3 MB of font files; hero image downloaded twice; `next/dynamic` used zero times. §11. |
| Emotional Design | **8.5/10** | The strongest suit. The site *feels* like a ceramist's atelier: patient, warm, materially textured. Czech microcopy in empty states is genuinely lovely ("Nic se neztratilo…"). This is why the refinement is worth doing. |
| Consistency | **5/10** | Three styling systems, six focus-ring colors, three names for the wishlist, three availability vocabularies, two order-confirmation pages, duplicated terms routes. §12. |
| Innovation | **7.5/10** | The scroll instrument, kiln journey and shader glazes are real innovation used in service of the brand — not effect for effect's sake. The fluid sim as a *global* background is the one place ambition exceeds purpose. |

---

## 3. Layout Improvements

Layouts may change; these are the changes with a defensible reason. Everything else stays.

### 3.1 Homepage (`(main)/page.tsx` → `HomeExperience` → `Hero`, `ECom`)

- **Anchor the kiln-journey keyframes to sections, not page percentages.** `HomeExperience/index.tsx:16-17` maps colors to fixed scroll fractions (`0, 0.13, 0.25, 0.7, 0.9, 1`) while the content inside is Sanity-driven and variable-length. Editing content shifts the palette under sections tuned for it — text that passes contrast today can fail after a CMS edit. V2: drive each color stop from the section element (per-section `useScroll` targets), so "Collections sits on sage" is guaranteed structurally. `[accessibility]` `[maintainability]` `[consistency]`
- **Give the shop a visible entrance above the fold.** The hero is pure atmosphere; the first commercial affordance is far below. Add one quiet primary action in the hero block ("Prohlédnout keramiku" → `/store`) in the existing webButton language. Slow browsers should never need to *discover* how to shop. `[conversion]` `[usability]`
- **Gate `Courses` in Sanity like its siblings.** `E-com/index.tsx` renders `Courses` unconditionally while `Intro`/`Collections` respect `mainPageSettings` flags — the editor's on/off model breaks for one section. `[clarity]` `[maintainability]`
- **Fix the section order's weakest seam:** the `Sold`-style auto-marquee patterns and the 3D wheel carousel (`E-com/Intro/Carousel/ImageCarousel/index.tsx`) are the two most motion-dense, least information-dense blocks. Keep one; simplify the other into the static editorial grid it already contains. Two competing kinetic showpieces in one scroll dilute both. `[performance]` `[clarity]`

### 3.2 Store / catalogue (`store/page.tsx` → `Shop`)

- **Compress `ShopHero` to a band (~40vh) or make it scroll-away-once.** A full-viewport hero on the *catalogue* page delays the only thing that page exists for. The introduction line ("Ateliérový výběr…") can sit atop the grid. `[conversion]` `[usability]`
- **Move filter/sort/search state into the URL.** All state is React-only (`Shop/index.tsx`), so Back after opening a product loses the filtered view and nothing is shareable/bookmarkable (`?category=&price=&sort=&q=` already half-exists for inbound redirects; complete the loop). For this audience, the Back button is the primary navigation instrument — it must not destroy their work. `[usability]` `[conversion]`
- **Keep the 16-per-page "Objevit další objekty" pattern** (explicit, calm, correct for slow browsers) — add the position line "Zobrazeno 32 z 57" at ≥13px/AA (today 10px at 3.06:1, `ProductGrid/style.module.scss:26`). `[readability]`

### 3.3 Product page (`ProductPage/product/details/details.tsx`)

- **Keep the three-zone editorial layout** (identity aside / media stack / purchase aside) — it is the best page on the site.
- **Make the purchase aside sticky on desktop.** The gallery is a long scroll of full-bleed figures; the buy controls scroll away with it. Sticky summary (price + variant + CTA) keeps the decision available at the moment it forms. On mobile: a persistent bottom add-to-cart bar (§10). `[conversion]` `[usability]`
- **Deduplicate the accordion.** "Výroba" renders `product.description` verbatim — identical to "Popisek" (`ProductPage/details/index.tsx:64-83`); dimensions render literal "N/A". Merge to: Popisek / Rozměry a materiál (hide when unset) / Doprava a vrácení / Péče. `[clarity]` `[trust]`

### 3.4 Cart & checkout (`(checkout)/layout.tsx`)

- **Checkout becomes a calm zone.** Today it mounts the full `Navbar`, `Footer`, custom `Scrollbar` **and** the WebGL fluid background (`(checkout)/layout.tsx` → `GlobalLiquidEther`). V2: minimal header (brand + "Zpět do košíku"), no footer link farm, no WebGL, no section rail. Every removed exit and every saved GPU cycle is bought conversion on the exact device class this audience owns. `[conversion]` `[performance]` `[usability]`
- **Keep the two-column cart** (items / sticky summary) from the July audit — implemented and correct. The mini-cart clipping bug from July is verified fixed (`cart-dropdown/style.module.scss:49-54`).

### 3.5 Footer (`layout/Footer/index.tsx`)

- **Add the merchant identity block** — the single highest-trust element a Czech e-shop can render, and it's absent: name, address (Putim 229, 397 01 Písek), IČO, e-mail, phone. The values already exist as env vars nothing reads (`IDENTIFIKACNI_CISLO`, `SIDLO_ADRESA`…). `[trust]` `[conversion]`
- Fix the link map: `/kontakt` and `/reklamacni-protokol` 404; "Smluvní podmínky" and "Obchodní podmínky" both point at the same page under two names. One label per destination, no dead ends. `[trust]` `[clarity]`

---

## 4. Component-by-Component Review

Format: **Verdict** — evidence — V2 action. (Components not listed: keep as-is.)

**Navbar** (`layout/Navbar/index.tsx`) — **Fix.** The floating-object concept and magnetic icons are on-brand; keep. Defects: "Produkty" opens a hardcoded fake menu ("Kolekce 1…6", every link → `/store`; `productsButton/index.tsx:118`, layouts hardcode `navigationCollections = []`); hover-only affordances; `MobileIconsNavbar` exported but never mounted; six decorative `alt="bg__image"`; English icon alts ("search Icon button"). V2: fetch real collections, tap-to-open on touch, mount the mobile nav (§10), empty `alt=""` for decoration, Czech aria-labels. `[trust]` `[usability]` `[accessibility]`

**Search overlay** (`Navbar/navbarSearch/index.tsx`) — **Fix.** Good UI (chips, live count, skeletons, retry, real empty state). Fatal mechanics: on open it downloads the *entire catalogue* in a 48-item loop (`:470-500`) and substring-filters client-side; `TODO(search-service)` at `:462`. V2: point it at the server-side `q` search that `/store` already uses; one search behavior everywhere. `[performance]` `[usability]` `[maintainability]`

**ProductCard** (`store/Shop/components/ProductCard/index.tsx`) — **Fix.** Hover cross-fade and reveal are lovely. Defects: **no sold-out state exists on cards at all**; category eyebrow 11px at 4.04:1 (`style.module.scss:94`); crossed-out price 12px at 4.42:1; index numeral 8px; hover-only "Detail objektu" (touch users get nothing); animated `filter: blur()` on crossfade (repaint-bound, `index.tsx:23,30`). V2: "Prodáno" badge (same chip language as "Novinka"), eyebrow ≥12px/AA, del-price ≥13px/AA, whole card is the tap target, crossfade via opacity only. `[conversion]` `[readability]` `[performance]`

**FilterPanel / ShopToolbar** (`Shop/components/…`) — **Refine.** Facets are sane (Kategorie, Cena, Novinky, Ve slevě). Sort labels 10px/3.83:1; chips ~31px tall; `FilterPanel small` 9px on 42% white. V2: 13px labels, 44px chips, AA colors; add "Skladem" facet once cards know availability. `[readability]` `[accessibility]` `[usability]`

**Gallery** (`ProductPage/product/Gallery/gallery.tsx`) — **Refine.** The vertical editorial stack with captions suits one-of-a-kind objects; keep it as the *story*. Add the *inspection* affordance it lacks: tap/click any figure → full-screen lightbox with pinch/scroll zoom and swipe. Ceramics buyers need to see glaze detail; reading glasses double the need. `[conversion]` `[usability]`

**Option pickers** (`Options/Colors/index.tsx:31-35`, `Options/Sizes/index.tsx:26-35`) — **Fix (critical).** Only options literally named `barva`/`color`/`velikost`/`size` render a picker. Any other option title (e.g. "Glazura", "Průměr") renders *nothing* — the variant can never be selected and the CTA sits dead on "Vyberte variantu". V2: render every `product.option` generically; color-styling stays a presentation hint keyed by name. `[conversion]` `[usability]` `[maintainability]`

**Price block** (`Cta/Price/index.tsx`; `product/style.scss:534,573`) — **Fix.** Price numerals pass (Sentient, 13.7:1). The words around money fail: "Cena |" label 12px at 3.99:1, was-price label at 3.56:1. Money copy is decision-critical; it gets body size and AA minimum, always. `[readability]` `[trust]`

**Add-to-cart CTA** (`Cta/Add/…`, `details.tsx:92-98`) — **Fix (critical).** Failure path: `console.error` only — the button resets as if nothing happened; bundles have no error handling at all. Success path: the only feedback is the header dropdown auto-opening 5 s (`cart-dropdown/index.tsx:74-80`) — off-viewport at the moment of click. Availability text under the button says "Není skladem" for every `manage_inventory:false` variant while the button says "Přidat do košíku" (`Cta/Add/index.tsx:59-61`). And quantity is hardcoded to 1. V2: success = button state morph („Přidáno ✓") *plus* the dropdown; failure = inline Czech `role="alert"` under the button; one availability vocabulary (§12); a quantity stepper for multi-piece items. `[conversion]` `[usability]` `[clarity]`

**RestockForm** (`ProductPage/restock/index.tsx`) — **Keep.** Correct states, Czech copy, right placement. A model citizen.

**BundleActions** (`components/bundle-actions/index.tsx`) — **Refine.** Tabbed component picker works. Add the two numbers that sell bundles: per-component value and "Ušetříte X Kč"; add an error handler on add (`:99-107` has none). `[conversion]` `[trust]`

**Reviews** (`components/product-reviews/index.tsx`, `form.tsx`) — **Refine.** Solid structure (average, paging, login-gated form). Defects: renders "0 recenzí" + five empty stars on every new product (`:290-299`) — undermines a handmade shop where most pieces are new; wrong plural "3 recenzí"; validation is a single toast; 7px type in the form (`form.module.scss:119` — smallest text in the codebase). V2: hide the section below 1 review (or show "Buďte první…" prose), 3-form Czech plurals, inline field errors, kill sub-12px. `[trust]` `[readability]` `[usability]`

**CartDropdown** (`layout/components/cart-dropdown/index.tsx`) — **Keep + one fix.** Clipping fixed, width clamped, mobile variant pinned. Replace the hand-rolled `onWheel` scroll trap (`:81-107`) with Lenis's `data-lenis-prevent` once Lenis CSS is imported (§8). `[maintainability]`

**Cart item** (`cart/components/item/index.tsx:37-39`) — **Fix.** `maxQtyFromInventory = 10` is a literal on both branches — a one-of-a-kind piece (stock 1) can be set to 10 and fails later at the backend, the worst possible place. Cap by real inventory when `manage_inventory` is true. `[trust]` `[usability]`

**Cart totals** (`common/components/cart-totals/index.tsx:38`; `cart-dropdown/index.tsx:222-225`) — **Fix.** "Celkem (bez DPH)" as the headline figure: Czech consumers read "Celkem" as the final price; it then grows at checkout — the classic abandonment trigger. V2: headline = incl.-VAT total ("Celkem 1 890 Kč" + quiet "včetně DPH"); ex-VAT stays as a secondary line. `[trust]` `[conversion]` `[clarity]`

**Input** (`common/components/input/index.tsx` + `style.module.scss`) — **Fix (critical).** `htmlFor={name}` points at a `name`, not an `id` — labels are not programmatically associated on *every* checkout/login/address field (`index.tsx:60-77`); focus is an 18%-alpha shadow (default) or effectively invisible (`contact` variant, `:92-95`); floated label 10.24–10.88px; required marker is a color-only asterisk. V2: `id={name}`, real `:focus-visible` outline (§7), label ≥13px, "(povinné)" in text. `[accessibility]` `[usability]` `[conversion]`

**NativeSelect** (`common/components/native-select/style.module.scss:25`) — **Fix.** `outline: none` replaced by a 1px underline — not a compliant focus indicator on a site-wide primitive. `[accessibility]`

**Checkbox** (`common/components/checkbox/index.tsx:24,34`) — **Fix.** Hardcoded `id="checkbox"` duplicates whenever two render; ~16px hit target. V2: `useId()`, 24px box in a 44px hit area. `[accessibility]` `[usability]`

**Shipping + Packeta** (`checkout/components/shipping/index.tsx`) — **Fix (critical).** The widget flow is right (cs locale, blocks continue if closed unpicked, `:614-621`). But `:277-283` marks the point "selected" *before* the cart POST resolves — a failed POST leaves the flag true and the order proceeds **without a pickup point**; the selection lives only in component state (refresh wipes it); and the confirmation page never shows the pickup point. The express-checkout implementation persists `packeta_pickup_point_label` correctly (`express-checkout/Shipping/index.tsx:124-131`) — **adopt its pattern in the main checkout**, and render the point on Review + confirmation + (backend willing) the order e-mail. `[trust]` `[usability]` `[conversion]`

**Payment / ComGate selector** (`checkout/components/payment/index.tsx:172`, `comgate-payment-selector/…`) — **Fix (critical).** Three clean method groups, good in-flight copy. But `openComgate()` ends in `window.location.assign(...)` — the user goes from picking a card icon straight to the bank, never seeing the Review step, which holds the *only* consent sentence in the app. **No terms checkbox exists anywhere.** V2: Review becomes a mandatory stop: order recap (items, address, **pickup point**, incl.-VAT total) + explicit VOP/GDPR checkbox + "Zaplatit X Kč" as the final action; ComGate redirect happens only from there. Also remove `console.log("session:", …)` from the production payment path (`payment-button/index.tsx:225,249,252`). `[trust]` `[conversion]` (and legal compliance for a Czech e-shop)

**Pending / confirmed pages** (`cart/[id]/pending/page.tsx:23`; `cart/[id]/confirmed/…`) — **Fix (critical).** Pending = `<h1>pending page</h1>` with English metadata — bank-transfer customers (a prominently offered method) land here after *paying*. V2: real Czech state page ("Čekáme na potvrzení platby z banky… objednávka č. X je uložena; potvrzení pošleme e-mailem."), auto-refresh, support contact. `confirmed` runs `placeOrder`+`capturePayment` in a `useEffect` with no `.catch()` — add failure UI. Also: two parallel confirmation surfaces exist (`/order/[id]/confirmed` vs `/cart/[id]/confirmed`) — converge on one. `[trust]` `[conversion]` `[maintainability]`

**OrderCompleted** (`order/templates/order-completed-template.tsx`) — **Refine.** Good bones (order number, e-mail confirmation note, translated statuses, support block). The 3-step status rail is decorative (`TODO(BACKEND)`) — remove until real (a fake progress indicator is a trust liability); show the Zásilkovna pickup point. `[trust]` `[clarity]`

**Footer newsletter + Kontakt modal** (`Footer/index.tsx:315-318`; `home/Kurzy/CTA/index.tsx:70,167`) — **Fix (critical).** Both forms are inert (`preventDefault()` only, submit no-op). A customer who "wrote to ask about a custom piece" gets silence — for a made-to-order atelier this is the single worst possible failure. Wire both (backend endpoints exist for newsletter-adjacent flows; the contact form can be a simple server action + e-mail) and give success/failure states in the existing visual language. Until wired, **remove them** — an absent form is honest; a dead one is not. `[trust]` `[conversion]`

**Scrollbar rail** (`layout/scrollbar/index.tsx`) — **Refine.** The concept (named section rail as orientation instrument) is distinctive — keep it on editorial pages. Engineering: a `MutationObserver` on `document.body` `{subtree:true}` re-measures all sections on every DOM change (`:151-181`) while framer mutates the DOM constantly, plus per-frame `setState` re-rendering the rail. V2: measure once per route + on `ResizeObserver`, drive progress via MotionValue (no React re-render), drop it entirely on checkout. Note: the native scrollbar is globally hidden (`globals.scss:151-182`) — on pages without the rail this removes the only scroll position cue; ensure the rail (or native bar) exists wherever scrolling matters. `[performance]` `[usability]`

**Buttons family** (`Buttons/webButton`, `premium-action-button`, `Buttons/button`, toolbar buttons) — **Consolidate.** Four hover-swap button implementations with different heights (50/45/40/35px), label sizes (24/14/12px) and focus treatments (2px outline vs none). Keep the webButton masked-swap as *the* primary pattern; one shared spec: ≥48px, label ≥14px, the standard focus ring, fill-in 450 ms / out 300 ms (today 720 ms in — §8). `[consistency]` `[accessibility]` `[maintainability]`

**Magnetic / RotatingText** (`Buttons/Magnetic/index.tsx:9-16`; `RotatingText/index.tsx:29-42`) — **Refine.** Keep both behaviors; fix their cost: Magnetic runs `setState` per `mousemove` (a React render per pointer event, ×4 in the persistent navbar) — switch to MotionValues; RotatingText runs a perpetual rAF — gate by `useInView` + pause when hidden. `[performance]`

**LiquidEther / shaders** — see §8.4 and §11.1.

---

## 5. Typography Improvements

### 5.1 What exists (verified)

- Families: **Sentient** (12 faces, 2.6 MB, incl. an *unused variable font shipped alongside 10 static cuts*), **Sansation** (6 faces, TTF-only — no woff2), **Oooh Baby** (script, 3 uses). Loaded via CSS `@import` chains (`globals.scss:15-17`); `next/font` unused; no preloading, no subsetting, no fallback metrics.
- **Each weight is registered as its own `font-family` name** (`Sentient-Bold`, `Sansation-Light`, …). Consequences: no weight axis (`font: 300 … "Sansation-Light"` requests weight 300 from a 200-weight face → synthesis), no graceful fallback, every cut is a separate download.
- **`body { font-family: "Poppins-Regular", sans-serif }` requests a font that is not in the repo** (`globals.scss:152`) — default body text silently renders in the system font. The brand's body voice literally isn't loading.
- The SCSS type mixin sets **`height:` equal to `font-size`** on every token it styles (`src/styles/system/_typography.scss:291-338`) — clipping Czech diacritics on capitals (Ř/Š/Č) and breaking any text that wraps. This is why so many layouts only survive single-line text.
- Tailwind's type system is vestigial: one override, Inter declared but never loaded, medusa-preset classes compiled but unreferenced.
- Deployment stats: ≈254 declarations below 12px; 146 at 7–11px; 201 uppercase-tracked labels, all ≤12px; body copy predominantly 15–17px at weight 300.

### 5.2 The V2.0 type specification

Keep Sentient for display, Sansation for UI/body, Oooh Baby only as aria-hidden decoration. Change the *floors*, not the voice:

| Token | Size / line-height | Rules |
|---|---|---|
| Display (Sentient) | clamp(2.75rem, 6vw, 5rem) / 1.05 | negative tracking allowed; unchanged territory |
| H2 | clamp(2rem, 3.2vw, 3rem) / 1.1 | |
| H3 | clamp(1.375rem, 2vw, 1.75rem) / 1.2 | |
| Body-editorial | 1.125rem (18px) / 1.6 | weight 300 permitted here only, on solid surfaces |
| **Body (floor for paragraphs)** | **1rem (16px) / 1.55** | weight ≥400 on tinted/animated surfaces |
| UI (buttons, nav, inputs) | 0.9375–1rem (15–16px) / 1.4 | inputs always ≥16px (also prevents iOS zoom-on-focus) |
| Caption / meta (absolute floor) | **0.8125rem (13px) / 1.5** | the smallest customer-facing text allowed |
| Eyebrow (the archival label) | **0.75rem (12px)** min — prefer 13px / 1.4 | uppercase kept; tracking capped at **0.12em**; weight 500; AA color mandatory |

- **Nothing below 12px reaches a customer.** 7–11px survives only inside `aria-hidden` graphic ornaments. This single rule retires ~146 declarations.
- Prose measure: 45–75ch (`max-width: 65ch` default; fixes the ~95ch legal intros).
- Migrate to **`next/font/local`** with the **Sentient variable font already in the repo** (one file replaces 10 cuts) + a woff2-converted Sansation (weight axis or 2 cuts max) + subsetting to Latin/Latin-Ext. ~3 MB → ~150–250 KB, with automatic fallback metric adjustment (kills the font-swap CLS on the giant hero h1). Fix or delete the "Poppins-Regular" body rule. `[readability]` `[performance]` `[maintainability]`
- Delete the `height:` line from the type mixin; audit the layouts that silently depended on it. `[readability]` — this is the fix that lets Czech text wrap and keep its diacritics.

**Why objectively better:** the audience wears reading glasses; 10px tracked-uppercase labels carrying prices, form labels and shipping terms are the exact failure mode for presbyopic reading (degraded word shapes + sub-threshold size). The editorial "archive" look survives fully at 12–13px — the idiom was never the problem, the floor was.

---

## 6. Hierarchy Improvements

- **Money and availability outrank atmosphere.** On the PDP the price numeral passes, but its VAT clause (12px/3.99:1), the variant label (11px/3.92:1) and the shipping/returns notes (10px/3.36:1, `product/style.scss:648-649`) are the least visible text on the page — inverted hierarchy at the decision point. V2: everything a customer must read to decide sits at ≥ Body/Caption tokens with AA contrast; only true ornament may be quiet. `[readability]` `[conversion]`
- **One primary action per view.** The PDP purchase aside, cart summary and each checkout step get exactly one visually dominant button (the masked-swap primary); everything else demotes to text links. Today's competing pills/links (e.g. decorative "Detail objektu" with `pointer-events:none` beside real links) blur the "what do I click" answer. `[usability]` `[clarity]`
- **Restore the document outline.** `/dotazy` has no `<h1>` (starts at h2, `dotazy/main/index.tsx:116`); the Footer injects `<h2>`+2×`<h3>` into *every* page's outline (`Footer/index.tsx`). V2: h1 on dotazy; footer headings become styled `<p>`s. Screen-reader users navigate by headings; today every page ends in a phantom branch. `[accessibility]` `[clarity]`
- **Checkout step rhythm.** Completed steps: quiet check + one-line summary + "Upravit"; active step: full serif heading; upcoming: dimmed but AA. The billing form must not be titled "Doručovací adresa" (`addresses/index.tsx:77` — two identically-titled forms when unticked). `[usability]` `[trust]`
- **Card hierarchy:** title → price → (sold/new badge) → category eyebrow. Today the faint 11px eyebrow sits *above* the title, first in reading order, least readable. `[readability]` `[conversion]`

---

## 7. Accessibility Review (WCAG 2.2 AA)

The goal is invisible accessibility: nothing below changes how the design looks at full attention; everything changes whether its own customers can use it.

### 7.1 Failures found, mapped to success criteria

| SC | Finding | Evidence |
|---|---|---|
| 3.1.1 Language of Page | `<html lang="en">` on a Czech store — screen readers use English phonetics for Czech text, browsers offer translation | `src/app/layout.tsx` |
| 1.4.3 Contrast (text) | The alpha-muting convention lands at 3.0–4.4:1 across prices, labels, footer, forms: `.footer` muted 3.53:1 site-wide; PDP service notes 3.36:1 @10px; catalogue count 3.06:1 @10px; card eyebrow 4.04:1; placeholder worst case ≈2.1:1 (`Kurzy/CTA/styles.scss:136`) | §5 census; `Footer/style.scss:47-272`; `product/style.scss:648`; `ProductGrid:26` |
| 1.4.11 Non-text contrast | Default input focus = 18%-alpha shadow; `contact` variant focus ≈ invisible; 1px-underline "focus" on selects | `input/style.module.scss:42-45,92-95`; `native-select/style.module.scss:25` |
| 2.4.7 / 2.4.11 Focus visible | 36× `outline:none`; **nine files strip focus with no replacement at all** (incl. the site-wide select, review form, restock form, both password flows, express-checkout, FAQ) | agent-verified file list, §7.3 |
| 1.3.1 / 4.1.2 Info & relationships | `<label htmlFor={name}>` with no matching `id` on the primary Input — **no programmatic label on any checkout field**; hardcoded duplicate `id="checkbox"`; error "!" glyph is CSS `content:` | `input/index.tsx:60-77`; `checkbox/index.tsx:24,34`; `error-message/style.module.scss:16-22` |
| 2.5.8 Target size (24px min) | ~16px checkbox; 31px filter chips; 32px load-more; 35/40/42px control census (30+25+18 declarations) vs 48px (17) | `checkbox`; `ShopToolbar:77`; `ProductGrid:27` |
| 2.3.3 / 2.2.2 Animation & moving content | **Zero `prefers-reduced-motion` coverage in 164 stylesheets and 99 motion files**; 19 infinite CSS animations; perpetual marquee & rotating text with no pause affordance; the hooks exist, commented out | `IntroHero/index.tsx:21`; `FAQImageShader.tsx:402-403` |
| 2.1.1 Keyboard | Products mega-menu and card CTAs are hover-revealed; homepage wheel/touch scroll is `preventDefault()`-ed for 3 s while keyboard scroll desyncs and snaps back | `productsButton`; `LenisContext.tsx:37-47` |
| 1.4.12 Text spacing | UI text set via `font:` shorthand at line-height 1–1.25 — user line-height overrides fight a shorthand reset | census §5 |
| 1.4.4 Resize text | Hard `px`/`clamp(px…)` floors dominate; root rem respected (good) but the sub-12px floor makes 200% zoom the only remedy | §5 |
| 1.1.1 Non-text content | `alt="bg__image"`×6, `alt="Thumbnail"`, English alts on a Czech site; decorative images not `alt=""` | `Navbar/index.tsx`; `thumbnail/index.tsx:49` |
| 3.3.1/3.3.3 Error identification | Backend errors surface raw English (`medusa-error.ts:31-44`); add-to-cart failures surface nothing at all | §9 |
| 1.4.1 Use of color | Required-field marker = red asterisk only; sale signaled by color-tinted del-price at 4.42:1 | `input/index.tsx:76`; `ProductCard:101` |

### 7.2 The V2.0 accessibility system (one-time, invisible)

1. **Surface-paired color tokens replace alpha soup.** For each surface, three text tones as *named solids*, contrast-verified once: on cream `#f2eee5` → ink `#212222` (15.9:1), secondary ≈`#4d4e46` (~7:1), minimum ≈`#5c5e54` (≥4.5:1); on PDP ink `#20211c` → cream `#ffe8d6` (13.7:1), secondary ≥5:1 (measured: cream@0.62 = 6.06:1 passes; 0.46 = 3.99 fails — the floor sits near α 0.58). Sage surfaces (`#BBB788`) take ink text only — white-on-sage (≈2:1) and white-on-olive `#747E62` (4.29:1, just under AA) are retired for body-size text. Exact hexes finalized with a contrast tool at implementation; the rule is what matters: **no text color ships without a measured pair.** `[readability]` `[accessibility]` `[maintainability]`
2. **One global focus rule**, deleting all 36 `outline:none`: `:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px }`, with `--focus` = clay `#9a6f65` on light surfaces (3.75:1 ✓) and cream on dark. The clay ring is already the dominant treatment (10 sites) — this promotes the site's own best pattern to law. `[accessibility]` `[consistency]`
3. **Form primitives fixed once, everywhere:** `id={useId()}` + `htmlFor` on Input; native labels ≥13px; visible "(povinné)"; `aria-describedby` for errors; checkbox 24px in a 44px target; select gets the standard ring. Because every form reuses these three components, this is three files, not thirty. `[accessibility]` `[conversion]`
4. **Target floor:** 44×44 interactive minimum (48 for primary CTAs) — aligns with the existing 48px `--nav-height` rather than fighting it. `[usability]`
5. **Reduced motion, three layers** (§8.5). `[accessibility]` `[performance]`
6. **`lang="cs"`** + Czech aria-labels/alts; decorative images `alt=""` + `aria-hidden`. `[accessibility]` `[trust]`

Cognitive accessibility is handled by §9 and §12: one availability vocabulary, one name per feature, Czech-only messages, no vanishing state.

---

## 8. Motion Improvements

### 8.1 Philosophy — keep it, write it down

The vocabulary is right for the brand: tactile masked swaps, directional reveals, material glazes, the kiln journey. The two easing signatures already in the code — `[0.76, 0, 0.24, 1]` for reveals, `[0.22, 1, 0.36, 1]` for micro-motion — become the *only* curves. What V1.0 lacks is not taste but a budget.

### 8.2 The motion budget

| Class | Duration | Rules |
|---|---|---|
| Micro-feedback (hover fills, swaps, toggles) | 150–350 ms | webButton fill drops from 720 ms → 450 ms in / 300 ms out — hover feedback must never feel slower than the customer's hand |
| Entrance reveals (`whileInView`) | 400–700 ms, once | max stagger total ≤ 900 ms per section |
| Scroll-linked (parallax, kiln journey, curtains) | scroll-mapped | transform/opacity/backgroundColor only — **no animated `clipPath` or `filter` for repaint-bound effects** where a mask/transform equivalent exists (`ProductCard/index.tsx:23,30` blur-crossfade → opacity) |
| Ambient (glazes, glow, shader) | ≤1 per viewport, always pausable | never in checkout |
| Page transition (new, optional P4) | 240 ms fade+lift, shared | orientation, not spectacle |

### 8.3 The single worst defect: the 3-second scroll lock

`StateContext.tsx:26-31` (3000 ms timer) + `LenisContext.tsx:37-47` (`lenis.stop()`) actively `preventDefault()` wheel and touch on homepage load; keyboard still scrolls natively, desyncs Lenis, and the page *snaps back*. A slow-browsing 60-year-old's first three seconds are "the site is broken / frozen." V2: the intro plays over a scrollable page (the 1.1 s hero clip reveal already covers arrival); the lock is deleted, not shortened. `[usability]` `[trust]` `[performance]`

### 8.4 WebGL: one context, on purpose

Today: the fluid sim runs **on every route** and never pauses (its `position:fixed; inset:0` host keeps its own IntersectionObserver permanently satisfied — `global-liquid-ether/style.module.scss` + `LiquidEther.tsx:1203`); the homepage runs **three simultaneous contexts** (GlobalLiquidEther + HeroImageShader + LiquidImageCarousel); `FAQImageShader` has no offscreen/tab-hidden gating at all; none handle context loss; the declared `isMobile` field is dead code (`LiquidEther.tsx:126`).

V2 policy — keeps the craft, restores proportion:
- **One WebGL context per page, maximum.** Home: the hero shader *or* the ambient — the kiln-journey background (pure CSS/framer color) already carries atmosphere; the fluid sim earns its place only where it's interacted with (the carousel section), not as global wallpaper.
- Route-gated and `next/dynamic`-imported (three.js leaves the shared bundle, §11); true pause via a scroll/visibility gate that works with a fixed host; `webglcontextlost` → the static-image fallback that `FAQImageShader` already implements (`:485-488`); DPR cap 1.5; the existing reduced-motion shader path (`FAQImageShader.tsx:402-403`) un-commented as the low-power tier.
- **Checkout, cart, account, legal: zero WebGL.** `[performance]` `[usability]` `[conversion]`

### 8.5 Reduced motion — finish the written work

Three layers, mostly uncommenting what exists (`IntroHero/index.tsx:21`, `omne/main/index.tsx:10`, `dotazy/main/index.tsx:12`):
1. CSS: one global `@media (prefers-reduced-motion: reduce)` — infinite keyframes off, transitions ≤150 ms.
2. JS: `useReducedMotion` → scroll-linked transforms become static finals; marquee (`Sold/index.tsx:146` — also gate its rAF by visibility for everyone) becomes the scroll-snap rail it already has for mobile; RotatingText static.
3. Lenis: native scrolling for reduced-motion users; import `lenis/dist/lenis.css` (currently missing — the cart drawer's hand-rolled wheel trap exists only because `data-lenis-prevent` styles never loaded); pass the existing `scroll-margin-top` as Lenis offset so anchors stop landing under the navbar (`scrollWithLenis.ts` offset 0 vs `globals.scss:174`). `[accessibility]` `[performance]` `[usability]`

---

## 9. Conversion Improvements

Funnel order; each item names its leak.

**Arrival & trust (before anything else):** `lang="cs"`; Czech metadata replacing "Checkout" / "Sign in to your Medusa Store account." / Slovak forgot-password / "You purchase was successful"; real collections in the Produkty menu; footer identity block + fixed links; working (or removed) contact & newsletter forms; own-company legal texts replacing cheesemafia/prochazkagroup boilerplate; consent banner decision for Segment analytics (`/cookies` page alone does not authorize tracking). *A 60-year-old's trust checklist is exactly this list.* `[trust]` `[conversion]`

**Discovery:** sold-out badges on cards (today a customer can fall in love with a sold piece and learn it at the PDP); URL-persisted filters (Back never destroys work); server-side search everywhere; "Skladem" facet. `[conversion]` `[usability]`

**Product page:** add-to-cart success/failure feedback (the #1 mechanical leak — silent failure + missable success = double-adds and abandoned carts); quantity stepper; one availability vocabulary (§12); gallery zoom; generic option rendering (today a mis-named option makes a product *unbuyable*); reviews section hidden until it has content. `[conversion]` `[usability]` `[trust]`

**Cart:** incl.-VAT headline total; quantity capped by real stock; free-shipping nudge kept (good pattern, correctly rule-gated). `[trust]` `[conversion]`

**Checkout:** mandatory Review stop with terms checkbox + full recap (incl. pickup point) before the ComGate redirect; Czech error layer — a mapping table over `medusa-error.ts` so no raw backend English ever reaches the form (unmapped → "Něco se nepovedlo. Zkuste to prosím znovu, nebo nám napište." + support e-mail); phone required when Zásilkovna is selected (carrier needs it); billing form correctly titled; pickup-point persistence adopted from express-checkout. `[conversion]` `[trust]` `[accessibility]`

**Payment states:** real pending page (bank transfers are a promoted method — their landing page is currently a debug stub); `.catch()` + failure UI on the confirm flow; converge the two confirmation surfaces. `[trust]` `[conversion]`

**Post-purchase:** confirmation shows pickup point; fake status rail removed until backed by data; support block kept. `[trust]` `[clarity]`

**Unused asset:** the express-checkout flow (`/express-checkout/[handle]`) is the best-engineered purchase surface in the repo and nothing links to it. Keep it for campaigns — and treat it as the reference implementation its main-checkout siblings copy from (Packeta handling, single-column ≤640px discipline). `[maintainability]` `[conversion]`

**Made-to-order (flagged, coordinate with backend roadmap):** the storefront has *no* MTO interface — no deposit explanation, no specification field, no production-time promise (only a WIP comment, `Cta/Add/index.tsx:62-63`, and leftover phone-case copy "Každý kryt…1-3 pracovní dny" on `/doprava-a-platba:69`). For a studio whose signature offering is commissioned pieces, this is the largest strategic gap in the storefront; it is scheduled work in the backend plan and the PDP must gain its counterpart UI (deposit %, "Popište své přání" textarea, production window) when that lands. Meanwhile: delete the phone-case sentence — it is false advertising for ceramics. `[conversion]` `[trust]`

---

## 10. Mobile Experience Review

Mobile is currently a scaled desktop, not a designed experience — on the device class most of this audience actually uses.

- **There is no mobile navigation.** `MobileIconsNavbar` is built and exported (`Navbar/index.tsx:302`) and imported nowhere; the navbar SCSS has exactly one media query (≥1240px width nudges). Phones get the desktop grid: magnetic hover icons, hover mega-menu, hover cart popover — none of which have touch equivalents. **P0:** mount the mobile bar (Obchod / Oblíbené / Košík / Účet) + a full-screen drawer with real collections, Kontakt, Dotazy. `[usability]` `[conversion]`
- **Touch replaces hover everywhere:** card CTA → whole card tappable; products menu → tap-toggle; cart popover → tap navigates to `/cart`. `[usability]`
- **PDP sticky buy bar** (price + variant + Přidat do košíku) once the purchase aside scrolls away — the mobile twin of §3.3's sticky aside. `[conversion]`
- **Filters as a bottom sheet** with a result-count apply button ("Zobrazit 12 objektů") — the current inline panel pushes the grid below the fold. `[usability]`
- **Performance is a mobile feature:** the fluid sim has no mobile fallback (dead `isMobile` flag), three contexts can render on a phone, and context eviction (likely at 3 contexts) currently leaves permanent blank canvases. §8.4's policy is *primarily* a mobile fix. Inputs at ≥16px kill iOS zoom-on-focus. `[performance]` `[usability]`
- **Express-checkout is the mobile blueprint** — single column, ≤640px, numbered steps, persisted pickup point. The main flow adopts its patterns rather than inventing new ones. `[maintainability]` `[conversion]`
- **Test matrix for acceptance:** Safari on a 2019-era iPad, mid-range Android Chrome, iPhone SE-class viewport (320px — the declared `2xsmall` breakpoint), plus desktop Safari/Firefox. Sunlight legibility = the §7 contrast floors, verified on the lowest-brightness test device. `[usability]` `[readability]`

---

## 11. Performance Recommendations

Performance is part of the design: the calm this brand sells cannot survive jank on a five-year-old laptop. Ranked by user-felt impact; no recommendation here costs any visual identity.

1. **WebGL policy** (§8.4): one context max, route-gated, dynamically imported, truly pausable, DPR ≤1.5, context-loss fallback. Removes a permanent GPU load from every page including checkout. `[performance]` `[conversion]`
2. **Delete the 3 s scroll lock** (§8.3). `[performance]` `[usability]`
3. **Split the global stylesheet.** `scripts/sync-styles.js` concatenates 41 global SCSS files into one 241 KB render-blocking sheet on every route (checkout downloads homepage-hero CSS). Convert global `style.scss` files to CSS modules per component (most already have module twins as the convention); retire the sync script. `[performance]` `[maintainability]`
4. **Fonts** (§5.2): `next/font/local`, the existing Sentient variable font, woff2 Sansation, subsetting → ~3 MB to ~150–250 KB + CLS-free swaps. `[performance]` `[readability]`
5. **Images:** fix the hero double-download (raw 2400 px q90 to `THREE.TextureLoader` *plus* the same URL via `next/image` — `IntroHero/index.tsx:23`, `FAQImageShader.tsx:431,523`; feed the shader the optimized URL); add `sizes` to the five per-page navbar `fill` images (`Buttons/button/index.tsx:237` — currently assumes 100vw); correct the hero's inherited `sizes="32vw"` (it renders full-bleed); constrain the 5 unconstrained Sanity `urlFor()` call sites; compress/convert the 77 MB of `public/assets/img` originals (30+ files >1.3 MB, six of them on the homepage). `[performance]`
6. **Dead weight:** remove `regl`, `axios`, `styled-components`, `@radix-ui/react-accordion`, `react-intersection-observer`, `qs` (all 0 imports); decide Stripe/PayPal — ComGate is the PSP; if they are starter leftovers, removing them deletes a module-scope `loadStripe()` that fires the remote Stripe script on checkout parse (`payment-wrapper/index.tsx:20`); lodash → per-method imports or `optimizePackageImports` (4 full-package imports today). `[performance]` `[maintainability]`
7. **Main-thread hygiene:** Scrollbar's body-wide MutationObserver → route-change + ResizeObserver measurement, MotionValue-driven rail (no per-frame setState); cache `getBoundingClientRect` in the three per-pointer-event handlers (`FAQImageShader.tsx:304,493`, `IntroHero/index.tsx:148-152`, `Magnetic`); gate the Sold marquee's unconditional rAF + its 32 ms `querySelectorAll` loop by visibility. `[performance]`
8. **Code splitting:** `next/dynamic` for the shader components, Packeta widget flow, and the FAQ/gallery showpieces — 0 dynamic imports today; three.js (315 KB) currently ships to every route. `[performance]`
9. **Budgets as acceptance criteria (mid-range Android, Lighthouse mobile):** LCP < 2.5 s, TBT < 200 ms, CLS < 0.1, homepage JS < 350 KB gz, CSS per route < 60 KB. Wire the existing-but-unconnected `ANALYZE=true` bundle analyzer into `next.config.js`. `[performance]` `[maintainability]`

---

## 12. Visual Consistency Review

- **One styling system of record.** Reality: Tailwind is vestigial (the census: `uppercase` ×0, `tracking-*` ×0 in TSX — everything lives in SCSS), medusa-ui appears in 32 files with its own tokens, 164 SCSS files carry the actual design. V2 declares the SCSS token layer (`src/styles/system/`) canonical, completes it (type tokens §5.2, surface color pairs §7.2, spacing, radii, focus), and confines Tailwind/medusa-ui to the commerce internals awaiting replacement. No big-bang rewrite — a boundary. `[maintainability]` `[consistency]`
- **Radius scale:** inputs 12px, pills 999, medusa `base` 4px coexist. Pick: 12px fields / 999 pills / 2px chips; done. `[consistency]`
- **Focus ring:** six colors today → one rule, two surface variants (§7.2). `[consistency]` `[accessibility]`
- **One name per concept:** the wishlist is "Oblíbené produkty" (navbar aria), "Seznam přání" (account nav), "wishlistu" (delete button) — pick **Oblíbené**. Availability is "K dispozici"/"Na dotaz" (badge) vs "Není skladem" (CTA note) vs button state — V2 vocabulary: **Skladem / Poslední kus / Prodáno / Na objednávku**, used by badge, PDP and CTA alike. `[clarity]` `[cognitive accessibility]`
- **Route hygiene:** delete the 0-byte `smluvni_podminky` page (build/500 risk) and the duplicate footer label; converge the two confirmation templates; remove shipped `console.log`s (reviews page, wishlist page, verify-email logs customer data, payment button logs the session). `[trust]` `[maintainability]`
- **The per-surface palette shifts stay** — cream catalogue, ink PDP, sage footer are the brand's register changes. Tokenizing each surface's text pairs (§7.2) is what turns "drift" into "system." `[consistency]` `[accessibility]`
- **Empty-state voice:** the existing Czech empty states are the best writing on the site — codify their pattern (title + one warm sentence + one action) and reuse it for error states, which currently range from English to nothing. `[clarity]` `[trust]`

---

## 13. Before vs After Reasoning

Eight emblematic changes; each preserves the design language and answers "why is this objectively better for the customer."

**1. The archival eyebrow label.**
Before: 8.3–11px, uppercase, tracking .14–.18em, `rgba(ink,.56)` ≈3.8:1 (`E-com/*`, `ProductCard:94`, footer). After: 12–13px, uppercase kept, tracking .10–.12em, secondary token ≥4.5:1. *Same voice, now legible through reading glasses; word shapes survive the tracking.* `[readability]` — the single highest-leverage visual change on the site.

**2. The PDP purchase column.**
Before: price numeral large; VAT clause 12px/3.99:1; variant label 11px/3.92:1; shipping notes 10px/3.36:1; button feedback silent; quantity fixed at 1. After: sticky column; all decision copy ≥13px/AA; one availability vocabulary; button confirms and fails audibly; stepper for multiples. *The moment of decision stops requiring squinting and faith.* `[conversion]` `[readability]`

**3. The product card.**
Before: no sold-out state; faint 11px eyebrow first; 12px crossed price at 4.42:1; hover-only CTA. After: Prodáno/Poslední kus chip in the existing badge language; title first; AA prices; whole card tappable. *A customer never falls for an unavailable piece, and touch users get the same card desktop users do.* `[conversion]` `[trust]`

**4. Checkout's final step.**
Before: pick a payment icon → immediate redirect to the bank; no recap, no terms consent anywhere; billing form titled as shipping. After: Review = recap (items, address, pickup point, incl.-VAT total) + VOP checkbox + "Zaplatit X Kč". *The customer who wants to "check everything once more" gets exactly that; the shop gets its legal consent record.* `[trust]` `[conversion]`

**5. The footer.**
Before: 9–11px muted text at 3.53:1, no IČO/address/contact, two dead links, an inert newsletter form. After: identity block (name, address, IČO, e-mail, phone), working links, working or absent form, 13px+ AA smallprint on the same sage surface. *The page every skeptical Czech buyer scrolls to before paying now answers them.* `[trust]`

**6. First contact with the homepage.**
Before: wheel and touch dead for 3 s; three WebGL contexts spin up; fonts swap with reflow. After: scroll works from frame one; the kiln journey and hero reveal play unchanged; one context, loaded lazily; fonts load with matched metrics. *The opening impression changes from "frozen" to "calm" — on the exact laptops this audience owns.* `[usability]` `[performance]`

**7. The form field.**
Before: label floats to 10.24px, focus nearly invisible, label not programmatically bound, required = red asterisk, errors in English. After: 13px+ label, clay focus ring, real `id`/`for`, "(povinné)", Czech errors beside the field. *Checkout stops being the place where weaker eyesight and screen readers are both abandoned.* `[accessibility]` `[conversion]`

**8. Motion under preference.**
Before: reduced-motion users get the full fluid sim, marquees, 19 infinite loops — the code to spare them exists, commented out. After: they get the same composed pages, settled; everyone else sees no change. *Accessibility that is literally invisible to those who don't need it.* `[accessibility]` `[performance]`

---

## 14. Priority Implementation Roadmap

Effort: S ≤ ½ day · M ≤ 2 days · L ≤ 1 week. Every phase ends releasable.

### P0 — Trust & correctness blockers (≈1 week total; no visual identity changes)
| # | Item | Effort | Tags |
|---|---|---|---|
| 0.1 | `lang="cs"`; Czech metadata sweep (Checkout / Sign in / Medusa Store / Slovak / "You purchase…") | S | trust |
| 0.2 | Real collections in Produkty menu (un-hardcode `navigationCollections`; remove `hardcodedCollections`) | M | trust, conversion |
| 0.3 | Footer: identity block from envs; Kontakt entry → modal (A-1); create `/reklamacni-protokol` **with downloadable PDF** (A-2); dedupe terms label; delete 0-byte `smluvni_podminky` route | M | trust |
| 0.4 | Wire or remove contact + newsletter forms (with success/failure states) | M | trust, conversion |
| 0.5 | Replace wrong-company legal boilerplate (withdrawal, privacy); fix the three inconsistent bank numbers on `/doprava-a-platba`; delete the phone-case sentence | S | trust |
| 0.6 | Real payment-pending page; `.catch()` on confirm flow; remove payment-path `console.log`s (incl. customer-data logs) | M | trust, conversion |
| 0.7 | Review step mandatory + terms checkbox before ComGate redirect | M | trust, conversion, legal |
| 0.8 | Czech error-mapping layer over `medusa-error.ts` + customer.ts strings | M | trust, usability |
| 0.9 | Mobile navigation + tap equivalents — **moved to the final Responsive phase (A-3)** | M–L | usability, conversion |
| 0.10 | Add-to-cart success/failure feedback (both product + bundle paths) | S | conversion |
| 0.11 | Cookie-consent decision & implementation for Segment | M | trust, legal |

### P1 — The readability & accessibility system (the V2 look emerges here)
| # | Item | Effort | Tags |
|---|---|---|---|
| 1.1 | Type tokens + floors (§5.2); retire sub-12px; fix the mixin `height:` bug; measure caps | L | readability |
| 1.2 | Surface color pairs replacing alpha-muting; retire white-on-sage/olive body text | M | readability, accessibility |
| 1.3 | Global focus rule; delete 36 `outline:none`; select/input/checkbox primitives (ids, labels, targets, "(povinné)") | M | accessibility, conversion |
| 1.4 | Target-size floor 44px (chips, load-more, nav controls, compact buttons) | M | usability |
| 1.5 | Reduced-motion: CSS layer + `useReducedMotion` + Lenis native path + Lenis CSS import + anchor offset fix | M | accessibility, performance |
| 1.6 | Delete the 3 s scroll lock | S | usability |
| 1.7 | Heading outline: `/dotazy` h1, footer headings → `<p>`, Czech alts/aria; one wishlist name | S | accessibility, clarity |

### P2 — Conversion mechanics
| # | Item | Effort | Tags |
|---|---|---|---|
| 2.1 | Availability vocabulary + sold-out card badges + CTA note unification | M | conversion, clarity |
| 2.2 | Quantity stepper (PDP) + real inventory cap (cart) | S | usability, trust |
| 2.3 | Generic option-picker rendering (any option name) | M | conversion |
| 2.4 | Incl.-VAT headline totals (cart, mini-cart, checkout) | S | trust |
| 2.5 | URL-persisted filters/sort/search; server-side search in navbar overlay | M | usability, performance |
| 2.6 | Packeta persistence from express-checkout pattern + show point on Review/confirmation; phone required for Zásilkovna | M | trust, conversion |
| 2.7 | Gallery lightbox/zoom; accordion dedupe; reviews hidden until content; Czech plurals (kusy/objekty/recenzí) | M | conversion, clarity |
| 2.8 | Store hero compression + catalogue count at AA; sticky PDP purchase column + mobile buy bar | M | conversion |
| 2.9 | Converge the two confirmation surfaces; remove fake status rail | M | trust, maintainability |

### P3 — Performance
| # | Item | Effort | Tags |
|---|---|---|---|
| 3.1 | WebGL policy: dynamic imports, one context/page, real pause, DPR cap, context-loss fallback, zero on checkout | L | performance |
| 3.2 | CSS split (retire sync-styles concat) | M | performance, maintainability |
| 3.3 | `next/font` migration (variable Sentient, woff2 Sansation, subset) | M | performance, readability |
| 3.4 | Image pass: hero double-fetch, `sizes` fixes, Sanity params, `public/` compression | M | performance |
| 3.5 | Dead deps removal + Stripe/PayPal decision + lodash modularization + analyzer wiring | S | performance, maintainability |
| 3.6 | Scrollbar rail re-engineering; pointer/rAF hygiene; marquee gating | M | performance |
| 3.7 | Lighthouse budget gate in CI (targets §11.9) | S | performance |

### P4 — Editorial polish (optional, after the above)
Page transitions (240 ms, shared); homepage carousel simplification (§3.1); express-checkout linked from campaigns; MTO product-page UI when the backend work lands; per-section kiln-journey anchoring; helper explainer for Sanity editors covering the orphaned schema types (10 of 15 registered types are never rendered — editors currently edit content into the void).

### Acceptance definition for V2.0
1. Zero customer-facing text below 12 px; zero text below AA contrast (automated: stylelint token rule + axe pass on the seven key routes).
2. Keyboard-only purchase possible start→finish; visible focus everywhere; forms fully labeled.
3. `prefers-reduced-motion` honored on every route; scroll never blocked.
4. Lighthouse mobile on mid-range hardware: LCP < 2.5 s, TBT < 200 ms, CLS < 0.1 — homepage, store, PDP, checkout.
5. No English, no placeholder data, no dead links, no inert forms anywhere a customer can reach.
6. One vocabulary per concept (availability, wishlist); one confirmation surface; consent recorded before payment.
7. The homepage still feels like Keramická zahrada — kiln journey, masked buttons, atelier calm — verified by the one test that matters: *a first-time 60-year-old visitor completes a purchase without asking anyone for help.*

---

*End of StorefrontDesignOptimization.md. Implementation may begin at P0; phases are ordered by customer impact per unit of risk, and nothing in P0–P3 alters the approved visual identity.*
