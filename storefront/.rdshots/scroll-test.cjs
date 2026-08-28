/**
 * Does anchor navigation still work now that Lenis is skipped on touch?
 *
 * The legal pages' chapter index calls scrollWithLenis(), which uses window.lenis when it exists
 * and a native scrollTo when it does not. Touch now takes the second path for the first time, so
 * this checks the thing that actually matters: tapping a chapter moves the page to it.
 *
 *   node .rdshots/scroll-test.cjs
 */

const { chromium } = require("playwright")

const BASE = process.env.RD_BASE || "http://localhost:8000"
const URL = `${BASE}/cz/cookies`

const CASES = [
  { name: "touch phone (no Lenis)", w: 390, h: 844, touch: true, wantLenis: false },
  { name: "touch tablet (no Lenis)", w: 768, h: 1024, touch: true, wantLenis: false },
  { name: "desktop (Lenis)", w: 1440, h: 900, touch: false, wantLenis: true },
]

async function main() {
  const browser = await chromium.launch()
  let failures = 0

  console.log("\n=== anchor scroll after skipping Lenis on touch ===\n")

  for (const c of CASES) {
    const context = await browser.newContext({
      viewport: { width: c.w, height: c.h },
      hasTouch: c.touch,
      isMobile: c.touch,
      locale: "cs-CZ",
    })
    const page = await context.newPage()

    await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 })
    await page.waitForTimeout(1200)

    const hasLenis = await page.evaluate(() => !!window.lenis)

    /* The chapter index is an <ol> of buttons; take a later one so the move is unmistakable. */
    const buttons = page.locator("aside ol li button")
    const count = await buttons.count()

    let scrolled = null
    let landedNearTarget = null

    if (count > 3) {
      const before = await page.evaluate(() => window.scrollY)

      /*
       * Dispatched in-page, NOT via Playwright's .click().
       *
       * Playwright scrolls a target into view before clicking. That native scroll bypasses Lenis,
       * which tracks its own scroll position, so the desktop case then lands ~770px short — and
       * the test reports a bug that only the test can produce. A person clicking a chapter never
       * triggers it: the button is already visible in the sticky sidebar. See FINDINGS.md §1.
       */
      const index = Math.min(5, count - 1)
      await page.evaluate((i) => {
        document.querySelectorAll("aside ol li button")[i].click()
      }, index)
      /* Native smooth scrolling is animated, so give it time to arrive. */
      await page.waitForTimeout(2500)
      const after = await page.evaluate(() => window.scrollY)
      scrolled = after - before

      /* And confirm it landed ON the section, not merely somewhere further down. */
      landedNearTarget = await page.evaluate(() => {
        const id = location.hash.slice(1)
        if (!id) return null
        const el = document.getElementById(id)
        if (!el) return null
        return Math.round(el.getBoundingClientRect().top)
      })
    }

    const lenisOk = hasLenis === c.wantLenis
    const movedOk = scrolled !== null && scrolled > 200
    /* Within a viewport-ish of the top: the section is on screen and at the top of it. */
    const landedOk =
      landedNearTarget !== null && Math.abs(landedNearTarget) < 200

    const ok = lenisOk && movedOk && landedOk
    if (!ok) failures += 1

    console.log(
      `${ok ? "  ok  " : "  FAIL"}  ${c.name}\n` +
        `        window.lenis present: ${hasLenis} (want ${c.wantLenis})\n` +
        `        chapter buttons found: ${count}\n` +
        `        scrolled: ${scrolled}px\n` +
        `        target offset from viewport top after scroll: ${landedNearTarget}px`
    )

    await context.close()
  }

  await browser.close()
  console.log(
    `\n${CASES.length - failures}/${CASES.length} passed` +
      (failures ? ` — ${failures} FAILED\n` : "\n")
  )
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
