import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GIFT_VOUCHER_MODULE } from "../modules/gift-voucher"
import type GiftVoucherModuleService from "../modules/gift-voucher/service"
import { defaultValidUntil, monthsFromValidityText, normalizeVoucherCode } from "../modules/gift-voucher/code"
import { getLegalFacts } from "./merchant-settings"
import { notifyMerchant } from "./notify"
import { toNumber } from "./order-quantity"
import { lineQuantityOf, LINE_QUANTITY_FIELDS } from "./order-quantity"
import { sendGiftVoucherEmail } from "./gift-voucher-emails"
import { formatVoucherCzk } from "./gift-voucher-view"
import { syncVoucherPromotionSafe } from "./gift-voucher-promotion"
import { isCustomAmountVoucher } from "./voucher"

/**
 * Poukazy a objednávky z obchodu — oba směry:
 *
 * 1. **Poukaz koupený jako výrobek** (typ produktu „Dárkový poukaz“,
 *    `product.metadata.gift_voucher` nebo poukaz s vlastní částkou) → za každý
 *    kus vznikne řádek v Poukazech s vlastním kódem. Hodnota = cena kusu,
 *    podoba a obdarovaný z metadat položky (formulář na stránce produktu).
 *    Zaplacený je, až je zaplacená objednávka; pak se z něj stane slevový kód
 *    a elektronický odejde e-mailem.
 * 2. **Objednávka zaplacená kódem poukazu** → uplatněná částka (úpravy cen
 *    s kódem poukazu) se odečte ze zůstatku a slevový kód se srovná na nový
 *    zůstatek.
 *
 * Volá se z `order.placed`, `payment.captured` i `order.canceled`
 * (`subscribers/gift-voucher-orders.ts`, `subscribers/gift-voucher-payment.ts`);
 * všechno je idempotentní (jedinečný `order_line_item_id`, uplatnění podle
 * objednávky), protože události chodí „aspoň jednou“ a v libovolném pořadí.
 */

/** Klíče metadat položky košíku z formuláře poukazu (storefront musí psát stejné). */
export const VOUCHER_LINE_KEYS = {
  kind: "gift_voucher_kind",
  recipientName: "gift_voucher_recipient_name",
  recipientEmail: "gift_voucher_recipient_email",
  dedication: "gift_voucher_dedication",
} as const

export const isGiftVoucherProduct = (metadata: Record<string, unknown> | null | undefined): boolean =>
  metadata?.gift_voucher === true || metadata?.gift_voucher === "true" || isCustomAmountVoucher(metadata)

const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "status",
  "currency_code",
  "billing_address.first_name",
  "billing_address.last_name",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "items.id",
  "items.title",
  "items.product_id",
  "items.unit_price",
  "items.metadata",
  ...LINE_QUANTITY_FIELDS,
  "items.adjustments.code",
  "items.adjustments.amount",
  "shipping_methods.adjustments.code",
  "shipping_methods.adjustments.amount",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
]

const loadOrder = async (container: MedusaContainer, orderId: string): Promise<any | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ORDER_FIELDS, filters: { id: orderId } })
  return (data?.[0] as any) ?? null
}

/** Je objednávka zaplacená (aspoň jedna kolekce zachycená celá)? Dobírka až po převzetí. */
export const orderIsPaid = (order: any): boolean =>
  (order?.payment_collections ?? []).some((c: any) => {
    const amount = toNumber(c?.amount)
    return c?.status === "completed" || (amount > 0 && toNumber(c?.captured_amount) >= amount)
  })

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}
const email = (v: unknown): string | null => {
  const s = text(v, 320)
  return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null
}

