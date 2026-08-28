# Findings from the responsive pass

Things the verification rig surfaced that are **not** responsive-layout work, with the evidence
behind each. Two of them turned out to be defects in the rig itself.

---

## 1. Anchor navigation "lands 770px short" on desktop · NOT A BUG — test artifact

**Claimed:** clicking the 6th chapter in the legal pages' index left the section 890px below the
top of the viewport instead of at its 120px `scroll-margin-top`. Deterministic across runs.

Three hypotheses were ruled out by measurement rather than argument:

| Hypothesis | Measurement | Verdict |
| --- | --- | --- |
| `offsetParent` skew from a positioned ancestor | `offsetTop` 3224 vs `absoluteTop` 3248 | ruled out |
| Stale Lenis scroll limit | `lenis.limit` 5410 == real limit 5410 | ruled out |
| The `easing` / `immediate` / `onComplete` options | all five combinations land correctly | ruled out |

**The cause was the test.** `scroll-test.cjs` used Playwright's `.click()`, which scrolls the
target into view before dispatching. That native scroll bypasses Lenis, which tracks its own
scroll value, so the test desynced Lenis and then measured the desync.

`anchor-real.cjs` compares the two click paths against the same target:

```
ok    in-page     want scrollY 3130, got 3130, section landed  96px from top
FAIL  playwright  want scrollY 3130, got 2359, section landed 891px from top
```

A person clicking a chapter never triggers the auto-scroll — the button is already on screen in
the sticky sidebar. **No user-facing bug, and no fix shipped.** A speculative "fix" to
`scrollWithLenis` would have changed a shared helper to chase a defect that does not exist.

---

## 2. The baseline's footer tap-target numbers were measured before webfonts loaded · RIG BUG, FIXED

The baseline recorded the footer's links at **44px and 45px**; every later run measured **41px**,
which reads as a 640-occurrence regression appearing mid-pass. Two agents and the lead all spent
time on it, and a peer session was asked about it.

**Nobody caused it.** Controlled A/B: the working stylesheet was backed up, replaced with the
committed `HEAD` version, re-measured, and restored byte-identically.

```
working tree (+287 uncommitted lines)  ->  41px
committed HEAD version                 ->  41px
```

41px is simply what the code produces. The baseline was the outlier, because `shoot.cjs` shot
before `document.fonts.ready` — so it measured fallback font metrics on a cold server. The tell
was there in the baseline all along: **two different heights, 44px and 45px, for one element.**
Real CSS does not do that; a font-loading race does.

Fixed by awaiting `document.fonts.ready` before measuring. Re-runs are now stable.

The lesson for the next pass: a baseline taken against a cold dev server is not trustworthy for
anything measured in pixels.

---

## 3. `data-fx` was never stamped outside the (main) layout · FIXED

The effect-budget attribute was a side effect of `GlobalLiquidEther` asking whether it could run,
so it only landed on pages containing a shader. The root 404 renders outside `(main)` and had no
ambient canvas, so it shipped with the attribute absent and every `@include reduced-fx` rule on it
was dead.

Caught by the rig reporting `(unset)` for exactly 14 captures — one route × 14 viewports.

Fixed by mounting `EffectBudgetFlag` in the root layout and splitting `resolveVerdict()` (probe +
stamp, idempotent) from the frame-rate watchdog, which still starts only where a real shader
mounts — otherwise it would time a page with nothing on it, conclude the machine is fine, and stop
before the shader it was meant to judge ever appeared.

---

## 4. Lenis ran a permanent rAF loop on touch for nothing · FIXED

`LenisProvider` initialised on every device. Without `syncTouch` — not set, deliberately — Lenis
does not smooth touch scrolling at all, so on a phone it kept a `requestAnimationFrame` loop alive
for the life of the page to animate nothing.

Now skipped on `(hover: none) and (pointer: coarse)`. Anchor navigation still works there via the
native fallback already present in `scrollWithLenis` — verified landing at 96–126px on both a
390×844 phone and a 768×1024 tablet.

---

## 5. `_typography.scss` named fonts the site does not load · FIXED

