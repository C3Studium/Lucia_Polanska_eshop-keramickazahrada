import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  getVariantAvailability,
  MedusaError,
  Modules,
  QueryContext,
} from "@medusajs/framework/utils"
import {
  beginOrderEditOrderWorkflow,
  cancelBeginOrderEditWorkflow,
  confirmOrderEditRequestWorkflow,
  createOrderChangeActionsWorkflow,
  createOrderEditShippingMethodWorkflow,
  createOrderPaymentCollectionWorkflow,
  createPaymentSessionsWorkflow,
  orderEditAddNewItemWorkflow,
  orderEditUpdateItemQuantityWorkflow,
} from "@medusajs/medusa/core-flows"
import { paymentUrlFromSession } from "../balance-payment"
import { isDobirkaFeeLine } from "../dobirka-fee"
import { notifyMerchant } from "../notify"
import { deliveryContext, type OrderDeliveryContext } from "../order-delivery-context"
import { editabilityMode } from "../order-edit-gate"
import {
  addTargetProblem,
  decideSettlement,
  EDIT_LIMIT,
  LOCK_REASON,
  lineLockFor,
  moneySentence,
  resolveShippingAmount,
  shippingNote,
  validateEditActions,
  type EditAction,
  type EditMode,
  type LineLock,
  type PaymentKind,
  type Settlement,
} from "../order-edit-rules"
import { LINE_QUANTITY_FIELDS, lineQuantityOf, toNumber } from "../order-quantity"
import { MADE_TO_ORDER_MODULE } from "../../modules/made-to-order"
import type MadeToOrderModuleService from "../../modules/made-to-order/service"
import { sendOrderEditedEmail } from "./customer-email"
import { createEditRefundRequest } from "./edit-refund-claim"
import { recordCustomerEdit } from "./log"
import {
  balanceSnapshotOf,
  cancelEditPaymentCollections,
  payLaterProviderOf,
  repairPaymentsAfterEdit,
} from "./payments"

/**
 * Jádro zákaznické úpravy objednávky — sdílené tokenovou routou
 * (`/store/orders/:id/guest-edit`) i zákaznickou (`/store/orders/:id/edit`).
 * Dřív měla každá routa vlastní kopii téhož; rozcházely se. Kontrakt:
 * `docs/uprava-objednavky-plan.md` §3c (pravidla) a §5 (tvary API).
 *
 * Server je soudce: pravidla v `lib/order-edit-rules.ts` (čistá, testovaná),
 * tady jen data a Medusa workflow. Náhled (`dry_run`) běží STEJNOU cestou
 * jako uložení — založí úpravu, provede akce, spočítá a zahodí — aby souhrn
 * nikdy netvrdil něco jiného, než co se pak opravdu uloží.
 */

const round2 = (value: number) => Math.round(value * 100) / 100

/** Pole objednávky pro úpravu. `items.*` + `shipping_methods.*` kvůli
 *  odvozeným součtům (bez nich přijde `total` / `shipping_total` 0 — změřeno
 *  na #38, viz lib/claims/money.ts). */
export const EDIT_ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "customer_id",
  "email",
  "currency_code",
  "region_id",
  "sales_channel_id",
  "metadata",
  "total",
  "item_total",
  "shipping_total",
  "items.*",
  "items.tax_lines.*",
  "items.adjustments.*",
  ...LINE_QUANTITY_FIELDS,
  "items.product.id",
  "items.product.handle",
  "items.product.metadata",
  "shipping_address.*",
  "shipping_methods.*",
  "shipping_methods.tax_lines.*",
  "shipping_methods.adjustments.*",
  "shipping_methods.shipping_option.provider_id",
  "payment_collections.id",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.metadata",
  "payment_collections.payments.provider_id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
  "payment_collections.payments.amount",
  "fulfillments.id",
  "fulfillments.canceled_at",
]

export const loadEditOrder = async (
  container: MedusaContainer,
  orderId: string
): Promise<any | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: EDIT_ORDER_FIELDS,
    filters: { id: orderId },
  })
  return (data as any[])[0] ?? null
}

export const paymentKind = (order: any): PaymentKind => {
  const providers = ((order?.payment_collections ?? []) as any[])
    .flatMap((collection) => collection?.payments ?? [])
    .filter((payment: any) => !payment?.canceled_at)
    .map((payment: any) => String(payment?.provider_id ?? ""))
  if (providers.some((provider: string) => provider.includes("dobirka"))) return "dobirka"
  if (providers.some((provider: string) => provider.includes("pickup"))) return "pickup"
  return "card"
}

/** Výrobní profily produktů → které jsou zakázka (zapnutý profil). */
const productionProductIds = async (
  container: MedusaContainer,
  productIds: string[]
): Promise<Set<string>> => {
  if (!productIds.length) return new Set()
  try {
    const service = container.resolve<MadeToOrderModuleService>(MADE_TO_ORDER_MODULE)
    const profiles = (await service.listProductProductionProfiles({
      product_id: productIds,
    } as never)) as Array<{ product_id?: string; enabled?: boolean }>
    return new Set(
      profiles.filter((profile) => profile?.enabled && profile.product_id).map((p) => p.product_id as string)
    )
  } catch {
    return new Set()
  }
}

