import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  customerName,
  formatDate,
  formatMoney,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../customer-email"
import { formatPragueDateTime } from "../claims/withdrawal"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"
import type MadeToOrderModuleService from "../../modules/made-to-order/service"
import { commissionImageOf, commissionLineOf, commissionTitleOf } from "./commission-line"
import { contractDepositAmountOf } from "./contract-deposit"

/**
 * Z3 (LEGAL_AUDIT.md § 0): zahájení výroby platí od E-MAILU „Zakázka je ve
 * výrobě", ne od kliknutí ani od tvrzení kterékoli strany (§ 1814 odst. 1
 * písm. j) OZ — podnikatel sám nesmí rozhodovat o souladu se smlouvou).
 * Od toho e-mailu se při zrušení zákazníkem nevrací smluvní záloha (Z5).
 *
 * Proto se tu e-mail posílá HNED a SYNCHRONNĚ (ne přes event): když odeslání
 * selže, výroba zahájená není — fáze se vrátí na `confirmed`, majitelka vidí
 * chybu a klikne znovu. Čas odeslání a ID notifikace se ukládají k zakázce
 * (`production_start_notified_at`, `production_start_email_id`).
 *
 * Idempotentní: zakázka s už odeslaným e-mailem ho nedostane podruhé; jen se
 * dotáhne fáze. Dedupe klíč `mto-start:<production_order_id>` navíc drží
 * modul notifikací, takže ani opakovaný pokus po chybě zápisu nepošle dva.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export const PRODUCTION_START_EMAIL_FAILED =
  "E-mail o zahájení výroby se nepodařilo odeslat — výroba není zahájena. Zkuste to znovu."

export const productionStartEmailKey = (productionOrderId: string): string =>
  `mto-start:${productionOrderId}`

export type StartProductionInput = {
  productionOrder: any
  orderId: string
}

export type StartProductionResult = {
  production_order: any
  /** E-mail Z3 odešel právě teď. */
  email_sent: boolean
  /** E-mail Z3 už odešel dřív — tentokrát se jen srovnala fáze. */
  already_notified: boolean
}

const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "currency_code",
  "items.*",
  "customer.first_name",
  "customer.last_name",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "payment_collections.metadata",
]

/**
 * `production_time_max_days` zakázkového řádku ze snímku pokladny
 * (`production_lines[]` v metadatech kolekce) — lhůta Z9 běží od zahájení.
 * Řádek TÉTO zakázky podle varianty její položky (zakázka = položka, § 0c);
 * legacy zakázka / nenalezeno → první řádek, jak dřív.
 */
export const productionMaxDaysOf = (
  order: any,
  productionOrder?: { line_item_id?: string | null; line_title?: string | null } | null
): number | null => {
  const collection = ((order?.payment_collections ?? []) as any[]).find(
    (candidate) => candidate?.metadata?.made_to_order
  )
  const lines = collection?.metadata?.production_lines
  if (!Array.isArray(lines) || !lines.length) return null
  const item = productionOrder?.line_item_id ? commissionLineOf(order, productionOrder) : null
  const own = item?.variant_id
    ? lines.find((line: any) => line?.variant_id === item.variant_id)
    : null
  const days = Number((own ?? lines[0])?.production_time_max_days)
  return Number.isFinite(days) && days > 0 ? Math.round(days) : null
}

/**
 * Předpokládané dokončení slovy: zadaný termín, jinak „do N dnů od zahájení
 * výroby (nejpozději d. m. rrrr)" z profilu. Bez obojího null — nic se nevymýšlí.
 */
export const estimatedCompletionText = (
  productionOrder: { estimated_completion_at?: unknown },
  maxDays: number | null,
  startedAt: Date
): string | null => {
  if (productionOrder?.estimated_completion_at) {
    return formatDate(productionOrder.estimated_completion_at)
  }
  if (maxDays) {
    const deadline = new Date(startedAt.getTime() + maxDays * DAY_MS)
    return `do ${maxDays} dnů od zahájení výroby (nejpozději ${formatDate(deadline)})`
  }
  return null
}

