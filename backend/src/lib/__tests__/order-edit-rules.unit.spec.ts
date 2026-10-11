import {
  addTargetProblem,
  decideSettlement,
  EDIT_LIMIT,
  lineLockFor,
  moneySentence,
  resolveShippingAmount,
  shippingNote,
  validateEditActions,
  type OrderLineInfo,
} from "../order-edit-rules"

const line = (id: string, mto = false, extra: Partial<OrderLineInfo> = {}): OrderLineInfo => ({
  id,
  quantity: 1,
  is_made_to_order: mto,
  ...extra,
})

describe("validateEditActions — zákony úpravy", () => {
  it("refuses touching a made-to-order line — call the maker instead", () => {
    const result = validateEditActions(
      [line("a", true), line("b")],
      [{ type: "swap", item_id: "a", variant_id: "v2" }]
    )
    expect(result.ok).toBe(false)
  })

  it("refuses touching a bundle or a clearance piece", () => {
    for (const lock of ["bundle", "clearance"] as const) {
      const result = validateEditActions(
        [line("a", false, { lock }), line("b")],
        [{ type: "set_quantity", item_id: "a", quantity: 2 }]
      )
      expect(result.ok).toBe(false)
    }
  })

  it("refuses emptying the order — editing is not cancellation", () => {
    const result = validateEditActions([line("a")], [{ type: "remove", item_id: "a" }])
    expect(result.ok).toBe(false)
  })

  it("counts locked lines as remaining — removing the only unlocked line is fine next to a zakázka", () => {
    const result = validateEditActions(
      [line("mto", true), line("b")],
      [{ type: "remove", item_id: "b" }]
    )
    expect(result.ok).toBe(true)
  })

  it("allows removing everything when something new comes in", () => {
    const result = validateEditActions(
      [line("a")],
      [
        { type: "remove", item_id: "a" },
        { type: "add", variant_id: "v9", quantity: 1 },
      ]
    )
    expect(result.ok).toBe(true)
  })

  it("set_quantity: 1–99 only; zero means Odebrat", () => {
    const lines = [line("a"), line("b")]
    expect(validateEditActions(lines, [{ type: "set_quantity", item_id: "a", quantity: 3 }]).ok).toBe(true)
    expect(validateEditActions(lines, [{ type: "set_quantity", item_id: "a", quantity: 0 }]).ok).toBe(false)
    expect(validateEditActions(lines, [{ type: "set_quantity", item_id: "a", quantity: 100 }]).ok).toBe(false)
    expect(validateEditActions(lines, [{ type: "set_quantity", item_id: "a", quantity: 1.5 }]).ok).toBe(false)
  })

  it("add: 1–20 pieces", () => {
    const lines = [line("a")]
    expect(validateEditActions(lines, [{ type: "add", variant_id: "v", quantity: 20 }]).ok).toBe(true)
    expect(validateEditActions(lines, [{ type: "add", variant_id: "v", quantity: 21 }]).ok).toBe(false)
    expect(validateEditActions(lines, [{ type: "add", variant_id: "v", quantity: 0 }]).ok).toBe(false)
  })

  it("one change per line", () => {
    const result = validateEditActions(
      [line("a"), line("b")],
      [
        { type: "set_quantity", item_id: "a", quantity: 2 },
        { type: "remove", item_id: "a" },
      ]
    )
    expect(result.ok).toBe(false)
  })

  it("swap to another variant OR another product (§3d.10); not to itself", () => {
    const lines = [line("a", false, { variant_ids: ["v1", "v2"], variant_id: "v1" })]
    expect(validateEditActions(lines, [{ type: "swap", item_id: "a", variant_id: "v2" }]).ok).toBe(true)
    expect(validateEditActions(lines, [{ type: "swap", item_id: "a", variant_id: "other_product_v" }]).ok).toBe(true)
    expect(validateEditActions(lines, [{ type: "swap", item_id: "a", variant_id: "v1" }]).ok).toBe(false)
  })

  it("swap_only (zabaleno): nothing but swaps", () => {
    const lines = [line("a"), line("b")]
    const opts = { mode: "swap_only" as const }
    expect(validateEditActions(lines, [{ type: "swap", item_id: "a", variant_id: "v2" }], opts).ok).toBe(true)
    expect(validateEditActions(lines, [{ type: "remove", item_id: "a" }], opts).ok).toBe(false)
    expect(validateEditActions(lines, [{ type: "add", variant_id: "v", quantity: 1 }], opts).ok).toBe(false)
    expect(validateEditActions(lines, [{ type: "set_quantity", item_id: "a", quantity: 2 }], opts).ok).toBe(false)
  })

  it("mode none refuses everything", () => {
    expect(
      validateEditActions([line("a")], [{ type: "swap", item_id: "a", variant_id: "v" }], { mode: "none" }).ok
    ).toBe(false)
  })

  it(`limit: after ${EDIT_LIMIT} confirmed edits the customer calls us`, () => {
    const act = [{ type: "swap" as const, item_id: "a", variant_id: "v" }]
    expect(validateEditActions([line("a")], act, { confirmedEdits: EDIT_LIMIT - 1 }).ok).toBe(true)
    expect(validateEditActions([line("a")], act, { confirmedEdits: EDIT_LIMIT }).ok).toBe(false)
  })

  it("keeps MTO lines invisible to the guard when untouched", () => {
    const result = validateEditActions(
      [line("mto", true), line("b")],
      [{ type: "swap", item_id: "b", variant_id: "v2" }]
    )
    expect(result.ok).toBe(true)
  })
})

