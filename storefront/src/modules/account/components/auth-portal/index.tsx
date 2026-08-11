"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import type { ReactNode } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import s from "./style.module.scss"

type AuthPortalProps = {
  mode: "login" | "register" | "recovery" | "verification"
  children: ReactNode
}

const copy = {
  login: {
    index: "01",
    eyebrow: "Váš účet",
    title: "Vítejte",
    accent: "zpět.",
    note: "Objednávky, oblíbené kousky a adresy máte na jednom místě.",
    word: "VSTUP",
  },
  register: {
    index: "02",
    eyebrow: "Nový účet",
    title: "Založte si",
    accent: "účet.",
    note: "Adresu vyplníte jednou a příště už jen potvrdíte objednávku.",
    word: "ÚČET",
  },
  recovery: {
    index: "03",
    eyebrow: "Obnova přístupu",
    title: "Cesta",
    accent: "zpátky.",
    note: "Jeden krok a můžete pokračovat tam, kde jste skončili.",
    word: "OBNOVA",
  },
  verification: {
    index: "04",
    eyebrow: "Potvrzení e-mailu",
    title: "Ještě jeden",
    accent: "krok.",
    note: "Ověřený e-mail chrání vaše objednávky i uložené údaje.",
    word: "OVĚŘIT",
  },
}

export default function AuthPortal({ mode, children }: AuthPortalProps) {
  const content = copy[mode]

  return (
    <section className={s.portal} data-auth-mode={mode}>
      <motion.p
        className={s.ghostWord}
        aria-hidden="true"
        initial={initial}
        animate={animate}
        transition={transition}
      >
        {content.word}
      </motion.p>

      <header className={s.meta}>
        <span>{content.index} · {content.eyebrow}</span>
        <motion.span
          className={s.metaLine}
          initial={initial2}
          animate={animate2}
          transition={transition2}
        />
        <span>Keramická zahrada · Písek</span>
      </header>

      <div className={s.composition}>
        <motion.figure
          className={s.visual}
          initial={{ clipPath: "inset(18% 0 82% 0)" }}
          animate={{ clipPath: "inset(0% 0 0% 0)" }}
          transition={transition3}
        >
          <Image
            src="/assets/img/img/1.jpg"
            alt="Lucie Polanská při práci v keramickém ateliéru"
            fill
            sizes="(max-width: 760px) 100vw, 52vw"
            className={s.visualImage}
            priority
          />
          <div className={s.imageShade} />
          <div className={s.visualFoot}>
            <span>Ateliér · Písek</span>
            <span className={s.footLine} />
            <span>Od roku 2014</span>
          </div>
        </motion.figure>

        <motion.div
          className={s.heroCopy}
          initial={initial3}
          animate={animate3}
          transition={transition4}
        >
          <span className={s.visualLabel}>Ateliér Lucie Polanské</span>
          <h1>
            <span>{content.title}</span>
            <em>{content.accent}</em>
          </h1>
        </motion.div>

        <motion.aside
          className={s.ledger}
          initial={initial4}
          animate={animate3}
          transition={transition5}
        >
          <div className={s.ledgerTop}>
            <span>{content.index}</span>
            <span>{mode === "register" ? "Zakládáte nový účet" : "Bezpečné přihlášení"}</span>
          </div>
          <div className={s.formSlot}>{children}</div>
          <div className={s.ledgerFoot}>
            <p>{content.note}</p>
            <LocalizedClientLink href="/dotazy">Potřebujete pomoc? ↗</LocalizedClientLink>
          </div>
        </motion.aside>

        <div className={s.indexMark} aria-hidden="true">
          <span>{content.index}</span>
          <span />
          <span>04</span>
        </div>
      </div>
    </section>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const initial = { opacity: 0, x: 40 }
const animate = { opacity: 1, x: 0 }
const transition = { duration: 1.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
const initial2 = { scaleX: 0 }
const animate2 = { scaleX: 1 }
const transition2 = { duration: 1.1, delay: .12, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const transition3 = { duration: 1.25, delay: .08, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const initial3 = { opacity: 0, y: 42 }
const animate3 = { opacity: 1, y: 0 }
const transition4 = { duration: .85, delay: .38, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
const initial4 = { opacity: 0, y: 24 }
const transition5 = { duration: .72, delay: .55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
