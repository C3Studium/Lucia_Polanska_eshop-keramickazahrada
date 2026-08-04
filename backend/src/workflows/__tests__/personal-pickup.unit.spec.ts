import { assertPersonalPickup } from "../complete-personal-pickup"

const pickupMethod = { data: { personal_pickup: true, service_code: "PICKUP" } }
const postMethod = { data: { service_code: "NB" } }

const order = (overrides: Record<string, unknown> = {}) => ({
  shipping_methods: [pickupMethod],
  payment_collections: [
    {
      amount: 1890,
      captured_amount: 0,
      payments: [{ id: "pay_1", captured_at: null, canceled_at: null }],
    },
  ],
  ...overrides,
})

describe("personal pickup completion", () => {
  it("accepts an order collected in person and finds the payment to capture", () => {
    const result = assertPersonalPickup(order())

    expect(result.paymentId).toBe("pay_1")
    expect(result.amountDue).toBe(1890)
  })

  it("recognises pickup from the shipping option's provider too", () => {
    const result = assertPersonalPickup(
      order({
        shipping_methods: [
          { data: {}, shipping_option: { provider_id: "pickup_pickup" } },
        ],
      })
    )

    expect(result.paymentId).toBe("pay_1")
  })

  it("refuses an ordinary order outright", () => {
    // The whole safety of this action: taking cash at the counter is the one
    // exception to "no money, no goods", and an exception that applies to any
    // order is not an exception — it is a hole.
    expect(() =>
      assertPersonalPickup(order({ shipping_methods: [postMethod] }))
    ).toThrow(/osobním odběrem/i)
  })

  it("refuses an order with no shipping method at all", () => {
    expect(() => assertPersonalPickup(order({ shipping_methods: [] }))).toThrow()
  })

  it("reports nothing to capture once the money was already recorded", () => {
    // Clicking twice must not try to take payment a second time.
    const result = assertPersonalPickup(
      order({
        payment_collections: [
          {
            amount: 1890,
            captured_amount: 1890,
            payments: [
              { id: "pay_1", captured_at: "2026-08-04T10:00:00Z", canceled_at: null },
            ],
          },
        ],
      })
    )

    expect(result.paymentId).toBeNull()
    expect(result.amountDue).toBe(0)
  })

  it("ignores a cancelled payment when looking for one to capture", () => {
    const result = assertPersonalPickup(
      order({
        payment_collections: [
          {
            amount: 1890,
            captured_amount: 0,
            payments: [
              { id: "pay_dead", captured_at: null, canceled_at: "2026-08-01T00:00:00Z" },
              { id: "pay_live", captured_at: null, canceled_at: null },
            ],
          },
        ],
      })
    )

    expect(result.paymentId).toBe("pay_live")
  })
})