type VariantInfo = {
  id: string
  product_id: string
  title: string | null
  manage_inventory: boolean
  allow_backorder: boolean
  price: number | null
  product_metadata: Record<string, unknown> | null
}

/** Varianty s cenou pro region objednávky (vč. ceníků) a příznaky skladu. */
const loadVariants = async (
  container: MedusaContainer,
  order: any,
  filters: { product_id?: string[]; id?: string[] }
): Promise<VariantInfo[]> => {
  if (!(filters.product_id?.length || filters.id?.length)) return []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "title",
      "product_id",
      "manage_inventory",
      "allow_backorder",
      "product.metadata",
      "calculated_price.calculated_amount",
      "prices.amount",
      "prices.currency_code",
    ],
    filters: filters as never,
    context: {
      calculated_price: QueryContext({
        region_id: order.region_id,
        currency_code: order.currency_code,
      }),
    },
  })
  const currency = String(order.currency_code ?? "czk").toLowerCase()
  return (data as any[]).map((variant) => {
    const calculated = toNumber(variant?.calculated_price?.calculated_amount)
    const raw = toNumber(
      ((variant?.prices ?? []) as any[]).find(
        (price) => String(price?.currency_code ?? "").toLowerCase() === currency
      )?.amount
    )
    return {
      id: variant.id,
      product_id: variant.product_id,
      title: variant.title ?? null,
      manage_inventory: variant.manage_inventory !== false,
      allow_backorder: Boolean(variant.allow_backorder),
      price: calculated > 0 ? calculated : raw > 0 ? raw : null,
      product_metadata: (variant?.product?.metadata ?? null) as Record<string, unknown> | null,
    }
  })
}

/** Kolik kusů varianty jde ještě prodat (null = neomezeně: bez skladu / backorder). */
const availabilityOf = async (
  container: MedusaContainer,
  order: any,
  variants: VariantInfo[]
): Promise<Map<string, number | null>> => {
  const result = new Map<string, number | null>()
  const tracked = variants.filter((variant) => variant.manage_inventory && !variant.allow_backorder)
  for (const variant of variants) {
    if (!variant.manage_inventory || variant.allow_backorder) result.set(variant.id, null)
  }
  if (!tracked.length) return result
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const availability = await getVariantAvailability(query as never, {
      variant_ids: tracked.map((variant) => variant.id),
      sales_channel_id: order.sales_channel_id,
    })
    for (const variant of tracked) {
      result.set(variant.id, Math.max(0, Number(availability?.[variant.id]?.availability ?? 0)))
    }
  } catch {
    // Bez informace o skladu radši nepovolíme víc, než je v objednávce.
    for (const variant of tracked) result.set(variant.id, 0)
  }
  return result
}

/**
 * Značka zákaznické úpravy na order_change. `beginOrderEditOrderWorkflow`
 * ukládá jen `description`, `internal_note` a `created_by` — `metadata`
 * zahodí (změřeno 11. 10. 2026 na #32: metadata null). Dřívější kód značil
 * metadaty, takže rozpracovanou úpravu ani počet úprav nikdy nepoznal.
 */
export const CUSTOMER_EDIT_DESCRIPTION = "Úprava zákazníkem"
export const DRY_RUN_NOTE = "náhled — zahodí se"

const customerEditChanges = async (container: MedusaContainer, orderId: string) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query
    .graph({
      entity: "order_change",
      fields: ["id", "status", "created_at", "description", "internal_note", "change_type"],
      filters: { order_id: orderId } as never,
    })
    .catch(() => ({ data: [] as any[] }))
  return data as any[]
}

const isActiveChange = (change: any) => ["pending", "requested"].includes(String(change?.status))
const isCustomerEdit = (change: any) => change?.description === CUSTOMER_EDIT_DESCRIPTION
const isDryRun = (change: any) => isCustomerEdit(change) && change?.internal_note === DRY_RUN_NOTE

export const editCounts = async (container: MedusaContainer, orderId: string) => {
  const changes = await customerEditChanges(container, orderId)
  const confirmed = changes.filter(
    (change) => change?.status === "confirmed" && isCustomerEdit(change) && !isDryRun(change)
  ).length
  const pending =
    changes.find((change) => isActiveChange(change) && isCustomerEdit(change) && !isDryRun(change)) ?? null
  const staleDryRun = changes.filter((change) => isActiveChange(change) && isDryRun(change))
  const foreignActive =
    changes.find((change) => isActiveChange(change) && !isCustomerEdit(change)) ?? null
  return { confirmed, pending, staleDryRun, foreignActive }
}

