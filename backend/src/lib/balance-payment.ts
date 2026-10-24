import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  createOrderPaymentCollectionWorkflow,
  createPaymentSessionsWorkflow,
  processPaymentWorkflow,
} from "@medusajs/medusa/core-flows"
import { MADE_TO_ORDER_MODULE } from "../modules/made-to-order"
import type MadeToOrderModuleService from "../modules/made-to-order/service"
import { productionOutstanding } from "./ship-gate"
import { orderConfirmedPath } from "./storefront-url"
import { paymentStatusFromProvider } from "./payment-provider-status"
import { duvodCesky } from "./payment-failure"

/**
 * Getting a customer a link to pay what they still owe on a commission.
 *
 * There are two doors to this — she clicks „Požádat o doplatek" in the admin,
 * or the customer clicks „Doplatit" in an e-mail — and they must produce the
 * *same* link, not two. Two payment collections for one balance means the
 * customer can pay twice, and the second payment has nothing to attach to.
 *
 * So the reuse rules live here, once:
 *
 * 1. An open request that already has a link is returned as-is.
 * 2. Otherwise an open collection for the right amount is reused if one exists.
 * 3. Only then is anything new created, keyed by
 *    `balance:{production_order}:{amount}` so a retry lands on the same row.
 */

export const COMGATE_PROVIDER_ID = "pp_comgate_comgate"

/** Značka v metadatech kolekce doplatku — ať jde poznat mezi ostatními. */
export const BALANCE_COLLECTION_FLAG = "made_to_order_balance"

const openCollectionStatus = (collection: any): boolean =>
  ["not_paid", "awaiting"].includes(String(collection?.status || "").toLowerCase()) &&
  toNumber(collection?.captured_amount) <= 0.005

/** Metadata kolekce doplatku: které zakázce patří (od 20. 10. 2026, zakázka = položka). */
export const BALANCE_COLLECTION_COMMISSION_KEY = "production_order_id"

/**
 * Otevřená kolekce doplatku objednávky (nic nezachyceno). Od 20. 10. 2026 má
 * objednávka kolekci doplatku NA ZAKÁZKU (každá zakázka má vlastní doplatek
 * a odkaz): přednost má kolekce se značkou a `production_order_id` té
 * zakázky, pak značená bez zakázky (starší objednávky s jedinou zakázkou),
 * pak kterákoli otevřená bez značky (nejstarší objednávky) — ta ale jen bez
 * zadané zakázky, ať si dvě zakázky nepřetahují jednu kolekci. ČISTÁ,
 * testovaná.
 */
export const findOpenBalanceCollection = (
  order: any,
  productionOrderId?: string | null
): any | null => {
  const open = ((order?.payment_collections || []) as any[]).filter(openCollectionStatus)
  const flagged = open.filter((collection) => Boolean(collection?.metadata?.[BALANCE_COLLECTION_FLAG]))
  if (productionOrderId) {
    const exact = flagged.find(
      (collection) => collection?.metadata?.[BALANCE_COLLECTION_COMMISSION_KEY] === productionOrderId
    )
    if (exact) return exact
  }
  const untagged = flagged.find((collection) => !collection?.metadata?.[BALANCE_COLLECTION_COMMISSION_KEY])
  if (untagged) return untagged
  if (productionOrderId) {
    // Cizí zakázka má svou kolekci — té se nedotýkat.
    return open.find((collection) => !collection?.metadata?.[BALANCE_COLLECTION_FLAG]) ?? null
  }
  return open[0] ?? null
}

/**
 * Zajistí JEDINOU otevřenou kolekci doplatku na přesně `outstanding` Kč.
 *
 * Proč (změřeno 9. 10. 2026): dokud výzva k doplacení neodešla, kolekce
 * doplatku neexistovala a Medusa hlásila objednávku „zaplaceno" už po záloze
 * (#27: zachyceno 1 225 z 4 450). A po příplatku vznikala DRUHÁ kolekce na
 * novou částku, stará `not_paid` zůstala viset → objednávka se jevila
 * nedoplacená i po zaplacení. Proto: existující otevřená kolekce se srovná na
 * aktuální dluh (příplatek, úprava ceny), jinak vznikne jedna nová se značkou.
 * Platební relace řeší volající (`createPaymentSessionsWorkflow` starou
 * relaci kolekce nahradí).
 */
