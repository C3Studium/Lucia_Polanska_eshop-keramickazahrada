import { test } from "node:test"
import assert from "node:assert/strict"
import { productJsonLd } from "../product-jsonld"

const BASE = "https://keramickazahrada.cz"

const variant = (over: Record<string, unknown> = {}) => ({
  id: "v1",
  sku: "04",
  manage_inventory: true,
  allow_backorder: false,
  inventory_quantity: 3,
  calculated_price: { calculated_amount: 1200, original_amount: 1200, currency_code: "czk" },
  ...over,
})

const product = (over: Record<string, unknown> = {}) =>
  ({
    id: "prod_1",
    handle: "zvonkove-tlacitko-vazka",
    title: "Zvonkové tlačítko Vážka",
    description: "<p>Mrazuvzdorné,&nbsp;průměr 10,5 cm.</p>",
    thumbnail: "https://img.example/a.jpg",
    images: [{ url: "https://img.example/a.jpg" }, { url: "https://img.example/b.jpg" }],
    metadata: {},
    variants: [variant()],
    ...over,
  }) as any

const graph = (ld: Record<string, any>) => ld["@graph"] as Record<string, any>[]
const productNode = (ld: Record<string, any>) => graph(ld).find((n) => n["@type"] === "Product")!

test("výrobek skladem: cena, měna, Skladem, obrázky, adresa", () => {
  const ld = productJsonLd({ product: product(), countryCode: "cz", currencyCode: "czk", baseUrl: BASE })!
  const p = productNode(ld)
  assert.equal(p.name, "Zvonkové tlačítko Vážka")
  assert.equal(p.description, "Mrazuvzdorné, průměr 10,5 cm.")
  assert.deepEqual(p.image, ["https://img.example/a.jpg", "https://img.example/b.jpg"])
  assert.equal(p.url, `${BASE}/cz/products/zvonkove-tlacitko-vazka`)
  assert.equal(p.sku, "04")
  assert.equal(p.offers["@type"], "Offer")
  assert.equal(p.offers.price, "1200.00")
  assert.equal(p.offers.priceCurrency, "CZK")
  assert.equal(p.offers.availability, "https://schema.org/InStock")
  assert.equal(p.offers.itemCondition, "https://schema.org/NewCondition")
  assert.equal(p.offers.hasMerchantReturnPolicy.merchantReturnDays, 14)
  assert.equal(
    p.offers.hasMerchantReturnPolicy.returnFees,
    "https://schema.org/ReturnFeesCustomerResponsibility"
  )
})

test("dostupnost jako v obchodě: poslední kus, dorobíme, nepočítaný sklad, prodáno", () => {
  const avail = (v: Record<string, unknown>) =>
    productNode(
      productJsonLd({ product: product({ variants: [variant(v)] }), countryCode: "cz", currencyCode: "czk", baseUrl: BASE })!
    ).offers.availability
  assert.equal(avail({ inventory_quantity: 1 }), "https://schema.org/InStock")
  assert.equal(avail({ inventory_quantity: 0, allow_backorder: true }), "https://schema.org/BackOrder")
  assert.equal(avail({ manage_inventory: false }), "https://schema.org/MadeToOrder")
  assert.equal(avail({ inventory_quantity: 0 }), "https://schema.org/OutOfStock")
})

test("víc variant s různou cenou = rozpětí; zlevněná cena je ta, kterou zákazník zaplatí", () => {
  const ld = productJsonLd({
    product: product({
      variants: [
        variant({ id: "a", calculated_price: { calculated_amount: 450, original_amount: 500 } }),
        variant({ id: "b", inventory_quantity: 0, calculated_price: { calculated_amount: 890, original_amount: 890 } }),
      ],
    }),
    countryCode: "cz",
    currencyCode: "czk",
    baseUrl: BASE,
  })!
  const o = productNode(ld).offers
  assert.equal(o["@type"], "AggregateOffer")
  assert.equal(o.lowPrice, "450.00")
  assert.equal(o.highPrice, "890.00")
  assert.equal(o.offerCount, 2)
  assert.equal(o.availability, "https://schema.org/InStock")
})

