"use client"

import { editable, editableLink } from "@c3studium/valecms/edit"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import type { CopyBlock, CopyBlocks } from "@lib/util/site-copy"
import CollectionCategoryLink from "@modules/layout/Navbar/productsButton/CategoryLink"
import { useContactDialog } from "@modules/layout/ContactDialog"
import type { MerchantIdentity } from "@lib/data/merchant"
import { subscribeToNewsletter } from "@lib/data/newsletter"
import { openCookiePreferences } from "@lib/util/cookie-consent"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import { paymentIcons } from "constants/icons"
import { motion, useReducedMotion } from "framer-motion"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react"
import { palette } from "styles/palette.generated"

type FooterTone = "light" | "dark"

const DEFAULT_SURFACE = palette.sage01

const currentYear = new Date().getFullYear()

// One label per destination: "Smluvní podmínky" and "Obchodní podmínky" both pointed here,
// under two names, for a page that calls itself Obchodní podmínky.
const importantLinks = [
  { label: "Obchodní podmínky", href: "/smluvni-podminky" },
  { label: "Ochrana osobních údajů", href: "/ochrana-osobnich-udaju" },
  { label: "Používání cookies", href: "/cookies" },
  // Not a page either: it reopens the consent dialog. Withdrawing consent has to be as easy as
  // giving it was, and the banner that gave it is gone the moment it is answered.
  { label: "Nastavení cookies", action: "cookies" as const },
]

const discoverLinks = [
  { label: "Obchod", href: "/store" },
  { label: "Dotazy", href: "/dotazy" },
  { label: "Kurzy", href: "/kurzy" },
  // Kontakt is a dialog, not a page (D-S5) — rendered as a button by FooterLinkGroup.
  { label: "Kontakt", action: "contact" as const },
]

const helpLinks = [
  { label: "Odstoupení od smlouvy", href: "/odstoupeni-od-smlouvy" },
  { label: "Reklamační protokol", href: "/reklamacni-protokol" },
  { label: "Doprava a platba", href: "/doprava-a-platba" },
]

/*
 * Záloha sociálních sítí pro případ, že by blok `global.socialni-site` nešel načíst.
 *
 * Spravují se v CMS jako seznam (dá se do něj přidat třetí síť); tohle je jen to, co se
 * ukáže, dokud odtamtud nic nepřijde — patička bez odkazů vypadá jako závada.
 */
const socialLinks = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/keramickazahrada",
    icon: "/assets/icons/facebook.svg",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/luciepolanska/",
    icon: "/assets/icons/instagram.svg",
  },
]

/*
 * 26px is 2.4vh of the 1080px reference screen, and animation coordinates belong on vh so the
 * gesture keeps its share of the window instead of shrinking to nothing on a 2K monitor.
 *
 * A previous pass reverted this to px with a comment claiming framer-motion types `y` as px and
 * never completes a variant that carries a unit. That is not true, and the note is removed rather
 * than left to warn the next reader off: framer-motion 12.23.12 was run in Chromium against its
 * own runtime (.rdshots/zz-lead-vh-motion.cjs) and `y: "-1.8vh" → "0vh"` interpolates cleanly —
 * mid-flight matrix -7.24px of the -13.82px start at 1366x768, final transform `none`, and
 * `mix("-1.8vh", "0vh")(0.5)` returns "-0.9vh". The footer sitting at opacity 0 was the dev
 * server failing to hydrate (the same "Loading chunk (main)/layout failed" that pass reported
 * separately), not the unit. cart-mismatch-banner, CookieNotice, ContactDialog and the shipping
 * nudge all ship vh coordinates today and animate correctly, which is the same evidence.
 *
 * Both sides carry the unit — `"0vh"`, not a bare `0` — because framer only interpolates
 * reliably when the two ends have the same shape of expression.
 */