/* ------------------------------------------------------------------------ */
/* Kontext pro stránku úpravy                                               */
/* ------------------------------------------------------------------------ */

export type EditContextItem = {
  id: string
  title: string
  product_title: string | null
  variant_title: string | null
  thumbnail: string | null
  product_id: string | null
  product_handle: string | null
  variant_id: string | null
  quantity: number
  unit_price: number
  total: number
  lock: LineLock | null
  lock_reason: string | null
  is_made_to_order: boolean
  max_quantity: number
  variants: Array<{ id: string; title: string | null; price_czk: number | null; available: boolean }>
}

export type OrderEditContext = {
  editable: boolean
  mode: EditMode
  swap_only: boolean
  reason: string | null
  items_editable: boolean
  can_add: boolean
  payment: PaymentKind
  currency_code: string
  order: { id: string; display_id: number; item_total: number; shipping_total: number; total: number }
  delivery: OrderDeliveryContext
  items: EditContextItem[]
  pending_change: { id: string; awaiting_payment: boolean } | null
  edits: { confirmed: number; limit: number; remaining: number }
}

/** Řádky objednávky se zámky (+ varianty téhož produktu pro výměnu). */
const describeLines = async (container: MedusaContainer, order: any) => {
  // Doběrečné není zboží — patří k platbě, zákazník ho neupravuje ani
  // neodebírá (změřeno na #39: bez filtru se ukázalo jako běžná položka).
  // V součtech objednávky zůstává.
  const items = ((order.items ?? []) as any[]).filter((item) => !isDobirkaFeeLine(item))
  const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))] as string[]
  const [profiles, variants] = await Promise.all([
    productionProductIds(container, productIds),
    loadVariants(container, order, { product_id: productIds }),
  ])
  const availability = await availabilityOf(container, order, variants)
  return items.map((item) => {
    const lock = lineLockFor({
      lineMetadata: item.metadata,
      product: item.product,
      hasProductionProfile: profiles.has(item.product_id),
    })
    const siblings = variants.filter((variant) => variant.product_id === item.product_id)
    const quantity = lineQuantityOf(item)
    const ownAvailability = availability.get(item.variant_id)
    return {
      item,
      lock,
      quantity,
      siblings,
      // Strop stepperu: kusy v objednávce už jsou rezervované, k nim jde přidat
      // jen volný sklad; bez skladu / s backorderem do 99.
      max_quantity:
        ownAvailability === null || ownAvailability === undefined
          ? 99
          : Math.min(99, quantity + ownAvailability),
      availability,
    }
  })
}

export const buildEditContext = async (
  container: MedusaContainer,
  order: any
): Promise<OrderEditContext> => {
  const [{ mode, reason: gateReason }, counts, lines] = await Promise.all([
    editabilityMode(container, order),
    editCounts(container, order.id),
    describeLines(container, order),
  ])

  // Čistá zakázka (všechny řádky zamčené jako zakázka): úprava položek se
  // nenabízí (§3c.7 — fáze 2); doručení jde měnit dál.
  const allCommission = lines.length > 0 && lines.every((line) => line.lock === "made_to_order")
  const limitReached = counts.confirmed >= EDIT_LIMIT
  const editable = mode !== "none" && !limitReached
  const itemsEditable = editable && !allCommission
  const reason =
    mode === "none"
      ? gateReason
      : limitReached
        ? `Objednávku jste už upravili ${EDIT_LIMIT}× — další změny prosím domluvíme spolu.`
        : allCommission
          ? "Zakázku upravujeme spolu v konverzaci k zakázce — tady jde změnit jen doručení."
          : null

  return {
    editable,
    mode,
    swap_only: mode === "swap_only",
    reason,
    items_editable: itemsEditable,
    can_add: itemsEditable && mode === "full",
    payment: paymentKind(order),
    currency_code: order.currency_code,
    order: {
      id: order.id,
      display_id: Number(order.display_id),
      item_total: round2(toNumber(order.item_total)),
      shipping_total: round2(toNumber(order.shipping_total)),
      total: round2(toNumber(order.total)),
    },
    delivery: deliveryContext(order),
    items: lines.map(({ item, lock, quantity, siblings, max_quantity, availability }) => ({
      id: item.id,
      title: item.title,
      product_title: item.product_title ?? null,
      variant_title: item.variant_title ?? null,
      thumbnail: item.thumbnail ?? null,
      product_id: item.product_id ?? null,
      product_handle: item.product?.handle ?? item.product_handle ?? null,
      variant_id: item.variant_id ?? null,
      quantity,
      unit_price: round2(toNumber(item.unit_price)),
      total: round2(toNumber(item.total) || toNumber(item.unit_price) * quantity),
      lock,
      lock_reason: lock ? LOCK_REASON[lock] : null,
      is_made_to_order: lock === "made_to_order",
      max_quantity,
      variants: siblings.map((variant) => {
        const free = availability.get(variant.id)
        return {
          id: variant.id,
          title: variant.title,
          price_czk: variant.price,
          // Vlastní varianta řádku je „dostupná" vždy — kusy už jsou jeho.
          available: variant.id === item.variant_id || free === null || free === undefined || free >= quantity,
        }
      }),
    })),
    pending_change: counts.pending ? { id: counts.pending.id, awaiting_payment: true } : null,
    edits: {
      confirmed: counts.confirmed,
      limit: EDIT_LIMIT,
      remaining: Math.max(0, EDIT_LIMIT - counts.confirmed),
    },
  }
}

