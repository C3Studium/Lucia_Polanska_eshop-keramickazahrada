"use client"

import WebButton from "@modules/common/components/Buttons/webButton"
import MouseAnim from "@modules/common/components/MouseAnim"
import PhoneInput from "@modules/common/components/phone-input"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useId, useRef, useState, type FormEvent } from "react"

import type { MerchantIdentity } from "@lib/data/merchant"
import { itemValue } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"
import {
  backdropVariants,
  closeButtonWidth,
  closeLabelVariants,
  closeTransition,
  contentVariants,
  detailsVariants,
  itemVariants,
  overlayVariants,
  panelVariants,
  scrollCueTransition,
  scrollCueVariants,
  statusVariants,
  visualPanelVariants,
} from "./motion"
import MapEmbed from "./map-embed"
import styles from "./style.module.scss"

export const inquiryOptions = [
  "Obecný dotaz",
  "Zakázka",
  "Objednávka",
  "Kurzy",
] as const

export type Inquiry = (typeof inquiryOptions)[number]

/**
 * Režim „Změna objednávky" (12. 10. 2026, Matěj) — ze stránky úpravy
 * objednávky, kde si zákazník už nemění zboží sám. Bez výběru tématu (předmět
 * je daný: změna objednávky #N), bez jména a e-mailu (backend je vezme
 * z objednávky ověřené tokenem), jen zpráva a POVINNÝ telefon, ať Lucie může
 * zavolat. Posílá se na tentýž `/store/contact` s `kind: "order_change"`.
 */
