import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createHash } from "crypto"
import { z } from "zod"
import { customerName } from "../../../lib/customer-email"
import { notifyMerchant } from "../../../lib/notify"
import { verifyOrderAccessToken } from "../../../lib/order-access-link"
import {
  buildOrderChangeNotification,
  isDialablePhone,
} from "../../../lib/order-change-request"

/**
 * The site-wide contact dialog (and the Kurzy inquiry CTA) posts here. One
 * message becomes one merchant notification: a bell entry plus an e-mail to
 * the owner — she answers from her inbox, so a bell alone would go unseen.
 *
 * Abuse handling is deliberately quiet: the honeypot field answers success
 * without sending anything (a bot told it failed just tries again), and the
 * dedupe key means an impatient double-click delivers one message, not two.
 *
 * Druhý režim — `kind: "order_change"` (12. 10. 2026, Matěj): „Potřebuji
 * změnit objednávku" ze stránky úpravy objednávky. Bez předmětu, jména
 * a e-mailu ve formuláři: objednávku (číslo, jméno, e-mail) ověří podepsaný
 * token stránky úpravy, zákazník píše jen zprávu a POVINNÝ telefon, ať mu
 * Lucie může zavolat. Text e-mailu skládá `lib/order-change-request`.
 */

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(1).max(5000),
  /** Honeypot — humans never see the field, so any content marks a bot. */
  website: z.string().max(400).optional(),
})

const OrderChangeSchema = z.object({
  kind: z.literal("order_change"),
  order_id: z.string().trim().min(1).max(120),
  /** Podepsaný token objednávky — tentýž, který otevřel stránku úpravy. */
  token: z.string().trim().min(1).max(200),
  /** Povinný: Lucie se chce mít možnost ozvat telefonem. */
  phone: z.string().trim().min(1).max(40).refine(isDialablePhone),
  message: z.string().trim().min(1).max(5000),
  website: z.string().max(400).optional(),
})

/*
 * A small sliding window per address: enough to stop a runaway script without
 * ever blocking a real customer. In-memory on purpose — worst case a second
 * instance grants a second window, which is an acceptable failure for a
 * contact form (the dedupe key still collapses identical messages).
 */
const WINDOW_MS = 10 * 60 * 1000
const WINDOW_LIMIT = 3
const recentByEmail = new Map<string, number[]>()

const withinLimit = (email: string, now: number) => {
  const hits = (recentByEmail.get(email) ?? []).filter(
    (stamp) => now - stamp < WINDOW_MS
  )
  if (hits.length >= WINDOW_LIMIT) {
    recentByEmail.set(email, hits)
    return false
  }
  hits.push(now)
  recentByEmail.set(email, hits)
  return true
}

const INVALID_INPUT =
  "Zkontrolujte prosím vyplněné údaje — něco chybí, nebo je v jiném tvaru."
const TOO_MANY =
  "Přišlo příliš mnoho zpráv krátce po sobě. Zkuste to prosím za chvíli."

/**
 * „Potřebuji změnit objednávku" — viz hlavička. Token se ověřuje stejně jako
 * u ostatních self-service rout (`verifyOrderAccessToken`); neplatný = 401,
 * storefront pak řekne, ať zákazník otevře odkaz z posledního e-mailu.
 */
const handleOrderChange = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = OrderChangeSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ message: INVALID_INPUT })
    return
  }
  const input = parsed.data

  if (input.website) {
    res.status(200).json({ ok: true })
    return
  }

  if (!verifyOrderAccessToken(input.order_id, input.token)) {
    res.status(401).json({
      message:
        "Odkaz je neplatný nebo vypršel. Otevřete prosím ten z posledního e-mailu, nebo nám napište.",
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "customer.first_name",
      "customer.last_name",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "billing_address.first_name",
      "billing_address.last_name",
    ],
    filters: { id: input.order_id },
  })
  const order = orders[0] as any
  if (!order) {
    res.status(404).json({ message: "Objednávka nebyla nalezena." })
    return
  }

  // Strop jako u obecného formuláře, jen podle objednávky (e-mail je z ní).
  if (!withinLimit(`order:${order.id}`, Date.now())) {
    res.status(429).json({ message: TOO_MANY })
    return
  }

  const name = customerName(order)
  const notification = buildOrderChangeNotification(
    {
      id: order.id,
      display_id: order.display_id,
      email: order.email,
      customer_name: name === "Vážený zákazníku" ? null : name,
    },
    { phone: input.phone, message: input.message }
  )

  await notifyMerchant(req.scope, {
    key: notification.key,
    title: notification.title,
    description: notification.description,
    audience: "owner",
    email: true,
    // Odpověď ze schránky jde rovnou zákazníkovi (e-mail z objednávky).
    ...(notification.replyTo ? { replyTo: notification.replyTo } : {}),
    resource: { id: order.id, type: "order" },
  })

  res.status(200).json({ ok: true })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if ((req.body as { kind?: unknown } | undefined)?.kind === "order_change") {
    await handleOrderChange(req, res)
    return
  }

  const parsed = ContactSchema.safeParse(req.body ?? {})

  if (!parsed.success) {
    res.status(400).json({ message: INVALID_INPUT })
    return
  }

  const input = parsed.data

  if (input.website) {
    res.status(200).json({ ok: true })
    return
  }

  if (!withinLimit(input.email.toLocaleLowerCase(), Date.now())) {
    res.status(429).json({ message: TOO_MANY })
    return
  }

  const digest = createHash("sha1")
    .update(`${input.email}|${input.message}`)
    .digest("hex")

  await notifyMerchant(req.scope, {
    key: `mn:contact:${digest}`,
    title: `Zpráva z webu — ${input.name}`,
    description: [
      `Od: ${input.name} <${input.email}>${input.phone ? `, tel. ${input.phone}` : ""}`,
      "",
      input.message,
    ].join("\n"),
    audience: "owner",
    email: true,
    // She answers from her inbox — Reply-To makes „Odpovědět" reach the
    // customer instead of bouncing back to the shop's own address.
    replyTo: input.email,
  })

  res.status(200).json({ ok: true })
}
