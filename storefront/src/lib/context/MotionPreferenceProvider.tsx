"use client"

import { MotionConfig, useReducedMotionConfig } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * Motion reductions are switched off site-wide, on purpose and for now.
 *
 * `reducedMotion="never"` stops framer applying its own automatic reductions inside every
 * `motion` component. Components that *ask* about the preference go through
 * `useSiteReducedMotion()` below.
 *
 * Why: the client could not see the site as designed, and half the reductions had grown into
 * the layout rather than staying decorative. The other two layers were removed alongside this
 * one: the `@include reduced-motion` block in globals.scss, and LenisProvider's early return.
 *
 * This is a stopgap and it is a real accessibility regression: a visitor who has asked their OS
 * for less motion now gets the full thing. To restore it, set this back to "user" — that alone
 * revives every one of the components that branch on `useSiteReducedMotion()`, because none of
 * their branches were deleted. The CSS layer and the Lenis gate would need putting back by hand.
 */
export default function MotionPreferenceProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <MotionConfig reducedMotion="never">{children}</MotionConfig>
}

/**
 * „Má se tady omezovat pohyb?" — jediná otázka, kterou smí komponenty klást.
 *
 * ## Proč ne `useReducedMotion()` z framer-motion přímo
 *
 * Ten hook **nekouká na `MotionConfig`**. Čte jen globální stav z `matchMedia`
 * (`utils/reduced-motion/use-reduced-motion.mjs`), takže `reducedMotion="never"` výš na něj
 * nedosáhne. Komentář nad providerem to roky tvrdil a nebyla to pravda: patnáct komponent se
 * dál ptalo operačního systému.
 *
 * A protože `matchMedia` na serveru není, vrací tam `null`, kdežto na stroji se zapnutým
 * „omezit pohyb" vrátí `true`. Komponenta pak vykreslí na serveru něco jiného než v prohlížeči
 * a React ohlásí nesoulad při hydrataci — naměřeno 13. 9. 2026 na macOS: hero vykreslil na
 * serveru `transform: translateY(115%)` a v prohlížeči `transform: none`, patička totéž
 * s `opacity`.
 *
 * ## Co dělá tenhle hook
 *
 * Dvě věci, které ten hook z frameru nedělá:
 *
 * 1. **Ptá se přes `useReducedMotionConfig()`**, který `MotionConfig` respektuje — takže
 *    dokud je nahoře „never", je odpověď `false` a přepínač konečně platí.
 * 2. **Při prvním vykreslení vrací vždy `false`**, na serveru i v prohlížeči. Skutečnou
 *    odpověď dá až po připojení. Server a první průchod klienta tak nemají jak se rozejít,
 *    ať má návštěvník v systému cokoli.
 *
 * Ten druhý bod je důležitý i do budoucna: až se přepínač vrátí na „user", nesmí se tím
 * hydratace znovu rozbít. Cena je jedno vykreslení navíc — zanedbatelná proti tiché chybě,
 * kterou vidí jen ten, kdo má omezení pohybu zapnuté.
 *
 * ## Co to neřeší
 *
 * `initial` čte framer jen při připojení, takže komponenta, která na téhle odpovědi staví
 * *výchozí* stav, ukáže návštěvníkovi s omezeným pohybem animaci i tak. Správně se v takové
 * komponentě větví `transition` (nulová doba), ne `initial`. Dnes je to nečinné — přepínač je
 * na „never" — ale při jeho návratu je to potřeba projít.
 */
export function useSiteReducedMotion(): boolean {
  const preference = useReducedMotionConfig()

  /* Až po připojení: do té doby se server i klient shodnou na „neomezovat". */
  const [pripojeno, setPripojeno] = useState(false)
  useEffect(() => setPripojeno(true), [])

  return pripojeno ? preference === true : false
}
