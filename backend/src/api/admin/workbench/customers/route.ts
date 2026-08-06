import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { outstandingFor } from "../../../../lib/balance-payment"
import { MADE_TO_ORDER_MODULE } from "../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../modules/made-to-order/service"
import { NEWSLETTER_MODULE } from "../../../../modules/newsletter"
import { PRODUCT_REVIEW_MODULE } from "../../../../modules/product-review"
import { WISHLIST_MODULE } from "../../../../modules/wishlist"

/**
 * Zákazníci — the customer workbench, grouped by PERSON, not by record.
 *
 * ## The bug this rewrite fixes
 *
 * Medusa creates a fresh customer record for every guest checkout. Group by
 * record and a loyal guest appears fifty times, each row claiming their
 * „first order" — which is exactly what Matěj saw. A person is an e-mail
 * address here: all records sharing one (case-insensitively) collapse into
 * one row, their orders, wishlists and reviews pooled. The row keeps every
 * underlying record id (`record_ids`) so Expert mode can show the fragments
 * and a future merge tool (feature-ideas 5.3) knows what to fuse.
 *
 * `lifetime_value` sums order totals — money asked; the captured story
 * stays on the orders workbench. `outstanding` is the commission balance
 * (`outstandingFor`, same as the e-mails).
 *
 * Filters: `?q=`, `?owing=true`, `?newsletter=true`, `?repeat=true`.
 * Expert (`?expert=1`): rows carry their underlying records.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const madeToOrder = req.scope.resolve<MadeToOrderModuleService>(
    MADE_TO_ORDER_MODULE
  )
  const wishlist = req.scope.resolve<any>(WISHLIST_MODULE)
  const reviews = req.scope.resolve<any>(PRODUCT_REVIEW_MODULE)
  const newsletter = req.scope.resolve<any>(NEWSLETTER_MODULE)

  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  const expert = req.query.expert === "1"
  const search =
    typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : null

  const safely = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await promise
    } catch {
      return fallback
    }
  }

  const [customersResult, ordersResult, productionOrders, wishlists, allReviews, subscribers] =
    await Promise.all([
      query.graph({
        entity: "customer",
        fields: [
          "id",
          "email",
          "first_name",
          "last_name",
          "has_account",
          "created_at",
        ],
        pagination: { take: 1000, skip: 0 },
      }),
      safely(
        query.graph({
          entity: "order",
          fields: ["id", "customer_id", "email", "total", "created_at"],
          pagination: { take: 1000, skip: 0, order: { created_at: "DESC" } },
        }),
        { data: [] as any[] } as never
      ),
      safely(
        madeToOrder.listProductionOrders({} as never) as Promise<any[]>,
        []
      ),
      safely(
        wishlist.listWishlists({}, { relations: ["items"] }) as Promise<any[]>,
        []
      ),
      safely(reviews.listReviews({} as never) as Promise<any[]>, []),
      safely(
        newsletter.listNewsletterSubscribers({
          unsubscribed_at: null,
        } as never) as Promise<any[]>,
        []
      ),
    ])

  const toNumber = (value: unknown): number => {
    const parsed = Number(
      typeof value === "object" && value !== null
        ? ((value as any).value ?? (value as any).numeric_ ?? 0)
        : value
    )
    return Number.isFinite(parsed) ? parsed : 0
  }
  const round = (value: number) => Math.round(value * 100) / 100

  // ── persons: one per e-mail; a record with no e-mail stands alone ──
  type Person = {
    key: string
    email: string | null
    name: string | null
    record_ids: string[]
    records: any[]
    has_account: boolean
    registered_at: string
    orders_count: number
    lifetime_value: number
    last_order_at: string | null
    outstanding: number
    wishlist_size: number
    reviews_written: number
  }
  const persons = new Map<string, Person>()
  const personByRecordId = new Map<string, Person>()

  for (const record of customersResult.data as any[]) {
    const email = record.email ? String(record.email).toLowerCase() : null
    const key = email ?? `id:${record.id}`
    let person = persons.get(key)
    if (!person) {
      person = {
        key,
        email,
        name: null,
        record_ids: [],
        records: [],
        has_account: false,
        registered_at: record.created_at,
        orders_count: 0,
        lifetime_value: 0,
        last_order_at: null,
        outstanding: 0,
        wishlist_size: 0,
        reviews_written: 0,
      }
      persons.set(key, person)
    }
    person.record_ids.push(record.id)
    if (expert) person.records.push(record)
    person.has_account = person.has_account || Boolean(record.has_account)
    if (record.created_at < person.registered_at) {
      person.registered_at = record.created_at
    }
    const name = [record.first_name, record.last_name]
      .filter(Boolean)
      .join(" ")
    if (name && !person.name) person.name = name
    personByRecordId.set(record.id, person)
  }

  // ── orders → person, e-mail first (guest records differ per order) ──
  const personForOrder = (order: any): Person | undefined => {
    const email = order.email ? String(order.email).toLowerCase() : null
    return (
      (email ? persons.get(email) : undefined) ??
      (order.customer_id ? personByRecordId.get(order.customer_id) : undefined)
    )
  }

  const personByOrderId = new Map<string, Person>()
  for (const order of ordersResult.data as any[]) {
    const person = personForOrder(order)
    if (!person) continue
    personByOrderId.set(order.id, person)
    person.orders_count += 1
    person.lifetime_value = round(
      person.lifetime_value + toNumber(order.total)
    )
    if (!person.last_order_at || order.created_at > person.last_order_at) {
      person.last_order_at = order.created_at
    }
  }

  // ── commission balances, pooled per person ──
  const productionIds = (productionOrders as any[]).map((p) => p.id)
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
  for (const production of productionOrders as any[]) {
    const person = personByOrderId.get(production.order_id)
    if (!person) continue
    const owed = outstandingFor(
      production,
      requestsByProduction.get(production.id) ?? []
    )
    if (owed > 0) person.outstanding = round(person.outstanding + owed)
  }

  // ── wishlists and reviews, keyed by record id → pooled ──
  for (const list of wishlists as any[]) {
    const person = personByRecordId.get(list.customer_id)
    if (person) person.wishlist_size += list.items?.length ?? 0
  }
  for (const review of allReviews as any[]) {
    const person = review.customer_id
      ? personByRecordId.get(review.customer_id)
      : undefined
    if (person) person.reviews_written += 1
  }

  const newsletterEmails = new Set(
    (subscribers as any[]).map((subscriber) =>
      String(subscriber.email).toLowerCase()
    )
  )

  const owingOnly = req.query.owing === "true"
  const newsletterOnly = req.query.newsletter === "true"
  const repeatOnly = req.query.repeat === "true"

  const rows = [...persons.values()]
    .map((person) => ({
      // The primary id is the newest record — the one native detail opens.
      id: person.record_ids[person.record_ids.length - 1],
      email: person.email,
      name: person.name,
      registered_at: person.registered_at,
      has_account: person.has_account,
      records_count: person.record_ids.length,
      record_ids: person.record_ids,
      ...(expert ? { records: person.records } : {}),
      orders_count: person.orders_count,
      lifetime_value: person.lifetime_value,
      last_order_at: person.last_order_at,
      outstanding: person.outstanding,
      wishlist_size: person.wishlist_size,
      reviews_written: person.reviews_written,
      newsletter: person.email ? newsletterEmails.has(person.email) : false,
    }))
    .filter((row) => {
      if (owingOnly && row.outstanding <= 0) return false
      if (newsletterOnly && !row.newsletter) return false
      if (repeatOnly && row.orders_count < 2) return false
      if (
        search &&
        !String(row.email ?? "").toLowerCase().includes(search) &&
        !String(row.name ?? "").toLowerCase().includes(search)
      ) {
        return false
      }
      return true
    })
    .sort((a, b) => b.lifetime_value - a.lifetime_value)

  res.status(200).json({
    customers: rows.slice(offset, offset + limit),
    count: rows.length,
    limit,
    offset,
  })
}
