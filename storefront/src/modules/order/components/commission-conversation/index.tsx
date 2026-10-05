"use client"

import { useState, useTransition } from "react"

import Modal from "@modules/common/components/modal"
import CommissionBrief from "@modules/checkout/components/commission-brief"
import {
  addOrderCommissionNote,
  refreshCommissionNotes,
} from "@lib/data/commission-actions"
import type { CommissionNote } from "@lib/util/made-to-order"

import s from "./style.module.scss"

type Props = {
  /** Medusa order id — jediný klíč, který každá stránka objednávky drží. */
  orderId: string
  /** Vlákno načtené serverem při načtení stránky (co napsal zákazník + co ateliér zpřístupnil). */
  notes: CommissionNote[]
  /** Doplňková třída, pro odsazení v konkrétním místě stránky. */
  className?: string
}

/**
 * Konverzace s ateliérem k zakázce — jako POPUP a jeden znovupoužitelný
 * komponent pro VŠECHNY stránky objednávky (potvrzení, detail v účtu, úprava,
 * reklamace). Tlačítko otevře okno s celým vláknem a polem na odpověď; stačí ho
 * na stránku vložit s `orderId` a `notes`.
 *
 * Při otevření se vlákno natáhne znovu (`refreshCommissionNotes`), aby tam byly
 * i odpovědi ateliéru, které přišly po načtení stránky — jinak by se ukázal jen
 * stav z načtení. Čtení i psaní jde přes publishable key (bez přihlášení),
 * gated přes id objednávky, takže stejný komponent slouží hostovi i přihlášenému.
 */
export default function CommissionConversation({
  orderId,
  notes,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [thread, setThread] = useState(notes)
  const [, startRefresh] = useTransition()

  const openConversation = () => {
    setOpen(true)
    startRefresh(async () => {
      const fresh = await refreshCommissionNotes(orderId)
      if (fresh) setThread(fresh)
    })
  }

  const count = thread.length

  return (
    <>
      <button
        type="button"
        className={className ? `${s.trigger} ${className}` : s.trigger}
        onClick={openConversation}
        data-testid="commission-conversation-open"
      >
        <span className={s.icon} aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9.5 9.5 0 0 1-4-.9L3 20l1.4-4.2A8.5 8.5 0 1 1 21 11.5z" />
          </svg>
        </span>
        <span className={s.copy}>
          <span className={s.title}>Konverzace s ateliérem</span>
          <span className={s.sub}>
            {count > 0
              ? "Napište mi — čtu to u rozdělané práce."
              : "Napadlo vás ještě něco? Napište mi."}
          </span>
        </span>
        {count > 0 && (
          <span className={s.count} aria-label={`${count} zpráv ve vlákně`}>
            {count}
          </span>
        )}
      </button>

      <Modal
        isOpen={open}
        close={() => setOpen(false)}
        size="large"
        data-testid="commission-conversation-modal"
      >
        <Modal.Title>Konverzace s ateliérem</Modal.Title>
        <Modal.Body>
          <CommissionBrief
            variant="order"
            hideHeader
            note=""
            photos={[]}
            notes={thread}
            onSubmitAction={async (input) =>
              addOrderCommissionNote(orderId, {
                note: input.note,
                newPhotos: input.newPhotos,
              })
            }
          />
        </Modal.Body>
      </Modal>
    </>
  )
}
