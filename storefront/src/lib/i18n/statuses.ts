export type PaymentStatus =
  | "not_paid"
  | "awaiting"
  | "authorized"
  | "partially_authorized"
  | "captured"
  | "partially_captured"
  | "partially_refunded"
  | "refunded"
  | "canceled"
  | "requires_action"

export type FulfillmentStatus =
  | "not_fulfilled"
  | "partially_fulfilled"
  | "fulfilled"
  | "partially_shipped"
  | "shipped"
  | "partially_delivered"
  | "delivered"
  | "canceled"

export const STATUS_TRANSLATIONS: Record<string, { fulfillment: Record<string,string>, payment: Record<string,string> }> = {
  cs: {
    fulfillment: {
      not_fulfilled: "Nevyřízeno",
      partially_fulfilled: "Částečně vyřízeno",
      fulfilled: "Vyřízeno",
      partially_shipped: "Částečně odesláno",
      shipped: "Odesláno",
      partially_delivered: "Částečně doručeno",
      delivered: "Doručeno",
      returned: "Vráceno",
      canceled: "Zrušeno",
      pending: "Čeká",
      preparing: "Připravuje se",
      // add any other codes you encounter
    },
    payment: {
      not_paid: "Nezaplaceno",
      awaiting: "Čeká na platbu",
      authorized: "Autorizováno",
      partially_authorized: "Částečně autorizováno",
      captured: "Zaplaceno",
      partially_captured: "Částečně zaplaceno",
      partially_refunded: "Částečně vráceno",
      refunded: "Vráceno",
      canceled: "Zrušeno",
      requires_action: "Vyžaduje akci",
      // add others you need
    },
  },
  // add more locales later
}



export function translateStatus(code: string | undefined, type: "fulfillment" | "payment", locale = "cs") {
  if (!code) return ""
  const map = STATUS_TRANSLATIONS[locale]?.[type] || {}
  const normalized = String(code).toLowerCase()
  return map[normalized] ?? // exact mapping
    // fallback: prettify code => Not_fulfilled -> Not fulfilled -> Not Fulfilled
    normalized.split("_").join(" ").replace(/\b\w/g, (c) => c.toUpperCase())
}