/** 1 — poukazy koupené v objednávce: založit chybějící, zaplatit, rozeslat. */
export const syncPurchasedVouchers = async (container: MedusaContainer, orderId: string): Promise<void> => {
  const order = await loadOrder(container, orderId)
  if (!order || order.status === "canceled") return
  const service = container.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const productIds = [...new Set((order.items ?? []).map((i: any) => i.product_id).filter(Boolean))] as string[]
  if (!productIds.length) return
  const { data: products } = await query.graph({ entity: "product", fields: ["id", "metadata"], filters: { id: productIds } })
  const voucherProducts = new Set((products as any[]).filter((p) => isGiftVoucherProduct(p.metadata)).map((p) => p.id))
  const lines = (order.items ?? []).filter((i: any) => voucherProducts.has(i.product_id))
  if (!lines.length) return

  const paid = orderIsPaid(order)
  const buyerName =
    [order.billing_address?.first_name, order.billing_address?.last_name].filter(Boolean).join(" ") ||
    [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" ") ||
    order.email ||
    "Zákazník obchodu"

  const existing = (await service.listGiftVouchers({ order_id: order.id } as never)) as any[]
  const byKey = new Map(existing.filter((v) => v.order_line_item_id).map((v) => [v.order_line_item_id, v]))
  const { facts } = await getLegalFacts(container)
  const validUntil = defaultValidUntil(new Date(), monthsFromValidityText(facts["voucher.validity"]))

  const created: any[] = []
  for (const line of lines) {
    const meta = (line.metadata ?? {}) as Record<string, unknown>
    const recipientEmail = email(meta[VOUCHER_LINE_KEYS.recipientEmail])
    const kind = meta[VOUCHER_LINE_KEYS.kind] === "electronic" || (!meta[VOUCHER_LINE_KEYS.kind] && recipientEmail)
      ? "electronic"
      : "physical"
    const value = Math.round(toNumber(line.unit_price))
    if (!(value > 0)) continue
    const quantity = Math.max(1, Math.round(lineQuantityOf(line)))
    for (let n = 1; n <= quantity; n++) {
      const key = `${line.id}#${n}`
      if (byKey.has(key)) continue
      try {
        const voucher = await service.issueVoucher({
          kind,
          initial_value: value,
          valid_until: validUntil,
          recipient_name: text(meta[VOUCHER_LINE_KEYS.recipientName], 200),
          recipient_email: recipientEmail,
          dedication: text(meta[VOUCHER_LINE_KEYS.dedication], 500),
          buyer_name: buyerName,
          buyer_email: order.email || null,
          payment_method: "order",
          paid,
          order_id: order.id,
          order_line_item_id: key,
          note: `Koupeno v obchodě, objednávka #${order.display_id}`,
        })
        byKey.set(key, voucher)
        created.push(voucher)
      } catch (error) {
        // Souběžná událost ho mezitím založila (jedinečný order_line_item_id).
        logger.warn(`[poukazy] Poukaz ${key} z objednávky #${order.display_id} nevznikl: ${(error as Error)?.message ?? error}`)
      }
    }
  }

  if (created.length) {
    await notifyMerchant(container, {
      key: `mn:gift-voucher-order:${order.id}`,
      title: `Objednávka #${order.display_id}: ${created.length === 1 ? "dárkový poukaz" : `${created.length} dárkové poukazy`}`,
      description: created
        .map((v) => `${v.code} · ${formatVoucherCzk(v.initial_value)} · ${v.kind === "electronic" ? `elektronický → ${v.recipient_email || v.buyer_email}` : "vytištěný — vytiskněte ho na stránce Poukazy a přibalte"}`)
        .join("\n"),
      audience: "owner",
      email: true,
    }).catch(() => undefined)
  }

  if (!paid) return
  const all = (await service.listGiftVouchers({ order_id: order.id } as never)) as any[]
  for (const voucher of all.filter((v) => v.order_line_item_id)) {
    if (voucher.payment_status !== "paid") {
      await service.updateGiftVouchers({ id: voucher.id, payment_status: "paid", paid_at: new Date() } as never)
      voucher.payment_status = "paid"
    }
    await syncVoucherPromotionSafe(container, voucher.id)
    if (voucher.kind === "electronic" && voucher.status === "active") {
      await sendGiftVoucherEmail(container, voucher, { reason: "paid" }).catch((error) =>
        logger.error(`[poukazy] Poukaz ${voucher.code} se nepodařilo poslat: ${error?.message ?? error}`)
      )
    }
  }
}