export const ensureBalanceCollection = async (
  container: MedusaContainer,
  order: any,
  outstanding: number,
  /** Zakázka, které doplatek patří (od 20. 10. 2026 kolekce per zakázka); bez něj jako dřív. */
  productionOrderId?: string | null
): Promise<any> => {
  const paymentModule = container.resolve(Modules.PAYMENT) as any
  const existing = findOpenBalanceCollection(order, productionOrderId)
  const tag = productionOrderId ? { [BALANCE_COLLECTION_COMMISSION_KEY]: productionOrderId } : {}

  if (existing) {
    const patch: Record<string, unknown> = {}
    if (Math.abs(toNumber(existing.amount) - outstanding) > 0.01) {
      patch.amount = outstanding
    }
    if (
      !existing.metadata?.[BALANCE_COLLECTION_FLAG] ||
      (productionOrderId && existing.metadata?.[BALANCE_COLLECTION_COMMISSION_KEY] !== productionOrderId)
    ) {
      patch.metadata = { ...(existing.metadata ?? {}), [BALANCE_COLLECTION_FLAG]: true, ...tag }
    }
    if (!Object.keys(patch).length) {
      return existing
    }
    // Medusa 2.18 vrací u selektoru jeden záznam i pole podle verze — dřív
    // `const [updated] =` padalo na „is not iterable" (každé srovnání
    // existující kolekce doplatku, např. po příplatku). Bere se obojí.
    const result = await paymentModule.updatePaymentCollections({ id: existing.id }, patch)
    const updated = Array.isArray(result) ? result[0] : result
    return updated ?? { ...existing, ...patch }
  }

  const { result } = await createOrderPaymentCollectionWorkflow(container).run({
    input: { order_id: order.id, amount: outstanding },
  })
  const created = result[0]
  const flaggedResult = await paymentModule.updatePaymentCollections(
    { id: created.id },
    { metadata: { ...(created.metadata ?? {}), [BALANCE_COLLECTION_FLAG]: true, ...tag } }
  )
  const flagged = Array.isArray(flaggedResult) ? flaggedResult[0] : flaggedResult
  return flagged ?? created
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return toNumber(candidate.value ?? candidate.numeric_ ?? candidate.raw_ ?? 0)
  }
  return 0
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

export const paymentUrlFromSession = (session: any): string | null => {
  const data = session?.data || {}
  for (const key of ["redirectUrl", "redirect", "payment_url"]) {
    if (typeof data[key] === "string" && data[key].startsWith("https://")) {
      return data[key]
    }
  }
  return null
}

/**
 * What the customer still owes, from the module's own snapshots.
 *
 * Stejná aritmetika jako brána odeslání (`ship-gate.productionOutstanding`):
 * (dohodnutá ?? původní) + příplatek − zaplaceno. Jedna funkce, aby doplatek
 * a brána nikdy nevyprávěly dvě verze téhož dluhu. Tady navíc zaokrouhleno a
 * nikdy pod nulu — přeplatek je otázka vratky, ne záporný doplatek.
 */
export const outstandingFor = (
  productionOrder: any,
  requests: any[]
): number =>
  roundMoney(
    Math.max(
      0,
      productionOutstanding({ ...productionOrder, payment_requests: requests })
    )
  )

/**
 * Doplatek zakázky podle kolekce z pokladny (`prepare-made-to-order-payment`
 * zapisuje `made_to_order`, `original_cart_total`, `production_lines`):
 * celá cena košíku − to, co se v pokladně účtovalo. Stejný výpočet jako
 * `balance` v `initialize-merchant-order`, jen bez produkční objednávky —
 * `null`, když objednávka zakázku z pokladny nemá.
 */
export const checkoutBalanceFromCollections = (
  collections: any[] | null | undefined
): number | null => {
  const collection = (collections ?? []).find(
    (candidate) =>
      candidate?.metadata?.made_to_order &&
      Array.isArray(candidate.metadata.production_lines) &&
      candidate.metadata.production_lines.length > 0
  )
  if (!collection) {
    return null
  }
  const original = toNumber(collection.metadata.original_cart_total)
  if (!(original > 0)) {
    return null
  }
  const charged = toNumber(collection.amount ?? collection.metadata.checkout_payment_amount)
  return roundMoney(Math.max(0, original - charged))
}

