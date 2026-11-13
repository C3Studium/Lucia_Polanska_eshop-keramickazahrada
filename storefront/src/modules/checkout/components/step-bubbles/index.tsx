"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import s from "./style.module.scss"
import { POPIS_KROKU } from "../step-list"

/**
 * Kde v pokladně jste — čtyři bublinky, jen na svislém telefonu.
 *
 * Na širokém okně nesou tuhle informaci samy kroky: stojí pod sebou, každý má
 * v levé liště své číslo a je vidět, co je za vámi a co před vámi. Na telefonu
 * se ta lišta scvrkne a kroky jsou přes čtyři obrazovky daleko od sebe, takže
 * se pořadí ztratí. Řádek nahoře ho vrátí na jedno místo.
 *
 * Krok se v pokladně drží v adrese (`?step=`), takže bublinky nepotřebují
 * vlastní stav — čtou totéž, podle čeho se kroky rozbalují. Hotové kroky jsou
 * prokliknutelné (je to táž cesta, jakou nabízí jejich tlačítko „Upravit“),
 * ty před vámi ne: do doručení se nedá skočit dřív, než je vyplněná adresa.
 *
 * ## Proč tenhle řádek taky roluje
 *
 * Mezi kroky se přechází zápisem do adresy s `scroll: false` — stránka tedy
 * zůstane přesně tam, kde byla. Jenže kroky nejsou stejně vysoké: kdo
 * odešle adresu ze spodku formuláře, octne se v doručení někde uprostřed,
 * s nadpisem kroku pod plovoucí lištou. Lucie to 12. 11. 2026 napsala
 * přesně: „když jsem šla vybírat možnosti doručení, otevřelo se mi to tady,
 * bylo by lepší se objevit o pole výš, kde jsou možnosti doručení."
 *
 * Vrátit `scroll: true` by nestačilo a nebylo by to ani správně: Next skočí
 * na úplný začátek dokumentu, tedy nad souhrn „Co objednáváte", a krok by
 * byl pořád mimo obraz. Správný cíl je tenhle řádek — je to první věc
 * kroku a nad ním už nic z pokladny není. Odsazení pod lištu drží
 * `scroll-margin-top` ve stylech, protože o výšce lišty ví CSS, ne tahle
 * komponenta.
 *
 * Roluje se jen při ZMĚNĚ kroku, ne při prvním vykreslení: příchod
 * z e-mailu rovnou na `?step=payment` nemá čím hýbat.
 */
const ZAKLADNI = [
  { key: "address", label: "Adresa" },
  { key: "delivery", label: "Doručení" },
  { key: "payment", label: "Platba" },
  { key: "review", label: "Přehled" },
] as const

/* Zadání zakázky stojí PŘED platbou: bez něj se k ní stejně nedá projít. */
const SE_ZAKAZKOU = [
  { key: "address", label: "Adresa" },
  { key: "delivery", label: "Doručení" },
  { key: "brief", label: "Zadání" },
  { key: "payment", label: "Platba" },
  { key: "review", label: "Přehled" },
] as const

export default function CheckoutStepBubbles({
  hasBrief = false,
}: {
  /** Je v košíku zakázka? Pak je kroků pět, ne čtyři. */
  hasBrief?: boolean
}) {
  const STEPS = hasBrief ? SE_ZAKAZKOU : ZAKLADNI
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const korenRef = useRef<HTMLElement | null>(null)
  const current = searchParams.get("step") ?? "address"

  const prvni = useRef(true)
  useEffect(() => {
    if (prvni.current) {
      prvni.current = false
      return
    }
    /* Jen když je hlavička kroku nad obrazovkou, a bez přejezdu (13. 11. 2026,
       Matěj: „scroll v pokladně zase cuká"). Dřív se na každý krok plynule
       rolovalo k bublinkám, i když byly vidět. */
    const koren = korenRef.current
    if (koren && koren.getBoundingClientRect().top < 0) {
      scrollWithLenis(koren, { immediate: true })
    }
  }, [current])

  const currentIndex = Math.max(
    0,
    STEPS.findIndex((step) => step.key === current)
  )
  const active = STEPS[currentIndex]

  return (
    <nav className={s.root} ref={korenRef} aria-label="Kroky pokladny">
      <ol className={s.list}>
        {STEPS.map((step, index) => {
          const done = index < currentIndex
          const isCurrent = index === currentIndex

          return (
            <li
              key={step.key}
              className={s.item}
              data-state={done ? "done" : isCurrent ? "current" : "todo"}
            >
              {done ? (
                <button
                  type="button"
                  className={s.bubble}
                  onClick={() =>
                    router.push(`${pathname}?step=${step.key}`, {
                      scroll: false,
                    })
                  }
                  aria-label={`Zpět na krok ${index + 1}: ${step.label}`}
                >
                  {index + 1}
                </button>
              ) : (
                <span
                  className={s.bubble}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Krok ${index + 1}: ${step.label}`}
                >
                  {index + 1}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {/* Číslo samo neřekne, kde jste — jméno kroku ano. Jedno, ne čtyři:
          čtyři popisky vedle sebe se na 430px nevejdou čitelně. */}
      {/* Číslo, název i věta kroku přímo ve formuláři (13. 11. 2026) — levý
          sloupec s „Ještě pár kroků" a seznamem kroků je pryč. */}
      <div className={s.current}>
        <p className={s.label}>
          <span>
            {String(currentIndex + 1).padStart(2, "0")}/{String(STEPS.length).padStart(2, "0")}
          </span>
          {active.label}
        </p>
        {POPIS_KROKU[active.key] && (
          <p className={s.desc}>{POPIS_KROKU[active.key]}</p>
        )}
      </div>
    </nav>
  )
}
