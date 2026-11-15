"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { HttpTypes } from "@medusajs/types"
import type { ComgatePaymentMethod } from "@lib/util/comgate"
import { headers as nextHeaders } from "next/headers"

export const listCartPaymentMethods = async (regionId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("payment_providers")),
  }

  return sdk.client
    .fetch<HttpTypes.StorePaymentProviderListResponse>(
      `/store/payment-providers`,
      {
        method: "GET",
        query: { region_id: regionId },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ payment_providers }) =>
      payment_providers.sort((a, b) => {
        return a.id > b.id ? 1 : -1
      })
    )
    .catch(() => {
      return null
    })
}

export const listComgatePaymentMethods = async ({
  currencyCode,
  countryCode,
  total,
}: {
  currencyCode: string
  countryCode: string
  total?: number
}): Promise<ComgatePaymentMethod[]> => {
  const userAgent = (await nextHeaders()).get("user-agent")
  // Bez přihlašovací hlavičky: seznam metod nezávisí na zákazníkovi a takhle
  // ho mezipaměť sdílí všichni se stejným prohlížečem a částkou.
  const headers = {
    ...(userAgent ? { "x-shopper-user-agent": userAgent } : {}),
  }
  const price =
    typeof total === "number" && Number.isFinite(total) && total > 0
      ? Math.round(total * 100)
      : undefined

  return sdk.client
    .fetch<{ methods: ComgatePaymentMethod[] }>(`/store/comgate/methods`, {
      method: "GET",
      query: {
        curr: currencyCode.toUpperCase(),
        country: countryCode.toUpperCase(),
        lang: "cs",
        ...(price ? { price } : {}),
      },
      headers,
      // Dřív `no-store` = dotaz na ComGate při každém kroku pokladny
      // (15. 11. 2026). 5 minut stačí: metody se mění zřídka a klíč mezipaměti
      // nese měnu, zemi, částku i prohlížeč (Apple Pay jen na Applu).
      next: { revalidate: 300 },
    })
    .then(({ methods }) => (Array.isArray(methods) ? methods : []))
    .catch(() => [])
}
