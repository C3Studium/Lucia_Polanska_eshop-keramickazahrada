"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import s from "./style.module.scss"

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
 */
const STEPS = [
  { key: "address", label: "Adresa" },
  { key: "delivery", label: "Doručení" },
  { key: "payment", label: "Platba" },
  { key: "review", label: "Přehled" },
] as const

export default function CheckoutStepBubbles() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const current = searchParams.get("step") ?? "address"
  const currentIndex = Math.max(
    0,
    STEPS.findIndex((step) => step.key === current)
  )
  const active = STEPS[currentIndex]

  return (
    <nav className={s.root} aria-label="Kroky pokladny">
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
      <p className={s.label}>
        <span>
          {currentIndex + 1}/{STEPS.length}
        </span>
        {active.label}
      </p>
    </nav>
  )
}
