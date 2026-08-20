import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createHash } from "crypto"
import { z } from "zod"
import { notifyMerchant } from "../../../lib/notify"

/**
 * The site-wide contact dialog (and the Kurzy inquiry CTA) posts here. One
 * message becomes one merchant notification: a bell entry plus an e-mail to
 * the owner — she answers from her inbox, so a bell alone would go unseen.
 *
 * Abuse handling is deliberately quiet: the honeypot field answers success
 * without sending anything (a bot told it failed just tries again), and the
 * dedupe key means an impatient double-click delivers one message, not two.
 */

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(1).max(5000),
  /** Honeypot — humans never see the field, so any content marks a bot. */
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

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = ContactSchema.safeParse(req.body ?? {})

  if (!parsed.success) {
    res.status(400).json({
      message: "Zkontrolujte prosím vyplněné údaje — něco chybí, nebo je v jiném tvaru.",
    })
    return
  }

  const input = parsed.data

  if (input.website) {
    res.status(200).json({ ok: true })
    return
  }

  if (!withinLimit(input.email.toLocaleLowerCase(), Date.now())) {
    res.status(429).json({
      message: "Přišlo příliš mnoho zpráv krátce po sobě. Zkuste to prosím za chvíli.",
    })
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
