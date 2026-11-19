"use client"

import { sdk } from "@lib/config"
import { temaObchodu } from "@lib/navod/katalog"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"

/**
 * „?" v kroužku pro zákazníky (19. 11. 2026, Matěj). Stejné chování jako
 * v adminu: na počítači se okénko otevře najetím myši (krátká prodleva)
 * i klikem — klik ho připne; otevře se na straně, kde je víc místa, a tak
 * velké, aby byl GIF čitelný. Na telefonu (dotyk / úzké okno) vyjede
 * panel zespodu. Esc, × nebo klik vedle zavře.
 *
 * Barvy jsou vlastní (krémové okénko s tmavým textem), ať se okénko čte
 * stejně na tmavé pokladně i na světlých stránkách; otazník sám bere
 * barvu textu kolem sebe (`currentColor`).
 */

type Klip = { url: string; width?: number | null; height?: number | null }

/* Klipy jednou na stránku — všechny otazníky sdílí jeden dotaz. */
let klipyPromise: Promise<Record<string, Klip>> | null = null
const nactiKlipy = () => {
  klipyPromise ??= sdk.client
    .fetch<{ klipy: Record<string, Klip> }>("/store/navod/klipy")
    .then((r) => r.klipy ?? {})
    .catch(() => ({}))
  return klipyPromise
}

const OKRAJ = 16
const POMER = 825 / 1100

type Rozmer =
  | { druh: "okno"; left: number; top: number; width: number; maxHeight: number }
  | { druh: "panel" }

const spocitat = (kotva: DOMRect): Rozmer => {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const dotyk = window.matchMedia("(pointer: coarse)").matches
  if (dotyk || vw < 720) return { druh: "panel" }
  const vpravo = vw - kotva.right - OKRAJ * 2
  const vlevo = kotva.left - OKRAJ * 2
  const strop = Math.min(920, (vh - OKRAJ * 2 - 260) / POMER)
  const naBoku = Math.max(vpravo, vlevo)
  let width: number
  let left: number
  if (naBoku >= 420) {
    width = Math.max(380, Math.min(naBoku, strop))
    left = vpravo >= vlevo ? kotva.right + OKRAJ : kotva.left - OKRAJ - width
  } else {
    width = Math.max(340, Math.min(vw - OKRAJ * 2, strop))
    left = Math.min(Math.max(OKRAJ, kotva.left + kotva.width / 2 - width / 2), vw - OKRAJ - width)
  }
  /* Svisle: zarovnat ke středu otazníku, ale celé v okně. */
  const odhadVysky = Math.min(vh - OKRAJ * 2, width * POMER + 260)
  const top = Math.min(Math.max(OKRAJ, kotva.top + kotva.height / 2 - odhadVysky / 2), vh - OKRAJ - odhadVysky)
  return { druh: "okno", left, top, width, maxHeight: vh - OKRAJ * 2 }
}

