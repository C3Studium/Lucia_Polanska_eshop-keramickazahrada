"use client"

import { commissionPrompt, isMadeToOrderLine } from "@lib/util/commission"
import { readCommissionBrief } from "@lib/util/made-to-order"
import { saveCommissionBrief } from "@lib/data/commission-actions"
import { useState } from "react"
import CommissionBrief from "../commission-brief"
import styles from "./style.module.scss"

/**
 * Zadání zakázek v košíku — jedno okno, mezi kusy se přepíná číslem.
 *
 * Žije na dvou místech najednou: v pravém sloupci souhrnu na širokém okně
 * (vedle „Co objednáváte") a uvnitř kroku Přehled na telefonu. CSS na každém
 * z nich rozhoduje, který se ukáže. Brief se ukládá na řádek košíku, takže
 * je jedno, která kopie ho uložila.
 *
 * ## Proč přepínač, a ne všechny boxy pod sebou
 *
 * Dřív se vykreslil plný box na každou zakázku. Nic se tím neztratilo, ale
 * v souhrnu je to úzký sloupec — tři zakázky z něj udělaly sloupec dlouhý
 * jako stránka a zákazník scrolloval přes zadání, které už vyplnil.
 *
 * ## Proč je u každého čísla vidět stav
 *
 * Protože na vyplnění visí brána: dokud nemá KAŽDÁ zakázka text nebo fotku,
 * nejde se k platbě. Kdyby přepínač byly jen holé číslice, schoval by
 * nevyplněnou zakázku za číslo, na které nikdo neklikl — zákazník zmáčkne
 * „Pokračovat", dostane odmítnutí a nemá podle čeho hledat, kde chybí co.
 * Tečka u čísla to řekne dřív, než na ni dojde.
 *
 * Při jediné zakázce se přepínač nevykresluje vůbec: jedno číslo není volba.
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

export default function CheckoutCommissionBriefs({
  cart,
  passCartId = false,
  onCompletionChange,
}: CommissionBriefsProps) {
  const commissionLines = ((cart?.items ?? []) as any[])
    .filter(isMadeToOrderLine)
    .map((item) => ({
      id: item.id as string,
      title: (item.product_title || item.title) as string,
      /* Množství patří k popisku: „Domovní číslo · 2 ks" je jediné místo, kde
         se zákazník dozví, že jedno zadání platí pro oba kusy. */
      quantity: Number(item.quantity ?? 1),
      prompt: commissionPrompt(item),
      brief: readCommissionBrief(item),
    }))

  /* Stav vyplnění drží tahle komponenta, protože ho kreslí na přepínači.
     Výchozí hodnota je z toho, co už v košíku leží; `CommissionBrief` po
     uložení ohlásí změnu. */
  const [complete, setComplete] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      commissionLines.map((line) => [line.id, briefHasContent(line.brief)])
    )
  )

  /* Index, ne id: po odebrání řádku z košíku by id ukazovalo na nic a blok
     by zmizel celý. Index se jen uřízne na poslední existující. */
  const [activeIndex, setActiveIndex] = useState(0)

  if (!commissionLines.length) {
    return null
  }

  const active = commissionLines[Math.min(activeIndex, commissionLines.length - 1)]

  const hlasitStav = (lineId: string, hotovo: boolean) => {
    setComplete((current) =>
      current[lineId] === hotovo ? current : { ...current, [lineId]: hotovo }
    )
    onCompletionChange?.(lineId, hotovo)
  }

  return (
    <div className={styles.root}>
      {commissionLines.length > 1 && (
        <nav className={styles.prepinac} aria-label="Zakázky v objednávce">
          <ol>
            {commissionLines.map((line, index) => {
              const jeAktivni = line === active
              const jeHotova = complete[line.id]
              return (
                <li key={line.id}>
                  <button
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-current={jeAktivni ? "true" : undefined}
                    data-active={jeAktivni}
                    data-done={jeHotova}
                    /* Název kusu i stav do přístupného jména: na číslici
                       samotné by odečítač obrazovky přečetl jen „2". */
                    aria-label={`${index + 1}. ${line.title} — ${
                      jeHotova ? "vyplněno" : "zatím nevyplněno"
                    }`}
                  >
                    <span aria-hidden="true">{index + 1}</span>
                    <i aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ol>

          {/* Kolik z kolika je hotovo — odpověď na „co po mně ještě chce",
              aniž by se muselo proklikat všechno. */}
          <p className={styles.stav}>
            {commissionLines.filter((line) => complete[line.id]).length} z{" "}
            {commissionLines.length} vyplněno
          </p>
        </nav>
      )}

      {/*
        `key` na řádku, ne na indexu: přepnutí má dát prázdný formulář toho
        druhého kusu, ne rozepsaný text toho prvního. Bez něj by React obě
        zakázky považoval za tentýž box a nechal v něm, co je napsané.
      */}
      <CommissionBrief
        key={active.id}
        variant="checkout"
        title={
          active.quantity > 1
            ? `${active.title} · ${active.quantity} ks`
            : active.title
        }
        prompt={active.prompt}
        // Zadání je `specification`; starší řádky ho můžou mít ještě v `note`.
        note={active.brief.specification || active.brief.note || ""}
        photos={active.brief.photos ?? []}
        onSubmitAction={async (input) =>
          saveCommissionBrief(active.id, input, passCartId ? cart.id : undefined)
        }
        onCompletionChange={(hotovo) => hlasitStav(active.id, hotovo)}
      />
    </div>
  )
}
