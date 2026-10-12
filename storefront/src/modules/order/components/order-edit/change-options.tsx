"use client"

import { useRouter } from "next/navigation"
import { useId, useTransition } from "react"

import { cancelGuestOrderEdit } from "@lib/data/guest-order-edit"
import type { OrderEditContext } from "@lib/data/order-edit"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useContactDialog } from "@modules/layout/ContactDialog"

import OrderDeliverySection from "./delivery-section"
import { refundPath } from "./shared"
import s from "./style.module.scss"

/**
 * Stránka „Upravit objednávku" od 12. 10. 2026 (Matěj): zákazník si sám mění
 * jen DORUČENÍ (adresu „pošta domů" / výdejnu Balíkovny) a o změnu zboží
 * požádá tlačítkem „Potřebuji změnit objednávku" — otevře kontaktní dialog
 * v režimu změny objednávky (zpráva + povinný telefon, číslo objednávky jede
 * samo) a Lucie zavolá nebo odepíše. Úprava položek a mini obchod
 * (`OrderEditor`) zůstávají v kódu za vypínačem `ORDER_ITEM_EDITING_ENABLED`.
 *
 * Doručení: brána je stejná jako na serveru (`POST …/delivery`): jde měnit,
 * dokud objednávka nemá zásilku (štítek) a není vypravená — `mode !== "none"`.
 * Limit úprav položek ani čistá zakázka změnu doručení neblokují (server je
 * u doručení nehlídá), proto se tu neptáme na `editable`. Měnit jde jen cíl
 * v rámci zvolené dopravy (výdejna → výdejna, adresa → adresa); osobní odběr
 * nemá co měnit.
 */
export default function OrderChangeOptions({
  orderId,
  token,
  context,
}: {
  orderId: string
  token: string
  context: OrderEditContext
}) {
  const router = useRouter()
  const headingId = useId()
  const { openOrderChange } = useContactDialog()
  const [cancelling, startCancel] = useTransition()

  const method = context.delivery?.method
  const shipsByCarrier = method === "balikovna" || method === "home"
  const deliveryOpen = context.mode !== "none"
  const showDelivery = deliveryOpen && shipsByCarrier && Boolean(context.delivery)

  const statusTone = deliveryOpen ? "open" : "closed"
  const statusText = !deliveryOpen
    ? context.reason ??
      "Objednávka už se chystá na cestu — doručení tady změnit nejde. Napište nám a domluvíme se."
    : shipsByCarrier
      ? method === "balikovna"
        ? "Výdejní místo můžete změnit, dokud zásilku nepřipravíme k odeslání."
        : "Doručovací adresu můžete změnit, dokud zásilku nepřipravíme k odeslání."
      : "Objednávku si vyzvednete osobně — doručení tu není co měnit."

  const askForChange = () =>
    openOrderChange({
      orderId,
      displayId: context.order.display_id,
      token,
      phone: context.delivery?.shipping_address?.phone || null,
    })

  /* Pozůstatek z doby, kdy šly měnit položky: úprava čekající na doplacení
     rozdílu. Zrušit ji jde dál, ať objednávka nezůstane viset. */
  const cancelPending = () =>
    startCancel(async () => {
      await cancelGuestOrderEdit(orderId, token)
      router.refresh()
    })

  return (
    <div className={s.root}>
      <div className={s.status} data-tone={statusTone} role="status">
        <p className={s.statusText}>{statusText}</p>
      </div>

      {context.pending_change && (
        <div className={s.notice} data-tone="pending">
          <p className={s.noticeTitle}>
            {context.pending_change.awaiting_payment
              ? "Čeká na zaplacení rozdílu"
              : "Rozpracovaná úprava"}
          </p>
          <p className={s.noticeText}>
            K objednávce běží dřívější úprava, která čeká na doplacení rozdílu
            — do té doby objednávka zůstává, jak byla. Když ji nechcete
            dokončit, zrušte ji; o změnu se pak domluvíme spolu.
          </p>
          <button
            type="button"
            className={s.pill}
            onClick={cancelPending}
            disabled={cancelling}
          >
            {cancelling ? "Rušíme…" : "Zrušit rozpracovanou úpravu"}
          </button>
        </div>
      )}

      {showDelivery && context.delivery && (
        <OrderDeliverySection
          orderId={orderId}
          token={token}
          delivery={context.delivery}
          paysByDobirka={context.payment === "dobirka"}
        />
      )}

      <section className={s.section} aria-labelledby={`${headingId}-change`}>
        <header className={s.sectionHead}>
          <h2 id={`${headingId}-change`} className={s.sectionTitle}>
            Změna zboží
          </h2>
        </header>
        <p className={s.sectionLead}>
          Jiný kus, jiné provedení, něco přidat nebo ubrat? Změny zboží
          domlouváme osobně — napište, co potřebujete, a Lucie vám zavolá nebo
          odepíše. Do té doby objednávka zůstává, jak je.
        </p>
        <div>
          <button type="button" className={s.primary} onClick={askForChange}>
            Potřebuji změnit objednávku
          </button>
        </div>
        <p className={s.sectionLead}>
          Chcete objednávku zrušit celou? To jde přes{" "}
          <LocalizedClientLink
            className={s.textButton}
            // Formulář rovnou na „Odstoupení (zrušení objednávky)".
            href={`${refundPath(orderId, token)}&kind=odstoupeni`}
          >
            Reklamace a zrušení
          </LocalizedClientLink>
          .
        </p>
      </section>
    </div>
  )
}
