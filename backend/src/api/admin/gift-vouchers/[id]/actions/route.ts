import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { GIFT_VOUCHER_MODULE } from "../../../../../modules/gift-voucher"
import type GiftVoucherModuleService from "../../../../../modules/gift-voucher/service"
import { ensureGiftVoucherPaymentLink } from "../../../../../lib/gift-voucher-payment"
import { sendGiftVoucherEmail, sendGiftVoucherPaymentEmail } from "../../../../../lib/gift-voucher-emails"
import { serializeAdminVoucher } from "../../../../../lib/gift-voucher-view"
import { syncVoucherPromotionSafe } from "../../../../../lib/gift-voucher-promotion"
import { markVoucherRefunded } from "../../../../../lib/gift-voucher-orders"

/**
 * Akce nad jedním poukazem (tlačítka v detailu na stránce Poukazy):
 *
 * - `mark_paid` `{ method: "cash" | "transfer" }` — peníze převzala Lucie;
 *   elektronický poukaz s `send: true` rovnou odejde,
 * - `mark_unpaid` — oprava překliku (jen dokud nebyl uplatněn),
 * - `payment_link` `{ send?: boolean }` — platební odkaz ComGate (znovu použije platný),
 * - `send` `{ to?: string }` — poslat poukaz e-mailem (obdarovanému / kupujícímu / jinam),
 * - `redeem` `{ amount, order_id?, note? }` — uplatnit (odečíst ze zůstatku),
 * - `reverse` `{ redemption_id, note? }` — vrátit uplatnění do zůstatku,
 * - `cancel` / `restore` — zrušit / obnovit poukaz.
 */
