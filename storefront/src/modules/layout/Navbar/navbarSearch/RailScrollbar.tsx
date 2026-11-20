"use client"

import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import styles from "./style.module.scss"

/**
 * Vodorovný posuvník pásu výsledků (20. 11. 2026, Matěj: „tady použij náš
 * posuvník"). Nativní lišta pásu ukazovala na Windows šipky a šedou dráhu,
 * které na webu jinde nejsou. Tahle je ve stejné řeči jako svislá lišta
 * stránky (modules/layout/scrollbar): vlásek dráhy, v něm pilulka, jejíž
 * ŠÍŘKA říká, jak velký kus pásu je vidět, a POLOHA, kde jsme. Po najetí
 * zesílí, dá se chytit a táhnout, klik do dráhy pás plynule přesune.
 *
 * Polohu pásu dál drží `useDragScroll` — tady se čte `scrollLeft`, při
 * tažení úchopu se zapisuje přímo (posluchač `scroll` si pružinu srovná)
 * a klik do dráhy posílá `kz:rail-glide`, ať pás dojede pružinou.
 */
const NEJMENSI_UCHOP = 48

type Mira = { draha: number; uchop: number; rozsah: number }

export function RailScrollbar({
  railRef,
  watch,
}: {
  railRef: RefObject<HTMLDivElement | null>
  /** Změna obsahu pásu (jiné výsledky) — přeměřit. */
  watch: unknown
}) {
  const drahaRef = useRef<HTMLDivElement | null>(null)
  const uchopRef = useRef<HTMLDivElement | null>(null)
  const miraRef = useRef<Mira>({ draha: 0, uchop: 0, rozsah: 0 })
  const tahRef = useRef<{ odsazeni: number } | null>(null)
  const snimekRef = useRef<number | null>(null)
  const [mira, setMira] = useState<Mira>({ draha: 0, uchop: 0, rozsah: 0 })
  const [taha, setTaha] = useState(false)

  const vykresli = useCallback(() => {
    snimekRef.current = null
    const rail = railRef.current
    const uchop = uchopRef.current
    const { draha, uchop: sirka, rozsah } = miraRef.current
    if (!rail || !uchop || rozsah <= 0) return
    const podil = Math.min(1, Math.max(0, rail.scrollLeft / rozsah))
    uchop.style.transform = `translate3d(${podil * (draha - sirka)}px, 0, 0)`
  }, [railRef])

  const premer = useCallback(() => {
    const rail = railRef.current
    const draha = drahaRef.current?.clientWidth ?? 0
    if (!rail || !draha) return
    const rozsah = Math.max(0, rail.scrollWidth - rail.clientWidth)
    const uchop = rozsah
      ? Math.max(NEJMENSI_UCHOP, Math.round((rail.clientWidth / rail.scrollWidth) * draha))
      : 0
    const dalsi = { draha, uchop, rozsah }
    miraRef.current = dalsi
    setMira((stara) =>
      stara.draha === draha && stara.uchop === uchop && stara.rozsah === rozsah ? stara : dalsi
    )
    vykresli()
  }, [railRef, vykresli])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const naPosun = () => {
      if (snimekRef.current == null) snimekRef.current = requestAnimationFrame(vykresli)
    }
    rail.addEventListener("scroll", naPosun, { passive: true })
    let pozorovatel: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      pozorovatel = new ResizeObserver(premer)
      pozorovatel.observe(rail)
      if (rail.firstElementChild) pozorovatel.observe(rail.firstElementChild)
      if (drahaRef.current) pozorovatel.observe(drahaRef.current)
    }
    /* Výsledky vjíždějí s animací — přeměřit i po ní. */
    premer()
    const pozde = window.setTimeout(premer, 700)
    return () => {
      rail.removeEventListener("scroll", naPosun)
      pozorovatel?.disconnect()
      window.clearTimeout(pozde)
      if (snimekRef.current != null) cancelAnimationFrame(snimekRef.current)
      snimekRef.current = null
    }
  }, [railRef, premer, vykresli, watch])

  /* Poloha ukazatele v dráze → scrollLeft pásu. */
  const posunNa = (x: number, odsazeni: number, plynule: boolean) => {
    const rail = railRef.current
    const draha = drahaRef.current
    const { draha: sirkaDrahy, uchop, rozsah } = miraRef.current
    if (!rail || !draha || !rozsah) return
    const volno = Math.max(1, sirkaDrahy - uchop)
    const podil = Math.min(1, Math.max(0, (x - draha.getBoundingClientRect().left - odsazeni) / volno))
    const cil = podil * rozsah
    /* Plynule přes pružinu useDragScroll (viz `kz:rail-glide` tam). */
    if (plynule) rail.dispatchEvent(new CustomEvent("kz:rail-glide", { detail: cil }))
    else rail.scrollLeft = cil
  }

  const naStisk = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const uchop = uchopRef.current
    const naUchopu = uchop && event.target instanceof Node && uchop.contains(event.target)
    if (naUchopu) {
      const odsazeni = event.clientX - uchop.getBoundingClientRect().left
      tahRef.current = { odsazeni }
      setTaha(true)
      event.currentTarget.setPointerCapture?.(event.pointerId)
      return
    }
    /* Klik do dráhy: pás dojede tak, aby úchop stál středem pod ukazatelem. */
    posunNa(event.clientX, miraRef.current.uchop / 2, true)
  }

  const naPohyb = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!tahRef.current) return
    posunNa(event.clientX, tahRef.current.odsazeni, false)
  }

  const naPusteni = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!tahRef.current) return
    tahRef.current = null
    setTaha(false)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  return (
    <div
      ref={drahaRef}
      className={styles.railBar}
      data-vidi={mira.rozsah > 0 ? "ano" : "ne"}
      data-taha={taha ? "ano" : undefined}
      aria-hidden="true"
      onPointerDown={naStisk}
      onPointerMove={naPohyb}
      onPointerUp={naPusteni}
      onPointerCancel={naPusteni}
    >
      <div ref={uchopRef} className={styles.railThumb} style={{ width: mira.uchop || undefined }} />
    </div>
  )
}
