"use client"

import { cancelFrame, frame } from "framer-motion"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import styles from "./style.module.scss"

/**
 * Pruhy vedle 16:9 rámu na ultrawide — v barvě stránky, ne černé (9. 11. 2026).
 *
 * Obsah zůstává v rámu (globals.scss, `.pageFrame`), ale pozadí má jít přes celou obrazovku.
 * Protáhnout pozadí každé sekce v CSS nejde: skoro každá sedí v rodiči s `overflow: clip`
 * (hlídá vodorovný scroll animací) a půlka mění barvu se scrollem přes framer-motion.
 *
 * Proto se pruhy malují zvenku: u levé a pravé hrany rámu se v N bodech zjistí, co tam je
 * za pozadí (`elementsFromPoint`, barva složená přes průhlednost a průhlednost předků),
 * stejné body se sloučí do úseků a hranice úseku se vezme přesně z obdélníku prvku —
 * takže předěl sekcí v pruhu sedí na pixel s předělem v rámu. Svislé lineární přechody
 * (třeba tmavá → olivová na Výrobě) se kopírují s polohou prvku, kruhové odlesky ne.
 *
 * Měří se každý snímek při scrollu a chvíli po změně stránky, jinak jen čtyřikrát za sekundu
 * (jak přesně, aby pruh nezaostával o snímek, viz `tick` níž). Závěsy bez zásahu myši
 * (`pointer-events: none`) se dohledávají zvlášť, viz `collectOverlays`.
 * Mimo ultrawide komponenta nedělá nic: pruhy nejsou vidět a smyčka neběží.
 */

const FRAMED_QUERY = "(min-width: 1921px) and (min-aspect-ratio: 2 / 1)"
const SAMPLES = 16
const HOT_MS = 900
const IDLE_MS = 250
const MAX_SEGMENTS = SAMPLES

type Rgba = { r: number; g: number; b: number; a: number }

type Paint = {
  key: Element | null
  color: string
  image: { css: string; top: number; height: number } | null
  /** Viditelný svislý rozsah prvku (po clip-path) — z něj se berou předěly úseků. */
  rect: { top: number; bottom: number } | null
}

type Segment = { top: number; bottom: number; paint: Paint }

function parseColor(value: string): Rgba | null {
  const m = value.match(/^rgba?\(([^)]+)\)$/)
  if (!m) return null
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 }
}

/** Jen svislé lineární vrstvy; kruhové odlesky a vodorovné přechody k hraně nepatří. */
function verticalLinearLayers(image: string): string | null {
  if (!image || image === "none") return null
  const layers: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < image.length; i++) {
    const ch = image[i]
    if (ch === "(") depth++
    else if (ch === ")") depth--
    else if (ch === "," && depth === 0) {
      layers.push(image.slice(start, i).trim())
      start = i + 1
    }
  }
  layers.push(image.slice(start).trim())
  const keep = layers.filter((layer) => {
    if (!layer.startsWith("linear-gradient(")) return false
    const head = layer.slice(16, layer.indexOf(",", 16)).trim()
    if (/^to (right|left)/.test(head)) return false
    const deg = head.match(/^(-?[\d.]+)deg$/)
    if (deg && Math.abs(Number(deg[1]) % 180) !== 0) return false
    return true
  })
  return keep.length ? keep.join(", ") : null
}

function hasBackground(s: CSSStyleDeclaration) {
  const c = parseColor(s.backgroundColor)
  return (c ? c.a > 0 : s.backgroundColor !== "transparent") || verticalLinearLayers(s.backgroundImage) !== null
}

/**
 * Vrstvy, které `elementsFromPoint` nevidí: `pointer-events: none` se při hledání zásahu
 * přeskakuje, a přesně tak jsou udělané dekorační závěsy přes celou scénu — třeba opona
 * `Collections__exitCurtain` na úvodu, která vyjíždí zdola přes `clip-path`. Projít celý
 * strom stylů každý snímek by stálo moc, takže se kandidáti (přes celou šířku rámu, s vlastním
 * pozadím) hledají jen občas a každý snímek se u nich jen přepočítá viditelná část.
 */
