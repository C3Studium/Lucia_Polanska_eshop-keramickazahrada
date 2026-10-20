import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { allMadeToOrder } from "../../../../../lib/claims/context"
import { commissionLineOf } from "../../../../../lib/made-to-order/commission-line"
import { commissionMoney } from "../../../../../lib/made-to-order/commission-money"
import {
  listCommissionsOfOrder,
  paymentRequestsByCommission,
} from "../../../../../lib/made-to-order/orders-of"
import { LINE_QUANTITY_FIELDS } from "../../../../../lib/order-quantity"
import { isPersonalPickupOrder } from "../../../../../lib/personal-pickup"

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>
    return Number(source.value ?? source.numeric_ ?? source.raw ?? 0)
  }
  return Number(value ?? 0)
}

/**
 * Merchant-facing projection of a made-to-order order. Medusa's native order
 * and payment collections remain the source of truth; this record only keeps
 * the production lifecycle and immutable deposit/balance snapshots.
 *
 * Od 20. 10. 2026 (LEGAL_AUDIT.md § 0c, Z-A) je zakázka = POLOŽKA: odpověď
 * nese `production_orders[]` (jedna na zakázkový řádek objednávky, každá se
 * svými platbami, fotkami a zadáním) a `production_order` = první z nich pro
 * starší čtenáře widgetu.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productionOrders = await listCommissionsOfOrder(req.scope, req.params.orderId)

  // A normal order isn't an error. Returning null lets the order-detail widget
  // stay mounted for all orders without producing a noisy 404 request.
  if (!productionOrders.length) {
    return res.status(200).json({ production_order: null, production_orders: [] })
  }

  const requestsByCommission = await paymentRequestsByCommission(req.scope, productionOrders)

  // Jen zakázky (bez běžného zboží) → postup výroby ovládá Denní práce;
  // smíšená objednávka má výrobu a balení zboží odděleně (14. 10. 2026).
  let pureCommission = false
  // „Zaplaceno na místě" jen u osobního odběru — u zásilky do ateliéru nikdo nepřijde.
  let personalPickup = false
  let order: any = null
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "items.id",
        "items.title",
        "items.product_title",
        "items.variant_title",
        "items.thumbnail",
        "items.metadata",
        "items.variant_id",
        "items.product_id",
        "items.product.metadata",
        ...LINE_QUANTITY_FIELDS,
        "shipping_methods.data",
      ],
      filters: { id: req.params.orderId },
    })
    order = orders[0] ?? null
    pureCommission = order ? allMadeToOrder(order as any) : false
    personalPickup = isPersonalPickupOrder(order as any)
  } catch {
    // Fotky jsou doplněk — když se nenačtou, zbytek projekce stojí dál.
  }

  const rows = productionOrders.map((productionOrder) => {
    const payments = requestsByCommission.get(productionOrder.id) ?? []
    const paidAmount = payments
      .filter((payment: any) => payment.status === "paid")
      .reduce((sum: number, payment: any) => sum + toNumber(payment.amount), 0)
    const surcharge = toNumber(productionOrder.surcharge)
    // Příplatek navyšuje, co se má doplatit — cenu samotnou nemění.
    const finalTotal =
      toNumber(productionOrder.agreed_total ?? productionOrder.original_total) + surcharge
    const outstandingAmount = Math.max(0, finalTotal - paidAmount)
    const canFulfill =
      ["ready_to_ship", "completed"].includes(productionOrder.stage) &&
      outstandingAmount <= 0.005
    const money = commissionMoney(productionOrder, payments)

    // Fotky a text, které zákazník poslal k TÉTO položce (metadata řádku
    // objednávky, `made_to_order`); legacy zakázka = všechny zakázkové řádky.
    const line = commissionLineOf(order, productionOrder)
    const sourceItems: any[] = productionOrder.line_item_id
      ? line
        ? [line]
        : []
      : ((order?.items ?? []) as any[])
    const customerPhotos: string[] = []
    let customerSpecification: string | null = null
    for (const item of sourceItems) {
      const mto = (item?.metadata as any)?.made_to_order
      if (!mto || typeof mto !== "object") continue
      if (Array.isArray(mto.photos)) {
        for (const url of mto.photos) {
          if (typeof url === "string" && url) customerPhotos.push(url)
        }
      }
      const spec =
        typeof mto.specification === "string"
          ? mto.specification
          : typeof mto.note === "string"
          ? mto.note
          : null
      if (spec && spec.trim() && !customerSpecification) {
        customerSpecification = spec.trim()
      }
    }

    return {
      ...productionOrder,
      surcharge,
      final_total: finalTotal,
      payment_requests: payments,
      paid_amount: paidAmount,
      outstanding_amount: outstandingAmount,
      can_fulfill: canFulfill,
      // Položka zakázky (§ 0c): název ze snímku / řádku, cena položky bez
      // dopravy a balného, které první zakázka nese za objednávku.
      line_title:
        (typeof productionOrder.line_title === "string" && productionOrder.line_title.trim()) ||
        (line?.product_title as string) ||
        (line?.title as string) ||
        null,
      line_variant_title: (line?.variant_title as string) ?? null,
      line_thumbnail: (line?.thumbnail as string) ?? null,
      item_total: money.item_total,
      item_outstanding: money.item_outstanding,
      order_extras_total: money.extras_total,
      order_extras_outstanding: money.extras_outstanding,
      carries_order_extras: money.carries_order_extras,
      customer_photos: customerPhotos,
      customer_specification:
        customerSpecification ?? productionOrder.customer_note ?? null,
      pure_commission: pureCommission,
      personal_pickup: personalPickup,
    }
  })

  res.status(200).json({
    production_order: rows[0],
    production_orders: rows,
  })
}