/** 2 — objednávka zaplacená kódem poukazu: odečíst uplatněnou částku. */
export const redeemVouchersFromOrder = async (container: MedusaContainer, orderId: string): Promise<void> => {
  const order = await loadOrder(container, orderId)
  if (!order) return
  const service = container.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)

  const byCode = new Map<string, number>()
  const add = (adj: any) => {
    if (typeof adj?.code !== "string" || !adj.code) return
    const code = normalizeVoucherCode(adj.code)
    byCode.set(code, (byCode.get(code) ?? 0) + toNumber(adj.amount))
  }
  for (const item of order.items ?? []) for (const adj of item.adjustments ?? []) add(adj)
  for (const sm of order.shipping_methods ?? []) for (const adj of sm.adjustments ?? []) add(adj)
  if (!byCode.size) return

  const vouchers = (await service.listGiftVouchers(
    { code: [...byCode.keys()] } as never,
    { relations: ["redemptions"] } as never
  )) as any[]

  for (const voucher of vouchers) {
    const used = Math.round(byCode.get(voucher.code) ?? 0)
    if (!(used > 0)) continue
    const already = (voucher.redemptions ?? []).some((r: any) => r.order_id === order.id && !r.reversed_at)
    if (already) continue
    const balance = Number(voucher.balance)
    const amount = Math.min(used, balance)
    if (amount > 0) {
      await service.redeem(voucher.id, {
        amount,
        order_id: order.id,
        note: `Objednávka #${order.display_id} (slevový kód v košíku)`,
      })
    }
    if (used > balance) {
      // Dvě objednávky se stejným poukazem souběžně — druhá ho přečerpala.
      await notifyMerchant(container, {
        key: `mn:gift-voucher-overdrawn:${voucher.id}:${order.id}`,
        title: `Poukaz ${voucher.code} přečerpán objednávkou #${order.display_id}`,
        description: `Objednávka odečetla ${formatVoucherCzk(used)}, na poukazu ale zbývalo jen ${formatVoucherCzk(balance)}. Rozdíl ${formatVoucherCzk(used - balance)} je potřeba vyřešit se zákazníkem (doplatek).`,
        audience: "owner",
        urgent: true,
      }).catch(() => undefined)
    }
    await syncVoucherPromotionSafe(container, voucher.id)
  }
}

/** Zrušená objednávka: vrátit uplatněné částky a zrušit poukazy v ní koupené. */
export const reverseVouchersForCanceledOrder = async (container: MedusaContainer, orderId: string): Promise<void> => {
  const service = container.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const redemptions = (await service.listGiftVoucherRedemptions({ order_id: orderId } as never)) as any[]
  const touched = new Set<string>()
  for (const r of redemptions.filter((r) => !r.reversed_at)) {
    await service.reverseRedemption(r.id, "Objednávka zrušena — částka vrácena na poukaz")
    touched.add(r.voucher_id)
  }
  const bought = (await service.listGiftVouchers({ order_id: orderId } as never, { relations: ["redemptions"] } as never)) as any[]
  for (const voucher of bought.filter((v) => v.order_line_item_id && v.status !== "cancelled")) {
    const spent = (voucher.redemptions ?? []).some((r: any) => !r.reversed_at)
    if (spent) {
      await notifyMerchant(container, {
        key: `mn:gift-voucher-cancel-spent:${voucher.id}`,
        title: `Zrušená objednávka: poukaz ${voucher.code} už byl uplatněný`,
        description: "Poukaz z té objednávky se mezitím použil, proto zůstal platný. Rozhodněte prosím ručně.",
        audience: "owner",
        urgent: true,
      }).catch(() => undefined)
      continue
    }
    if (voucher.payment_status === "paid") {
      // Zaplacená a zrušená objednávka = peníze se vracejí → poukaz spotřebovaný natrvalo.
      await markVoucherRefunded(container, voucher.id, "Objednávka zrušena — peníze se vracejí")
    } else {
      await service.updateGiftVouchers({ id: voucher.id, status: "cancelled", cancelled_at: new Date() } as never)
    }
    touched.add(voucher.id)
  }
  for (const id of touched) await syncVoucherPromotionSafe(container, id)
}

