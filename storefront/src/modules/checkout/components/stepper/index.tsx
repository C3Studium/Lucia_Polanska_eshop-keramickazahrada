"use client"

import type { ReactNode } from "react"
import { useSearchParams } from "next/navigation"

/**
 * Pokladna po krocích, ne jako jeden dlouhý sloupec.
 *
 * ## Proč
 *
 * Do 8. 11. 2026 stály všechny čtyři kroky pod sebou: otevřený ukazoval
 * formulář, zavřené svoje shrnutí. Na širokém okně z toho byla stránka přes
 * tři obrazovky, pravý sloupec se souhrnem k ní neseděl výškou a na telefonu
 * se mezi kroky muselo rolovat naslepo. Majitelka to popsala přesně: ať to
 * je jako v účtu — jedna věc na obrazovce a očíslovaná cesta nahoře.
 *
 * ## Jak
 *
 * Krok už se dřív držel v adrese (`?step=`), takže se nic nového nevymýšlí:
 * tahle komponenta jen vykreslí ten, který je na řadě. Ostatní se
 * NEVYKRESLÍ vůbec — ne schovají přes CSS: zavřený krok si jinak drží svůj
 * stav, dotazy i platební relaci a to je přesně ten druh věcí, který se pak
 * probudí ve špatnou chvíli.
 *
 * Kroky samy zůstaly beze změny; každý si dál čte z adresy, jestli je
 * otevřený. Tahle vrstva jim jen přestala dávat prostor, když nejsou.
 */

export type CheckoutStepKey =
  | "address"
  | "delivery"
  | "brief"
  | "payment"
  | "review"

export const CHECKOUT_STEPS: { key: CheckoutStepKey; label: string }[] = [
  { key: "address", label: "Adresa" },
  { key: "delivery", label: "Doručení" },
  { key: "payment", label: "Platba" },
  { key: "review", label: "Přehled" },
]

export default function CheckoutSteps({
  address,
  delivery,
  brief,
  payment,
  review,
}: {
  address: ReactNode
  delivery: ReactNode
  /** Zadání zakázky — jen když je v košíku. Jinak krok neexistuje. */
  brief?: ReactNode
  payment: ReactNode
  review: ReactNode
}) {
  const searchParams = useSearchParams()
  const step = (searchParams.get("step") ?? "address") as CheckoutStepKey

  /*
   * Neznámý krok z ručně upravené adresy spadne na první. Prázdná stránka by
   * vypadala jako porucha obchodu, ne jako překlep v adrese.
   */
  const obsah: Record<CheckoutStepKey, ReactNode> = {
    address,
    delivery,
    /* Bez zakázky v košíku krok neexistuje — adresa s `?step=brief` pak
       spadne na první krok, ne na prázdnou stránku. */
    brief: brief ?? null,
    payment,
    review,
  }

  return <>{obsah[step] || address}</>
}
