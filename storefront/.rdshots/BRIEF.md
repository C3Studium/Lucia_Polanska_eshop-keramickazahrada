# Responsive pass — shared brief

Read this before touching anything. It is the contract for every agent in this pass.

Working directory for all commands: `storefront/`.

---

## 1. What this pass covers

**In scope — the support and legal pages only.**

| Route | Owned by |
| --- | --- |
| `/cz/cookies` | `src/modules/legal/LegalDocument/` |
| `/cz/doprava-a-platba` | `src/modules/legal/LegalDocument/` |
| `/cz/ochrana-osobnich-udaju` | `src/modules/legal/LegalDocument/` |
| `/cz/odstoupeni-od-smlouvy` | `src/modules/legal/LegalDocument/` |
| `/cz/smluvni-podminky` | `src/modules/legal/LegalDocument/` |
| `/cz/reklamacni-protokol` | `LegalDocument/` + `(main)/reklamacni-protokol/download.*` |
| `/cz/newsletter` | `src/modules/order/components/order-state-shell/` |
| 404 | `src/app/[countryCode]/(main)/not-found.tsx` + `src/app/notfound.module.scss` |

**Explicitly out of scope. Do not edit these, and do not edit anything only they use.**

- The heavy pages, held back for a later pass: home `/`, `/store`, product pages,
  `/dotazy`, `/o-mne`, `/vyroba`, reviews.
- Cart, checkout, express-checkout, order pages.
- Account and auth pages.
- **Shared site chrome: `modules/layout/Navbar/**`, `modules/layout/Footer/**`,
  `CookieNotice`, `ShopBanner`, `scrollbar`.** These render on the support pages, and the
  baseline found real problems in them — but they also render on every excluded page. Record
  what you find in your report; do not fix it.

`src/styles/system/**` is owned by the lead, not by agents. If you believe a stop or mixin is
wrong, say so in your report instead of editing it.

---

## 2. The design system

`@use` is already injected into every component stylesheet by `scripts/sync-styles.js` — the
mixins below are available with no import line. Full reference: `storefront/GUIDE.md`,
definitions in `src/styles/system/`.

### Landscape stops — `@include h(key)`

Ordered as the cascade orders them. Later stops override earlier ones they overlap.

| Key | Query |
| --- | --- |
| `xxs` | `min-width: 400px` |
| `xs` | `min-width: 750px` |
| `sm` | `min-width: 900px` |
| `smt` | `min-width: 900px`, `max-width: 1399.98px`, `min-height: 720px` — tablet landscape |
| `md` | `min-width: 1200px` |
| `mdt` | `min-width: 1300px`, `max-width: 1399.98px`, `min-height: 950px` — large tablet landscape |
| `lg` | `min-width: 1400px` |
| `xl` | `min-width: 1500px` |
| `huge` | `min-width: 1730px` |
| **`qhd`** | **`min-width: 2200px` and `min-aspect-ratio: 16 / 9` — NEW, 2K/QHD desktop** |
| `phs` | `min-width: 480px`, `max-width: 1199.98px`, `max-height: 520px` — phone landscape |
| `phl` | `min-width: 800px`, `max-width: 1199.98px`, `max-height: 520px` — phone landscape, larger |
| `lt` | `min-width: 1200px`, `max-height: 800px` — short laptop (1220×660, 1366×768) |

### Portrait stops — `@include v(key)`

`xs: 320px`, `sm: 380px`, `s: 400px`, `md: 600px`, `lg: 1000px`.

### The API

```scss
.card {
  padding: 1rem;                          // base — smallest first

  @include hb((                           // several landscape stops at once
    xxs: (padding: 1rem, gap: 0.75rem),
    md:  (padding: 1.5rem),
    qhd: (padding: 3rem)
  ));

  @include vb((xs: (padding: 1rem), md: (padding: 1.5rem)));

  @include h(lt) { grid-template-columns: 2fr 1fr; }   // one stop, several rules
  @include v(md) { grid-template-columns: 1fr; }

  @include font(SBody);                   // responsive type token
  @include touch { ... }                  // no hover, coarse pointer
  @include fine-pointer { ... }           // mouse or trackpad
  @include reduced-fx { ... }             // see §3
}
```

Both `h()` and `v()` are **orientation-locked** — `h()` only ever matches landscape, `v()` only
portrait. That is the point of the system: a phone on its side is not a small desktop.

`below($key)` / `below-px($px)` emit plain `max-width` queries with no orientation. They exist to
carry legacy rules across unchanged. **Do not write new rules with them** — convert what you find
to `h()`/`v()`.

### Type tokens for `@include font()`

`transition`, `404`, `h1`–`h4`, `BCTA`, `SCTA`, `Nav`, `SBody`, `XSBody`, `MBody`, `SLinks`,
`legal`, `label`, `input`. Every one now carries a `qhd` rung. Prefer a token over a hand-written
`font-size` ladder — the token is already responsive at all fourteen stops.

