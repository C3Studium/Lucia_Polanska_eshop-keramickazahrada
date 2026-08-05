"use client"

import CollectionCategoryLink from "@modules/layout/Navbar/productsButton/CategoryLink"
import { useContactDialog } from "@modules/layout/ContactDialog"
import type { MerchantIdentity } from "@lib/data/merchant"
import { subscribeToNewsletter } from "@lib/data/newsletter"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import { paymentIcons } from "constants/icons"
import { motion } from "framer-motion"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react"

type FooterTone = "light" | "dark"

const DEFAULT_SURFACE = "#bbb788"

const currentYear = new Date().getFullYear()

// One label per destination: "Smluvní podmínky" and "Obchodní podmínky" both pointed here,
// under two names, for a page that calls itself Obchodní podmínky.
const importantLinks = [
  { label: "Obchodní podmínky", href: "/smluvni-podminky" },
  { label: "Ochrana osobních údajů", href: "/ochrana-osobnich-udaju" },
  { label: "Používání cookies", href: "/cookies" },
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

const reveal = {
  hidden: { opacity: 0, y: 26 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.72,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
}

export default function Footer({ merchant }: { merchant: MerchantIdentity }) {
  const pathname = usePathname()
  const footerRef = useRef<HTMLElement>(null)
  const [surface, setSurface] = useState(DEFAULT_SURFACE)
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
        initial="hidden"
        whileInView="visible"
        viewport={viewport}
        variants={reveal}
      >
        <div className="footer__topline">
          <span>Keramická zahrada</span>
          <span>Ateliér Lucie Polanské · Písek</span>
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
              <span>00 · PATIČKA</span>
            </div>

            {/* Styled as a heading, but not one: the footer repeats on every page and used
                to inject an h2 + two h3s into each page's outline (spec §6). */}
            <p className="footer__wordmark">
              Keramická <em>zahrada.</em>
            </p>

            <p className="footer__statement">
              Objekty z hlíny pro zahradu i domov. Každý kus vzniká rukama
              v píseckém ateliéru.
            </p>

            <MerchantBlock merchant={merchant} />

            <div className="footer__socials" aria-label="Sociální sítě">
              {socialLinks.map((link) => (
                <FooterIcon
                  key={link.label}
                  href={link.href}
                  icon={link.icon}
                  alt={link.label}
                  className="footer__socialLink"
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
                <span>Novinky · 01</span>
                <p id="newsletter-title" className="footer__newsletterTitle">Zůstaňte blízko ateliéru.</p>
                <p>Nové objekty a termíny kurzů bez zbytečného hluku.</p>
              </div>
              <Newsletter />
            </section>

            <nav className="footer__navigation" aria-label="Navigace v patičce">
              <FooterLinkGroup title="Informace" links={importantLinks} />
              <FooterLinkGroup title="Objevovat" links={discoverLinks} />
              <FooterLinkGroup title="Pomoc" links={helpLinks} />
            </nav>
          </div>
        </div>

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
  | { label: string; action: "contact"; href?: never }

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
          link.action === "contact" ? (
            <button
              key={link.label}
              type="button"
              className="footer__dialogLink"
              onClick={() => open()}
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
}: {
  href: string
  icon: string
  alt: string
  className: string
}) {
  return (
    <a
      href={href}
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
 * (`POST /store/newsletter` via the `subscribeToNewsletter` server action),
 * which stores the address and sends the welcome e-mail. The mailto interlude
 * existed because the old form discarded addresses silently — the one failure
 * a made-to-order atelier cannot afford. This one reports what happened.
 */
function Newsletter() {
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
        Děkujeme — jste blízko ateliéru.
      </p>
    )
  }

  return (
    <form className="newsletter__container" action={submit}>
      <label htmlFor="footer-newsletter-email">Váš e-mail</label>
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
        <PremiumActionButton
          type="submit"
          text="Odebírat"
          compact
          className="newsletter__button"
        />
      </div>
      {status === "error" ? (
        <p className="newsletter__error" role="alert">
          Uložení se nepodařilo, zkuste to prosím znovu.
        </p>
      ) : null}
      <p>Odesláním souhlasíte se zpracováním e-mailu pro zasílání novinek.</p>
    </form>
  )
}

/**
 * The seller's identity: the block a cautious Czech buyer looks for before paying.
 * Ink on the footer surface (7.8:1 on sage) rather than the muted token — this is
 * information to be read, not atmosphere.
 */
function MerchantBlock({ merchant }: { merchant: MerchantIdentity }) {
  return (
    <dl className="footer__identity">
      <div>
        <dt>Prodávající</dt>
        <dd>{merchant.name}</dd>
      </div>
      <div>
        <dt>Sídlo</dt>
        <dd>{merchant.address}</dd>
      </div>
      <div>
        <dt>IČO</dt>
        <dd>{merchant.registrationNumber}</dd>
      </div>
      <div>
        <dt>E-mail</dt>
        <dd>
          <a href={`mailto:${merchant.email}`}>{merchant.email}</a>
        </dd>
      </div>
      <div>
        <dt>Telefon</dt>
        <dd>
          <a href={`tel:${merchant.phoneDial}`}>{merchant.phone}</a>
        </dd>
      </div>
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
