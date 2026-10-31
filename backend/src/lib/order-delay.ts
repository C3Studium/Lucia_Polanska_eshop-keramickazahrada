import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"
import { pragueEndOfDay } from "../modules/gift-voucher/code"
import { customerName, formatDate, orderLink, orderNumber, sendCustomerEmail } from "./customer-email"
import { lineQuantityOf, LINE_QUANTITY_FIELDS } from "./order-quantity"
import { isServiceLine } from "./packaging-lines"

/**
 * „Oznámit zpoždění" u KAŽDÉ objednávky (panel Zpoždění v detailu objednávky).
 *
 * Lucie zaškrtne výrobky, které je potřeba dodělat a kvůli kterým se
 * objednávka zdrží, zadá nový termín (a důvod) a zákazník dostane JEDEN
 * e-mail „Omlouvám se, objednávka se zdrží" se seznamem těch výrobků.
 *
 * Je-li mezi zaškrtnutými zakázka (`production_order` s tímto
 * `line_item_id`) v potvrzeném / rozpracovaném stavu, posune se jí zároveň
 * smluvní termín dokončení (`estimated_completion_at`, OP čl. IX, Z9) — bez
 * druhého e-mailu (dřívější tlačítko u zakázky posílalo vlastní).
 *
 * Historie je v `order.metadata.order_delays` (nejnovější poslední), takže
 * příští zpoždění zná „původní termín" a widget ukáže, co už odešlo.
 * Systém zpoždění nikdy nevyhlásí sám (D4) — jen doručí to, co ohlásila Lucie.
 */

export type OrderDelayEntry = {
  announced_at: string
  /** RRRR-MM-DD — nový termín (konec dne v Praze). */
  new_date: string
  previous_date: string | null
  reason: string | null
  /**
   * Co se dodělává. `quantity` = kolik kusů se zdrží, `of` = kolik jich
   * na řádku je (31. 10. 2026): u „3 ks" se může zdržet jen jeden a
   * zákazník má vědět, že zbylé dva přijdou podle plánu.
   */
  items: Array<{ id: string; title: string; quantity: number; of?: number }>
  /** Komu odešel e-mail (null = objednávka nemá e-mail). */
  emailed_to: string | null
}

export const ORDER_DELAYS_KEY = "order_delays"

const DELAY_STAGES = ["confirmed", "in_production", "awaiting_balance"]

const itemLabel = (item: { title: string; quantity: number; of?: number }) => {
  const of = item.of ?? item.quantity
  if (of > item.quantity) return `${item.title} · ${item.quantity} z ${of} ks`
  return item.quantity > 1 ? `${item.title} · ${item.quantity} ks` : item.title
}

