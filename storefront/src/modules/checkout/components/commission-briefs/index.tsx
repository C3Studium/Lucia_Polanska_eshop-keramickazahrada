"use client"

import { commissionPrompt, isMadeToOrderLine } from "@lib/util/commission"
import {
  commissionPieceFilled,
  commissionPiecesOf,
  readCommissionBrief,
} from "@lib/util/made-to-order"
import { saveCommissionBrief } from "@lib/data/commission-actions"
import { useState } from "react"
import CommissionBrief from "../commission-brief"
import styles from "./style.module.scss"

/**
 * Zadání zakázek v košíku — jedno okno, mezi kusy se listuje šipkami.
 *
 * Žije na dvou místech najednou: v pravém sloupci souhrnu na širokém okně
 * (vedle „Co objednáváte") a uvnitř kroku Přehled na telefonu. CSS na každém
 * z nich rozhoduje, který se ukáže. Brief se ukládá na řádek košíku, takže
 * je jedno, která kopie ho uložila.
 *
 * ## Jeden kus = jedno zadání
 *
 * „Domovní znamení · 2 ks" je jeden řádek košíku, ale DVA kusy, a každý může
 * mít jiné jméno, jiné rozměry, jinou fotku. Do 30. 10. 2026 měl takový řádek
 * jediné zadání pro oba kusy a druhý kus se nedal popsat vůbec. Teď má každý
 * kus svůj formulář a ukládá se do `made_to_order.pieces[i]`
 * (`lib/commission-brief.ts` na backendu skládá dohromady pohled, který čte
 * administrace a PDF).
 *
 * ## Proč listování, a ne všechny boxy pod sebou
 *
 * Dřív se vykreslil plný box na každou zakázku. Nic se tím neztratilo, ale
 * v souhrnu je to úzký sloupec — tři zakázky z něj udělaly sloupec dlouhý
 * jako stránka a zákazník scrolloval přes zadání, které už vyplnil.
 *
 * ## Proč je u listování vidět stav
 *
 * Protože na vyplnění visí brána: dokud nemá KAŽDÝ kus text nebo fotku,
 * nejde se k platbě. Kdyby přepínač byly jen holé šipky, schoval by
 * nevyplněný kus za číslo, na které nikdo neklikl — zákazník zmáčkne
 * „Pokračovat", dostane odmítnutí a nemá podle čeho hledat, kde chybí co.
 * Proto je u šipek fotka a jméno kusu, pořadí („2 / 3") a tečky stavu.
 *
 * Při jediném kusu se nelistuje vůbec: jedna položka není volba.
 */

/** Text NEBO fotka — táž podmínka, na které stojí brána u obou pokladen. */
export const briefHasContent = (
  brief: ReturnType<typeof readCommissionBrief>
): boolean => Boolean(brief.specification || brief.note || (brief.photos?.length ?? 0))

export type CommissionBriefsProps = {
  cart: any
  /**
   * Express ukládá do svého košíku (jiná cookie), takže si `cart.id` musí
   * říct. Běžná pokladna ho nepotřebuje — server si ho najde sám.
   */
  passCartId?: boolean
  /** Express si podle toho rozsvěcí vlastní bránu pod blokem. */
  onCompletionChange?: (lineId: string, complete: boolean) => void
}

/** Jeden kus jedné zakázkové položky — to, mezi čím se listuje. */
type Slot = {
  /** `${lineId}:${piece}` — unikátní v rámci celého košíku. */
  key: string
  lineId: string
  piece: number
  /** Kolik kusů má ten řádek (kvůli popisku „kus 2 ze 2"). */
  ofLine: number
  title: string
  thumbnail: string | null
  prompt: string
  note: string
  photos: string[]
  filled: boolean
}

