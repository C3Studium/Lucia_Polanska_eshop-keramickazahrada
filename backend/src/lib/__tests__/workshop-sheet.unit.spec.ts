import { writeFileSync } from "node:fs"
import { workshopSheetData, workshopSheetFilename, type WorkshopSheet } from "../workshop-sheet/data"
import { generateWorkshopSheetPdf } from "../workshop-sheet/pdf"

/** Nezlomitelné mezery z formátu částek → obyčejné, ať se testy dobře čtou. */
const plain = (value: string) => value.replace(/ /g, " ")
const row = (rows: WorkshopSheet["payment"], label: string) =>
  plain(rows.find((entry) => entry.label === label)?.value ?? "")

const product = (metadata: Record<string, unknown> = {}) => ({ metadata })

const baseOrder = (overrides: Record<string, unknown> = {}) => ({
  id: "order_1",
  display_id: 123,
  email: "jana@example.cz",
  created_at: "2026-11-17T13:05:00.000Z",
  currency_code: "czk",
  total: 1299,
  metadata: {},
  shipping_address: {
    first_name: "Jana",
    last_name: "Nováková",
    address_1: "Dlouhá 12",
    postal_code: "110 00",
    city: "Praha 1",
    country_code: "cz",
    phone: "+420 600 000 000",
  },
  billing_address: {
    first_name: "Jana",
    last_name: "Nováková",
    address_1: "Dlouhá 12",
    postal_code: "110 00",
    city: "Praha 1",
    country_code: "cz",
  },
  shipping_methods: [{ name: "Česká pošta — Balík Do ruky", amount: 129, data: { service_code: "DR" } }],
  items: [
    {
      id: "item_vase",
      product_title: "Váza Luční",
      variant_title: "Modrá",
      variant_id: "var_vase",
      product_id: "prod_vase",
      quantity: 2,
      unit_price: 550,
      total: 1100,
      metadata: { ship_fragile: true, ship_class: "velke" },
      product: product({ frost_resistant: true }),
    },
    {
      id: "item_pack",
      title: "Balné — Váza Luční",
      quantity: 2,
      unit_price: 35,
      total: 70,
      variant_id: null,
      product_id: null,
      metadata: { packaging_fee: true, packaging_variant_id: "var_vase" },
    },
  ],
  payment_collections: [
    {
      amount: 1299,
      status: "authorized",
      metadata: {},
      payments: [{ amount: 1299, provider_id: "pp_comgate_comgate", canceled_at: null }],
      payment_sessions: [{ provider_id: "pp_comgate_comgate", status: "authorized" }],
    },
  ],
  ...overrides,
})

const commissionItem = {
  id: "item_sign",
  product_title: "Domovní znamení",
  variant_title: "Default variant",
  variant_id: "var_sign",
  product_id: "prod_sign",
  quantity: 2,
  unit_price: 1200,
  total: 2400,
  metadata: {
    made_to_order: {
      specification: "Kus 1: číslo 229\n\nKus 2: číslo 230",
      pieces: [
        { specification: "Číslo 229, modrá glazura", photos: ["https://img.example.cz/a.jpg"] },
        { specification: "Číslo 230, zelená", photos: [] },
      ],
    },
  },
  product: product({ made_to_order: true }),
}

const commissionOrder = (paid = 600) =>
  baseOrder({
    total: 2400,
    shipping_methods: [{ name: "Osobní odběr", amount: 0, data: { personal_pickup: true } }],
    items: [commissionItem],
    payment_collections: [
      {
        amount: paid,
        status: "authorized",
        metadata: {
          made_to_order: true,
          production_lines: [{ line_item_id: "item_sign", line_total: 2400, deposit_amount: paid }],
        },
        payments: [{ amount: paid, provider_id: "pp_comgate_comgate" }],
        payment_sessions: [{ provider_id: "pp_comgate_comgate", status: "authorized" }],
      },
      { amount: 2400 - paid, status: "not_paid", metadata: { made_to_order_balance: true }, payments: [] },
    ],
  })