export const announceOrderDelay = async (
  container: MedusaContainer,
  input: {
    orderId: string
    itemIds: string[]
    /** Kolik kusů z řádku se zdrží; co chybí, bere se jako celý řádek. */
    itemQuantities?: Record<string, number> | null
    newDate: string
    reason?: string | null
  }
): Promise<{ entry: OrderDelayEntry; commissionsMoved: number; emailed: boolean }> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "status",
      "metadata",
      "customer.first_name",
      "customer.last_name",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "items.id",
      "items.title",
      "items.variant_title",
      "items.product_id",
      "items.variant_id",
      "items.metadata",
      ...LINE_QUANTITY_FIELDS,
    ],
    filters: { id: input.orderId },
  })
  const order = (data?.[0] as any) ?? null
  if (!order) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  if (order.status === "canceled") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Objednávka je zrušená — zpoždění se neoznamuje.")
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.newDate)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Nový termín zadejte jako datum.")
  }
  const newDeadline = pragueEndOfDay(input.newDate)
  if (newDeadline.getTime() < Date.now()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Nový termín nemůže být v minulosti.")
  }

  const goods = (order.items ?? []).filter((item: any) => !isServiceLine(item))
  const wanted = new Set(input.itemIds)
  const selected = goods.filter((item: any) => wanted.has(item.id))
  if (!selected.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Vyberte aspoň jeden výrobek, kvůli kterému se objednávka zdrží.")
  }
  if (selected.length !== wanted.size) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Některý z vybraných výrobků k objednávce nepatří.")
  }

  // Zakázky mezi vybranými: posunout jim smluvní termín (bez vlastního e-mailu).
  let commissionsMoved = 0
  let commissionPrevious: Date | null = null
  try {
    const madeToOrder = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
    const productionOrders = (await madeToOrder.listProductionOrders({ order_id: order.id } as any)) as any[]
    for (const po of productionOrders) {
      if (!po.line_item_id || !wanted.has(po.line_item_id) || !DELAY_STAGES.includes(po.stage)) continue
      if (po.estimated_completion_at && !commissionPrevious) commissionPrevious = new Date(po.estimated_completion_at)
      await madeToOrder.updateProductionOrders({ id: po.id, estimated_completion_at: newDeadline } as any)
      commissionsMoved += 1
    }
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(`[zpoždění] Termín zakázek u ${order.id} se nepodařilo posunout: ${(error as Error)?.message ?? error}`)
  }

  const metadata = (order.metadata ?? {}) as Record<string, unknown>
  const history = (Array.isArray(metadata[ORDER_DELAYS_KEY]) ? metadata[ORDER_DELAYS_KEY] : []) as OrderDelayEntry[]
  const last = history[history.length - 1]
  const previousDate = last?.new_date
    ? last.new_date
    : commissionPrevious
      ? commissionPrevious.toISOString().slice(0, 10)
      : null

  const items = selected.map((item: any) => {
    const of = Math.max(1, Math.round(lineQuantityOf(item)))
    /* Kolik kusů se zdrží — nejvýš tolik, kolik jich na řádku je. */
    const wantedQty = Number(input.itemQuantities?.[item.id])
    const quantity = Number.isFinite(wantedQty)
      ? Math.min(of, Math.max(1, Math.round(wantedQty)))
      : of
    return {
      id: item.id,
      title: [item.title, item.variant_title && item.variant_title !== "Default variant" ? item.variant_title : null]
        .filter(Boolean)
        .join(" — "),
      quantity,
      of,
    }
  })
  const reason = input.reason?.trim() || null
  const allCommission = commissionsMoved > 0 && commissionsMoved === selected.length && selected.length === goods.length

  const emailed = await sendCustomerEmail(container, {
    template: "order-delayed",
    to: order.email,
    // Nový termín + výrobky: totéž ohlášení dvakrát = jeden e-mail, jiný termín = nový.
    // Počty jsou v klíči taky: „zdrží se 2 ze 3" je jiné ohlášení než „zdrží
    // se celé 3", i když je termín a seznam položek stejný.
    key: `order-delay:${order.id}:${input.newDate}:${items
      .map((i) => `${i.id}x${i.quantity}`)
      .sort()
      .join(",")}`,
    orderId: order.id,
    data: {
      customerName: customerName(order),
      orderNumber: orderNumber(order),
      orderLink: orderLink(order),
      ...(previousDate ? { originalDeliveryDate: formatDate(pragueEndOfDay(previousDate)) } : {}),
      newDeliveryDate: formatDate(newDeadline),
      ...(reason ? { delayReason: reason } : {}),
      delayedItems: items.map(itemLabel),
      wholeOrder: selected.length === goods.length,
      isCommission: allCommission,
    },
  })

  const entry: OrderDelayEntry = {
    announced_at: new Date().toISOString(),
    new_date: input.newDate,
    previous_date: previousDate,
    reason,
    items,
    emailed_to: emailed ? order.email : null,
  }
  const orderModule = container.resolve(Modules.ORDER)
  await orderModule.updateOrders([
    { id: order.id, metadata: { ...metadata, [ORDER_DELAYS_KEY]: [...history, entry] } },
  ] as never)

  return { entry, commissionsMoved, emailed }
}
