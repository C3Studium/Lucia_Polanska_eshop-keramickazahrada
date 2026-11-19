// Ceník Česká pošta do zahraničí z veřejné kalkulačky postaonline.cz/kalkulacka-postovneho.
// Pro každou zemi a každou váhu z kalkulačky zavolá týž dotaz jako tlačítko „Spočítat"
// (ostatní zásilky = balíky, bez pojištění) a uloží ceny všech nabízených produktů.
//   node stahni.mjs [vystup.json] [--countries=DE,AT]
import { writeFileSync, existsSync, readFileSync } from "node:fs"

const NS = "_calcsspconsignment_WAR_calcsspportlet_"
const B = "https://www.postaonline.cz/kalkulacka-postovneho?p_p_id=calcsspconsignment_WAR_calcsspportlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage&p_p_col_id=column-1&p_p_col_count=1&p_p_resource_id="
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
const H = { "user-agent": UA, "x-requested-with": "XMLHttpRequest", accept: "application/json" }
const OUT = process.argv.find((a, i) => i > 1 && !a.startsWith("--")) || "cp-ceny-zahranici.json"
const only = (process.argv.find((a) => a.startsWith("--countries=")) || "").split("=")[1]?.split(",")
const PARTIAL = OUT + ".partial"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(resource, params = "", tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(B + resource + params, { headers: H, signal: AbortSignal.timeout(30000) })
      if (r.ok) return await r.json()
    } catch {}
    await sleep(1000 * (i + 1))
  }
  throw new Error("GET " + resource + params)
}

async function price(country, weight, tries = 4) {
  const data = { type: 1, targetCountry: country, size: null, weight, insuranceAmount: 1, length: "", width: "", height: "", dimensions: "", weightUnits: "1", insurance: "0", confirmation: true, hasCustomerCard: false, nonStandard: false, eData: false, dimensionsUnits: "1" }
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(B + "consignments&" + NS + "data=" + encodeURIComponent(JSON.stringify(data)), { method: "POST", headers: { ...H, "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(30000) })
      const j = await r.json()
      if (r.ok) return j
      if (j?.error?.[0]?.value?.includes("neodpovídá")) return { parcelProducts: [], expressProducts: [] }
    } catch {}
    await sleep(1500 * (i + 1))
  }
  return null
}

const countries = await get("countries")
delete countries.CZ
const codes = Object.keys(countries).filter((c) => !only || only.includes(c))
const state = existsSync(PARTIAL) ? JSON.parse(readFileSync(PARTIAL, "utf8")) : {}
const failed = []
let done = 0

async function country(code) {
  if (state[code]?.complete) return
  const weights = Object.keys(await get("weights", `&${NS}targetCountry=${code}&${NS}type=1`)).sort((a, b) => a - b)
  const products = {}
  for (const w of weights) {
    const j = await price(code, w)
    if (!j) { failed.push(`${code} ${w}`); continue }
    for (const p of [...(j.parcelProducts || []), ...(j.expressProducts || [])]) {
      const name = p.productName
      products[name] ??= { productId: p.productId, transactionCode: p.transactionCode, url: p.linkUrl, prices: [] }
      products[name].prices.push({ upToKg: Number(w), priceWithVat: p.roundedPriceWithVat, priceWithoutVat: p.roundedPriceWithoutVat })
    }
    await sleep(150)
  }
  state[code] = { name: countries[code], weightsOffered: weights.map(Number), products, complete: true }
  done++
  if (done % 5 === 0) {
    writeFileSync(PARTIAL, JSON.stringify(state))
    console.log(`${done}/${codes.length} zemí (${code})`)
  }
}

const queue = [...codes]
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await country(queue.shift()) }))
writeFileSync(PARTIAL, JSON.stringify(state))

const out = {
  source: "https://www.postaonline.cz/kalkulacka-postovneho",
  fetchedAt: new Date().toISOString(),
  currency: "CZK",
  note: "Ceny z veřejné kalkulačky České pošty (orientační, ceník pro veřejnost, ne smluvní). Balík bez pojištění, bez doplňkových služeb; upToKg = cena pro hmotnost do této hodnoty. Obchodní balík do zahraničí je s DPH 21 %, ostatní mezinárodní služby jsou od DPH osvobozené.",
  query: { type: "1 (ostatní zásilky)", insurance: "0 (bez pojištění)", confirmation: true, eData: false },
  failed,
  countries: Object.fromEntries(codes.filter((c) => state[c]).map((c) => [c, state[c]]).map(([c, v]) => [c, { name: v.name, weightsOffered: v.weightsOffered, products: v.products }])),
}
writeFileSync(OUT, JSON.stringify(out, null, 2))
console.log(`hotovo: ${Object.keys(out.countries).length} zemí, selhalo ${failed.length} dotazů → ${OUT}`)
