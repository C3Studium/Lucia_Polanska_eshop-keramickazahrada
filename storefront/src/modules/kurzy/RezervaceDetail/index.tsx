"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { usePaymentWatch } from "@lib/hooks/use-payment-watch"
import { confirmCourseReservation } from "@lib/data/courses"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import {
  cancelCourseReservation,
  editCourseReservation,
  retryCoursePayment,
  type CourseReservationDetail,
} from "@lib/data/courses"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import { itemText } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"

import { czk, formatDuration, formatPrague } from "../format"

/**
 * The reservation page — where ComGate returns the customer and where the
 * confirmation e-mail's button lands. Access is proven by the signed token in
 * the URL; the state shown is always re-read from the server, so an old link
 * can never show old money state.
 *
 * Self-service lives here too: „Změnit počet osob" (only while nothing was
 * paid online) and „Zrušit rezervaci" (with an inline confirmation spelling
 * out the consequences). Both disappear 24 hours before the course starts —
 * the same cutoff the backend enforces — replaced by one line saying why.
 */

/** Mirrors the backend's COURSE_SELF_SERVICE_CUTOFF_HOURS (24 h od 20. 10. 2026) — display only. */
const SELF_SERVICE_CUTOFF_HOURS = 24


const peopleWord = (count: number): string =>
  count === 1 ? "osoba" : count < 5 ? "osoby" : "osob"

/**
 * Stavy rezervace, jak se jmenují v bloku `kurzy.rezervace-stavy` — česky,
 * ať Lucie ve Studiu pozná, ke kterému řádek patří. Každý má `<stav>.stitek`
 * (obočí), `<stav>.nadpis` (nadpis v `value`, zvýrazněný konec v `note`)
 * a většinou `<stav>.text` (odstavec).
 */
type StateKey =
  | "termin-zrusen"
  | "zruseno-vami"
  | "zruseno"
  | "zaplaceno"
  | "na-miste"
  | "zpracovava"
  | "nezaplaceno"
  | "vyjimka"

/**
 * Výchozí texty stavů. `text` chybí tam, kde odstavec říká něco o penězích
 * (vrácení zaplacené částky, „nic se neplatí") — ten je v `voiceFor` a do
 * CMS nepatří: přepsaný nebo vymazaný ve Studiu by zákazník nevěděl, jestli
 * a kdy mu peníze přijdou. U zrušeného termínu jde do CMS jen věta pro
 * nezaplacenou rezervaci; po zaplacení drží odstavec kód.
 */
const STATE_DEFAULTS: Record<
  StateKey,
  { stitek: string; nadpis: string; zvyrazneni: string; text?: string }
> = {
  "termin-zrusen": {
    stitek: "Termín zrušen",
    nadpis: "Tento termín",
    zvyrazneni: "se bohužel ruší.",
    text: "Moc se omlouváme. Jakmile vypíšeme nové termíny, najdete je na stránce Kurzy.",
  },
  "zruseno-vami": {
    stitek: "Rezervace zrušena",
    nadpis: "Rezervaci jste",
    zvyrazneni: "zrušili.",
  },
  zruseno: {
    stitek: "Rezervace zrušena",
    nadpis: "Tahle rezervace",
    zvyrazneni: "už neplatí.",
    text: "Pokud jste ji nerušili vy, ozvěte se nám a najdeme řešení.",
  },
  zaplaceno: {
    stitek: "Zaplaceno",
    nadpis: "Místo je vaše,",
    zvyrazneni: "těšíme se na vás.",
    text: "Platba dorazila a potvrzení jsme poslali e-mailem. Stačí přijít — vezměte si oblečení, kterému nevadí hlína.",
  },
  /* Schválená žádost o místo na plném termínu — zákazník si vybírá platbu. */
  vyjimka: {
    stitek: "Výjimka schválena",
    nadpis: "Místo pro vás mám,",
    zvyrazneni: "stačí vybrat platbu.",
    text: "Termín byl plně obsazený, ale výjimku jsem schválila — místo pro vás mám. Vyberte níž, jak zaplatíte, a potvrďte obchodní podmínky. Místo držím 24 hodin.",
  },
  "na-miste": {
    stitek: "Rezervováno",
    nadpis: "Místo je vaše,",
    zvyrazneni: "zaplatíte na místě.",
    text: "Potvrzení jsme poslali e-mailem. Kurz zaplatíte hotově nebo kartou před začátkem.",
  },
  zpracovava: {
    stitek: "Platba se zpracovává",
    nadpis: "Ještě chvilku,",
    zvyrazneni: "banka pracuje.",
    text: "Platba je na cestě. Jakmile ji banka potvrdí, pošleme vám e-mail s potvrzením — stránku můžete kdykoli obnovit.",
  },
  nezaplaceno: {
    stitek: "Platba nedokončena",
    nadpis: "Rezervaci držíme,",
    zvyrazneni: "platba zatím nedorazila.",
    text: "Platba se nepovedla nebo byla zrušená. Můžete to zkusit znovu — nebo nám napište a domluvíme platbu na místě.",
  },
}

