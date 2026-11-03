import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  autoCodeIssued,
  createLoyaltyCode,
  getLoyaltySettings,
  loadLoyaltyPerson,
  loadNewsletterStatus,
  sendLoyaltyCodeEmail,
} from "../lib/loyalty-code"
import { decideAutomaticLoyaltyCode, paidOrderCount } from "../lib/loyalty-code-rules"
import { jeZkusebniRezim } from "../lib/test-mode"

/**
 * Automatický slevový kód „po N. zaplacené objednávce" (Zákazníci+ →
 * Kód pro stálé zákazníky). Výchozím vypnuto.
 *
 * ## Proč `payment.captured`
 *
 * „Zaplacená" znamená zachycené peníze, ne vytvořená objednávka — dobírka
 * nebo osobní odběr se zaplatí až později a `order.placed` by kód rozdal
 * za objednávku, která se ještě může zrušit. Na `payment.captured` je
 * spolehnutí: vydává ho brána, ruční „Zaplaceno" i dobírka, a kde ji
 * dokončení košíku nevydá, dorovná ji `emit-capture-on-order-placed`.
 *
 * ## Proč se nic nezdvojí
 *
 * Událost přijde i dvakrát (oznámení brány + dorovnání), u zakázky ještě za
 * zálohu a za doplatek. Kód pro hranici má pevný identifikátor kampaně
 * (unikátní v databázi): když už existuje, automat skončí; při souběhu
 * dvou běhů druhý najde kód prvního a e-mail se stejným klíčem znovu
 * neodejde.
 */
export default async function loyaltyCodeAuto({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (!data?.id) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const settings = await getLoyaltySettings(container)
    if (!settings.auto_enabled) return

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: payments } = await query.graph({
      entity: "payment",
      fields: ["id", "payment_collection.order.id", "payment_collection.order.email", "payment_collection.order.customer_id"],
      filters: { id: data.id },
    })
    const order = (payments as any[])[0]?.payment_collection?.order
    if (!order?.id) return

    const testMode = await jeZkusebniRezim(container)
    const person = await loadLoyaltyPerson(container, {
      customerId: order.customer_id ?? null,
      email: order.email ?? null,
    })

    // Levné otázky napřed — u hosta, ve zkušebním režimu a bez adresy se
    // objednávky ani newsletter vůbec nečtou.
    const early = decideAutomaticLoyaltyCode({
      settings,
      testMode,
      registered: Boolean(person?.registered),
      email: person?.email,
      newsletterEligible: true,
      paidOrders: Number.MAX_SAFE_INTEGER,
      alreadyIssued: false,
    })
    if (!early.send || !person) return

    const orderFields = [
      "id",
      "status",
      "canceled_at",
      "payment_collections.status",
      "payment_collections.payments.captured_at",
    ]
    const [byCustomer, byEmail] = await Promise.all([
      query.graph({
        entity: "order",
        fields: orderFields,
        filters: { customer_id: person.customerIds } as never,
        pagination: { take: 500, skip: 0 },
      }),
      person.email
        ? query.graph({
            entity: "order",
            fields: orderFields,
            filters: { email: person.email } as never,
            pagination: { take: 500, skip: 0 },
          })
        : { data: [] as any[] },
    ])
    const paidOrders = paidOrderCount([...(byCustomer.data as any[]), ...(byEmail.data as any[])])

    const newsletter = await loadNewsletterStatus(container, person.email)
    const enough = paidOrders >= settings.after_orders && newsletter.eligible
    // Kód pro tuhle hranici už má → automat končí. Nezdařený e-mail se
    // zopakuje z Přehled → E-maily, ne další platbou (kód mezitím mohl propadnout).
    const alreadyIssued = enough
      ? await autoCodeIssued(container, person, settings.after_orders)
      : false
    const decision = decideAutomaticLoyaltyCode({
      settings,
      testMode,
      registered: person.registered,
      email: person.email,
      newsletterEligible: newsletter.eligible,
      paidOrders,
      alreadyIssued,
    })
    if (!decision.send) {
      if (decision.reason === "no-newsletter") {
        logger.info(
          `[slevový kód] ${person.email} má ${paidOrders} zaplacených objednávek, ale neodebírá newsletter — automatický kód nepošlu.`
        )
      }
      return
    }

    // Souběh dvou plateb: druhý běh najde kampaň založenou prvním (pevný
    // identifikátor) a pošle tentýž e-mail se stejným klíčem — neodejde dvakrát.
    const code = await createLoyaltyCode(container, {
      person,
      percentage: settings.percentage,
      validDays: settings.valid_days,
      afterOrders: settings.after_orders,
    })
    await sendLoyaltyCodeEmail(container, { person, code, orderId: order.id })
    if (code.created) {
      logger.info(
        `[slevový kód] Automatický kód ${code.code} (${code.percentage} %) po ${paidOrders}. zaplacené objednávce → ${person.email}.`
      )
    }
  } catch (error) {
    // Kód je dárek navíc — jeho chyba nesmí shodit nic kolem platby.
    logger.error(
      `[slevový kód] Automatický kód po platbě ${data.id} se nepodařil: ${(error as Error)?.message ?? error}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
