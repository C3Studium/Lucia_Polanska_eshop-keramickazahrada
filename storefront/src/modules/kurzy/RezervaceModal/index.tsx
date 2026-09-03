"use client"

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import {
  createCourseReservation,
  joinCourseWaitlist,
  listCourseTerms,
  quoteCourseTerm,
  type CourseQuote,
  type CourseTerm,
} from "@lib/data/courses"
import { pragueDayKey } from "@lib/util/course-calendar"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import {
  czk,
  formatDuration,
  formatPrague,
  peopleLabel,
  seatsLabel,
  TIER_LABEL,
} from "../format"
import KurzyCalendar from "./Calendar"

/**
 * The reservation modal — „Vybrat termín" opens it over the kurzy page.
 *
 * Mechanics follow the house dialog (ContactDialog): portal to body, focus
 * trap, Esc, backdrop click, scroll lock with `data-lenis-prevent`, focus
 * returned by the opener. Closing mid-flow (Esc included) loses nothing:
 * the typed fields and the chosen term persist in a module-level draft and
 * reopening restores them (see `ModalDraft`). Choreography follows the house stepper
 * (express-checkout Router): a progress rail 01 Termín · 02 Údaje · 03 Platba
 * with done-checks, one direction-aware sliding stage below it, layout-
 * animated height, and `useReducedMotion` degrading every move to a brief
 * crossfade.
 *
 * After submit comes a Souhrn state — not a fourth rail step: for pay-on-site
 * it renders inline (co, kdy, kde, kolik osob, cena, co bude dál); for online
 * payment the modal's job ends at the ComGate redirect and the summary is the
 * existing reservation return page.
 *
 * All money is server-side: the quote endpoint previews, the create recomputes
 * under the row lock. The honeypot, the rate limit and the waitlist rules are
 * the same contracts the inline form had — the pieces moved, not changed.
 */

type Step = "termin" | "udaje" | "platba"

const STEP_ORDER: Step[] = ["termin", "udaje", "platba"]