const reveal = {
  hidden: { opacity: 0, y: "2.4vh" },
  visible: {
    opacity: 1,
    y: "0vh",
    transition: {
      duration: 0.72,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
}

export default function Footer({
  merchant,
  copy,
}: {
  merchant: MerchantIdentity
  /**
   * Globální bloky (`global.*`) — texty patičky, newsletteru a seznam sítí.
   *
   * Sociální odkazy dřív chodily jako dva dokumenty tlačítek (`footer.facebook`,
   * `footer.instagram`) a prop `buttons`. Nahradil je seznam `global.socialni-site`,
   * do kterého jde síť přidat, takže pevná dvojice ani prop k ní už nejsou potřeba.
   */
  copy?: CopyBlocks
}) {
  /* Patička visí pod každou stránkou a hýbe se jen při odhalení; bez tohohle by se po
     zapnutí režimu editace nepřekreslila a `editable()` by zůstalo prázdné. Viz hook. */
  useEditRerender()

  const footerCopy = copy?.["global.paticka"]
  const socialBlock = copy?.["global.socialni-site"]
  const newsletterCopy = copy?.["global.newsletter"]

  const newsletterEyebrow = newsletterCopy?.accent?.[0]?.trim() || "Novinky · 01"
  const newsletterTitle =
    newsletterCopy?.title?.trim() || "Ozveme se, když bude co říct."
  const newsletterLede =
    newsletterCopy?.bodyText?.trim() ||
    "Novinky z ateliéru a termíny kurzů. Nic víc."

  const toplineLeft = footerCopy?.accent?.[0]?.trim() || "Keramická zahrada"
  const toplineRight =
    footerCopy?.accent?.[1]?.trim() || "Ateliér Lucie Polanské · Písek"
  const footerEyebrow = footerCopy?.accent?.[2]?.trim() || "00 · PATIČKA"
  const wordmarkLead = footerCopy?.title?.trim() || "Keramická"
  const wordmarkAccent = footerCopy?.headline?.trim() || "zahrada."
  const statement =
    footerCopy?.bodyText?.trim() ||
    "Keramika pro zahradu i domov. Všechno vzniká rukama v píseckém ateliéru."

  /*
   * Sociální sítě jako seznam, ne dva zapsané odkazy.
   *
   * Řádek nese jméno (`label`), adresu (`value`) a klíč ikony (`lead`), podle kterého se
   * vezme soubor z `/assets/icons/`. Přidat třetí síť tedy znamená přidat řádek, ne sáhnout
   * do kódu. Nahraná ikona v „Sadě obrázků" na témž pořadí má přednost — je to jediná cesta,
   * jak dostat do patičky logo, které v `/assets/icons/` není.
   *
   * Zálohou je původní dvojice, aby patička nezůstala bez odkazů, dokud blok nikdo nevyplní.
   */
  const socials = (() => {
    const rows = (socialBlock?.items ?? []).filter(
      (row) => row.label?.trim() && row.value?.trim()
    )
    if (!rows.length) {
      return socialLinks.map((link) => ({
        label: link.label,
        href: link.href,
        icon: link.icon,
      }))
    }
    return rows.map((row, index) => ({
      label: row.label.trim(),
      href: row.value.trim(),
      icon:
        socialBlock?.gallery?.[index]?.url ||
        `/assets/icons/${row.lead?.trim() || "instagram"}.svg`,
    }))
  })()
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const footerRef = useRef<HTMLElement>(null)
  /* Typ se píše ručně, protože paleta je `as const` a `DEFAULT_SURFACE` je tím
     doslovný literál — bez toho by stav uměl držet jen tu jednu barvu, kterou
     začíná, a přiřazení jakékoli jiné by neprošlo překladem. */
  const [surface, setSurface] = useState<string>(DEFAULT_SURFACE)
  const [tone, setTone] = useState<FooterTone>("light")

  useLayoutEffect(() => {
    const footer = footerRef.current

    if (!footer) {
      return
    }

    let frame = 0
    let observedElement: HTMLElement | null = null

    const updateTheme = () => {
      const previousElement = getPreviousVisualElement(footer)
      observedElement = previousElement

      const resolvedSurface = getVisualSurface(previousElement)
      const resolvedTone =
        previousElement?.closest<HTMLElement>("[data-footer-tone]")?.dataset
          .footerTone === "dark"
          ? "dark"
          : previousElement?.closest<HTMLElement>("[data-footer-tone]")?.dataset
                .footerTone === "light"
            ? "light"
            : getTone(resolvedSurface)

      setSurface((current) =>
        current === resolvedSurface ? current : resolvedSurface
      )
      setTone((current) =>
        current === resolvedTone ? current : resolvedTone
      )
    }

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(updateTheme)
    }

    updateTheme()

    const mutationObserver = new MutationObserver(scheduleUpdate)
    const resizeObserver = new ResizeObserver(scheduleUpdate)

    if (observedElement) {
      mutationObserver.observe(observedElement, {
        attributes: true,
        attributeFilter: [
          "class",
          "style",
          "data-footer-surface",
          "data-footer-tone",
        ],
      })
      resizeObserver.observe(observedElement)
    }

    window.addEventListener("resize", scheduleUpdate)
    window.addEventListener("load", scheduleUpdate)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", scheduleUpdate)
      window.removeEventListener("load", scheduleUpdate)
      mutationObserver.disconnect()
      resizeObserver.disconnect()
    }
  }, [pathname])

  const footerStyle = {
    "--footer-surface": surface,
  } as CSSProperties

  return (
    <footer
      ref={footerRef}
      className="Mainfooter"
      data-tone={tone}
      style={footerStyle}
    >
      <motion.div
        className="footer__frame"
        initial={reduceMotion ? false : "hidden"}
        whileInView="visible"
        viewport={viewport}
        variants={reveal}
      >
        <div className="footer__topline">
          <span {...editable(footerCopy, "accent.0")}>{toplineLeft}</span>
          <span {...editable(footerCopy, "accent.1")}>{toplineRight}</span>
        </div>

        <div className="footer__main">
          <div className="footer__brand">
            <div className="footer__brandMeta">
              <Image
                src={
                  tone === "dark"
                    ? "/assets/icons/logowhite.svg"
                    : "/assets/icons/logo.svg"
                }
                alt="Keramická zahrada"
                width={96}
                height={48}
                priority={false}
              />
              <span {...editable(footerCopy, "accent.2")}>{footerEyebrow}</span>
            </div>

            {/* Styled as a heading, but not one: the footer repeats on every page and used
                to inject an h2 + two h3s into each page's outline (spec §6).
                Obě půlky jsou vlastní pole — `editable` píše celé pole, takže v jednom by
                šly změnit jen obě naráz. */}
            <p className="footer__wordmark">
              <span {...editable(footerCopy, "title")}>{wordmarkLead}</span>{" "}
              <em {...editable(footerCopy, "headline")}>{wordmarkAccent}</em>
            </p>

            <p className="footer__statement" {...editable(footerCopy, "body")}>
              {statement}
            </p>

            <div className="footer__socials" aria-label="Sociální sítě">
              {socials.map((social, index) => (
                <FooterIcon
                  key={`${social.label}-${index}`}
                  href={social.href}
                  icon={social.icon}
                  alt={social.label}
                  className="footer__socialLink"
                  /* Anotace míří na adresu v řádku seznamu. Jméno a ikona se mění tamtéž,
                     jen ve formuláři bloku — na stránce je ikona obrázek bez textu, takže
                     není co psát v místě. */
                  edit={editable(socialBlock, `items.${index}.value`)}
                />
              ))}
            </div>
          </div>

          <div className="footer__utility">
            <section
              className="footer__newsletter"
              aria-labelledby="newsletter-title"
            >
              <div className="footer__newsletterCopy">
                <span {...editable(newsletterCopy, "accent.0")}>
                  {newsletterEyebrow}
                </span>
                <p
                  id="newsletter-title"
                  className="footer__newsletterTitle"
                  {...editable(newsletterCopy, "title")}
                >
                  {newsletterTitle}
                </p>
                <p {...editable(newsletterCopy, "body")}>{newsletterLede}</p>
              </div>
              <Newsletter block={newsletterCopy} />
            </section>

            <nav className="footer__navigation" aria-label="Navigace v patičce">
              <FooterLinkGroup title="Informace" links={importantLinks} />
              <FooterLinkGroup title="Objevovat" links={discoverLinks} />
              <FooterLinkGroup title="Pomoc" links={helpLinks} />
            </nav>
          </div>
        </div>

        {/* Its own band rather than the tail of the brand column. Sitting there it made that column
            ~240px taller than the newsletter/navigation column beside it, and since the two share
            one bordered row the difference showed up as a hole under the link groups. Across the
            full width the two columns come out within ~35px of each other, and the merchant details
            get a line of their own instead of a 270px gutter that broke the e-mail mid-word. */}
        <MerchantBlock merchant={merchant} block={footerCopy} />

        <div className="footer__bottom">
          <div className="footer__payments">
            <span className="footer__eyebrow">Bezpečná platba</span>
            <div className="payment__logos">
              {paymentIcons.map((icon) => (
                <FooterIcon
                  key={icon.alt}
                  icon={icon.src}
                  href={icon.href}
                  alt={icon.alt}
                  className="footer__paymentLink"
                />
              ))}
            </div>
          </div>

          <div className="footer__legal">
            <p>© {currentYear} Keramická zahrada. Všechna práva vyhrazena.</p>
            <p>
              Design &amp; vývoj{" "}
              <a
                href="https://www.matejforejt.com"
                target="_blank"
                rel="noreferrer"
                className="maker__link"
              >
                ValeStudium
              </a>
            </p>
          </div>
        </div>
      </motion.div>
    </footer>
  )
}

