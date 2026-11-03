import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { outstandingFor } from "../../../../../lib/balance-payment"
import { MADE_TO_ORDER_MODULE } from "../../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../../modules/made-to-order/service"
import { MERCHANT_ORDER_MODULE } from "../../../../../modules/merchant-order"
import type MerchantOrderModuleService from "../../../../../modules/merchant-order/service"
import { COURSE_MODULE } from "../../../../../modules/course"
import { GIFT_VOUCHER_MODULE } from "../../../../../modules/gift-voucher"
import { RETURN_REQUEST_MODULE } from "../../../../../modules/return-request"
import {
  getLoyaltySettings,
  listIssuedLoyaltyCodes,
  loadLoyaltyPerson,
  loadNewsletterStatus,
  manualBlockReason,
} from "../../../../../lib/loyalty-code"
import { isPaidOrder } from "../../../../../lib/loyalty-code-rules"

/**
 * One customer, expanded — the Karta's second level (phase 3).
 *
 * The Karta drawer had the note and the e-mails; this adds the part she
 * previously left the page for: the order list itself, each with its
 * merchant stage and what is still owed on it. With this, the native
 * customer page has nothing left that the workbench lacks.
 *
 * Od 3. 11. 2026 nese i kartu zákazníka (`summary`, reklamace, kurzy,
 * poukazy, slevové kódy, newsletter) — pro Zákazníci+ i pro widget na
 * nativním detailu zákazníka. Každý doplněk se čte zvlášť a chyba jednoho
 * vrátí `null`, ne celou kartu.
 */
/*
 * `items.*` a `shipping_methods.*` tu nejsou pro zobrazení: Medusa 2.18
 * u `total` načítá slevy řádků a dopravy podle verze a tu vybere, jen když
 * je v dotazu nějaké pole položek / dopravy. Bez nich dotaz u každé
 * objednávky s dopravou spadne („Shipping method version is required to
 * load adjustments") — Karta pak vracela 500 (naměřeno v sandboxu 3. 11.).
 * Celé `.*`, ne jen `.name`/`.id`: s jedním polem dopravy se nenačte její
 * cena a `total` vyjde bez poštovného (naměřeno: 939 místo 1089 Kč).
 */
