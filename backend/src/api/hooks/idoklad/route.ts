import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { captureDobirkaPayment } from "../../../lib/dobirka-capture"
import { resolveIdokladService } from "../../../lib/idoklad-invoice"
import {
  extractIdokladDelivery,
  IDOKLAD_SIGNATURE_HEADER,
  invoicePaymentVerdict,
  isInvoicePaymentEvent,
  verifyIdokladSignature,
} from "../../../lib/idoklad-webhook"
import { notifyMerchant } from "../../../lib/notify"
import {
  IDOKLAD_METADATA_KEYS,
  type IdokladIssuedInvoice,
} from "../../../modules/idoklad/types"

/**
 * Payment reports from iDoklad (v3 webhooks) — the automatic version of the
 * „Peníze přišly (dobírka)" button.
 *
 * Tok v praxi: Česká pošta pošle vybranou dobírku na účet (VS = číslo
 * objednávky), iDoklad platbu z bankovního výpisu spáruje s fakturou
 * (vystavenou při předání dopravci) → vznikne úhrada → iDoklad zavolá sem
 * `PaymentCreated` na `IssuedInvoice` → zapíšeme dobírku jako přijatou.
 *
 * Public by construction, like `/hooks/newsletter-events`: iDoklad holds no
 * credentials of ours, so every request must prove itself — with the HMAC
 * signature `X-idoklad-signature: sha256=<HEX>` over the RAW body, keyed by
 * the webhook's secret token (`IDOKLAD_WEBHOOK_SECRET`). The raw body exists
 * only because middlewares.ts asks for `preserveRawBody` on this route. Exact
 * format: `lib/idoklad-webhook.ts`.
 *
 * Response contract, matching the newsletter-events route:
 * - 503 — secret not configured; nothing can be verified, retry later.
 * - 401 — signature missing/wrong; not from our iDoklad registration.
 * - 200 — verified. Other event types, unknown invoices, partial payments and
 *   orders that are not dobírka are logged and skipped (a retry would not
 *   change them); duplicates are acknowledged without capturing twice.
 * - 500 — a real processing error; iDoklad should retry.
 */

let warnedMissingSecret = false

const handleInvoicePayment = async (
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
  let invoice: IdokladIssuedInvoice
  try {
    invoice = await idoklad.getInvoice(invoiceId)
  } catch (error) {
    // Faktura jiné agendy / smazaná — retry by nic nezměnil.
    logger.warn(
      `[idoklad] Fakturu ${invoiceId} z hlášení o úhradě se nepodařilo načíst — přeskočeno. (${
        error instanceof Error ? error.message : "neznámá chyba"
      })`
    )
    return
  }

  const parsed = Number(String(invoice?.VariableSymbol ?? "").trim())
  const variableSymbol = Number.isFinite(parsed) && parsed > 0 ? parsed : null
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
   * `PaymentCreated` chodí i na ČÁSTEČNOU úhradu. Dobírka se zapisuje jen
   * celá — částečná platba (jiná částka na účtu, chyba párování) jde
   * majitelce k ručnímu posouzení, nikdy rovnou do pokladny.
   */
  const verdict = invoicePaymentVerdict(invoice)
  if (verdict !== "paid") {
    if (verdict === "partial") {
      await notifyMerchant(container, {
        key: `mn:dobirka-castecne:${order.id}:${invoiceId}`,
        title: `Objednávka #${order.display_id}: iDoklad hlásí jen částečnou úhradu faktury`,
        description:
          "K faktuře přišla platba, ale ne celá částka. Dobírka se proto NEZAPSALA jako přijatá — zkontrolujte výpis a případně použijte „Peníze přišly (dobírka)“.",
        audience: "owner",
        email: true,
        resource: { id: order.id, type: "order" },
      }).catch(() => undefined)
    }
    logger.info(
      `[idoklad] Objednávka #${order.display_id}: faktura ${invoiceId} není uhrazená celá (${verdict}) — nic se nezapisuje.`
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
    // reaches "already" below and never gets here twice anyway.
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

const rawBodyOf = (req: MedusaRequest): string | Buffer | null => {
  const raw = (req as unknown as { rawBody?: unknown }).rawBody
  if (Buffer.isBuffer(raw)) {
    return raw
  }
  if (typeof raw === "string") {
    return raw
  }
  return null
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const secret = process.env.IDOKLAD_WEBHOOK_SECRET
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true
      logger.warn(
        "[idoklad] IDOKLAD_WEBHOOK_SECRET není nastaven — hlášení o úhradách z iDokladu se zatím nepřijímají a dobírky se párují jen ručně."
      )
    }
    res.status(503).json({ ok: false })
    return
  }

  // Bez surového těla nejde podpis ověřit — přeserializovaný JSON by se
  // lišil v mezerách. Chybí-li, je rozbitá konfigurace (middlewares.ts).
  const raw = rawBodyOf(req)
  if (raw === null) {
    logger.error(
      "[idoklad] Chybí surové tělo požadavku (preserveRawBody pro /hooks/idoklad) — podpis nejde ověřit."
    )
    res.status(500).json({ ok: false })
    return
  }

  const signatureOk = verifyIdokladSignature({
    secret,
    header: req.headers[IDOKLAD_SIGNATURE_HEADER] as string | string[] | undefined,
    payload: raw,
  })
  if (!signatureOk) {
    logger.warn(
      `[idoklad] Odmítnuto hlášení s neplatným podpisem (${
        req.headers[IDOKLAD_SIGNATURE_HEADER] ? "podpis nesedí" : "bez podpisu"
      }).`
    )
    res.status(401).json({ ok: false })
    return
  }

  let body: unknown = req.body
  if (!body || typeof body !== "object") {
    try {
      body = JSON.parse(Buffer.isBuffer(raw) ? raw.toString("utf8") : raw)
    } catch {
      logger.warn("[idoklad] Podepsané hlášení nešlo přečíst — přeskočeno.")
      res.status(200).json({ received: true })
      return
    }
  }

  const delivery = extractIdokladDelivery(body)
  const paymentEvents = delivery.events.filter(isInvoicePaymentEvent)
  if (!paymentEvents.length) {
    // Verified, but not an invoice-payment event — acknowledged and skipped.
    logger.info(
      `[idoklad] Hlášení ${delivery.delivery_id ?? ""} jiného typu než úhrada faktury — přeskočeno.`
    )
    res.status(200).json({ received: true })
    return
  }

  try {
    for (const event of paymentEvents) {
      await handleInvoicePayment(req.scope, event.entity_id as number, logger)
    }
    res.status(200).json({ received: true })
  } catch (error) {
    logger.error(
      `[idoklad] Hlášení o úhradě ${delivery.delivery_id ?? ""} se nepodařilo zpracovat: ${
        error instanceof Error ? error.message : "neznámá chyba"
      }`
    )
    res.status(500).json({ ok: false })
  }
}