---

## 3. Animation and effect budget

Shaders are now **off on every touch device**, and off on machines that fail a GPU capability
probe or are measured dropping frames. See `src/lib/util/shader-capability.ts` and
`src/lib/hooks/use-shaders-enabled.ts`. You do not need to change any of that.

What it gives you in CSS: the probe stamps `data-fx="full" | "reduced"` on `<html>`, and there
is a mixin for it.

```scss
.panel {
  backdrop-filter: blur(24px);            // the expensive default
  @include reduced-fx { backdrop-filter: none; background: var(--surface-solid); }
}
```

Use `reduced-fx` for **expensive** CSS only: `backdrop-filter`, large `filter: blur()`,
full-viewport gradient animation, anything on an infinite keyframe loop. Ordinary hover
transitions and short entrance animations are not what makes a thin machine stutter — leave them
alone; stripping them makes the site feel broken rather than cheap.

Write the expensive version as the default and the cheap one inside the block. The attribute is
absent during server render and until the probe resolves, so a rule gated the other way round
would flash on every load.

---

## 4. Viewport matrix

Every capture is checked against the stop it is expected to match, so a mislabelled viewport
cannot hide.

| id | size | expected stop | touch |
| --- | --- | --- | --- |
| `p-320x568` | 320×568 | `v-xs` | yes |
| `p-390x844` | 390×844 | `v-sm` | yes |
| `p-430x932` | 430×932 | `v-s` | yes |
| `p-768x1024` | 768×1024 | `v-md` | yes |
| `p-1024x1366` | 1024×1366 | `v-lg` | yes |
| `l-568x320` | 568×320 | `phs` | yes |
| `l-932x430` | 932×430 | `phl` | yes |
| `l-1024x768` | 1024×768 | `smt` | yes |
| `l-1366x1024` | 1366×1024 | `mdt` | yes |
| `l-1220x660` | 1220×660 | `lt` | no |
| `l-1366x768` | 1366×768 | `lt` | no |
| `l-1512x982` | 1512×982 | `xl` | no |
| `l-1920x1080` | 1920×1080 | `huge` | no |
| `l-2552x1351` | 2552×1351 | **`qhd`** | no |

---

## 5. How to verify — required

The dev server is already running on `http://localhost:8000`. Do not start another one.

```bash
# your routes only, so runs stay short
node .rdshots/shoot.cjs --routes cookies,smluvni-podminky --tag legal-after
```

Baseline captures and the machine-readable findings are already on disk:

- `.rdshots/out/baseline/<route>/<viewport>.png`
- `.rdshots/out/baseline-report.json`

Compare your `--tag` run against the baseline. **Look at the PNGs** — read them with the Read
tool, do not just trust the numbers. The report catches overflow, tiny text and small tap
targets; it cannot see a heading colliding with a rule, a two-column layout that should have
collapsed, or 2K whitespace that has gone slack.

Your run must end with:

- every viewport matching its expected stop,
- zero horizontal overflow on your routes,
- no *new* entries under tiny text or small tap targets versus baseline.

---

## 6. Rules for the work itself

1. **Smallest first.** Base rules are the smallest viewport; every stop above is an override.
   This is written at the top of `src/styles/system/index.scss` and it is not negotiable.
2. **Convert, do not add a parallel system.** Where a file uses raw `@media (max-width: …)` or
   `below-px()`, replace it with the orientation-aware stops. Do not leave both.
3. **`qhd` is not optional.** Every layout you touch needs a considered 2K state. A page that
   simply stretches its `huge` layout to 2552px reads as a scaled-up screenshot — measure it and
   decide: wider gutters, a longer measure, larger type, or a genuinely different column split.
   Type already scales through `@include font()`; spacing and grid columns do not.
4. **Phone landscape is a real case.** `phs` and `phl` are 320–430px *tall*. Anything relying on
   vertical room — a full-height hero, a sticky sidebar, `100vh` — needs an answer there.
5. **Touch needs 44px.** `globals.scss` sets a `min-height: 44px` floor for `button` and friends
   under `@include touch`, but **not for `<a>`**. If your component's links are small on touch,
   fix it in your own stylesheet.
6. Do not change copy, component structure, or behaviour unless the layout genuinely requires
   it. This is a responsive pass.
7. Czech text is long and compounds badly. Check that headings and buttons still fit at 320px.

---

## 7. What to report back

- Files changed, and what changed at which stops.
- Anything you found and deliberately did not fix, with the reason — especially in the shared
  chrome from §1, which is off limits but worth recording.
- Anything in `src/styles/system/**` you believe is wrong.
- Your verification run: the tag you used, and its result against the three conditions in §5.
