export type ComgatePaymentMethod = {
  id: string
  group: string
  groupLabel: string
  name: string
  name_short: string
  description: string
  logo: string
  logo_120c: string
  logo_240: string
  logo_240c: string
  logo_150s: string
  logo_100s: string
}

const optionPrefix = "pp_comgate_method__"

export const toComgateOptionId = (methodId: string) =>
  `${optionPrefix}${methodId}`

export const fromComgateOptionId = (optionId?: string | null) =>
  optionId?.startsWith(optionPrefix)
    ? optionId.slice(optionPrefix.length)
    : null

export const getComgateMethodLogo = (method: ComgatePaymentMethod) =>
  method.logo_100s ||
  method.logo_120c ||
  method.logo_150s ||
  method.logo ||
  method.logo_240c ||
  method.logo_240

export const extractComgateRedirectUrl = (payload: any): string | null => {
  const collection =
    payload?.payment_collection || payload?.data?.payment_collection
  const sessions = collection?.payment_sessions
  const session = Array.isArray(sessions)
    ? sessions.find(
        (item: any) =>
          typeof item?.provider_id === "string" &&
          item.provider_id.startsWith("pp_comgate")
      )
    : null
  const candidate =
    session?.data?.redirectUrl ||
    session?.data?.redirect_url ||
    payload?.redirectUrl ||
    payload?.data?.redirectUrl

  return typeof candidate === "string" && candidate.startsWith("https://")
    ? candidate
    : null
}

const legacyComgateOptions: Record<string, string> = {
  pp_comgate_card: "CARD_ALL",
  pp_comgate_applepay: "APPLEPAY_REDIRECT",
  pp_comgate_googlepay: "GOOGLEPAY_REDIRECT",
  pp_comgate_bank: "BANK_ALL",
}

export const comgateMethodForOption = (optionId: string) =>
  fromComgateOptionId(optionId) || legacyComgateOptions[optionId] || "ALL"

export const legacyComgateOptionForMethod = (method: string) => {
  if (method === "BANK_ALL") return "pp_comgate_bank"
  if (method === "APPLEPAY_REDIRECT" || method === "APPLEPAY") {
    return "pp_comgate_applepay"
  }
  if (method === "GOOGLEPAY_REDIRECT" || method === "GOOGLEPAY") {
    return "pp_comgate_googlepay"
  }
  return "pp_comgate_card"
}

/**
 * Shapes the payload ComGate needs from a cart. Kept pure and in one place: the payment step
 * offers the methods, but the session is only created from the Review step, after consent.
 */
export const buildComgateSessionPayload = (cart: any, optionId: string) => {
  const shippingAddress = cart?.shipping_address
  const billingAddress = cart?.billing_address || shippingAddress
  const shippingName = String(
    cart?.shipping_methods?.at(-1)?.name || ""
  ).toLowerCase()
  const isPickup = ["zásil", "zasil", "packeta", "výdej"].some((token) =>
    shippingName.includes(token)
  )

  return {
    provider_id: "pp_comgate_comgate",
    data: {
      cart_id: cart.id,
      method: comgateMethodForOption(optionId),
      email: cart?.email || null,
      first_name:
        billingAddress?.first_name || shippingAddress?.first_name || null,
      last_name: billingAddress?.last_name || shippingAddress?.last_name || null,
      country_code:
        shippingAddress?.country_code || billingAddress?.country_code || "cz",
      billing_city: billingAddress?.city,
      billing_street: billingAddress?.address_1,
      billing_postal_code: billingAddress?.postal_code,
      shipping_city: shippingAddress?.city,
      shipping_street: shippingAddress?.address_1,
      shipping_postal_code: shippingAddress?.postal_code,
      delivery: isPickup ? "PICKUP" : "HOME_DELIVERY",
      lang: "cs",
    },
  }
}