/* ------------------------------------------------------------------------ */
/* Provedení / náhled úpravy                                                 */
/* ------------------------------------------------------------------------ */

export type EditPreview = {
  item_total_before: number
  item_total_after: number
  shipping_before: number
  shipping_after: number
  total_before: number
  total_after: number
  difference: number
  settlement: { kind: Settlement["kind"]; amount: number }
  money_sentence: string
  shipping_note: string | null
  promo_note: string | null
}

export type EditRunResult =
  | { status: "preview"; preview: EditPreview }
  | { status: "awaiting_payment"; preview: EditPreview; payment_url: string; message: string }
  | { status: "confirmed"; preview: EditPreview; message: string; claim_request_id: string | null }

const notAllowed = (message: string) => new MedusaError(MedusaError.Types.NOT_ALLOWED, message)

const totalsOf = (preview: any) => ({
  item_total: round2(toNumber(preview?.item_total)),
  shipping_total: round2(toNumber(preview?.shipping_total)),
  total: round2(toNumber(preview?.total)),
})

/** Ceny dopravy (s pravidly) pro přepočet poštovného. */
const shippingOptionPrices = async (container: MedusaContainer, optionId: string) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "prices.amount", "prices.currency_code", "prices.price_rules.attribute", "prices.price_rules.operator", "prices.price_rules.value"],
    filters: { id: optionId } as never,
  })
  return (((data as any[])[0]?.prices ?? []) as any[]).map((price) => ({
    amount: price?.amount,
    currency_code: price?.currency_code,
    price_rules: ((price?.price_rules ?? []) as any[]).map((rule) => ({
      attribute: rule?.attribute,
      operator: rule?.operator,
      value: rule?.value,
    })),
  }))
}

/**
 * Přepočet poštovného (§3c.4) uvnitř rozpracované úpravy: když cena dopravy
 * pro nový součet zboží vyjde jinak, původní dopravu odebere (akce
 * SHIPPING_REMOVE — Medusa ji sama používá u vratek) a přidá stejnou dopravu
 * s novou cenou. Osobní odběr a objednávky bez dopravy přeskočí.
 */
const applyShippingRecalculation = async (
  container: MedusaContainer,
  order: any,
  changeId: string,
  itemTotalAfter: number
): Promise<boolean> => {
  const methods = (order.shipping_methods ?? []) as any[]
  if (methods.length !== 1) return false
  const method = methods[0]
  if (!method?.shipping_option_id || method?.data?.personal_pickup === true) return false

  const prices = await shippingOptionPrices(container, method.shipping_option_id)
  const desired = resolveShippingAmount(prices, {
    currency_code: order.currency_code,
    region_id: order.region_id,
    item_total: itemTotalAfter,
  })
  const current = round2(toNumber(method.amount))
  if (desired === null || Math.abs(desired - current) <= 0.005) return false

  await createOrderChangeActionsWorkflow(container).run({
    input: [
      {
        action: "SHIPPING_REMOVE",
        reference: "order_shipping_method",
        order_change_id: changeId,
        reference_id: method.id,
        amount: current,
        order_id: order.id,
      },
    ] as never,
  })
  await createOrderEditShippingMethodWorkflow(container).run({
    input: {
      order_id: order.id,
      shipping_option_id: method.shipping_option_id,
      custom_amount: desired,
    } as never,
  })
  return true
}

/** Kódy slev, které objednávka má (z úprav řádků). */
const promoCodesOf = (order: any): string[] =>
  [
    ...new Set(
      ((order.items ?? []) as any[])
        .flatMap((item) => item?.adjustments ?? [])
        .map((adjustment: any) => String(adjustment?.code ?? "").trim())
        .filter(Boolean)
    ),
  ]

/** Nové řádky z náhledu (přidané úpravou) bez slevy → věta pro souhrn. */
const adjustmentSum = (item: any): number =>
  ((item?.adjustments ?? []) as any[]).reduce((sum, adjustment) => sum + toNumber(adjustment?.amount), 0)

