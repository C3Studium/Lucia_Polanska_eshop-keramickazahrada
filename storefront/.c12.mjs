import { chromium } from "playwright"
const OUT = process.env.SHOT
setTimeout(() => process.exit(2), 290000)
const b = await chromium.launch()
const errs = []
const check = async (p, tag, panelExpectFull) => {
  await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Přidat do košíku/i.test(x.textContent || "")); b?.scrollIntoView({ block: "center" }); b?.click() })
  await p.waitForFunction(() => [...document.querySelectorAll("[class*='popoverPanel']")].some((e) => e.getBoundingClientRect().width > 10), { timeout: 30000 })
  await p.waitForTimeout(800)
  const m = await p.evaluate(() => {
    const panel = [...document.querySelectorAll("[class*='popoverPanel']")].map((e) => ({ e, r: e.getBoundingClientRect() })).find((x) => x.r.width > 10)
    const el = panel.e
    const btn = el.querySelector("[class*='goToCartBtn'] button")
    const para = btn.querySelector("p")
    const cs = getComputedStyle(para); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2
    const item = el.querySelector("[class*='cartItem']")
    const price = el.querySelector("[class*='itemPrice']")
    return { panelW: Math.round(panel.r.width),
      btn: `${Math.round(btn.getBoundingClientRect().width)}x${Math.round(btn.getBoundingClientRect().height)}`,
      labelLines: Math.round(para.getBoundingClientRect().height / lh),
      labelFits: para.getBoundingClientRect().height <= btn.getBoundingClientRect().height,
      rowOver: Math.round(item.getBoundingClientRect().right - panel.r.right),
      priceIn: Math.round(price.getBoundingClientRect().right) <= Math.round(panel.r.right) }
  })
  console.log(`${tag}: panel=${m.panelW} tlačítko=${m.btn} popisek ${m.labelLines}ř vejde se=${m.labelFits} | řádek přetéká=${m.rowOver} cena v panelu=${m.priceIn}`)
}
for (const [w, h, tag, touch] of [[768, 1024, "tablet", false], [1440, 900, "desktop", false]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  p.on("pageerror", (e) => errs.push(`${tag}: ${e.message.slice(0, 110)}`))
  await p.goto("http://localhost:8000/cz/products/keramicke-zahradni-pitko-s-ptacky", { waitUntil: "domcontentloaded", timeout: 240000 })
  await p.waitForTimeout(6000)
  await check(p, tag)
  await p.screenshot({ path: `${OUT}/C12-${tag}.png` })
  await p.close()
}
for (const [w, h, tag] of [[390, 844, "telefon390"], [430, 932, "telefon430"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true })
  const p = await ctx.newPage()
  p.on("pageerror", (e) => errs.push(`${tag}: ${e.message.slice(0, 110)}`))
  await p.goto("http://localhost:8000/cz/products/keramicke-zahradni-pitko-s-ptacky", { waitUntil: "domcontentloaded", timeout: 240000 })
  await p.waitForTimeout(6500)
  await check(p, tag)
  await p.close(); await ctx.close()
}
await b.close()
console.log(errs.length ? "ERRORS: " + errs.join(" | ") : "clean")
process.exit(0)
