"use client"

import { useEffect, useRef, useState } from "react"

import { placeOrder, capturePayment } from "@lib/data/cart"
import OrderStateShell from "@modules/order/components/order-state-shell"

/**
 * A successful `placeOrder` redirects to the order page, and Next signals that redirect by
 * rejecting with a tagged error. That is not a failure and must not be treated as one.
 */
const isRedirectSignal = (error: unknown) =>
  typeof (error as { digest?: unknown })?.digest === "string" &&
  (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")

export default function PaymentConfirmed({
  id,
  supportEmail,
  supportPhone,
}: {
  id: string
  supportEmail: string
  supportPhone: string
}) {
  const [failed, setFailed] = useState(false)
  const startedRef = useRef(false)

  useEffect(() => {
    // React runs effects twice in development; the order must only be placed once.
    if (startedRef.current) {
      return
    }
    startedRef.current = true

    const complete = async () => {
      try {
        await Promise.all([placeOrder(id), capturePayment({ cartId: id })])
      } catch (error) {
        if (isRedirectSignal(error)) {
          return
        }

        setFailed(true)
      }
    }

    complete()
  }, [id])

  if (failed) {
    return (
      <OrderStateShell
        eyebrow="Ještě to dořešíme"
        title="Platbu máme."
        accent="Objednávku dodělám ručně."
        // The money has left the customer's account. Never imply they should pay again.
        description={`Platba prošla, ale objednávka se sama nedokončila. Znovu prosím neplaťte — platbu máme zaznamenanou a objednávku dodělám ručně. Napište nám na ${supportEmail} nebo zavolejte na ${supportPhone} a uveďte číslo ${id}. Ozveme se obratem.`}
        status="canceled"
        primary={{ href: "/store", label: "Pokračovat v obchodě" }}
      />
    )
  }

  return (
    <OrderStateShell
      eyebrow="Ověřujeme platbu"
      title="Platbu máme."
      accent="Ještě ji dokončujeme."
      description="Ještě chviličku — objednávku potvrzujeme a ukládáme. Stránku nemusíte obnovovat."
      status="pending"
    />
  )
}