function collectOverlays(frameEl: Element): Element[] {
  const frameW = frameEl.getBoundingClientRect().width
  const found: Element[] = []
  for (const el of Array.from(frameEl.querySelectorAll("*"))) {
    // Šířka napřed: obdélník je po rozvržení levný, styl každého prvku ne.
    if (el.getBoundingClientRect().width < frameW - 2) continue
    const s = getComputedStyle(el)
    if (s.pointerEvents !== "none" || s.display === "none") continue
    if (hasBackground(s)) found.push(el)
  }
  return found
}

type Box = { left: number; right: number; top: number; bottom: number }

/** Co z obdélníku prvku nechá jeho vlastní `clip-path: inset(…)`; null = jiný tvar ořezu. */
function ownClip(s: CSSStyleDeclaration, box: DOMRect): Box | null {
  const clip = s.clipPath
  if (!clip || clip === "none") return box
  const m = clip.match(/^inset\(([^)]*)\)$/)
  if (!m) return null
  const parts = m[1].split(/\s+round\s+/)[0].trim().split(/\s+/)
  const len = (v: string | undefined, size: number) => {
    if (!v) return 0
    if (v.endsWith("%")) return (parseFloat(v) / 100) * size
    return parseFloat(v) || 0
  }
  // inset(T [R [B [L]]]) — jako margin: chybějící R je T, B je T, L je R.
  const t = parts[0]
  const r = parts[1] ?? t
  const b = parts[2] ?? t
  const l = parts[3] ?? r
  return {
    left: box.left + len(l, box.width),
    right: box.right - len(r, box.width),
    top: box.top + len(t, box.height),
    bottom: box.bottom - len(b, box.height),
  }
}

type Layer = { el: Element; s: CSSStyleDeclaration; top: number; bottom: number; box: DOMRect }

/**
 * Mezipaměť jednoho měření (obě strany, všechny body). Styly a obdélníky se mezi body
 * opakují — zásobník pod hranou je skoro pořád tentýž řetěz předků — takže se čtou jednou.
 */
type Pass = ReturnType<typeof makePass>

