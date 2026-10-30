import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { z } from "zod"
import { GIFT_VOUCHER_MODULE } from "../../../modules/gift-voucher"
import type GiftVoucherModuleService from "../../../modules/gift-voucher/service"
import {
  VOUCHER_VALUE_LIMITS,
  defaultValidUntil,
  monthsFromValidityText,
  normalizeVoucherCode,
  pragueEndOfDay,
} from "../../../modules/gift-voucher/code"
import { getLegalFacts } from "../../../lib/merchant-settings"
import { ensureGiftVoucherPaymentLink } from "../../../lib/gift-voucher-payment"
import { sendGiftVoucherEmail, sendGiftVoucherPaymentEmail } from "../../../lib/gift-voucher-emails"
import { serializeAdminVoucher } from "../../../lib/gift-voucher-view"
import { syncVoucherPromotionSafe } from "../../../lib/gift-voucher-promotion"

/**
 * Stránka Poukazy — seznam a vystavení nového poukazu.
 *
 * Vystavení:
 * - `payment: "cash" | "transfer"` + `paid: true` → zaplaceno hned (peníze
 *   převzala Lucie); elektronický poukaz s `send: true` rovnou odejde e-mailem.
 * - `payment: "comgate"` → založí platební odkaz; s `send: true` ho pošle
 *   kupujícímu. Po zaplacení (`subscribers/gift-voucher-payment.ts`) se
 *   elektronický poukaz pošle sám.
 */

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null))
const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: "Zkontrolujte prosím e-mail.",
  })

export const CreateGiftVoucherSchema = z
  .object({
    kind: z.enum(["physical", "electronic"]),
    value: z.coerce
      .number()
      .int({ message: "Hodnota poukazu musí být celé číslo v Kč." })
      .min(VOUCHER_VALUE_LIMITS.min, { message: `Nejnižší hodnota poukazu je ${VOUCHER_VALUE_LIMITS.min} Kč.` })
      .max(VOUCHER_VALUE_LIMITS.max, { message: `Nejvyšší hodnota poukazu je ${VOUCHER_VALUE_LIMITS.max} Kč.` }),
    /** YYYY-MM-DD; bez něj podle „Platnost poukazu" v Právních údajích. */
    valid_until: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Datum platnosti zadejte jako RRRR-MM-DD." })
      .optional()
      .nullable(),
    recipient_name: optionalText(200),
    recipient_email: optionalEmail,
    dedication: optionalText(500),
    buyer_name: z.string().trim().min(1, { message: "Vyplňte jméno kupujícího." }).max(200),
    buyer_email: optionalEmail,
    buyer_phone: optionalText(40),
    note: optionalText(2000),
    payment: z.enum(["cash", "transfer", "comgate"]),
    /** Hotově / převodem: peníze už jsou u Lucie. */
    paid: z.boolean().optional().default(true),
    /** Poslat hned e-mail (poukaz, nebo platební odkaz). */
    send: z.boolean().optional().default(true),
  })
  .superRefine((body, ctx) => {
    if (body.payment === "comgate" && !body.buyer_email) {
      ctx.addIssue({ code: "custom", path: ["buyer_email"], message: "Pro platbu online potřebuje kupující e-mail — pošle se mu na něj odkaz." })
    }
    if (body.kind === "electronic" && !body.recipient_email && !body.buyer_email) {
      ctx.addIssue({ code: "custom", path: ["recipient_email"], message: "Elektronický poukaz potřebuje e-mail obdarovaného nebo kupujícího." })
    }
  })