type FooterEntry =
  | { label: string; href: string; action?: never }
  | { label: string; action: "contact" | "cookies"; href?: never }

function FooterLinkGroup({
  title,
  links,
}: {
  title: string
  links: readonly FooterEntry[]
}) {
  const { open } = useContactDialog()

  return (
    <div className="footer__linkGroup">
      <p className="footer__groupTitle">{title}</p>
      <div>
        {links.map((link) =>
          link.action ? (
            <button
              key={link.label}
              type="button"
              className="footer__dialogLink"
              onClick={() =>
                link.action === "contact" ? open() : openCookiePreferences()
              }
            >
              {link.label}
            </button>
          ) : (
            <FooterLink key={link.label} href={link.href} label={link.label} />
          )
        )}
      </div>
    </div>
  )
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <CollectionCategoryLink
      href={href}
      label={label}
      className="footer__animatedLink"
      color="var(--footer-ink)"
      hoverColor="var(--footer-ink)"
      hoverOpacity={0.56}
    />
  )
}

function FooterIcon({
  href,
  icon,
  alt,
  className,
  edit,
}: {
  href: string
  icon: string
  alt: string
  className: string
  /** Atributy překryvu z `editableLink`. Mimo náhled je to prázdný objekt. */
  edit?: Record<string, string | undefined>
}) {
  return (
    <a
      href={href}
      {...edit}
      className={className}
      target="_blank"
      rel="noreferrer"
      aria-label={alt}
    >
      <Image src={icon} alt={alt} width={96} height={48} />
    </a>
  )
}

