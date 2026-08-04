import {
  epsilonFor,
  evaluateShipGate,
  productionOutstanding,
  type ShipGateInput,
} from "../ship-gate"

/** A plain, fully paid CZK order — the baseline every case deviates from. */
const paidOrder = (overrides: Partial<ShipGateInput> = {}): ShipGateInput => ({
  currency_code: "czk",
  total: 1890,
  summary: { pending_difference: 0 },
  payment_collections: [
    {
      status: "completed",
      amount: 1890,
      captured_amount: 1890,
      refunded_amount: 0,
    },
  ],
  order_changes: [],
  production_order: null,
  ...overrides,
})

describe("currency tolerance", () => {
  it("tolerates a haléř in CZK and nothing in a zero-decimal currency", () => {
    expect(epsilonFor("czk")).toBeCloseTo(0.01, 10)
    expect(epsilonFor("CZK")).toBeCloseTo(0.01, 10)
    // JPY has no subunit, so any difference at all is a real difference.
    expect(epsilonFor("jpy")).toBe(1)
  })

  it("falls back to Medusa's default for an unknown currency", () => {
    expect(epsilonFor("zzz")).toBeCloseTo(0.01, 10)
    expect(epsilonFor(null)).toBeCloseTo(0.01, 10)
  })
})

describe("evaluateShipGate — the happy path", () => {
  it("allows a fully paid order", () => {
    expect(evaluateShipGate(paidOrder())).toEqual({
      allowed: true,
      code: null,
      reason: null,
    })
  })

  it("allows a shortfall smaller than the currency's rounding error", () => {
    const order = paidOrder({ total: 1890.004 })
    expect(evaluateShipGate(order).allowed).toBe(true)
  })

  it("allows an overpayment — that is a refund question, not a dispatch one", () => {
    const order = paidOrder({
      payment_collections: [
        {
          status: "completed",
          amount: 1890,
          captured_amount: 2000,
          refunded_amount: 0,
        },
      ],
      summary: { pending_difference: -110 },
    })
    expect(evaluateShipGate(order).allowed).toBe(true)
  })

  it("reads bigNumber-shaped amounts", () => {
    const order = paidOrder({
      total: { value: "1890" },
      payment_collections: [
        {
          status: "completed",
          amount: { value: "1890" },
          captured_amount: { value: "1890" },
          refunded_amount: { value: "0" },
        },
      ],
    })
    expect(evaluateShipGate(order).allowed).toBe(true)
  })

  it("accepts the summary as a list, which is how the model stores it", () => {
    const order = paidOrder({ summary: [{ pending_difference: 0 }] })
    expect(evaluateShipGate(order).allowed).toBe(true)
  })
})

describe("evaluateShipGate — money that never arrived", () => {
  it("blocks an unpaid order and names the missing amount", () => {
    const order = paidOrder({
      payment_collections: [
        {
          status: "not_paid",
          amount: 1890,
          captured_amount: 0,
          refunded_amount: 0,
        },
      ],
    })
    const verdict = evaluateShipGate(order)

    expect(verdict.allowed).toBe(false)
    expect(verdict.code).toBe("unpaid")
    expect(verdict.reason).toContain("1")
    expect(verdict.reason).toMatch(/chybí/i)
  })

  it("blocks a deposit-only capture", () => {
    // The made-to-order case: 25 % taken up front, the rest still owed.
    const order = paidOrder({
      total: 6000,
      payment_collections: [
        {
          status: "completed",
          amount: 1500,
          captured_amount: 1500,
          refunded_amount: 0,
        },
      ],
    })
    const verdict = evaluateShipGate(order)

    expect(verdict.allowed).toBe(false)
    expect(verdict.code).toBe("unpaid")
  })

  it("blocks after a refund puts the order back in the red", () => {
    const order = paidOrder({
      payment_collections: [
        {
          status: "completed",
          amount: 1890,
          captured_amount: 1890,
          refunded_amount: 500,
        },
      ],
    })
    const verdict = evaluateShipGate(order)

    expect(verdict.allowed).toBe(false)
    expect(verdict.code).toBe("unpaid")
  })
})

