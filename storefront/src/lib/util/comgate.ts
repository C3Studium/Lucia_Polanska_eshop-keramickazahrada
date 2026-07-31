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