function makePass() {
  const styleCache = new Map<Element, CSSStyleDeclaration>()
  const opacityCache = new Map<Element, number>()
  const style = (el: Element) => {
    let s = styleCache.get(el)
    if (!s) {
      s = getComputedStyle(el)
      styleCache.set(el, s)
    }
    return s
  }
  /**
   * Viditelný obdélník po ořezech: vlastní clip-path a pak každý předek s overflow jiným než
   * visible nebo s clip-path. Bez předků by se do pruhu dostal třeba závoj fotky v heru,
   * který je přes celou šířku, ale rodič ho clip-path stahuje o 2,5 % od hran.
   */
  const visibleCache = new Map<Element, Box | null>()
  const visible = (el: Element): Box | null => {
    if (el === document.body || el === document.documentElement) {
      return { left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity }
    }
    if (visibleCache.has(el)) return visibleCache.get(el)!
    const s = style(el)
    let own: Box | null = s.visibility === "hidden" ? null : ownClip(s, el.getBoundingClientRect())
    const parent = el.parentElement
    if (own && parent) {
      const outer = clipFromAncestors(parent)
      own = outer
        ? {
            left: Math.max(own.left, outer.left),
            right: Math.min(own.right, outer.right),
            top: Math.max(own.top, outer.top),
            bottom: Math.min(own.bottom, outer.bottom),
          }
        : null
    }
    if (own && (own.right <= own.left || own.bottom <= own.top)) own = null
    visibleCache.set(el, own)
    return own
  }
  /** Ořez, který na své potomky uplatní `el` a jeho předci. */
  const ancestorCache = new Map<Element, Box | null>()
  const clipFromAncestors = (el: Element): Box | null => {
    if (el === document.body || el === document.documentElement) {
      return { left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity }
    }
    if (ancestorCache.has(el)) return ancestorCache.get(el)!
    const s = style(el)
    const clips = s.clipPath !== "none" || s.overflowX !== "visible" || s.overflowY !== "visible"
    const outer = el.parentElement ? clipFromAncestors(el.parentElement) : null
    let result: Box | null = outer
    if (clips && outer) {
      const box = el.getBoundingClientRect()
      const own = ownClip(s, box) ?? box
      // overflow ořezává jen v ose, kde není visible.
      const cx = s.clipPath !== "none" || s.overflowX !== "visible"
      const cy = s.clipPath !== "none" || s.overflowY !== "visible"
      result = {
        left: cx ? Math.max(outer.left, own.left) : outer.left,
        right: cx ? Math.min(outer.right, own.right) : outer.right,
        top: cy ? Math.max(outer.top, own.top) : outer.top,
        bottom: cy ? Math.min(outer.bottom, own.bottom) : outer.bottom,
      }
    }
    ancestorCache.set(el, result)
    return result
  }

  const opacity = (el: Element | null): number => {
    if (!el || el === document.body || el === document.documentElement) return 1
    const hit = opacityCache.get(el)
    if (hit !== undefined) return hit
    const value = Number(style(el).opacity) * opacity(el.parentElement)
    opacityCache.set(el, value)
    return value
  }

  const rectCache = new Map<Element, DOMRect>()
  const rect = (el: Element) => {
    let r = rectCache.get(el)
    if (!r) {
      r = el.getBoundingClientRect()
      rectCache.set(el, r)
    }
    return r
  }

  return { style, visible, opacity, rect }
}

function sampleColumn(x: number, ys: number[], vw: number, overlays: Element[], pass: Pass): Segment[] {
  const { style, visible, opacity, rect: rectOf } = pass

  // Závěsy bez zásahu: změřit jednou za průchod, ne v každém bodě.
  const overlayLayers: Layer[] = []
  for (const el of overlays) {
    if (!el.isConnected) continue
    const v = visible(el)
    if (!v || v.left > x || v.right <= x) continue
    overlayLayers.push({ el, s: style(el), box: rectOf(el), top: v.top, bottom: v.bottom })
  }

  const paints: Paint[] = ys.map((y) => {
    // Složení "přes": premultiplikované součty shora dolů, dokud vrstva není neprůhledná.
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    let key: Element | null = null
    let rect: Paint["rect"] = null
    let image: Paint["image"] = null
    let raw: string | null = null

    // Závěsy jsou dekorace PŘES sekci, takže jdou navrch zásahového zásobníku. Zásobník se
    // prochází líně: drtivá většina prvků v něm pozadí nemá a obdélník ani ořez nepotřebuje.
    const stack: Element[] = []
    for (const l of overlayLayers) if (l.top <= y && l.bottom > y) stack.push(l.el)
    for (const el of document.elementsFromPoint(x, y)) {
      if (el === document.body || el === document.documentElement) break
      stack.push(el)
    }

    for (const el of stack) {
      const s = style(el)
      const layers = verticalLinearLayers(s.backgroundImage)
      const parsed = parseColor(s.backgroundColor)
      const unknown = !parsed && s.backgroundColor !== "transparent" ? s.backgroundColor : null
      if (!layers && !unknown && (!parsed || parsed.a === 0)) continue

      const box = rectOf(el)
      // Závoje dialogů přes celé okno zatmívají pruhy samy — nepřebírat je ještě jednou.
      if (s.position === "fixed" && box.width >= vw - 1) continue
      const op = opacity(el)
      if (op <= 0.01) continue

      if (!key) {
        key = el
        // Zásah už ořezy respektuje; viditelný rozsah je tu kvůli přesným předělům úseků.
        const v = visible(el) ?? box
        rect = { top: v.top, bottom: v.bottom }
      }
      if (layers && !image && a < 0.99) {
        image = { css: layers, top: box.top, height: box.height }
      }
      if (unknown) {
        // Barva v zápisu, který neumíme složit (oklch, color-mix) — vezmeme ji, jak je.
        if (a === 0) raw = unknown
        break
      }
      if (parsed && parsed.a > 0) {
        const ca = parsed.a * op
        const k = (1 - a) * ca
        r += parsed.r * k
        g += parsed.g * k
        b += parsed.b * k
        a += k
        if (a >= 0.99) break
      }
    }

    const color =
      raw ??
      (a > 0
        ? `rgba(${Math.round(r / a)}, ${Math.round(g / a)}, ${Math.round(b / a)}, ${Math.min(1, +a.toFixed(3))})`
        : "transparent")
    return { key, color, image, rect }
  })

  const same = (p: Paint, q: Paint) =>
    p.key === q.key && p.color === q.color && (p.image?.css ?? "") === (q.image?.css ?? "")

  // Úseky: shodné sousední body se slijí; předěl se vezme z obdélníku prvku, ne z půlky mezi body.
  const segments: Segment[] = []
  for (let i = 0; i < paints.length; i++) {
    const p = paints[i]
    const last = segments[segments.length - 1]
    if (last && same(last.paint, p)) continue
    let top = 0
    if (last) {
      const yPrev = ys[i - 1]
      const yHere = ys[i]
      const prevRect = last.paint.rect
      if (p.rect && p.rect.top > yPrev && p.rect.top <= yHere) top = p.rect.top
      else if (prevRect && prevRect.bottom >= yPrev && prevRect.bottom < yHere) top = prevRect.bottom
      else top = (yPrev + yHere) / 2
      last.bottom = top
    }
    segments.push({ top, bottom: Infinity, paint: p })
  }
  return segments
}