/**
 * Kolik objednávka dluží v okamžiku potvrzovacího e-mailu.
 *
 * Potvrzení i `initialize-merchant-order` visí na `order.placed` a běží
 * souběžně: e-mail se často skládá dřív, než subscriber založí produkční
 * objednávku a zálohu (změřeno v sandboxu — zakázka 2 479 Kč, zaplacená
 * záloha 679 Kč, e-mail bez „Zbývá doplatit"). Proto:
 * - bez produkční objednávky → doplatek z kolekce pokladny (běžná objednávka
 *   ji nemá → 0);
 * - produkční objednávka bez zálohy (subscriber je v půlce) → taky z kolekce,
 *   jinak by `outstandingFor` bez zaplacené zálohy vrátil CELOU cenu;
 * - jinak z modulu (`outstandingFor`) — zahrne i příplatek a doplatky.
 */
export const resolveOrderOutstanding = (input: {
  /** Všechny zakázky objednávky (od 20. 10. 2026 jedna na položku); prázdné = běžná objednávka. */
  productionOrders: any[] | null | undefined
  /** Žádosti o platbu všech těch zakázek dohromady. */
  requests: any[] | null | undefined
  collections: any[] | null | undefined
}): number => {
  const fromCheckout = checkoutBalanceFromCollections(input.collections)
  const productionOrders = (input.productionOrders ?? []).filter(Boolean)
  if (!productionOrders.length) {
    return fromCheckout ?? 0
  }
  const requests = input.requests ?? []
  const hasDeposit = requests.some((request) => request?.type === "deposit")
  if (!hasDeposit && fromCheckout !== null) {
    return fromCheckout
  }
  // Součet přes zakázky: každá dluží svůj zbytek, první k tomu dopravu a
  // balné objednávky (`lib/made-to-order/commission-money`).
  return roundMoney(
    productionOrders.reduce(
      (sum, productionOrder) =>
        sum +
        outstandingFor(
          productionOrder,
          requests.filter((request) => request?.production_order_id === productionOrder.id)
        ),
      0
    )
  )
}

export type BalanceLinkResult = {
  /** `null` when nothing is owed. */
  payment_url: string | null
  outstanding: number
  request_id: string | null
  reused: boolean
}

/**
 * Returns a payable link for the outstanding balance, creating one only if
 * there is not already a usable one.
 */
