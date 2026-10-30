import { capturePickupPayment, pickPickupPayment } from "../pickup-capture"
import {
  DOBIRKA_PROVIDER_ID,
  PICKUP_PAYMENT_PROVIDER_ID,
} from "../ship-gate"

const pickupPayment = (overrides: Record<string, unknown> = {}) => ({
  id: "pay_pickup",
  provider_id: PICKUP_PAYMENT_PROVIDER_ID,
  captured_at: null,
  canceled_at: null,
  ...overrides,
})

const pickupOrder = (
  collections: unknown[],
  overrides: Record<string, unknown> = {}
) => ({
  id: "order_1",
  display_id: 56,
  currency_code: "czk",
  shipping_methods: [{ data: { personal_pickup: true } }],
  payment_collections: collections,
  ...overrides,
})

const collection = (
  payments: unknown[],
  overrides: Record<string, unknown> = {}
) => ({
  status: "awaiting",
  amount: 600,
  captured_amount: 0,
  payments,
  ...overrides,
})

describe("pickPickupPayment", () => {
  it("najde autorizovanou platbu u pultu", () => {
    const picked = pickPickupPayment(pickupOrder([collection([pickupPayment()])]))
    expect(picked).toEqual({
      is_pickup: true,
      payment_id: "pay_pickup",
      already: false,
      amount_due: 600,
    })
  })

  it("zachycenou platbu bere jako zapsanou", () => {
    const picked = pickPickupPayment(
      pickupOrder([
        collection([pickupPayment({ captured_at: "2026-10-30T18:00:00Z" })], {
          captured_amount: 600,
        }),
      ])
    )
    expect(picked.payment_id).toBeNull()
    expect(picked.already).toBe(true)
  })

  it("zrušená platba taky nenechává co zachytit", () => {
    const picked = pickPickupPayment(
      pickupOrder([
        collection([pickupPayment({ canceled_at: "2026-10-30T18:00:00Z" })], {
          status: "canceled",
        }),
      ])
    )
    expect(picked.payment_id).toBeNull()
    expect(picked.already).toBe(true)
  })

  it("objednávku na poštu odmítne — u pultu se neplatí", () => {
    const order = pickupOrder([collection([pickupPayment()])], {
      shipping_methods: [{ data: {} }],
    })
    expect(pickPickupPayment(order).is_pickup).toBe(false)
    expect(pickPickupPayment(null).is_pickup).toBe(false)
  })

  it("nesahá na rozdělanou platbu kartou z brány", () => {
    const picked = pickPickupPayment(
      pickupOrder([
        collection([{ id: "pay_card", provider_id: "pp_comgate_comgate" }]),
      ])
    )
    // Dluh je, ale zachytit se tu nedá nic — to je případ „needs_manual".
    expect(picked.payment_id).toBeNull()
    expect(picked.already).toBe(false)
    expect(picked.amount_due).toBe(600)
  })

  it("dobírka je taky platba „až potom“ — a pozná se", () => {
    const picked = pickPickupPayment(
      pickupOrder([
        collection([pickupPayment({ provider_id: DOBIRKA_PROVIDER_ID })]),
      ])
    )
    expect(picked.payment_id).toBe("pay_pickup")
  })

  it("zrušená kolekce nedluží — po doplatku zbývá nula", () => {
    const picked = pickPickupPayment(
      pickupOrder([
        collection([pickupPayment({ captured_at: "2026-10-30T18:00:00Z" })], {
          status: "completed",
          captured_amount: 600,
        }),
        collection([], { status: "canceled", amount: 300, captured_amount: 0 }),
      ])
    )
    expect(picked.amount_due).toBe(0)
    expect(picked.already).toBe(true)
  })
})

describe("capturePickupPayment", () => {
  const containerWith = (orders: unknown[]) =>
    ({
      resolve: (key: string) => {
        if (key === "query") {
          return { graph: async () => ({ data: orders }) }
        }
        return { info: () => undefined, warn: () => undefined, error: () => undefined }
      },
    }) as never

  it("zachytí platbu právě jednou a řekne čím", async () => {
    const calls: unknown[] = []
    const result = await capturePickupPayment(
      containerWith([pickupOrder([collection([pickupPayment()])])]),
      "order_1",
      {
        capturedBy: "user_lucie",
        runCapture: async (input) => {
          calls.push(input)
        },
      }
    )

    expect(result).toEqual({
      outcome: "captured",
      payment_id: "pay_pickup",
      display_id: 56,
    })
    expect(calls).toEqual([
      { payment_id: "pay_pickup", captured_by: "user_lucie" },
    ])
  })

  it("druhé kliknutí nic nezachytí", async () => {
    const calls: unknown[] = []
    const result = await capturePickupPayment(
      containerWith([
        pickupOrder([
          collection([pickupPayment({ captured_at: "2026-10-30T18:00:00Z" })], {
            captured_amount: 600,
          }),
        ]),
      ]),
      "order_1",
      { runCapture: async (input) => calls.push(input) }
    )

    expect(result.outcome).toBe("already")
    expect(calls).toHaveLength(0)
  })

  it("dluh bez platby pošle na „Zaplaceno na místě“ u zakázky", async () => {
    const result = await capturePickupPayment(
      containerWith([
        pickupOrder([
          collection([], { status: "not_paid", amount: 3225, captured_amount: 0 }),
        ]),
      ]),
      "order_1",
      { runCapture: async () => undefined }
    )

    expect(result).toEqual({
      outcome: "needs_manual",
      amount_due: 3225,
      currency_code: "czk",
      display_id: 56,
    })
  })

  it("u objednávky na poštu odmítne, neznámou nenajde", async () => {
    const naPostu = await capturePickupPayment(
      containerWith([
        pickupOrder([collection([pickupPayment()])], {
          shipping_methods: [{ data: {} }],
        }),
      ]),
      "order_1",
      { runCapture: async () => undefined }
    )
    expect(naPostu.outcome).toBe("not_pickup")

    const nic = await capturePickupPayment(containerWith([]), "order_1", {
      runCapture: async () => undefined,
    })
    expect(nic.outcome).toBe("not_found")
  })
})