export type OrderChangeRequest = {
  orderId: string
  /** Číslo objednávky pro zákazníka (#42). */
  displayId: number | string
  /** Podepsaný token stránky úpravy — backend podle něj ověří objednávku. */
  token: string
  /** Předvyplněný telefon (z doručovací adresy), je-li. */
  phone?: string | null
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent" }
  | { kind: "failed"; message: string }

type ContactDialogPanelProps = {
  merchant: MerchantIdentity
  initialTopic: Inquiry
  /** Režim „Změna objednávky"; `null`/chybí = běžný kontaktní formulář. */
  orderChange?: OrderChangeRequest | null
  onClose: () => void
  /** Blok `global.kontaktni-okno` — viz `dialogText`. */
  copy?: CopyBlock
}

/*
 * Redakční texty okna z bloku `global.kontaktni-okno`, položky klíčované
 * popiskem (jako `global.prihlaseni`). Nový klíč, ne `global.kontakt`: ten
 * blok přišel migrací ze Sanity (`contactTitle` v `title`, nadpis newsletteru
 * v `headline`, zbytek rozsypaný do `items`) a jeho první přečtení by na
 * živém webu vyměnilo dnešní texty okna za staré — a seed by do něj kvůli
 * vyplněným polím už nic nedoplnil.
 *
 * Témata se párují pozicí s `inquiryOptions`: CMS mění jen to, co je na
 * tlačítku napsané. Do zprávy (`Téma: …`) i do `initialTopic` jde dál hodnota
 * z kódu, aby nic, co se na téma ptá, nezáviselo na znění ve Studiu.
 *
 * V kódu zůstává: souhlas se zpracováním údajů pod formulářem, popisky polí,
 * nápovědy, chybové hlášky a celý režim „Změna objednávky" kromě nadpisů.
 * Věty po odeslání nesou adresu obchodu — v CMS se píše zástupce `{email}`.
 */
const TOPIC_LABELS = ["tema.obecny", "tema.zakazka", "tema.objednavka", "tema.kurzy"] as const

const DIALOG_DEFAULTS: Record<string, string> = {
  "hlavicka.stitek": "Kontakt · Ateliér",
  "hlavicka.odpoved": "Ozvu se do dvou pracovních dnů",
  "nadpis.oboci": "Napište přímo do ateliéru",
  nadpis: "Napište mi.",
  "nadpis.zmena": "Co potřebujete změnit?",
  "nadpis.zvyrazneni": "Ozvu se osobně.",
  "temata.otazka": "S čím vám můžu pomoct?",
  "odeslano.nadpis": "Zpráva odešla.",
  "odeslano.text":
    "Děkuju — ozvu se vám do dvou pracovních dnů. Když stojím u pece, může to výjimečně trvat o kousek déle. Kopii zprávy jsem vám neposílala; kdybyste si nebyli jistí, napište mi kdykoliv na {email}.",
  "zmena-odeslano.nadpis": "Žádost o změnu odešla.",
  "zmena-odeslano.text":
    "Děkuju — změnu s vámi domluvím osobně: zavolám vám, nebo odepíšu e-mailem, zpravidla do dvou pracovních dnů. Objednávka zatím zůstává, jak byla. Kdybyste mezitím potřebovali cokoli doplnit, napište mi na {email}.",
  faq: "Nejprve se podívat do FAQ",
}

/** Text okna z CMS podle popisku, nebo výchozí z kódu. */
const dialogText = (copy: CopyBlock | undefined, label: string, fallback = DIALOG_DEFAULTS[label]) =>
  itemValue(copy, label)?.trim() || fallback

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const contactEndpoint = () =>
  `${(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "").replace(/\/+$/, "")}/store/contact`

/**
 * Přeteklo to? Pak se ukáže nápověda, ať člověk ví, že má rolovat.
 *
 * ## Proč se to neptá na šířku okna
 *
 * Modál je vysoký podle toho, co v něm je — a to je různé: „Zakázka" má jiný
 * formulář než „Obecný dotaz", chybová hláška přidá řádek, delší jméno zalomí
 * popisek. Pravidlo podle šířky by v půlce případů lhalo oběma směry: na
 * velkém okně by nápovědu schovalo, i když se obsah nevešel, a na malém ji
 * ukázalo, i když bylo všechno vidět.
 *
 * Ptá se tedy prvku, jestli má co rolovat. Tím zároveň odpadá ladění
 * responzivních stop pro každou variantu formuláře.
 *
 * ## Proč i `ResizeObserver`
 *
 * Obsah se mění za běhu — přepnutím tématu, odesláním, rozbalením chyby —
 * a okno se dá zvětšit. Jedno změření při otevření by platilo jen do prvního
 * kliknutí.
 */
function usePreteklo(ref: React.RefObject<HTMLElement | null>) {
  const [preteklo, setPreteklo] = useState(false)
  const [rolovano, setRolovano] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    /* 24px tolerance: pár pixelů navíc není důvod něco radit. */
    const zmer = () => setPreteklo(el.scrollHeight - el.clientHeight > 24)

    zmer()
    const ro = new ResizeObserver(zmer)
    ro.observe(el)
    /* Sleduje se i obsah: přepnuté téma změní výšku, aniž by se změnil rám. */
    for (const dite of Array.from(el.children)) ro.observe(dite)

    /* Jakmile člověk začne rolovat, nápovědu už nepotřebuje. */
    const naRolovani = () => setRolovano(el.scrollTop > 8)
    el.addEventListener("scroll", naRolovani, { passive: true })

    return () => {
      ro.disconnect()
      el.removeEventListener("scroll", naRolovani)
    }
  }, [ref])

  return preteklo && !rolovano
}

