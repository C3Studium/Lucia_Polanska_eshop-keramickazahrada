import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ensureBalancePaymentLink } from "../../../../../lib/balance-payment"
import { verifyBalanceToken } from "../../../../../lib/balance-payment-link"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"

/**
 * „Doplatit" — the button in the customer's e-mail.
 *
 * A mail client can only issue a plain GET with no credentials, so the link
 * carries a signed token instead (`lib/balance-payment-link.ts`). This route
 * verifies it, works out what is still owed, and **redirects straight to
 * ComGate** so the customer goes from inbox to payment page in one click.
 *
 * A GET with a side effect is a deliberate trade: it is the only shape an
 * e-mail button can have. It is safe because the effect is idempotent —
 * `ensureBalancePaymentLink` reuses an open request or collection and only
 * creates one when nothing usable exists, so a mail client prefetching the URL,
 * or the customer clicking three times, all land on the same payment.
 *
 * Failures redirect to the storefront with a reason rather than rendering an
 * API error at somebody who was just trying to pay.
 */

const storefront = (): string =>
  (process.env.STOREFRONT_PUBLIC_URL || process.env.MEDUSA_STOREFRONT_URL || "")
    .replace(/\/+$/, "")

const bounce = (res: MedusaResponse, status: string) => {
  const base = storefront()
  if (!base) {
    // No storefront configured — say it in the customer's language rather than
    // leaving a blank page.
    res.status(200).send(
      status === "paid"
        ? "Tato objednávka je již zaplacena. Děkujeme!"
        : "Platební odkaz se nepodařilo otevřít. Napište nám prosím."
    )
    return
  }
  res.redirect(302, `${base}/doplatek?stav=${status}`)
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.orderId

  if (!verifyBalanceToken(orderId, req.query.token)) {
    // Deliberately vague: a precise message would help someone probing tokens.
    bounce(res, "neplatny-odkaz")
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const [productionOrder] = (await madeToOrder.listProductionOrders({
    order_id: orderId,
  } as never)) as any[]

  if (!productionOrder || ["cancelled"].includes(productionOrder.stage)) {
    bounce(res, "neplatny-odkaz")
    return
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "customer_id",
      "currency_code",
      "payment_collections.status",
      "payment_collections.amount",
    ],
    filters: { id: orderId },
  })
  const order = orders[0] as any

  if (!order) {
    bounce(res, "neplatny-odkaz")
    return
  }

  try {
    const link = await ensureBalancePaymentLink(req.scope, {
      order,
      productionOrder,
    })

    if (!link.payment_url) {
      bounce(res, "paid")
      return
    }

    res.redirect(302, link.payment_url)
  } catch (error) {
    req.scope
      .resolve("logger")
      .error(
        `[pay-balance] Odkaz pro objednávku ${orderId} se nepodařilo vytvořit: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    bounce(res, "chyba")
  }
}