/**
 * A real form again: it posts to the backend's newsletter list
 * (`POST /store/newsletter` via the `subscribeToNewsletter` server action).
 * Double opt-in: the backend stores the address as *pending* and sends a
 * confirmation e-mail — nothing arrives until its link is clicked, so the
 * success line says "check your inbox" rather than "you're in". The mailto
 * interlude existed because the old form discarded addresses silently — the
 * one failure a made-to-order atelier cannot afford. This one reports what
 * happened.
 */
function Newsletter({ block }: { block?: CopyBlock }) {
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle")

  const submit = async (formData: FormData) => {
    const email = String(formData.get("email") ?? "").trim()
    if (!email) {
      return
    }
    const result = await subscribeToNewsletter({ email })
    setStatus(result.ok ? "done" : "error")
  }

  if (status === "done") {
    return (
      <p className="newsletter__success" role="status">
        Děkujeme! Teď už jen potvrďte odběr v e-mailu, který jsme vám právě
        poslali.
      </p>
    )
  }

  return (
    <form className="newsletter__container" action={submit}>
      <label htmlFor="footer-newsletter-email" {...editable(block, "accent.1")}>
        {block?.accent?.[1]?.trim() || "Váš e-mail"}
      </label>
      <div className="newsletter__controls">
        <input
          id="footer-newsletter-email"
          name="email"
          type="email"
          placeholder="vas@email.cz"
          className="newsletter__input"
          autoComplete="email"
          required
        />
        {/* Obal, ne tlačítko: `PremiumActionButton` si vykresluje vlastní vnitřek a
            datové atributy by skončily na prvku, který se při animaci přepisuje. */}
        <span {...editable(block, "accent.2")}>
          <PremiumActionButton
            type="submit"
            text={block?.accent?.[2]?.trim() || "Odebírat"}
            compact
            className="newsletter__button"
          />
        </span>
      </div>
      {status === "error" ? (
        <p className="newsletter__error" role="alert">
          Nepovedlo se to uložit, zkuste to prosím znovu.
        </p>
      ) : null}
      <p {...editable(block, "accent.3")}>
        {block?.accent?.[3]?.trim() ||
          "Odesláním souhlasíte s tím, že váš e-mail použijeme jen pro zasílání novinek. Odběr ještě potvrdíte kliknutím v e-mailu."}
      </p>
    </form>
  )
}

