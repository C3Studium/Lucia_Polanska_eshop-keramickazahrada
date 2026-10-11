import {
  czechIban,
  parseRefundAccount,
  REFUND_ACCOUNT_CHECKSUM,
  REFUND_ACCOUNT_INVALID,
  REFUND_ACCOUNT_REQUIRED,
  refundAccountNeeded,
  refundAccountRequiredFor,
  storedRefundAccount,
} from "../claims/refund-account"
import {
  priceRefundLines,
  REFUND_SHIPPING_CLAIM,
  refundAllLines,
  shippingRefundAllowedFor,
  shippingStateOf,
} from "../claims/refund-lines"
import { checkClaimRules } from "../claims/intake"
import { manualTransferText } from "../claims/refund-action"
import { refundMethodLabel } from "../claims/admin"

/**
 * Vrácení peněz (11. 10. 2026): účet pro převod u nekartových objednávek a
 * „reklamace = jen výrobky, jinak celá objednávka".
 */

describe("parseRefundAccount — český účet a IBAN", () => {
  it("přijme platný český účet s předčíslím a dopočítá IBAN", () => {
    const verdict = parseRefundAccount(" 19-2000145399 / 0800 ")
    expect(verdict).toEqual({
      ok: true,
      account: { display: "19-2000145399/0800", iban: "CZ6508000000192000145399" },
    })
  })

  it("odmítne překlep (modulo 11)", () => {
    expect(parseRefundAccount("19-2000145398/0800")).toEqual({
      ok: false,
      message: REFUND_ACCOUNT_CHECKSUM,
    })
  })

  it("odmítne nesmysl a vrátí null pro prázdný vstup", () => {
    expect(parseRefundAccount("abc")).toEqual({ ok: false, message: REFUND_ACCOUNT_INVALID })
    expect(parseRefundAccount("   ")).toBeNull()
    expect(parseRefundAccount(null)).toBeNull()
  })

  it("český IBAN ukáže domácím zápisem, cizí IBAN po čtveřicích", () => {
    expect(parseRefundAccount("CZ65 0800 0000 1920 0014 5399")).toEqual({
      ok: true,
      account: { display: "19-2000145399/0800", iban: "CZ6508000000192000145399" },
    })
    expect(parseRefundAccount("sk31 1200 0000 1987 4263 7541")).toEqual({
      ok: true,
      account: { display: "SK31 1200 0000 1987 4263 7541", iban: "SK3112000000198742637541" },
    })
    expect(parseRefundAccount("CZ6608000000192000145399")).toEqual({
      ok: false,
      message: REFUND_ACCOUNT_CHECKSUM,
    })
  })

  it("czechIban je idempotentní s uloženým zápisem", () => {
    expect(czechIban("19", "2000145399", "0800")).toBe("CZ6508000000192000145399")
    expect(storedRefundAccount("19-2000145399/0800")?.iban).toBe("CZ6508000000192000145399")
    expect(storedRefundAccount("nesmysl")).toBeNull()
  })
})

const card = { provider_id: "pp_comgate_comgate", amount: 1000, captured_at: "2026-10-01" }
const dobirka = { provider_id: "pp_dobirka_ceska", amount: 1000, captured_at: null }
const shipped = [{ shipped_at: "2026-10-02", canceled_at: null }]

describe("refundAccountNeeded — kdy formulář chce účet", () => {
  it("kartou placená objednávka účet nepotřebuje", () => {
    expect(refundAccountNeeded({ payment_collections: [{ payments: [card] }], fulfillments: shipped } as any)).toBe(false)
  })

  it("dobírka po odeslání účet potřebuje (i jen autorizovaná)", () => {
    expect(refundAccountNeeded({ payment_collections: [{ payments: [dobirka] }], fulfillments: shipped } as any)).toBe(true)
  })

  it("nezaplacená a neodeslaná objednávka ne (odstoupení ji rovnou zruší)", () => {
    expect(refundAccountNeeded({ payment_collections: [{ payments: [dobirka] }], fulfillments: [] } as any)).toBe(false)
  })

  it("záloha kartou + zbytek dobírkou → účet ano (kartou se nevrátí vše)", () => {
    expect(
      refundAccountNeeded({ payment_collections: [{ payments: [card] }, { payments: [dobirka] }], fulfillments: shipped } as any)
    ).toBe(true)
  })

  it("povinný u odstoupení / vrácení a u reklamace s požadavkem vrácení peněz", () => {
    expect(refundAccountRequiredFor("odstoupeni", null)).toBe(true)
    expect(refundAccountRequiredFor("vraceni", null)).toBe(true)
    expect(refundAccountRequiredFor("reklamace", "refund")).toBe(true)
    expect(refundAccountRequiredFor("reklamace", "repair")).toBe(false)
  })
})

