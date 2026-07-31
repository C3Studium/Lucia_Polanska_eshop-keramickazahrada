"use client"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import { Easing, motion } from "framer-motion"
import { useState } from "react"

type ItemProps = {
  id: number
  title: string
  description: string
  image: string
  href: string
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

export const VerticalItem = ({ collection }: { collection: ItemProps }) => {
  const [hover, setHover] = useState<Boolean>(false)

  return (
    <LocalizedClientLink
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      href={collection.href}
      className="vertical__item__wrapper"
      id={`collection-${collection.id}`}
      aria-label={`Otevřít kolekci ${collection.title}`}
    >
      <div className="image__container">
        <motion.div
          variants={opacityAnim}
          initial="initial"
          animate={hover ? "enter" : "exit"}
          className="black"
        />
        <Image
          src={collection.image}
          alt={collection.title}
          fill
          sizes="(max-width: 768px) 84vw, 30vw"
        />
      </div>
      <div className="Item__content">
        <div className="Item__meta">
          <span>{String(collection.id).padStart(2, "0")}</span>
          <span>Originál · malá série</span>
        </div>
        <h3>{collection.title}</h3>
        <p>{collection.description}</p>
        <span className="Item__action">
          Otevřít kolekci <i aria-hidden="true">↗</i>
        </span>
      </div>
    </LocalizedClientLink>
  )
}

export const HorizontalItem = ({ collection }: { collection: ItemProps }) => {
  const [hover, setHover] = useState<Boolean>(false)

  return (
    <LocalizedClientLink
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      href={collection.href}
      className="horizontal__item__wrapper"
      id={`collection-${collection.id}`}
      aria-label={`Otevřít kolekci ${collection.title}`}
    >
      <div className="image__container">
        <motion.div
          variants={opacityAnim}
          initial="initial"
          animate={hover ? "enter" : "exit"}
          className="black"
        />
        <Image
          src={collection.image}
          alt={collection.title}
          fill
          sizes="(max-width: 768px) 84vw, 24vw"
        />
      </div>
      <div className="Item__content">
        <div className="Item__meta">
          <span>{String(collection.id).padStart(2, "0")}</span>
          <span>Originál · malá série</span>
        </div>
        <h3>{collection.title}</h3>
        <p>{collection.description}</p>
        <span className="Item__action">
          Otevřít kolekci <i aria-hidden="true">↗</i>
        </span>
      </div>
    </LocalizedClientLink>
  )
}
