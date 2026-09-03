"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import type { ReactNode } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import { editable } from "@c3studium/valecms/edit"
import type { CopyBlock } from "@lib/util/site-copy"
import s from "./style.module.scss"

type AuthPortalProps = {
  mode: "login" | "register" | "recovery" | "verification"
  children: ReactNode
  /**
   * Blok `global.prihlaseni` — fotka vedle formuláře.
   *
   * Globální, ne per-stránka: tentýž portál se otevírá u přihlášení,
   * registrace, zapomenutého hesla i ověření e-mailu, a fotka je u všech
   * stejná. Čtyři bloky pro jeden obrázek by znamenaly čtyři místa, kde ho
   * někdo zapomene vyměnit.
   */
  block?: CopyBlock
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

export default function AuthPortal({ mode, children, block }: AuthPortalProps) {
  const photo = block?.gallery?.[0]

  /*
   * Texty z bloku `global.prihlaseni`, položky klíčované popiskem.
   *
   * Hledá se podle `label` (`login.title`), ne podle pozice: `recovery`
   * a `verification` v CMS nejsou — jsou to podpůrné obrazovky a ty do
   * redakce nepatří —, takže pořadí položek neodpovídá pořadí režimů
   * a index by ukazoval jinam.
   *
   * Režim, který v bloku nic nemá, se vykreslí s texty z kódu. Proto tu
   * nestojí podmínka na `mode`: chybějící položka je totéž co chybějící blok.
   */
  const at = (field: string) =>
    block?.items?.find((item) => item.label === `${mode}.${field}`)

  const fallback = copy[mode]
  const content = {
    ...fallback,
    title: at("title")?.value?.trim() || fallback.title,
    accent: at("title")?.note?.trim() || fallback.accent,
    eyebrow: at("eyebrow")?.value?.trim() || fallback.eyebrow,
    note: at("note")?.value?.trim() || fallback.note,
  }

  /** Kolikátá je položka v bloku — anotace míří na pozici, ne na popisek. */
  const indexOf = (field: string) =>
    block?.items?.findIndex((item) => item.label === `${mode}.${field}`) ?? -1

  const edit = (field: string) => {
    const index = indexOf(field)
    return index < 0 ? {} : editable(block, `items.${index}.value`)
  }

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
        <span {...edit("eyebrow")}>{content.index} · {content.eyebrow}</span>
        <motion.span
          className={s.metaLine}
          initial={initial2}
          animate={animate2}
          transition={transition2}
        />
        <span>Keramická zahrada · Písek</span>
      </header>

      <div className={s.composition}>
        {/* Anotace na obalu, ne na `Image`: `next/image` si vnitřní `<img>`
            přepisuje podle velikosti okna, a překryv potřebuje element,
            který mu pod kurzorem nezmizí. */}
        <motion.figure
          className={s.visual}
          initial={{ clipPath: "inset(18% 0 82% 0)" }}
          animate={{ clipPath: "inset(0% 0 0% 0)" }}
          transition={transition3}
          {...editable(block, "gallery.0", "image")}
        >
          <Image
            src={photo?.url ?? "/assets/img/img/1.jpg"}
            alt={photo?.alt?.trim() || "Lucie Polanská při práci v keramickém ateliéru"}
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
          {/* Nadpis a jeho zvýrazněný konec jsou v CMS jedna položka
              (`value` a `note`), takže i překryv je jeden — rozdělit je
              na dva by znamenalo dvě kliknutí pro jednu větu. */}
          <h1 {...edit("title")}>
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
            <p {...edit("note")}>{content.note}</p>
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
   render only gave framer-motion new references to re-diff.

   Nájezdové posuny jsou ve vw/vh, ne v px: na 2552px monitoru je 40px jiné gesto
   než na 1280px. Obě strany interpolace mají stejný tvar výrazu (jednotka i v
   cíli, tedy "0vw"/"0vh"), jinak framer míchá px s vw a skáče. Odvozeno z původních
   hodnot: 40px ≈ 2.5vw při 1600, 42px ≈ 4vh při 1050, 24px ≈ 2.2vh při 1090. */
const initial = { opacity: 0, x: "2.5vw" }
const animate = { opacity: 1, x: "0vw" }
const transition = { duration: 1.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
const initial2 = { scaleX: 0 }
const animate2 = { scaleX: 1 }
const transition2 = { duration: 1.1, delay: .12, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const transition3 = { duration: 1.25, delay: .08, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
const initial3 = { opacity: 0, y: "4vh" }
const animate3 = { opacity: 1, y: "0vh" }
const transition4 = { duration: .85, delay: .38, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
const initial4 = { opacity: 0, y: "2.2vh" }
const transition5 = { duration: .72, delay: .55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
