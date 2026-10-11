"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import s from "./pick.module.scss"

/**
 * „Vybíráte do objednávky #N · Zpět na úpravu" — lišta nad mini obchodem
 * a nad stránkou produktu v režimu výběru. Říká, že tohle NENÍ běžný obchod
 * (nic se tu nekupuje, kus jde do návrhu úpravy), a vede zpátky.
 */
export default function PickBar({
  orderNumber,
  editHref,
  shopHref,
  tone = "light",
}: {
  orderNumber: number
  /** Stránka úpravy (bez kódu země). */
  editHref: string
  /** Výpis mini obchodu — jen na stránce produktu. */
  shopHref?: string
  /** `dark` na tmavé stránce produktu, `light` na krémovém výpisu. */
  tone?: "light" | "dark"
}) {
  return (
    <nav className={s.bar} data-tone={tone} aria-label="Výběr do objednávky">
      <p className={s.label}>
        Vybíráte do objednávky <strong>#{orderNumber}</strong>
      </p>
      <div className={s.links}>
        {shopHref && (
          <LocalizedClientLink className={s.link} href={shopHref}>
            Zpět do výběru
          </LocalizedClientLink>
        )}
        <LocalizedClientLink className={s.link} data-primary="" href={editHref}>
          <i aria-hidden="true">←</i>
          <span>Zpět na úpravu</span>
        </LocalizedClientLink>
      </div>
    </nav>
  )
}