const promoNoteFor = (order: any, preview: any, actions: EditAction[]): string | null => {
  const codes = promoCodesOf(order)
  if (!codes.length) return null
  const originals = new Map(((order.items ?? []) as any[]).map((item) => [item.id, item]))
  const previewItems = (preview?.items ?? []) as any[]

  // Nové řádky (přidání, výměna) bez slevy.
  const added = previewItems.filter((item) => !originals.has(item?.id))
  const addedUndiscounted =
    added.length > 0 && !added.some((item) => adjustmentSum(item) > 0)

  // Navýšený počet: Medusa slevu na řádku v úpravě nepřepočítá — doplněné
  // kusy jsou za běžnou cenu (změřeno na #41: 2 ks 54 Kč → 3 ks 84 Kč).
  const raisedUndiscounted = actions.some((action) => {
    if (action.type !== "set_quantity") return false
    const original = originals.get(action.item_id)
    if (!original || action.quantity <= lineQuantityOf(original)) return false
    if (!(adjustmentSum(original) > 0)) return false
    const after = previewItems.find((item) => item?.id === action.item_id)
    return adjustmentSum(after) <= adjustmentSum(original) + 0.005
  })

  return addedUndiscounted || raisedUndiscounted
    ? `Slevový kód ${codes.join(", ")} se na doplněné kusy nevztahuje — jsou za běžnou cenu.`
    : null
}

/**
 * Úprava nebo její náhled. Pravidla → akce v Meduse → přepočet poštovného →
 * náhled → (náhled: zahodit) / (uložit: vyrovnání peněz podle matice).
 */
