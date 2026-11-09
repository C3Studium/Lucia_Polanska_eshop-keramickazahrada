"use client"

import { createContext, useContext, type ReactNode } from "react"

import {
  TEXTY_DEFAULTS,
  type ShopTextKey,
  type ShopTexty,
} from "@lib/constants/texty"

/**
 * Texty obchodu pro KLIENTSKÉ komponenty — stránka výrobku, košík, pokladna,
 * hotová objednávka.
 *
 * Načte je na serveru layout skupiny (`getTexty()`) a podá sem; komponenta si
 * je vezme `useTexty()`. Layouty jsou tři — hlavní web, pokladna a rychlý
 * nákup —, stejně jako u kontaktních e-mailů, a ze stejného důvodu: kořenový
 * layout tyhle věci nečte.
 *
 * Mimo poskytovatele platí výchozí znění z kódu, aby komponenta nikdy
 * nevykreslila prázdno.
 */
const TextyContext = createContext<ShopTexty | null>(null)

export function TextyProvider({
  texty,
  children,
}: {
  texty: ShopTexty
  children: ReactNode
}) {
  return <TextyContext.Provider value={texty}>{children}</TextyContext.Provider>
}

export const useTexty = (): ShopTexty =>
  useContext(TextyContext) ?? TEXTY_DEFAULTS

/** Jedna věta. Prázdná znamená „neukazovat" — volající ji pak vynechá. */
export const useText = (key: ShopTextKey): string => useTexty()[key] ?? ""
