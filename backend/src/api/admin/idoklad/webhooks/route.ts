import { randomUUID } from "crypto"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { BACKEND_URL } from "../../../../lib/constants"
import { resolveIdokladService } from "../../../../lib/idoklad-invoice"
import {
  IDOKLAD_SIGNATURE_HEADER,
  IDOKLAD_WEBHOOK_ACTION_PAYMENT_CREATED,
  IDOKLAD_WEBHOOK_ENTITY_ISSUED_INVOICE,
  signIdokladPayload,
} from "../../../../lib/idoklad-webhook"
import { IDOKLAD_METADATA_KEYS } from "../../../../modules/idoklad/types"

/**
 * Napojení webhooku iDokladu (hlášení o úhradách → automatické párování
 * dobírek). Postup je ve třech krocích, první dělá člověk:
 *
 * 1. Developer portál (developer.idoklad.cz): založit webhook s cílovou URL
 *    `target_url` (níže) a secret tokenem → portál přidělí PublicId.
 * 2. Railway env: `IDOKLAD_WEBHOOK_SECRET` (secret token) a
 *    `IDOKLAD_WEBHOOK_PUBLIC_ID` (PublicId).
 * 3. `POST` sem s `{ "action": "subscribe" }` — přihlásí agendu e-shopu
 *    k webhooku pro úhrady vydaných faktur (`POST /v3/Webhooks`).
 *
 * `{ "action": "test", "order_id": "…" }` pak pošle na vlastní
 * `/hooks/idoklad` zkušební doručení přesně ve formátu iDokladu (podepsané
 * týmž secretem) pro fakturu té objednávky — ověří celou cestu (surové tělo,
 * podpis, dohledání objednávky, kontrolu úhrady). Nic nezapíše, dokud faktura
 * v iDokladu opravdu není uhrazená celá.
 *
 * GET vrací stav: co je nastavené a jaké přihlášení agenda má.
 */

const targetUrl = () => `${BACKEND_URL.replace(/\/+$/, "")}/hooks/idoklad`

const describe = (subscription: {
  Id: number
  PublicId: string
  EntityType: number
  ActionType: number
}) => ({
  id: subscription.Id,
  public_id: subscription.PublicId,
  entity_type: subscription.EntityType,
  action_type: subscription.ActionType,
  is_invoice_payment:
    Number(subscription.EntityType) === IDOKLAD_WEBHOOK_ENTITY_ISSUED_INVOICE &&
    Number(subscription.ActionType) === IDOKLAD_WEBHOOK_ACTION_PAYMENT_CREATED,
})

const status = async (req: MedusaRequest) => {
  const publicId = process.env.IDOKLAD_WEBHOOK_PUBLIC_ID?.trim() || null
  const idoklad = resolveIdokladService(req.scope)
  let subscriptions: ReturnType<typeof describe>[] = []
  let listError: string | null = null
  if (idoklad) {
    try {
      subscriptions = (await idoklad.listWebhooks()).map(describe)
    } catch (error) {
      listError = error instanceof Error ? error.message : "neznámá chyba"
    }
  }
  const subscribed = subscriptions.some(
    (entry) =>
      entry.is_invoice_payment &&
      Boolean(publicId) &&
      entry.public_id?.toLowerCase() === publicId?.toLowerCase()
  )
  return {
    target_url: targetUrl(),
    idoklad_configured: Boolean(idoklad),
    secret_configured: Boolean(process.env.IDOKLAD_WEBHOOK_SECRET),
    public_id: publicId,
    subscriptions,
    subscribed,
    list_error: listError,
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.status(200).json(await status(req))
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as { action?: string; order_id?: string }
  const action = body.action ?? "subscribe"
  const idoklad = resolveIdokladService(req.scope)
  if (!idoklad) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "iDoklad není nakonfigurovaný (IDOKLAD_CLIENT_ID / SECRET)."
    )
  }

  if (action === "subscribe") {
    const publicId = process.env.IDOKLAD_WEBHOOK_PUBLIC_ID?.trim()
    if (!publicId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Chybí IDOKLAD_WEBHOOK_PUBLIC_ID — PublicId webhooku z Developer portálu iDokladu."
      )
    }
    const current = await status(req)
    if (current.subscribed) {
      res.status(200).json({ ...current, message: "Agenda už je k webhooku přihlášená." })
      return
    }
    await idoklad.createWebhook({
      PublicId: publicId,
      EntityType: IDOKLAD_WEBHOOK_ENTITY_ISSUED_INVOICE,
      ActionType: IDOKLAD_WEBHOOK_ACTION_PAYMENT_CREATED,
    })
    res.status(200).json({
      ...(await status(req)),
      message: "Agenda přihlášená: úhrady vydaných faktur teď chodí na webhook.",
    })
    return
  }

  if (action === "test") {
    const secret = process.env.IDOKLAD_WEBHOOK_SECRET
    if (!secret) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Chybí IDOKLAD_WEBHOOK_SECRET — bez něj webhook nic nepřijme."
      )
    }
    if (!body.order_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Chybí order_id.")
    }
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "metadata"],
      filters: { id: body.order_id },
    })
    const order = orders[0] as any
    const invoiceId = Number(order?.metadata?.[IDOKLAD_METADATA_KEYS.invoiceId])
    if (!order || !Number.isFinite(invoiceId) || invoiceId <= 0) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Objednávka nemá vystavenou fakturu v iDokladu — není co hlásit."
      )
    }

    // Přesně dokumentovaný tvar doručení (api.idoklad.cz/Help/v3, „Webhooky").
    const payload = JSON.stringify({
      DeliveryId: randomUUID(),
      Events: [
        {
          AgendaId: 0,
          EntityId: invoiceId,
          EntityType: "IssuedInvoice",
          EventDate: new Date().toISOString(),
          EventType: "PaymentCreated",
        },
      ],
    })
    const invoice = await idoklad.getInvoice(invoiceId).catch(() => null)
    const response = await fetch(targetUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [IDOKLAD_SIGNATURE_HEADER]: signIdokladPayload(secret, payload),
      },
      body: payload,
    })
    res.status(200).json({
      target_url: targetUrl(),
      order: { id: order.id, display_id: order.display_id },
      invoice_id: invoiceId,
      invoice_payment_status: invoice?.PaymentStatus ?? null,
      webhook_status: response.status,
      webhook_body: await response.text().catch(() => ""),
    })
    return
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Neznámá akce „${action}" — použijte subscribe nebo test.`
  )
}
