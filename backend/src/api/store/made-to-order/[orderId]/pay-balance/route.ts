import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ensureBalancePaymentLink, outstandingFor } from "../../../../../lib/balance-payment"
import { verifyBalanceToken } from "../../../../../lib/balance-payment-link"
import { storefrontBase } from "../../../../../lib/customer-email"
import {
  commissionIdFromRequest,
  listCommissionsOfOrder,
  paymentRequestsByCommission,
} from "../../../../../lib/made-to-order/orders-of"

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
 * Od 20. 10. 2026 (LEGAL_AUDIT.md § 0c) má objednávka zakázek víc a každá
 * vlastní doplatek: `?production_order_id=` říká kterou. Bez něj (staré
 * odkazy) se vezme JEDINÁ zakázka s otevřeným doplatkem; když je jich víc,
 * odkaz nejde použít a zákazník skončí na stránce objednávky, kde má odkaz
 * u každé položky.
 *
 * Failures redirect to the storefront with a reason rather than rendering an
 * API error at somebody who was just trying to pay.
 */

const bounce = (res: MedusaResponse, status: string, orderId?: string) => {
  // Lands on the order the customer already knows about, with the outcome in a
  // query param. An invented /doplatek page would 404 — and a customer who
  // clicked „zaplatit" and got a 404 assumes their money went somewhere.
  const base = storefrontBase()
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
  res.redirect(
    302,
    orderId
      ? `${base}/order/${orderId}/confirmed?platba=${status}`
      : `${base}/account/orders?platba=${status}`
  )
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.orderId

  if (!verifyBalanceToken(orderId, req.query.token)) {
    // Deliberately vague: a precise message would help someone probing tokens.
    bounce(res, "neplatny-odkaz", orderId)
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const commissions = (await listCommissionsOfOrder(req.scope, orderId)).filter(
    (commission) => commission.stage !== "cancelled"
  )
  if (!commissions.length) {
    bounce(res, "neplatny-odkaz", orderId)
    return
  }

  const requestedId = commissionIdFromRequest(req)
  let productionOrder: any | null = null
  if (requestedId) {
    productionOrder = commissions.find((commission) => commission.id === requestedId) ?? null
  } else if (commissions.length === 1) {
    productionOrder = commissions[0]
  } else {
    // Starý odkaz bez zakázky u objednávky s víc zakázkami: jednoznačný jen
    // když dluží právě jedna.
    const requestsByCommission = await paymentRequestsByCommission(req.scope, commissions)
    const owing = commissions.filter(
      (commission) => outstandingFor(commission, requestsByCommission.get(commission.id) ?? []) > 0.005
    )
    if (owing.length === 1) {
      productionOrder = owing[0]
    } else if (!owing.length) {
      bounce(res, "paid", orderId)
      return
    }
  }

  if (!productionOrder) {
    bounce(res, "vyberte-zakazku", orderId)
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
      "payment_collections.id",
      "payment_collections.status",
      "payment_collections.amount",
      "payment_collections.captured_amount",
      "payment_collections.metadata",
    ],
    filters: { id: orderId },
  })
  const order = orders[0] as any

  if (!order) {
    bounce(res, "neplatny-odkaz", orderId)
    return
  }

  try {
    const link = await ensureBalancePaymentLink(req.scope, {
      order,
      productionOrder,
    })

    if (!link.payment_url) {
      bounce(res, "paid", orderId)
      return
    }

    res.redirect(302, link.payment_url)
  } catch (error) {
    req.scope
      .resolve("logger")
      .error(
        `[pay-balance] Odkaz pro objednávku ${orderId} (zakázka ${productionOrder.id}) se nepodařilo vytvořit: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    bounce(res, "chyba", orderId)
  }
}