export default function NavodTip({ tema: klic, className = "", label }: { tema: string; className?: string; label?: string }) {
  const tema = temaObchodu(klic)
  const [open, setOpen] = useState(false)
  const [pripnuto, setPripnuto] = useState(false)
  const [vybrany, setVybrany] = useState(0)
  const [velky, setVelky] = useState(false)
  const [rozmer, setRozmer] = useState<Rozmer | null>(null)
  const [klipy, setKlipy] = useState<Record<string, Klip>>({})
  const kotva = useRef<HTMLButtonElement | null>(null)
  const okno = useRef<HTMLDivElement | null>(null)
  const casovac = useRef<number | undefined>(undefined)
  const id = useId()

  const otevrit = useCallback(() => {
    if (!kotva.current) return
    setRozmer(spocitat(kotva.current.getBoundingClientRect()))
    setOpen(true)
    nactiKlipy().then(setKlipy)
  }, [])
  const zavrit = useCallback(() => {
    window.clearTimeout(casovac.current)
    setOpen(false)
    setPripnuto(false)
    setVelky(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const esc = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      if (velky) setVelky(false)
      else zavrit()
    }
    const venku = (event: PointerEvent) => {
      const cil = event.target as Node
      if (okno.current?.contains(cil) || kotva.current?.contains(cil)) return
      if ((cil as HTMLElement).closest?.("[data-navod-velky]")) return
      zavrit()
    }
    const prepocet = () => kotva.current && setRozmer(spocitat(kotva.current.getBoundingClientRect()))
    window.addEventListener("keydown", esc, true)
    document.addEventListener("pointerdown", venku, true)
    window.addEventListener("resize", prepocet)
    return () => {
      window.removeEventListener("keydown", esc, true)
      document.removeEventListener("pointerdown", venku, true)
      window.removeEventListener("resize", prepocet)
    }
  }, [open, velky, zavrit])

  useEffect(() => () => window.clearTimeout(casovac.current), [])

  if (!tema) return null
  const klip = tema.klipy[Math.min(vybrany, tema.klipy.length - 1)]
  const gif = klip ? klipy[klip.klic] : undefined

  const najet = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return
    window.clearTimeout(casovac.current)
    if (!open) casovac.current = window.setTimeout(otevrit, 250)
  }
  const odjet = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return
    window.clearTimeout(casovac.current)
    if (!pripnuto) casovac.current = window.setTimeout(() => setOpen(false), 350)
  }

  const obsah = (
    <div
      ref={okno}
      id={id}
      role="dialog"
      aria-label={tema.nazev}
      onPointerEnter={(e) => e.pointerType === "mouse" && window.clearTimeout(casovac.current)}
      onPointerLeave={odjet}
      onPointerDown={() => setPripnuto(true)}
      className="navod-okno"
      style={
        rozmer?.druh === "okno"
          ? { position: "fixed", left: rozmer.left, top: rozmer.top, width: rozmer.width, maxHeight: rozmer.maxHeight }
          : undefined
      }
      data-druh={rozmer?.druh ?? "okno"}
    >
      <div className="navod-okno__hlava">
        <p className="navod-okno__nazev">{tema.nazev}</p>
        <button type="button" className="navod-okno__zavrit" aria-label="Zavřít nápovědu" onClick={zavrit}>
          ×
        </button>
      </div>
      {tema.klipy.length > 1 && (
        <div className="navod-okno__zalozky" role="tablist">
          {tema.klipy.map((k, index) => (
            <button
              key={k.klic}
              type="button"
              role="tab"
              aria-selected={index === vybrany}
              onClick={() => setVybrany(index)}
            >
              {k.popis}
            </button>
          ))}
        </div>
      )}
      {klip && gif ? (
        <button type="button" className="navod-okno__gif" onClick={() => setVelky(true)} title="Zvětšit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gif.url} alt={klip.popis} width={gif.width ?? undefined} height={gif.height ?? undefined} />
          <span>Zvětšit</span>
        </button>
      ) : null}
      <p className="navod-okno__proc">{tema.proc}</p>
      <ol className="navod-okno__kroky">
        {tema.kroky.map((krok, index) => (
          <li key={index}>
            <span aria-hidden>{index + 1}</span>
            {krok}
          </li>
        ))}
      </ol>
    </div>
  )

  return (
    <>
      <button
        ref={kotva}
        type="button"
        aria-label={`Nápověda: ${label ?? tema.nazev}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onPointerEnter={najet}
        onPointerLeave={odjet}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          window.clearTimeout(casovac.current)
          if (open && pripnuto) return zavrit()
          setPripnuto(true)
          otevrit()
        }}
        className={`navod-tip ${className}`}
        data-otevreno={open || undefined}
      >
        <span aria-hidden>?</span>
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              {rozmer?.druh === "panel" && <div className="navod-zaclona" onClick={zavrit} aria-hidden />}
              {obsah}
              {velky && gif ? (
                <div className="navod-velky" data-navod-velky="" role="dialog" aria-label={klip?.popis} onClick={() => setVelky(false)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gif.url} alt={klip?.popis ?? ""} />
                  <span>Zavřít (Esc)</span>
                </div>
              ) : null}
            </>,
            document.body
          )
        : null}
    </>
  )
}
