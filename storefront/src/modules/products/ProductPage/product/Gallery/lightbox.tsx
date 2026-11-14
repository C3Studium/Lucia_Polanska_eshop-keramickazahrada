"use client"

import Image from "next/image"
import { useEffect, useRef } from "react"

/**
 * Fotka přes celou obrazovku (14. 11. 2026, přání klientky: „aby si lidé
 * mohli prohlédnout celý obrázek"). Ve stránce je fotka ořezaná do rámečku;
 * tady je celá (`object-fit: contain`), na tmavém pozadí.
 *
 * Nativní <dialog> se `showModal()`: drží fokus uvnitř, Esc zavírá sám
 * a stránka pod ním je neaktivní. Šipky a ←/→ listují, klik na tmavé pozadí
 * zavírá. `data-lenis-prevent`, ať plynulé rolování stránky nebere kolečko.
 */
type Fotka = { url: string; alt: string }

export default function Lightbox({
  fotky,
  index,
  onZavrit,
  onPosun,
}: {
  fotky: Fotka[]
  index: number | null
  onZavrit: () => void
  onPosun: (krok: number) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const otevreno = index !== null && Boolean(fotky[index])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (otevreno && !dialog.open) dialog.showModal()
    if (!otevreno && dialog.open) dialog.close()
  }, [otevreno])

  const fotka = otevreno ? fotky[index!] : null

  return (
    <dialog
      ref={ref}
      className="product__lightbox"
      aria-label="Fotka výrobku přes celou obrazovku"
      data-lenis-prevent
      onClose={onZavrit}
      onClick={(event) => {
        /* Klik mimo fotku a tlačítka (na tmavé pozadí) zavírá. */
        if (event.target === event.currentTarget) onZavrit()
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault()
          onPosun(1)
        } else if (event.key === "ArrowLeft") {
          event.preventDefault()
          onPosun(-1)
        }
      }}
    >
      {fotka && (
        <>
          <div className="product__lightboxImage" onClick={(event) => event.stopPropagation()}>
            <Image src={fotka.url} alt={fotka.alt} fill sizes="100vw" quality={100} />
          </div>
          <button
            type="button"
            className="product__lightboxClose"
            onClick={onZavrit}
            aria-label="Zavřít"
            autoFocus
          >
            Zavřít ✕
          </button>
          {fotky.length > 1 && (
            <>
              <button
                type="button"
                className="product__lightboxArrow product__lightboxArrow--prev"
                aria-label="Předchozí fotka"
                onClick={() => onPosun(-1)}
              >
                <span aria-hidden="true">←</span>
              </button>
              <button
                type="button"
                className="product__lightboxArrow product__lightboxArrow--next"
                aria-label="Další fotka"
                onClick={() => onPosun(1)}
              >
                <span aria-hidden="true">→</span>
              </button>
              <span className="product__lightboxCount" aria-live="polite">
                {index! + 1} / {fotky.length}
              </span>
            </>
          )}
        </>
      )}
    </dialog>
  )
}