const firstMessage = (error: z.ZodError) => {
  const m = error.issues[0]?.message ?? ""
  return /[áčďéěíňóřšťúůýž]/i.test(m) ? m : "Zkontrolujte prosím vyplněné údaje."
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const q = String(req.query.q ?? "").trim()
  /* `order_id` — poukazy koupené v jedné objednávce (widget na jejím detailu). */
  const orderId = String(req.query.order_id ?? "").trim()
  const vouchers = (await service.listGiftVouchers(
    (orderId ? { order_id: orderId } : {}) as never,
    { relations: ["redemptions"], order: { created_at: "DESC" } } as never
  )) as any[]

  if (orderId) {
    res.json({ gift_vouchers: vouchers.map(serializeAdminVoucher) })
    return
  }

  const needle = q.toLowerCase()
  const codeNeedle = normalizeVoucherCode(q)
  const filtered = q
    ? vouchers.filter((v) =>
        [v.code, v.recipient_name, v.recipient_email, v.buyer_name, v.buyer_email, v.buyer_phone]
          .filter(Boolean)
          .some((field: string) => field.toLowerCase().includes(needle) || field === codeNeedle)
      )
    : vouchers

  // Souhrn v hlavičce je za všechny poukazy, ne jen za výsledek hledání.
  const all = vouchers.map(serializeAdminVoucher)
  res.json({
    gift_vouchers: filtered.map(serializeAdminVoucher),
    summary: {
      count: all.length,
      active: all.filter((v) => v.state === "active").length,
      pending_payment: all.filter((v) => v.state === "pending_payment").length,
      outstanding_balance: all
        .filter((v) => v.state === "active")
        .reduce((sum, v) => sum + v.balance, 0),
    },
  })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = CreateGiftVoucherSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ message: firstMessage(parsed.error) })
    return
  }
  const body = parsed.data
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const service = req.scope.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)

  let validUntil: Date
  if (body.valid_until) {
    validUntil = pragueEndOfDay(body.valid_until)
    if (validUntil.getTime() < Date.now()) {
      res.status(400).json({ message: "Datum platnosti musí být v budoucnu." })
      return
    }
  } else {
    const { facts } = await getLegalFacts(req.scope)
    validUntil = defaultValidUntil(new Date(), monthsFromValidityText(facts["voucher.validity"]))
  }

  const paidNow = body.payment !== "comgate" && body.paid
  let voucher = (await service.issueVoucher({
    kind: body.kind,
    initial_value: body.value,
    valid_until: validUntil,
    recipient_name: body.recipient_name,
    recipient_email: body.recipient_email,
    dedication: body.dedication,
    buyer_name: body.buyer_name,
    buyer_email: body.buyer_email,
    buyer_phone: body.buyer_phone,
    note: body.note,
    payment_method: body.payment,
    paid: paidNow,
  })) as any

  const outcome: { payment_url?: string; email?: string; warning?: string } = {}

  if (body.payment === "comgate") {
    try {
      const link = await ensureGiftVoucherPaymentLink(req.scope, voucher)
      outcome.payment_url = link.payment_url
      voucher = await service.retrieveGiftVoucher(voucher.id)
      if (body.send) {
        const sent = await sendGiftVoucherPaymentEmail(req.scope, voucher, link.payment_url)
        outcome.email = sent ? `Platební odkaz odešel na ${voucher.buyer_email}.` : undefined
        if (!sent) outcome.warning = "Platební odkaz se nepodařilo poslat e-mailem — zkopírujte ho a pošlete ručně."
      }
    } catch (error) {
      logger.error(`[poukazy] Platební odkaz pro ${voucher.code} se nepodařilo založit: ${(error as Error)?.message ?? error}`)
      outcome.warning =
        error instanceof MedusaError && error.type === MedusaError.Types.INVALID_DATA
          ? error.message
          : "Poukaz je vystavený, ale platební odkaz se teď nepodařilo založit. Zkuste ho vytvořit znovu v detailu poukazu."
    }
  } else if (paidNow && body.kind === "electronic" && body.send) {
    const sent = await sendGiftVoucherEmail(req.scope, voucher, { reason: "manual" }).catch(() => ({ sent: false, to: null }))
    if (sent.sent) outcome.email = `Poukaz odešel na ${sent.to}.`
    else outcome.warning = "Poukaz je vystavený, ale e-mail se nepodařilo poslat — zkuste „Poslat e-mailem“ v detailu."
  }

  if (paidNow) await syncVoucherPromotionSafe(req.scope, voucher.id)
  const fresh = (await service.retrieveGiftVoucher(voucher.id, { relations: ["redemptions"] } as never)) as any
  res.status(201).json({ gift_voucher: serializeAdminVoucher(fresh), ...outcome })
}