/** Ostatní texty bloku `kurzy.rezervace-stavy` — samoobsluha pod údaji. */
const SELF_SERVICE_DEFAULTS = {
  "zmena.nadpis": "Potřebujete něco změnit?",
  "zmena.napoveda": "Cenu přepočítáme podle nového počtu osob a pošleme vám potvrzení.",
  "zruseni.otazka": "Opravdu rezervaci zrušit?",
} as const

type Voice = {
  state: StateKey
  eyebrow: string
  title: string
  accent: string
  text: string
  /** Odstavec je z bloku (a dá se upravit v místě), ne věta o penězích z kódu. */
  textFromCopy: boolean
  tone: "ok" | "wait" | "warn"
  canRetry?: boolean
}

const voiceFor = (
  reservation: CourseReservationDetail,
  outcome?: string,
  block?: CopyBlock
): Voice => {
  /** Stav s texty z bloku; `text` z kódu jen tam, kde mluví o penězích. */
  const say = (
    state: StateKey,
    rest: { tone: Voice["tone"]; canRetry?: boolean; moneyText?: string }
  ): Voice => {
    const fallback = STATE_DEFAULTS[state]
    return {
      state,
      eyebrow: itemText(block, `${state}.stitek`, fallback.stitek),
      title: itemText(block, `${state}.nadpis`, fallback.nadpis),
      accent: itemText(block, `${state}.nadpis`, fallback.zvyrazneni, "note"),
      text: rest.moneyText ?? itemText(block, `${state}.text`, fallback.text ?? ""),
      textFromCopy: rest.moneyText === undefined,
      tone: rest.tone,
      canRetry: rest.canRetry,
    }
  }

  if (reservation.term.status === "cancelled") {
    return say("termin-zrusen", {
      tone: "warn",
      moneyText:
        reservation.payment_status === "paid"
          ? "Moc se omlouváme. Zaplacenou částku vám vrátíme v plné výši — ozveme se vám co nejdříve."
          : undefined,
    })
  }
  if (reservation.status === "cancelled") {
    if (reservation.cancel_reason === "customer") {
      return say("zruseno-vami", {
        tone: "warn",
        moneyText:
          reservation.payment_status === "paid"
            ? reservation.refunded_at
              ? "Zaplacenou částku vám vracíme stejnou cestou, jakou jste platili — obvykle dorazí do několika dní. Kdybyste si to rozmysleli, na stránce Kurzy si vyberete nový termín."
              : "Zaplacenou částku vám vrátíme v plné výši — ozveme se vám co nejdříve. Kdybyste si to rozmysleli, na stránce Kurzy si vyberete nový termín."
            : "Místo jsme uvolnili a nic se neplatí. Kdybyste si to rozmysleli, na stránce Kurzy si vyberete nový termín.",
      })
    }
    return say("zruseno", { tone: "warn" })
  }
  if (reservation.payment_choice_pending && reservation.payment_status !== "paid") {
    /* Schválená žádost o místo: zákazník si vybírá platbu a potvrzuje podmínky. */
    return say("vyjimka", { tone: "ok" })
  }
  if (reservation.payment_status === "paid" && (reservation.amount_due ?? 0) > 0) {
    /* Po přidání osob zbývá doplatek — „Místo je vaše, platba dorazila" by lhalo. */
    return say("nezaplaceno", {
      tone: "warn",
      moneyText: `Po přidání osob zbývá doplatit ${czk(reservation.amount_due ?? 0)}. Místo pro všechny držíme — doplatek zaplatíte kartou stejně jako rezervaci.`,
    })
  }
  if (reservation.payment_status === "paid") {
    return say("zaplaceno", { tone: "ok" })
  }
  if (reservation.payment_method === "on_site") {
    return say("na-miste", { tone: "ok" })
  }
  /*
   * Brána říká „zaplaceno", naše evidence ještě ne.
   *
   * Tohle je normální stav, ne chyba: zaplacenou rezervaci u nás označí až
   * ověřené oznámení od ComGate (nebo dohledová úloha), a zákazník se z
   * brány vrátí dřív. Dokud se to nesrovná, je to „zpracovává se".
   *
   * DŘÍV sem padal jen `pending` a návrat s `paid` propadl až na poslední
   * řádek — tedy „platba nedorazila, zkuste to znovu" člověku, který právě
   * zaplatil. Krom toho, že to je nepravda, mu to nabízelo zaplatit podruhé.
   */
  /*
   * Brána sama říká, co se stalo (GET rezervace se jí ptá):
   * - `canceled`: zákazník klikl „Zrušit platbu" (nebo platba vypršela) →
   *   zaplatit znovu založí NOVOU platbu,
   * - `pending` po návratu s `pending`/`cancelled`: klikl „Návrat do
   *   e-shopu" a nezaplatil — nebo posílá převod. Nabídnout dokončení; tlačítko
   *   otevře TUTÉŽ platbu, takže dvakrát zaplatit nejde.
   */
  if (reservation.gateway_status === "canceled") {
    return say("nezaplaceno", { tone: "warn", canRetry: true })
  }
  if (outcome === "paid") {
    return say("zpracovava", { tone: "wait" })
  }
  if (outcome === "pending" || outcome === "cancelled") {
    return say("nezaplaceno", {
      tone: "warn",
      canRetry: true,
      moneyText:
        "Platba zatím nedorazila. Pokud jste ji na platební bráně nedokončili, dokončete ji tlačítkem níže — otevře se stejná platba, zaplatit dvakrát tedy nejde. Pokud jste platili převodem, nemusíte nic dělat: jakmile peníze dorazí, pošleme vám potvrzení e-mailem.",
    })
  }

  /* Zbývá návrat se `cancelled` a přímé otevření odkazu — tam platba
     opravdu nedorazila a opakování je na místě. */
  return say("nezaplaceno", { tone: "warn", canRetry: true })
}

