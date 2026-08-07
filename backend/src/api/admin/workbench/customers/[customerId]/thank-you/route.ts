import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { storefrontBase } from "../../../../../../lib/customer-email"

/**
 * „Poděkovat" — a one-time code for someone who keeps coming back.
 *
 * ## Why it is one action and not three
 *
 * Thanking a good customer natively means: open Promotions, invent a code that
 * is not taken, build a campaign so it can only be used once, then go to the
 * customer and write them an e-mail with the code pasted in. Four screens, and
 * the two halves can drift — a code that was never sent, or a mail quoting a
 * code that expired. Here the code is created, capped and sent in one call, or
 * none of it happens.
 *
 * ## What „one time" actually means
 *
 * A usage limit on a promotion in Medusa lives on its **campaign budget**, not
 * on the promotion, so each thank-you gets its own campaign with
 * `budget: { type: "usage", limit: 1 }`. The code is unique per send, so it
 * cannot be forwarded around and spent by a stranger — one code, one customer,
 * one use.
 *
 * ## What it does not do
 *
 * It does not decide *who* deserves thanking. That is hers: the workbench shows
 * orders and lifetime value, she reads the person behind them, she presses the
 * button. A rule that mails money automatically is a rule that eventually mails
 * money to the wrong person.
 */

const PostThankYouSchema = z.object({
  /** Percentage off. Bounded so a slip of the keyboard cannot give the shop away. */
  percentage: z.number().min(1).max(50).default(10),
  /** How long the code lives, in days. */
  valid_days: z.number().min(1).max(365).default(60),
})

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** Readable when typed off a phone: no O/0, no I/1. */
const makeCode = () => {
  let suffix = ""
  for (let index = 0; index < 6; index += 1) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return `DIKY-${suffix}`
}

const czechDate = (date: Date) =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = PostThankYouSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      parsed.error.issues[0]?.message ?? "Neplatné zadání."
    )
  }
  const { percentage, valid_days } = parsed.data

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "last_name"],
    filters: { id: req.params.customerId },
  })
  const customer = customers[0] as any

  if (!customer?.email) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Zákazník nebyl nalezen, nebo nemá e-mail."
    )
  }

  const promotionModule = req.scope.resolve(Modules.PROMOTION)

  const startsAt = new Date()
  const endsAt = new Date(startsAt.getTime() + valid_days * 24 * 60 * 60 * 1000)

  // Retried on collision: the code is short and random, so „taken" is rare but
  // not impossible, and a 500 here would be a thank-you that silently failed.
  let promotion: any = null
  let code = ""
  for (let attempt = 0; attempt < 5 && !promotion; attempt += 1) {
    code = makeCode()
    try {
      const [created] = await promotionModule.createPromotions([
        {
          code,
          type: "standard",
          is_automatic: false,
          application_method: {
            type: "percentage",
            target_type: "order",
            allocation: "across",
            value: percentage,
          },
          campaign: {
            name: `Poděkování — ${customer.email}`,
            campaign_identifier: `thank-you-${code}`,
            starts_at: startsAt,
            ends_at: endsAt,
            budget: { type: "usage", limit: 1 },
          },
        },
      ] as never)
      promotion = created
    } catch (error: any) {
      const message = String(error?.message ?? "")
      if (!/exists|duplicate|unique/i.test(message)) throw error
    }
  }

  if (!promotion) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Nepodařilo se vytvořit unikátní kód. Zkuste to prosím znovu."
    )
  }

  const notifications = req.scope.resolve(Modules.NOTIFICATION)
  const storefront = storefrontBase()
  const name =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    undefined

  await notifications.createNotifications({
    to: customer.email,
    channel: "email",
    template: "promotional",
    data: {
      customerName: name,
      discountCode: code,
      discountPercentage: `${percentage} %`,
      expiryDate: czechDate(endsAt),
      ...(storefront ? { productLink: `${storefront}/store` } : {}),
    },
  })

  res.status(201).json({
    code,
    percentage,
    expires_at: endsAt.toISOString(),
    sent_to: customer.email,
    promotion_id: promotion.id,
  })
}
