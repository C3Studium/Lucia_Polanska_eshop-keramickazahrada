"use client"

import { MotionConfig } from "framer-motion"
import { createContext, useContext, type ReactNode } from "react"

/**
 * Obchod, výrobek, košík a pokladna bez pohybových animací — na VŠECH zařízeních.
 *
 * 13. 11. 2026, těsně před předáním: majitel chce e-shop jednoduchý a
 * přehledný i pro starší zákazníky. Žádné vjezdy karet, přejezdy tlačítek
 * do černé ani nájezdy panelů — jen obsah, který stojí na místě. Zbytek webu
 * (úvod, Kurzy, Výroba…) si své animace nechává.
 *
 * Dvě cesty, jedna hranice:
 * - framer: `reducedMotion="always"` přeskočí všechny transformace a layout
 *   animace, nechá jen průhlednost;
 * - CSS a tlačítka: atribut `data-shop-plain` na obalu a kontext
 *   `usePlainShop()`. Styly modulů uvnitř vypínají keyframes, přechody
 *   a ozdobné rámy pravidlem `:global([data-shop-plain]) …`; tlačítko
 *   (`premium-action-button`) se podle kontextu vykreslí bez přejezdu.
 *
 * Nahrazuje `TouchSimpleMotion` z téhož dne, který totéž dělal jen na dotyku.
 */
const PlainShopContext = createContext(false)

/** Jsme uvnitř obchodu, košíku nebo pokladny? */
export const usePlainShop = () => useContext(PlainShopContext)

export default function PlainShop({ children }: { children: ReactNode }) {
  return (
    <PlainShopContext.Provider value={true}>
      <MotionConfig reducedMotion="always">
        <div data-shop-plain style={{ display: "contents" }}>
          {children}
        </div>
      </MotionConfig>
    </PlainShopContext.Provider>
  )
}