describe("workshopSheetData — položky a zákazník", () => {
  it("lists goods with flags and the packaging line right under its product", () => {
    const sheet = workshopSheetData({ order: baseOrder() })
    expect(sheet.number).toBe("123")
    expect(sheet.items.map((item) => item.title)).toEqual(["Váza Luční", "Balné — Váza Luční"])
    expect(sheet.items[0]).toMatchObject({ quantity: "2", details: ["Modrá"], service: false })
    expect(plain(sheet.items[0].unit_price)).toBe("550 Kč")
    expect(plain(sheet.items[0].total)).toBe("1 100 Kč")
    expect(sheet.items[0].flags).toEqual(["Křehké", "Mrazuvzdorné", "Velká zásilka"])
    expect(sheet.items[1]).toMatchObject({ service: true, flags: [], details: [] })
    expect(sheet.commissions).toEqual([])
  })

  it("shows the Balíkovna point and a company with IČO/DIČ, never internal ids", () => {
    const sheet = workshopSheetData({
      order: baseOrder({
        metadata: {
          balikovna_point_name: "Praha 1 — Jindřišská",
          balikovna_point_address: "Jindřišská 14, Praha",
          balikovna_point_zip: "11000",
          balikovna_point_id: "pt_secret",
          firma_ico: "12345678",
          firma_dic: "CZ12345678",
        },
        shipping_address: { first_name: "Jana", last_name: "Nováková", company: "Hrnky s.r.o." },
        shipping_methods: [{ name: "Balíkovna", amount: 89, data: { id: "balikovna" } }],
      }),
    })
    const labels = sheet.customer.map((entry) => entry.label)
    expect(labels).toEqual(["Jméno", "E-mail", "Telefon", "Doprava", "Výdejna", "Fakturace"])
    const výdejna = sheet.customer.find((entry) => entry.label === "Výdejna")!.value
    expect(výdejna).toContain("Balíkovna Praha 1 — Jindřišská")
    expect(výdejna).not.toContain("pt_secret")
    expect(sheet.customer.find((entry) => entry.label === "Fakturace")!.value).toContain(
      "IČO 12345678 · DIČ CZ12345678"
    )
  })

  it("names the file objednavka-<číslo>-dilna.pdf", () => {
    expect(workshopSheetFilename(123)).toBe("objednavka-123-dilna.pdf")
  })
})

describe("workshopSheetData — platba", () => {
  it("paid online → Zaplaceno", () => {
    const sheet = workshopSheetData({ order: baseOrder() })
    expect(row(sheet.payment, "Způsob")).toBe("Online — karta nebo převod (ComGate)")
    expect(row(sheet.payment, "Stav")).toBe("Zaplaceno")
    expect(row(sheet.payment, "Celkem")).toBe("1 299 Kč")
  })

  it("dobírka → the carrier collects the whole total", () => {
    const sheet = workshopSheetData({
      order: baseOrder({
        payment_collections: [
          {
            amount: 1299,
            status: "authorized",
            payments: [{ amount: 1299, provider_id: "pp_dobirka_ceska-posta", captured_at: null }],
          },
        ],
      }),
    })
    expect(row(sheet.payment, "Způsob")).toBe("Dobírka")
    expect(row(sheet.payment, "Stav")).toBe("Dobírka — dopravce vybere 1 299 Kč")
  })

  it("pickup payment → pays at the counter until captured", () => {
    const collection = (captured_at: string | null) => ({
      amount: 1299,
      status: "authorized",
      payments: [{ amount: 1299, provider_id: "pp_osobni-odber_pickup", captured_at }],
    })
    expect(row(workshopSheetData({ order: baseOrder({ payment_collections: [collection(null)] }) }).payment, "Stav")).toBe(
      "Platí při vyzvednutí — 1 299 Kč"
    )
    expect(
      row(workshopSheetData({ order: baseOrder({ payment_collections: [collection("2026-11-18")] }) }).payment, "Stav")
    ).toBe("Zaplaceno")
  })

  it("nothing paid yet → Nezaplaceno", () => {
    const sheet = workshopSheetData({
      order: baseOrder({ payment_collections: [{ amount: 1299, status: "not_paid", payments: [] }] }),
    })
    expect(row(sheet.payment, "Stav")).toBe("Nezaplaceno — čeká na platbu")
  })

  it("carries the gift-voucher note when the order was paid by a voucher", () => {
    const sheet = workshopSheetData({ order: baseOrder(), voucher_note: "uhrazeno dárkovým poukazem ABC (500 Kč)" })
    expect(row(sheet.payment, "Poukaz")).toBe("Uhrazeno dárkovým poukazem ABC (500 Kč)")
  })
})

