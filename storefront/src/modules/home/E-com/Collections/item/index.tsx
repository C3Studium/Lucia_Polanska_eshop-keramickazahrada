"use client"
import { editable } from "@c3studium/valecms/edit"
import type { CopyBlock } from "@lib/util/site-copy"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import { Easing, motion } from "framer-motion"
import { useState } from "react"

/**
 * Jedna karta kolekce.
 *
 * Co odkud je:
 *  - **jméno a odkaz** z Medusy. Kolekce je katalog, ne text — kdyby se jméno psalo v CMS,
 *    byly by na jednu věc dva zdroje pravdy a odkaz by mohl vést jinam, než kam jméno slibuje.
 *  - **fotka a popisek** z CMS, s fotkou z Medusy jako zálohou.
 *  - **štítek a text odkazu** z CMS. Jsou sdílené přes všechny karty, takže je to jedno pole
 *    na každý — anotace je na každé kartě, ale míří pořád na totéž pole.
 */
export type CollectionCard = {
  /** Klíč kolekce z Medusy (handle) — jím se páruje řádek v CMS. */
  key: string
  /** Pořadí, 1..n. Číslo na kartě i vstup do rozptylu animace; id z Medusy je řetězec. */
  n: number
  title: string
  description: string
  image: string
  href: string
}

type ItemProps = {
  collection: CollectionCard
  /** Blok textů sekce — kvůli anotacím pro editaci. */
  block?: CopyBlock
  /** Index řádku v `items`, aby popisek a fotka mířily na svůj vlastní řádek. */
  index: number
  badge: string
  action: string
}

const opacityAnim = {
  initial: {
    opacity: 0.82,
  },
  enter: {
    opacity: 0.62,
    transition: {
      duration: 0.45,
      ease: [0.76, 0, 0.24, 1] as Easing,
    },
  },
  exit: {
    opacity: 0.82,
    transition: {
      duration: 0.45,
      ease: [0.76, 0, 0.24, 1] as Easing,
    },
  },
}

/**
 * Vnitřek karty — jeden pro obě podoby.
 *
 * Vodorovná a svislá karta se liší jedinou třídou a hodnotou `sizes`; všechno ostatní měly
 * dřív opsané zvlášť. Dvě kopie téhož se rozejdou při první úpravě, kterou někdo udělá jen
 * v jedné z nich — a tady by se to projevilo tím, že jedna podoba karty jde upravovat a
 * druhá ne.
 */
const Card = ({
  collection,
  block,
  index,
  badge,
  action,
  variant,
  sizes,
}: ItemProps & { variant: "vertical" | "horizontal"; sizes: string }) => {
  const [hover, setHover] = useState(false)

  return (
    <LocalizedClientLink
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      href={collection.href}
      className={`${variant}__item__wrapper`}
      id={`collection-${collection.key}`}
      aria-label={`Otevřít kolekci ${collection.title}`}
    >
      <div className="image__container">
        <motion.div
          variants={opacityAnim}
          initial="initial"
          animate={hover ? "enter" : "exit"}
          className="black"
        />
        {/* Fotka je z Medusy (admin Rozdělení → „Zobrazit kolekci"), proto bez anotace
            pro CMS — jinak by na jednu věc byla dvě místa, kde se mění. */}
        <Image
          src={collection.image}
          alt={collection.title}
          fill
          sizes={sizes}
        />
      </div>
      <div className="Item__content">
        <div className="Item__meta">
          {/* Pořadí, ne id: kolekce z Medusy mají id jako řetězec (`pcol_…`). */}
          <span>{String(collection.n).padStart(2, "0")}</span>
          <span {...editable(block, "accent.2")}>{badge}</span>
        </div>
        {/* Jméno i popisek jsou z Medusy — mění se v katalogu, ne tady. Prázdný popisek
            je běžný stav, karta pak nese jen jméno. */}
        <h3>{collection.title}</h3>
        {collection.description && <p>{collection.description}</p>}
        <span className="Item__action" {...editable(block, "accent.3")}>
          {action} <i aria-hidden="true">↗</i>
        </span>
      </div>
    </LocalizedClientLink>
  )
}

export const VerticalItem = (props: ItemProps) => (
  <Card {...props} variant="vertical" sizes="(max-width: 768px) 84vw, 30vw" />
)

export const HorizontalItem = (props: ItemProps) => (
  <Card {...props} variant="horizontal" sizes="(max-width: 768px) 84vw, 24vw" />
)
