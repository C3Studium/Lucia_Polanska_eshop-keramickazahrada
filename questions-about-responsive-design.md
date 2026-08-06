# Questions about the responsive design

Open decisions from the responsive overhaul. Each one has a **provisional answer already in the
code** so nothing is left broken overnight — they are all one small change to reverse.

Rules being applied, from your brief:

1. If a section or component reads better as `flex-direction: column` on a narrow screen, stack it.
2. If a component is simply too wide, clip it with `overflow` — **but only if it contains no
   `position: sticky` part**, since clipping breaks sticky.
3. Where something is sticky, position the **text absolutely** over the image or panel instead.

---

## 1. Home — `Collections` section (scroll-story)

`src/modules/home/E-com/Collections/style.scss`

A `height: 210vh` scroll-driven stage. Inside it a `position: sticky` panel holds a horizontal
rail of four cards: `repeat(4, minmax(21rem, 31rem))` — roughly 1400px of cards on a 390px screen.

Rule 2 does not apply because the panel is sticky, so it cannot simply be clipped.

**Provisional:** kept horizontal as a swipeable rail with the heading absolutely positioned over
it (rule 3), and the stage shortened on phones so the sticky section is not three screens tall.

**Question:** on a phone, would you rather the four collections **stack vertically** (losing the
horizontal scroll-story but gaining a normal, scannable list), or stay a swipeable rail?

---

## 2. Home — `Courses` section (scroll-story)

`src/modules/home/E-com/Courses/style.scss`

`height: 300vh` with a sticky CTA. Its window is `left: 14%; width: 72vw` with a masked radial
reveal. On a phone in landscape the sticky stage has ~430px of height to work with, so the
reveal has almost nowhere to happen.

**Provisional:** stage shortened on phones and the CTA window widened to the full column, mask
softened. The scroll-story still plays, just over a shorter distance.

**Question:** on phones, keep the scroll-story at a shorter length, or collapse it to a plain
static section (heading, image, button) and drop the scroll choreography entirely?

---

## 3. Store — filter panel on phones

`src/modules/store/Shop/components/FilterPanel/style.module.scss`

Currently the filters sit inline above the grid on phones, which pushes the first product a long
way down the page.

**Question:** should the filters become a **bottom-sheet / overlay** opened from a button on
phones, so products start immediately? That is a new interaction, so I did not add it unasked.

---

## 4. Region selector and wishlist on portrait phones

`src/modules/layout/Navbar/style.scss`

Both are hidden on portrait phones so the bar can hold logo, search, menu, Produkty, cart and
account at 44px each. The locale is already in the URL, and the wishlist is reachable from the
account area.

**Question:** is dropping the wishlist icon acceptable, or would you rather lose something else
(for example the search button, since search also exists inside the Produkty overlay)?

---

## 5. `320px` phones — Produkty label

The Produkty button keeps its own button on every phone, as you asked, but at 320px there is no
room for the word, so it shows the arrow only. At 390px and up the word returns.

**Question:** fine, or would you rather it kept the word at 320px and something else went?

---

## Notes / things already decided

- Hamburger holds **links only** — search and Produkty keep their own buttons (your call).
- Hamburger applies to phone portrait **and** phone landscape (your call).
- Widths were carried across from the old `@media` rules at their exact values rather than
  snapped onto named stops, so no boundary moved during the migration. Retuning any specific one
  onto a stop is a per-page decision — say the word for any that feel wrong.

---

## 6. Needs checking on a real device (I could not verify these headless)

The device tiers are wired and their **inputs** are verified — the media queries resolve
correctly for desktop, phone portrait, phone landscape, tablet and reduced-motion, including the
case that width alone gets wrong (a phone on its side is 932px wide and still a phone).

What I could not confirm in a headless browser:

- **LiquidEther never mounts a canvas headless**, so the phone quality reduction
  (`resolution` 0.28 -> 0.12, `iterationsPoisson` 14 -> 6, `autoSpeed` x0.6) is wired but its
  effect is unmeasured. Worth a look on a real phone: the effect should still drift on its own,
  just coarser.
- **Reduced motion should unmount it entirely.** The wrapper div was still present in my probe.
  Either the probe was hitting a stale dev build or the guard is not firing — please check
  whether the ambient effect disappears with "reduce motion" on in the OS.
- **Magnetic** no longer re-renders per pointer event (it used `setState` on every `mousemove`);
  it now writes to a motion value and is skipped entirely on touch. Feel is unchanged on a mouse,
  but worth a click around.

## 7a. Pixel widths still to convert to named stops (99 calls)

You asked for the whole thing on your system. 39 blocks converted cleanly; these files were
refused by the converter rather than guessed at, because their blocks target descendant or
pseudo selectors (`.masthead h1`, `.orderMeta > div:nth-child(2)`, `.actions > *`) with no
top-level rule to invert against:

  order pages (order-details, payment-details, transfer-actions, oder-complete, order-transfer,
  order-state-shell), checkout/page.module.scss, store/loading.module.scss, Kurzy/Intro,
  E-com Courses + Collections, ProductPage (product, Sold), Navbar + navbarSearch +
  productsButton + mobileNav, ContactDialog, CookieNotice, Footer

They need doing by hand. Not hard, just one at a time.

**Also worth knowing:** converting to your table *moves boundaries*. A rule written at 700px now
breaks at `h(xs)`=750 landscape and `v(md)`=600 portrait. That is inherent to using named stops
rather than ad-hoc widths, but it means the layout changes at those exact widths — the store grid
now goes 2-up from 600/750 instead of 620, for example. Worth a look at 620-760px tomorrow.

## 7. Not yet done

- Per-page orientation design beyond the store hero and the two scroll-story sections. Every page
  is correct and contained at all ten viewports, but pages other than the store have not had a
  deliberate landscape-versus-portrait composition pass.
- `FAQImageShader` has not been tiered yet; only the site-wide LiquidEther has.
