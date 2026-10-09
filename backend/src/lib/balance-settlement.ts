import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  createOrderPaymentCollectionWorkflow,
  markPaymentCollectionAsPaid,
} from "@medusajs/medusa/core-flows"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"
import { markBalanceRequestPaid, outstandingFor } from "./balance-payment"
import { toNumber } from "./order-quantity"
import { epsilonFor } from "./ship-gate"

/**
 * „Zaplaceno na místě" — doplatek zakázky zaplacený mimo bránu (u pultu
 * hotově / kartou v ateliéru / převodem na účet).
 *
 * ## Proč to existuje
 *
 * ZMĚŘENO 9. 10. 2026 na objednávce #31 (zakázka, osobní odběr): záloha 1 075 Kč
 * přes ComGate, doplatek 3 225 Kč = druhá platební kolekce `not_paid` BEZ
 * platby. „Vyzvednuto a zaplaceno" nenašlo co zachytit, zachycení přeskočilo a
 * objednávku i tak odeslalo — zůstala „odeslaná" s 3 225 Kč nezaplacenými a
 * bez místa, kam zapsat hotovost z pultu. Rozhodnutí majitelky: vyzvednutí
 * zakázky se vyrovnává RUČNĚ jedním tlačítkem, které platbu zapíše A pošle
 * fakturu.
 *
 * ## Co jedno kliknutí udělá
 *
 * 1. **Nativní strana** — peníze se zapíší do platební kolekce objednávky:
 *    otevřená (`not_paid`, nic nezachyceno) kolekce doplatku se znovu použije
 *    (částka se srovná na skutečný dluh), jinak vznikne nová přes
 *    `createOrderPaymentCollectionWorkflow`; pak `markPaymentCollectionAsPaidWorkflow`
 *    (systémová platba + capture). Díky tomu brána odeslání
 *    (zachyceno − vráceno ≥ celkem) i stav platby sedí. Způsob platby a
 *    poznámka jdou do metadat kolekce (`offline_method`, `offline_note`,
 *    `recorded_by`) — a právě podle `offline_method` pozná `customer-emails`
 *    `onPaymentCaptured`, že NEMÁ posílat „Platba přijata — Online platba".
 * 2. **Produkční strana** — přesně jako doplatek potvrzený bránou
 *    (`markBalanceRequestPaid`): žádost → `paid`, fáze → „připraveno", event
 *    `made-to-order.balance-paid` → potvrzení zákazníkovi + doplatková faktura
 *    + zvoneček majitelce. Bez otevřené žádosti (výzva nikdy neodešla) se
 *    žádost založí rovnou — faktura i e-mail na ní visí.
 *
 * ## Pořadí a opakování
 *
 * Nativní zápis jde PRVNÍ: když selže, nic se nestalo (žádný e-mail, žádná
 * faktura). Když naopak selže produkční strana, zůstane objednávka nativně
 * zaplacená a dluh zakázky otevřený — opakované kliknutí to pozná (nativní
 * dluh = 0 → nativní zápis přeskočí) a dotáhne jen produkční stranu. Nikdy
 * se tedy nezachytí dvakrát.
 *
 * ## Jen celý doplatek
 *
 * Částečná platba je mimo rozsah: dvě žádosti o doplatek, dvě faktury, dva
 * e-maily. Částka buď chybí (= celý dluh), nebo se musí rovnat dluhu.
 *
 * ## Zaplaceno online mezitím
 *
 * `markPaymentCollectionAsPaid` zakládá novou (systémovou) relaci a Medusa při
 * tom smaže stávající relaci ComGate; provider ComGate smazání ODMÍTNE, když
 * je transakce u brány PAID/AUTHORIZED. To je správně — zákazník už zaplatil
 * online a hotovost se zapisovat nemá; chyba se přeloží do češtiny níž.
 */

export type OfflineSettlementMethod = "cash" | "card_on_site" | "bank_transfer"

export const OFFLINE_SETTLEMENT_METHODS: OfflineSettlementMethod[] = [
  "cash",
  "card_on_site",
  "bank_transfer",
]

/** Česky, do hlášky a do e-mailu majitelce. */
export const OFFLINE_METHOD_LABELS: Record<OfflineSettlementMethod, string> = {
  cash: "hotově",
  card_on_site: "kartou v ateliéru",
  bank_transfer: "převodem na účet",
}

export const isOfflineSettlementMethod = (
  value: unknown
): value is OfflineSettlementMethod =>
  typeof value === "string" &&
  (OFFLINE_SETTLEMENT_METHODS as string[]).includes(value)

