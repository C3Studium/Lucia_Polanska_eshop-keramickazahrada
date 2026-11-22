import { attemptOf, nextAttemptKey, planEmailRetries, RETRY_DELAYS_MIN } from "../email-retry"

/*
 * Automatické opakování nezdařených e-mailů (22. 11. 2026).
 *
 * 21. 11. při přepnutí účtu Resend spadlo „Odesláno" zákaznici (#89,
 * order-shipment, HTTP 403 „domain is not verified") a nic ho neposlalo
 * znovu — leželo 15 hodin, než ho někdo ručně „Poslal znovu".
 */

const T0 = new Date("2026-11-21T15:37:32Z").getTime()
const min = (n: number) => new Date(T0 + n * 60_000)

const n = (over: Record<string, unknown>) => ({
  id: "noti_1",
  channel: "email",
  to: "ivahro56@gmail.com",
  template: "order-shipment",
  status: "failure",
  idempotency_key: "ship:order_1",
  original_notification_id: null,
  created_at: min(0),
  ...over,
})

describe("klíč dalšího pokusu", () => {
  it("první opakování :r2, pak počítá dál", () => {
    expect(nextAttemptKey("ship:order_1")).toBe("ship:order_1:r2")
    expect(nextAttemptKey("ship:order_1:r2")).toBe("ship:order_1:r3")
    expect(nextAttemptKey(null)).toBeUndefined()
  })
  it("číslo pokusu z klíče", () => {
    expect(attemptOf("ship:order_1")).toBe(1)
    expect(attemptOf("ship:order_1:r3")).toBe(3)
  })
})

describe("plán opakování", () => {
  it("nezdařený e-mail se po prvním odstupu pošle znovu", () => {
    const plan = planEmailRetries([n({})], min(RETRY_DELAYS_MIN[0] + 1))
    expect(plan.retry.map((r) => r.id)).toEqual(["noti_1"])
    expect(plan.exhausted).toEqual([])
  })

  it("před odstupem se nečeká nic (hned po pádu ne)", () => {
    expect(planEmailRetries([n({})], min(2)).retry).toEqual([])
  })

  it("když mezitím prošel (i ručně „Poslat znovu“), už se neopakuje", () => {
    const list = [
      n({}),
      n({ id: "noti_2", status: "success", idempotency_key: "ship:order_1:r2", original_notification_id: "noti_1", created_at: min(5) }),
    ]
    expect(planEmailRetries(list, min(600)).retry).toEqual([])
  })

  it("opakuje vždy POSLEDNÍ pokus řetězu, s delším odstupem", () => {
    const list = [
      n({}),
      n({ id: "noti_2", idempotency_key: "ship:order_1:r2", original_notification_id: "noti_1", created_at: min(15) }),
    ]
    // druhý odstup ještě neuplynul
    expect(planEmailRetries(list, min(15 + RETRY_DELAYS_MIN[1] - 1)).retry).toEqual([])
    const plan = planEmailRetries(list, min(15 + RETRY_DELAYS_MIN[1] + 1))
    expect(plan.retry.map((r) => r.id)).toEqual(["noti_2"])
  })

  it("po vyčerpání pokusů už nic — jen hlášení", () => {
    const list = [
      n({}),
      n({ id: "noti_2", idempotency_key: "ship:order_1:r2", original_notification_id: "noti_1", created_at: min(15) }),
      n({ id: "noti_3", idempotency_key: "ship:order_1:r3", original_notification_id: "noti_1", created_at: min(80) }),
      n({ id: "noti_4", idempotency_key: "ship:order_1:r4", original_notification_id: "noti_1", created_at: min(450) }),
    ]
    const plan = planEmailRetries(list, min(2000))
    expect(plan.retry).toEqual([])
    expect(plan.exhausted.map((r) => r.id)).toEqual(["noti_4"])
  })

  it("bez adresáta nebo mimo e-mail se neopakuje", () => {
    const list = [n({ to: "" }), n({ id: "noti_f", channel: "feed" })]
    expect(planEmailRetries(list, min(100)).retry).toEqual([])
  })

  it("bez klíče: řetěz podle id, pokus = 1", () => {
    const plan = planEmailRetries([n({ idempotency_key: null })], min(20))
    expect(plan.retry.map((r) => r.id)).toEqual(["noti_1"])
  })
})