/**
 * The seller's identity: the block a cautious Czech buyer looks for before paying.
 * Ink on the footer surface (7.8:1 on sage) rather than the muted token — this is
 * information to be read, not atmosphere.
 */
function MerchantBlock({
  merchant,
  block,
}: {
  merchant: MerchantIdentity
  block?: CopyBlock
}) {
  /*
   * Z CMS jdou POPISKY, ne hodnoty.
   *
   * Jméno, sídlo, IČO, e-mail a telefon nesou `getMerchantIdentity()` a proměnné prostředí,
   * a čtou je i obchodní podmínky, checkout, potvrzení objednávky a reklamační protokol.
   * Kdyby se přepisovaly tady, mohla by patička tvrdit něco jiného než doklad, který ze
   * stejných údajů vzniká — a to je rozpor, který se pozná až u reklamace.
   */
  const labels = block?.items ?? []
  const labelAt = (index: number, fallback: string) =>
    labels[index]?.label?.trim() || fallback

  /*
   * E-mail a telefon jdou z CMS včetně cíle odkazu.
   *
   * Řádek nese vypsaný tvar (`value`) a adresu odkazu (`note`), takže `editableLink` otevře
   * popup s obojím — jinak by šlo změnit číslo, ale ne to, kam volá. Prázdné pole spadne na
   * `getMerchantIdentity()`.
   *
   * POZOR: tytéž údaje čtou i obchodní podmínky, ochrana údajů, odstoupení od smlouvy,
   * doprava a platba, checkout a reklamační protokol — ty berou dál `getMerchantIdentity()`.
   * Změna tady se tedy projeví v patičce, ne v dokladech.
   */
  const textAt = (index: number, fallback: string) =>
    labels[index]?.value?.trim() || fallback
  const hrefAt = (index: number, fallback: string) =>
    labels[index]?.note?.trim() || fallback

  const rows: {
    label: string
    value: React.ReactNode
    labelField: string
  }[] = [
    { label: labelAt(0, "Prodávající"), value: merchant.name, labelField: "items.0.label" },
    { label: labelAt(1, "Sídlo"), value: merchant.address, labelField: "items.1.label" },
    {
      label: labelAt(2, "IČO"),
      value: merchant.registrationNumber,
      labelField: "items.2.label",
    },
    {
      label: labelAt(3, "E-mail"),
      labelField: "items.3.label",
      value: (
        <a
          href={hrefAt(3, `mailto:${merchant.email}`)}
          {...editableLink(block, { text: "items.3.value", href: "items.3.note" })}
        >
          {textAt(3, merchant.email)}
        </a>
      ),
    },
    {
      label: labelAt(4, "Telefon"),
      labelField: "items.4.label",
      value: (
        <a
          href={hrefAt(4, `tel:${merchant.phoneDial}`)}
          {...editableLink(block, { text: "items.4.value", href: "items.4.note" })}
        >
          {textAt(4, merchant.phone)}
        </a>
      ),
    },
  ]

  return (
    <dl className="footer__identity">
      {rows.map((row, index) => (
        <div key={row.label}>
          <dt {...editable(block, row.labelField)}>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function getPreviousVisualElement(footer: HTMLElement) {
  let anchor: HTMLElement | null = footer

  while (anchor && !anchor.previousElementSibling) {
    const parentElement: HTMLElement | null = anchor.parentElement

    if (!parentElement || parentElement === document.body) {
      break
    }

    anchor = parentElement
  }

  return anchor?.previousElementSibling instanceof HTMLElement
    ? anchor.previousElementSibling
    : null
}

function getVisualSurface(element: HTMLElement | null) {
  if (!element) {
    return DEFAULT_SURFACE
  }

  const explicitSurface =
    element.dataset.footerSurface ??
    element.querySelector<HTMLElement>("[data-footer-surface]")?.dataset
      .footerSurface

  if (explicitSurface && parseColor(explicitSurface)) {
    return explicitSurface
  }

  const bounds = element.getBoundingClientRect()
  const sampleY = bounds.bottom - 2
  const candidates = [
    element,
    ...Array.from(element.querySelectorAll<HTMLElement>("*")),
  ]
  const samplePoints = [8, window.innerWidth - 8, window.innerWidth / 2]

  for (const sampleX of samplePoints) {
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index]
      const candidateBounds = candidate.getBoundingClientRect()

      if (
        sampleX < candidateBounds.left ||
        sampleX > candidateBounds.right ||
        sampleY < candidateBounds.top ||
        sampleY > candidateBounds.bottom
      ) {
        continue
      }

      const background = window.getComputedStyle(candidate).backgroundColor
      const parsed = parseColor(background)

      if (parsed && parsed.alpha > 0.12) {
        return toOpaqueColor(parsed, getDocumentSurface())
      }
    }
  }

  let current: HTMLElement | null = element

  while (current) {
    const parsed = parseColor(window.getComputedStyle(current).backgroundColor)

    if (parsed && parsed.alpha > 0.12) {
      return toOpaqueColor(parsed, getDocumentSurface())
    }

    current = current.parentElement
  }

  return getDocumentSurface()
}

function getDocumentSurface() {
  const body = parseColor(window.getComputedStyle(document.body).backgroundColor)
  const html = parseColor(
    window.getComputedStyle(document.documentElement).backgroundColor
  )
  const surface =
    body && body.alpha > 0.12
      ? body
      : html && html.alpha > 0.12
        ? html
        : parseColor(DEFAULT_SURFACE)

  return surface ? toOpaqueColor(surface, DEFAULT_SURFACE) : DEFAULT_SURFACE
}

function getTone(color: string): FooterTone {
  const parsed = parseColor(color)

  if (!parsed) {
    return "light"
  }

  const linear = [parsed.red, parsed.green, parsed.blue].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  const luminance =
    0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]

  return luminance < 0.34 ? "dark" : "light"
}

function parseColor(color: string) {
  const match = color.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i
  )

  if (!match) {
    if (/^#[\da-f]{6}$/i.test(color)) {
      return {
        red: Number.parseInt(color.slice(1, 3), 16),
        green: Number.parseInt(color.slice(3, 5), 16),
        blue: Number.parseInt(color.slice(5, 7), 16),
        alpha: 1,
      }
    }

    return null
  }

  return {
    red: Number(match[1]),
    green: Number(match[2]),
    blue: Number(match[3]),
    alpha: match[4] === undefined ? 1 : Number(match[4]),
  }
}

function toOpaqueColor(
  color: NonNullable<ReturnType<typeof parseColor>>,
  backdrop: string
) {
  if (color.alpha >= 0.995) {
    return `rgb(${Math.round(color.red)}, ${Math.round(color.green)}, ${Math.round(color.blue)})`
  }

  const parsedBackdrop =
    parseColor(backdrop) ?? parseColor(DEFAULT_SURFACE)!
  const blend = (foreground: number, background: number) =>
    Math.round(
      foreground * color.alpha + background * (1 - color.alpha)
    )

  return `rgb(${blend(color.red, parsedBackdrop.red)}, ${blend(color.green, parsedBackdrop.green)}, ${blend(color.blue, parsedBackdrop.blue)})`
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const viewport = { once: true, amount: 0.08 }
