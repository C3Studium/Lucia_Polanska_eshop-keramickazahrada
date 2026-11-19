"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import s from "./style.module.scss"
import { checkoutSteps } from "@lib/util/checkout-steps"

/**
 * Kroky pokladny jako seznam s popisem — vlevo vedle formuláře, jen na
 * širokém okně (13. 11. 2026).
 *
 * Vzor je poptávkový formulář zakázky (vyroba/InquiryForm): vlevo očíslované
 * „Poptávka · Nabídka · Potvrzení · Výroba" s větou ke každému, vpravo světlý
 * panel. Majitelka ho označila za nejpřehlednější kus webu, a pokladna má být
 * přehledná i pro starší zákazníky: kolikátý krok to je, co v něm čeká a co
 * přijde potom, to musí být vidět bez přemýšlení.
 *
 * Bublinky nad formulářem (`step-bubbles`) zůstávají: na telefonu je tenhle
 * seznam schovaný a pořadí nesou ony. Krok se čte z adresy (`?step=`) jako
 * všude v pokladně; hotové kroky jsou tlačítka zpět, stejně jako bublinky.
 */
/* Kroky podle košíku — jedno pravidlo s bublinkami (lib/util/checkout-steps). */
export default function CheckoutStepList({ items }: { items?: readonly unknown[] | null }) {
  const STEPS = checkoutSteps(items)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get("step") ?? "address"
  const currentIndex = Math.max(0, STEPS.findIndex((step) => step.key === current))

  return (
    <ol className={s.root} aria-label="Kroky pokladny">
      {STEPS.map((step, index) => {
        const done = index < currentIndex
        const isCurrent = index === currentIndex
        return (
          <li
            key={step.key}
            className={s.item}
            data-state={done ? "done" : isCurrent ? "current" : "todo"}
          >
            <span className={s.index} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className={s.body}>
              {done ? (
                <button
                  type="button"
                  className={`${s.title} ${s.titleButton}`}
                  onClick={() => router.push(`${pathname}?step=${step.key}`, { scroll: false })}
                  aria-label={`Zpět na krok ${index + 1}: ${step.label}`}
                >
                  {step.label}
                </button>
              ) : (
                <h3 className={s.title} aria-current={isCurrent ? "step" : undefined}>
                  {step.label}
                </h3>
              )}
              <p className={s.desc}>{step.text}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
