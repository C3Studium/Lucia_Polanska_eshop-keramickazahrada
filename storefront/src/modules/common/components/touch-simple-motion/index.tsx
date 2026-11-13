"use client"

import { MotionConfig } from "framer-motion"
import type { ReactNode } from "react"

import { useCoarsePointer } from "@lib/hooks/use-coarse-pointer"

/**
 * Obchod, výrobek, košík a pokladna na dotyku bez pohybových animací (13. 11. 2026).
 *
 * Přání majitele před předáním: na telefonu v e-shopu nemají být přejezdy,
 * vjezdy karet ani přebarvování tlačítek do černé — jen obsah. Framer při
 * `reducedMotion="always"` přeskočí všechny transformace a layout animace
 * (posuny, zvětšení, přejezd výplně tlačítek se přepne rovnou), ponechá jen
 * průhlednost. Na počítači s myší se nemění nic; „user" tam respektuje
 * systémové „omezit pohyb" jako dosud.
 */
export default function TouchSimpleMotion({ children }: { children: ReactNode }) {
  const coarse = useCoarsePointer()

  return (
    <MotionConfig reducedMotion={coarse ? "always" : "user"}>
      {children}
    </MotionConfig>
  )
}
