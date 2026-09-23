import { captureDobirkaPayment, pickDobirkaPayment } from "../dobirka-capture"
import { DOBIRKA_PROVIDER_ID } from "../ship-gate"

const dobirkaPayment = (overrides: Record<string, unknown> = {}) => ({
  id: "pay_dobirka",
  provider_id: DOBIRKA_PROVIDER_ID,
  captured_at: null,
  canceled_at: null,
  ...overrides,
})

const orderWith = (payments: unknown[]) => ({
  id: "order_1",
  display_id: 1042,
  payment_collections: [{ payments }],
})

describe("pickDobirkaPayment", () => {
  it("finds the authorized, uncaptured dobírka payment", () => {
    const picked = pickDobirkaPayment(orderWith([dobirkaPayment()]))
    expect(picked).toEqual({
      is_dobirka: true,
      payment_id: "pay_dobirka",
      already: false,
    })
  })

  it("reports a captured dobírka as already settled", () => {
    const picked = pickDobirkaPayment(
      orderWith([dobirkaPayment({ captured_at: "2026-09-20T10:00:00Z" })])
    )
    expect(picked).toEqual({ is_dobirka: true, payment_id: null, already: true })
  })

  it("treats a canceled payment as nothing left to capture", () => {
    const picked = pickDobirkaPayment(
      orderWith([dobirkaPayment({ canceled_at: "2026-09-20T10:00:00Z" })])
    )
    expect(picked.already).toBe(true)
  })

  it("says not-dobírka for card orders and for empty orders", () => {
    expect(
      pickDobirkaPayment(orderWith([{ id: "p1", provider_id: "pp_comgate_comgate" }]))
        .is_dobirka
    ).toBe(false)
    expect(pickDobirkaPayment(orderWith([])).is_dobirka).toBe(false)
    expect(pickDobirkaPayment(null).is_dobirka).toBe(false)
  })
})

describe("captureDobirkaPayment", () => {
  const containerWith = (orders: unknown[]) => ({
    resolve: (key: string) => {
      if (key === "query") {
        return { graph: async () => ({ data: orders }) }
      }
      if (key === "logger") {
        return { info: () => undefined, warn: () => undefined, error: () => undefined }
      }
      throw new Error(`Unexpected resolve("${key}")`)
    },
  })

  it("captures the outstanding dobírka payment, full amount, once", async () => {
    const captures: unknown[] = []
    const result = await captureDobirkaPayment(
      containerWith([orderWith([dobirkaPayment()])]) as never,
      "order_1",
      {
        capturedBy: "user_lucia",
        runCapture: async (input) => {
          captures.push(input)
        },
      }
    )

    expect(result).toEqual({
      outcome: "captured",
      payment_id: "pay_dobirka",
      display_id: 1042,
    })
    // Full amount only: no amount field ever reaches the capture workflow.
    expect(captures).toEqual([
      { payment_id: "pay_dobirka", captured_by: "user_lucia" },
    ])
  })

  it("is idempotent: an already-captured dobírka is a no-op, not an error", async () => {
    const captures: unknown[] = []
    const result = await captureDobirkaPayment(
      containerWith([
        orderWith([dobirkaPayment({ captured_at: "2026-09-20T10:00:00Z" })]),
      ]) as never,
      "order_1",
      {
        runCapture: async (input) => {
          captures.push(input)
        },
      }
    )

    expect(result.outcome).toBe("already")
    expect(captures).toEqual([])
  })

  it("refuses to touch a card order's money", async () => {
    const captures: unknown[] = []
    const result = await captureDobirkaPayment(
      containerWith([
        orderWith([{ id: "p1", provider_id: "pp_comgate_comgate" }]),
      ]) as never,
      "order_1",
      {
        runCapture: async (input) => {
          captures.push(input)
        },
      }
    )

    expect(result.outcome).toBe("not_dobirka")
    expect(captures).toEqual([])
  })

  it("reports a missing order instead of guessing", async () => {
    const result = await captureDobirkaPayment(
      containerWith([]) as never,
      "order_missing",
      { runCapture: async () => undefined }
    )
    expect(result).toEqual({ outcome: "not_found" })
  })
})