const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_paid"), method: z.enum(["cash", "transfer"]), send: z.boolean().optional() }),
  z.object({ action: z.literal("mark_unpaid") }),
  z.object({ action: z.literal("payment_link"), send: z.boolean().optional() }),
  z.object({
    action: z.literal("send"),
    to: z.string().trim().max(320).email({ message: "Zkontrolujte prosím e-mail." }).optional().or(z.literal("")),
  }),
  z.object({
    action: z.literal("redeem"),
    amount: z.coerce.number().int({ message: "Částku zadejte v celých korunách." }).positive({ message: "Částka musí být kladná." }),
    order_id: z.string().trim().max(100).optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
  }),
  z.object({ action: z.literal("reverse"), redemption_id: z.string().min(1), note: z.string().trim().max(500).optional().nullable() }),
  /** Vrátit peníze za nepoužitý poukaz (ComGate přes bránu, hotově/převodem jen zápis) → spotřebovaný. */
  z.object({ action: z.literal("refund"), note: z.string().trim().max(500).optional().nullable() }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("restore") }),
])

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = ActionSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    const m = parsed.error.issues[0]?.message ?? ""
    res.status(400).json({ message: /[áčďéěíňóřšťúůýž]/i.test(m) ? m : "Neznámá akce nebo chybné údaje." })
    return
  }
  const body = parsed.data
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const service = req.scope.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const load = async () =>
    ((await service.listGiftVouchers({ id: req.params.id } as never, { relations: ["redemptions"] } as never)) as any[])[0]

  const voucher = await load()
  if (!voucher) {
    res.status(404).json({ message: "Poukaz nebyl nalezen." })
    return
  }

  const extra: Record<string, unknown> = {}
  try {
    switch (body.action) {
      case "mark_paid": {
        if (voucher.payment_status === "paid") {
          res.status(400).json({ message: "Poukaz je už zaplacený." })
          return
        }
        if (voucher.status === "cancelled") {
          res.status(400).json({ message: "Poukaz je zrušený — nejdřív ho obnovte." })
          return
        }
        await service.updateGiftVouchers({
          id: voucher.id,
          payment_status: "paid",
          paid_at: new Date(),
          payment_method: body.method,
        } as never)
        if (voucher.kind === "electronic" && body.send !== false) {
          const sent = await sendGiftVoucherEmail(req.scope, { ...voucher, payment_status: "paid" }, { reason: "manual" })
          extra.email = sent.sent ? `Poukaz odešel na ${sent.to}.` : undefined
          if (!sent.sent) extra.warning = "Zaplaceno, ale e-mail s poukazem se nepodařilo poslat."
        }
        break
      }
      case "mark_unpaid": {
        if (voucher.refunded_at) {
          res.status(400).json({ message: "Za poukaz už se vrátily peníze — platbu nejde vzít zpět." })
          return
        }
        if ((voucher.redemptions ?? []).some((r: any) => !r.reversed_at)) {
          res.status(400).json({ message: "Poukaz už byl uplatněný — platbu nejde vzít zpět." })
          return
        }
        if (voucher.payment_method === "comgate" && voucher.payment_status === "paid") {
          res.status(400).json({ message: "Online platbu zapsala brána ComGate — vrátit ji jde jen v ComGate." })
          return
        }
        await service.updateGiftVouchers({ id: voucher.id, payment_status: "pending", paid_at: null } as never)
        break
      }
      case "payment_link": {
        // Odkaz napřed (ten ověří, že poukaz není zaplacený ani zrušený), způsob
        // platby se přepne až když odkaz opravdu vznikl.
        const link = await ensureGiftVoucherPaymentLink(req.scope, { ...voucher, payment_method: "comgate" })
        if (voucher.payment_method !== "comgate") {
          await service.updateGiftVouchers({ id: voucher.id, payment_method: "comgate" } as never)
        }
        extra.payment_url = link.payment_url
        if (body.send) {
          const fresh = await load()
          const sent = await sendGiftVoucherPaymentEmail(req.scope, fresh, link.payment_url)
          extra.email = sent ? `Platební odkaz odešel na ${fresh.buyer_email}.` : undefined
          if (!sent) extra.warning = fresh.buyer_email ? "E-mail se nepodařilo poslat." : "Kupující nemá e-mail — odkaz zkopírujte a pošlete ručně."
        }
        break
      }
      case "send": {
        if (voucher.payment_status !== "paid") {
          res.status(400).json({ message: "Nezaplacený poukaz se neposílá — nejdřív zapište platbu, nebo pošlete platební odkaz." })
          return
        }
        if (voucher.status === "cancelled") {
          res.status(400).json({ message: "Zrušený poukaz se neposílá." })
          return
        }
        const sent = await sendGiftVoucherEmail(req.scope, voucher, { to: body.to || null, reason: "manual" })
        if (!sent.sent) {
          res.status(400).json({ message: sent.to ? "E-mail se nepodařilo poslat." : "Poukaz nemá žádný e-mail — zadejte adresu." })
          return
        }
        extra.email = `Poukaz odešel na ${sent.to}.`
        break
      }
      case "redeem": {
        await service.redeem(voucher.id, { amount: body.amount, order_id: body.order_id, note: body.note })
        break
      }
      case "reverse": {
        const owns = (voucher.redemptions ?? []).some((r: any) => r.id === body.redemption_id)
        if (!owns) {
          res.status(404).json({ message: "Uplatnění k tomuto poukazu nepatří." })
          return
        }
        await service.reverseRedemption(body.redemption_id, body.note ?? null)
        break
      }
      case "refund": {
        if (voucher.refunded_at) {
          res.status(400).json({ message: "Peníze za tenhle poukaz už vrácené jsou." })
          return
        }
        if (voucher.order_line_item_id) {
          res.status(400).json({
            message: "Poukaz je koupený v objednávce z obchodu — peníze vraťte u objednávky (Reklamace a vrácení). Poukaz se tím zneplatní sám.",
          })
          return
        }
        if (voucher.payment_status !== "paid") {
          res.status(400).json({ message: "Poukaz není zaplacený — není co vracet. Stačí ho zrušit." })
          return
        }
        if ((voucher.redemptions ?? []).some((r: any) => !r.reversed_at)) {
          res.status(400).json({
            message: "Poukaz už byl uplatněný — od jeho koupě odstoupit nejde (OP čl. XI). Pokud přesto vracíte peníze, nejdřív vraťte uplatnění.",
          })
          return
        }
        let how = voucher.payment_method === "cash" ? "hotově" : "převodem"
        if (voucher.payment_method === "comgate") {
          // Peníze zpět stejnou cestou: zachycená platba v kolekci poukazu → refundace přes ComGate.
          const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
          const { data } = await query.graph({
            entity: "payment",
            fields: ["id", "amount", "captured_at", "canceled_at", "refunds.amount"],
            filters: { payment_collection_id: voucher.payment_collection_id },
          })
          const payment = (data as any[]).find((p) => p.captured_at && !p.canceled_at)
          if (!payment) {
            res.status(400).json({ message: "Online platbu k poukazu se nepodařilo dohledat — vraťte peníze ručně v ComGate a pak to zapište znovu." })
            return
          }
          // Modul plateb napřímo, ne `refundPaymentWorkflow`: ten hledá k platbě
          // objednávku a poukaz žádnou nemá (stejně jako kurzy, lib/course-refund.ts).
          await req.scope.resolve(Modules.PAYMENT).refundPayment({
            payment_id: payment.id,
            amount: Number(voucher.initial_value),
            note: `Vrácení dárkového poukazu ${voucher.code}`,
          })
          how = "přes ComGate na kartu / účet, ze kterého se platilo"
          extra.email = `Peníze ${voucher.initial_value} Kč se vracejí přes ComGate.`
        }
        await markVoucherRefunded(
          req.scope,
          voucher.id,
          [`Peníze vráceny ${how}`, body.note].filter(Boolean).join(" — ")
        )
        break
      }
      case "cancel": {
        await service.updateGiftVouchers({ id: voucher.id, status: "cancelled", cancelled_at: new Date() } as never)
        break
      }
      case "restore": {
        if (voucher.refunded_at) {
          res.status(400).json({ message: "Za poukaz se vrátily peníze — obnovit ho nejde, jinak by šel použít podruhé." })
          return
        }
        await service.updateGiftVouchers({ id: voucher.id, status: "active", cancelled_at: null } as never)
        break
      }
    }
  } catch (error) {
    if (error instanceof MedusaError && [MedusaError.Types.NOT_ALLOWED, MedusaError.Types.INVALID_DATA, MedusaError.Types.NOT_FOUND].includes(error.type as any)) {
      res.status(400).json({ message: error.message })
      return
    }
    logger.error(`[poukazy] Akce ${body.action} u ${voucher.code} selhala: ${(error as Error)?.message ?? error}`)
    res.status(502).json({ message: "Akce se teď nepodařila. Zkuste to prosím za chvíli." })
    return
  }

  // Slevový kód poukazu (hodnota = zůstatek, aktivní jen u platného) po každé změně.
  await syncVoucherPromotionSafe(req.scope, voucher.id)
  res.json({ gift_voucher: serializeAdminVoucher(await load()), ...extra })
}
