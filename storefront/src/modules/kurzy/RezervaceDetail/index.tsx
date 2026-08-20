"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import {
  cancelCourseReservation,
  editCourseReservation,
  retryCoursePayment,
  type CourseReservationDetail,
} from "@lib/data/courses"

import { czk, formatDuration, formatPrague } from "../format"

/**
 * The reservation page — where ComGate returns the customer and where the
 * confirmation e-mail's button lands. Access is proven by the signed token in
 * the URL; the state shown is always re-read from the server, so an old link
 * can never show old money state.
 *
 * Self-service lives here too: „Změnit počet osob" (only while nothing was
 * paid online) and „Zrušit rezervaci" (with an inline confirmation spelling
 * out the consequences). Both disappear 48 hours before the course starts —
 * the same cutoff the backend enforces — replaced by one line saying why.
 */

/** Mirrors the backend's COURSE_SELF_SERVICE_CUTOFF_HOURS — display only. */
const SELF_SERVICE_CUTOFF_HOURS = 48

const peopleWord = (count: number): string =>
  count === 1 ? "osoba" : count < 5 ? "osoby" : "osob"

type Voice = {
  eyebrow: string
  title: string
  accent: string
  text: string
  tone: "ok" | "wait" | "warn"
  canRetry?: boolean
}

const voiceFor = (
  reservation: CourseReservationDetail,
  outcome?: string
): Voice => {
  if (reservation.term.status === "cancelled") {
    return {
      eyebrow: "Termín zrušen",
      title: "Tento termín",
      accent: "se bohužel ruší.",
      text:
        reservation.payment_status === "paid"
          ? "Moc se omlouváme. Zaplacenou částku vám vrátíme v plné výši — ozveme se vám co nejdříve."
          : "Moc se omlouváme. Jakmile vypíšeme nové termíny, najdete je na stránce Kurzy.",
      tone: "warn",
    }
  }
  if (reservation.status === "cancelled") {
    if (reservation.cancel_reason === "customer") {
      return {
        eyebrow: "Rezervace zrušena",
        title: "Rezervaci jste",
        accent: "zrušili.",
        text:
          reservation.payment_status === "paid"
            ? reservation.refunded_at
              ? "Zaplacenou částku vám vracíme zpět na kartu, ze které jste platili — obvykle dorazí do několika dní. Kdybyste si to rozmysleli, na stránce Kurzy si vyberete nový termín."
              : "Zaplacenou částku vám vrátíme v plné výši — ozveme se vám co nejdříve. Kdybyste si to rozmysleli, na stránce Kurzy si vyberete nový termín."
            : "Místo jsme uvolnili a nic se neplatí. Kdybyste si to rozmysleli, na stránce Kurzy si vyberete nový termín.",
        tone: "warn",
      }
    }
    return {
      eyebrow: "Rezervace zrušena",
      title: "Tahle rezervace",
      accent: "už neplatí.",
      text: "Pokud jste ji nerušili vy, ozvěte se nám a najdeme řešení.",
      tone: "warn",
    }
  }
  if (reservation.payment_status === "paid") {
    return {
      eyebrow: "Zaplaceno",
      title: "Místo je vaše,",
      accent: "těšíme se na vás.",
      text: "Platba dorazila a potvrzení jsme poslali e-mailem. Stačí přijít — vezměte si oblečení, kterému nevadí hlína.",
      tone: "ok",
    }
  }
  if (reservation.payment_method === "on_site") {
    return {
      eyebrow: "Rezervováno",
      title: "Místo je vaše,",
      accent: "zaplatíte na místě.",
      text: "Potvrzení jsme poslali e-mailem. Kurz zaplatíte hotově nebo kartou před začátkem.",
      tone: "ok",
    }
  }
  if (outcome === "pending") {
    return {
      eyebrow: "Platba se zpracovává",
      title: "Ještě chvilku,",
      accent: "banka pracuje.",
      text: "Platba je na cestě. Jakmile ji banka potvrdí, pošleme vám e-mail s potvrzením — stránku můžete kdykoli obnovit.",
      tone: "wait",
    }
  }
  return {
    eyebrow: "Platba nedokončena",
    title: "Rezervaci držíme,",
    accent: "platba zatím nedorazila.",
    text: "Platba se nepovedla nebo byla zrušená. Můžete to zkusit znovu — nebo nám napište a domluvíme platbu na místě.",
    tone: "warn",
    canRetry: true,
  }
}

