import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { getLastPaymentStatus } from "@medusajs/medusa/core-flows"
import { clampContractPercentage } from "../lib/made-to-order/contract-deposit"
import { LINE_QUANTITY_FIELDS, lineQuantityOf } from "../lib/order-quantity"
import {
  initialStageForPayment,
  paymentProblemReason,
} from "../modules/merchant-order/payment-state"
import {
  MADE_TO_ORDER_MODULE,
} from "../modules/made-to-order"
import MadeToOrderModuleService from "../modules/made-to-order/service"
import { MERCHANT_ORDER_MODULE } from "../modules/merchant-order"
import MerchantOrderModuleService from "../modules/merchant-order/service"
import { ensureMadeToOrderInvoices } from "../lib/idoklad-invoice"
import { ensureBalanceCollection } from "../lib/balance-payment"

/** Event po založení VŠECH zakázek objednávky (Z11: PDF Potvrzení zakázky per zakázka). */
export const PRODUCTION_ORDERS_CREATED_EVENT = "made-to-order.production-orders-created"

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return Number(candidate.value ?? candidate.numeric_ ?? candidate.raw ?? 0)
  }
  return Number(value ?? 0)
}

const round2 = (value: number) => Math.round(value * 100) / 100

const isPaidCollection = (collection: any) => {
  const status = String(collection?.status || "").toLowerCase()
  return (
    ["authorized", "completed", "captured"].includes(status) ||
    (Array.isArray(collection?.payments) && collection.payments.length > 0)
  )
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

/** Zadání řádku: text (`specification`, záložně `note`) a fotky z metadat řádku objednávky. */
const briefOf = (item: any): { text: string; photos: string[] } => {
  const brief = item?.metadata?.made_to_order
  if (!brief || typeof brief !== "object") return { text: "", photos: [] }
  return {
    text: text(brief.specification) || text(brief.note),
    photos: Array.isArray(brief.photos)
      ? brief.photos.filter((url: unknown): url is string => typeof url === "string" && Boolean(url.trim()))
      : [],
  }
}

export type PlannedCommission = {
  /** Řádek OBJEDNÁVKY (ne košíku) — podle něj se zakázka pozná při zrušení, v PDF i v e-mailech. */
  line_item_id: string
  line_title: string | null
  line_quantity: number | null
  line_total: number
  /** `original_total` zakázky: položka, u první zakázky + doprava/balné/ostatní zboží. */
  original_total: number
  order_extras_paid: number
  /** Co se za zakázku zaplatilo v pokladně (žádost `deposit`). */
  deposit_paid: number
  deposit_percentage: number
  deposit_amount: number
  specification: string | null
  customer_note: string | null
  photos: string[]
  carries_order_extras: boolean
}

/**
 * ČISTÉ: rozpis pokladních řádků (`production_lines[]` z metadat kolekce) na
 * zakázky — jedna na řádek (LEGAL_AUDIT.md § 0c, Z-A).
 *
 * - Řádky pokladny nesou id ŘÁDKU KOŠÍKU; objednávka má řádky vlastní, se
 *   stejnou variantou a metadaty — páruje se podle varianty (pak produktu),
 *   každý řádek objednávky nejvýš jednou.
 * - První zakázka NESE objednávku: `original_total` = cena položky + vše
 *   ostatní (doprava, balné, běžné zboží) a její záloha i to, co se z toho
 *   zaplatilo hned (`order_extras_paid`). Součet `original_total` = celá
 *   objednávka, součet záloh = pokladní platba — na haléř (zbytek jde na
 *   první zakázku, žádné dělení s driftem).
 * - Smluvní záloha řádku = `contract_*` snímek; bez něj (kolekce před
 *   20. 10. 2026) procento z profilu produktu, nikdy 100 (to bylo „zaplaceno").
 */
export const planCommissions = (input: {
  productionLines: any[]
  orderItems: any[]
  originalTotal: number
  paidNow: number
  /** `product_id` → procento z profilu (jen pro řádky bez `contract_*`). */
  fallbackPercentages?: Map<string, unknown>
}): PlannedCommission[] => {
  const lines = (input.productionLines ?? []).filter(Boolean)
  const items = (input.orderItems ?? []).filter(Boolean)
  const used = new Set<string>()
  const matchItem = (line: any): any | null => {
    const byVariant = items.find(
      (item) => !used.has(item.id) && line?.variant_id && item.variant_id === line.variant_id
    )
    const byProduct =
      byVariant ??
      items.find(
        (item) => !used.has(item.id) && line?.product_id && item.product_id === line.product_id
      )
    if (byProduct) used.add(byProduct.id)
    return byProduct ?? null
  }

  const drafts: PlannedCommission[] = lines.map((line): PlannedCommission => {
    const item = matchItem(line)
    const lineTotal = round2(toNumber(line.line_total ?? item?.total ?? 0))
    const paidForLine = round2(Math.max(0, toNumber(line.deposit_amount)))
    const hasContract =
      line.contract_deposit_amount !== undefined &&
      line.contract_deposit_amount !== null &&
      Number.isFinite(toNumber(line.contract_deposit_amount))
    const percentage = clampContractPercentage(
      hasContract
        ? line.contract_deposit_percentage
        : input.fallbackPercentages?.get(String(line.product_id ?? "")),
      clampContractPercentage(input.fallbackPercentages?.get(String(line.product_id ?? "")))
    )
    const depositAmount = hasContract
      ? round2(Math.min(lineTotal, Math.max(0, toNumber(line.contract_deposit_amount))))
      : round2(Math.min(lineTotal, (lineTotal * percentage) / 100))
    const brief = item ? briefOf(item) : { text: "", photos: [] }
    const specification = text(line.specification) || null
    // Zadání přichází dvakrát — ze snímku pokladny (`production_lines[].specification`,
    // pořízeného při založení platby) i z metadat řádku (to, co zákazník naposledy
    // uložil). Platí řádek; snímek jen když řádek nic nenese. Nikdy obojí — stejný
    // nebo starší text by se v poznámce a v PDF Potvrzení zakázky opakoval.
    const customerNote = text(brief.text) || (specification ? text(specification) : "") || null
    return {
      line_item_id: String(item?.id ?? line.line_item_id ?? ""),
      line_title: text(item?.product_title) || text(item?.title) || null,
      line_quantity: item ? lineQuantityOf(item) || null : null,
      line_total: lineTotal,
      original_total: lineTotal,
      order_extras_paid: 0,
      deposit_paid: paidForLine,
      deposit_percentage: percentage,
      deposit_amount: depositAmount,
      specification,
      customer_note: customerNote,
      photos: brief.photos,
      carries_order_extras: false,
    }
  })

  if (!drafts.length) return drafts

  const linesTotal = round2(drafts.reduce((sum, draft) => sum + draft.line_total, 0))
  const paidForLines = round2(drafts.reduce((sum, draft) => sum + draft.deposit_paid, 0))
  const extrasTotal = Math.max(0, round2(input.originalTotal - linesTotal))
  const extrasPaid = Math.max(0, round2(input.paidNow - paidForLines))
  const first = drafts[0]
  first.original_total = round2(first.line_total + extrasTotal)
  first.deposit_paid = round2(first.deposit_paid + extrasPaid)
  first.order_extras_paid = extrasPaid
  first.carries_order_extras = extrasTotal > 0
  return drafts
}

/**
 * Creates the client-facing workflow records after Medusa has durably placed
 * an order. The handler is deliberately idempotent because event delivery is
 * at-least-once.
 */
export default async function initializeMerchantOrder({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const merchantOrderService = container.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )
  const madeToOrderService = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "total",
      "currency_code",
      "items.id",
      "items.title",
      "items.product_title",
      "items.variant_title",
      "items.product_id",
      "items.variant_id",
      "items.total",
      "items.metadata",
      // Množství přes detail i řádek — výslovné `items.quantity` z query.graph nechodí.
      ...LINE_QUANTITY_FIELDS,
      "payment_collections.*",
      "payment_collections.status",
      "payment_collections.amount",
      "payment_collections.captured_amount",
      "payment_collections.refunded_amount",
      "payment_collections.payment_sessions.*",
      "payment_collections.payments.*",
    ],
    filters: { id: data.id },
  })
  const order = orders[0]
  if (!order) return

  const existingStates = await merchantOrderService.listMerchantOrderStates({
    order_id: order.id,
  })
  if (!existingStates.length) {
    // Medusa's own aggregation decides where the order starts. An order whose payment
    // never landed opens in the problem queue instead of looking ready to pack in "Nové".
    const paymentStatus = getLastPaymentStatus({
      currency_code: order.currency_code,
      payment_collections: order.payment_collections || [],
    } as any)
    const stage = initialStageForPayment(paymentStatus)
    await merchantOrderService.createMerchantOrderStates({
      order_id: order.id,
      stage,
      stage_changed_at: new Date(),
      requires_attention: stage === "payment_problem",
      attention_reason:
        paymentProblemReason(paymentStatus) ?? null,
    })
  }

  const existingProductionOrders =
    await madeToOrderService.listProductionOrders({ order_id: order.id })
  if (existingProductionOrders.length) return

  const paymentCollection = (order.payment_collections || []).find(
    (collection: any) => collection?.metadata?.made_to_order
  )
  const productionLines = paymentCollection?.metadata?.production_lines
  if (!paymentCollection || !Array.isArray(productionLines) || !productionLines.length) {
    return
  }

  const originalTotal = toNumber(
    paymentCollection.metadata.original_cart_total ?? order.total
  )
  // Co zákazník zaplatil v pokladně (záloha až celá cena) — rozpadá se na
  // žádosti o platbu typu `deposit` jednotlivých zakázek.
  const paidNow = toNumber(paymentCollection.amount)

  /*
   * SMLUVNÍ záloha (LEGAL_AUDIT.md § 0, Z2/Z5) ≠ zaplaceno. Z `contract_*`
   * snímku řádku pokladny; u kolekcí z doby před snímkem fallback z profilu
   * produktu toho řádku (nikdy 100).
   */
  const fallbackPercentages = new Map<string, unknown>()
  const needsFallback = productionLines.filter(
    (line: any) => line?.contract_deposit_amount === undefined || line?.contract_deposit_amount === null
  )
  for (const productId of new Set(needsFallback.map((line: any) => line?.product_id).filter(Boolean))) {
    const [profile] = await madeToOrderService
      .listProductProductionProfiles({ product_id: productId })
      .catch(() => [] as any[])
    fallbackPercentages.set(String(productId), (profile as any)?.default_deposit_percentage)
  }

  const planned = planCommissions({
    productionLines,
    orderItems: order.items ?? [],
    originalTotal,
    paidNow,
    fallbackPercentages,
  })

  const currencyCode = String(order.currency_code || "czk").toLowerCase()
  const paymentSession = paymentCollection.payment_sessions?.[0]
  const payment = paymentCollection.payments?.[0]
  const providerData = payment?.data || paymentSession?.data || {}
  const paid = isPaidCollection(paymentCollection)
  const now = new Date()

  const created: any[] = []
  for (const plan of planned) {
    // Jedna zakázka na řádek objednávky (LEGAL_AUDIT.md § 0c, Z-A): vlastní
    // smluvní záloha, zadání, diář, PDF, e-maily i doplatek. Pořadí vzniku
    // = pořadí řádků pokladny; první nese za objednávku dopravu a balné.
    const productionOrder = await madeToOrderService.createProductionOrders({
      order_id: order.id,
      line_item_id: plan.line_item_id || null,
      line_title: plan.line_title,
      line_quantity: plan.line_quantity,
      line_total: plan.line_total,
      order_extras_paid: plan.carries_order_extras ? plan.order_extras_paid : null,
      stage: plan.specification ? "specification_pending" : "confirmed",
      deposit_percentage: plan.deposit_percentage,
      deposit_amount: plan.deposit_amount,
      agreed_total: plan.original_total,
      original_total: plan.original_total,
      currency_code: currencyCode,
      customer_note: plan.customer_note,
    } as never)
    created.push(productionOrder)

    /*
     * The brief becomes the first entries in the diary, so she reads it in the
     * same place she reads everything else about this piece rather than having
     * to go hunting in the order's line items for it. Marked as the customer's
     * and visible to them, because they wrote it. Diář je per zakázka.
     */
    if (plan.customer_note || plan.photos.length) {
      const entries = plan.photos.length
        ? plan.photos.map((url, index) => ({
            order_id: order.id,
            production_order_id: productionOrder.id,
            text: index === 0 ? plan.customer_note : null,
            image_url: url,
            visible_to_customer: true,
            created_by: "customer",
          }))
        : [
            {
              order_id: order.id,
              production_order_id: productionOrder.id,
              text: plan.customer_note,
              image_url: null,
              visible_to_customer: true,
              created_by: "customer",
            },
          ]
      await madeToOrderService.createProductionNotes(entries as never)
    }

    // Co na tuhle zakázku připadá z pokladní platby (posuvník rozdělil řádky;
    // první zakázka k tomu nese zaplacené „navíc" za objednávku).
    // Nulová platba (cena po domluvě — objednáno za 0 Kč) žádost nemá: DB
    // vyžaduje kladnou částku a zálohu zaplatí zákazník až po domluvené ceně.
    if (Number(plan.deposit_paid) > 0.005) await madeToOrderService.createProductionPaymentRequests({
      type: "deposit",
      status: paid ? "paid" : "pending",
      amount: plan.deposit_paid,
      currency_code: currencyCode,
      payment_collection_id: paymentCollection.id,
      payment_session_id: paymentSession?.id || null,
      provider_transaction_id:
        // Jedna transakce brány platí všechny zakázky objednávky; sloupec je
        // unique, tak ji nese jen první.
        created.length === 1 ? providerData.transId || providerData.trans_id || null : null,
      payment_url: providerData.redirect || providerData.payment_url || null,
      selected_method: providerData.method || null,
      provider_status: paid ? "PAID" : String(providerData.status || "PENDING"),
      create_state: "created",
      idempotency_key: `deposit:${order.id}:${plan.line_item_id || created.length}`,
      paid_at: paid ? now : null,
      last_checked_at: now,
      production_order_id: productionOrder.id,
    } as any)
  }

  /*
   * Z11: zakázky existují i se zálohou a diářem → PDF „Potvrzení zakázky" per
   * zakázka (subscriber na tento event je vygeneruje, uloží k objednávce a
   * pošle v JEDNOM potvrzení objednávky). Emituje se TADY, hned po založení
   * — ne až po fakturaci a kolekci doplatku, aby chyba v nich potvrzení
   * nezdržela; obě jsou níž fail-open. Při opakovaném doručení `order.placed`
   * se sem už nedojde (zakázky existují), takže event odejde právě jednou.
   */
  await container.resolve(Modules.EVENT_BUS).emit({
    name: PRODUCTION_ORDERS_CREATED_EVENT,
    data: {
      order_id: order.id,
      production_order_ids: created.map((productionOrder) => productionOrder.id),
    },
  })

  /*
   * Zálohová faktura hned, jakmile je záloha zaplacená — faktura i jen za zálohu
   * je povinná. Spouští se TADY (ne jen z payment.captured), protože produkční
   * objednávka + zaplacená záloha teď prokazatelně existují; captured event může
   * přijít dřív, než tohle doběhne. Idempotentní (metadata), chyba fakturace
   * nesmí shodit založení zakázky.
   */
  if (paid) {
    await ensureMadeToOrderInvoices(container, order.id).catch(() => undefined)
  }

  /*
   * Kolekce doplatku HNED, ne až s výzvou k doplacení. Bez ní Medusa hlásila
   * zakázku „zaplaceno" už po záloze (změřeno 9. 10. 2026, #27: zachyceno
   * 1 225 z 4 450) — stav platby, fronta i nativní „Nesplacená částka" lhaly.
   * S otevřenou kolekcí na zbytek je od začátku „částečně zaplaceno" a výzva
   * k doplacení ji později jen použije. Jedna kolekce NA ZAKÁZKU (každá má
   * vlastní doplatek a odkaz); součet = zbytek objednávky. Fail-open.
   */
  for (const [index, productionOrder] of created.entries()) {
    const plan = planned[index]
    // Zbytek po pokladní platbě (jak dřív, jen per zakázka) — i když záloha
    // ještě není potvrzená: kolekce z pokladny ji vybere, tahle nese zbytek.
    const balance = round2(Math.max(0, plan.original_total - plan.deposit_paid))
    if (balance > 0.005) {
      await ensureBalanceCollection(container, order, balance, productionOrder.id).catch((error) => {
        container
          .resolve(ContainerRegistrationKeys.LOGGER)
          .warn(
            `[zakázka] Kolekci doplatku u ${order.id} (zakázka ${productionOrder.id}) se nepodařilo založit: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
      })
    }
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