/**
 * Peníze za poukaz se vrátily → poukaz je spotřebovaný: nejde uplatnit, kód se
 * vypne a „Obnovit" ho nevrátí (OP čl. XI — buď peníze, nebo poukaz, ne obojí).
 * Byl-li mezitím zčásti uplatněný, zneplatní se i tak (jinak by zákazník měl
 * peníze i zbytek poukazu) a majitelka dostane upozornění.
 */
export const markVoucherRefunded = async (
  container: MedusaContainer,
  voucherId: string,
  note: string
): Promise<void> => {
  const service = container.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const [voucher] = (await service.listGiftVouchers({ id: voucherId } as never, { relations: ["redemptions"] } as never)) as any[]
  if (!voucher || voucher.refunded_at) return
  const now = new Date()
  await service.updateGiftVouchers({
    id: voucher.id,
    status: "cancelled",
    cancelled_at: voucher.cancelled_at ?? now,
    refunded_at: now,
    refund_note: note,
  } as never)
  await syncVoucherPromotionSafe(container, voucher.id)
  const spent = (voucher.redemptions ?? []).filter((r: any) => !r.reversed_at)
  if (spent.length) {
    await notifyMerchant(container, {
      key: `mn:gift-voucher-refund-spent:${voucher.id}`,
      title: `Vrácené peníze za poukaz ${voucher.code}, který už byl zčásti uplatněný`,
      description: `Z poukazu se už odečetlo ${formatVoucherCzk(
        spent.reduce((sum: number, r: any) => sum + Number(r.amount), 0)
      )}. Poukaz je teď zneplatněný; zkontrolujte prosím, jestli vrácená částka odpovídá.`,
      audience: "owner",
      urgent: true,
    }).catch(() => undefined)
  }
}

/**
 * Vrácení peněz u objednávky (`lib/claims/refund-action.ts`): poukazy koupené
 * v té objednávce, za které peníze odcházejí, se zneplatní. Řádek `item`
 * s položkou poukazu → tolik poukazů, kolik kusů se vrací (nejdřív ty
 * nepoužité). Ruční částka bez položek se k poukazu přiřadit nedá →
 * upozornění majitelce, ať rozhodne v Poukazech.
 */
export const voidVouchersForOrderRefund = async (
  container: MedusaContainer,
  orderId: string,
  lines: Array<{ type?: string; line_item_id?: string | null; quantity?: number }>,
  note: string
): Promise<void> => {
  const service = container.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
  const bought = ((await service.listGiftVouchers(
    { order_id: orderId } as never,
    { relations: ["redemptions"] } as never
  )) as any[]).filter((v) => v.order_line_item_id && !v.refunded_at)
  if (!bought.length) return

  let unmatched = false
  for (const line of lines ?? []) {
    if (line?.type === "item" && line.line_item_id) {
      const candidates = bought
        .filter((v) => String(v.order_line_item_id).startsWith(`${line.line_item_id}#`) && !v.refunded_at)
        .sort((a, b) => Number((a.redemptions ?? []).length) - Number((b.redemptions ?? []).length))
      for (const voucher of candidates.slice(0, Math.max(1, Math.round(Number(line.quantity ?? 1))))) {
        await markVoucherRefunded(container, voucher.id, note)
        voucher.refunded_at = new Date()
      }
    } else if (line?.type === "custom") {
      unmatched = true
    }
  }
  if (unmatched && bought.some((v) => !v.refunded_at)) {
    await notifyMerchant(container, {
      key: `mn:gift-voucher-refund-custom:${orderId}:${Date.now()}`,
      title: "Vrácení peněz u objednávky s dárkovým poukazem",
      description:
        "Vracela se ruční částka bez výběru položek a objednávka obsahuje dárkový poukaz. Jestli se vracely peníze i za poukaz, zneplatněte ho na stránce Poukazy (Vrátit peníze), ať ho nejde použít znovu.",
      audience: "owner",
      urgent: true,
    }).catch(() => undefined)
  }
}