export default function RezervaceDetail({
  reservation,
  token,
  outcome,
}: {
  reservation: CourseReservationDetail
  token: string
  outcome?: string
}) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  /* --------------------------------------------------- self-service state */
  const [editOpen, setEditOpen] = useState(false)
  const [editSize, setEditSize] = useState(reservation.party_size)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const voice = voiceFor(reservation, outcome)

  /* Back from ComGate via bfcache: the page resumes frozen mid-„Připravuji
     platbu…" — unfreeze the retry button so it can be used again. */
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setRetrying(false)
      }
    }
    window.addEventListener("pageshow", handlePageShow)
    return () => window.removeEventListener("pageshow", handlePageShow)
  }, [])

  const startsAtMs = new Date(reservation.term.starts_at).getTime()
  const beforeCutoff =
    Date.now() < startsAtMs - SELF_SERVICE_CUTOFF_HOURS * 60 * 60 * 1000
  const termOpen =
    reservation.status === "active" && reservation.term.status === "published"
  const canSelfService = termOpen && beforeCutoff
  const paidOnline =
    reservation.payment_method === "online" &&
    reservation.payment_status === "paid"
  const canEdit = canSelfService && !paidOnline
  /* The cutoff line shows only while there is still a course to miss. */
  const showCutoffNote = termOpen && !beforeCutoff && startsAtMs > Date.now()

  const retry = useCallback(async () => {
    if (retrying) return
    setRetrying(true)
    setRetryError(null)
    const result = await retryCoursePayment(reservation.id, token)
    if (result.payment_url) {
      window.location.href = result.payment_url
      return
    }
    setRetryError(result.message ?? "Platbu se teď nepodařilo založit.")
    setRetrying(false)
  }, [reservation.id, retrying, token])

  const saveEdit = useCallback(async () => {
    if (editSaving || editSize === reservation.party_size) return
    setEditSaving(true)
    setEditError(null)
    const result = await editCourseReservation(reservation.id, token, editSize)
    if (!result.ok) {
      setEditError(result.message)
      setEditSaving(false)
      return
    }
    setEditSaving(false)
    setEditOpen(false)
    setNotice(
      `Hotovo — rezervace je nově pro ${result.party_size} ${peopleWord(
        result.party_size
      )}, celkem ${czk(result.total_price)}.${
        reservation.payment_method === "on_site"
          ? " Potvrzení s novými údaji jsme poslali e-mailem."
          : ""
      }`
    )
    router.refresh()
  }, [
    editSaving,
    editSize,
    reservation.id,
    reservation.party_size,
    reservation.payment_method,
    router,
    token,
  ])

  const confirmCancel = useCallback(async () => {
    if (cancelling) return
    setCancelling(true)
    setCancelError(null)
    const result = await cancelCourseReservation(reservation.id, token)
    if (!result.ok) {
      setCancelError(result.message)
      setCancelling(false)
      return
    }
    setCancelling(false)
    setCancelOpen(false)
    setNotice(
      result.refunded
        ? "Rezervace je zrušená. Peníze vám vracíme zpět na kartu — obvykle dorazí do několika dní."
        : result.needs_manual_refund
          ? "Rezervace je zrušená. Zaplacenou částku vám vrátíme v plné výši, ozveme se co nejdříve."
          : "Rezervace je zrušená. Nic jste neplatili, takže se nic nevrací."
    )
    router.refresh()
  }, [cancelling, reservation.id, router, token])

  return (
    <main className="kurzyDetail" data-tone={voice.tone}>
      <section className="kurzyDetail__panel">
        <span className="kurzyDetail__eyebrow">{voice.eyebrow}</span>
        <h1>
          {voice.title}
          <em>{voice.accent}</em>
        </h1>
        <p className="kurzyDetail__lede">{voice.text}</p>

        {notice ? (
          <p className="kurzyDetail__notice" role="status">
            {notice}
          </p>
        ) : null}

        <dl>
          <div>
            <dt>Kurz</dt>
            <dd>{reservation.term.title}</dd>
          </div>
          <div>
            <dt>Kdy</dt>
            <dd>{formatPrague(reservation.term.starts_at)}</dd>
          </div>
          <div>
            <dt>Kde</dt>
            <dd>{reservation.term.location}</dd>
          </div>
          {reservation.term.duration_minutes ? (
            <div>
              <dt>Délka</dt>
              <dd>{formatDuration(reservation.term.duration_minutes)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Rezervace</dt>
            <dd>
              {reservation.name} · {reservation.party_size}{" "}
              {peopleWord(reservation.party_size)}
            </dd>
          </div>
          <div>
            <dt>
              {reservation.payment_status === "paid"
                ? "Zaplaceno"
                : reservation.payment_method === "on_site"
                  ? "Na místě zaplatíte"
                  : "K platbě"}
            </dt>
            <dd className="kurzyDetail__total">{czk(reservation.total_price)}</dd>
          </div>
        </dl>

        {voice.canRetry ? (
          <div className="kurzyDetail__actions">
            <button
              type="button"
              className="kurzyDetail__retry"
              onClick={retry}
              disabled={retrying}
            >
              {retrying ? "Připravuji platbu…" : "Zkusit zaplatit znovu"}
              <i aria-hidden="true">↗</i>
            </button>
            {retryError ? (
              <p className="kurzyDetail__error" role="alert">
                {retryError}
              </p>
            ) : null}
          </div>
        ) : null}

        {voice.tone === "wait" ? (
          <div className="kurzyDetail__actions">
            <button
              type="button"
              className="kurzyDetail__retry"
              onClick={() => router.refresh()}
            >
              Obnovit stav
            </button>
          </div>
        ) : null}

        {/* ---------------------------------------------- self-service --- */}
        {canSelfService ? (
          <div className="kurzyDetail__selfService">
            <h2>Potřebujete něco změnit?</h2>

            {canEdit ? (
              editOpen ? (
                <div className="kurzyDetail__editForm">
                  <div className="kurzyDetail__count">
                    <span id="kurzy-detail-count">Počet osob</span>
                    <div>
                      <button
                        type="button"
                        aria-label="Méně osob"
                        disabled={editSize <= 1}
                        onClick={() =>
                          setEditSize((value) => Math.max(1, value - 1))
                        }
                      >
                        −
                      </button>
                      <output aria-labelledby="kurzy-detail-count">
                        {editSize}
                      </output>
                      <button
                        type="button"
                        aria-label="Více osob"
                        disabled={editSize >= 30}
                        onClick={() =>
                          setEditSize((value) => Math.min(30, value + 1))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="kurzyDetail__selfServiceHint">
                    Cenu přepočítáme podle nového počtu osob a pošleme vám
                    potvrzení.
                  </p>
                  {editError ? (
                    <p className="kurzyDetail__error" role="alert">
                      {editError}
                    </p>
                  ) : null}
                  <div className="kurzyDetail__selfServiceRow">
                    <button
                      type="button"
                      className="kurzyDetail__retry"
                      onClick={saveEdit}
                      disabled={editSaving || editSize === reservation.party_size}
                    >
                      {editSaving ? "Ukládám…" : "Uložit změnu"}
                    </button>
                    <button
                      type="button"
                      className="kurzyDetail__ghost"
                      onClick={() => {
                        setEditOpen(false)
                        setEditSize(reservation.party_size)
                        setEditError(null)
                      }}
                    >
                      Zpět bez změny
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="kurzyDetail__ghost"
                  onClick={() => {
                    setEditOpen(true)
                    setCancelOpen(false)
                    setNotice(null)
                  }}
                >
                  Změnit počet osob
                </button>
              )
            ) : (
              <p className="kurzyDetail__selfServiceHint">
                Zaplacenou rezervaci upravíte zrušením (peníze vrátíme na
                kartu) a novou rezervací — nebo mi zavolejte.
              </p>
            )}

            {cancelOpen ? (
              <div className="kurzyDetail__cancelConfirm">
                <strong>Opravdu rezervaci zrušit?</strong>
                <p>
                  Vaše místo{" "}
                  {reservation.party_size === 1
                    ? ""
                    : `pro ${reservation.party_size} ${peopleWord(
                        reservation.party_size
                      )} `}
                  se uvolní dalším zájemcům.{" "}
                  {paidOnline
                    ? `Zaplacenou částku ${czk(
                        reservation.total_price
                      )} vám vrátíme zpět na kartu, ze které jste platili.`
                    : "Nic jste zatím neplatili, takže se nic nevrací."}{" "}
                  Potvrzení o zrušení pošleme e-mailem.
                </p>
                {cancelError ? (
                  <p className="kurzyDetail__error" role="alert">
                    {cancelError}
                  </p>
                ) : null}
                <div className="kurzyDetail__selfServiceRow">
                  <button
                    type="button"
                    className="kurzyDetail__danger"
                    onClick={confirmCancel}
                    disabled={cancelling}
                  >
                    {cancelling ? "Ruším…" : "Ano, zrušit rezervaci"}
                  </button>
                  <button
                    type="button"
                    className="kurzyDetail__ghost"
                    onClick={() => {
                      setCancelOpen(false)
                      setCancelError(null)
                    }}
                  >
                    Ponechat rezervaci
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="kurzyDetail__ghost kurzyDetail__ghost--danger"
                onClick={() => {
                  setCancelOpen(true)
                  setEditOpen(false)
                  setNotice(null)
                }}
              >
                Zrušit rezervaci
              </button>
            )}
          </div>
        ) : showCutoffNote ? (
          <p className="kurzyDetail__selfServiceHint kurzyDetail__cutoffNote">
            Do kurzu zbývá méně než {SELF_SERVICE_CUTOFF_HOURS} hodin —
            zavolejte mi prosím.
          </p>
        ) : null}

        {reservation.invoice_pdf_url ? (
          <p className="kurzyDetail__invoice">
            <a
              href={reservation.invoice_pdf_url}
              target="_blank"
              rel="noreferrer"
            >
              Stáhnout fakturu (PDF) ↗
            </a>
          </p>
        ) : null}
      </section>
    </main>
  )
}
