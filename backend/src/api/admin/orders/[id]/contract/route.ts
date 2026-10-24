import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendCustomerEmail } from "../../../../../lib/customer-email"
import { orderLink } from "../../../../../lib/storefront-url"
import {
  buildOrderCommissionConfirmations,
  buildOrderConfirmation,
  isCommissionCheckoutOrder,
} from "../../../../../lib/potvrzeni-zakazky"

/**
 * „Doposlat potvrzení smlouvy" — ruční náprava, když se PDF nepovedlo.
 *
 * ## Proč to existuje
 *
 * Potvrzení objednávky nikdy nečeká na dokument: selže-li generování nebo
 * upload, e-mail odejde bez přílohy a chyba jde do logu. To je správně —
 * zákazník nesmí zůstat bez potvrzení kvůli souboru. Jenže tím vzniká dluh,
 * který dosud nešlo splatit: potvrzení smlouvy v textové podobě (§ 1827
 * odst. 2 OZ) poslané nebylo a nic to nepřipomínalo.
 *
 * Tohle tlačítko ten dluh splatí. Dokument se vyrobí znovu (u objednávky se
 * zakázkami každý zvlášť) a odejde samostatným e-mailem, který říká, proč
 * chodí dodatečně. Neopakuje celé potvrzení objednávky — druhá kopie všeho
 * by byla horší než ten původní výpadek.
 *
 * Je to idempotentní v tom smyslu, na kterém záleží: PDF se ukládá pod
 * pevný klíč podle otisku obsahu, takže opakované doposlání nevyrobí nový
 * soubor. E-mail se ale pošle pokaždé — to je účel tlačítka.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderId = req.params.id

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "customer.first_name",
      "customer.last_name",
      "billing_address.first_name",
      "billing_address.last_name",
      "payment_collections.metadata",
    ],
    filters: { id: orderId },
  })
  const order = orders?.[0] as any

  if (!order) {
    res.status(404).json({ message: "Objednávka nebyla nalezena." })
    return
  }
  if (!order.email) {
    res.status(400).json({
      message: "Objednávka nemá e-mail — dokument nemá kam odejít.",
    })
    return
  }

  const jeZakazka = isCommissionCheckoutOrder(order)

  /* Zakázková objednávka má potvrzení na každou zakázku zvlášť. */
  let dokumenty: { filename: string; url: string }[] = []
  try {
    if (jeZakazka) {
      const built = await buildOrderCommissionConfirmations(req.scope, orderId)
      for (const failure of built.failures) {
        logger.error(
          `[doposlání smlouvy] Zakázka ${failure.production_order_id} u objednávky ${orderId}: ${
            failure.error instanceof Error ? failure.error.message : String(failure.error)
          }`
        )
      }
      dokumenty = built.results.map((item) => item.attachment)
    } else {
      dokumenty = [(await buildOrderConfirmation(req.scope, orderId)).attachment]
    }
  } catch (error) {
    logger.error(
      `[doposlání smlouvy] Objednávka ${orderId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    res.status(502).json({
      message:
        "Dokument se nepodařilo vyrobit. Zkuste to prosím za chvíli; když to bude trvat, ozvěte se vývojáři.",
    })
    return
  }

  if (!dokumenty.length) {
    res.status(502).json({
      message: "Dokument se nepodařilo vyrobit — nevzniklo žádné PDF.",
    })
    return
  }

  const jmeno =
    [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") ||
    [order.billing_address?.first_name, order.billing_address?.last_name]
      .filter(Boolean)
      .join(" ") ||
    undefined

  const nazev = jeZakazka
    ? dokumenty.length > 1
      ? "Potvrzení zakázek"
      : "Potvrzení zakázky"
    : "Potvrzení objednávky"

  const sent = await sendCustomerEmail(req.scope, {
    template: "contract-resent",
    to: order.email,
    /* Klíč nese čas, protože tlačítko má jít stisknout víckrát — na rozdíl
       od automatických e-mailů, které se dedupují schválně. */
    key: `contract-resent:${orderId}:${Date.now()}`,
    orderId,
    data: {
      customerName: jmeno,
      orderNumber: order.display_id ? String(order.display_id) : "",
      documentTitle: nazev,
      documentUrl: dokumenty[0]?.url ?? "",
      orderLink: orderLink(order),
    },
    attachments: dokumenty,
  }).catch((error) => {
    logger.error(
      `[doposlání smlouvy] E-mail k objednávce ${orderId} se nepodařilo odeslat: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return false
  })

  if (!sent) {
    res.status(502).json({
      message:
        "Dokument je hotový, ale e-mail se nepodařilo odeslat. Zkuste to prosím znovu.",
    })
    return
  }

  logger.info(
    `[doposlání smlouvy] Objednávka #${order.display_id ?? orderId}: odesláno ${dokumenty.length}× ${nazev.toLowerCase()}.`
  )

  res.json({
    sent: true,
    documents: dokumenty.map((item) => ({ filename: item.filename, url: item.url })),
  })
}
