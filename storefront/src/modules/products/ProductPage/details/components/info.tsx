"use client"

import Image from "next/image"
import { useState } from "react"
import Lightbox from "@modules/products/ProductPage/product/Gallery/lightbox"

/**
 * Popisek výrobku a pod ním fotky k popisu (15. 11. 2026) — detail glazury,
 * zadní strana, kus v místnosti… Majitelka je přidává v administraci
 * u výrobku („Fotky v popisu", `metadata.detail_images`). Klik otevře fotku
 * přes celou obrazovku stejně jako v galerii.
 */
const InfoDesc = ({
  description,
  images = [],
  title,
}: {
  description: string
  images?: string[]
  title?: string | null
}) => {
  const [index, setIndex] = useState<number | null>(null)
  const fotky = images.map((url, i) => ({ url, alt: `${title ?? "Výrobek"} — fotka ${i + 1}` }))

  return (
    <div className="info">
      {description ? <p>{description}</p> : null}
      {fotky.length > 0 && (
        <ul className="info__images">
          {fotky.map((fotka, i) => (
            <li key={fotka.url}>
              <button
                type="button"
                className="info__image"
                onClick={() => setIndex(i)}
                aria-label={`Zvětšit: ${fotka.alt}`}
              >
                <Image src={fotka.url} alt={fotka.alt} fill sizes="(min-width: 900px) 22rem, 45vw" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Lightbox
        fotky={fotky}
        index={index}
        onZavrit={() => setIndex(null)}
        onPosun={(krok) =>
          setIndex((current) =>
            current === null ? null : (current + krok + fotky.length) % fotky.length
          )
        }
      />
    </div>
  )
}

export default InfoDesc