test("zakázka se nevrací; hodnocení jen když nějaké je; drobečky s kategorií", () => {
  const ld = productJsonLd({
    product: product({ metadata: { made_to_order: true } }),
    countryCode: "cz",
    currencyCode: "czk",
    baseUrl: BASE,
    category: { name: "Zvonková tlačítka", handle: "zvonková-tlačítka" },
    rating: { average: 4.75, count: 4 },
  })!
  const p = productNode(ld)
  assert.equal(
    p.offers.hasMerchantReturnPolicy.returnPolicyCategory,
    "https://schema.org/MerchantReturnNotPermitted"
  )
  assert.deepEqual(p.aggregateRating, { "@type": "AggregateRating", ratingValue: 4.75, reviewCount: 4, bestRating: 5, worstRating: 1 })
  const crumbs = graph(ld).find((n) => n["@type"] === "BreadcrumbList")!.itemListElement
  assert.deepEqual(crumbs.map((c: any) => c.name), ["Keramická zahrada", "Obchod", "Zvonková tlačítka", "Zvonkové tlačítko Vážka"])
  assert.equal(crumbs[2].item, encodeURI(`${BASE}/cz/categories/zvonková-tlačítka`))

  const none = productNode(productJsonLd({ product: product(), countryCode: "cz", currencyCode: "czk", baseUrl: BASE, rating: { average: 0, count: 0 } })!)
  assert.equal(none.aggregateRating, undefined)
})

test("bez ceny (cena po domluvě) se nabídka nevydává, výrobek bez hodnocení pak nic", () => {
  const free = product({ variants: [variant({ calculated_price: { calculated_amount: 0 } })] })
  assert.equal(productJsonLd({ product: free, countryCode: "cz", currencyCode: "czk", baseUrl: BASE }), null)
  const rated = productJsonLd({ product: free, countryCode: "cz", currencyCode: "czk", baseUrl: BASE, rating: { average: 5, count: 2 } })!
  assert.equal(productNode(rated).offers, undefined)
})

test("JSON se dá bezpečně vložit do <script>", async () => {
  const { jsonLdScript } = await import("../product-jsonld")
  assert.equal(jsonLdScript({ a: "</script><b>" }).includes("</script>"), false)
})

test("relativní obrázek dostane doménu obchodu", () => {
  const ld = productJsonLd({
    product: product({ images: [{ url: "/assets/img/1.jpg" }] }),
    countryCode: "cz",
    currencyCode: "czk",
    baseUrl: BASE,
  })!
  assert.deepEqual(productNode(ld).image, [`${BASE}/assets/img/1.jpg`])
})

test("fotka pro vyhledávače z adminu jde první; náhled odkazu ji použije", async () => {
  const { seoImageOf } = await import("../product-jsonld")
  const chosen = product({ metadata: { seo_image: "https://img.example/b.jpg" } })
  assert.deepEqual(productNode(productJsonLd({ product: chosen, countryCode: "cz", currencyCode: "czk", baseUrl: BASE })!).image, [
    "https://img.example/b.jpg",
    "https://img.example/a.jpg",
  ])
  assert.equal(seoImageOf(chosen), "https://img.example/b.jpg")
  // bez volby = náhled kusu
  assert.equal(seoImageOf(product()), "https://img.example/a.jpg")
})

test("vybraná fotka, která už u výrobku není, se ignoruje", async () => {
  const { seoImageOf } = await import("../product-jsonld")
  const stale = product({ metadata: { seo_image: "https://img.example/smazana.jpg" } })
  assert.equal(seoImageOf(stale), "https://img.example/a.jpg")
  assert.deepEqual(productNode(productJsonLd({ product: stale, countryCode: "cz", currencyCode: "czk", baseUrl: BASE })!).image, [
    "https://img.example/a.jpg",
    "https://img.example/b.jpg",
  ])
})