describe("checkClaimRules — účet ve formuláři", () => {
  const order = {
    id: "order_1",
    items: [{ id: "item_1", title: "Hrnek", quantity: 1, unit_price: 500, total: 500 }],
    payment_collections: [{ payments: [{ ...dobirka, captured_at: "2026-10-03" }] }],
    fulfillments: shipped,
  }
  const base = { kind: "odstoupeni" as const, reason: "Nechci", line_items: [] }

  it("dobírka + odstoupení bez účtu → odmítnuto s vysvětlením", () => {
    expect(checkClaimRules(order as any, [], { ...base, refund_account: "" }, new Date("2026-10-05"))).toEqual({
      ok: false,
      message: REFUND_ACCOUNT_REQUIRED,
    })
  })

  it("s platným účtem projde, se špatným ne", () => {
    expect(
      checkClaimRules(order as any, [], { ...base, refund_account: "19-2000145399/0800" }, new Date("2026-10-05")).ok
    ).toBe(true)
    expect(
      checkClaimRules(order as any, [], { ...base, refund_account: "19-2000145398/0800" }, new Date("2026-10-05"))
    ).toEqual({ ok: false, message: REFUND_ACCOUNT_CHECKSUM })
  })

  it("volající bez pole (záložní routa, starší storefront) se nehlídá", () => {
    expect(checkClaimRules(order as any, [], base, new Date("2026-10-05")).ok).toBe(true)
  })
})

const item = (id: string, overrides: Record<string, unknown> = {}) => ({
  line_item_id: id,
  product_id: `prod_${id}`,
  title: `Výrobek ${id}`,
  variant_title: null,
  thumbnail: null,
  quantity: 2,
  unit_total: 450,
  line_total: 900,
  is_made_to_order: false,
  is_bundle: false,
  refunded_quantity: 0,
  refundable_quantity: 2,
  refundable_amount: 900,
  selected_in_claim: 0,
  ...overrides,
})

describe("reklamace = jen výrobky, odstoupení = celá objednávka", () => {
  const order = { shipping_total: 129, payment_collections: [], metadata: {} }

  it("poštovné smí jen odstoupení / vrácení", () => {
    expect(shippingRefundAllowedFor("odstoupeni")).toBe(true)
    expect(shippingRefundAllowedFor("vraceni")).toBe(true)
    expect(shippingRefundAllowedFor("reklamace")).toBe(false)
    expect(shippingRefundAllowedFor("uprava")).toBe(false)
    expect(shippingStateOf(order as any, [], { allowRefund: false })).toEqual({
      total: 129,
      refunded: 0,
      refundable: 0,
      allowed: false,
    })
  })

  it("košík reklamace s poštovným se odmítne", () => {
    const shipping = shippingStateOf(order as any, [], { allowRefund: false })
    const verdict = priceRefundLines({
      items: [item("a")] as any,
      shipping,
      lines: [{ type: "item", line_item_id: "a", quantity: 1 }, { type: "shipping" }],
      remaining: 1029,
    })
    expect(verdict).toEqual({ ok: false, message: REFUND_SHIPPING_CLAIM })
  })

  it("Vrátit vše u reklamace = jen reklamované kusy, bez poštovného", () => {
    const shipping = shippingStateOf(order as any, [], { allowRefund: false })
    const items = [item("a", { selected_in_claim: 1 }), item("b")]
    const lines = refundAllLines(items as any, shipping, 1929)
    expect(lines).toEqual([{ type: "item", line_item_id: "a", quantity: 1 }])
    const priced = priceRefundLines({ items: items as any, shipping, lines, remaining: 1929, clampToRemaining: true })
    expect(priced).toMatchObject({ ok: true, amount: 450 })
  })

  it("Vrátit vše u reklamace bez výběru = všechny výrobky, stále bez poštovného", () => {
    const shipping = shippingStateOf(order as any, [], { allowRefund: false })
    const lines = refundAllLines([item("a"), item("b")] as any, shipping, 1929)
    expect(lines.map((line) => line.type)).toEqual(["item", "item"])
  })

  it("Vrátit vše u odstoupení = všechny kusy + poštovné (zaplacená cena po slevě)", () => {
    const shipping = shippingStateOf(order as any, [], { allowRefund: true })
    const items = [item("a"), item("b")]
    const lines = refundAllLines(items as any, shipping, 1929)
    expect(lines.map((line) => line.type)).toEqual(["item", "item", "shipping"])
    const priced = priceRefundLines({ items: items as any, shipping, lines, remaining: 1929, clampToRemaining: true })
    expect(priced).toMatchObject({ ok: true, amount: 1929 })
  })

  it("nikdy víc, než přišlo: Vrátit vše se seřízne na zbývá", () => {
    const shipping = shippingStateOf(order as any, [], { allowRefund: true })
    const lines = refundAllLines([item("a")] as any, shipping, 700)
    const priced = priceRefundLines({ items: [item("a")] as any, shipping, lines, remaining: 700, clampToRemaining: true })
    expect(priced).toMatchObject({ ok: true, amount: 700, clamped: true })
  })

  it("nezaplaceno: nic nezbývá → košík se odmítne", () => {
    const shipping = shippingStateOf(order as any, [], { allowRefund: true })
    const priced = priceRefundLines({
      items: [item("a")] as any,
      shipping,
      lines: [{ type: "item", line_item_id: "a", quantity: 1 }],
      remaining: 0,
    })
    expect(priced.ok).toBe(false)
  })
})

describe("ruční vrácení říká kam", () => {
  it("hláška majitelce s účtem a VS, bez účtu výzva k doplnění", () => {
    expect(manualTransferText("19-2000145399/0800", 39)).toBe(
      "pošlete převodem na účet 19-2000145399/0800 (VS 39)."
    )
    expect(manualTransferText(null, 39)).toContain("nevyplnil")
  })

  it("e-mail zákazníkovi: karta přes ComGate, jinak převodem na jeho účet", () => {
    expect(refundMethodLabel("comgate")).toContain("ComGate")
    expect(refundMethodLabel("manual", "19-2000145399/0800")).toBe(
      "převodem na váš účet 19-2000145399/0800"
    )
  })
})
