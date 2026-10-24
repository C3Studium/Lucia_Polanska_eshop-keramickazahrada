import { renderToStaticMarkup } from "react-dom/server"
import {
  FAILED_PAYMENT_EMAILS_FROM,
  FAILED_PAYMENT_GRACE_MS,
  FAILED_PAYMENT_MAX_AGE_MS,
  failedPaymentEmailDue,
} from "../payment-failure"
import { PaymentFailedEmail } from "../../modules/resend/emails/payment-failed"

describe("failedPaymentEmailDue", () => {
  const failedAt = new Date(FAILED_PAYMENT_EMAILS_FROM + 60 * 60 * 1000)
  const after = (ms: number) => new Date(failedAt.getTime() + ms)

  it("čeká na odstup — kdo hned zkusí znovu, e-mail nedostane", () => {
    expect(failedPaymentEmailDue(failedAt, after(5 * 60 * 1000))).toBe(false)
    expect(failedPaymentEmailDue(failedAt, after(FAILED_PAYMENT_GRACE_MS))).toBe(true)
  })

  it("starý neúspěch už nehlásí", () => {
    expect(
      failedPaymentEmailDue(failedAt, after(FAILED_PAYMENT_MAX_AGE_MS + 1))
    ).toBe(false)
  })

  it("nic z doby před nasazením (žádná vlna za staré testy)", () => {
    const before = new Date(FAILED_PAYMENT_EMAILS_FROM - 1)
    expect(
      failedPaymentEmailDue(before, new Date(before.getTime() + FAILED_PAYMENT_GRACE_MS))
    ).toBe(false)
  })

  it("nesmyslné datum = neposílat", () => {
    expect(failedPaymentEmailDue(undefined)).toBe(false)
    expect(failedPaymentEmailDue("není datum")).toBe(false)
  })
})

describe("payment-failed e-mail", () => {
  it("z pokladny: bez čísla objednávky, s obnovou košíku", () => {
    const html = renderToStaticMarkup(
      PaymentFailedEmail({
        checkout: true,
        customerName: "Jana",
        paymentAmount: "1 250 Kč",
        failureReason: "na účtu nebyl dostatek prostředků",
        retryLink: "https://keramickazahrada.cz/cz/cart/recover/cart_01?step=payment",
      })
    )
    expect(html).toContain("objednávka zatím nevznikla")
    expect(html).toContain("Dokončit objednávku")
    expect(html).toContain("na účtu nebyl dostatek prostředků")
    expect(html).toContain("cart/recover/cart_01?step=payment")
    expect(html).not.toContain("objednávku vám podržím")
  })

  it("u objednávky zůstává původní znění a číslo", () => {
    const html = renderToStaticMarkup(
      PaymentFailedEmail({
        orderNumber: "#51",
        paymentAmount: "3 000 Kč",
        retryLink: "https://keramickazahrada.cz/cz/order/order_01/confirmed",
      })
    )
    expect(html).toContain("#51")
    expect(html).toContain("objednávku vám podržím")
    expect(html).toContain("Zopakovat platbu")
    expect(html).not.toContain("objednávka zatím nevznikla")
  })
})
