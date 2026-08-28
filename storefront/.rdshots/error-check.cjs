/* Is the red badge in the 2K capture a Next.js dev error indicator? Collect console errors,
   page errors, failed requests and the dev overlay's own state for each route. */
const { chromium } = require("playwright")

const BASE = process.env.RD_BASE || "http://localhost:8000"
const ROUTES = [
  "/cz/cookies",
  "/cz/smluvni-podminky",
  "/cz/reklamacni-protokol",
  "/cz/newsletter?stav=potvrzeno",
  "/cz/tahle-stranka-neexistuje",
]

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  for (const route of ROUTES) {
    const page = await context.newPage()
    const consoleErrors = []
    const pageErrors = []
    const failed = []

    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200))
    })
    page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)))
    page.on("requestfailed", (r) =>
      failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 100)}`)
    )

    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 60000 })
    await page.waitForTimeout(1500)

    const overlay = await page.evaluate(() => {
      const portal = document.querySelector("nextjs-portal")
      const badge = document.querySelector("[data-nextjs-dev-tools-button], #__next-build-watcher")
      return {
        hasPortal: !!portal,
        portalText: portal ? (portal.shadowRoot?.textContent || "").slice(0, 300) : "",
        hasBadge: !!badge,
      }
    })

    console.log(`\n--- ${route}`)
    console.log(`  console errors: ${consoleErrors.length}`)
    consoleErrors.slice(0, 5).forEach((e) => console.log(`      ${e}`))
    console.log(`  page errors:    ${pageErrors.length}`)
    pageErrors.slice(0, 3).forEach((e) => console.log(`      ${e}`))
    console.log(`  failed reqs:    ${failed.length}`)
    failed.slice(0, 3).forEach((e) => console.log(`      ${e}`))
    console.log(`  dev overlay:    portal=${overlay.hasPortal} badge=${overlay.hasBadge}`)
    if (overlay.portalText.trim()) {
      console.log(`      overlay text: ${overlay.portalText.replace(/\s+/g, " ").slice(0, 200)}`)
    }

    await page.close()
  }

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
