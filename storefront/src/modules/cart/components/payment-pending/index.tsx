"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import OrderStateShell from "@modules/order/components/order-state-shell"
import styles from "./style.module.scss"

const REFRESH_INTERVAL_MS = 20_000

/**
 * Where a bank-transfer customer lands after paying. The payment is out of our hands until the
 * bank confirms it, so the page's whole job is to say that plainly, show the reference the
 * customer needs when they call, and quietly re-check.
 */
export default function PaymentPending({
  reference,
  orderNumber,
  supportEmail,
  supportPhone,
}: {
  reference: string
  orderNumber?: string
  supportEmail: string
  supportPhone: string
}) {
  const router = useRouter()

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [router])

  return (
    <OrderStateShell
      eyebrow="Platba · čekáme na banku"
      title="Objednávka je uložená."
      accent="Čekáme na potvrzení z banky."
      description="Platbu jsme zahájili, ale banka ji ještě nepotvrdila. U bankovního převodu to bývá i několik hodin, o víkendu déle. Nemusíte nic dělat — jakmile platbu potvrdíme, pošleme vám e-mail."
      status="pending"
    >
      <dl className={styles.reference}>
        <div>
          <dt>{orderNumber ? "Číslo objednávky" : "Referenční číslo"}</dt>
          <dd>{orderNumber ?? reference}</dd>
        </div>
        <div>
          <dt>Když si nebudete jistí</dt>
          <dd>
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            <span aria-hidden="true"> · </span>
            <a href={`tel:${supportPhone.replace(/\s/g, "")}`}>{supportPhone}</a>
          </dd>
        </div>
      </dl>
      <p className={styles.note}>
        Stránka se sama každých pár vteřin obnovuje. Klidně ji zavřete — na výsledek to
        nemá vliv.
      </p>
    </OrderStateShell>
  )
}
