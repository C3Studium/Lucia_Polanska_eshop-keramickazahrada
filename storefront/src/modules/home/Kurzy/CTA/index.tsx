"use client"

import Button from "@modules/common/components/Buttons/button"
import WebButton from "@modules/common/components/Buttons/webButton"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { AnimatePresence, motion, type Easing, type Variants } from "framer-motion"
import Image from "next/image"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"

type CTAProps = {
  text: string
  kind: "primary" | "secondary"
  img?: string
  alt?: string
  className?: string
}

const inquiryOptions = ["Obecný dotaz", "Zakázka", "Objednávka", "Kurzy"] as const
type Inquiry = (typeof inquiryOptions)[number]

const ease = [0.76, 0, 0.24, 1] as Easing

const panelVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.68, ease } },
  exit: { opacity: 0, y: 12, scale: 0.985, transition: { duration: 0.48, ease } },
}

const contentVariants: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.2, staggerChildren: 0.055 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.58, ease } },
}

export default function CTA({
  text,
  img,
  alt = "Dekorativní pozadí tlačítka",
  className,
}: CTAProps) {
  const [active, setActive] = useState(false)
  const [inquiry, setInquiry] = useState<Inquiry>(text.toLocaleLowerCase("cs").includes("kurz") ? "Kurzy" : "Obecný dotaz")
  const [hoveredInquiry, setHoveredInquiry] = useState<Inquiry | null>(null)
  const [closeHovered, setCloseHovered] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!active) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(false)
    }
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 180)

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [active])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => event.preventDefault()

  const overlay = (
    <AnimatePresence>
      {active && (
        <motion.div className="contactOverlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease }}>
          <motion.button
            type="button"
            className="contactBackdrop"
            aria-label="Zavřít kontaktní formulář"
            onClick={() => setActive(false)}
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(9px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.5, ease }}
          />

          <motion.section className="contactPanel" role="dialog" aria-modal="true" aria-labelledby="contact-dialog-title" variants={panelVariants} initial="hidden" animate="visible" exit="exit">
            <header className="contactPanelHeader">
              <div className="contactPanelMeta">
                <span>Kontakt · Ateliér</span>
                <span className="contactAvailability"><i /> Odpovídáme do 2 pracovních dnů</span>
              </div>
              <motion.button
                ref={closeRef}
                type="button"
                className="contactClose"
                aria-label="Zavřít"
                onClick={() => setActive(false)}
                onHoverStart={() => setCloseHovered(true)}
                onHoverEnd={() => setCloseHovered(false)}
                initial={false}
                animate={{ width: closeHovered ? 96 : 42 }}
                transition={{ duration: 0.5, ease }}
                style={{ transformOrigin: "right center" }}
              >
                <AnimatePresence initial={false}>
                  {closeHovered && (
                    <motion.span
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.25, delay: 0.1, ease }}
                    >
                      Zavřít
                    </motion.span>
                  )}
                </AnimatePresence>
                <i aria-hidden="true" />
              </motion.button>
            </header>

            <div className="contactPanelBody">
              <motion.div
                className="contactFormPanel"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <motion.div className="contactTitle" variants={itemVariants}>
                  <span className="contactEyebrow">Kontakt přímo do ateliéru</span>
                  <h2 id="contact-dialog-title">Napište mi.<em>Ozvu se osobně.</em></h2>
                </motion.div>

                <motion.form className="contactDialogForm" onSubmit={handleSubmit} variants={itemVariants}>
                  <fieldset className="contactTopics">
                    <legend>S čím vám můžeme pomoci?</legend>
                    <div onMouseLeave={() => setHoveredInquiry(null)}>
                      {inquiryOptions.map((option) => (
                        <button
                          type="button"
                          key={option}
                          className={(hoveredInquiry ?? inquiry) === option ? "active" : ""}
                          aria-pressed={inquiry === option}
                          onMouseEnter={() => setHoveredInquiry(option)}
                          onFocus={() => setHoveredInquiry(option)}
                          onBlur={() => setHoveredInquiry(null)}
                          onClick={() => setInquiry(option)}
                        >
                          {(hoveredInquiry ?? inquiry) === option && <motion.span className="contactTopicIndicator" layoutId="contact-topic-indicator" transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.7 }} />}
                          <span className="contactTopicLabel">{option}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div className="contactFieldGrid">
                    <label className="contactField"><span>Jméno</span><input className="contactInput" type="text" name="name" autoComplete="name" placeholder="Vaše jméno" required /></label>
                    <label className="contactField"><span>E-mail</span><input className="contactInput" type="email" name="email" autoComplete="email" placeholder="vas@email.cz" required /></label>
                    <label className="contactField"><span>Telefon <i>volitelné</i></span><input className="contactInput" type="tel" name="phone" autoComplete="tel" placeholder="+420" /></label>
                  </div>

                  <label className="contactField contactMessage"><span>Vaše zpráva</span><textarea className="contactInput" name="message" placeholder="Popište svou představu, otázku nebo projekt…" required /></label>

                  <div className="contactFormFooter">
                    <p>Odesláním souhlasíte se zpracováním údajů pouze pro vyřízení této zprávy.</p>
                    <WebButton Kind="Button" title="Odeslat zprávu" onClickAction={() => undefined} className="contactSubmitWebButton" />
                  </div>
                </motion.form>
              </motion.div>

              <motion.aside
                className="contactVisualPanel"
                initial={{ opacity: 0, clipPath: "inset(0 0 100% 0 round 18px)" }}
                animate={{ opacity: 1, clipPath: "inset(0 0 0% 0 round 18px)" }}
                exit={{ opacity: 0, clipPath: "inset(0 0 100% 0 round 18px)" }}
                transition={{ delay: 0.14, duration: 0.88, ease }}
              >
                <Image src="/assets/img/faq/FAQ2.png" alt="Lucie Polanská při práci v keramickém ateliéru" fill sizes="(max-width: 760px) 100vw, 40vw" priority />
                <div className="contactVisualShade" />
                <div className="contactVisualMeta"><span>Ateliér Lucie Polanské</span><span>Putim · jižní Čechy</span></div>

                <motion.div className="contactDetails" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48, duration: 0.62, ease }}>
                  <div><span>E-mail</span><a href="mailto:info@keramickazahrada.cz">info@keramickazahrada.cz</a></div>
                  <div><span>Telefon</span><a href="tel:+420775211578">+420 775 211 578</a></div>
                  <div><span>Adresa</span><p>Putim 229, 397 01 Písek</p></div>
                  <LocalizedClientLink href="/dotazy" className="contactFaqLink">Nejprve se podívat do FAQ <span aria-hidden="true">↗</span></LocalizedClientLink>
                </motion.div>
              </motion.aside>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <div className="CTA__block">
        {img ? (
          <Button
            img={img}
            alt={alt}
            Kind="Button"
            title={text}
            className={className}
            onClickAction={() => setActive(true)}
          />
        ) : (
          <WebButton
            Kind="Button"
            title={text}
            className={className}
            onClickAction={() => setActive(true)}
          />
        )}
      </div>
      {typeof document !== "undefined" ? createPortal(overlay, document.body) : null}
    </>
  )
}
