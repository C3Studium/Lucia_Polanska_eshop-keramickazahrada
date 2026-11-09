"use client"

import { useEffect, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useTexty } from "@lib/context/texty"
import { TEXTY_DEFAULTS, type ShopTexty } from "@lib/constants/texty"

import styles from "./style.module.scss"

/**
 * Bezpečnostní upozornění u výrobku (LEGAL_AUDIT.md § 0b, N2 — nařízení (EU)
 * 2023/988 o obecné bezpečnosti výrobků): jedna věta podle kategorie, ne
 * u každého kusu zvlášť. Kotvení u věcí na fasádu, mráz u nádob na vodu,
 * střepy u všeho — keramika je křehká vždy.
 *
 * Tvrzení o nezávadnosti glazur (N1) odkazuje na protokol, který Lucie
 * nahrává ve Studiu (`/api/certifikaty`): tvrzení bez dokladu by bylo
 * klamavé (§ 5 ZOS) — dokud protokol publikovaný není, věta to říká pravdivě.
 * Totéž pravidlo (`FOOD_CLAIM`) zrcadlí backend `lib/glaze-protocols.ts`,
 * který protokol přikládá k potvrzení objednávky.
 */

type GlazeProtocolLink = { glaze: string; url: string }

/** Protokoly glazur ze Studia; `null` dokud se nenačtou. */
const useGlazeProtocols = (enabled: boolean): GlazeProtocolLink[] | null => {
  const [protocols, setProtocols] = useState<GlazeProtocolLink[] | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    fetch("/api/certifikaty")
      .then((response) => (response.ok ? response.json() : { glazes: [] }))
      .then((body: { glazes?: GlazeProtocolLink[] }) => {
        if (alive) setProtocols((body.glazes ?? []).filter((row) => row?.url))
      })
      .catch(() => alive && setProtocols([]))
    return () => {
      alive = false
    }
  }, [enabled])
  return protocols
}

/** Kategorie, kde se kus kotví na zeď / fasádu. */
const WALL_MOUNTED = new Set(["plastiky-na-zeď", "domovní-čísla", "poštovní-schránky", "zvonková-tlačítka", "klasik", "retro", "plochá", "original"])
/** Kategorie nádob, ve kterých nesmí zamrznout voda. */
const WATER_VESSELS = new Set(["pítka-a-krmítka", "květináče"])

const FOOD_CLAIM = /zdravotně\s+nezávadn|nezávadn[ýáéí]\w*\s+(materi|glaz)|pro\s+styk\s+s\s+potravin/i

export const safetySentencesFor = (
  categoryHandles: readonly string[],
  description: string | null | undefined,
  /* Znění z administrace; bez něj platí výchozí z kódu. Prázdná věta se
     do výpisu nedostane — tak se projeví vypínač. */
  texty: ShopTexty = TEXTY_DEFAULTS
): { sentences: string[]; foodClaim: boolean } => {
  const sentences: string[] = []
  if (categoryHandles.some((handle) => WALL_MOUNTED.has(handle))) {
    sentences.push(texty["bezpecnost.kotveni"])
  }
  if (categoryHandles.some((handle) => WATER_VESSELS.has(handle))) {
    sentences.push(texty["bezpecnost.mraz"])
  }
  sentences.push(texty["bezpecnost.strepy"])
  const text = description ?? ""
  const foodClaim = FOOD_CLAIM.test(text) && !/\bnen[íi]\b[^.]*(potravin|nezávadn)|nevhodn/i.test(text)
  return { sentences: sentences.filter(Boolean), foodClaim }
}

export default function SafetyNotice({
  categoryHandles,
  description,
}: {
  categoryHandles: readonly string[]
  description: string | null | undefined
}) {
  const texty = useTexty()
  const { sentences, foodClaim } = safetySentencesFor(
    categoryHandles,
    description,
    texty
  )
  const protocols = useGlazeProtocols(foodClaim)

  /* Všechny věty vypnuté = blok se nekreslí. */
  if (!sentences.length && !foodClaim) return null

  return (
    <aside className={styles.notice} aria-label="Bezpečnostní upozornění" data-testid="safety-notice">
      {texty["bezpecnost.nadpis"] ? (
        <p className={styles.title}>{texty["bezpecnost.nadpis"]}</p>
      ) : null}
      <ul className={styles.list}>
        {sentences.map((sentence) => (
          <li key={sentence}>{sentence}</li>
        ))}
        {foodClaim && protocols && protocols.length > 0 && (
          <li data-testid="glaze-protocol">
            Zdravotní nezávadnost glazury dokládá protokol —{" "}
            {protocols.map((protocol, index) => (
              <span key={protocol.url}>
                {index ? ", " : ""}
                <a href={protocol.url} target="_blank" rel="noopener">
                  {protocols.length > 1 ? protocol.glaze : "protokol (PDF)"}
                </a>
              </span>
            ))}
            ; přikládáme ho i k potvrzení objednávky. Všechny doklady jsou na stránce{" "}
            <LocalizedClientLink href="/certifikaty">certifikáty a protokoly</LocalizedClientLink>.
          </li>
        )}
        {foodClaim && protocols && protocols.length === 0 && (
          <li data-testid="glaze-protocol-pending">
            Protokol o zdravotní nezávadnosti glazury zveřejníme na stránce{" "}
            <LocalizedClientLink href="/certifikaty">certifikáty a protokoly</LocalizedClientLink>.
          </li>
        )}
      </ul>
    </aside>
  )
}
