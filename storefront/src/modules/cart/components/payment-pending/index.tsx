"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { itemFieldPath, itemValue } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import CmsText from "@modules/common/components/cms-text"
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
  block,
}: {
  reference: string
  orderNumber?: string
  supportEmail: string
  supportPhone: string
  /**
   * Blok `kosik.platba-ceka`: nadpis (`title` + `headline`), odstavec
   * (`body`) a položky klíčované popiskem — obočí (`oboci`) a poznámka
   * o obnovování (`poznamka`). Položky, ne pozice v `accent`: CMS z něj
   * prázdné vyhazuje a poznámka by se posunula do obočí.
   * Číslo objednávky a kontakty jsou údaje, ne text — drží je kód.
   */
  block?: CopyBlock
}) {
  const router = useRouter()

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [router])

  return (
    <OrderStateShell
      eyebrow={itemValue(block, "oboci")?.trim() || "Čekáme na banku"}
      title={block?.title?.trim() || "Objednávku máme."}
      accent={block?.headline?.trim() || "Teď čekáme na banku."}
      description={
        block?.bodyText?.trim() ||
        "Platbu jsme odeslali, banka ji ale zatím nepotvrdila. U převodu to bývá i pár hodin, o víkendu klidně déle. Nemusíte nic dělat — jakmile ji potvrdíme, napíšeme vám."
      }
      status="pending"
      editDoc={block?.id ?? null}
      editFields={{
        eyebrow: itemFieldPath(block, "oboci"),
        title: "title",
        accent: "headline",
        description: "body",
      }}
    >
      <dl className={styles.reference}>
        <div>
          <dt>{orderNumber ? "Číslo objednávky" : "Referenční číslo"}</dt>
          <dd>{orderNumber ?? reference}</dd>
        </div>
        <div>
          <dt>Kdyby něco</dt>
          <dd>
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            <span aria-hidden="true"> · </span>
            <a href={`tel:${supportPhone.replace(/\s/g, "")}`}>{supportPhone}</a>
          </dd>
        </div>
      </dl>
      <CmsText as="p" className={styles.note} doc={block?.id ?? null} field={itemFieldPath(block, "poznamka")}>
        {itemValue(block, "poznamka")?.trim() ||
          "Stránka se sama každých pár vteřin obnoví. Klidně ji zavřete, na výsledek to nemá vliv."}
      </CmsText>
    </OrderStateShell>
  )
}