export const runCustomerEdit = async (
  container: MedusaContainer,
  order: any,
  actions: EditAction[],
  options: { dryRun: boolean; requestedBy?: string | null }
): Promise<EditRunResult> => {
  const [{ mode, reason: gateReason }, counts] = await Promise.all([
    editabilityMode(container, order),
    editCounts(container, order.id),
  ])
  if (mode === "none") {
    throw notAllowed(gateReason ?? "Objednávku teď upravit nejde.")
  }
  if (counts.pending) {
    throw notAllowed(
      "Máte rozpracovanou úpravu, která čeká na zaplacení rozdílu. Dokončete ji, nebo ji zrušte."
    )
  }
  if (counts.foreignActive) {
    throw notAllowed("Objednávku právě upravujeme u nás — zkuste to prosím za chvíli.")
  }
  // Zbytek po spadlém náhledu by blokoval každou další úpravu — uklidit.
  // (Aktivní změna je vždy nejvýš jedna, storno ji zruší celou.)
  if (counts.staleDryRun.length) {
    await cancelBeginOrderEditWorkflow(container)
      .run({ input: { order_id: order.id } as never })
      .catch(() => undefined)
  }

  const payment = paymentKind(order)
  const lines = await describeLines(container, order)
  if (lines.length && lines.every((line) => line.lock === "made_to_order")) {
    throw notAllowed("Zakázku upravujeme spolu v konverzaci k zakázce — tady jde změnit jen doručení.")
  }

  const verdict = validateEditActions(
    lines.map((line) => ({
      id: line.item.id,
      quantity: line.quantity,
      is_made_to_order: line.lock === "made_to_order",
      lock: line.lock,
      variant_ids: line.siblings.map((variant) => variant.id),
      variant_id: line.item.variant_id ?? null,
    })),
    actions,
    { mode, confirmedEdits: counts.confirmed }
  )
  if (verdict.ok === false) {
    throw notAllowed(verdict.reason)
  }

  // Cíle přidání a výměny za JINÝ výrobek (§3d.10): pravidla produktu
  // (zakázka, balíček, poškozený kus, dobírka) a sklad. Výměna za variantu
  // téhož výrobku ta pravidla nepotřebuje — výrobek už v objednávce je.
  const siblingIds = new Map(
    lines.map((line) => [line.item.id, new Set(line.siblings.map((variant) => variant.id))])
  )
  const targetIds = [
    ...new Set(
      actions.flatMap((action) =>
        action.type === "add"
          ? [action.variant_id]
          : action.type === "swap" && !siblingIds.get(action.item_id)?.has(action.variant_id)
            ? [action.variant_id]
            : []
      )
    ),
  ]
  const addVariants = await loadVariants(container, order, { id: targetIds })
  if (addVariants.length !== targetIds.length) {
    throw notAllowed("Vybraný výrobek už v obchodě není.")
  }
  const addProfiles = await productionProductIds(
    container,
    [...new Set(addVariants.map((variant) => variant.product_id))]
  )
  for (const variant of addVariants) {
    const problem = addTargetProblem({
      product: { metadata: variant.product_metadata },
      hasProductionProfile: addProfiles.has(variant.product_id),
      payment,
    })
    if (problem) throw notAllowed(problem)
  }

  const lineById = new Map(lines.map((line) => [line.item.id, line]))
  const wanted = new Map<string, number>() // variant → kusů navíc ze skladu
  for (const action of actions) {
    if (action.type === "add") {
      wanted.set(action.variant_id, (wanted.get(action.variant_id) ?? 0) + action.quantity)
    } else if (action.type === "set_quantity") {
      const line = lineById.get(action.item_id)
      const extra = action.quantity - (line?.quantity ?? 0)
      if (line?.item.variant_id && extra > 0) {
        wanted.set(line.item.variant_id, (wanted.get(line.item.variant_id) ?? 0) + extra)
      }
    } else if (action.type === "swap") {
      const line = lineById.get(action.item_id)
      if (line && action.variant_id !== line.item.variant_id) {
        wanted.set(action.variant_id, (wanted.get(action.variant_id) ?? 0) + line.quantity)
      }
    }
  }
  const stockVariants = [
    ...addVariants,
    ...lines.flatMap((line) => line.siblings).filter((variant) => wanted.has(variant.id)),
  ]
  const stock = await availabilityOf(container, order, stockVariants)
  for (const [variantId, quantity] of wanted) {
    const free = stock.get(variantId)
    if (free !== null && free !== undefined && quantity > free) {
      throw notAllowed(
        free <= 0
          ? "Tahle varianta je vyprodaná — vyberte prosím jinou."
          : `Skladem zbývá jen ${free} ks — snižte prosím počet.`
      )
    }
  }

  const { result: change } = await beginOrderEditOrderWorkflow(container).run({
    input: {
      order_id: order.id,
      description: CUSTOMER_EDIT_DESCRIPTION,
      ...(options.dryRun ? { internal_note: DRY_RUN_NOTE } : {}),
      created_by: options.requestedBy ?? order.customer_id ?? undefined,
    } as never,
  })
  const changeId = (change as any).id as string
  const orderModule = container.resolve(Modules.ORDER) as any

  const discard = async () => {
    await cancelBeginOrderEditWorkflow(container)
      .run({ input: { order_id: order.id } as never })
      .catch(() => undefined)
  }

  try {
    // Výchozí součty z téže výpočetní cesty (náhled bez akcí) — „bylo" a
    // „bude" se tak počítají stejně a rozdíl nemůže vzniknout jen z toho,
    // že objednávka a náhled sčítají jinak.
    const before = totalsOf(await orderModule.previewOrderChange(order.id))

    for (const action of actions) {
      if (action.type === "remove") {
        await orderEditUpdateItemQuantityWorkflow(container).run({
          input: { order_id: order.id, items: [{ id: action.item_id, quantity: 0 }] } as never,
        })
      } else if (action.type === "set_quantity") {
        await orderEditUpdateItemQuantityWorkflow(container).run({
          input: { order_id: order.id, items: [{ id: action.item_id, quantity: action.quantity }] } as never,
        })
      } else if (action.type === "swap") {
        const line = lineById.get(action.item_id)
        // Výměna zachovává množství řádku (BigNumber-safe přes detail).
        const quantity = Math.max(1, line?.quantity ?? 1)
        await orderEditUpdateItemQuantityWorkflow(container).run({
          input: { order_id: order.id, items: [{ id: action.item_id, quantity: 0 }] } as never,
        })
        await orderEditAddNewItemWorkflow(container).run({
          input: { order_id: order.id, items: [{ variant_id: action.variant_id, quantity }] } as never,
        })
      } else {
        await orderEditAddNewItemWorkflow(container).run({
          input: {
            order_id: order.id,
            items: [{ variant_id: action.variant_id, quantity: action.quantity }],
          } as never,
        })
      }
    }

    let preview = await orderModule.previewOrderChange(order.id)
    if (await applyShippingRecalculation(container, order, changeId, totalsOf(preview).item_total)) {
      preview = await orderModule.previewOrderChange(order.id)
    }
    const after = totalsOf(preview)
    const difference = round2(after.total - before.total)

    // Zabalená objednávka: výměna MUSÍ být za stejnou cenu — náhled je soudce.
    if (mode === "swap_only" && Math.abs(difference) > 0.005) {
      throw notAllowed(
        "Objednávka je už zabalená — vyměnit jde jen za výrobek nebo provedení ve STEJNÉ ceně. S doplatkem nebo vrácením rozdílu nám prosím zavolejte."
      )
    }

    const settlement = decideSettlement(difference, payment)
    const summary: EditPreview = {
      item_total_before: before.item_total,
      item_total_after: after.item_total,
      shipping_before: before.shipping_total,
      shipping_after: after.shipping_total,
      total_before: before.total,
      total_after: after.total,
      difference,
      settlement: {
        kind: settlement.kind,
        amount: settlement.kind === "none" ? 0 : settlement.amount,
      },
      money_sentence: moneySentence({ difference, payment, totalAfter: after.total }),
      shipping_note: shippingNote(before.shipping_total, after.shipping_total),
      promo_note: promoNoteFor(order, preview, actions),
    }

    if (options.dryRun) {
      await discard()
      return { status: "preview", preview: summary }
    }

    if (settlement.kind === "collect") {
      // Karta + dráž: změna čeká, potvrdí ji až zaplacení (subscriber
      // order-edit-payment) — nezaplacená úprava nikdy neexistuje.
      const { result: collections } = await createOrderPaymentCollectionWorkflow(container).run({
        input: { order_id: order.id, amount: settlement.amount } as never,
      })
      const collection = (collections as any[])[0]
      const { result: session } = await createPaymentSessionsWorkflow(container).run({
        input: {
          payment_collection_id: collection.id,
          provider_id: "pp_comgate_comgate",
          data: {
            method: "ALL",
            email: order.email,
            country_code: "CZ",
            label: `Obj. ${order.display_id}`.slice(0, 16),
            name: `Doplatek úpravy objednávky ${order.display_id}`,
            lang: "cs",
            order_change_id: changeId,
            order_id: order.id,
            edit_difference: settlement.amount,
          },
        } as never,
      })
      const paymentUrl = paymentUrlFromSession(session)
      if (!paymentUrl) throw new Error("ComGate nevrátil platební odkaz.")
      return {
        status: "awaiting_payment",
        preview: summary,
        payment_url: paymentUrl,
        message: `Změna je připravená — platí, až zaplatíte rozdíl ${settlement.amount} Kč.`,
      }
    }

    // Stav plateb PŘED potvrzením — Medusa po něm autorizovanou platbu
    // (dobírka / odběr) zruší a doplatek zakázky přepočítá (lib/order-edit/payments.ts).
    const paymentsBefore = {
      payLaterProvider: payLaterProviderOf(order),
      balance: balanceSnapshotOf(order),
    }

    await confirmOrderEditRequestWorkflow(container).run({
      input: { order_id: order.id, confirmed_by: options.requestedBy ?? order.customer_id ?? undefined } as never,
    })

    // Po potvrzení už nic nesmí shodit odpověď — změna platí. Návazné kroky
    // (platby, záznam, žádost o vrácení, zvonek) jsou best-effort s logem.
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    const repair = await repairPaymentsAfterEdit(container, order.id, paymentsBefore).catch((error) => {
      logger.error(`[úprava] Platby po úpravě #${order.display_id} se nepodařilo srovnat: ${error?.message}`)
      return { pay_later: "missing", balance: null } as const
    })
    if (paymentsBefore.payLaterProvider && repair.pay_later === "missing") {
      // Bez platby „při převzetí" by štítek odešel bez dobírky — musí to vědět.
      await notifyMerchant(container, {
        key: `customer-edit-payment:${changeId}`,
        title: `Objednávka #${order.display_id}: po úpravě chybí platba při převzetí`,
        description:
          "Zákazník upravil objednávku na dobírku / osobní odběr a platbu se nepodařilo obnovit. Před odesláním zkontrolujte platbu (dobírka by jinak nevznikla).",
        audience: "owner",
        email: true,
        resource: { id: order.id, type: "order" },
      }).catch(() => undefined)
    }
    await recordCustomerEdit(container, order.id, {
      change_id: changeId,
      difference,
      payment,
      settlement: settlement.kind,
    }).catch((error) => logger.warn(`[úprava] Záznam úpravy #${order.display_id} selhal: ${error?.message}`))

    let claimRequestId: string | null = null
    if (settlement.kind === "refund_due") {
      claimRequestId = await createEditRefundRequest(container, order, {
        amount: settlement.amount,
        changeId,
      }).catch((error) => {
        logger.error(`[úprava] Žádost o vrácení rozdílu #${order.display_id} nevznikla: ${error?.message}`)
        return null
      })
    }

    await notifyMerchant(container, {
      key: `customer-edit:${changeId}`,
      title: `Zákazník upravil objednávku #${order.display_id}`,
      description:
        settlement.kind === "refund_due"
          ? `Rozdíl ${settlement.amount} Kč k vrácení — žádost čeká v Reklamace a zrušení.`
          : payment === "card"
            ? "Cena se nezměnila."
            : `Nová částka ${after.total} Kč se vyrovná při předání.`,
      audience: "owner",
      email: true,
      resource: { id: order.id, type: "order" },
    }).catch(() => undefined)

    // Potvrzení zákazníkovi (§3d.11) — s tou samou větou o penězích, jakou
    // viděl v souhrnu.
    await sendOrderEditedEmail(container, order.id, {
      changeId,
      difference,
      moneySentence: summary.money_sentence,
    }).catch((error) =>
      logger.warn(`[úprava] E-mail o úpravě #${order.display_id} neodešel: ${error?.message}`)
    )

    return {
      status: "confirmed",
      preview: summary,
      claim_request_id: claimRequestId,
      message:
        settlement.kind === "refund_due"
          ? `Uloženo. Rozdíl ${settlement.amount} Kč vám vrátíme na kartu.`
          : "Uloženo.",
    }
  } catch (error) {
    await discard()
    throw error
  }
}