describe("workshopSheetData — zakázka", () => {
  it("before the commission rows exist: brief per piece, deposit and what is left", () => {
    const sheet = workshopSheetData({ order: commissionOrder(600) })
    expect(sheet.items[0].flags).toContain("Zakázka")
    expect(sheet.commissions).toHaveLength(1)
    const [commission] = sheet.commissions
    expect(commission.title).toBe("Domovní znamení · 2 ks")
    expect(commission.stage).toBe("Čeká na potvrzení zadání")
    expect(commission.pieces).toEqual([
      { label: "Kus 1", specification: "Číslo 229, modrá glazura", photos: ["https://img.example.cz/a.jpg"] },
      { label: "Kus 2", specification: "Číslo 230, zelená", photos: [] },
    ])
    expect(row(commission.money, "Záloha zaplacena")).toBe("600 Kč")
    expect(row(commission.money, "Zbývá doplatit")).toBe("1 800 Kč")
    expect(row(sheet.payment, "Stav")).toBe("Záloha 600 Kč zaplacena · zbývá doplatit 1 800 Kč")
  })

  it("with a commission row: its stage, internal note, surcharge and outstanding", () => {
    const sheet = workshopSheetData({
      order: commissionOrder(600),
      commissions: [
        {
          id: "po_1",
          line_item_id: "item_sign",
          line_title: "Domovní znamení",
          line_quantity: 2,
          stage: "in_production",
          line_total: 2400,
          original_total: 2400,
          surcharge: 300,
          internal_note: "Glazura z nové várky",
          currency_code: "czk",
          payment_requests: [{ type: "deposit", status: "paid", amount: 600 }],
        },
      ],
    })
    const [commission] = sheet.commissions
    expect(commission.stage).toBe("Ve výrobě")
    expect(commission.internal_note).toBe("Glazura z nové várky")
    expect(row(commission.money, "Cena zakázky")).toBe("2 400 Kč")
    expect(row(commission.money, "Příplatek")).toBe("300 Kč")
    expect(row(commission.money, "Zbývá doplatit")).toBe("2 100 Kč")
    expect(row(sheet.payment, "Stav")).toBe("Záloha 600 Kč zaplacena · zbývá doplatit 2 100 Kč")
  })

  it("an ordinary order has no commission section even with a product from the commission category", () => {
    const order = baseOrder()
    ;(order.items as any[])[0].product = { metadata: {}, categories: [{ handle: "zakazkova-vyroba" }] }
    const sheet = workshopSheetData({ order })
    expect(sheet.commissions).toEqual([])
    expect(sheet.items[0].flags).not.toContain("Zakázka")
  })
})

describe("generateWorkshopSheetPdf", () => {
  it("renders a PDF with Czech text, a long brief and characters the font lacks", async () => {
    const sheet = workshopSheetData({ order: commissionOrder(600) })
    sheet.commissions[0].pieces[0].specification = `${"Dlouhé zadání se žluťoučkým koněm. ".repeat(80)} 🎉`
    sheet.customer_note = "Prosím zabalit jako dárek — „děkuji“."
    const bytes = await generateWorkshopSheetPdf(sheet, { createdAt: new Date("2026-11-17T13:05:00Z") })
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-")
    expect(bytes.length).toBeGreaterThan(5000)

    // Vizuální kontrola: WORKSHOP_SHEET_RENDER_OUT=<cesta>.pdf zapíše zakázku i běžnou objednávku.
    const out = process.env.WORKSHOP_SHEET_RENDER_OUT
    if (out) {
      writeFileSync(out, bytes)
      const ordinary = workshopSheetData({
        order: baseOrder({
          metadata: { firma_ico: "12345678", firma_dic: "CZ12345678", firma_ulice: "Tovární 5", firma_psc: "397 01", firma_mesto: "Písek" },
          billing_address: { first_name: "Jana", last_name: "Nováková", company: "Hrnky s.r.o." },
        }),
      })
      writeFileSync(out.replace(/\.pdf$/i, "-bezna.pdf"), await generateWorkshopSheetPdf(ordinary))
    }
  })
})

/* Poznámka pro dílnu z adminu (19. 11. 2026) — do listu, zákazníkovi nikam. */
describe("workshopSheetData — poznámka pro dílnu", () => {
  it("reads order.metadata.admin_note and renders it into the PDF", async () => {
    const sheet = workshopSheetData({
      order: baseOrder({ metadata: { admin_note: "  Glazura modrá — zabalit dvakrát.  " } }),
    })
    expect(sheet.admin_note).toBe("Glazura modrá — zabalit dvakrát.")
    const bytes = await generateWorkshopSheetPdf(sheet)
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-")
    const out = process.env.WORKSHOP_SHEET_RENDER_OUT
    if (out) writeFileSync(out.replace(/\.pdf$/i, "-poznamka.pdf"), bytes)
  })

  it("is null without a note", () => {
    expect(workshopSheetData({ order: baseOrder() }).admin_note).toBeNull()
  })
})
