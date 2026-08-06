import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { NEWSLETTER_MODULE } from "../../../../../modules/newsletter"

/**
 * Zákazníci+ → Statistiky — who buys, who returns, who reads.
 *
 * Repeat rate is the number that matters for a handmade shop: pieces are
 * bought again by people, not by markets. Guest orders are matched by
 * e-mail, same rule as the customer list, so the rate is about people
 * rather than login states.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
  const safely = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
    try { return await promise } catch { return fallback }
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const newsletter = req.scope.resolve<any>(NEWSLETTER_MODULE)

  const round = (value: number) => Math.round(value * 100) / 100
  const toNumber = (value: unknown): number => {
    const parsed = Number(
      typeof value === "object" && value !== null
        ? ((value as any).value ?? (value as any).numeric_ ?? 0)
        : value
    )
    return Number.isFinite(parsed) ? parsed : 0
  }

  const [{ data: customers }, { data: orders }, subscribers] =
    await Promise.all([
      query.graph({
        entity: "customer",
        fields: ["id", "email", "first_name", "last_name", "has_account", "created_at"],
        pagination: { take: 1000, skip: 0 },
      }),
      safely(query.graph({
        entity: "order",
        fields: ["id", "email", "customer_id", "total", "created_at"],
        pagination: { take: 1000, skip: 0, order: { created_at: "DESC" } },
      }), { data: [] as any[] } as never),
      newsletter
        .listNewsletterSubscribers({ unsubscribed_at: null } as never)
        .catch(() => []) as Promise<any[]>,
    ])

  // Buyers keyed by person — e-mail first, id as fallback.
  const buyers = new Map<string, { orders: number; total: number; name: string | null }>()
  for (const order of orders as any[]) {
    const key = String(order.email ?? order.customer_id ?? "").toLowerCase()
    if (!key) continue
    const entry = buyers.get(key) ?? { orders: 0, total: 0, name: null }
    entry.orders += 1
    entry.total = round(entry.total + toNumber(order.total))
    buyers.set(key, entry)
  }
  for (const customer of customers as any[]) {
    const key = String(customer.email ?? "").toLowerCase()
    const entry = buyers.get(key)
    if (entry) {
      entry.name =
        [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
        null
    }
  }

  const repeatBuyers = [...buyers.values()].filter(
    (buyer) => buyer.orders >= 2
  )

  // Registrations per month, last 12.
  const monthKey = (value: string | Date) => {
    const date = new Date(value)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
  }
  const months: string[] = []
  for (let index = 11; index >= 0; index--) {
    const date = new Date()
    date.setMonth(date.getMonth() - index)
    months.push(monthKey(date))
  }
  // Only real accounts count as registrations — guest checkouts mint a
  // customer record per order, and counting those made every busy week look
  // like a signup wave.
  const registrations = new Map(months.map((month) => [month, 0]))
  for (const customer of customers as any[]) {
    if (!customer.has_account) continue
    const key = monthKey(customer.created_at)
    if (registrations.has(key)) {
      registrations.set(key, (registrations.get(key) ?? 0) + 1)
    }
  }

  const newsletterEmails = new Set(
    (subscribers as any[]).map((subscriber) =>
      String(subscriber.email).toLowerCase()
    )
  )
  const customersOnNewsletter = (customers as any[]).filter((customer) =>
    newsletterEmails.has(String(customer.email ?? "").toLowerCase())
  ).length

  const personEmails = new Set(
    (customers as any[])
      .map((customer) => String(customer.email ?? "").toLowerCase())
      .filter(Boolean)
  )

  res.status(200).json({
    // Persons, not records — fifty guest checkouts are one human.
    customers_total: personEmails.size,
    accounts_total: (customers as any[]).filter(
      (customer) => customer.has_account
    ).length,
    buyers_total: buyers.size,
    repeat_buyers: repeatBuyers.length,
    repeat_rate: buyers.size
      ? Math.round((repeatBuyers.length / buyers.size) * 100)
      : null,
    top_customers: [...buyers.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([email, buyer]) => ({
        email,
        name: buyer.name,
        orders: buyer.orders,
        total: buyer.total,
      })),
    registrations_by_month: months.map((month) => ({
      month,
      count: registrations.get(month) ?? 0,
    })),
    newsletter_subscribers: (subscribers as any[]).length,
    customers_on_newsletter: customersOnNewsletter,
    orders_scanned: (orders as any[]).length,
  })
  } catch (error) {
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Statistiky selhaly.",
    })
  }
}
