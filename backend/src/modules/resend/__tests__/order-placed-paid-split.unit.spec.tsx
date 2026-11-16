import { renderToStaticMarkup } from "react-dom/server"
import { orderPlacedEmail } from "../emails/order-placed"

/**
 * Potvrzení objednávky se zakázkou rozepíše platbu (16. 11. 2026, Matěj):
 * kolik se zaplatilo teď, z toho ostatní zboží (s balným a dopravou)
 * a záloha zakázky, kolik zbývá doplatit — vedle „Celkem" za objednávku.
 * Čísla objednávky #78: celkem 5 665, teď 2 440 (1 365 + záloha 1 075),
 * zbývá 3 225.
 */
const order = {
  id: "order_78",
  display_id: 78,
  email: "zakaznik@example.cz",
  currency_code: "czk",
  item_total: 5515,
  total: 5665,
  items: [
    { id: "li_1", product_title: "Keramická kytka", title: "Keramická kytka", quantity: 1, unit_price: 65, total: 65 },
    { id: "li_2", product_title: "Pán lesa — na zakázku", title: "Pán lesa", quantity: 1, unit_price: 4300, total: 4300, metadata: { made_to_order: true } },
  ],
  shipping_methods: [{ id: "sm_1", name: "Česká Pošta - Křehké", total: 150 }],
  shipping_address: { first_name: "Jana", last_name: "Nováková", address_1: "Rokycanova 1", postal_code: "39701", city: "Písek", country_code: "cz" },
}

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(orderPlacedEmail({ order, ...props } as any))
    .replace(/ | /g, " ")

describe("potvrzení objednávky — co se zaplatilo a za co", () => {
  it("u zakázky ukáže zaplaceno teď, rozpad a zbývá doplatit", () => {
    const html = render({ balance_due: 3225, balance_currency: "czk", paid_now: 2440, deposit_now: 1075 })
    expect(html).toContain("Zaplaceno teď")
    expect(html).toMatch(/2 440/)
    expect(html).toContain("z toho ostatní zboží, balné a doprava")
    expect(html).toMatch(/1 365/)
    expect(html).toContain("z toho záloha zakázky")
    expect(html).toMatch(/1 075/)
    expect(html).toContain("Zbývá doplatit")
    expect(html).toMatch(/3 225/)
    expect(html).toMatch(/5 665/)
  })

  it("čistá zakázka (teď jen záloha) — bez rozpadu na řádky", () => {
    const html = render({ balance_due: 3375, balance_currency: "czk", paid_now: 1125, deposit_now: 1125 })
    expect(html).toContain("Zaplaceno teď")
    expect(html).not.toContain("z toho ostatní zboží")
  })

  it("zaplaceno celé — žádné řádky o doplatku", () => {
    const html = render({ balance_due: 0, paid_now: 5665, deposit_now: 1075 })
    expect(html).not.toContain("Zaplaceno teď")
    expect(html).not.toContain("Zbývá doplatit")
  })
})
