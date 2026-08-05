import { chromium } from 'playwright'
const OUT = '/private/tmp/claude-501/-Users-matejforejt-Documents-GitHub-Lucia-Polanska-eshop-keramickazahrada/4907d453-11e2-48a7-8e81-0f872bce50af/scratchpad/shots'
const args = process.argv.slice(2)
const route = args[0], name = args[1], w = +args[2], h = +args[3], full = args[4] === 'full'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: w, height: h } })
await p.goto(`http://localhost:8000${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await p.waitForTimeout(3000)
// settle lazy content
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await p.waitForTimeout(1500)
await p.evaluate(() => window.scrollTo(0, 0))
await p.waitForTimeout(1500)
await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
console.log(`${OUT}/${name}.png`)
await b.close()
