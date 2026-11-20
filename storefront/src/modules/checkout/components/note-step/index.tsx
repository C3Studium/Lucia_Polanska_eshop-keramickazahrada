"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { updateCart } from "@lib/data/cart"
import { CUSTOMER_NOTE_KEY, CUSTOMER_NOTE_MAX } from "@lib/util/customer-note"
import { previousCheckoutStep } from "@lib/util/checkout-steps"

import brief from "../brief-step/style.module.scss"
import s from "./style.module.scss"

/**
 * Poznámka k běžné objednávce (19. 11. 2026, Matěj).
 *
 * Tentýž krok jako zadání zakázky (`brief-step`) na tomtéž místě — mezi
 * doručením a platbou —, jen NEPOVINNÝ a bez fotek. Uloží se do metadat
 * košíku (`customer_note`); Medusa je při dokončení přenese do objednávky
 * a admin je ukáže ve widgetu „Poznámka od zákazníka".
 *
 * Ukládá se po chvíli od posledního úhozu a znovu při odchodu z kroku, takže
 * „Pokračovat" nikdy nepředběhne uložení.
 */
export default function CheckoutNoteStep({ cart }: { cart: any }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isOpen = (searchParams.get("step") ?? "address") === "note"
  const zpet = previousCheckoutStep(cart?.items, "note")

  const ulozena = typeof cart?.metadata?.[CUSTOMER_NOTE_KEY] === "string" ? (cart.metadata[CUSTOMER_NOTE_KEY] as string) : ""
  const [text, setText] = useState(ulozena)
  const [stav, setStav] = useState<"ulozeno" | "uklada" | "chyba" | null>(null)
  const posledni = useRef(ulozena)
  const casovac = useRef<ReturnType<typeof setTimeout> | null>(null)

  const uloz = async (hodnota: string) => {
    const cista = hodnota.slice(0, CUSTOMER_NOTE_MAX)
    if (cista === posledni.current) return true
    setStav("uklada")
    try {
      /* Vždy zapsat i prázdný řetězec: Medusa metadata slučuje a vynechaný
         klíč by starou poznámku nesmazal (viz paměť „medusa-metadata-merge"). */
      await updateCart({ metadata: { [CUSTOMER_NOTE_KEY]: cista } })
      posledni.current = cista
      setStav("ulozeno")
      return true
    } catch {
      setStav("chyba")
      return false
    }
  }

  useEffect(() => () => {
    if (casovac.current) clearTimeout(casovac.current)
  }, [])

  if (!isOpen) return null

  const zmena = (hodnota: string) => {
    setText(hodnota)
    setStav(null)
    if (casovac.current) clearTimeout(casovac.current)
    casovac.current = setTimeout(() => void uloz(hodnota), 800)
  }

  /*
   * Nejdřív přejít, ukládat souběžně. Obráceně (await uložení → push) to
   * nešlo: serverová akce s revalidací po dokončení obnoví AKTUÁLNÍ adresu
   * a ta `router.push` přebila — změřeno, „Uloženo." a krok zůstal stát.
   * Komponenta je připojená i na dalším kroku, takže uložení doběhne;
   * objednávka se odesílá až o dva kroky dál.
   */
  const jdi = (krok: string) => {
    if (casovac.current) clearTimeout(casovac.current)
    router.push(`${pathname}?step=${krok}`, { scroll: false })
    void uloz(text)
  }

  return (
    <div className={brief.root}>
      <header className={brief.head}>
        <h2>Poznámka k objednávce</h2>
        {/* Text podle Lucie (20. 11. 2026): prostor pro doplňující údaje
            k objednávce, ne nabídka dárkového balení. */}
        <p>
          Prostor pro doplňující informace k objednávce — třeba velikost,
          barva, provedení nebo cokoli dalšího, co bychom měli vědět. Pole je
          nepovinné, můžete ho nechat prázdné.
        </p>
      </header>

      <label className={s.field}>
        <span className={s.label}>Poznámka (nepovinné)</span>
        <textarea
          className={s.textarea}
          value={text}
          maxLength={CUSTOMER_NOTE_MAX}
          onChange={(event) => zmena(event.currentTarget.value)}
          onBlur={() => void uloz(text)}
          placeholder="Např. velikost, barva, provedení…"
          data-testid="checkout-customer-note"
          rows={5}
        />
        <span className={s.meta} aria-live="polite">
          <span>
            {stav === "uklada"
              ? "Ukládám…"
              : stav === "ulozeno"
                ? "Uloženo."
                : stav === "chyba"
                  ? "Poznámku se nepodařilo uložit — zkuste to prosím znovu."
                  : ""}
          </span>
          <span>
            {text.length} / {CUSTOMER_NOTE_MAX}
          </span>
        </span>
      </label>

      <div className={brief.actions}>
        <button type="button" className={brief.back} onClick={() => jdi(zpet)}>
          ← Zpět na {zpet === "brief" ? "zadání" : "doručení"}
        </button>
        <button
          type="button"
          className={brief.next}
          onClick={() => jdi("payment")}
          data-testid="checkout-note-continue"
        >
          Pokračovat na platbu →
        </button>
      </div>
    </div>
  )
}