export const startProduction = async (
  container: MedusaContainer,
  { productionOrder, orderId }: StartProductionInput
): Promise<StartProductionResult> => {
  const madeToOrder = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const now = new Date()

  // Idempotence: e-mail už odešel → jen srovnat fázi (kdyby po odeslání
  // selhal zápis fáze nebo se akce zopakovala).
  if (productionOrder.production_start_notified_at) {
    const updated =
      productionOrder.stage === "in_production"
        ? productionOrder
        : await madeToOrder.updateProductionOrders({
            id: productionOrder.id,
            stage: "in_production",
            production_started_at: productionOrder.production_started_at
              ? new Date(productionOrder.production_started_at)
              : new Date(productionOrder.production_start_notified_at),
          } as never)
    return { production_order: updated, email_sent: false, already_notified: true }
  }

  if (productionOrder.stage !== "confirmed" && productionOrder.stage !== "in_production") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Tato akce není v aktuálním stavu zakázky dostupná."
    )
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = orders[0] as any
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }

  const previousStage = productionOrder.stage
  const previousStartedAt = productionOrder.production_started_at ?? null
  const startedAt = previousStartedAt ? new Date(previousStartedAt) : now

  let updated = await madeToOrder.updateProductionOrders({
    id: productionOrder.id,
    stage: "in_production",
    production_started_at: startedAt,
  } as never)

  const currency = String(order.currency_code || productionOrder.currency_code || "czk")
  const depositAmount = contractDepositAmountOf(productionOrder)
  const depositPercentage = Number(productionOrder.deposit_percentage) || null
  const key = productionStartEmailKey(productionOrder.id)

  const rollback = async () => {
    await madeToOrder
      .updateProductionOrders({
        id: productionOrder.id,
        stage: previousStage,
        production_started_at: previousStartedAt ? new Date(previousStartedAt) : null,
      } as never)
      .catch(() => undefined)
  }

  let emailId: string | null = null
  try {
    const sent = await sendCustomerEmail(container, {
      template: "production-started",
      to: order.email,
      key,
      orderId: order.id,
      data: {
        customerName: customerName(order),
        orderNumber: orderNumber(order),
        orderLink: orderLink(order),
        // Název a obrázek TÉTO položky (zakázka = položka, § 0c).
        productTitle: commissionTitleOf(order, productionOrder),
        productImageUrl: commissionImageOf(order, productionOrder),
        // Pražský čas — okamžik, od kterého platí Z5.
        startedAtText: formatPragueDateTime(now),
        depositAmount: formatMoney(depositAmount, currency),
        depositPercentage: depositPercentage !== null ? String(depositPercentage) : null,
        estimatedCompletion: estimatedCompletionText(
          productionOrder,
          productionMaxDaysOf(order, productionOrder),
          startedAt
        ),
      },
    })
    if (!sent) {
      throw new Error("Objednávka nemá e-mailovou adresu.")
    }

    // ID a stav notifikace: `createNotifications` ji zapíše pod dedupe klíčem
    // (a při opakování vrátí tu původní), stav `failure` = Resend odmítl.
    const notifications = container.resolve(Modules.NOTIFICATION)
    const rows = (await notifications.listNotifications(
      { idempotency_key: key } as never,
      { take: 1, order: { created_at: "DESC" } } as never
    )) as any[]
    const row = rows[0]
    if (!row || String(row.status ?? "").toLowerCase() === "failure") {
      throw new Error("Notifikace se nezapsala, nebo ji poskytovatel odmítl.")
    }
    emailId = String(row.id)
  } catch (error) {
    await rollback()
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `[zakázka] E-mail o zahájení výroby u ${orderId} neodešel — výroba zůstává nezahájená: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, PRODUCTION_START_EMAIL_FAILED)
  }

  updated = await madeToOrder.updateProductionOrders({
    id: productionOrder.id,
    production_start_notified_at: now,
    production_start_email_id: emailId,
  } as never)

  return { production_order: updated, email_sent: true, already_notified: false }
}