export const ensureBalancePaymentLink = async (
  container: MedusaContainer,
  {
    order,
    productionOrder,
    method = "ALL",
    part = "full",
  }: {
    order: any
    productionOrder: any
    method?: string
    /**
     * "deposit" = jen zbývající část zálohy (cena po domluvě — zákazník si po
     * poslání domluvené ceny vybere „zaplatit zálohu" nebo „zaplatit celé",
     * záloha je povinná). Bez zálohy nebo po jejím zaplacení = celý dluh.
     */
    part?: "full" | "deposit"
  }
): Promise<BalanceLinkResult> => {
  const madeToOrder = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const requests = (await madeToOrder.listProductionPaymentRequests({
    production_order_id: productionOrder.id,
  } as never)) as any[]

  const fullOutstanding = outstandingFor(productionOrder, requests)

  if (fullOutstanding <= 0.005) {
    return { payment_url: null, outstanding: 0, request_id: null, reused: true }
  }

  // Jen záloha: dohodnutá záloha − to, co už je zaplacené (nikdy víc než dluh).
  const paidSoFar = requests
    .filter((request) => request.status === "paid")
    .reduce((sum, request) => sum + toNumber(request.amount), 0)
  const depositLeft = roundMoney(
    Math.max(0, toNumber(productionOrder.deposit_amount) - paidSoFar)
  )
  const depositOnly = part === "deposit" && depositLeft > 0.005 && depositLeft < fullOutstanding
  const outstanding = depositOnly ? depositLeft : fullOutstanding
  // Typ zůstává „balance" i u zálohy: dorovnání po návratu z brány, dohled
  // i vypořádání webhooku (balance-settlement, reconcile-balance-payments)
  // počítají jen s ním — záloha by se jinak nemusela zapsat. Liší se částka
  // a idempotenční klíč.
  const requestType = "balance"

  // 1 — a link that already exists and is still valid.
  //
  // Jen když sedí ČÁSTKA na aktuální nedoplatek. Bez téhle kontroly by příplatek
  // přidaný po vygenerování odkazu nechal zákazníka zaplatit starou (nižší)
  // sumu — doplatek by se „zaplatil", ale backend by dál chtěl zbytek. Když
  // částka nesedí, spadneme níž a vznikne odkaz na správnou (vyšší) částku pod
  // novým idempotency klíčem. (Reuse kolekce i admin „Požádat o doplatek"
  // částku kontrolují taky — tahle větev byla jediná, co ne.)
  const reusable = requests.find(
    (request) =>
      request.type === requestType &&
      ["pending", "sent"].includes(request.status) &&
      request.payment_url &&
      Math.abs(toNumber(request.amount) - outstanding) <= 0.01
  )
  if (reusable) {
    return {
      payment_url: reusable.payment_url,
      outstanding,
      request_id: reusable.id,
      reused: true,
    }
  }

  // 2 — JEDINÁ otevřená kolekce doplatku TÉTO zakázky, srovnaná na aktuální
  // dluh (vznikla už při objednání; po příplatku se jen přepíše částka).
  const collection = await ensureBalanceCollection(container, order, outstanding, productionOrder.id)

  // 3 — the request row, keyed so a retry updates rather than duplicates.
  const idempotencyKey = `${depositOnly ? "deposit" : "balance"}:${productionOrder.id}:${outstanding}`
  const previous = requests.find(
    (request) => request.idempotency_key === idempotencyKey
  )

  const request = previous
    ? await madeToOrder.updateProductionPaymentRequests({
        id: previous.id,
        status: "pending",
        create_state: "creating",
        payment_collection_id: collection.id,
        provider_error_reason: null,
      } as never)
    : await madeToOrder.createProductionPaymentRequests({
        type: requestType,
        status: "pending",
        amount: outstanding,
        currency_code: String(order.currency_code || "czk").toLowerCase(),
        payment_collection_id: collection.id,
        idempotency_key: idempotencyKey,
        create_state: "creating",
        production_order_id: productionOrder.id,
      } as never)

  try {
    const { result: session } = await createPaymentSessionsWorkflow(
      container
    ).run({
      input: {
        payment_collection_id: collection.id,
        provider_id: COMGATE_PROVIDER_ID,
        customer_id: order.customer_id || undefined,
        data: {
          method,
          email: order.email,
          country_code: "CZ",
          label: `Obj. ${order.display_id || "doplatek"}`.slice(0, 16),
          name: `${depositOnly ? "Záloha" : "Doplatek"} objednávky ${order.display_id || order.id}`,
          lang: "cs",
          production_payment_request_id: (request as any).id,
          // Návrat z ComGate po doplatku na reálnou stránku objednávky, ne na
          // neexistující /payment/{session}/confirmed (to byl ten 404).
          url_paid: orderConfirmedPath(order.id, "paid"),
          url_cancelled: orderConfirmedPath(order.id, "zruseno"),
          url_pending: orderConfirmedPath(order.id, "ceka"),
        },
      },
    })

    const paymentUrl = paymentUrlFromSession(session)
    if (!paymentUrl) {
      throw new Error("ComGate nevrátil platební odkaz.")
    }

    await madeToOrder.updateProductionPaymentRequests({
      id: (request as any).id,
      payment_session_id: (session as any)?.id ?? null,
      payment_url: paymentUrl,
      // KLÍČOVÉ: bez `provider_transaction_id` 30min záchranná úloha doplatek
      // přeskočí (bere jen požadavky, co ho mají — stejně jako záloha a admin
      // „Požádat o doplatek"). Když tedy webhook nedorazí, doplatek by „zmizel".
      // ComGate ho vrací v `session.data.transId`.
      provider_transaction_id:
        (session as any)?.data?.transId ?? (session as any)?.data?.id ?? null,
      create_state: "created",
      status: "pending",
    } as never)

    return {
      payment_url: paymentUrl,
      outstanding,
      request_id: (request as any).id,
      reused: false,
    }
  } catch (error) {
    // The row stays, marked failed with the reason, so a retry can see what
    // happened rather than starting from nothing.
    await madeToOrder
      .updateProductionPaymentRequests({
        id: (request as any).id,
        create_state: "failed",
        provider_error_reason:
          error instanceof Error ? error.message : "Neznámá chyba.",
      } as never)
      .catch(() => undefined)

    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Platební odkaz se nepodařilo vytvořit: ${
        error instanceof Error ? error.message : "neznámá chyba"
      }`
    )
  }
}

export type BalanceReconcileResult = {
  /** "paid" = právě dorovnáno/už zaplaceno, "pending" = brána ještě nepotvrdila,
   *  "failed" = zrušeno/vypršelo, "none" = není co dorovnávat. */
  status: "paid" | "pending" | "failed" | "none"
  request_id: string | null
}

export type MarkBalanceRequestPaidInput = {
  /** Otevřená (nebo právě založená) žádost o doplatek. */
  request: any
  productionOrder: any
  orderId: string
  /** Kdo doplatek potvrdil: platební brána, nebo ruční záznam „Zaplaceno na místě". */
  gateway: "comgate" | "offline"
  /** Offline: hotově / kartou v ateliéru / převodem — uloží se k žádosti. */
  method?: string | null
  /**
   * Jen offline: skutečně přijatá částka, když se liší od částky žádosti (odkaz
   * vznikl před příplatkem). Bere ji event i doplatková faktura — jinak by
   * faktura zněla na starou, nižší sumu.
   */
  amount?: number
  /** Offline: nativní kolekce, do které se platba zapsala (žádost ji dřív nemusela mít). */
  paymentCollectionId?: string | null
}

/**
 * Kam posunout zakázku, když je doplatek zaplacený — `null` = nechat, kde je.
 *
 * Do „připraveno k odeslání" jde jen zakázka, která je už vyrobená a čeká na
 * peníze (`awaiting_balance`). Doplatek se dá zaplatit kdykoli (samoobsluha na
 * potvrzení objednávky, výzva poslaná během výroby) a dřív platba posunula
 * na „připraveno" i zakázku, která čekala na potvrzení zadání nebo se teprve
 * vyráběla — přeskočila celou výrobu (změřeno 13. 10. 2026 na #25, #28, #31).
 * Taková zakázka zůstane ve své fázi; „Výroba dokončena" ji pak pošle rovnou
 * do „připraveno", protože už je zaplacená (`complete_production`).
 */
export const stageAfterBalancePaid = (
  stage: string | null | undefined
): "ready_to_ship" | null => (stage === "awaiting_balance" ? "ready_to_ship" : null)

/**
 * Společný „ocas" zaplaceného doplatku — JEDNA cesta pro bránu i ruční záznam.
 *
 * Doplatek může být potvrzen dvěma dveřmi: ComGate (návrat z brány / webhook /
 * 30min job) a tlačítkem „Zaplaceno na místě" (zakázka vyzvednutá v ateliéru,
 * zaplacená u pultu). Co se pak má stát, je totéž a musí zůstat totéž: žádost →
 * `paid` + `paid_at`, fáze zakázky → „připraveno" (nikdy zpátky z terminální),
 * a event `made-to-order.balance-paid`, na kterém visí potvrzení zákazníkovi,
 * doplatková faktura (customer-emails `onBalancePaid`) i zvoneček majitelce
 * (merchant-notifications). Dvě kopie téhle sekvence = dřív či později dvě
 * verze toho, co „zaplaceno" znamená; proto je tu jednou.
 *
 * Idempotentní: `paid_at` se nepřepisuje, fáze se nemění z terminální, a
 * odběratelé eventu dedupují e-mail i fakturu per žádost.
 */
export const markBalanceRequestPaid = async (
  container: MedusaContainer,
  {
    request,
    productionOrder,
    orderId,
    gateway,
    method,
    amount,
    paymentCollectionId,
  }: MarkBalanceRequestPaidInput
): Promise<void> => {
  const madeToOrder = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const now = new Date()
  const paidAmount = amount !== undefined ? roundMoney(amount) : request.amount

  // 1 — produkční strana: žádost zaplacena. U offline platby nese
  //     `provider_status` „PAID_OFFLINE" a `selected_method` způsob, ať je v
  //     datech vidět, že peníze nepřišly přes bránu (účetnictví, dohledání).
  await madeToOrder.updateProductionPaymentRequests({
    id: request.id,
    status: "paid",
    provider_status: gateway === "offline" ? "PAID_OFFLINE" : "PAID",
    ...(gateway === "offline"
      ? {
          selected_method: method ?? null,
          create_state: "created",
          provider_error_reason: null,
          payment_collection_id:
            paymentCollectionId ?? request.payment_collection_id ?? null,
        }
      : {}),
    ...(amount !== undefined ? { amount: paidAmount } : {}),
    paid_at: request.paid_at || now,
    last_checked_at: now,
  } as never)

  // 2 — fáze „připraveno", ale jen u vyrobené zakázky (`stageAfterBalancePaid`).
  if (stageAfterBalancePaid(productionOrder.stage)) {
    await madeToOrder.updateProductionOrders({
      id: productionOrder.id,
      stage: "ready_to_ship",
      ready_to_ship_at: productionOrder.ready_to_ship_at || now,
    } as never)
  }

  // 3 — potvrzení zákazníkovi + doplatková faktura + zvoneček majitelce.
  //     Stejný tvar payloadu jako webhook a 30min job.
  await container.resolve(Modules.EVENT_BUS).emit({
    name: "made-to-order.balance-paid",
    data: {
      order_id: orderId,
      production_order_id: productionOrder.id,
      payment_request_id: request.id,
      amount: paidAmount,
      currency_code: request.currency_code,
    },
  })
}

/**
 * Dorovnání doplatku PO NÁVRATU z ComGate — „storefront-complete" krok, který
 * doplatku chyběl (záloha ho má v checkoutu). Zeptá se brány na stav otevřené
 * žádosti o doplatek a při zaplacení: zaúčtuje nativní platbu, označí žádost
 * jako zaplacenou, posune fázi na „připraveno" a emituje `made-to-order.balance-paid`
 * (= potvrzení zákazníkovi + doplatková faktura, obojí visí na tom eventu).
 *
 * Nezávislé na webhooku (ten potřebuje notif. URL v portálu ČP/ComGate) i na
 * 30min jobu — tentýž výsledek, hned po návratu z platby. Idempotentní: bere jen
 * žádosti ve stavu pending/sent a `onBalancePaid` dedupuje e-mail i fakturu, takže
 * pozdní webhook/job to nezdvojí. Reflektuje jen to, co brána potvrdí — nic nehádá.
 */
export const reconcileOrderBalance = async (
  container: MedusaContainer,
  orderId: string
): Promise<BalanceReconcileResult> => {
  const madeToOrder = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  // Od 20. 10. 2026 má objednávka zakázek víc (jedna na položku) a každá
  // vlastní doplatek — dorovnává se KAŽDÁ otevřená žádost s relací. Výsledek
  // za objednávku: zaplaceno > selhalo > čeká > nic.
  const productionOrders = (await madeToOrder.listProductionOrders({
    order_id: orderId,
  } as never)) as any[]
  if (!productionOrders.length) {
    return { status: "none", request_id: null }
  }

  const requests = (await madeToOrder.listProductionPaymentRequests({
    production_order_id: productionOrders.map((productionOrder) => productionOrder.id),
  } as never)) as any[]
  const openRequests = requests.filter(
    (r) =>
      r.type === "balance" &&
      ["pending", "sent"].includes(r.status) &&
      r.payment_session_id
  )
  if (!openRequests.length) {
    // Diagnostika: proč se doplatek „neregistruje". Žádná otevřená žádost =
    // buď už zaplaceno (fajn), nebo žádost nevznikla / nemá relaci.
    const balances = requests.filter((r) => r.type === "balance")
    logger.info(
      `[balance] reconcile ${orderId}: žádný otevřený doplatek k dorovnání (balance žádostí: ${balances.length}; stavy: ${balances
        .map((r) => `${r.status}/${r.create_state}${r.payment_session_id ? "+session" : "-session"}`)
        .join(", ") || "—"}).`
    )
    return { status: "none", request_id: null }
  }

  const rank: Record<BalanceReconcileResult["status"], number> = { paid: 3, failed: 2, pending: 1, none: 0 }
  let best: BalanceReconcileResult = { status: "none", request_id: null }
  for (const request of openRequests) {
    const productionOrder = productionOrders.find(
      (candidate) => candidate.id === request.production_order_id
    )
    if (!productionOrder) continue
    const result = await reconcileBalanceRequest(container, { orderId, productionOrder, request })
    if (rank[result.status] > rank[best.status]) best = result
  }
  return best
}

const reconcileBalanceRequest = async (
  container: MedusaContainer,
  { orderId, productionOrder, request }: { orderId: string; productionOrder: any; request: any }
): Promise<BalanceReconcileResult> => {
  const madeToOrder = container.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const paymentModule = container.resolve(Modules.PAYMENT)
  const [session] = await paymentModule.listPaymentSessions({
    id: request.payment_session_id,
  } as never)
  if (!session) {
    return { status: "pending", request_id: request.id }
  }

  let status = ""
  let errorReason: unknown = null
  try {
    const result = await paymentStatusFromProvider(container, session as any)
    status = String(result?.status ?? "").toLowerCase()
    errorReason = (result?.data as any)?.paymentErrorReason ?? null
    logger.info(
      `[balance] reconcile ${orderId}: doplatek ${request.id}, relace ${request.payment_session_id} — brána hlásí stav „${status || "?"}".`
    )
  } catch (error) {
    logger.warn(
      `[balance] Stav doplatku ${request.id} se při návratu nepodařilo ověřit: ${
        error instanceof Error ? error.message : "neznámá chyba"
      }`
    )
    return { status: "pending", request_id: request.id }
  }

  const now = new Date()

  if (status === "captured" || status === "authorized") {
    // 1 — zaúčtovat NATIVNÍ platbu. Relace doplatku byla jen VYTVOŘENÁ, ne
    //     autorizovaná, takže v kolekci žádný `Payment` ještě není — hledat
    //     ho a volat `capturePaymentWorkflow` nemělo co zachytit a kolekce
    //     zůstávala `not_paid`. `processPaymentWorkflow` s `captured` relaci
    //     autorizuje do platby A zachytí (stejná cesta jako ověřený webhook
    //     i dohled u checkoutu). Kolekce doplatku není navázaná na košík, tak
    //     se nespouští dokončení košíku. Best-effort — produkční strana níž
    //     nese fakturu i e-mail.
    try {
      await processPaymentWorkflow(container).run({
        input: {
          action: "captured",
          data: {
            session_id: request.payment_session_id,
            amount: request.amount,
          },
        } as never,
      })
    } catch (error) {
      logger.warn(
        `[balance] Nativní zaúčtování doplatku ${request.id} se nepodařilo: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    }

    // 2+3 — produkční strana: žádost zaplacena, fáze „připraveno", event pro
    //     potvrzení zákazníkovi + doplatkovou fakturu. Společný ocas s ručním
    //     „Zaplaceno na místě" (`markBalanceRequestPaid`), ať obě cesty dělají totéž.
    await markBalanceRequestPaid(container, {
      request,
      productionOrder,
      orderId,
      gateway: "comgate",
    })

    logger.info(
      `[balance] Doplatek ${request.id} dorovnán po návratu z brány (objednávka ${orderId}).`
    )
    return { status: "paid", request_id: request.id }
  }

  if (["canceled", "cancelled", "error", "expired"].includes(status)) {
    // E-mail „neprošla" pošle s odstupem úloha reconcile-balance-payments
    // (nezopakuje-li zákazník platbu hned) — podle stavu a důvodu uložených tady.
    await madeToOrder.updateProductionPaymentRequests({
      id: request.id,
      status: "expired",
      provider_status: status.toUpperCase(),
      provider_error_reason: duvodCesky(errorReason),
      last_checked_at: now,
    } as never)
    return { status: "failed", request_id: request.id }
  }

  logger.info(
    `[balance] reconcile ${orderId}: doplatek ${request.id} zatím nedorovnán — brána hlásí „${status || "?"}" (čeká se na zaplacení).`
  )
  return { status: "pending", request_id: request.id }
}