export default function RezervaceDetail({
  reservation,
  token,
  outcome,
  block,
}: {
  reservation: CourseReservationDetail
  token: string
  outcome?: string
  /** Blok `kurzy.rezervace-stavy` — texty stavů (viz STATE_DEFAULTS). */
  block?: CopyBlock
}) {
  /* Stránka bez vlastního pohybu — po zapnutí editace by zůstala bez anotací. */
  useEditRerender()
  const selfService = (label: keyof typeof SELF_SERVICE_DEFAULTS) =>
    itemText(block, label, SELF_SERVICE_DEFAULTS[label])
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

  /* ---------------------------------------- schválená výjimka: volba platby */
  const choosing = Boolean(reservation.payment_choice_pending) && reservation.payment_status !== "paid" && reservation.status === "active"
  const [choiceTerms, setChoiceTerms] = useState(false)
  const [choicePhotos, setChoicePhotos] = useState(false)
  const [choiceBusy, setChoiceBusy] = useState<"online" | "on_site" | null>(null)
  const [choiceError, setChoiceError] = useState<string | null>(null)
  const confirmChoice = async (method: "online" | "on_site") => {
    if (choiceBusy) return
    if (!choiceTerms) {
      setChoiceError("Potvrďte prosím souhlas s obchodními podmínkami.")
      return
    }
    setChoiceBusy(method)
    setChoiceError(null)
    const result = await confirmCourseReservation(reservation.id, token, {
      payment_method: method,
      terms_accepted: true,
      photo_consent: choicePhotos,
    })
    if (!result.ok) {
      setChoiceError(result.message)
      setChoiceBusy(null)
      return
    }
    if (result.payment_url) {
      window.location.href = result.payment_url
      return
    }
    setChoiceBusy(null)
    setNotice("Hotovo — rezervace je potvrzená, zaplatíte na místě. Potvrzení jsme poslali e-mailem.")
    router.refresh()
  }

  const voice = voiceFor(reservation, outcome, block)

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

  /* Dokud online platba není zaplacená, stránka se sama obnovuje (backend se
     při každém čtení zeptá ComGate a zaplacenou platbu hned zachytí) — každé
     3 s, později 10 s, a hned po návratu do záložky. Jakmile je zaplaceno
     nebo rezervace skončí, hlídání se vypne samo. */
  const watching =
    reservation.payment_method === "online" &&
    reservation.status === "active" &&
    (reservation.payment_status !== "paid" || (reservation.amount_due ?? 0) > 0)
  usePaymentWatch(async () => {
    router.refresh()
    return false
  }, watching)

  const startsAtMs = new Date(reservation.term.starts_at).getTime()
  const beforeCutoff =
    Date.now() < startsAtMs - SELF_SERVICE_CUTOFF_HOURS * 60 * 60 * 1000
  const termOpen =
    reservation.status === "active" && reservation.term.status === "published"
  const canSelfService = termOpen && beforeCutoff
  const paidOnline =
    reservation.payment_method === "online" &&
    reservation.payment_status === "paid"
  // I zaplacenou rezervaci jde upravit: rozdíl se doplatí, nebo vrátí (backend).
  const canEdit = canSelfService
  /* Doplatek po přidání osob u zaplacené rezervace. */
  const supplementDue = paidOnline && (reservation.amount_due ?? 0) > 0
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
    // Platba mezitím prošla (stránka ukazovala starý stav) → ukázat „zaplaceno", ne chybu.
    if (/zaplacen/i.test(result.message ?? "")) {
      setRetrying(false)
      router.refresh()
      return
    }
    setRetryError(result.message ?? "Platbu se teď nepodařilo založit.")
    setRetrying(false)
  }, [reservation.id, retrying, router, token])

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
    // Přidané osoby u zaplacené rezervace → rovnou zaplatit rozdíl.
    if (result.payment_url) {
      setNotice(`Rezervace je nově pro ${result.party_size} ${peopleWord(result.party_size)}. Přesměrovávám na doplatek ${czk(result.amount_due)}…`)
      window.location.href = result.payment_url
      return
    }
    setEditSaving(false)
    setEditOpen(false)
    const change = result.change
    setNotice(
      `Hotovo — rezervace je nově pro ${result.party_size} ${peopleWord(
        result.party_size
      )}, celkem ${czk(result.total_price)}.${
        change?.action === "refund"
          ? change.refunded
            ? ` Rozdíl ${czk(change.amount)} vám vracíme stejnou cestou, jakou jste platili.`
            : ` Rozdíl ${czk(change.amount)} vám vrátíme — automaticky to nešlo, ozveme se.`
          : change?.action === "supplement"
            ? ` Zbývá doplatit ${czk(result.amount_due)} — tlačítko Doplatit najdete níž.`
            : ""
      } Potvrzení s novými údaji jsme poslali e-mailem.`
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
        ? "Rezervace je zrušená. Peníze vám vracíme stejnou cestou, jakou jste platili — obvykle dorazí do několika dní."
        : result.needs_manual_refund
          ? "Rezervace je zrušená. Zaplacenou částku vám vrátíme v plné výši, ozveme se co nejdříve."
          : "Rezervace je zrušená. Nic jste neplatili, takže se nic nevrací."
    )
    router.refresh()
  }, [cancelling, reservation.id, router, token])

  return (
    <main className="kurzyDetail" data-tone={voice.tone}>
      <section className="kurzyDetail__panel">
        <span
          className="kurzyDetail__eyebrow"
          {...editableItem(block, `${voice.state}.stitek`)}
        >
          {voice.eyebrow}
        </span>
        {/* Začátek nadpisu v holém spanu jen kvůli anotaci — konec je `note`. */}
        <h1>
          <span {...editableItem(block, `${voice.state}.nadpis`)}>{voice.title}</span>
          <em {...editableItem(block, `${voice.state}.nadpis`, "note")}>
            {voice.accent}
          </em>
        </h1>
        {/* Věta o penězích (z kódu) se neanotuje — do bloku nepatří. */}
        <p
          className="kurzyDetail__lede"
          {...(voice.textFromCopy ? editableItem(block, `${voice.state}.text`) : {})}
        >
          {voice.text}
        </p>

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
          {supplementDue ? (
            <>
              <div>
                <dt>Cena celkem</dt>
                <dd>{czk(reservation.total_price)}</dd>
              </div>
              <div>
                <dt>Zaplaceno</dt>
                <dd>{czk(reservation.paid_amount ?? 0)}</dd>
              </div>
              <div>
                <dt>K doplacení</dt>
                <dd className="kurzyDetail__total">{czk(reservation.amount_due ?? 0)}</dd>
              </div>
            </>
          ) : (
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
          )}
        </dl>

        {supplementDue ? (
          <div className="kurzyDetail__actions">
            <button type="button" className="kurzyDetail__retry" onClick={retry} disabled={retrying}>
              {retrying ? "Připravuji platbu…" : `Doplatit ${czk(reservation.amount_due ?? 0)}`}
              <i aria-hidden="true">↗</i>
            </button>
            {retryError ? (
              <p className="kurzyDetail__error" role="alert">
                {retryError}
              </p>
            ) : null}
          </div>
        ) : null}

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

        {choosing ? (
          <div className="kurzyDetail__actions kurzyDetail__choice">
            <label className="kurzyDetail__check">
              <input
                type="checkbox"
                checked={choiceTerms}
                onChange={(event) => {
                  setChoiceTerms(event.target.checked)
                  setChoiceError(null)
                }}
              />
              <span>
                Souhlasím s{" "}
                <LocalizedClientLink href="/smluvni-podminky#kurzy" target="_blank" rel="noopener">
                  obchodními podmínkami
                </LocalizedClientLink>
                . Kurz má pevný termín, proto u něj neplatí zákonné odstoupení do 14 dnů bez udání
                důvodu (§ 1837 písm. j) občanského zákoníku); platí storno podmínky.
              </span>
            </label>
            <label className="kurzyDetail__check">
              <input type="checkbox" checked={choicePhotos} onChange={(event) => setChoicePhotos(event.target.checked)} />
              <span>
                Souhlasím s pořízením fotografií z kurzu a jejich zveřejněním na webu a sociálních
                sítích (nepovinné).
              </span>
            </label>
            {choiceError ? (
              <p className="kurzyDetail__error" role="alert">
                {choiceError}
              </p>
            ) : null}
            <div className="kurzyDetail__selfServiceRow">
              <button
                type="button"
                className="kurzyDetail__retry"
                disabled={choiceBusy !== null}
                onClick={() => confirmChoice("online")}
              >
                {choiceBusy === "online" ? "Připravuji platbu…" : `Zaplatit kartou ${czk(reservation.total_price)}`}
                <i aria-hidden="true">↗</i>
              </button>
              <button
                type="button"
                className="kurzyDetail__ghost"
                disabled={choiceBusy !== null}
                onClick={() => confirmChoice("on_site")}
              >
                {choiceBusy === "on_site" ? "Potvrzuji…" : "Zaplatím na místě"}
              </button>
            </div>
          </div>
        ) : null}

        {/* ---------------------------------------------- self-service --- */}
        {canSelfService && !choosing ? (
          <div className="kurzyDetail__selfService">
            <h2 {...editableItem(block, "zmena.nadpis")}>{selfService("zmena.nadpis")}</h2>

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
                  <p
                    className="kurzyDetail__selfServiceHint"
                    {...editableItem(block, "zmena.napoveda")}
                  >
                    {selfService("zmena.napoveda")}
                  </p>
                  {paidOnline ? (
                    <p className="kurzyDetail__selfServiceHint">
                      Rezervace je zaplacená: když osoby přidáte, rozdíl hned doplatíte kartou; když
                      uberete, rozdíl vám vrátíme stejnou cestou, jakou jste platili. Cena na osobu se
                      řídí počtem osob.
                    </p>
                  ) : null}
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
                <strong {...editableItem(block, "zruseni.otazka")}>
                  {selfService("zruseni.otazka")}
                </strong>
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
                        reservation.paid_amount ?? reservation.total_price
                      )} vám vrátíme stejnou cestou, jakou jste platili.`
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
