"use client"

import { useEffect, useRef, useState } from "react"

import { useConsentFor } from "@lib/hooks/use-cookie-consent"

import styles from "./style.module.scss"

type MapEmbedProps = {
  /** Adresa ateliéru — špendlík na mapě i odkaz do Map Google. */
  address: string
  title: string
}

/**
 * Mapa Google až na vyžádání (14. 10. 2026, LEGAL_AUDIT.md § 8).
 *
 * Vložená mapa je obsah z google.com: už samotné načtení iframe pošle Googlu IP adresu
 * a Google si v něm ukládá vlastní cookies (NID a další), které může použít i pro reklamu.
 * Proto se do kliknutí ukazuje jen statická plocha bez jediného požadavku ven — tlačítko
 * „Zobrazit mapu" a obyčejný odkaz do Map Google v novém okně.
 *
 * Kategorie: **marketingové a obsah třetích stran** (ne preferenční — cookies nejsou naše
 * a Google je používá i k reklamě). Kdo ji v liště povolil, vidí mapu rovnou. Kliknutí na
 * „Zobrazit mapu" je souhlas jen pro tohle jedno zobrazení; nikam se neukládá.
 *
 * První vykreslení je vždy bez mapy: souhlas se čte až v prohlížeči (`useConsentFor` vrací
 * na serveru i v prvním snímku „ne").
 */
export default function MapEmbed({ address, title }: MapEmbedProps) {
  const marketing = useConsentFor("marketing")
  const [requested, setRequested] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const showMap = requested || marketing

  // Po kliknutí tlačítko zmizí — fokus se přesune na mapu, ne na začátek stránky.
  useEffect(() => {
    if (requested) frameRef.current?.focus()
  }, [requested])

  const query = encodeURIComponent(address)
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${query}`

  if (showMap) {
    /* Google's classic key-less embed over the atelier address — the interactive widget SDKs
       all want an API key and a billing account for what is, here, one pin on one map. */
    return (
      <div className={styles.mapFrame}>
        <iframe
          ref={frameRef}
          src={`https://maps.google.com/maps?q=${query}&z=14&hl=cs&output=embed`}
          title={title}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <div className={styles.mapFrame}>
      <div className={styles.mapPlaceholder}>
        <span className={styles.mapPin} aria-hidden="true" />
        <p className={styles.mapAddress}>{address}</p>
        <button
          type="button"
          className={styles.mapButton}
          onClick={() => setRequested(true)}
        >
          Zobrazit mapu{" "}
          <span className={styles.mapButtonNote}>(načte se z Google Maps)</span>
        </button>
        <a
          className={styles.mapLink}
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          Otevřít v Mapách Google
          <span className={styles.srOnly}> (v novém okně)</span>
          <span aria-hidden="true"> ↗</span>
        </a>
        <p className={styles.mapNote}>
          Google si při zobrazení mapy může uložit vlastní cookies.
        </p>
      </div>
    </div>
  )
}