const ORDER_FIELDS = [
  "id",
  "display_id",
  "created_at",
  "total",
  "currency_code",
  "status",
  "canceled_at",
  "items.*",
  "shipping_methods.*", "version" /* bez něj Medusa u total spadne */,
  "payment_collections.status",
  "payment_collections.payments.captured_at",
]

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`)

const safely = async <T,>(work: () => Promise<T>): Promise<T | null> => {
  try {
    return await work()
  } catch {
    return null
  }
}
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = req.params.customerId
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const merchantOrders = req.scope.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )
  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "last_name", "created_at", "metadata", "has_account"],
    filters: { id: customerId },
  })
  const customer = customers[0] as any
  if (!customer) {
    res.status(404).json({ message: "Zákazník nebyl nalezen." })
    return
  }

  // Person-level: guest checkouts mint a record per order, so the Karta
  // merges orders matched by this record's id AND by the person's e-mail.
  const [byId, byEmail] = await Promise.all([
    query.graph({
      entity: "order",
      fields: ORDER_FIELDS,
      filters: { customer_id: customerId } as never,
      pagination: { take: 100, skip: 0, order: { created_at: "DESC" } },
    }),
    customer.email
      ? query
          .graph({
            entity: "order",
            fields: ORDER_FIELDS,
            filters: { email: customer.email } as never,
            pagination: { take: 100, skip: 0, order: { created_at: "DESC" } },
          })
          .catch(() => ({ data: [] as any[] }))
      : { data: [] as any[] },
  ])
  const merged = new Map<string, any>()
  for (const row of [...(byId.data as any[]), ...(byEmail.data as any[])]) {
    merged.set(row.id, row)
  }
  const orders = [...merged.values()].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1
  )

  const orderIds = orders.map((order) => order.id)
  const [states, productions] = await Promise.all([
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
    (states as any[]).map((state) => [state.order_id, state.stage])
  )
  // Od 20. 10. 2026 má objednávka zakázek víc (jedna na položku) — dluh se sčítá.
  const productionsByOrder = new Map<string, any[]>()
  for (const production of productions as any[]) {
    const list = productionsByOrder.get(production.order_id) ?? []
    list.push(production)
    productionsByOrder.set(production.order_id, list)
  }
  const productionIds = (productions as any[]).map((p) => p.id)
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

  const orderRows = orders.map((order) => {
    const commissions = productionsByOrder.get(order.id) ?? []
    return {
      id: order.id,
      display_id: order.display_id,
      created_at: order.created_at,
      total: Number(order.total) || 0,
      stage: stageByOrder.get(order.id) ?? null,
      made_to_order: commissions.length > 0,
      canceled: order.status === "canceled" || Boolean(order.canceled_at),
      paid: isPaidOrder(order),
      outstanding:
        Math.round(
          commissions.reduce(
            (sum, production) =>
              sum + outstandingFor(production, requestsByProduction.get(production.id) ?? []),
            0
          ) * 100
        ) / 100,
    }
  })

  // Karta: hlavní čísla jen z nezrušených objednávek — zrušená není nákup.
  const live = orderRows.filter((order) => !order.canceled)
  const round = (value: number) => Math.round(value * 100) / 100
  const summary = {
    orders_count: live.length,
    paid_orders_count: live.filter((order) => order.paid).length,
    total_spent: round(live.reduce((sum, order) => sum + order.total, 0)),
    last_order_at: live[0]?.created_at ?? null,
    outstanding: round(live.reduce((sum, order) => sum + order.outstanding, 0)),
    canceled_count: orderRows.length - live.length,
  }

  const person = await safely(() => loadLoyaltyPerson(req.scope, { customerId }))
  const emails = person?.email ? [person.email] : customer.email ? [String(customer.email).toLowerCase()] : []
  const customerIds = person?.customerIds ?? [customerId]

  const [claims, courses, vouchers, newsletter, codes, loyaltySettings] = await Promise.all([
    safely(async () => {
      if (!orderIds.length) return { count: 0, open: 0, last: null }
      const rows = (await req.scope
        .resolve<any>(RETURN_REQUEST_MODULE)
        .listReturnRequests({ order_id: orderIds }, { order: { created_at: "DESC" }, take: 100 })) as any[]
      const last = rows[0]
      return {
        count: rows.length,
        open: rows.filter((row) => !["resolved", "rejected", "cancelled"].includes(String(row.status))).length,
        last: last
          ? {
              created_at: last.created_at,
              kind: last.kind ?? null,
              status: last.status ?? null,
              order_display_id: last.order_display_id ?? null,
            }
          : null,
      }
    }),
    safely(async () => {
      const filters: any[] = [{ customer_id: customerIds }]
      for (const email of emails) filters.push({ email: { $ilike: escapeLike(email) } })
      const rows = (await req.scope
        .resolve<any>(COURSE_MODULE)
        .listCourseReservations({ $or: filters }, { order: { created_at: "DESC" }, take: 100 })) as any[]
      const active = rows.filter((row) => row.status !== "cancelled")
      return { count: active.length, last_at: active[0]?.created_at ?? null }
    }),
    safely(async () => {
      if (!emails.length) return { count: 0, total: 0 }
      const rows = (await req.scope
        .resolve<any>(GIFT_VOUCHER_MODULE)
        .listGiftVouchers(
          { $or: emails.map((email) => ({ buyer_email: { $ilike: escapeLike(email) } })) },
          { take: 100 }
        )) as any[]
      const paid = rows.filter((row) => row.payment_status === "paid" && row.status !== "cancelled")
      return {
        count: paid.length,
        total: round(paid.reduce((sum, row) => sum + (Number(row.initial_value) || 0), 0)),
      }
    }),
    safely(() => loadNewsletterStatus(req.scope, person?.email ?? customer.email)),
    safely(async () => (person ? listIssuedLoyaltyCodes(req.scope, person) : [])),
    safely(() => getLoyaltySettings(req.scope)),
  ])

  const metadata = (customer.metadata ?? {}) as Record<string, unknown>
  // Poznámka: widget na detailu zákazníka psal `note`, Karta `poznamka` —
  // od 3. 11. 2026 obojí čte `note` a starší `poznamka` je záloha.
  const note =
    typeof metadata.note === "string" && metadata.note.trim()
      ? metadata.note
      : typeof metadata.poznamka === "string"
        ? metadata.poznamka
        : null

  res.status(200).json({
    id: customer.id,
    email: customer.email,
    name:
      [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      null,
    note,
    has_account: Boolean(person?.registered ?? customer.has_account),
    summary,
    claims,
    courses,
    vouchers,
    newsletter_state: newsletter?.state ?? null,
    codes: codes ?? [],
    loyalty: loyaltySettings,
    code_blocked_reason: newsletter ? manualBlockReason(person, newsletter) : null,
    orders: orderRows,
  })
}
