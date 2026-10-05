import type { ReactNode } from "react"

import s from "./style.module.scss"

type OrderBriefRailProps = {
  /** The brief / diary to show in the right rail — e.g. `OrderCommissionDiary`. */
  children: ReactNode
  /** Optional uppercase kicker above the brief (e.g. a section number). */
  label?: string
  /** Accessible name for the region. */
  ariaLabel?: string
  /** Extra class on the wrapper, for per-page spacing tweaks. */
  className?: string
}

/**
 * Pravý sloupec objednávky: brief / deník zakázky POD souhrnem — přesně jako
 * v checkoutu sedí brief pod přehledem. Obal jen umístí a odsadí; vlastní
 * povrch (krémová karta s linkou vlevo) si nese sám brief — `CommissionBrief`
 * ve variantě „order" —, takže se tu přes něj nekreslí druhá karta.
 *
 * Záměrně generické: obsah bere jako `children`, aby stejný vzor mohly
 * převzít i stránky úpravy / vrácení objednávky.
 */
export default function OrderBriefRail({
  children,
  label,
  ariaLabel = "Zakázková výroba",
  className,
}: OrderBriefRailProps) {
  return (
    <section
      className={className ? `${s.root} ${className}` : s.root}
      aria-label={ariaLabel}
    >
      {label ? <span className={s.kicker}>{label}</span> : null}
      {children}
    </section>
  )
}
