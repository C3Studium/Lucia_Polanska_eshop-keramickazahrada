import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { notifyMerchant } from "../lib/notify"

/**
 * Záznam souhlasu s obchodními podmínkami u objednávky — serverové razítko.
 *
 * ## Odkud souhlas je
 *
 * Pokladna (i rychlý nákup) zapíše těsně před odesláním objednávky do
 * `cart.metadata` verze dokumentů a čas zaškrtnutí z prohlížeče
 * (`terms_version`, `terms_accepted_at`, `withdrawal_info_version`,
 * `privacy_version`, u zakázky `made_to_order_ack_at` +
 * `made_to_order_ack_version` — storefront `recordCheckoutConsent`). Medusa
 * metadata košíku při dokončení zkopíruje do `order.metadata`.
 *
 * ## Co dělá tenhle subscriber
 *
 * Čas z prohlížeče je tvrzení klienta. K němu dopíše `terms_recorded_at` =
 * serverový čas vzniku objednávky, takže důkaz souhlasu (§ 1820, § 1826 OZ)
 * stojí na čase, který zákazník nemohl ovlivnit. Medusa metadata SLUČUJE,
 * takže stačí poslat jen nový klíč — ostatní zůstanou (memory:
 * medusa-metadata-merge).
 *
 * Chybí-li souhlas u objednávky z košíku, je to chyba pokladny → upozornění
 * (zvonek v administraci + e-mail vývojáři). Objednávka se NIKDY neblokuje:
 * placené objednávky dokončuje webhook ComGate až po zaplacení, zastavit ji
 * by znamenalo ztratit zaplacenou objednávku. Ruční objednávky z administrace
 * (koncept → objednávka) košík nemají a souhlas mít nemůžou — u nich se jen
 * zaloguje.
 */

export type ConsentStampPlan =
  | { action: "stamp"; patch: { terms_recorded_at: string } }
  | { action: "already-stamped" }
  | { action: "missing" }
  | { action: "manual-order" }

const filled = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

/** Čistá funkce: co s objednávkou udělat. */
export const planConsentStamp = (input: {
  metadata: Record<string, unknown> | null | undefined
  /** Vznikla objednávka z košíku (pokladna), nebo ručně v administraci? */
  fromCart: boolean
  now: Date
}): ConsentStampPlan => {
  const metadata = input.metadata ?? {}
  if (!filled(metadata.terms_version)) {
    return input.fromCart ? { action: "missing" } : { action: "manual-order" }
  }
  if (filled(metadata.terms_recorded_at)) {
    return { action: "already-stamped" }
  }
  return { action: "stamp", patch: { terms_recorded_at: input.now.toISOString() } }
}

export default async function orderConsentHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderId = data?.id
  if (!orderId) return

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "metadata"],
      filters: { id: orderId },
    })
    const order = orders[0] as any
    if (!order) return

    // Objednávka z pokladny má vazbu na košík; koncept z administrace ne.
    let fromCart = true
    try {
      const { data: withCart } = await query.graph({
        entity: "order",
        fields: ["id", "cart.id"],
        filters: { id: orderId },
      })
      fromCart = Boolean((withCart[0] as any)?.cart?.id)
    } catch {
      // Vazbu se nepodařilo přečíst — raději upozornit než mlčet.
      fromCart = true
    }

    const plan = planConsentStamp({
      metadata: order.metadata,
      fromCart,
      now: new Date(),
    })

    switch (plan.action) {
      case "stamp": {
        const orderModule = container.resolve(Modules.ORDER) as any
        await orderModule.updateOrders([{ id: orderId, metadata: plan.patch }])
        logger.info(
          `[souhlas] Objednávka #${order.display_id}: souhlas s OP (verze ${order.metadata?.terms_version}) orazítkován serverovým časem.`
        )
        return
      }
      case "already-stamped":
        return
      case "manual-order":
        logger.info(
          `[souhlas] Objednávka #${order.display_id} nevznikla z košíku (ruční z administrace) — záznam souhlasu s OP nemá.`
        )
        return
      case "missing":
        logger.warn(
          `[souhlas] Objednávka #${order.display_id} (${orderId}) nemá záznam souhlasu s OP — objednávka běží dál.`
        )
        await notifyMerchant(container, {
          key: `mn:order-consent-missing:${orderId}`,
          title: `Objednávka #${order.display_id} bez záznamu souhlasu s obchodními podmínkami`,
          description:
            "Pokladna k objednávce neuložila verzi obchodních podmínek ani čas souhlasu. Objednávka platí a vyřizuje se normálně — jde o chybu záznamu, kterou je potřeba prověřit v kódu pokladny.",
          audience: "dev",
          email: true,
          resource: { id: orderId, type: "order" },
        }).catch((error) =>
          logger.warn(
            `[souhlas] Upozornění se nepodařilo odeslat: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        )
        return
    }
  } catch (error) {
    // Fail-open: záznam souhlasu nesmí shodit ani zdržet objednávku.
    logger.warn(
      `[souhlas] Souhlas u objednávky ${orderId} se nepodařilo zpracovat: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