const STEP_LABEL: Record<Step, string> = {
  termin: "Termín",
  udaje: "Údaje",
  platba: "Platba",
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const isValidName = (value: string): boolean => value.trim().length >= 2
const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
const isValidPhone = (value: string): boolean => value.trim().length >= 6

/**
 * What survives closing the modal mid-flow. Esc (or the backdrop) closes
 * without ceremony — but reopening restores the typed fields and the chosen
 * term from this module-level draft, so an accidental Esc on step 2 costs
 * nothing. Deliberately NOT a confirm dialog: a second „opravdu zavřít?"
 * decision is heavier than making the close simply lose nothing.
 *
 * The draft is cleared once a booking is confirmed (the next visit starts
 * clean) and lives only for the page visit — a reload starts fresh.
 */
type ModalDraft = {
  step: Step
  view: "calendar" | "list"
  selectedDay: string | null
  selectedId: string | null
  name: string
  email: string
  phone: string
  partySize: number
  paymentMethod: "online" | "on_site"
}

let savedDraft: ModalDraft | null = null

/**
 * Errors that mean the seats moved under the customer: the calendar must
 * refresh and the flow returns to step 1 to pick again.
 */
const isCapacityError = (message: string): boolean =>
  /obsazen|zbývá už jen|není možné rezervovat|proběhl/i.test(message)

type Props = {
  open: boolean
  onCloseAction: () => void
  initialTerms: CourseTerm[]
}

export default function RezervaceModal({
  open,
  onCloseAction,
  initialTerms,
}: Props) {
  if (typeof document === "undefined") {
    return null
  }
  return createPortal(
    <AnimatePresence>
      {open ? (
        <RezervaceModalPanel
          initialTerms={initialTerms}
          onClose={onCloseAction}
        />
      ) : null}
    </AnimatePresence>,
    document.body
  )
}

function RezervaceModalPanel({
  initialTerms,
  onClose,
}: {
  initialTerms: CourseTerm[]
  onClose: () => void
}) {
  const reduceMotion = useReducedMotion()
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  /* ---------------------------------------------------------------- data */
  const [terms, setTerms] = useState<CourseTerm[]>(initialTerms)
  useEffect(() => {
    // The page data may be minutes old; the modal opens on fresh occupancy.
    let alive = true
    listCourseTerms().then((fresh) => {
      if (alive && fresh.length) {
        setTerms(fresh)
      }
    })
    return () => {
      alive = false
    }
  }, [])

  /* ---------------------------------------------------------------- steps */
  // The draft a previous close left behind — an accidental Esc mid-form
  // reopens exactly where the customer was. Captured once on mount.
  const [draft] = useState(() => savedDraft)

  const [step, setStep] = useState<Step>(() => {
    // Restore the step only as far as the restored data still carries it:
    // the drafted term must exist (and have seats) in the page's terms, and
    // step 3 needs valid step-2 fields. Anything less falls back gracefully.
    if (!draft) return "termin"
    const term = initialTerms.find((item) => item.id === draft.selectedId)
    if (!term || term.sold_out) return "termin"
    if (draft.step === "termin") return "termin"
    const detailsOk =
      isValidName(draft.name) &&
      isValidEmail(draft.email) &&
      isValidPhone(draft.phone)
    return draft.step === "platba" && detailsOk ? "platba" : "udaje"
  })
  const [direction, setDirection] = useState(1)

  const [view, setView] = useState<"calendar" | "list">(
    draft?.view ?? "calendar"
  )
  const [selectedDay, setSelectedDay] = useState<string | null>(
    draft?.selectedDay ?? null
  )
  const [selectedId, setSelectedId] = useState<string | null>(
    draft?.selectedId ?? null
  )

  const [name, setName] = useState(draft?.name ?? "")
  const [email, setEmail] = useState(draft?.email ?? "")
  const [phone, setPhone] = useState(draft?.phone ?? "")
  const [partySize, setPartySize] = useState(draft?.partySize ?? 1)
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    email?: string
    phone?: string
  }>({})

  const [paymentMethod, setPaymentMethod] = useState<"online" | "on_site">(
    draft?.paymentMethod ?? "online"
  )
  const [website, setWebsite] = useState("")

  const [quote, setQuote] = useState<CourseQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [stepError, setStepError] = useState<{ step: Step; message: string } | null>(
    null
  )
  const [confirmed, setConfirmed] = useState<{
    term: CourseTerm
    partySize: number
    total: number
    reservationId: string | null
    token: string | null
  } | null>(null)

  /* The waitlist mini-form a full term opens instead of the booking. */
  const [wlName, setWlName] = useState("")
  const [wlEmail, setWlEmail] = useState("")
  const [wlPartySize, setWlPartySize] = useState(1)
  const [wlWebsite, setWlWebsite] = useState("")
  const [wlSubmitting, setWlSubmitting] = useState(false)
  const [wlError, setWlError] = useState<string | null>(null)
  const [wlDone, setWlDone] = useState<{ email: string; partySize: number } | null>(
    null
  )

  const selected = useMemo(
    () => terms.find((term) => term.id === selectedId) ?? null,
    [terms, selectedId]
  )
  const maxParty = selected ? Math.max(1, Math.min(selected.seats_left, 30)) : 30

  const validName = isValidName(name)
  const validEmail = isValidEmail(email)
  const validPhone = isValidPhone(phone)
  const detailsValid = validName && validEmail && validPhone

  const termDone = !!selected && !selected.sold_out
  const canReachUdaje = termDone
  const canReachPlatba = termDone && detailsValid

  /* Closing mid-flow keeps the work: the latest state is snapshotted every
     render and written to the module draft on unmount. A confirmed booking
     clears it, so the next opening starts clean. */
  const draftRef = useRef<ModalDraft | null>(null)
  draftRef.current = confirmed
    ? null
    : {
        step,
        view,
        selectedDay,
        selectedId,
        name,
        email,
        phone,
        partySize,
        paymentMethod,
      }
  useEffect(
    () => () => {
      savedDraft = draftRef.current
    },
    []
  )

  /* If the freshly fetched terms no longer carry the chosen one (cancelled,
     just filled up, or a stale draft), steps 2 and 3 have nothing to stand
     on — return to step 1 instead of showing an empty stage. */
  useEffect(() => {
    if (step !== "termin" && (!selected || selected.sold_out)) {
      setDirection(-1)
      setStep("termin")
    }
  }, [step, selected])

  /* Back from ComGate via bfcache: the page resumes exactly as it was left —
     mid-submit. Unfreeze the button so „Rezervovat a zaplatit" works again. */
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setSubmitting(false)
      }
    }
    window.addEventListener("pageshow", handlePageShow)
    return () => window.removeEventListener("pageshow", handlePageShow)
  }, [])

  /* --------------------------------------------------- dialog mechanics */
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
      ).filter(
        (element) =>
          // Visible, and actually in the Tab order: the calendar's roving
          // tabindex parks every day but one at -1, and the honeypot hides
          // behind aria-hidden — neither may become the trap's first/last.
          element.offsetParent !== null &&
          !element.matches('[tabindex="-1"], [aria-hidden="true"]')
      )
      if (!focusable.length) {
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (
        event.shiftKey &&
        (active === first || !panelRef.current.contains(active))
      ) {
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

  /* ------------------------------------------------------------- pricing */
  const quoteRequest = useRef(0)
  useEffect(() => {
    if (!selected || selected.sold_out) {
      setQuote(null)
      return
    }
    const requestId = ++quoteRequest.current
    setQuoteLoading(true)
    const timeout = window.setTimeout(async () => {
      const result = await quoteCourseTerm(selected.id, partySize)
      if (quoteRequest.current === requestId) {
        setQuote(result)
        setQuoteLoading(false)
      }
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [selected, partySize])

  /* ---------------------------------------------------------- movement */
  const go = (next: Step) => {
    if (next === "udaje" && !canReachUdaje) return
    if (next === "platba" && !canReachPlatba) return
    setDirection(
      STEP_ORDER.indexOf(next) >= STEP_ORDER.indexOf(step) ? 1 : -1
    )
    setStep(next)
  }

  const selectDay = (key: string) => {
    setSelectedDay(key)
    setStepError(null)
    const dayTerms = terms.filter((term) => pragueDayKey(term.starts_at) === key)
    // One term that day: choosing the day is choosing the term.
    if (dayTerms.length === 1) {
      selectTerm(dayTerms[0])
    } else {
      setSelectedId(null)
    }
  }

  const selectTerm = (term: CourseTerm) => {
    setSelectedId(term.id)
    setSelectedDay(pragueDayKey(term.starts_at))
    setStepError(null)
    setWlError(null)
    setWlDone(null)
    if (!term.sold_out) {
      setPartySize((current) =>
        Math.max(1, Math.min(current, Math.min(term.seats_left, 30)))
      )
    }
  }

  const continueToUdaje = () => {
    if (!termDone) {
      setStepError({
        step: "termin",
        message: "Vyberte prosím termín s volnými místy.",
      })
      return
    }
    go("udaje")
  }

  const continueToPlatba = () => {
    const errors: typeof fieldErrors = {}
    if (!validName) errors.name = "Vyplňte prosím jméno."
    if (!validEmail) errors.email = "Zkontrolujte prosím e-mailovou adresu."
    if (!validPhone) errors.phone = "Zkontrolujte prosím telefonní číslo."
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      setStepError({
        step: "udaje",
        message: "Zkontrolujte prosím označená pole.",
      })
      return
    }
    setStepError(null)
    go("platba")
  }

  /* ------------------------------------------------------------- submit */
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected || submitting || !detailsValid) return

    setStepError(null)
    setSubmitting(true)
    const result = await createCourseReservation({
      term_id: selected.id,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      party_size: partySize,
      payment_method: paymentMethod,
      website,
    })

    if (!result.ok) {
      if (isCapacityError(result.message)) {
        // The seats moved under us — back to a refreshed step 1.
        const fresh = await listCourseTerms()
        if (fresh.length) {
          setTerms(fresh)
        }
        setSelectedId(null)
        setDirection(-1)
        setStep("termin")
        setStepError({ step: "termin", message: result.message })
      } else {
        setStepError({ step: "platba", message: result.message })
      }
      setSubmitting(false)
      return
    }

    if (result.payment_url) {
      // Straight to ComGate; the return URL lands on the reservation page
      // with the outcome — the modal's job ends here.
      window.location.href = result.payment_url
      return
    }

    setConfirmed({
      term: selected,
      partySize,
      total: quote?.total ?? 0,
      reservationId: result.reservation_id ?? null,
      token: result.token ?? null,
    })
    setSubmitting(false)
  }

  const submitWaitlist = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected || wlSubmitting) return

    setWlError(null)
    if (wlName.trim().length < 2) {
      setWlError("Vyplňte prosím jméno.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wlEmail.trim())) {
      setWlError("Zkontrolujte prosím e-mailovou adresu.")
      return
    }

    setWlSubmitting(true)
    const result = await joinCourseWaitlist({
      term_id: selected.id,
      name: wlName.trim(),
      email: wlEmail.trim(),
      party_size: wlPartySize,
      website: wlWebsite,
    })
    setWlSubmitting(false)

    if (!result.ok) {
      setWlError(result.message)
      return
    }
    setWlDone({ email: wlEmail.trim(), partySize: wlPartySize })
  }

  /* ------------------------------------------------------------ render */
  const dayTerms = selectedDay
    ? terms.filter((term) => pragueDayKey(term.starts_at) === selectedDay)
    : []

  const steps: { id: Step; done: boolean; reachable: boolean; summary?: string }[] =
    [
      {
        id: "termin",
        done: termDone,
        reachable: true,
        summary: selected ? formatPrague(selected.starts_at) : undefined,
      },
      {
        id: "udaje",
        done: detailsValid,
        reachable: canReachUdaje,
        summary: detailsValid
          ? `${name.trim()} · ${peopleLabel(partySize)}`
          : undefined,
      },
      { id: "platba", done: false, reachable: canReachPlatba },
    ]

  return (
    <motion.div
      className="kurzyModal"
      data-lenis-prevent
      variants={reduceMotion ? reducedOverlayVariants : overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.button
        type="button"
        className="kurzyModal__backdrop"
        aria-label="Zavřít rezervaci"
        onClick={onClose}
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      />

      <motion.section
        ref={panelRef}
        className="kurzyModal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kurzy-modal-title"
        variants={reduceMotion ? reducedPanelInVariants : panelInVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <header className="kurzyModal__head">
          <div>
            <span className="kurzyModal__eyebrow">Kurzy · Rezervace</span>
            <h2 id="kurzy-modal-title">
              Vyberte si termín.
              <em>Místo je vaše.</em>
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="kurzyModal__close"
            onClick={onClose}
          >
            Zavřít <i aria-hidden="true">×</i>
          </button>
        </header>

        {confirmed ? (
          <motion.div
            className="kurzyModal__summary"
            initial={reduceMotion ? false : { opacity: 0, y: SUMMARY_RISE }}
            animate={{ opacity: 1, y: "0vh" }}
            role="status"
          >
            <span className="kurzyModal__summaryEyebrow">Rezervace přijata</span>
            <h3>
              Těšíme se na vás.
              <em>Místo máte rezervované.</em>
            </h3>
            <dl>
              <div>
                <dt>Kurz</dt>
                <dd>{confirmed.term.title}</dd>
              </div>
              <div>
                <dt>Kdy</dt>
                <dd>{formatPrague(confirmed.term.starts_at)}</dd>
              </div>
              <div>
                <dt>Kde</dt>
                <dd>{confirmed.term.location}</dd>
              </div>
              <div>
                <dt>Osob</dt>
                <dd>{confirmed.partySize}</dd>
              </div>
              {confirmed.total > 0 ? (
                <div>
                  <dt>Na místě zaplatíte</dt>
                  <dd>{czk(confirmed.total)}</dd>
                </div>
              ) : null}
            </dl>
            <p>
              Co bude dál: potvrzení jsme právě poslali na {email.trim()}. Před
              kurzem vám ještě přijde připomínka — a zaplatíte až na místě,
              hotově nebo kartou. Kdyby vám termín nakonec nevyšel, rezervaci
              zrušíte přímo z e-mailu.
            </p>
            {confirmed.reservationId && confirmed.token ? (
              <LocalizedClientLink
                href={`/kurzy/rezervace/${confirmed.reservationId}?token=${confirmed.token}`}
                className="kurzyModal__summaryLink"
              >
                Zobrazit stav rezervace ↗
              </LocalizedClientLink>
            ) : null}
            <button
              type="button"
              className="kurzyModal__primary"
              onClick={onClose}
            >
              Zavřít
            </button>
          </motion.div>
        ) : (
          <>
            <nav className="kurzyModal__progress" aria-label="Postup rezervace">
              {steps.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  className="kurzyModal__progressStep"
                  data-active={step === item.id}
                  data-done={item.done}
                  disabled={!item.reachable}
                  aria-current={step === item.id ? "step" : undefined}
                  onClick={() => go(item.id)}
                >
                  <span className="kurzyModal__progressLabel">
                    {String(index + 1).padStart(2, "0")} {STEP_LABEL[item.id]}
                    {item.done ? (
                      <i className="kurzyModal__progressDone" aria-hidden="true">
                        ✓
                      </i>
                    ) : null}
                  </span>
                  {item.summary && step !== item.id ? (
                    <span className="kurzyModal__progressSummary">
                      {item.summary}
                    </span>
                  ) : null}
                  {step === item.id ? (
                    <motion.span
                      className="kurzyModal__progressIndicator"
                      layoutId="kurzy-progress-indicator"
                      transition={
                        reduceMotion ? instantTransition : indicatorTransition
                      }
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              ))}
            </nav>

            <motion.div
              className="kurzyModal__stage"
              layout
              transition={reduceMotion ? instantLayoutTransition : stageTransition}
            >
              <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                <motion.section
                  key={step}
                  className="kurzyModal__stepPanel"
                  custom={direction}
                  variants={reduceMotion ? reducedPanelVariants : panelVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  aria-label={STEP_LABEL[step]}
                >
                  {step === "termin" && (
                    <div className="kurzyModal__step">
                      {stepError?.step === "termin" ? (
                        <p className="kurzyModal__error" role="alert">
                          {stepError.message}
                        </p>
                      ) : null}

                      {terms.length === 0 ? (
                        <p className="kurzyModal__hint">
                          Právě nejsou vypsané žádné termíny. Napište mi a dám
                          vám vědět, jakmile vypíšu další.
                        </p>
                      ) : (
                        <>
                          <div
                            className="kurzyModal__viewSwitch"
                            role="group"
                            aria-label="Zobrazení termínů"
                          >
                            <button
                              type="button"
                              aria-pressed={view === "calendar"}
                              onClick={() => setView("calendar")}
                            >
                              Kalendář
                            </button>
                            <button
                              type="button"
                              aria-pressed={view === "list"}
                              onClick={() => setView("list")}
                            >
                              Seznam
                            </button>
                          </div>

                          {view === "calendar" ? (
                            <>
                              <KurzyCalendar
                                terms={terms}
                                selectedDay={selectedDay}
                                onSelectDay={selectDay}
                              />
                              {selectedDay ? (
                                <div
                                  className="kurzyModal__dayTerms"
                                  role="group"
                                  aria-label="Termíny vybraného dne"
                                >
                                  {dayTerms.map((term) => (
                                    <TermCard
                                      key={term.id}
                                      term={term}
                                      active={term.id === selectedId}
                                      onSelect={() => selectTerm(term)}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <p className="kurzyModal__hint">
                                  Vyberte v kalendáři označený den a jeho
                                  termíny se ukážou tady.
                                </p>
                              )}
                            </>
                          ) : (
                            <div
                              className="kurzyModal__termList"
                              role="group"
                              aria-label="Nejbližší termíny"
                            >
                              {terms.map((term) => (
                                <TermCard
                                  key={term.id}
                                  term={term}
                                  active={term.id === selectedId}
                                  onSelect={() => selectTerm(term)}
                                />
                              ))}
                            </div>
                          )}

                          {selected?.sold_out ? (
                            <div className="kurzyModal__waitlist">
                              {wlDone ? (
                                <div
                                  className="kurzyModal__waitlistDone"
                                  role="status"
                                >
                                  <strong>
                                    Dáme vědět, až se uvolní místo.
                                  </strong>
                                  <p>
                                    Jakmile se na termínu uvolní místo pro{" "}
                                    {peopleLabel(wlDone.partySize)}, pošleme vám
                                    zprávu na {wlDone.email}. Místo se přitom
                                    nedrží — patří tomu, kdo dřív dokončí
                                    rezervaci.
                                  </p>
                                </div>
                              ) : (
                                <form onSubmit={submitWaitlist} noValidate>
                                  <p className="kurzyModal__waitlistIntro">
                                    Termín je plně obsazený. Nechte nám kontakt
                                    a napíšeme vám, jakmile se místo uvolní.
                                  </p>
                                  <div className="kurzyModal__fields">
                                    <label>
                                      <span>Jméno a příjmení</span>
                                      <input
                                        type="text"
                                        name="wl-name"
                                        autoComplete="name"
                                        value={wlName}
                                        onChange={(event) =>
                                          setWlName(event.target.value)
                                        }
                                        required
                                      />
                                    </label>
                                    <label>
                                      <span>E-mail</span>
                                      <input
                                        type="email"
                                        name="wl-email"
                                        autoComplete="email"
                                        value={wlEmail}
                                        onChange={(event) =>
                                          setWlEmail(event.target.value)
                                        }
                                        required
                                      />
                                    </label>
                                    <div className="kurzyModal__count">
                                      <span id="kurzy-wl-count">Počet osob</span>
                                      <div>
                                        <button
                                          type="button"
                                          aria-label="Méně osob"
                                          disabled={wlPartySize <= 1}
                                          onClick={() =>
                                            setWlPartySize((value) =>
                                              Math.max(1, value - 1)
                                            )
                                          }
                                        >
                                          −
                                        </button>
                                        <output aria-labelledby="kurzy-wl-count">
                                          {wlPartySize}
                                        </output>
                                        <button
                                          type="button"
                                          aria-label="Více osob"
                                          disabled={wlPartySize >= 30}
                                          onClick={() =>
                                            setWlPartySize((value) =>
                                              Math.min(30, value + 1)
                                            )
                                          }
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Honeypot — humans never see it. */}
                                  <input
                                    type="text"
                                    name="website"
                                    className="kurzyModal__website"
                                    tabIndex={-1}
                                    autoComplete="off"
                                    aria-hidden="true"
                                    value={wlWebsite}
                                    onChange={(event) =>
                                      setWlWebsite(event.target.value)
                                    }
                                  />

                                  <p className="kurzyModal__consent">
                                    E-mail použijeme jen pro tohle jedno
                                    upozornění na uvolněné místo — nic dalšího
                                    na něj posílat nebudeme.
                                  </p>

                                  {wlError ? (
                                    <p className="kurzyModal__error" role="alert">
                                      {wlError}
                                    </p>
                                  ) : null}

                                  <button
                                    type="submit"
                                    className="kurzyModal__primary"
                                    disabled={wlSubmitting}
                                  >
                                    {wlSubmitting ? "Odesílám…" : "Dejte mi vědět"}
                                    <i aria-hidden="true">↗</i>
                                  </button>
                                </form>
                              )}
                            </div>
                          ) : (
                            <div className="kurzyModal__stepActions">
                              <button
                                type="button"
                                className="kurzyModal__primary"
                                onClick={continueToUdaje}
                                disabled={!termDone}
                              >
                                Pokračovat na údaje <i aria-hidden="true">→</i>
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {step === "udaje" && selected && (
                    <div className="kurzyModal__step">
                      <button
                        type="button"
                        className="kurzyModal__back"
                        onClick={() => go("termin")}
                      >
                        ← Zpět na termín
                      </button>

                      <p className="kurzyModal__chosen">
                        {selected.title} · {formatPrague(selected.starts_at)}
                      </p>

                      <div className="kurzyModal__fields">
                        <label>
                          <span>Jméno a příjmení</span>
                          <input
                            type="text"
                            name="name"
                            autoComplete="name"
                            value={name}
                            aria-invalid={fieldErrors.name ? true : undefined}
                            aria-describedby={
                              fieldErrors.name ? "kurzy-err-name" : undefined
                            }
                            onChange={(event) => setName(event.target.value)}
                            required
                          />
                          {fieldErrors.name ? (
                            <em
                              className="kurzyModal__fieldError"
                              id="kurzy-err-name"
                            >
                              {fieldErrors.name}
                            </em>
                          ) : null}
                        </label>
                        <label>
                          <span>E-mail</span>
                          <input
                            type="email"
                            name="email"
                            autoComplete="email"
                            value={email}
                            aria-invalid={fieldErrors.email ? true : undefined}
                            aria-describedby={
                              fieldErrors.email ? "kurzy-err-email" : undefined
                            }
                            onChange={(event) => setEmail(event.target.value)}
                            required
                          />
                          {fieldErrors.email ? (
                            <em
                              className="kurzyModal__fieldError"
                              id="kurzy-err-email"
                            >
                              {fieldErrors.email}
                            </em>
                          ) : null}
                        </label>
                        <label>
                          <span>Telefon</span>
                          <input
                            type="tel"
                            name="phone"
                            autoComplete="tel"
                            value={phone}
                            aria-invalid={fieldErrors.phone ? true : undefined}
                            aria-describedby={
                              fieldErrors.phone ? "kurzy-err-phone" : undefined
                            }
                            onChange={(event) => setPhone(event.target.value)}
                            required
                          />
                          {fieldErrors.phone ? (
                            <em
                              className="kurzyModal__fieldError"
                              id="kurzy-err-phone"
                            >
                              {fieldErrors.phone}
                            </em>
                          ) : null}
                        </label>
                        <div className="kurzyModal__count">
                          <span id="kurzy-count">Počet osob</span>
                          <div>
                            <button
                              type="button"
                              aria-label="Méně osob"
                              disabled={partySize <= 1}
                              onClick={() =>
                                setPartySize((value) => Math.max(1, value - 1))
                              }
                            >
                              −
                            </button>
                            <output aria-labelledby="kurzy-count">
                              {partySize}
                            </output>
                            <button
                              type="button"
                              aria-label="Více osob"
                              disabled={partySize >= maxParty}
                              onClick={() =>
                                setPartySize((value) =>
                                  Math.min(maxParty, value + 1)
                                )
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="kurzyModal__price" aria-live="polite">
                        <span>Cena celkem</span>
                        <strong>
                          {quoteLoading || !quote ? "Počítáme…" : czk(quote.total)}
                        </strong>
                        {quote && !quoteLoading ? (
                          <em>
                            {TIER_LABEL[quote.tier]} · {czk(quote.per_person)}/os.
                          </em>
                        ) : null}
                      </div>

                      {stepError?.step === "udaje" ? (
                        <p className="kurzyModal__error" role="alert">
                          {stepError.message}
                        </p>
                      ) : null}

                      <div className="kurzyModal__stepActions">
                        <button
                          type="button"
                          className="kurzyModal__primary"
                          onClick={continueToPlatba}
                        >
                          Pokračovat na platbu <i aria-hidden="true">→</i>
                        </button>
                      </div>
                    </div>
                  )}

                  {step === "platba" && selected && (
                    <form className="kurzyModal__step" onSubmit={submit} noValidate>
                      <button
                        type="button"
                        className="kurzyModal__back"
                        onClick={() => go("udaje")}
                      >
                        ← Zpět na údaje
                      </button>

                      <div className="kurzyModal__recap">
                        <p className="kurzyModal__chosen">
                          {selected.title} · {formatPrague(selected.starts_at)}
                          <br />
                          {selected.location}
                          {selected.duration_minutes
                            ? ` · ${formatDuration(selected.duration_minutes)}`
                            : ""}
                        </p>
                        <div className="kurzyModal__price" aria-live="polite">
                          <span>Cena celkem</span>
                          <strong>
                            {quoteLoading || !quote
                              ? "Počítáme…"
                              : czk(quote.total)}
                          </strong>
                          {quote && !quoteLoading ? (
                            <em>
                              {partySize} × {czk(quote.per_person)} ={" "}
                              {czk(quote.total)} · {TIER_LABEL[quote.tier]}
                            </em>
                          ) : null}
                        </div>
                      </div>

                      <fieldset className="kurzyModal__payment">
                        <legend>Platba</legend>
                        <label
                          className={paymentMethod === "online" ? "is-active" : ""}
                        >
                          <input
                            type="radio"
                            name="payment_method"
                            value="online"
                            checked={paymentMethod === "online"}
                            onChange={() => setPaymentMethod("online")}
                          />
                          <span>
                            <strong>Zaplatit předem kartou</strong>
                            <small>
                              Bezpečně přes ComGate, místo máte jisté hned.
                            </small>
                          </span>
                        </label>
                        <label
                          className={paymentMethod === "on_site" ? "is-active" : ""}
                        >
                          <input
                            type="radio"
                            name="payment_method"
                            value="on_site"
                            checked={paymentMethod === "on_site"}
                            onChange={() => setPaymentMethod("on_site")}
                          />
                          <span>
                            <strong>Zaplatím na místě</strong>
                            <small>Hotově nebo kartou před začátkem kurzu.</small>
                          </span>
                        </label>
                      </fieldset>

                      {/* Honeypot — humans never see it. */}
                      <input
                        type="text"
                        name="website"
                        className="kurzyModal__website"
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        value={website}
                        onChange={(event) => setWebsite(event.target.value)}
                      />

                      {stepError?.step === "platba" ? (
                        <p className="kurzyModal__error" role="alert">
                          {stepError.message}
                        </p>
                      ) : null}

                      <div className="kurzyModal__stepActions">
                        <button
                          type="submit"
                          className="kurzyModal__primary"
                          disabled={submitting}
                        >
                          {submitting
                            ? "Odesílám…"
                            : paymentMethod === "online"
                              ? "Rezervovat a zaplatit"
                              : "Rezervovat místo"}
                          <i aria-hidden="true">↗</i>
                        </button>
                      </div>
                    </form>
                  )}
                </motion.section>
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </motion.section>
    </motion.div>
  )
}

function TermCard({
  term,
  active,
  onSelect,
}: {
  term: CourseTerm
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`kurzyModal__term${active ? " is-active" : ""}${
        term.sold_out ? " is-soldout" : ""
      }`}
      onClick={onSelect}
    >
      <span className="kurzyModal__termDate">{formatPrague(term.starts_at)}</span>
      <strong>{term.title}</strong>
      <span className="kurzyModal__termMeta">
        {term.location}
        {term.duration_minutes
          ? ` · ${formatDuration(term.duration_minutes)}`
          : ""}
      </span>
      <span className="kurzyModal__termPrices">
        {czk(term.price_single)} za jednoho
        {term.price_two != null ? ` · ${czk(term.price_two)}/os. za dva` : ""}
        {term.group_min != null && term.price_group_per_person != null
          ? ` · od ${term.group_min} lidí ${czk(term.price_group_per_person)}/os.`
          : ""}
      </span>
      <span
        className={`kurzyModal__termSeats${term.sold_out ? " is-full" : ""}`}
      >
        {term.sold_out
          ? "obsazeno · dáme vědět, až se uvolní"
          : seatsLabel(term.seats_left)}
      </span>
    </button>
  )
}

/* The house motion family — the express-checkout stepper's values, plus the
   contact dialog's overlay entrance, hoisted so framer-motion re-diffs
   nothing per render. */
const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.25, delay: 0.05 } },
}
const reducedOverlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}
const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
}
/*
 * Motion geometry, in the units the thing it moves is measured in.
 *
 * The panel rises against the screen, so its offset is `vh`: the original
 * 26px read at a 900px-tall reference window, which is 26/900 = 2.9vh (22px
 * on a 768 laptop, 39px on a 1351 desktop). The exit keeps the ratio the
 * design had — 14/26 = 0.54 — rather than a second hand-picked number.
 *
 * The step slide happens *inside* the panel, so its reference is the panel,
 * not the window: 40px of the 760px panel is 5.3%, and a percentage on `x`
 * is a percentage of the element's own box, so the slide now scales with the
 * panel through the 2K ramp and down to a full-width phone. Exit keeps the
 * design's 30/40 = 0.75. Both ends of every animated value carry the same
 * unit, or framer stops interpolating and jumps.
 */
const PANEL_RISE_VH = 2.9
/** The confirmation's own rise, derived from the panel's: 18/26 of it. */
const SUMMARY_RISE = `${+(PANEL_RISE_VH * (18 / 26)).toFixed(2)}vh`
const PANEL_EXIT_VH = +(PANEL_RISE_VH * (14 / 26)).toFixed(2) // 1.56
const STEP_SLIDE_PCT = 5.3
const STEP_EXIT_PCT = +(STEP_SLIDE_PCT * 0.75).toFixed(2) // 3.98

const panelInVariants: Variants = {
  hidden: { opacity: 0, y: `${PANEL_RISE_VH}vh`, scale: 0.985 },
  visible: {
    opacity: 1,
    y: "0vh",
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: `${PANEL_EXIT_VH}vh`,
    scale: 0.99,
    transition: { duration: 0.28, ease: [0.76, 0, 0.24, 1] },
  },
}
const reducedPanelInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}
const panelVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: `${dir * STEP_SLIDE_PCT}%` }),
  center: {
    opacity: 1,
    x: "0%",
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: `${dir * -STEP_EXIT_PCT}%`,
    transition: { duration: 0.32, ease: [0.76, 0, 0.24, 1] },
  }),
}
const reducedPanelVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}
const stageTransition = {
  layout: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
}
const indicatorTransition = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
}
const instantTransition = { duration: 0 }
const instantLayoutTransition = { layout: { duration: 0 } }