export default function ContactDialogPanel({
  merchant,
  initialTopic,
  orderChange = null,
  onClose,
  copy,
}: ContactDialogPanelProps) {
  const text = (label: string) => dialogText(copy, label)
  const edit = (label: string) => editableItem(copy, label)
  const [inquiry, setInquiry] = useState<Inquiry>(initialTopic)
  const [hoveredInquiry, setHoveredInquiry] = useState<Inquiry | null>(null)
  const [closeHovered, setCloseHovered] = useState(false)
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" })
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const formSloupecRef = useRef<HTMLDivElement>(null)
  const ukazNapovedu = usePreteklo(formSloupecRef)
  const fieldId = useId()

  // The form panel scrolls, so a failure can land below the fold on the exact click that
  // caused it. Screen readers get it from role="alert"; everyone else needs it brought up.
  useEffect(() => {
    if (submitState.kind === "failed") {
      statusRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [submitState])

  // Escape closes; Tab cycles inside the dialog rather than escaping to the page behind it.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
        return
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((element) => element.offsetParent !== null)

      if (!focusable.length) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const previousOverflow = document.body.style.overflow
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 180)

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (submitState.kind === "submitting") {
      return
    }

    const data = new FormData(event.currentTarget)
    const read = (field: string) => String(data.get(field) ?? "").trim()
    const phone = read("phone")

    setSubmitState({ kind: "submitting" })

    try {
      const response = await fetch(contactEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // The /store namespace refuses requests without the publishable key.
          ...(process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
            ? {
                "x-publishable-api-key":
                  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
              }
            : {}),
        },
        body: JSON.stringify(
          orderChange
            ? {
                // Změna objednávky: jméno, e-mail a číslo bere backend
                // z objednávky ověřené tokenem; předmět je daný.
                kind: "order_change",
                order_id: orderChange.orderId,
                token: orderChange.token,
                phone,
                message: read("message"),
                website: read("website"),
              }
            : {
                name: read("name"),
                email: read("email"),
                ...(phone ? { phone } : {}),
                // The topic rides along in the message so the agreed contract stays as it is.
                message: `Téma: ${inquiry}\n\n${read("message")}`,
                website: read("website"),
              }
        ),
      })

      if (response.ok) {
        setSubmitState({ kind: "sent" })
        return
      }

      setSubmitState({ kind: "failed", message: failureMessage(response.status) })
    } catch {
      setSubmitState({ kind: "failed", message: failureMessage(0) })
    }
  }

  return (
    <motion.div
      className={styles.overlay}
      /* body{overflow:hidden} below only blocks *user* scrolling; Lenis scrolls programmatically
         and ignored it, so the page moved behind the dialog. */
      data-lenis-prevent
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.button
        type="button"
        className={styles.backdrop}
        aria-label="Zavřít kontaktní formulář"
        onClick={onClose}
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      />

      <motion.section
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${fieldId}-title`}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <header className={styles.panelHeader}>
          <div className={styles.panelMeta}>
            <span {...(orderChange ? {} : edit("hlavicka.stitek"))}>
              {orderChange
                ? `Změna objednávky #${orderChange.displayId}`
                : text("hlavicka.stitek")}
            </span>
            {/* Věta ve vlastním spanu — řádek je `inline-flex`, takže span je
                tentýž flex prvek, jakým byl holý text, a tečku (`i`) editor
                nepřepíše. */}
            <span className={styles.availability}>
              <i aria-hidden="true" />{" "}
              <span {...edit("hlavicka.odpoved")}>{text("hlavicka.odpoved")}</span>
            </span>
          </div>
          <motion.button
            ref={closeRef}
            type="button"
            className={styles.close}
            aria-label="Zavřít"
            onClick={onClose}
            onHoverStart={() => setCloseHovered(true)}
            onHoverEnd={() => setCloseHovered(false)}
            initial={false}
            animate={{
              width: closeHovered ? closeButtonWidth.hovered : closeButtonWidth.rest,
            }}
            transition={closeTransition}
            style={styleObj}
          >
            <AnimatePresence initial={false}>
              {closeHovered && (
                <motion.span
                  variants={closeLabelVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  Zavřít
                </motion.span>
              )}
            </AnimatePresence>
            <i aria-hidden="true" />
          </motion.button>
        </header>

        <div className={styles.panelBody}>
          <motion.div
            ref={formSloupecRef}
            className={styles.formPanel}
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <motion.div className={styles.title} variants={itemVariants}>
              <span
                className={styles.eyebrow}
                {...(orderChange ? {} : edit("nadpis.oboci"))}
              >
                {orderChange
                  ? `Změna objednávky #${orderChange.displayId}`
                  : text("nadpis.oboci")}
              </span>
              {/* Nadpis v holém spanu jen kvůli anotaci — zvýrazněný konec
                  je jiná položka bloku. */}
              <h2 id={`${fieldId}-title`}>
                <span {...edit(orderChange ? "nadpis.zmena" : "nadpis")}>
                  {orderChange ? text("nadpis.zmena") : text("nadpis")}
                </span>
                <em {...edit("nadpis.zvyrazneni")}>{text("nadpis.zvyrazneni")}</em>
              </h2>
            </motion.div>

            {submitState.kind === "sent" ? (
              <SentMessage
                email={merchant.email}
                onClose={onClose}
                orderChange={Boolean(orderChange)}
                copy={copy}
              />
            ) : orderChange ? (
              /* Změna objednávky (12. 10. 2026, Matěj): bez témat, jména
                 a e-mailu — jen zpráva a povinný telefon. Číslo objednávky
                 jede s žádostí samo. */
              <motion.form
                className={styles.form}
                onSubmit={handleSubmit}
                variants={itemVariants}
                noValidate={false}
              >
                <div className={`${styles.field} ${styles.message}`}>
                  <label htmlFor={`${fieldId}-message`}>
                    Co potřebujete změnit <i>(povinné)</i>
                  </label>
                  <textarea
                    id={`${fieldId}-message`}
                    className={styles.input}
                    name="message"
                    placeholder="Např. přidat ještě jeden hrnek, vyměnit barvu talíře, jeden kus ubrat…"
                    required
                  />
                </div>

                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <label htmlFor={`${fieldId}-phone`}>
                      Telefon <i>(povinné — ať vám můžu zavolat)</i>
                    </label>
                    <PhoneInput
                      id={`${fieldId}-phone`}
                      name="phone"
                      className={styles.phoneRow}
                      inputClassName={styles.input}
                      placeholder="603 123 456"
                      defaultValue={orderChange.phone ?? undefined}
                      required
                    />
                  </div>
                </div>

                <div className={styles.honeypot} aria-hidden="true">
                  <label htmlFor={`${fieldId}-website`}>Nevyplňujte</label>
                  <input
                    id={`${fieldId}-website`}
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <AnimatePresence>
                  {submitState.kind === "failed" && (
                    <motion.p
                      ref={statusRef}
                      className={`${styles.status} ${styles.statusError}`}
                      role="alert"
                      variants={statusVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      {submitState.message}{" "}
                      <a href={`mailto:${merchant.email}`}>{merchant.email}</a>
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className={styles.formFooter}>
                  <p>
                    Zprávu pošlu k objednávce #{orderChange.displayId}. Ozvu se
                    telefonem, nebo odpovím na e-mail, který jste zadali
                    v objednávce.
                  </p>
                  <WebButton
                    Kind="Button"
                    title={
                      submitState.kind === "submitting"
                        ? "Odesíláme…"
                        : "Odeslat žádost o změnu"
                    }
                    type="submit"
                    disabled={submitState.kind === "submitting"}
                    className={styles.submitButton}
                  />
                </div>
              </motion.form>
            ) : (
              <motion.form
                className={styles.form}
                onSubmit={handleSubmit}
                variants={itemVariants}
                noValidate={false}
              >
                <fieldset className={styles.topics}>
                  <legend {...edit("temata.otazka")}>{text("temata.otazka")}</legend>
                  <div onMouseLeave={() => setHoveredInquiry(null)}>
                    {inquiryOptions.map((option, index) => {
                      const highlighted = (hoveredInquiry ?? inquiry) === option
                      // Napsané z CMS, hodnota tématu z kódu (viz TOPIC_LABELS).
                      const topicLabel = dialogText(copy, TOPIC_LABELS[index], option)

                      return (
                        <button
                          type="button"
                          key={option}
                          className={highlighted ? styles.topicActive : ""}
                          aria-pressed={inquiry === option}
                          onMouseEnter={() => setHoveredInquiry(option)}
                          onFocus={() => setHoveredInquiry(option)}
                          onBlur={() => setHoveredInquiry(null)}
                          onClick={() => setInquiry(option)}
                        >
                          {highlighted && (
                            <motion.span
                              className={styles.topicIndicator}
                              layoutId="contact-topic-indicator"
                              transition={transition}
                            />
                          )}
                          <span
                            className={styles.topicLabel}
                            {...edit(TOPIC_LABELS[index])}
                          >
                            {topicLabel}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                <div className={styles.fieldGrid}>
                  <Field
                    id={`${fieldId}-name`}
                    name="name"
                    label="Jméno"
                    type="text"
                    autoComplete="name"
                    placeholder="Vaše jméno"
                    required
                  />
                  <Field
                    id={`${fieldId}-email`}
                    name="email"
                    label="E-mail"
                    type="email"
                    autoComplete="email"
                    placeholder="vas@email.cz"
                    required
                  />
                  {/* Předvolba jede rozbaleníkem PhoneInputu (výchozí podle země
                      v adrese), takže placeholder „+420" ztratil práci. */}
                  <div className={styles.field}>
                    <label htmlFor={`${fieldId}-phone`}>
                      Telefon <i>(nepovinné)</i>
                    </label>
                    <PhoneInput
                      id={`${fieldId}-phone`}
                      name="phone"
                      className={styles.phoneRow}
                      inputClassName={styles.input}
                      placeholder="603 123 456"
                    />
                  </div>
                </div>

                <div className={`${styles.field} ${styles.message}`}>
                  <label htmlFor={`${fieldId}-message`}>
                    Vaše zpráva <i>(povinné)</i>
                  </label>
                  <textarea
                    id={`${fieldId}-message`}
                    className={styles.input}
                    name="message"
                    placeholder="Napište, co potřebujete — otázku, představu, cokoliv…"
                    required
                  />
                </div>

                <div className={styles.honeypot} aria-hidden="true">
                  <label htmlFor={`${fieldId}-website`}>Nevyplňujte</label>
                  <input
                    id={`${fieldId}-website`}
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <AnimatePresence>
                  {submitState.kind === "failed" && (
                    <motion.p
                      ref={statusRef}
                      className={`${styles.status} ${styles.statusError}`}
                      role="alert"
                      variants={statusVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      {submitState.message}{" "}
                      <a href={`mailto:${merchant.email}`}>{merchant.email}</a>
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className={styles.formFooter}>
                  <p>
                    Odesláním souhlasíte s tím, že vaše údaje použiju jen k odpovědi
                    na tuhle zprávu.
                  </p>
                  <WebButton
                    Kind="Button"
                    title={
                      submitState.kind === "submitting"
                        ? "Odesíláme…"
                        : "Odeslat zprávu"
                    }
                    type="submit"
                    disabled={submitState.kind === "submitting"}
                    className={styles.submitButton}
                  />
                </div>
              </motion.form>
            )}
          </motion.div>

          {/*
            Nápověda „dole toho je víc". Leží nad formulářovým sloupcem, ne
            v něm — uvnitř by se odrolovala pryč zrovna ve chvíli, kdy má
            ukazovat, že se rolovat dá. `aria-hidden`, protože pro odečítač
            obrazovky je scrollovatelná oblast poznat i bez ní.
          */}
          <AnimatePresence>
            {ukazNapovedu && (
              <motion.div
                className={styles.scrollCue}
                aria-hidden="true"
                initial={scrollCueVariants.hidden}
                animate={scrollCueVariants.visible}
                exit={scrollCueVariants.hidden}
                transition={scrollCueTransition}
              >
                <span className={styles.scrollCueInner}>
                  <MouseAnim />
                  <span>Posuňte pro zbytek formuláře</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.aside
            className={styles.visualPanel}
            variants={visualPanelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Mapa Google až po kliknutí, nebo rovnou s marketingovým
                souhlasem — viz `./map-embed.tsx`. */}
            <MapEmbed
              address={merchant.address}
              title="Mapa — ateliér Lucie Polanské, Putim"
            />

            <motion.div
              className={styles.details}
              variants={detailsVariants}
              initial="hidden"
              animate="visible"
            >
              <div>
                <span>E-mail</span>
                <a href={`mailto:${merchant.email}`}>{merchant.email}</a>
              </div>
              <div>
                <span>Telefon</span>
                <a href={`tel:${merchant.phoneDial}`}>{merchant.phone}</a>
              </div>
              <div>
                <span>Adresa</span>
                <p>{merchant.address}</p>
              </div>
              {/* Odkaz vede dovnitř webu — z CMS jde jen jeho text, cíl drží kód.
                  Bez anotace v místě: každý span v odkazu se při najetí posune
                  (`.faqLink span`), takže text nejde obalit, a celý odkaz by
                  editor uložil i se šipkou. Upravuje se ve formuláři bloku. */}
              <LocalizedClientLink href="/dotazy" className={styles.faqLink}>
                {text("faq")} <span aria-hidden="true">↗</span>
              </LocalizedClientLink>
            </motion.div>
          </motion.aside>
        </div>
      </motion.section>
    </motion.div>
  )
}

type FieldProps = {
  id: string
  name: string
  label: string
  type: string
  autoComplete: string
  placeholder: string
  required?: boolean
  hint?: string
}

function Field({ id, name, label, hint, required, ...input }: FieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label} <i>{hint ? `(${hint})` : "(povinné)"}</i>
      </label>
      <input id={id} name={name} className={styles.input} required={required} {...input} />
    </div>
  )
}

function SentMessage({
  email,
  onClose,
  orderChange = false,
  copy,
}: {
  email: string
  onClose: () => void
  /** Žádost o změnu objednávky — slib zavolat / odepsat místo obecné věty. */
  orderChange?: boolean
  /** Blok `global.kontaktni-okno` (`odeslano.*`, `zmena-odeslano.*`). */
  copy?: CopyBlock
}) {
  const prefix = orderChange ? "zmena-odeslano" : "odeslano"
  /* `{email}` je zástupce adresy obchodu. Věta se proto v místě neanotuje —
     editor by uložil adresu místo zástupce; upravuje se ve formuláři. */
  /* Náhrada funkcí, ne řetězcem: v řetězci by `$&`, `$1`… v adrese
     `replace` vyložil jako odkaz na shodu a větu rozbil. */
  const text = dialogText(copy, `${prefix}.text`).replace(/\{email\}/g, () => email)

  return (
    <div className={styles.successPanel} role="status">
      <h3 {...editableItem(copy, `${prefix}.nadpis`)}>
        {dialogText(copy, `${prefix}.nadpis`)}
      </h3>
      <p>{text}</p>
      <WebButton
        Kind="Button"
        title="Zavřít"
        onClickAction={onClose}
        className={styles.submitButton}
      />
    </div>
  )
}

function failureMessage(status: number) {
  if (status === 400) {
    return "Zkontrolujte prosím vyplněné údaje — něco chybí, nebo je to v jiném tvaru. Nebo mi napište rovnou na"
  }

  // Jen režim „Změna objednávky": token stránky úpravy neprošel.
  if (status === 401 || status === 404) {
    return "Objednávku se nepodařilo ověřit — otevřete prosím odkaz z posledního e-mailu, nebo mi napište rovnou na"
  }

  if (status === 429) {
    return "Přišlo příliš mnoho zpráv krátce po sobě. Zkuste to prosím za chvíli, nebo mi napište rovnou na"
  }

  return "Zprávu se nepovedlo odeslat. Zkuste to prosím znovu, nebo mi napište rovnou na"
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const styleObj = { transformOrigin: "right center" as const }
const transition = {
                                type: "spring" as const,
                                stiffness: 420,
                                damping: 36,
                                mass: 0.7,
                              }
