"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import s from "./pick.module.scss"

/** Vyměňovaný řádek v mini obchodě (§3d.10) — z katalogu `?swap=`. */
export type PickSwapInfo = {
  itemId: string
  title: string
  quantity: number
  /** Po zabalení jen výrobky ve stejné ceně. */
  samePriceOnly: boolean
}

/**
 * Lišta nad mini obchodem a nad stránkou produktu v režimu výběru —
 * „Vybíráte do objednávky #N" (přidání) nebo „Vybíráte náhradu za: …"
 * (výměna za jiný výrobek) · Zpět na úpravu. Říká, že tohle NENÍ běžný
 * obchod (nic se tu nekupuje, volba jde do návrhu úpravy), a vede zpátky.
 */
export default function PickBar({
  orderNumber,
  swap = null,
  editHref,
  shopHref,
  tone = "light",
}: {
  orderNumber: number
  /** Výměna řádku za jiný výrobek; `null` = přidání kusu. */
  swap?: PickSwapInfo | null
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
        {swap ? (
          <>
            Vybíráte náhradu za: <strong>{swap.title}</strong> ({swap.quantity}{" "}
            ks)
            {swap.samePriceOnly && " · jen stejná cena"}
          </>
        ) : (
          <>
            Vybíráte do objednávky <strong>#{orderNumber}</strong>
          </>
        )}
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
