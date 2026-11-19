import { formatEmailMoney } from "./email-locale"
import { isPackagingLine, isServiceLine } from "./packaging-lines"
import { LINE_QUANTITY_FIELDS, lineQuantityOf, toNumber } from "./order-quantity"
import { DOBIRKA_PROVIDER_ID, isPayLaterPaymentProvider } from "./ship-gate"

/**
 * Celá objednávka do e-mailu majitelce „Nová objednávka" (19. 11. 2026,
 * Matěj: „do admin e-mailu celou objednávku, ne jen tlačítko na Přehled").
 * Pracuje z e-mailové schránky — co objednávka obsahuje, komu a kam, musí
 * vidět bez otevírání adminu. ČISTÁ (testovaná); data šablona
 * `merchant-notification` vykreslí řádky jako zákaznické e-maily.
 */

/** Pole objednávky, která přehled potřebuje (k ORDER_FIELDS subscriberu). */
export const ORDER_SUMMARY_FIELDS = [
  "id",
  "display_id",
  "created_at",
  "email",
  "currency_code",
  "total",
  "item_total",
  "shipping_total",
  "discount_total",
  "items.*",
  ...LINE_QUANTITY_FIELDS,
  "shipping_address.*",
  "billing_address.*",
  "shipping_methods.name",
  "shipping_methods.amount",
  "payment_collections.*",
  "payment_collections.payments.*",
  "metadata",
]

export type MerchantOrderSummary = {
  number: string
  created: string
  customer: string
  contact: string
  shipping_method: string
  shipping_price: string
  shipping_address: string
  billing_address: string | null
  payment: string
  items: Array<{ label: string; total: string }>
  subtotal: string
  packaging: string | null
  service: string | null
  discount: string | null
  shipping: string
  total: string
  /** Poznámka zákazníka z kroku „Poznámka" v pokladně (19. 11. 2026). */
  customer_note: string | null
  admin_url: string | null
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

const addressLines = (address: any): string => {
  if (!address) return ""
  return [
    [text(address.first_name), text(address.last_name)].filter(Boolean).join(" "),
    text(address.company),
    text(address.address_1),
    text(address.address_2),
    [text(address.postal_code), text(address.city)].filter(Boolean).join(" "),
    text(address.country_code).toUpperCase(),
  ]
    .filter(Boolean)
    .join("\n")
}

const paymentLabel = (order: any): string => {
  const payments = ((order?.payment_collections ?? []) as any[]).flatMap((collection) => collection?.payments ?? [])
  const provider = String(payments[0]?.provider_id ?? "")
  const captured = payments.some((payment: any) => payment?.captured_at)
  if (provider === DOBIRKA_PROVIDER_ID) return "Dobírka — zaplatí při převzetí"
  if (isPayLaterPaymentProvider(provider)) return "Platba při vyzvednutí v ateliéru"
  if (provider.startsWith("pp_system_default")) return "Bez platby při objednání"
  if (provider.includes("comgate")) return captured ? "Online platba (ComGate) — zaplaceno" : "Online platba (ComGate)"
  return provider ? provider : "—"
}

export const buildMerchantOrderSummary = (order: any, adminUrl?: string | null): MerchantOrderSummary => {
  const currency = order?.currency_code
  const money = (value: unknown) => formatEmailMoney(toNumber(value), currency, "cs")
  const items = (order?.items ?? []) as any[]
  const lineTotal = (item: any) => {
    const total = toNumber(item?.total)
    return total > 0 ? total : toNumber(item?.unit_price) * lineQuantityOf(item)
  }
  const goods = items.filter((item) => !isServiceLine(item) && lineQuantityOf(item) > 0)
  const packaging = items.filter((item) => isPackagingLine(item)).reduce((sum, item) => sum + lineTotal(item), 0)
  const service = items
    .filter((item) => isServiceLine(item) && !isPackagingLine(item))
    .reduce((sum, item) => sum + lineTotal(item), 0)
  const subtotal = goods.reduce((sum, item) => sum + lineTotal(item), 0)
  const method = ((order?.shipping_methods ?? []) as any[])[0]
  const shipping = toNumber(order?.shipping_total ?? method?.amount)
  const discount = toNumber(order?.discount_total)
  const shippingAddress = addressLines(order?.shipping_address)
  const billingAddress = addressLines(order?.billing_address)
  /* Nákup na firmu: čísla ukládá pokladna do metadat objednávky (firma_ico/dic). */
  const meta = (order?.metadata ?? {}) as Record<string, unknown>
  const billingVat = [
    text(meta.firma_ico) ? `IČO ${text(meta.firma_ico)}` : "",
    text(meta.firma_dic) ? `DIČ ${text(meta.firma_dic)}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
  const name =
    [text(order?.billing_address?.first_name), text(order?.billing_address?.last_name)].filter(Boolean).join(" ") ||
    [text(order?.shipping_address?.first_name), text(order?.shipping_address?.last_name)].filter(Boolean).join(" ") ||
    text(order?.email)
  const phone = text(order?.shipping_address?.phone) || text(order?.billing_address?.phone)
  const created = order?.created_at
    ? new Date(order.created_at).toLocaleString("cs-CZ", {
        timeZone: "Europe/Prague",
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : ""

  return {
    number: `#${order?.display_id ?? ""}`,
    created,
    customer: name,
    contact: [text(order?.email), phone].filter(Boolean).join("\n"),
    shipping_method: text(method?.name) || "—",
    shipping_price: money(method?.amount ?? shipping),
    shipping_address: shippingAddress,
    billing_address:
      billingAddress && (billingAddress !== shippingAddress || billingVat)
        ? [billingAddress, billingVat].filter(Boolean).join("\n")
        : null,
    payment: paymentLabel(order),
    items: goods.map((item) => {
      const variant = text(item?.variant_title)
      const showVariant = variant && !/^(standard|default)/i.test(variant)
      return {
        label: `${lineQuantityOf(item)}× ${text(item?.product_title) || text(item?.title)}${showVariant ? ` · ${variant}` : ""}`,
        total: money(lineTotal(item)),
      }
    }),
    subtotal: money(subtotal),
    packaging: packaging > 0.005 ? money(packaging) : null,
    service: service > 0.005 ? money(service) : null,
    discount: discount > 0.005 ? `− ${money(discount)}` : null,
    shipping: money(shipping),
    total: money(order?.total),
    customer_note: text(meta.customer_note) || null,
    admin_url: adminUrl && order?.id ? `${adminUrl.replace(/\/+$/, "")}/app/orders/${order.id}` : null,
  }
}
