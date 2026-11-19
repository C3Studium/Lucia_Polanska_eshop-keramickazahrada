import { buildMerchantOrderSummary } from "../merchant-order-summary"

const order = {
  id: "order_1",
  display_id: 87,
  created_at: "2026-11-19T18:30:00.000Z",
  email: "jana@example.com",
  currency_code: "eur",
  total: 47.3,
  shipping_total: 12.84,
  discount_total: 0,
  metadata: { firma_ico: "12345678", firma_dic: "CZ12345678" },
  shipping_address: { first_name: "Jana", last_name: "Nová", address_1: "Hlavná 1", postal_code: "811 01", city: "Bratislava", country_code: "sk", phone: "+421900000000" },
  billing_address: { first_name: "Jana", last_name: "Nová", company: "Firma s.r.o.", address_1: "Hlavná 1", postal_code: "811 01", city: "Bratislava", country_code: "sk" },
  shipping_methods: [{ name: "Česká pošta – Obchodní balík do zahraničí (do 3 kg)", amount: 12.84 }],
  payment_collections: [{ payments: [{ provider_id: "pp_comgate_comgate", captured_at: "2026-11-19T18:31:00Z" }] }],
  items: [
    { id: "i1", product_id: "p1", variant_id: "v1", product_title: "Keramická kytka", variant_title: "Bílá", quantity: 2, unit_price: 15, total: 30 },
    { id: "i2", product_id: null, variant_id: null, title: "Balné — Keramická kytka", quantity: 2, unit_price: 0.5, total: 1, metadata: { packaging_fee: true } },
    { id: "i3", product_id: "p2", variant_id: "v2", product_title: "Pítko", variant_title: "Standard", quantity: 1, unit_price: 3.46, total: 3.46 },
  ],
}

describe("celá objednávka v e-mailu majitelce", () => {
  const s = buildMerchantOrderSummary(order, "https://admin.keramickazahrada.cz/")

  it("položky bez balného, s variantou jen když něco říká", () => {
    expect(s.items.map((item) => item.label)).toEqual(["2× Keramická kytka · Bílá", "1× Pítko"])
    expect(s.items[0].total).toContain("30")
    expect(s.packaging).toContain("1")
    expect(s.service).toBeNull()
  })

  it("zákazník, doprava, adresy, firma, platba a odkaz do adminu", () => {
    expect(s.number).toBe("#87")
    expect(s.customer).toBe("Jana Nová")
    expect(s.contact).toBe("jana@example.com\n+421900000000")
    expect(s.shipping_method).toBe("Česká pošta – Obchodní balík do zahraničí (do 3 kg)")
    expect(s.shipping_address).toContain("Bratislava")
    expect(s.billing_address).toContain("Firma s.r.o.")
    expect(s.billing_address).toContain("IČO 12345678 · DIČ CZ12345678")
    expect(s.payment).toBe("Online platba (ComGate) — zaplaceno")
    expect(s.total).toContain("€")
    expect(s.admin_url).toBe("https://admin.keramickazahrada.cz/app/orders/order_1")
  })
})