export default function CheckoutCommissionBriefs({
  cart,
  passCartId = false,
  onCompletionChange,
}: CommissionBriefsProps) {
  const slots: Slot[] = ((cart?.items ?? []) as any[])
    .filter(isMadeToOrderLine)
    .flatMap((item) => {
      const lineId = item.id as string
      const title = (item.product_title || item.title || "") as string
      const thumbnail = (item.thumbnail as string) || null
      const prompt = commissionPrompt(item)
      const pieces = commissionPiecesOf(item)
      return pieces.map((piece, index) => ({
        key: `${lineId}:${index}`,
        lineId,
        piece: index,
        ofLine: pieces.length,
        title,
        thumbnail,
        prompt,
        note: piece.specification,
        photos: piece.photos,
        filled: commissionPieceFilled(piece),
      }))
    })

  /* Stav vyplnění drží tahle komponenta, protože ho kreslí na přepínači.
     Výchozí hodnota je z toho, co už v košíku leží; `CommissionBrief` po
     uložení ohlásí změnu. */
  const [complete, setComplete] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(slots.map((slot) => [slot.key, slot.filled]))
  )

  /* Index, ne klíč: po odebrání řádku z košíku by klíč ukazoval na nic a blok
     by zmizel celý. Index se jen uřízne na poslední existující. */
  const [activeIndex, setActiveIndex] = useState(0)

  if (!slots.length) {
    return null
  }

  const index = Math.min(activeIndex, slots.length - 1)
  const active = slots[index]

  /*
   * Brána se ptá po ŘÁDKU, ne po kusu (tak ji čte express i pokladna), takže
   * se hlásí hotovo teprve tehdy, když má zadání každý kus toho řádku.
   */
  const hlasitStav = (slotKey: string, hotovo: boolean) => {
    setComplete((current) => {
      if (current[slotKey] === hotovo) return current
      const next = { ...current, [slotKey]: hotovo }
      const lineId = slots.find((slot) => slot.key === slotKey)?.lineId
      if (lineId) {
        const lineDone = slots
          .filter((slot) => slot.lineId === lineId)
          .every((slot) => next[slot.key])
        onCompletionChange?.(lineId, lineDone)
      }
      return next
    })
  }

  const hotovo = slots.filter((slot) => complete[slot.key]).length
  const jdi = (delta: number) =>
    setActiveIndex((current) => {
      const base = Math.min(current, slots.length - 1)
      return (base + delta + slots.length) % slots.length
    })

  return (
    <div className={styles.root}>
      {slots.length > 1 && (
        <nav className={styles.prepinac} aria-label="Zakázky v objednávce">
          {/* Fotka + jméno: šipky samy by nikomu neřekly, mezi čím listuje. */}
          <div className={styles.kus}>
            {active.thumbnail && (
              <img src={active.thumbnail} alt="" className={styles.nahled} />
            )}
            <div className={styles.popis}>
              <p className={styles.nazev}>{active.title}</p>
              {active.ofLine > 1 && (
                <p className={styles.poradi}>
                  kus {active.piece + 1} z {active.ofLine}
                </p>
              )}
            </div>
          </div>

          <div className={styles.ovladani}>
            <button
              type="button"
              className={styles.sipka}
              onClick={() => jdi(-1)}
              aria-label="Předchozí zakázka"
            >
              <span aria-hidden="true">‹</span>
            </button>

            {/* Tečky: kolik kusů a které mají zadání — vidět dřív, než na ně
                dojde řada. Klikací, ať se dá skočit rovnou. */}
            <ol className={styles.tecky}>
              {slots.map((slot, slotIndex) => (
                <li key={slot.key}>
                  <button
                    type="button"
                    onClick={() => setActiveIndex(slotIndex)}
                    aria-current={slotIndex === index ? "true" : undefined}
                    data-active={slotIndex === index}
                    data-done={Boolean(complete[slot.key])}
                    aria-label={`${slotIndex + 1}. ${slot.title}${
                      slot.ofLine > 1 ? `, kus ${slot.piece + 1}` : ""
                    } — ${complete[slot.key] ? "vyplněno" : "zatím nevyplněno"}`}
                  />
                </li>
              ))}
            </ol>

            <button
              type="button"
              className={styles.sipka}
              onClick={() => jdi(1)}
              aria-label="Další zakázka"
            >
              <span aria-hidden="true">›</span>
            </button>

            <p className={styles.stav} aria-live="polite">
              {index + 1} / {slots.length} · {hotovo} vyplněno
            </p>
          </div>
        </nav>
      )}

      {/*
        `key` na kusu, ne na indexu: přepnutí má dát prázdný formulář toho
        druhého kusu, ne rozepsaný text toho prvního. Bez něj by React obě
        zadání považoval za tentýž box a nechal v něm, co je napsané.
      */}
      <CommissionBrief
        key={active.key}
        variant="checkout"
        title={
          active.ofLine > 1
            ? `${active.title} · kus ${active.piece + 1} z ${active.ofLine}`
            : active.title
        }
        prompt={active.prompt}
        note={active.note}
        photos={active.photos}
        onSubmitAction={async (input) =>
          saveCommissionBrief(
            active.lineId,
            // Kus posílá jen řádek, který jich má víc — u jediného zůstává
            // tvar metadat přesně jako dřív.
            active.ofLine > 1 ? { ...input, piece: active.piece } : input,
            passCartId ? cart.id : undefined
          )
        }
        onCompletionChange={(done) => hlasitStav(active.key, done)}
      />
    </div>
  )
}
