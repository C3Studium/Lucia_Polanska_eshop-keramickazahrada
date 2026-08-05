import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { outstandingFor } from "../../../../lib/balance-payment"
import { MADE_TO_ORDER_MODULE } from "../../../../modules/made-to-order"
import type MadeToOrderModuleService from "../../../../modules/made-to-order/service"
import { NEWSLETTER_MODULE } from "../../../../modules/newsletter"
import { PRODUCT_REVIEW_MODULE } from "../../../../modules/product-review"
import { WISHLIST_MODULE } from "../../../../modules/wishlist"

/**
 * Zákazníci — the advanced customer workbench (admin-advanced-plan.md).
 *
 * The native customer list is a phone book. For a shop this size the useful
 * question is „who is this person to the shop?" — how much they have bought,
 * whether they owe a balance, whether they follow the newsletter, what they
 * are waiting for. Each of those lives in a different module; this joins
 * them into one row per customer so „loyal", „owes money" and „waiting for
 * restock" stop being research projects.
 *
 * ## Money definitions
 *
 * `lifetime_value` sums order totals — money *asked*, not captured; the
 * A2-grade captured number stays on the orders workbench where shipping
 * decisions live. `outstanding` is the commission balance
 * (`outstandingFor`, same as the e-mails). One customer having both a high
 * LTV and an outstanding balance is exactly the row worth noticing.
 *
 * Filters: `?q=` (name or e-mail), `?owing=true`, `?newsletter=true`,
 * `?repeat=true` (more than one order).
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
  const search =
    typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : null

  // Every source individually caught: this page joins six systems, and one
  // of them being briefly broken (a missing table after a bad deploy, a
  // module mid-migration) must degrade its own column to empty, not take
  // the whole customer list down. That failure mode is exactly what
  // „Zákazníci se nepodařilo načíst" looked like in production.
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
        fields: ["id", "email", "first_name", "last_name", "created_at"],
        pagination: { take: 1000, skip: 0 },
      }),
      safely(
        query.graph({
          // `items.id` was projected here only to exist — every order's
          // items loaded on every page view. Dropped: nothing read it.
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

  // Commission balances attach to orders; map them back to their customer
  // through the order rows we already have.
  const customerByOrder = new Map<string, string>()
  for (const order of ordersResult.data as any[]) {
    if (order.customer_id) customerByOrder.set(order.id, order.customer_id)
  }

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

  const outstandingByCustomer = new Map<string, number>()
  for (const production of productionOrders as any[]) {
    const customerId = customerByOrder.get(production.order_id)
    if (!customerId) continue
    const owed = outstandingFor(
      production,
      requestsByProduction.get(production.id) ?? []
    )
    if (owed > 0) {
      outstandingByCustomer.set(
        customerId,
        round((outstandingByCustomer.get(customerId) ?? 0) + owed)
      )
    }
  }

  // Orders match their customer by id OR e-mail. A guest checkout creates
  // an order whose customer link may be absent; matching only by id showed
  // loyal guests as „zatím bez objednávky", which reads as a broken page.
  const customerIdByEmail = new Map<string, string>()
  for (const customer of customersResult.data as any[]) {
    if (customer.email) {
      customerIdByEmail.set(String(customer.email).toLowerCase(), customer.id)
    }
  }

  const ordersByCustomer = new Map<string, { count: number; total: number; last: string | null }>()
  for (const order of ordersResult.data as any[]) {
    const matchedId =
      order.customer_id ??
      (order.email
        ? customerIdByEmail.get(String(order.email).toLowerCase())
        : undefined)
    if (!matchedId) continue
    const entry =
      ordersByCustomer.get(matchedId) ?? {
        count: 0,
        total: 0,
        last: null,
      }
    entry.count += 1
    entry.total = round(entry.total + toNumber(order.total))
    if (!entry.last || order.created_at > entry.last) {
      entry.last = order.created_at
    }
    ordersByCustomer.set(matchedId, entry)
  }

  const wishlistSizeByCustomer = new Map<string, number>()
  for (const list of wishlists as any[]) {
    if (list.customer_id) {
      wishlistSizeByCustomer.set(
        list.customer_id,
        (wishlistSizeByCustomer.get(list.customer_id) ?? 0) +
          (list.items?.length ?? 0)
      )
    }
  }

  const reviewsByCustomer = new Map<string, number>()
  for (const review of allReviews as any[]) {
    if (review.customer_id) {
      reviewsByCustomer.set(
        review.customer_id,
        (reviewsByCustomer.get(review.customer_id) ?? 0) + 1
      )
    }
  }

  const newsletterEmails = new Set(
    (subscribers as any[]).map((subscriber) =>
      String(subscriber.email).toLowerCase()
    )
  )

  const owingOnly = req.query.owing === "true"
  const newsletterOnly = req.query.newsletter === "true"
  const repeatOnly = req.query.repeat === "true"

  const rows = (customersResult.data as any[])
    .map((customer) => {
      const orders = ordersByCustomer.get(customer.id)
      return {
        id: customer.id,
        email: customer.email,
        name:
          [customer.first_name, customer.last_name]
            .filter(Boolean)
            .join(" ") || null,
        registered_at: customer.created_at,
        orders_count: orders?.count ?? 0,
        lifetime_value: orders?.total ?? 0,
        last_order_at: orders?.last ?? null,
        outstanding: outstandingByCustomer.get(customer.id) ?? 0,
        wishlist_size: wishlistSizeByCustomer.get(customer.id) ?? 0,
        reviews_written: reviewsByCustomer.get(customer.id) ?? 0,
        newsletter: newsletterEmails.has(
          String(customer.email).toLowerCase()
        ),
      }
    })
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
