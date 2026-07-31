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
    eyebrow: "Soukromý archiv",
    title: "Vítejte",
    accent: "zpět.",
    note: "Vaše objednávky, uložené objekty a adresy na jednom klidném místě.",
    word: "VSTUP",
  },
  register: {
    index: "02",
    eyebrow: "Nový zápis",
    title: "Váš vlastní",
    accent: "archiv.",
    note: "Účet uchová vše důležité, aniž by stál mezi vámi a objektem.",
    word: "ZÁPIS",
  },
  recovery: {
    index: "03",
    eyebrow: "Obnova přístupu",
    title: "Cesta",
    accent: "zpátky.",
    note: "Jeden bezpečný krok a můžete pokračovat tam, kde jste skončili.",
    word: "OBNOVA",
  },
  verification: {
    index: "04",
    eyebrow: "Potvrzení adresy",
    title: "Ještě jeden",
    accent: "krok.",
    note: "Ověřená adresa chrání vaše objednávky i uložené údaje.",
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
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {content.word}
      </motion.p>

      <header className={s.meta}>
        <span>{content.index} · {content.eyebrow}</span>
        <motion.span
          className={s.metaLine}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.1, delay: .12, ease: [0.76, 0, 0.24, 1] }}
        />
        <span>Keramická zahrada · Písek</span>
      </header>

      <div className={s.composition}>
        <motion.figure
          className={s.visual}
          initial={{ clipPath: "inset(18% 0 82% 0)" }}
          animate={{ clipPath: "inset(0% 0 0% 0)" }}
          transition={{ duration: 1.25, delay: .08, ease: [0.76, 0, 0.24, 1] }}
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
          initial={{ opacity: 0, y: 42 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .85, delay: .38, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className={s.visualLabel}>Přístup k vašemu výběru</span>
          <h1>
            <span>{content.title}</span>
            <em>{content.accent}</em>
          </h1>
        </motion.div>

        <motion.aside
          className={s.ledger}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .72, delay: .55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={s.ledgerTop}>
            <span>{content.index}</span>
            <span>{mode === "register" ? "Nový zákaznický zápis" : "Bezpečný přístup"}</span>
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