describe("evaluateShipGate — why a status check is not enough", () => {
  it("blocks an order edited upwards after it was captured", () => {
    // This is the exact hole A2 exists to close: the deposit was captured, the
    // spec was confirmed and the total went up through a native Order Edit, and
    // `payment_status` still cheerfully says „captured".
    const order = paidOrder({
      total: 3000,
      payment_collections: [
        {
          status: "completed",
          amount: 1890,
          captured_amount: 1890,
          refunded_amount: 0,
        },
      ],
    })

    expect(evaluateShipGate(order).allowed).toBe(false)
  })

  it("blocks while an order change is still open", () => {
    for (const status of ["pending", "requested"]) {
      const verdict = evaluateShipGate(
        paidOrder({ order_changes: [{ status }] })
      )
      expect(verdict.allowed).toBe(false)
      expect(verdict.code).toBe("order_change")
    }
  })

  it("ignores order changes that are already settled", () => {
    for (const status of ["confirmed", "declined", "canceled"]) {
      expect(
        evaluateShipGate(paidOrder({ order_changes: [{ status }] })).allowed
      ).toBe(true)
    }
  })

  it("checks the order change before the amounts", () => {
    // An edit in flight means every amount below is measured against a total
    // that is about to move, so that reason wins.
    const verdict = evaluateShipGate(
      paidOrder({
        total: 5000,
        order_changes: [{ status: "pending" }],
      })
    )
    expect(verdict.code).toBe("order_change")
  })

  it("blocks on a real pending difference even when the sums look settled", () => {
    const order = paidOrder({ summary: { pending_difference: 250 } })
    const verdict = evaluateShipGate(order)

    expect(verdict.allowed).toBe(false)
    expect(verdict.code).toBe("pending_difference")
  })

  it("ignores a pending difference that is only rounding", () => {
    expect(
      evaluateShipGate(paidOrder({ summary: { pending_difference: 0.004 } }))
        .allowed
    ).toBe(true)
  })
})

describe("evaluateShipGate — open payment collections", () => {
  it("blocks while a collection is still waiting for money", () => {
    const order = paidOrder({
      payment_collections: [
        {
          status: "completed",
          amount: 1890,
          captured_amount: 1890,
          refunded_amount: 0,
        },
        // A balance link she sent that has not been paid yet.
        {
          status: "not_paid",
          amount: 500,
          captured_amount: 0,
          refunded_amount: 0,
        },
      ],
      total: 1890,
    })
    const verdict = evaluateShipGate(order)

    expect(verdict.allowed).toBe(false)
    expect(verdict.code).toBe("open_collection")
  })

  it("ignores collections that were cancelled or failed", () => {
    for (const status of ["canceled", "failed"]) {
      const order = paidOrder({
        payment_collections: [
          {
            status: "completed",
            amount: 1890,
            captured_amount: 1890,
            refunded_amount: 0,
          },
          { status, amount: 500, captured_amount: 0, refunded_amount: 0 },
        ],
      })
      expect(evaluateShipGate(order).allowed).toBe(true)
    }
  })
})

describe("evaluateShipGate — commissions", () => {
  it("blocks while the commission still owes money", () => {
    const order = paidOrder({
      production_order: {
        agreed_total: 6000,
        original_total: 6000,
        payment_requests: [
          { status: "paid", amount: 1500 },
          { status: "pending", amount: 4500 },
        ],
      },
    })
    const verdict = evaluateShipGate(order)

    expect(verdict.allowed).toBe(false)
    expect(verdict.code).toBe("mto_outstanding")
    expect(verdict.reason).toMatch(/doplat/i)
  })

  it("allows once the balance is paid", () => {
    const order = paidOrder({
      production_order: {
        agreed_total: 6000,
        original_total: 6000,
        payment_requests: [
          { status: "paid", amount: 1500 },
          { status: "paid", amount: 4500 },
        ],
      },
    })
    expect(evaluateShipGate(order).allowed).toBe(true)
  })

  it("uses the agreed price, not the original, once one exists", () => {
    // She confirmed the specification at a higher price than the customer's
    // first estimate; the deposit alone no longer covers it.
    expect(
      productionOutstanding({
        agreed_total: 6000,
        original_total: 2000,
        payment_requests: [{ status: "paid", amount: 2000 }],
      })
    ).toBe(4000)
  })

  it("counts only payments that actually landed", () => {
    expect(
      productionOutstanding({
        agreed_total: 1000,
        payment_requests: [
          { status: "sent", amount: 1000 },
          { status: "expired", amount: 1000 },
          { status: "failed", amount: 1000 },
        ],
      })
    ).toBe(1000)
  })

  it("treats an order with no commission as owing nothing", () => {
    expect(productionOutstanding(null)).toBe(0)
    expect(productionOutstanding(undefined)).toBe(0)
  })
})
