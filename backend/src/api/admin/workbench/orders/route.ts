import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isPersonalPickupOrder } from "../../../../lib/personal-pickup"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { outstandingFor } from "../../../../lib/balance-payment"
import { MADE_TO_ORDER_MODULE } from "../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../modules/made-to-order/service"
import { MERCHANT_ORDER_MODULE } from "../../../../modules/merchant-order"
import type MerchantOrderModuleService from "../../../../modules/merchant-order/service"

/**
 * Objednávky — the advanced order worklist (admin-advanced-plan.md).
 *
 * Přehled's Denní práce answers „what do I do next?" for the orders inside
 * the merchant workflow. This answers the deeper question — „what is true of
 * *every* order?" — by joining the three systems that each hold a third of it:
 * Medusa's order (money asked), the payment collections (money received),
 * and the merchant/production modules (stage and balance). No page showed
 * those side by side before; reconciling them meant three tabs and a
 * notebook.
 *
 * ## Reading the money columns
 *
 * `captured` sums payments by `captured_at`, minus refunds — the same
 * captured-minus-refunded quantity the A2 ship gate compares against the
 * total, so this list and the gate can never tell different stories about
 * who has paid. `outstanding` is the production module's own
 * `agreed_total − paid requests` (shared `outstandingFor`), which is what
 * the balance e-mails use. The two columns deliberately come from different
 * systems: one is card money, the other is commission bookkeeping, and
 * showing them as one number is how a pickup order that authorized-but-not-
 * captured gets shipped.
 *
 * Filters: `?stage=`, `?q=` (e-mail, order number or product name),
 * `?kind=goods|commission` (jen výrobky / jen zakázky), `?owing=true`,
 * `?limit/offset`.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const merchantOrders = req.scope.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )
  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  const stageParam =
    typeof req.query.stage === "string" ? req.query.stage : null
  const searchParam =
    typeof req.query.q === "string" ? req.query.q.trim() : ""
  const kindParam =
    req.query.kind === "goods" || req.query.kind === "commission"
      ? req.query.kind
      : null

  /*
   * Druh objednávky (17. 11. 2026): Objednávky mají nahoře Vše · Výrobky ·
   * Zakázky — samostatná stránka Zakázky skončila. Zakázka = objednávka,
   * ke které existuje výrobní příkaz; těch je málo, tak se načtou celé
   * (stejně je potřebují počty „Čeká na doplatek").
   */
  const allProduction = (await madeToOrder.listProductionOrders(
    {} as never
  )) as any[]
  const commissionOrderIds = [
    ...new Set(
      allProduction.map((production) => production.order_id).filter(Boolean)
    ),
  ] as string[]
  /*
   * U zakázek se filtruje podle fáze VÝROBY (`?production=a,b`), ne podle
   * fáze obchodu — „Nové zadání", „Ve výrobě", „Čeká na doplatek" jsou to,
   * co u zakázky zajímá. Objednávka se počítá, když v té fázi stojí aspoň
   * jedna její živá zakázka.
   */
  const productionParam =
    typeof req.query.production === "string"
      ? req.query.production.split(",").map((s) => s.trim()).filter(Boolean)
      : []
  const ordersInProduction = (stages: string[]) => [
    ...new Set(
      allProduction
        .filter((production) => stages.includes(production.stage))
        .map((production) => production.order_id)
        .filter(Boolean)
    ),
  ] as string[]
  const productionCounts: Record<string, number> = {}
  for (const stage of new Set(allProduction.map((p) => String(p.stage)))) {
    productionCounts[stage] = ordersInProduction([stage]).length
  }
  const commissionScope = productionParam.length
    ? ordersInProduction(productionParam)
    : commissionOrderIds
  /** Filtr podle druhu nad sloupcem s id objednávky (`id` / `order_id`). */
  const kindFilter = (column: "id" | "order_id"): Record<string, unknown> => {
    if (kindParam === "commission") {
      return {
        [column]: commissionScope.length ? commissionScope : ["__zadna__"],
      }
    }
    if (kindParam === "goods" && commissionOrderIds.length) {
      return { [column]: { $nin: commissionOrderIds } }
    }
    return {}
  }

  /*
   * Hledání i podle výrobku (17. 11. 2026): „kdo si koupil hrnek Levandule?"
   * Názvy jsou na řádcích objednávky (order_line_item), k objednávce je váže
   * order_item — tuhle cestu query.graph filtrem neumí, tak přímo SQL.
   */
  const productMatchIds = async (): Promise<string[]> => {
    if (searchParam.length < 2) return []
    try {
      const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
      const needle = `%${searchParam.replace(/[%_]/g, (c) => `\\${c}`)}%`
      const rows = await pg("order_item as oi")
        .join("order_line_item as li", "li.id", "oi.item_id")
        .whereNull("oi.deleted_at")
        .andWhere((builder: any) =>
          builder
            .whereILike("li.title", needle)
            .orWhereILike("li.product_title", needle)
        )
        .distinct("oi.order_id")
        .limit(500)
      return (rows as any[]).map((row) => row.order_id).filter(Boolean)
    } catch {
      return []
    }
  }
  const productIds = await productMatchIds()

  const ORDER_FIELDS = [
    "id",
    "display_id",
    "status",
    "email",
    "currency_code",
    "created_at",
    "total",
    "customer.id",
    "customer.first_name",
    "customer.last_name",
    // Host (bez účtu) má jméno jen v adrese — seznam pak ukazoval holý e-mail
    // (14. 11. 2026). Fakturační první: u Balíkovny je doručovací výdejna.
    "billing_address.first_name",
    "billing_address.last_name",
    "shipping_address.first_name",
    "shipping_address.last_name",
    // `total` potřebuje celé řádky, metody dopravy A `version` objednávky.
    // Naměřeno 3. 11. 2026 proti sandboxu: s jen `items.id`/`shipping_methods.name`
    // vycházel `total` 0 (seznam ukazoval „Celkem 0 Kč"), bez `version` Medusa
    // 2.18 spadne na „Shipping method version is required to load adjustments".
    "version",
    "items.*",
    "shipping_methods.*",
    "shipping_methods.name",
    "shipping_methods.shipping_option.provider_id",
    "fulfillments.id",
    "fulfillments.shipped_at",
    "fulfillments.delivered_at",
    "fulfillments.canceled_at",
    "payment_collections.payments.amount",
    "payment_collections.payments.captured_at",
    "payment_collections.payments.refunds.amount",
  ]

  /*
   * Filtering happens IN the database, not on one page of results. The first
   * version paginated first (newest 50) and filtered after — searching for an
   * order from three months ago silently returned „nic", and the tab counts
   * described one page of the shop, not the shop.
   *
   * Search matches the order number exactly and the e-mail as a substring —
   * the two things she actually has in hand when a customer calls.
   */
  const searchFilters = () => {
    if (!searchParam) return {}
    const conditions: Record<string, unknown>[] = [
      { email: { $ilike: `%${searchParam}%` } },
    ]
    if (productIds.length) {
      conditions.push({ id: productIds })
    }
    const numeric = Number(searchParam.replace(/^#/, ""))
    if (Number.isInteger(numeric) && numeric > 0) {
      conditions.push({ display_id: numeric })
    }
    return { $or: conditions }
  }

  let orders: any[] = []
  let totalCount = 0

  if (stageParam && stageParam !== "dluzi") {
    // Stage lives on the merchant-order state table — paginate THERE, then
    // fetch exactly those orders (same pattern as /admin/merchant-orders).
    const [states, stateCount] =
      await merchantOrders.listAndCountMerchantOrderStates(
        { stage: stageParam, ...kindFilter("order_id") } as never,
        searchParam
          ? { take: 1000, order: { created_at: "DESC" } }
          : { take: limit, skip: offset, order: { created_at: "DESC" } }
      )
    const stageOrderIds = (states as any[]).map((state) => state.order_id)
    totalCount = stateCount
    if (stageOrderIds.length) {
      const result = (await query.graph({
        entity: "order",
        fields: ORDER_FIELDS,
        filters: { id: stageOrderIds, ...searchFilters() } as never,
        // Vždy nejnovější nahoře — bez řazení vracela databáze stránku
        // v libovolném pořadí (#44, #48, #49… místo #53, #51…).
        pagination: searchParam
          ? { take: limit, skip: offset, order: { created_at: "DESC" } }
          : {
              take: stageOrderIds.length,
              skip: 0,
              order: { created_at: "DESC" },
            },
      })) as any
      orders = result.data
      if (searchParam) {
        totalCount = result.metadata?.count ?? orders.length
      }
    } else {
      orders = []
    }
  } else {
    // „Vše" and „dluzi": newest-first over every order, search applied in-DB.
    const result = (await query.graph({
      entity: "order",
      fields: ORDER_FIELDS,
      filters: { ...kindFilter("id"), ...searchFilters() } as never,
      pagination: {
        // The owing filter needs the money computed first — scan a wider
        // window so it has something real to filter (MTO orders are few).
        take: req.query.owing === "true" ? 500 : limit,
        skip: req.query.owing === "true" ? 0 : offset,
        order: { created_at: "DESC" },
      },
    })) as any
    orders = result.data
    totalCount = result.metadata?.count ?? orders.length
  }

  const orderIds = (orders as any[]).map((order) => order.id)

  const [states, productionOrders] = await Promise.all([
    orderIds.length
      ? (merchantOrders.listMerchantOrderStates({
          order_id: orderIds,
        } as never) as Promise<any[]>)
      : ([] as any[]),
    orderIds.length
      ? (madeToOrder.listProductionOrders({
          order_id: orderIds,
        } as never) as Promise<any[]>)
      : ([] as any[]),
  ])

  const stageByOrder = new Map(
    (states as any[]).map((state) => [state.order_id, state])
  )
  // Od 20. 10. 2026 má objednávka zakázek víc (jedna na položku, § 0c) — řádek
  // objednávky sčítá dluh přes všechny a fázi bere z první živé.
  const productionsByOrder = new Map<string, any[]>()
  for (const production of productionOrders as any[]) {
    const list = productionsByOrder.get(production.order_id) ?? []
    list.push(production)
    productionsByOrder.set(production.order_id, list)
  }

  const productionIds = (productionOrders as any[]).map(
    (production) => production.id
  )
  const requests = productionIds.length
    ? ((await madeToOrder.listProductionPaymentRequests({
        production_order_id: productionIds,
      } as never)) as any[])
    : []
  const requestsByProduction = new Map<string, any[]>()
  for (const request of requests) {
    const list = requestsByProduction.get(request.production_order_id) ?? []
    list.push(request)
    requestsByProduction.set(request.production_order_id, list)
  }

  const toNumber = (value: unknown): number => {
    const parsed = Number(
      typeof value === "object" && value !== null
        ? ((value as any).value ?? (value as any).numeric_ ?? 0)
        : value
    )
    return Number.isFinite(parsed) ? parsed : 0
  }
  const round = (value: number) => Math.round(value * 100) / 100

  const owingOnly = req.query.owing === "true"

  const mappedAll = (orders as any[])
    .map((order) => {
      const payments = (order.payment_collections ?? []).flatMap(
        (collection: any) => collection?.payments ?? []
      )
      const captured = round(
        payments
          .filter((payment: any) => payment?.captured_at)
          .reduce(
            (sum: number, payment: any) => sum + toNumber(payment.amount),
            0
          )
      )
      const refunded = round(
        payments
          .flatMap((payment: any) => payment?.refunds ?? [])
          .reduce(
            (sum: number, refund: any) => sum + toNumber(refund.amount),
            0
          )
      )

      const commissions = productionsByOrder.get(order.id) ?? []
      const production =
        commissions.find((candidate) => candidate.stage !== "cancelled") ?? commissions[0]
      const outstanding = round(
        commissions.reduce(
          (sum, candidate) =>
            sum + outstandingFor(candidate, requestsByProduction.get(candidate.id) ?? []),
          0
        )
      )

      const fulfillments = order.fulfillments ?? []
      const state = stageByOrder.get(order.id)

      /* Tatáž detekce jako detail objednávky (lib/personal-pickup): na produkci
         jde osobní odběr přes údaje metody (service_code / personal_pickup), ne
         přes poskytovatele s „pickup" v názvu — seznam pak u odběru psal
         „Odesláno · na cestě" (20. 11. 2026, Lucie). */
      const isPickup = isPersonalPickupOrder(order)

      return {
        // Expert mode (?expert=1): the whole graph row rides along, so the
        // UI's „Surová data" shows exactly what the backend saw — metadata,
        // provider ids, every payment — with no second request.
        ...(req.query.expert === "1" ? { raw: order } : {}),
        id: order.id,
        display_id: order.display_id,
        created_at: order.created_at,
        email: order.email,
        customer_id: order.customer?.id ?? null,
        customer_name:
          [order.customer, order.billing_address, order.shipping_address]
            .map((who: any) =>
              [who?.first_name, who?.last_name].filter(Boolean).join(" ").trim()
            )
            .find(Boolean) || null,
        currency_code: order.currency_code,
        total: round(toNumber(order.total)),
        captured,
        refunded,
        paid: round(captured - refunded),
        items_count: (order.items ?? []).length,
        stage: state?.stage ?? null,
        stage_changed_at: state?.stage_changed_at ?? null,
        made_to_order: Boolean(production),
        production_stage: production?.stage ?? null,
        /* Domluvená cena zakázek (cena + příplatek + poštovné + balné).
           Objednávka z poptávky nebo s cenou po domluvě má v Meduse řádek
           za 0 Kč — seznam pak ukáže tuhle částku, ne „0 Kč". */
        commission_total: round(
          commissions
            .filter((candidate) => candidate.stage !== "cancelled")
            .reduce(
              (sum, candidate) =>
                sum +
                toNumber(candidate.agreed_total ?? candidate.original_total) +
                toNumber(candidate.surcharge) +
                toNumber(candidate.shipping_total) +
                toNumber(candidate.packaging_total),
              0
            )
        ),
        commissions_count: commissions.length,
        outstanding,
        is_personal_pickup: isPickup,
        shipped: fulfillments.some((f: any) => f?.shipped_at),
        delivered: fulfillments.some((f: any) => f?.delivered_at),
        /* Packed but not handed over — the „Na poštu" pile. */
        awaiting_handover:
          state?.stage === "shipping" &&
          fulfillments.some((f: any) => !f?.shipped_at && !f?.canceled_at),
      }
    })

  /*
   * Real counts from the state table, not from one page of rows. „dluzi" is
   * computed from the production orders already in hand (MTO orders are few).
   */
  const stageCountEntries = await Promise.all(
    (["received", "working", "shipping", "shipped", "payment_problem"] as const).map(
      async (stage) => {
        const [, stageCount] =
          await merchantOrders.listAndCountMerchantOrderStates(
            { stage, ...kindFilter("order_id") } as never,
            { take: 1 }
          )
        return [stage, stageCount] as const
      }
    )
  )
  const allProductionIds = allProduction.map((production) => production.id)
  const allRequests = allProductionIds.length
    ? ((await madeToOrder.listProductionPaymentRequests({
        production_order_id: allProductionIds,
      } as never)) as any[])
    : []
  const allRequestsByProduction = new Map<string, any[]>()
  for (const request of allRequests) {
    const list = allRequestsByProduction.get(request.production_order_id) ?? []
    list.push(request)
    allRequestsByProduction.set(request.production_order_id, list)
  }
  // Počet OBJEDNÁVEK, které dluží (ne zakázek — objednávka jich má od 20. 10. 2026 víc).
  const dluziCount = new Set(
    allProduction
      .filter(
        (production) =>
          outstandingFor(
            production,
            allRequestsByProduction.get(production.id) ?? []
          ) > 0
      )
      .map((production) => production.order_id)
  ).size

  // The „Vše" badge counts the whole shop regardless of the active filter.
  const countOrders = async (filters: Record<string, unknown>) =>
    (((await query.graph({
      entity: "order",
      fields: ["id"],
      filters: filters as never,
      pagination: { take: 1, skip: 0 },
    })) as any).metadata?.count ?? 0) as number
  const [allCount, goodsCount] = await Promise.all([
    countOrders({}),
    commissionOrderIds.length
      ? countOrders({ id: { $nin: commissionOrderIds } })
      : countOrders({}),
  ])
  const counts = {
    vse:
      kindParam === "commission"
        ? commissionOrderIds.length
        : kindParam === "goods"
          ? goodsCount
          : allCount,
    ...Object.fromEntries(stageCountEntries),
    dluzi: kindParam === "goods" ? 0 : dluziCount,
  }
  /* Počty pro přepínač Vše · Výrobky · Zakázky — nezávisle na stavu. */
  const kinds = {
    vse: allCount,
    goods: goodsCount,
    commission: commissionOrderIds.length,
  }
  const rows = mappedAll.filter((row) => {
      if (owingOnly && row.outstanding <= 0) return false
      return true
    })

  res.status(200).json({
    counts,
    kinds,
    production_counts: productionCounts,
    orders: rows,
    /* Total matching the ACTIVE filter — the UI can page beyond this response. */
    count: totalCount,
    limit,
    offset,
  })
}
