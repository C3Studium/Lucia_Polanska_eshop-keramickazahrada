"use client"

import WebButton from "@modules/common/components/Buttons/webButton"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import { useEffect, useId, useRef, useState, type FormEvent } from "react"

import type { MerchantIdentity } from "@lib/data/merchant"
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
  statusVariants,
  visualPanelVariants,
} from "./motion"
import styles from "./style.module.scss"

export const inquiryOptions = [
  "Obecný dotaz",
  "Zakázka",
  "Objednávka",
  "Kurzy",
] as const

export type Inquiry = (typeof inquiryOptions)[number]

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent" }
  | { kind: "failed"; message: string }

type ContactDialogPanelProps = {
  merchant: MerchantIdentity
  initialTopic: Inquiry
  onClose: () => void
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The contact endpoint is only wired once the backend route exists (D-S1). Until the flag is
 * set, the dialog shows the ways to reach the atelier directly — a dead form must never ship.
 */
const isFormEnabled = process.env.NEXT_PUBLIC_CONTACT_FORM_ENABLED === "true"

const contactEndpoint = () =>
  `${(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "").replace(/\/+$/, "")}/store/contact`

export default function ContactDialogPanel({
  merchant,
  initialTopic,
  onClose,
}: ContactDialogPanelProps) {
  const [inquiry, setInquiry] = useState<Inquiry>(initialTopic)
  const [hoveredInquiry, setHoveredInquiry] = useState<Inquiry | null>(null)
  const [closeHovered, setCloseHovered] = useState(false)
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" })
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: read("name"),
          email: read("email"),
          ...(phone ? { phone } : {}),
          // The topic rides along in the message so the agreed contract stays as it is.
          message: `Téma: ${inquiry}\n\n${read("message")}`,
          website: read("website"),
        }),
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
            <span>Kontakt · Ateliér</span>
            <span className={styles.availability}>
              <i aria-hidden="true" /> Odpovídáme do 2 pracovních dnů
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
            className={styles.formPanel}
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <motion.div className={styles.title} variants={itemVariants}>
              <span className={styles.eyebrow}>Kontakt přímo do ateliéru</span>
              <h2 id={`${fieldId}-title`}>
                Napište mi.<em>Ozvu se osobně.</em>
              </h2>
            </motion.div>

            {!isFormEnabled ? (
              <DirectContact merchant={merchant} />
            ) : submitState.kind === "sent" ? (
              <SentMessage email={merchant.email} onClose={onClose} />
            ) : (
              <motion.form
                className={styles.form}
                onSubmit={handleSubmit}
                variants={itemVariants}
                noValidate={false}
              >
                <fieldset className={styles.topics}>
                  <legend>S čím vám můžeme pomoci?</legend>
                  <div onMouseLeave={() => setHoveredInquiry(null)}>
                    {inquiryOptions.map((option) => {
                      const highlighted = (hoveredInquiry ?? inquiry) === option

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
                          <span className={styles.topicLabel}>{option}</span>
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
                  <Field
                    id={`${fieldId}-phone`}
                    name="phone"
                    label="Telefon"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+420"
                    hint="nepovinné"
                  />
                </div>

                <div className={`${styles.field} ${styles.message}`}>
                  <label htmlFor={`${fieldId}-message`}>
                    Vaše zpráva <i>(povinné)</i>
                  </label>
                  <textarea
                    id={`${fieldId}-message`}
                    className={styles.input}
                    name="message"
                    placeholder="Popište svou představu, otázku nebo projekt…"
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
                    Odesláním souhlasíte se zpracováním údajů pouze pro vyřízení této
                    zprávy.
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

          <motion.aside
            className={styles.visualPanel}
            variants={visualPanelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Image
              src="/assets/img/faq/FAQ2.png"
              alt="Lucie Polanská při práci v keramickém ateliéru"
              fill
              sizes="(max-width: 760px) 100vw, 40vw"
              priority
            />
            <div className={styles.visualShade} />
            <div className={styles.visualMeta}>
              <span>Ateliér Lucie Polanské</span>
              <span>Putim · jižní Čechy</span>
            </div>

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
              <LocalizedClientLink href="/dotazy" className={styles.faqLink}>
                Nejprve se podívat do FAQ <span aria-hidden="true">↗</span>
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

function SentMessage({ email, onClose }: { email: string; onClose: () => void }) {
  return (
    <div className={styles.successPanel} role="status">
      <h3>Zpráva odešla.</h3>
      <p>
        Děkujeme — ozveme se vám do dvou pracovních dnů. Během práce u pece to
        výjimečně může trvat o něco déle. Kopii jsme neposílali; pokud si nejste jistí,
        napište nám kdykoli na {email}.
      </p>
      <WebButton
        Kind="Button"
        title="Zavřít"
        onClickAction={onClose}
        className={styles.submitButton}
      />
    </div>
  )
}

function DirectContact({ merchant }: { merchant: MerchantIdentity }) {
  return (
    <div className={styles.directContact}>
      <p>
        Napište nebo zavolejte přímo do ateliéru — ozveme se vám do dvou pracovních
        dnů.
      </p>
      <dl className={styles.directContactList}>
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
        <div>
          <dt>Adresa</dt>
          <dd>{merchant.address}</dd>
        </div>
      </dl>
    </div>
  )
}

function failureMessage(status: number) {
  if (status === 400) {
    return "Zkontrolujte prosím vyplněné údaje — něco chybí nebo je v jiném tvaru, než čekáme. Nebo nám napište přímo na"
  }

  if (status === 429) {
    return "Zpráv přišlo příliš mnoho krátce po sobě. Zkuste to prosím za chvíli, nebo nám napište přímo na"
  }

  return "Zprávu se nepodařilo odeslat. Zkuste to prosím znovu, nebo nám napište přímo na"
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
