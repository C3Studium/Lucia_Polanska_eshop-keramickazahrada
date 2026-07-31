"use client"
import { useEffect } from "react"
import { placeOrder, capturePayment } from "@lib/data/cart"
import OrderStateShell from "@modules/order/components/order-state-shell"

export default function PaymentConfirmed({ id }: { id: string }) {
    useEffect(() => {
        placeOrder(id)
        capturePayment({ cartId: id })
      }, [id])
      
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
