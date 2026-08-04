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
        eyebrow="Platba · potřebujeme chvíli"
        title="Platbu máme."
        accent="Objednávku dokončíme ručně."
        // The money has left the customer's account. Never imply they should pay again.
        description={`Platba proběhla, ale objednávku se nepodařilo automaticky uzavřít. Nic neplaťte znovu — máme o platbě záznam a objednávku dokončíme ručně. Ozvěte se nám prosím na ${supportEmail} nebo ${supportPhone} a uveďte číslo ${id}; obratem se vám ozveme.`}
        status="canceled"
        primary={{ href: "/store", label: "Pokračovat v obchodě" }}
      />
    )
  }

  return (
    <OrderStateShell
      eyebrow="Platba · ověření"
      title="Platbu máme."
      accent="Objednávku dokončujeme."
      description="Ještě okamžik — potvrzujeme objednávku a připravujeme její bezpečné uložení. Tuto stránku není potřeba obnovovat."
      status="pending"
    />
  )
}