/**
 * Zákazník si rozpracovanou (nezaplacenou) úpravu rozmyslel: zrušit změnu
 * i nezaplacenou kolekci doplatku, ať objednávka nevisí jako nedoplacená.
 * Jen JEHO úpravu — změnu založenou u nás (admin) nechá být.
 */
export const cancelCustomerEdit = async (container: MedusaContainer, orderId: string) => {
  const counts = await editCounts(container, orderId)
  if (counts.foreignActive) {
    return
  }
  await cancelBeginOrderEditWorkflow(container)
    .run({ input: { order_id: orderId } as never })
    .catch(() => undefined)
  await cancelEditPaymentCollections(container, orderId, counts.pending?.id ?? null).catch(() => 0)
}

/* ------------------------------------------------------------------------ */
/* Mini obchod                                                               */
/* ------------------------------------------------------------------------ */

export type EditCatalog = {
  can_add: boolean
  reason: string | null
  payment: PaymentKind
  /** `add` = přidat kus, `swap` = náhrada za konkrétní řádek (§3d.10). */
  purpose: "add" | "swap"
  /** Výměna po zabalení — jen výrobky ve stejné ceně. */
  same_price_only: boolean
  item: { id: string; title: string; quantity: number; unit_price: number } | null
  allowed: Record<string, string[]>
}