const roundMoney = (value: number) => Math.round(value * 100) / 100

/**
 * Částka k zaznamenání: bez zadání = celý dluh; zadaná se musí rovnat dluhu
 * (do haléře). Čistá funkce — pravidlo „jen celý doplatek" je tím testovatelné.
 */
export const resolveSettlementAmount = (
  outstanding: number,
  requested?: number | null
): number => {
  const owed = roundMoney(outstanding)
  if (requested === undefined || requested === null) {
    return owed
  }
  const wanted = Number(requested)
  if (!Number.isFinite(wanted) || wanted <= 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Částka doplatku musí být kladné číslo."
    )
  }
  // V haléřích a celočíselně — `0.0100000002 > 0.01` by jinak odmítlo rozdíl,
  // který je po zaokrouhlení přesně jeden haléř.
  if (Math.round(Math.abs(wanted - owed) * 100) > 1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Zaznamenat jde jen celý doplatek (${owed.toLocaleString("cs-CZ")}). Částečné platby zatím nejdou — zbytek domluvte se zákazníkem zvlášť.`
    )
  }
  return owed
}

export type SettlementCollection = {
  id: string
  status?: string | null
  amount?: unknown
  captured_amount?: unknown
  refunded_amount?: unknown
  metadata?: Record<string, unknown> | null
  payments?: Array<{ captured_at?: unknown; canceled_at?: unknown }> | null
}

/**
 * Otevřená kolekce doplatku, do které jde platbu zapsat: `not_paid` a nic
 * v ní nezachyceno. To je ta, kterou založila výzva k doplacení
 * (`ensureBalancePaymentLink` / `request_balance`). Přednost má kolekce na
 * stejnou částku; jinak kterákoli prázdná `not_paid` (částka se srovná).
 * `awaiting`/`authorized` se vynechají — `markPaymentCollectionAsPaid` bere
 * jen `not_paid`.
 */
export const pickOpenBalanceCollection = (
  collections: SettlementCollection[] | null | undefined,
  amount: number
): SettlementCollection | null => {
  const open = (collections || []).filter((collection) => {
    const status = String(collection?.status ?? "").toLowerCase()
    if (status !== "not_paid") return false
    if (toNumber(collection.captured_amount) > 0.005) return false
    return !(collection.payments || []).some(
      (payment) => payment?.captured_at && !payment?.canceled_at
    )
  })
  return (
    open.find(
      (collection) => Math.abs(toNumber(collection.amount) - amount) <= 0.01
    ) ??
    open[0] ??
    null
  )
}

/**
 * Co objednávce chybí NATIVNĚ: celkem − (zachyceno − vráceno). Stejná
 * aritmetika jako brána odeslání. Když je ≤ 0, peníze už jsou zapsané (třeba
 * z přerušeného předchozího pokusu) a nativní zápis se přeskočí.
 */
export const nativeShortfall = (order: {
  total?: unknown
  payment_collections?: SettlementCollection[] | null
}): number => {
  const collections = order.payment_collections || []
  const captured = collections.reduce(
    (sum, collection) => sum + toNumber(collection.captured_amount),
    0
  )
  const refunded = collections.reduce(
    (sum, collection) => sum + toNumber(collection.refunded_amount),
    0
  )
  return roundMoney(toNumber(order.total) - (captured - refunded))
}

/**
 * Pravidlo pro `customer-emails.onPaymentCaptured`: zachycení, které patří k
 * doplatku zakázky, už svůj e-mail MÁ („Doplatek přijat" z
 * `made-to-order.balance-paid`) — generické „Platba přijata — Online platba"
 * by bylo podruhé a u hotovosti navíc nepravdivé.
 *
 * 1. Kolekce nese `offline_method` → ruční záznam, přeskočit.
 * 2. Záchrana: zaplacená žádost o doplatek ukazuje na tutéž kolekci, nebo byla
 *    označena zaplacenou v posledních 5 minutách (brána i ruční záznam
 *    označují žádost ve stejné transakci, ve které se platba zachytí).
 */
export const captureCoveredByBalanceMail = (
  payment: {
    payment_collection?: {
      id?: string | null
      metadata?: Record<string, unknown> | null
    } | null
  } | null | undefined,
  balanceRequests: Array<{
    type?: string | null
    status?: string | null
    payment_collection_id?: string | null
    paid_at?: unknown
  }> | null | undefined,
  now: number = Date.now()
): boolean => {
  const collection = payment?.payment_collection
  if (collection?.metadata && collection.metadata.offline_method) {
    return true
  }
  return (balanceRequests || []).some((request) => {
    if (request?.type !== "balance" || request?.status !== "paid") return false
    if (collection?.id && request.payment_collection_id === collection.id) {
      return true
    }
    const paidAt = request.paid_at ? new Date(request.paid_at as string).getTime() : NaN
    return Number.isFinite(paidAt) && Math.abs(now - paidAt) < 5 * 60 * 1000
  })
}

export type SettleBalanceOfflineInput = {
  order_id: string
  method: OfflineSettlementMethod
  /** Nepovinná; když je, musí se rovnat dluhu (jen celý doplatek). */
  amount?: number | null
  note?: string | null
  /** Kdo klikl (auth actor) — do metadat kolekce. */
  actor?: string | null
}

export type SettleBalanceOfflineResult =
  | { settled: false; reason: string; outstanding: 0 }
  | {
      settled: true
      amount: number
      currency_code: string
      method: OfflineSettlementMethod
      request_id: string
      payment_collection_id: string | null
      display_id: number | string | null
    }

/**
 * Švy pro unit testy: produkční volající je nechávají prázdné a dostanou
 * nativní workflows (vzor `dobirka-capture.captureDobirkaPayment`).
 */
export type SettlementRunners = {
  createCollection?: (input: {
    order_id: string
    amount: number
  }) => Promise<{ id: string }>
  markPaid?: (input: {
    order_id: string
    payment_collection_id: string
    captured_by?: string
  }) => Promise<unknown>
}

const ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "currency_code",
  // `total` se počítá z položek — bez `items.*` je nula a dluh by vypadal nulový.
  "total",
  "items.*",
  "payment_collections.id",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.refunded_amount",
  "payment_collections.metadata",
  "payment_collections.payments.id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
]

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const settleBalanceOffline = async (
  container: MedusaContainer,
  input: SettleBalanceOfflineInput,
  runners: SettlementRunners = {}
): Promise<SettleBalanceOfflineResult> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const madeToOrder = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  if (!isOfflineSettlementMethod(input.method)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Způsob platby musí být hotově, kartou v ateliéru nebo převodem na účet."
    )
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: input.order_id },
  })
  const order = orders[0] as any
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }

  const [productionOrder] = (await madeToOrder.listProductionOrders({
    order_id: input.order_id,
  } as never)) as any[]
  if (!productionOrder) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Objednávka není zakázka — doplatek na místě se zaznamenává jen u zakázek."
    )
  }
  if (productionOrder.stage === "cancelled") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Zrušená zakázka nemá co doplácet."
    )
  }

  const requests = (await madeToOrder.listProductionPaymentRequests({
    production_order_id: productionOrder.id,
  } as never)) as any[]

  const outstanding = outstandingFor(productionOrder, requests)
  if (outstanding <= 0.005) {
    return { settled: false, reason: "nic nezbývá", outstanding: 0 }
  }

  const amount = resolveSettlementAmount(outstanding, input.amount)
  const currencyCode = String(
    order.currency_code || productionOrder.currency_code || "czk"
  ).toLowerCase()
  const note = input.note?.trim() || null

  // ── 1. Nativní strana ──────────────────────────────────────────────────
  // Přeskočí se, když objednávce nativně nic nechybí — typicky opakování po
  // pádu produkční strany; podruhé se nezachytí.
  let paymentCollectionId: string | null = null
  const shortfall = nativeShortfall(order)
  if (shortfall > epsilonFor(currencyCode)) {
    const paymentModule = container.resolve(Modules.PAYMENT)
    const createCollection =
      runners.createCollection ??
      (async (data: { order_id: string; amount: number }) =>
        (
          await createOrderPaymentCollectionWorkflow(container).run({
            input: data,
          })
        ).result[0] as { id: string })
    const markPaid =
      runners.markPaid ??
      (async (data: {
        order_id: string
        payment_collection_id: string
        captured_by?: string
      }) => {
        await markPaymentCollectionAsPaid(container).run({ input: data })
      })

    const existing = pickOpenBalanceCollection(order.payment_collections, amount)
    const collection = existing
      ? existing
      : await createCollection({ order_id: order.id, amount })
    paymentCollectionId = collection.id

    // Metadata PŘED zachycením: `payment.captured` odejde uvnitř workflow a
    // odběratel (customer-emails) podle `offline_method` pozná, že e-mail
    // „Platba přijata" nemá posílat. Částka se srovná na skutečný dluh —
    // odkaz mohl vzniknout před příplatkem a `markPaymentCollectionAsPaid`
    // zachytí přesně `collection.amount`.
    const existingAmount = toNumber((collection as any).amount)
    await paymentModule.updatePaymentCollections(collection.id, {
      ...(existing && Math.abs(existingAmount - amount) > 0.01 ? { amount } : {}),
      metadata: {
        ...(((collection as any).metadata as Record<string, unknown>) ?? {}),
        offline_method: input.method,
        offline_note: note,
        recorded_by: input.actor ?? null,
        recorded_at: new Date().toISOString(),
        made_to_order_balance: true,
      },
    })

    try {
      await markPaid({
        order_id: order.id,
        payment_collection_id: collection.id,
        captured_by: input.actor ?? undefined,
      })
    } catch (error) {
      const message = describe(error)
      // ComGate odmítla pustit svou relaci, protože transakce je u brány už
      // zaplacená/autorizovaná — zákazník mezitím zaplatil online. Hotovost
      // se nezapisuje; stav dorovná návrat z brány / 30min job.
      if (/is (PAID|AUTHORIZED)/.test(message)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Brána hlásí, že zákazník doplatek už zaplatil online. Nic nezaznamenávejte — stav se dorovná sám (nejpozději do 30 minut)."
        )
      }
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Platbu se nepodařilo zapsat k objednávce: ${message}`
      )
    }
  } else {
    logger.info(
      `[balance] #${order.display_id ?? order.id}: nativně už nic nechybí — doplatek na místě dotahuje jen stranu zakázky.`
    )
    paymentCollectionId =
      pickOpenBalanceCollection(order.payment_collections, amount)?.id ?? null
  }

  // ── 2. Produkční strana — stejný ocas jako doplatek z brány ────────────
  const openBalances = requests.filter(
    (request) =>
      request.type === "balance" && ["pending", "sent"].includes(request.status)
  )
  // Přednost má žádost na správnou částku (odkaz, co zákazník dostal); jinak
  // nejnovější otevřená — částka se jí srovná v `markBalanceRequestPaid`.
  let request =
    openBalances.find(
      (candidate) => Math.abs(toNumber(candidate.amount) - amount) <= 0.01
    ) ?? openBalances[0]

  if (!request) {
    // Výzva nikdy neodešla (zakázka doplacená u pultu bez odkazu) — žádost
    // vznikne rovnou jako zaplacená, protože doplatková faktura i e-mail
    // „Doplatek přijat" na ní visí (`ensureMadeToOrderInvoices` hledá
    // `type: balance, status: paid`). Klíč nese čas, ať nekoliduje s klíčem
    // brány `balance:{zakázka}:{částka}`, který může patřit vypršelému pokusu.
    request = await madeToOrder.createProductionPaymentRequests({
      type: "balance",
      status: "paid",
      amount,
      currency_code: currencyCode,
      payment_collection_id: paymentCollectionId,
      idempotency_key: `balance-offline:${productionOrder.id}:${Date.now()}`,
      create_state: "created",
      provider_status: "PAID_OFFLINE",
      selected_method: input.method,
      paid_at: new Date(),
      production_order_id: productionOrder.id,
    } as never)
  }

  await markBalanceRequestPaid(container, {
    request,
    productionOrder,
    orderId: order.id,
    gateway: "offline",
    method: input.method,
    amount,
    paymentCollectionId,
  })

  // Ostatní otevřené výzvy už nemají co vybírat — jinak by fronta dál hlásila
  // „odkaz odeslán" a 30min job je dál kontroloval.
  for (const stale of openBalances.filter((candidate) => candidate.id !== request.id)) {
    await madeToOrder
      .updateProductionPaymentRequests({
        id: stale.id,
        status: "cancelled",
        provider_error_reason: "Doplatek zaplacen na místě.",
        last_checked_at: new Date(),
      } as never)
      .catch(() => undefined)
  }

  logger.info(
    `[balance] #${order.display_id ?? order.id}: doplatek ${amount} ${currencyCode.toUpperCase()} zaznamenán na místě (${OFFLINE_METHOD_LABELS[input.method]}), žádost ${request.id}, kolekce ${paymentCollectionId ?? "—"}.`
  )

  return {
    settled: true,
    amount,
    currency_code: currencyCode,
    method: input.method,
    request_id: request.id,
    payment_collection_id: paymentCollectionId,
    display_id: order.display_id ?? null,
  }
}
