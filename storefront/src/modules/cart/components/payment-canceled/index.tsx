"use client"
import OrderStateShell from "@modules/order/components/order-state-shell"

export default function PaymentCanceled() {
  return (
    <OrderStateShell
      eyebrow="Platba neproběhla"
      title="Nic se neztratilo."
      accent="Košík vám zůstal."
      description="Platba se nedokončila a nic jsme vám nestrhli. Můžete se vrátit k objednávce, nebo se jen dál rozhlížet."
      status="canceled"
      primary={{ href: "/checkout?step=payment", label: "Vrátit se k platbě" }}
      secondary={{ href: "/store", label: "Pokračovat v obchodě" }}
    />
  )
}