function render(container: HTMLDivElement, segments: Segment[], vh: number, cache: { sig: string }) {
  const sig = segments
    .map((s) => `${Math.round(s.top)}|${s.paint.color}|${s.paint.image ? `${s.paint.image.css}@${Math.round(s.paint.image.top)}:${Math.round(s.paint.image.height)}` : ""}`)
    .join(";")
  if (sig === cache.sig) return
  cache.sig = sig

  const kids = container.children
  for (let i = 0; i < MAX_SEGMENTS; i++) {
    const node = kids[i] as HTMLElement | undefined
    if (!node) break
    const seg = segments[i]
    if (!seg) {
      if (node.style.display !== "none") node.style.display = "none"
      continue
    }
    const top = Math.max(0, Math.round(seg.top))
    const bottom = Math.min(vh, seg.bottom === Infinity ? vh : Math.round(seg.bottom))
    const st = node.style
    st.display = "block"
    st.top = `${top}px`
    st.height = `${Math.max(0, bottom - top)}px`
    st.backgroundColor = seg.paint.color
    if (seg.paint.image) {
      st.backgroundImage = seg.paint.image.css
      st.backgroundSize = `100% ${Math.round(seg.paint.image.height)}px`
      st.backgroundPosition = `0 ${Math.round(seg.paint.image.top - top)}px`
    } else if (st.backgroundImage) {
      st.backgroundImage = ""
    }
  }
}