/**
 * Co jde do objednávky přidat (§3c.2), nebo čím jde nahradit řádek
 * (`swapItemId`, §3d.10): publikované produkty prodejního kanálu objednávky
 * bez zakázky, balíčků a poškozených kusů; varianty jen skladem (nebo
 * s backorderem); u dobírky jen `cod_allowed`. Výměna: bez vlastní varianty
 * řádku, skladem aspoň na počet kusů řádku, po zabalení jen stejná cena.
 * Storefront produkty načte běžným výpisem a ukáže jen tyhle — server je
 * soudce i při uložení.
 */
export const buildEditCatalog = async (
  container: MedusaContainer,
  order: any,
  options: { swapItemId?: string | null } = {}
): Promise<EditCatalog> => {
  const context = await buildEditContext(container, order)
  const purpose: EditCatalog["purpose"] = options.swapItemId ? "swap" : "add"
  const swapItem =
    purpose === "swap" ? context.items.find((item) => item.id === options.swapItemId) ?? null : null
  const sameOnly = purpose === "swap" && context.mode === "swap_only"
  const base = {
    payment: context.payment,
    purpose,
    same_price_only: sameOnly,
    item: swapItem
      ? {
          id: swapItem.id,
          title: swapItem.title,
          quantity: swapItem.quantity,
          unit_price: swapItem.unit_price,
        }
      : null,
  }
  const closed = (reason: string): EditCatalog => ({ ...base, can_add: false, reason, allowed: {} })

  if (purpose === "add" && !context.can_add) {
    return closed(context.reason ?? "Přidávat jde jen do doby, než objednávku začneme balit.")
  }
  if (purpose === "swap") {
    if (!swapItem) return closed("Položka v objednávce není.")
    if (!context.editable || !context.items_editable || context.mode === "none") {
      return closed(context.reason ?? "Objednávku už upravit nejde.")
    }
    if (swapItem.lock) return closed(swapItem.lock_reason ?? "Tuhle položku vyměnit nejde.")
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "metadata", "sales_channels.id", "variants.id", "variants.manage_inventory", "variants.allow_backorder"],
    filters: { status: "published" } as never,
  })
  const inChannel = (products as any[]).filter(
    (product) =>
      !order.sales_channel_id ||
      ((product?.sales_channels ?? []) as any[]).some((channel) => channel?.id === order.sales_channel_id)
  )
  const profiles = await productionProductIds(container, inChannel.map((product) => product.id))
  const eligible = inChannel.filter(
    (product) =>
      !addTargetProblem({
        product,
        hasProductionProfile: profiles.has(product.id),
        payment: context.payment,
      })
  )
  // Ceny jen tam, kde rozhodují (výměna po zabalení) — jinak stačí sklad.
  const variants: VariantInfo[] = sameOnly
    ? await loadVariants(container, order, { product_id: eligible.map((product) => product.id) })
    : eligible.flatMap((product) =>
        ((product?.variants ?? []) as any[]).map((variant) => ({
          id: variant.id,
          product_id: product.id,
          title: null,
          manage_inventory: variant.manage_inventory !== false,
          allow_backorder: Boolean(variant.allow_backorder),
          price: null,
          product_metadata: product.metadata ?? null,
        }))
      )
  const stock = await availabilityOf(container, order, variants)
  const need = swapItem ? Math.max(1, swapItem.quantity) : 1

  const allowed: Record<string, string[]> = {}
  for (const variant of variants) {
    if (swapItem && variant.id === swapItem.variant_id) continue
    if (sameOnly && (variant.price === null || Math.abs(variant.price - (swapItem?.unit_price ?? 0)) > 0.005)) {
      continue
    }
    const free = stock.get(variant.id)
    if (free === null || free === undefined || free >= need) {
      ;(allowed[variant.product_id] ??= []).push(variant.id)
    }
  }
  return { ...base, can_add: true, reason: null, allowed }
}
