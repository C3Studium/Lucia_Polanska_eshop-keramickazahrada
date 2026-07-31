"use client"
import OrderStateShell from "@modules/order/components/order-state-shell"

export default function PaymentCanceled() {
  return (
    <OrderStateShell
      eyebrow="Platba · nedokončeno"
      title="Nic se neztratilo."
      accent="Košík na vás počká."
      description="Platba nebyla dokončena a nic jsme vám nenaúčtovali. Můžete se bezpečně vrátit k objednávce nebo pokračovat v prohlížení ateliéru."
      status="canceled"
      primary={{ href: "/checkout?step=payment", label: "Vrátit se k platbě" }}
      secondary={{ href: "/store", label: "Pokračovat v obchodě" }}
    />
  )
}