Every token declared `Helvetica` / `Inter` / `Arimo`. The site loads Sentient, Sansation and Oooh
Baby, and nothing else. So `@include font()` silently swapped the brand face for a system
fallback — which is why the scale had **zero call sites anywhere in the codebase** and every
component hand-wrote its own ladder beside it. Both agents hit it independently and worked around
it before either could report it.

Fixed, and because there were no call sites, nothing rendered differently:

- families corrected to Sentient (display) / Sansation (UI + body)
- new `font-size($token)`, the ladder without the face, for components owning their own type
- `phs` / `phl` / `lt` rungs added for the display tokens — a phone at 932×430 matched the 900px
  `sm` rung and rendered an `h1` at **80px on a 430px-tall screen**; it is now 48px
- sub-12px values (0.65rem = 10.4px, 0.7rem = 11.2px) raised to globals' own documented 0.75rem
  floor, in `XSBody`, `SLinks` and `legal`
- two inversions corrected in `h2`, where `sm` (3.5rem) sat above `md` (3rem) and `mdt` (4.5rem)
  above `lg` (4rem)

---

## 6. Above 1921px, a page that paints no background is a black void · PARTIALLY FIXED

`globals.scss` caps the page to a 16:10 frame past 1921px and paints `body: #141513` as the band
beside it. `.pageFrame` is transparent, so any page without its own background renders as
near-black at 2K. The root 404 was exactly that — unreadable at 2552×1351.

Fixed for both 404s by the agent that found it. **Not fixed globally**: `.pageFrame` could paint
`var(--bgWhite)` as a safety net, but that is a global change affecting the held-back pages, so it
needs a decision.

Related and worth knowing for any 2K work: at 2552×1351 the content frame is **2161px**, not 2552
(`min(100vw, 100svh * 1.6)`). The `qhd` stop still partitions cleanly — `huge` covers frames of
roughly 1728–1979px and `qhd` 1980px and up — but a component styled at `qhd` is laying out in
~2161px, not the viewport width.

---

## 7. Tap targets and type sizes in the shared chrome · OUT OF SCOPE, NOT FIXED

Ruled off-limits because navbar / footer / cookie-notice also render on the home page, store and
product pages, which are being held back. All of it is pre-existing. Occurrences across the final
126-capture run:

| Element | Size | Component |
| --- | --- | --- |
| `footer__animatedLink` | 41px tall | Footer |
| `maker__link` ("ValeStudium") | 76×15 | Footer |
| `style_link__KK6Z2` ("Více o cookies") | 93×16 | CookieNotice |
| nav links / E-shop pill | 38px / 35px | Navbar |
| `dt` labels | 11px | Footer |
| `p.style_cartCount` | 10px | Navbar |

`globals.scss` applies the 44px touch floor to `button`, `[role="button"]` and submit inputs —
deliberately **not** to `<a>`, so inline text links keep their natural line box. Every offender
above is an `<a>`, `<dt>` or `<span>`, which is exactly why none are caught. Confirmed directly:
the footer link computes `min-height: auto`.

Also recorded, pre-existing and not responsive work: `doprava-a-platba` has 26 chapters and the
sticky index clips at ~20 with no scroll affordance; the CookieNotice covers most of a 568×320
viewport on first visit.

---

## 8. Sass `mixed-decls` deprecation · PRE-EXISTING, NOT FROM THIS PASS

25 warnings across 5 files: `ContactDialog`, `Footer/style.scss`, `scrollbar`, `omne/main`,
`globals.scss`. They originate in `_mixins.scss` emitting a nested media query, so any plain
declaration written after an `@include` in the same rule triggers it. **None** of the files this
pass touched produce a warning — the agents wrapped trailing declarations in `& { }`, and that
workaround is now documented in the `font()` mixin comment.

Whole-project check: `node .rdshots/compile-all.cjs` → **175/176 stylesheets compile.** The one
failure is `globals.scss`, which needs `node_modules` on the Sass load path for
`@use "tailwindcss/base"` — a limitation of the standalone harness, not of the build. Next
compiles it, and the site renders.
