import { orderPlacedEmail } from "../emails/order-placed"
import { hlavickyNeorezavat, neorezavatHtml, vykresliEmail as render } from "../neorezavat"

/**
 * E-mail vždy celý (19. 11. 2026): dvě potvrzení téže objednávky nesmí mít
 * jediný shodný textový blok — jinak je Gmail schová do „•••".
 */
const order = {
  id: "order_86",
  display_id: 86,
  email: "zakaznik@example.cz",
  currency_code: "czk",
  item_total: 42,
  total: 42,
  items: [
    { id: "li_1", product_title: "Pomněnka - různé barvy", title: "Standardní", quantity: 1, unit_price: 40, total: 40 },
  ],
  shipping_methods: [{ id: "sm_1", name: "Osobní odběr", total: 0 }],
  shipping_address: { first_name: "Matěj", last_name: "Test", address_1: "Putim 229", postal_code: "39701", city: "Putim", country_code: "cz" },
}

const bloky = (html: string) =>
  (html.match(/<(p|h[1-6]|td)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? []).filter(
    (b) => b.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "").length > 0 && !/<(table|td)\b/i.test(b.slice(3))
  )

describe("e-mail vždy celý — žádné tři tečky v Gmailu", () => {
  it("dvě odeslání téhož e-mailu nemají žádný shodný textový blok", async () => {
    const html = await render(orderPlacedEmail({ order } as any))
    const a = bloky(neorezavatHtml(html, "aaaaa"))
    const b = new Set(bloky(neorezavatHtml(html, "bbbbb")))
    expect(a.length).toBeGreaterThan(5)
    expect(a.filter((blok) => b.has(blok))).toEqual([])
  })

  it("značka je skrytá a e-mail zůstane pod Gmailovým limitem 102 kB", async () => {
    const html = await render(orderPlacedEmail({ order } as any))
    const upraveny = neorezavatHtml(html, "abcde")
    expect(upraveny).toContain('style="display:none!important;mso-hide:all')
    expect(Buffer.byteLength(upraveny)).toBeLessThan(100 * 1024)
    // Viditelný text se nezměnil.
    const viditelny = (s: string) =>
      s.replace(/<span style="display:none!important[^"]*">[^<]*<\/span>/g, "").replace(/<[^>]*>/g, "")
    expect(viditelny(upraveny)).toBe(viditelny(html))
  })

  it("prázdné buňky a rozpěrky značku nedostanou", () => {
    expect(neorezavatHtml("<table><tr><td></td><td>&nbsp;</td><td><img src=x></td></tr></table>", "t")).not.toContain("display:none")
  })

  it("hlavička X-Entity-Ref-ID je pokaždé jiná", () => {
    expect(hlavickyNeorezavat("a")["X-Entity-Ref-ID"]).not.toBe(hlavickyNeorezavat("b")["X-Entity-Ref-ID"])
  })
})
