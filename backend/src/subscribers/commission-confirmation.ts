import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { buildOrderCommissionConfirmations } from "../lib/potvrzeni-zakazky"
import { listCommissionsOfOrder } from "../lib/made-to-order/orders-of"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"
import { sendOrderConfirmationWorkflow } from "../workflows/send-order-confirmation"

/**
 * Potvrzení objednávky se zakázkou (LEGAL_AUDIT § 0, Z11): PDF „Potvrzení
 * zakázky" v příloze potvrzovacího e-mailu spolu s OP — od 20. 10. 2026
 * (§ 0c, zakázka = položka) JEDNO PDF NA KAŽDOU zakázku objednávky
 * (`Potvrzeni-zakazky-<číslo>-<n>.pdf`), všechna v JEDNOM potvrzení.
 *
 * Proč zvláštní subscriber: `order.placed` obsluhuje potvrzovací e-mail
 * i založení zakázek souběžně (závod). U objednávky se zakázkou proto
 * `order-placed-email` potvrzení NEPOSÍLÁ a čeká se na event
 * `made-to-order.production-orders-created`, který `initialize-merchant-order`
 * emituje NA KONCI — všechny zakázky se smluvní zálohou už existují.
 *
 * Zákazník nesmí zůstat bez potvrzení objednávky: když PDF selže (generování,
 * upload) u některé zakázky, potvrzení se pošle stejně, jen bez té přílohy,
 * a chyba jde do logu jako error. Dedupe e-mailu zůstává jeden klíč na
 * objednávku (`order-placed:<id>` ve workflow) — dvě potvrzení nikdy neodejdou.
 */

export const COMMISSION_CONFIRMATION_EVENT = "made-to-order.production-orders-created"

type EventPayload = {
  order_id: string
  production_order_ids?: string[]
  /** Starý tvar eventu (jedna zakázka na objednávku) — kdyby ve frontě zůstal. */
  production_order_id?: string
}

/**
 * Souhlasy ukládá pokladna do metadat košíku (kopie do objednávky je okamžitá),
 * serverové razítko `terms_recorded_at` dopisuje subscriber `order-consent`
 * souběžně — PDF chce obojí, proto se na něj krátce čeká.
 */
export const consentReady = (metadata: Record<string, unknown> | null | undefined): boolean => {
  const filled = (key: string) => typeof metadata?.[key] === "string" && String(metadata?.[key]).trim().length > 0
  return filled("terms_accepted_at") && filled("made_to_order_ack_at") && filled("terms_recorded_at")
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const CONSENT_WAIT_ATTEMPTS = 3
export const CONSENT_WAIT_MS = 1500

export default async function commissionConfirmationHandler({
  event: { data },
  container,
}: SubscriberArgs<EventPayload>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderId = data?.order_id
  if (!orderId) return

  const madeToOrder = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
  const commissions = await listCommissionsOfOrder(container, orderId)
  if (!commissions.length) {
    logger.error(`[potvrzení zakázky] Event ${COMMISSION_CONFIRMATION_EVENT} pro ${orderId}, ale žádná zakázka neexistuje — potvrzení objednávky posílám bez PDF.`)
  } else if (commissions.every((commission) => commission.confirmation_sent_at)) {
    // Doručení eventu je „aspoň jednou" — potvrzení už odešlo.
    return
  }

  // Opačný závod: event může přijít dřív, než jsou u objednávky všechny souhlasy.
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  for (let attempt = 1; attempt <= CONSENT_WAIT_ATTEMPTS; attempt += 1) {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "metadata"],
      filters: { id: orderId },
    })
    const order = orders?.[0] as any
    if (order && consentReady(order.metadata)) break
    if (attempt === CONSENT_WAIT_ATTEMPTS) {
      logger.warn(
        `[potvrzení zakázky] Objednávka #${order?.display_id ?? orderId} nemá po ${attempt} pokusech všechny záznamy souhlasů — PDF vzniká s tím, co je.`
      )
      break
    }
    await sleep(CONSENT_WAIT_MS)
  }

  const built = commissions.length
    ? await buildOrderCommissionConfirmations(container, orderId)
    : { results: [], failures: [] }
  for (const failure of built.failures) {
    logger.error(
      `[potvrzení zakázky] PDF k objednávce ${orderId} (zakázka ${failure.production_order_id}) se nepodařilo vytvořit: ${
        failure.error instanceof Error ? failure.error.message : String(failure.error)
      } — potvrzení objednávky odchází bez něj.`
    )
  }

  const { result } = await sendOrderConfirmationWorkflow(container).run({
    input: {
      id: orderId,
      commission_confirmations: built.results.map((item) => item.attachment),
    },
  })

  // `confirmation_sent_at` jen u zakázek, jejichž PDF opravdu šlo v příloze.
  const attachedUrls = new Set<string>(((result as any)?.commission_attached_urls ?? []) as string[])
  const sentAt = new Date()
  for (const item of built.results) {
    if (!attachedUrls.has(item.attachment.url)) continue
    await madeToOrder.updateProductionOrders({
      id: item.production_order_id,
      confirmation_sent_at: sentAt,
    } as never)
  }
}

export const config: SubscriberConfig = {
  event: COMMISSION_CONFIRMATION_EVENT,
}
