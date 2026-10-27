"use client"

import { useRouter } from "next/navigation"

import { usePaymentWatch } from "@lib/hooks/use-payment-watch"

/**
 * Obnovuje stránku, dokud se čeká na platbu (každé 3 s, později 10 s, a hned
 * po návratu do záložky). Stránka sama rozhodne, kdy ji vykreslit — jakmile je
 * zaplaceno, přestane ji vykreslovat a hlídání skončí. Nic nevykresluje.
 */
export default function RefreshWhilePaying() {
  const router = useRouter()
  usePaymentWatch(async () => {
    router.refresh()
    return false
  })
  return null
}