describe("lineLockFor", () => {
  it("zakázka by line marker or by production profile, bundle, clearance", () => {
    expect(lineLockFor({ lineMetadata: { made_to_order: true } })).toBe("made_to_order")
    expect(lineLockFor({ hasProductionProfile: true })).toBe("made_to_order")
    expect(lineLockFor({ product: { metadata: { is_bundle: true } } })).toBe("bundle")
    expect(lineLockFor({ product: { metadata: { clearance: true } } })).toBe("clearance")
    expect(lineLockFor({ product: { metadata: { cod_allowed: true } } })).toBeNull()
  })
})

describe("addTargetProblem — co jde přidat", () => {
  it("blocks zakázka, bundle, clearance; dobírka needs cod_allowed", () => {
    expect(addTargetProblem({ hasProductionProfile: true, payment: "card" })).not.toBeNull()
    expect(addTargetProblem({ product: { metadata: { is_bundle: true } }, payment: "card" })).not.toBeNull()
    expect(addTargetProblem({ product: { metadata: { clearance: true } }, payment: "card" })).not.toBeNull()
    expect(addTargetProblem({ product: { metadata: {} }, payment: "dobirka" })).not.toBeNull()
    expect(addTargetProblem({ product: { metadata: { cod_allowed: true } }, payment: "dobirka" })).toBeNull()
    expect(addTargetProblem({ product: { metadata: {} }, payment: "card" })).toBeNull()
  })
})

describe("decideSettlement", () => {
  it("collects before confirming when a card order gets pricier", () => {
    expect(decideSettlement(240, "card")).toEqual({ kind: "collect", amount: 240 })
  })
  it("owes a refund when a card order gets cheaper", () => {
    expect(decideSettlement(-180, "card")).toEqual({ kind: "refund_due", amount: 180 })
  })
  it("settles at handover for pickup and dobírka", () => {
    expect(decideSettlement(240, "pickup")).toEqual({ kind: "none" })
    expect(decideSettlement(-99, "dobirka")).toEqual({ kind: "none" })
  })
  it("treats a haléř as no difference", () => {
    expect(decideSettlement(0.004, "card")).toEqual({ kind: "none" })
  })
})

describe("moneySentence", () => {
  it("says what happens to the money per payment", () => {
    expect(moneySentence({ difference: 240, payment: "card", totalAfter: 1000 })).toMatch(/Doplatíte/)
    expect(moneySentence({ difference: -240, payment: "card", totalAfter: 1000 })).toMatch(/vrátíme/)
    expect(moneySentence({ difference: 0, payment: "card", totalAfter: 1000 })).toBe("Cena se nemění.")
    expect(moneySentence({ difference: 100, payment: "dobirka", totalAfter: 1100 })).toMatch(/převzetí/)
    expect(moneySentence({ difference: 100, payment: "pickup", totalAfter: 1100 })).toMatch(/ateliéru/)
  })
})

describe("resolveShippingAmount — stejné cenové pravidlo jako pokladna", () => {
  const region = "reg_cz"
  it("flat price without rules (today's live setup)", () => {
    const prices = [
      { amount: 90, currency_code: "czk", price_rules: [] },
      { amount: 90, currency_code: "czk", price_rules: [{ attribute: "region_id", operator: "eq", value: region }] },
    ]
    expect(resolveShippingAmount(prices, { currency_code: "czk", region_id: region, item_total: 2000 })).toBe(90)
  })

  it("free shipping from 1 000 Kč when an item_total rule exists", () => {
    const prices = [
      { amount: 90, currency_code: "czk", price_rules: [] },
      { amount: 0, currency_code: "czk", price_rules: [{ attribute: "item_total", operator: "gte", value: "1000" }] },
    ]
    expect(resolveShippingAmount(prices, { currency_code: "czk", item_total: 999 })).toBe(90)
    expect(resolveShippingAmount(prices, { currency_code: "czk", item_total: 1000 })).toBe(0)
  })

  it("other currency or nothing matching → null", () => {
    expect(resolveShippingAmount([{ amount: 3.5, currency_code: "eur" }], { currency_code: "czk", item_total: 1 })).toBeNull()
  })

  it("shippingNote only when it changes", () => {
    expect(shippingNote(90, 90)).toBeNull()
    expect(shippingNote(90, 0)).toMatch(/Poštovné/)
  })
})
