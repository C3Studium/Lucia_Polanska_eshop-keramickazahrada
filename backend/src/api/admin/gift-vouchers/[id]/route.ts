import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { GIFT_VOUCHER_MODULE } from "../../../../modules/gift-voucher"
import type GiftVoucherModuleService from "../../../../modules/gift-voucher/service"
import { serializeAdminVoucher } from "../../../../lib/gift-voucher-view"
import { pragueEndOfDay } from "../../../../modules/gift-voucher/code"
import { syncVoucherPromotionSafe } from "../../../../lib/gift-voucher-promotion"

/** Detail poukazu a úprava údajů, které se po vystavení smí měnit. */

const loadVoucher = async (service: GiftVoucherModuleService, id: string) => {
  const [voucher] = (await service.listGiftVouchers({ id } as never, { relations: ["redemptions"] } as never)) as any[]
  return voucher ?? null
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const voucher = await loadVoucher(service, req.params.id)
  if (!voucher) {
    res.status(404).json({ message: "Poukaz nebyl nalezen." })
    return
  }
  res.json({ gift_voucher: serializeAdminVoucher(voucher) })
}

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((v) => (v === undefined ? undefined : v || null))

const UpdateSchema = z.object({
  recipient_name: nullableText(200),
  recipient_email: z
    .string()
    .trim()
    .max(320)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null))
    .refine((v) => !v || z.string().email().safeParse(v).success, { message: "Zkontrolujte prosím e-mail obdarovaného." }),
  dedication: nullableText(500),
  buyer_name: z.string().trim().min(1).max(200).optional(),
  buyer_email: z
    .string()
    .trim()
    .max(320)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null))
    .refine((v) => !v || z.string().email().safeParse(v).success, { message: "Zkontrolujte prosím e-mail kupujícího." }),
  buyer_phone: nullableText(40),
  note: nullableText(2000),
  kind: z.enum(["physical", "electronic"]).optional(),
  /** Prodloužení platnosti (YYYY-MM-DD). */
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Datum platnosti zadejte jako RRRR-MM-DD." }).optional(),
})

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = UpdateSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    const m = parsed.error.issues[0]?.message ?? ""
    res.status(400).json({ message: /[áčďéěíňóřšťúůýž]/i.test(m) ? m : "Zkontrolujte prosím vyplněné údaje." })
    return
  }
  const service = req.scope.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const voucher = await loadVoucher(service, req.params.id)
  if (!voucher) {
    res.status(404).json({ message: "Poukaz nebyl nalezen." })
    return
  }
  if (voucher.status === "cancelled") {
    res.status(400).json({ message: "Zrušený poukaz nejde upravovat — nejdřív ho obnovte." })
    return
  }
  const { valid_until, ...rest } = parsed.data
  const update: Record<string, unknown> = { id: voucher.id }
  for (const [key, value] of Object.entries(rest)) if (value !== undefined) update[key] = value
  if (valid_until) {
    const until = pragueEndOfDay(valid_until)
    if (until.getTime() < Date.now()) {
      res.status(400).json({ message: "Datum platnosti musí být v budoucnu." })
      return
    }
    update.valid_until = until
  }
  const after = { ...voucher, ...update }
  if (after.kind === "electronic" && !after.recipient_email && !after.buyer_email) {
    res.status(400).json({ message: "Elektronický poukaz potřebuje e-mail obdarovaného nebo kupujícího." })
    return
  }
  await service.updateGiftVouchers(update as never)
  await syncVoucherPromotionSafe(req.scope, voucher.id)
  res.json({ gift_voucher: serializeAdminVoucher(await loadVoucher(service, voucher.id)) })
}
