import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { RETURN_REQUEST_MODULE } from "../../modules/return-request"
import type ReturnRequestModuleService from "../../modules/return-request/service"
import { MONEY_EPSILON, moneyState, type MoneyState } from "./refund-rules"

/**
 * Peníze objednávky pro modul reklamací: načtení + „pojistka proti skryté
 * refundaci" (docs/reklamace-a-zruseni.md §3).
 *
 * Nativní `cancelOrderWorkflow` vrací zachycené platby SÁM a potichu
 * (`refundCapturedPaymentsWorkflow`). Zásada č. 1 modulu je, že se peníze
 * nikdy nevrací automaticky — každé vrácení jde přes žádost → protokol →
 * dobropis → potvrzení. Proto se zrušení objednávky s nevyrovnanými penězi
 * odmítá, a to na KAŽDÝCH dveřích: nativní `/admin/orders/:id/cancel`
 * (middleware níž) i „Zrušit zakázku" (volá `assertNoMoneyLeft`).
 */

/** Jen to, co potřebuje výpočet zachyceno/vráceno/zbývá (seznam, pojistka). */
export const MONEY_STATE_FIELDS = [
  "id",
  "display_id",
  "currency_code",
  "metadata",
  "payment_collections.payments.id",
  "payment_collections.payments.provider_id",
  "payment_collections.payments.amount",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
  "payment_collections.payments.refunds.amount",
]

/** Plná objednávka pro refundaci a dobropis — navíc e-mail, zákazník a celek. */
export const MONEY_ORDER_FIELDS = [
  ...MONEY_STATE_FIELDS,
  "email",
  // `total` je odvozený z položek — bez `items.*` by byl nula a dobropis by
  // každou částečnou refundaci považoval za plnou.
  "total",
  "items.*",
  "customer.first_name",
  "customer.last_name",
]

export const loadMoneyOrder = async (
  container: MedusaContainer,
  orderId: string
): Promise<any | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: MONEY_ORDER_FIELDS,
    filters: { id: orderId },
  })
  return (orders[0] as any) ?? null
}

/** Všechny žádosti k objednávce — pro součet refundací přes modul. */
export const loadOrderRequests = async (
  container: MedusaContainer,
  orderId: string
): Promise<any[]> => {
  const service = container.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )
  return (await service.listReturnRequests({ order_id: orderId } as never)) as any[]
}

export type OrderMoney = {
  order: any
  requests: any[]
  state: MoneyState
}

export const loadOrderMoney = async (
  container: MedusaContainer,
  orderId: string
): Promise<OrderMoney | null> => {
  const order = await loadMoneyOrder(container, orderId)
  if (!order) {
    return null
  }
  const requests = await loadOrderRequests(container, orderId)
  return { order, requests, state: moneyState(order, requests) }
}

const formatMoney = (amount: number, currencyCode?: string | null): string =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: String(currencyCode || "CZK").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount)

export const cancelBlockedMessage = (
  remaining: number,
  currencyCode?: string | null
): string =>
  `Objednávka má zaplaceno ${formatMoney(remaining, currencyCode)} — vrácení peněz vyřiďte v Reklamace a zrušení, pak ji zrušte.`

/**
 * Vyhodí 400, dokud má objednávka zachyceno − vráceno > 0. Neexistující
 * objednávku propouští — její 404 ať řekne nativní routa.
 */
export const assertNoMoneyLeft = async (
  container: MedusaContainer,
  orderId: string
): Promise<void> => {
  const money = await loadOrderMoney(container, orderId)
  if (!money) {
    return
  }
  if (money.state.remaining > MONEY_EPSILON) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      cancelBlockedMessage(money.state.remaining, money.order.currency_code)
    )
  }
}

/** Middleware pro `POST /admin/orders/:id/cancel` — viz hlavička souboru. */
export const requireRefundedBeforeCancel = () => {
  return async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    try {
      const orderId = req.params.id
      if (orderId) {
        await assertNoMoneyLeft(req.scope, orderId)
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}