export default function FrameBands() {
  const pathname = usePathname()
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const hotUntil = useRef(0)
  const scanDue = useRef(true)

  // Nová stránka: chvíli měřit každý snímek, než se usadí vjezdy a barvy, a párkrát znovu
  // dohledat závěsy (líně načtené sekce přibývají ještě pár sekund po příchodu).
  useEffect(() => {
    hotUntil.current = performance.now() + 2000
    scanDue.current = true
    const timers = [400, 1500, 4000].map((ms) => window.setTimeout(() => (scanDue.current = true), ms))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [pathname])

  useEffect(() => {
    const query = window.matchMedia(FRAMED_QUERY)
    let running = false
    let lastIdle = 0
    const leftCache = { sig: "" }
    const rightCache = { sig: "" }
    let detachLenis: (() => void) | null = null
    let overlays: Element[] = []

    const sample = () => {
      const left = leftRef.current
      const right = rightRef.current
      const frameEl = document.querySelector(".pageFrame")
      if (!left || !right || !frameEl) return
      if (scanDue.current) {
        scanDue.current = false
        overlays = collectOverlays(frameEl)
      }
      const pass = makePass()
      const f = pass.rect(frameEl)
      const vw = window.innerWidth
      const vh = window.innerHeight
      const ys = Array.from({ length: SAMPLES }, (_, i) => ((i + 0.5) * vh) / SAMPLES)
      render(left, sampleColumn(f.left + 1, ys, vw, overlays, pass), vh, leftCache)
      render(right, sampleColumn(f.right - 2, ys, vw, overlays, pass), vh, rightCache)
    }

    const heat = () => {
      hotUntil.current = Math.max(hotUntil.current, performance.now() + HOT_MS)
    }
    const onResize = () => {
      heat()
      scanDue.current = true
    }

    /*
     * Kdy měřit, aby pruh nebyl o snímek pozadu. Ve snímku se dějí dvě věci, obě v rAF:
     * Lenis posune stránku a framer-motion zapíše barvy, průhlednosti a ořezy. Když Lenis
     * jede, měří se v jeho `scroll` (hned po posunu — poloha předělů sedí na pixel); jinak
     * v kroku `postRender` framer-motion, po zápisu všech hodnot. Vždy jen jednou za snímek:
     * měření stojí ~1 ms a dvakrát za snímek už bylo na úvodu znát (změřeno 9. 11.).
     *
     * Lenis vzniká v efektu LenisProvideru, který běží AŽ po tomhle (efekty potomků jdou
     * první), takže se připojuje ze smyčky, jakmile existuje.
     */
    let attachedTo: typeof window.lenis | null = null
    const onLenis = () => {
      heat()
      sample()
    }
    const attachLenis = () => {
      const lenis = window.lenis ?? null
      if (lenis === attachedTo) return
      detachLenis?.()
      detachLenis = null
      attachedTo = lenis
      if (lenis) {
        lenis.on("scroll", onLenis)
        detachLenis = () => lenis.off("scroll", onLenis)
      }
    }

    const tick = () => {
      attachLenis()
      // Tenhle snímek měří Lenis `scroll`.
      if (attachedTo?.isScrolling) return
      const now = performance.now()
      if (now < hotUntil.current || now - lastIdle > IDLE_MS) {
        if (now >= hotUntil.current) lastIdle = now
        sample()
      }
    }

    const start = () => {
      if (running) return
      running = true
      heat()
      window.addEventListener("scroll", heat, { passive: true })
      window.addEventListener("resize", onResize)
      frame.postRender(tick, true)
    }

    const stop = () => {
      if (!running) return
      running = false
      cancelFrame(tick)
      window.removeEventListener("scroll", heat)
      window.removeEventListener("resize", onResize)
      detachLenis?.()
      detachLenis = null
      attachedTo = null
      leftCache.sig = ""
      rightCache.sig = ""
    }

    const sync = () => (query.matches ? start() : stop())
    sync()
    query.addEventListener("change", sync)
    return () => {
      query.removeEventListener("change", sync)
      stop()
    }
  }, [])

  const slots = Array.from({ length: MAX_SEGMENTS }, (_, i) => <div key={i} className={styles.segment} />)
  return (
    <>
      <div ref={leftRef} aria-hidden="true" className={`${styles.band} ${styles.left}`}>
        {slots}
      </div>
      <div ref={rightRef} aria-hidden="true" className={`${styles.band} ${styles.right}`}>
        {slots}
      </div>
    </>
  )
}
