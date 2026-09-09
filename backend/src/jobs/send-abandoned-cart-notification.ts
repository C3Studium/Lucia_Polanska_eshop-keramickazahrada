import { MedusaContainer } from "@medusajs/framework/types"
import { sendAbandonedCartsWorkflow, SendAbandonedCartsWorkflowInput } from "../workflows/send-abandoned-carts"

export default async function abandonedCartJob(
  container: MedusaContainer
) {
  const logger = container.resolve("logger")
  const query = container.resolve("query")

  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)
  // oneDayAgo.setMinutes(oneDayAgo.getMinutes() - 1) // For testing
  const limit = 100
  let offset = 0
  let totalCount = 0
  let abandonedCartsCount = 0
  do {
    const { 
      data: abandonedCarts, 
      metadata
    } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "email",
        // Šablona podle ní formátuje ceny. Nebyla tu, takže do e-mailu
        // nikdy nedorazila (ověřeno na uložených datech notifikací) a
        // šablona padala na svou nouzovou "CZK" — u jiné měny by ukázala
        // špatné částky.
        "currency_code",
        "items.*",
        "metadata",
        // Náhradní zdroj jména, když košík nemá přihlášeného zákazníka.
        // Krok se na ni odkazuje, ale dotaz ji nikdy nevracel.
        "shipping_address.*",
        "customer.*"
      ],
      filters: {
        updated_at: {
          $lt: oneDayAgo
        },
        email: {
          $ne: null
        },
        completed_at: null,
      },
      pagination: {
        skip: offset,
        take: limit
      }
    })
  
    totalCount = metadata?.count ?? 0
    const cartsWithItems = abandonedCarts.filter(cart => cart.items?.length > 0 && !cart.metadata?.abandoned_notification)
  
    // Prázdnou stránku nemá smysl posílat do workflow — `updateCartsStep`
    // by dostal prázdné pole.
    if (cartsWithItems.length) {
      try {
        await sendAbandonedCartsWorkflow(container).run({
          input: {
            carts: cartsWithItems
          } as unknown as SendAbandonedCartsWorkflowInput
        })
        abandonedCartsCount += cartsWithItems.length

      } catch (error) {
        logger.error(
          `Failed to send abandoned cart notification: ${error.message}`
        )
      }
    }
  
    offset += limit
  } while (offset < totalCount)

  logger.info(`Sent ${abandonedCartsCount} abandoned cart notifications`)
}

/*
 * DOČASNĚ VYPNUTO (9. 9. 2026) — zapnout zpět po ověření, viz TODO.md.
 *
 * Úloha je opravená (vlny po 8 místo stovky naráz, razítkují se jen vyřízené
 * košíky), ale ověřit se to dneska nedalo: denní strop Resendu je 100 zpráv
 * a je vyčerpaný. Kdyby běžela dnes ve 2:00, spálila by čerstvou stovku na
 * zítřek během první sekundy — a zákazníkům by pak celý den nechodila ani
 * potvrzení objednávek.
 *
 * Ve frontě čeká 317 košíků, drtivá většina testovacích. Zapnout až po tom,
 * co se vyčistí a co se rozhodne, jak se má 100 zpráv denně dělit mezi
 * upomínky a provozní e-maily.
 *
 * Zapnutí = vrátit `schedule` níž. Nic jiného se měnit nemusí.
 */
export const config = {
  name: "abandoned-cart-notification",
  // schedule: "0 0 * * *"  ← původní rozvrh, každou půlnoc UTC
  //
  // 29. února: nejbližší spuštění je 2028, tedy prakticky nikdy. Úmyslně
  // takhle, a ne smazáním souboru ani odstraněním `config` — takhle je
  // v kódu vidět, že úloha existuje, a proč mlčí.
  schedule: "0 0 29 2 *"
}
