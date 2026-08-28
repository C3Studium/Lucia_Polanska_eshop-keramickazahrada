/**
 * Is the desktop anchor miss a real bug, or an artifact of how the test clicks?
 *
 * `.rdshots/scroll-test.cjs` uses Playwright's `.click()`, which scrolls the target into view
 * before dispatching. That native scroll bypasses Lenis, which tracks its own scroll value — so
 * the test may be desyncing Lenis and then measuring the desync. A person clicking a chapter in
 * the sticky sidebar never triggers that, because the button is already on screen.
 *
 * This compares the two click paths against the same target on the same page:
 *   A. in-page el.click()      — no auto-scroll, what a person actually does
 *   B. Playwright .click()     — auto-scrolls first, what the failing test does
 */
const { chromium } = require("playwright")

const BASE = process.env.RD_BASE || "http://localhost:8000"

async function measure(page, mode) {
  await page.goto(`${BASE}/cz/cookies`, { waitUntil: "networkidle", timeout: 60000 })
  await page.waitForTimeout(1500)

  const target = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll("article section[id]")).map((e) => e.id)
    const el = document.getElementById(ids[5])
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
    return {
      id: ids[5],
      want: Math.round(el.getBoundingClientRect().top + window.scrollY - margin),
      startScrollY: Math.round(window.scrollY),
    }
  })

  if (mode === "in-page") {
    await page.evaluate(() => {
      const btn = document.querySelectorAll("aside ol li button")[5]
      btn.click()
    })
  } else {
    await page.locator("aside ol li button").nth(5).click()
  }

  await page.waitForTimeout(3000)

  const after = await page.evaluate((id) => {
    const el = document.getElementById(id)
    return {
      scrollY: Math.round(window.scrollY),
      landed: Math.round(el.getBoundingClientRect().top),
    }
  }, target.id)

  return { ...target, ...after }
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  console.log("\n=== desktop anchor: in-page click vs Playwright click ===\n")

  let realBug = false

  for (const mode of ["in-page", "playwright"]) {
    const r = await measure(page, mode)
    const ok = Math.abs(r.landed) < 200
    if (mode === "in-page" && !ok) realBug = true
    console.log(
      `  ${ok ? "ok  " : "FAIL"}  ${mode.padEnd(11)} want scrollY ${r.want}, got ${r.scrollY}, section landed ${r.landed}px from top`
    )
  }

  console.log(
    "\nVerdict: " +
      (realBug
        ? "REAL BUG — a plain in-page click also misses.\n"
        : "TEST ARTIFACT — a plain in-page click lands correctly; only Playwright's\n         auto-scroll (which desyncs Lenis) reproduces the miss. No user-facing bug.\n")
  )

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
