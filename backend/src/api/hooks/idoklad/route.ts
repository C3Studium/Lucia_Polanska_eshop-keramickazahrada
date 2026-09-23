import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { captureDobirkaPayment } from "../../../lib/dobirka-capture"
import { resolveIdokladService } from "../../../lib/idoklad-invoice"
import {
  extractIdokladEvents,
  isInvoicePaidEvent,
  publicIdMatches,
} from "../../../lib/idoklad-webhook"
import { notifyMerchant } from "../../../lib/notify"
import { IDOKLAD_METADATA_KEYS } from "../../../modules/idoklad/types"

/**
 * Payment reports from iDoklad (v3 webhooks) — the automatic version of the
 * „Peníze přišly (dobírka)" button.
 *
 * Public by construction, like `/hooks/newsletter-events`: iDoklad holds no
 * credentials of ours, so every request must prove itself — here with the
 * webhook registration's PublicId compared constant-time against
 * `IDOKLAD_WEBHOOK_PUBLIC_ID` (see `lib/idoklad-webhook.ts` for the exact
 * event semantics assumed).
 *
 * Response contract, matching the newsletter-events route:
 * - 503 — PublicId env not configured; nothing can be verified, retry later.
 * - 401 — PublicId missing/wrong; not from our iDoklad registration.
 * - 200 — verified. Unhandled event types, unknown invoices and orders that
 *   are not dobírka are logged and skipped (a retry would not change them);
 *   duplicates are acknowledged without capturing twice.
 * - 500 — a real processing error; iDoklad should retry.
 *
 * What a verified invoice-paid event does: resolves the order through the
 * invoice's VariableSymbol (= the order's display_id, cross-checked against
 * `order.metadata.idoklad_invoice_id`), records the iDoklad payment stamp so
 * the capture subscriber does not pay the invoice in iDoklad a second time,
 * and runs the SAME capture core as the manual button. The owner gets one
 * idempotency-keyed notification per order.
 */

let warnedMissingPublicId = false

const handleInvoicePaid = async (
  container: MedusaContainer,
  invoiceId: number,
  logger: Logger
): Promise<void> => {
  const idoklad = resolveIdokladService(container)
  if (!idoklad) {
    logger.warn(
      `[idoklad] Hlášení o úhradě faktury ${invoiceId} přišlo, ale iDoklad není nakonfigurován — přeskočeno.`
    )
    return
  }

  // The event carries only the invoice id; the invoice's VariableSymbol is
  // the order's display_id (that is how the invoice was issued).
  let variableSymbol: number | null = null
  try {
    const invoice = await idoklad.getInvoice(invoiceId)
    const parsed = Number(String(invoice?.VariableSymbol ?? "").trim())
    variableSymbol = Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch (error) {
    logger.warn(
      `[idoklad] Fakturu ${invoiceId} z hlášení o úhradě se nepodařilo načíst — přeskočeno. (${
        error instanceof Error ? error.message : "neznámá chyba"
      })`
    )
    return
  }

  if (!variableSymbol) {
    logger.warn(
      `[idoklad] Faktura ${invoiceId} nemá variabilní symbol s číslem objednávky — přeskočeno.`
    )
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { display_id: variableSymbol },
  })

  // The metadata stamp is the authoritative cross-check: the display_id match
  // alone must never be enough to move money on the ledger.
  const order = (orders as any[]).find(
    (candidate) =>
      Number(
        ((candidate?.metadata ?? {}) as Record<string, unknown>)[
          IDOKLAD_METADATA_KEYS.invoiceId
        ]
      ) === invoiceId
  )
  if (!order) {
    logger.warn(
      `[idoklad] K faktuře ${invoiceId} (VS ${variableSymbol}) nepatří žádná objednávka — přeskočeno.`
    )
    return
  }

  /*
   * iDoklad already knows about the payment — that is what this webhook says.
   * Stamping `idoklad_invoice_paid_at` BEFORE capturing makes the
   * `payment.captured` subscriber's `markInvoicePaidForOrder` a no-op, so the
   * invoice is never paid in iDoklad a second time.
   */
  const metadata = (order.metadata ?? {}) as Record<string, unknown>
  if (!metadata[IDOKLAD_METADATA_KEYS.paidAt]) {
    const orderModule = container.resolve(Modules.ORDER)
    await orderModule.updateOrders([
      {
        id: order.id,
        metadata: {
          ...metadata,
          [IDOKLAD_METADATA_KEYS.paidAt]: new Date().toISOString(),
        },
      },
    ] as never)
  }

  const result = await captureDobirkaPayment(container, order.id, {
    capturedBy: "idoklad-webhook",
  })

  if (result.outcome === "captured") {
    // Owner notification, idempotency-keyed per order — a redelivered webhook
    // reaches "already" above and never gets here twice anyway.
    await notifyMerchant(container, {
      key: `mn:dobirka-sparovana:${order.id}`,
      title: `Dobírka u objednávky #${order.display_id} spárována s platbou`,
      description:
        "iDoklad ohlásil úhradu faktury a peníze z dobírky jsou zapsané jako přijaté.",
      audience: "owner",
      email: true,
      resource: { id: order.id, type: "order" },
    }).catch(() => undefined)
    return
  }

  if (result.outcome === "already") {
    logger.info(
      `[idoklad] Objednávka #${order.display_id}: úhrada z hlášení už byla zapsaná dřív — nic se nemění.`
    )
    return
  }

  // A paid invoice on a card order: iDoklad echoes back the payment we
  // recorded ourselves. Nothing to capture.
  logger.info(
    `[idoklad] Objednávka #${order.display_id}: hlášení o úhradě se netýká dobírky — přeskočeno.`
  )
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const expectedPublicId = process.env.IDOKLAD_WEBHOOK_PUBLIC_ID
  if (!expectedPublicId) {
    if (!warnedMissingPublicId) {
      warnedMissingPublicId = true
      logger.warn(
        "[idoklad] IDOKLAD_WEBHOOK_PUBLIC_ID není nastaven — hlášení o úhradách z iDokladu se zatím nepřijímají a dobírky se párují jen ručně."
      )
    }
    res.status(503).json({ ok: false })
    return
  }

  const events = extractIdokladEvents(req.body)

  const verified = events.filter((event) =>
    publicIdMatches(event.public_id, expectedPublicId)
  )
  if (!verified.length) {
    logger.warn(
      "[idoklad] Odmítnuto hlášení bez platného identifikátoru registrace."
    )
    res.status(401).json({ ok: false })
    return
  }

  const paidEvents = verified.filter(isInvoicePaidEvent)
  if (!paidEvents.length) {
    // Verified, but not an invoice-paid event — acknowledged and skipped.
    logger.info("[idoklad] Hlášení jiného typu než úhrada faktury — přeskočeno.")
    res.status(200).json({ received: true })
    return
  }

  try {
    for (const event of paidEvents) {
      await handleInvoicePaid(req.scope, event.entity_id as number, logger)
    }
    res.status(200).json({ received: true })
  } catch (error) {
    logger.error(
      `[idoklad] Hlášení o úhradě se nepodařilo zpracovat: ${
        error instanceof Error ? error.message : "neznámá chyba"
      }`
    )
    res.status(500).json({ ok: false })
  }
}
