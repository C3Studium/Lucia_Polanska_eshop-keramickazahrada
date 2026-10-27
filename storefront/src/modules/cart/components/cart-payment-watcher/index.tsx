"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

import { getCartPaymentState } from "@lib/data/cart"
import { usePaymentWatch } from "@lib/hooks/use-payment-watch"

/**
 * Hlídá platbu košíku na stránkách po návratu z brány a sám přepne:
 * zaplaceno → potvrzení objednávky, zrušeno → „nezaplaceno" (jen ze
 * stránky „čekáme"). Nic nevykresluje.
 *
 * Bez oznámení od ComGate se dřív stránka nehnula, dokud nedoběhla dohledová
 * úloha (10 min). Teď se ptá každých pár vteřin a hned po návratu do záložky
 * (zákazník platil v jiném okně) — backend se zeptá brány a zaplacený košík
 * rovnou dokončí.
 */
export default function CartPaymentWatcher({
  cartId,
  onCanceled = "stay",
}: {
  cartId: string
  /** Co dělat, když brána hlásí zrušeno: na stránce „čekáme" přejít na „nezaplaceno". */
  onCanceled?: "stay" | "canceled-page"
}) {
  const router = useRouter()
  const { countryCode } = useParams<{ countryCode: string }>()
  const done = useRef(false)

  usePaymentWatch(async () => {
    if (done.current) return true
    const result = await getCartPaymentState(cartId)
    if (result.state === "paid" && result.order_id) {
      done.current = true
      router.replace(`/${countryCode}/order/${result.order_id}/confirmed?platba=paid`)
      return true
    }
    if (result.state === "canceled" && onCanceled === "canceled-page") {
      done.current = true
      router.replace(`/${countryCode}/cart/${cartId}/canceled`)
      return true
    }
    return false
  })

  useEffect(() => () => void (done.current = true), [])
  return null
}
