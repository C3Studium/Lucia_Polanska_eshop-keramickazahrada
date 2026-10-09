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

  /*
   * Zámek (změřeno 9. 10. 2026 na #31): zakázka s osobním odběrem — záloha
   * zachycená bránou, doplatek jako druhá kolekce `not_paid` bez platby.
   * Dřív krok „zachytit" tiše přeskočil a objednávka se vydala s 3 225 Kč
   * nezaplacenými. Teď se bez platby k zachycení a s dluhem nevydává.
   */
  const commissionOrder = (balanceCollection: Record<string, unknown>) =>
    order({
      currency_code: "czk",
      payment_collections: [
        {
          status: "completed",
          amount: 1075,
          captured_amount: 1075,
          payments: [
            { id: "pay_deposit", captured_at: "2026-10-01T10:00:00Z", canceled_at: null },
          ],
        },
        balanceCollection,
      ],
    })

  it("refuses a commission whose balance has no payment to capture (#31)", () => {
    expect(() =>
      assertPersonalPickup(
        commissionOrder({
          status: "not_paid",
          amount: 3225,
          captured_amount: 0,
          payments: [],
        })
      )
    ).toThrow(/Zaplaceno na místě/)

    // The amount in the message is what she still has to record.
    expect(() =>
      assertPersonalPickup(
        commissionOrder({
          status: "not_paid",
          amount: 3225,
          captured_amount: 0,
          payments: [],
        })
      )
    ).toThrow(/3\s?225/)
  })

  it("lets the commission through once the balance was recorded on the spot", () => {
    const result = assertPersonalPickup(
      commissionOrder({
        status: "completed",
        amount: 3225,
        captured_amount: 3225,
        payments: [
          { id: "pay_balance", captured_at: "2026-10-09T10:00:00Z", canceled_at: null },
        ],
      })
    )

    expect(result.paymentId).toBeNull()
    expect(result.amountDue).toBe(0)
  })

  it("does not count a canceled or failed collection as money owed", () => {
    // An expired balance link leaves a canceled collection behind; it must
    // not lock the handover forever.
    const result = assertPersonalPickup(
      commissionOrder({
        status: "canceled",
        amount: 3225,
        captured_amount: 0,
        payments: [],
      })
    )

    expect(result.paymentId).toBeNull()
    expect(result.amountDue).toBe(0)
  })

  it("keeps capturing an authorized pay-later payment on a regular pickup", () => {
    // The D1 exception itself: money at the counter, something to capture.
    const result = assertPersonalPickup(
      order({
        payment_collections: [
          {
            status: "authorized",
            amount: { value: "1890" },
            captured_amount: { value: "0" },
            payments: [{ id: "pay_counter", captured_at: null, canceled_at: null }],
          },
        ],
      })
    )

    expect(result.paymentId).toBe("pay_counter")
    expect(result.amountDue).toBe(1890)
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
