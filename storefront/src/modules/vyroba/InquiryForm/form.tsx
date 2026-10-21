"use client"

import Image from "next/image"
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react"

import { compressImage } from "@lib/util/compress-image"
import { scrollWithLenis } from "@lib/helpers/scrollWithLenis"
import {
  INQUIRY_LIMITS,
  INQUIRY_PHOTO_ACCEPT,
  MAX_INQUIRY_PHOTO_BYTES,
  MAX_INQUIRY_PHOTOS,
  MAX_INQUIRY_PHOTOS_TOTAL_BYTES,
  submitCommissionInquiry,
  validateCommissionInquiry,
  type CommissionInquiryErrors,
  type CommissionInquiryField,
  type CommissionInquiryPhoto,
  type CommissionInquiryValues,
} from "@lib/data/commission-inquiry"
import WebButton from "@modules/common/components/Buttons/webButton"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PhoneInput from "@modules/common/components/phone-input"

import styles from "./style.module.scss"

/**
 * Poptávkový formulář zakázky (LEGAL_AUDIT.md §2 krok 1, §9).
 *
 * Pole: co si představujete (povinné), rozměry, motiv / text / číslo,
 * fotografie místa (až 6), termín, jméno a e-mail (povinné), telefon,
 * POVINNÝ NEZAŠKRTNUTÝ souhlas s OP (odkaz na článek o zakázce) a pod ním
 * informační věta o zpracování údajů — ta checkbox není, zpracování pro
 * vypracování nabídky souhlas nepotřebuje (jde o kroky před uzavřením
 * smlouvy na žádost zákazníka).
 *
 * Validuje se na klientovi i na backendu stejnými hláškami; chyby jsou
 * u polí (`aria-invalid` + `aria-describedby`) a fokus skočí na první z nich.
 */

const EMPTY: CommissionInquiryValues = {
  description: "",
  dimensions: "",
  motif: "",
  deadline: "",
  name: "",
  email: "",
  phone: "",
  consent: false,
}

/** Pojistka proti nesmyslně velkému VSTUPNÍMU souboru (komprese ho pak zmenší). */
const MAX_SOURCE_BYTES = 40 * 1024 * 1024

type Draft = {
  id: string
  name: string
  preview: string
  upload: CommissionInquiryPhoto
  bytes: number
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; email: string }
  | { kind: "failed"; message: string }

/** Velikost dekódovaného base64 z dataURL (4 znaky ≈ 3 bajty). */
const approxBytes = (dataUrl: string) => {
  const comma = dataUrl.indexOf(",")
  const payload = comma > -1 ? dataUrl.slice(comma + 1) : dataUrl
  return Math.ceil((payload.length * 3) / 4)
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("read failed"))
    reader.readAsDataURL(file)
  })

const ALLOWED_TYPES = INQUIRY_PHOTO_ACCEPT.split(",")

/**
 * Typ souboru. Windows u HEIC z iPhonu `file.type` často nechá prázdný —
 * pak rozhodne přípona, jinak by backend fotku podle obsahu odmítl jako
 * „JPEG, který není JPEG".
 */
const mimeOf = (file: File): string => {
  const declared = file.type.toLowerCase()
  if (declared) return declared
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (extension === "heic" || extension === "heif") return "image/heic"
  if (extension === "png") return "image/png"
  if (extension === "webp") return "image/webp"
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg"
  return ""
}

const failureMessage = (status: number) => {
  if (status === 413) {
    return "Fotky jsou dohromady příliš velké. Přiložte jich prosím méně, nebo mi je pošlete e-mailem."
  }
  if (status === 429) {
    return "Poptávek přišlo krátce po sobě příliš mnoho. Zkuste to prosím za chvíli."
  }
  if (status === 400) {
    return "Zkontrolujte prosím vyplněné údaje — něco chybí, nebo je v jiném tvaru."
  }
  return "Poptávku se nepodařilo odeslat. Zkuste to prosím znovu."
}

type Props = {
  /** `currentTermsVersion()` ze serveru — verze OP, se kterou zákazník souhlasí. */
  termsVersion: string
  /** Cesta (bez země) na článek OP o zakázce. */
  termsHref: string
  /** Cesta (bez země) na zásady ochrany osobních údajů. */
  privacyHref: string
  contactEmail: string
  /**
   * Výrobek s cenou po domluvě, od kterého zákazník přišel (stránka produktu
   * → `/vyroba?produkt=<handle>#poptavka`): předvyplní popis a jde s poptávkou
   * majitelce jako „K výrobku: …".
   */
  product?: { handle: string; title: string } | null
}

export default function InquiryForm({
  termsVersion,
  termsHref,
  privacyHref,
  contactEmail,
  product = null,
}: Props) {
  const id = useId()
  const fieldId = (field: string) => `${id}-${field}`
  const [values, setValues] = useState<CommissionInquiryValues>(() =>
    product
      ? { ...EMPTY, description: `Zajímá mě výrobek „${product.title}“. ` }
      : EMPTY
  )
  const [errors, setErrors] = useState<CommissionInquiryErrors>({})
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [photoStatus, setPhotoStatus] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" })
  /* Pole, na které po neúspěšném odeslání skočí fokus (efekt níž). */
  const [focusField, setFocusField] = useState<CommissionInquiryField | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const successRef = useRef<HTMLDivElement>(null)

  const busy = submit.kind === "submitting"
  const totalBytes = drafts.reduce((sum, draft) => sum + draft.bytes, 0)

  /*
   * Odkaz `/vyroba#poptavka` (tlačítko z domovské stránky). Prohlížeč na kotvu
   * skočí sám, jenže sekce nad formulářem si výšku dopočítávají až po
   * hydrataci (sticky galerie kroků) a Lenis drží vlastní pozici — skok pak
   * přistane jinde. Po usazení rozvržení se proto dojede ještě jednou.
   */
  useEffect(() => {
    if (window.location.hash !== "#poptavka") return
    const timer = window.setTimeout(() => {
      const target = document.getElementById("poptavka")
      if (target) scrollWithLenis(target, { immediate: true })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!focusField) return
    // Každé pole (i číslo v PhoneInput a checkbox souhlasu) má id `fieldId(pole)`.
    document.getElementById(fieldId(focusField))?.focus()
    setFocusField(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusField])

  useEffect(() => {
    if (submit.kind === "failed") {
      statusRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
    if (submit.kind === "sent") {
      successRef.current?.focus()
    }
  }, [submit])

  const update = <K extends CommissionInquiryField>(field: K, value: CommissionInquiryValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
    // Hláška o neúspěšném odeslání zmizí, jakmile zákazník začne opravovat.
    if (submit.kind === "failed") setSubmit({ kind: "idle" })
    // Chyba u pole zmizí, jakmile ho zákazník opraví — znovu se hodnotí při odeslání.
    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current }
        delete next[field]
        return next
      })
    }
  }

  const addFiles = async (files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : []
    // Přetažení na zamčené tlačítko by jinak prošlo — a dvě souběžné dávky
    // by si spočítaly volné místo každá zvlášť.
    if (!list.length || preparing || busy) return
    setPhotoStatus(null)

    const room = MAX_INQUIRY_PHOTOS - drafts.length
    if (room <= 0) {
      setPhotoStatus(`Víc než ${MAX_INQUIRY_PHOTOS} fotek přiložit nejde.`)
      return
    }

    setPreparing(true)
    const accepted: Draft[] = []
    let running = totalBytes
    let problem: string | null =
      list.length > room
        ? `Přidat šlo jen ${room} — víc než ${MAX_INQUIRY_PHOTOS} fotek přiložit nejde.`
        : null

    for (const file of list.slice(0, room)) {
      const mime = mimeOf(file)
      if (!ALLOWED_TYPES.includes(mime)) {
        problem = `„${file.name}“ není fotka ve formátu JPG, PNG, WEBP nebo HEIC.`
        continue
      }
      if (file.size > MAX_SOURCE_BYTES) {
        problem = `„${file.name}“ je moc velká — přidejte prosím menší.`
        continue
      }
      // Zmenšit a zkomprimovat (~800 kB). Co prohlížeč dekódovat neumí
      // (HEIC na počítači), jde v originále — pokud se vejde do stropu.
      let upload: CommissionInquiryPhoto | null = await compressImage(file).catch(() => null)
      if (!upload) {
        if (file.size > MAX_INQUIRY_PHOTO_BYTES) {
          problem = `„${file.name}“ je moc velká a prohlížeč ji neumí zmenšit — pošlete prosím menší než 6 MB.`
          continue
        }
        const data = await readAsDataUrl(file).catch(() => null)
        if (!data) {
          problem = `„${file.name}“ se nepodařilo načíst.`
          continue
        }
        upload = { filename: file.name, mime_type: mime, data }
      }
      const bytes = approxBytes(upload.data)
      if (running + bytes > MAX_INQUIRY_PHOTOS_TOTAL_BYTES) {
        problem = "Fotky jsou dohromady příliš velké. Další mi prosím pošlete e-mailem."
        continue
      }
      running += bytes
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${accepted.length}-${drafts.length}`,
        name: file.name,
        preview: upload.data,
        upload,
        bytes,
      })
    }

    if (fileInput.current) fileInput.current.value = ""
    setPreparing(false)
    if (accepted.length) setDrafts((current) => [...current, ...accepted])
    setPhotoStatus(problem)
  }

  const removeDraft = (draftId: string) => {
    setDrafts((current) => current.filter((draft) => draft.id !== draftId))
    setPhotoStatus(null)
  }

  const reset = () => {
    setValues(EMPTY)
    setErrors({})
    setDrafts([])
    setPhotoStatus(null)
    setSubmit({ kind: "idle" })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || preparing) return

    const found = validateCommissionInquiry(values)
    const firstInvalid = Object.keys(found)[0] as CommissionInquiryField | undefined
    setErrors(found)
    if (firstInvalid) {
      setSubmit({ kind: "failed", message: "Zkontrolujte prosím označená pole." })
      setFocusField(firstInvalid)
      return
    }

    const website = String(new FormData(event.currentTarget).get("website") ?? "")
    const optional = (value: string) => value.trim() || undefined

    setSubmit({ kind: "submitting" })
    const result = await submitCommissionInquiry({
      description: values.description.trim(),
      dimensions: optional(values.dimensions),
      motif: optional(values.motif),
      deadline: optional(values.deadline),
      name: values.name.trim(),
      email: values.email.trim(),
      phone: optional(values.phone),
      terms_accepted: true,
      terms_version: termsVersion,
      ...(product ? { product_handle: product.handle, product_title: product.title } : {}),
      ...(drafts.length ? { photos: drafts.map((draft) => draft.upload) } : {}),
      ...(website ? { website } : {}),
    })

    if (result.ok) {
      setSubmit({ kind: "sent", email: values.email.trim() })
      return
    }
    setSubmit({ kind: "failed", message: result.message ?? failureMessage(result.status) })
  }

  if (submit.kind === "sent") {
    return (
      <div className={styles.card}>
        <div
          ref={successRef}
          className={styles.success}
          role="status"
          tabIndex={-1}
          data-testid="inquiry-success"
        >
          <p className={styles.cardEyebrow}>Poptávka zakázky</p>
          <h3>Poptávka odešla.</h3>
          <p>
            Děkuji — mám ji. Potvrzení jsem vám poslala na <strong>{submit.email}</strong>.
            Ozvu se zpravidla do dvou pracovních dnů s nabídkou: cenou, dodací lhůtou
            a výší zálohy. Nic jste tím zatím neobjednali ani nezaplatili.
          </p>
          <p className={styles.fine}>
            Potvrzení nedorazilo? Podívejte se i do spamu, nebo mi napište na{" "}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
          <WebButton
            Kind="Button"
            title="Poslat další poptávku"
            onClickAction={reset}
            className={styles.submit}
          />
        </div>
      </div>
    )
  }

  const errorId = (field: CommissionInquiryField) => `${fieldId(field)}-error`
  const describedBy = (field: CommissionInquiryField, hint?: string) =>
    [errors[field] ? errorId(field) : null, hint ?? null].filter(Boolean).join(" ") || undefined

  const fieldError = (field: CommissionInquiryField) =>
    errors[field] ? (
      <p id={errorId(field)} className={styles.error}>
        {errors[field]}
      </p>
    ) : null

  const label = (field: CommissionInquiryField, text: string, hint: ReactNode) => (
    <label htmlFor={fieldId(field)}>
      {text} <i>{hint}</i>
    </label>
  )

  const textField = (
    field: "dimensions" | "motif" | "deadline" | "name" | "email",
    text: string,
    options: {
      required?: boolean
      hint?: string
      placeholder: string
      type?: string
      autoComplete?: string
      maxLength: number
    }
  ) => (
    <div className={styles.field} data-invalid={errors[field] ? "" : undefined}>
      {label(field, text, options.required ? "(povinné)" : options.hint ?? "(nepovinné)")}
      <input
        id={fieldId(field)}
        name={field}
        className={styles.input}
        type={options.type ?? "text"}
        autoComplete={options.autoComplete ?? "off"}
        placeholder={options.placeholder}
        maxLength={options.maxLength}
        value={values[field]}
        onChange={(event) => update(field, event.target.value)}
        aria-required={options.required || undefined}
        aria-invalid={errors[field] ? true : undefined}
        aria-describedby={describedBy(field)}
        disabled={busy}
      />
      {fieldError(field)}
    </div>
  )

  return (
    <div className={styles.card}>
      <form
        className={styles.form}
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby={`${id}-title`}
        aria-busy={busy || undefined}
        data-testid="inquiry-form"
      >
        <p className={styles.cardEyebrow}>Poptávka zakázky · nezávazná</p>
        <h3 id={`${id}-title`} className={styles.cardTitle}>
          Co mám vyrobit?
        </h3>

        <fieldset className={styles.group}>
          <legend>Zadání</legend>

          <div
            className={`${styles.field} ${styles.message}`}
            data-invalid={errors.description ? "" : undefined}
          >
            {label("description", "Co si představujete", "(povinné)")}
            <textarea
              id={fieldId("description")}
              name="description"
              className={styles.input}
              rows={6}
              maxLength={INQUIRY_LIMITS.description}
              placeholder="Např. domovní číslo 229 s vlaštovkou na omítku vedle vchodu, barevně k terakotové střeše…"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              aria-required
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={describedBy("description")}
              disabled={busy}
            />
            {fieldError("description")}
          </div>

          <div className={styles.grid}>
            {textField("dimensions", "Rozměry", {
              hint: "(stačí přibližně)",
              placeholder: "např. 30 × 20 cm",
              maxLength: INQUIRY_LIMITS.dimensions,
            })}
            {textField("motif", "Motiv, text nebo číslo", {
              placeholder: "např. „229“, „U Nováků“, souhvězdí Lva",
              maxLength: INQUIRY_LIMITS.motif,
            })}
            {textField("deadline", "Termín — do kdy", {
              placeholder: "např. do Vánoc, nebo nespěchá",
              maxLength: INQUIRY_LIMITS.deadline,
            })}
          </div>

          <div className={styles.photos}>
            <span className={styles.photosLabel} id={`${id}-photos-label`}>
              Fotografie místa <i>(nepovinné, až {MAX_INQUIRY_PHOTOS})</i>
            </span>
            <p className={styles.hint} id={`${id}-photos-hint`}>
              Kam to přijde — fasáda, branka, zahrada. Pomůže mi to s velikostí i barvou.
            </p>

            {drafts.length > 0 && (
              <ul className={styles.thumbs} aria-labelledby={`${id}-photos-label`}>
                {drafts.map((draft, index) => (
                  <li key={draft.id} className={styles.thumb}>
                    <Image
                      src={draft.preview}
                      alt={`Fotka ${index + 1}: ${draft.name}`}
                      width={120}
                      height={120}
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={() => removeDraft(draft.id)}
                      disabled={busy}
                      aria-label={`Odebrat fotku ${draft.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {drafts.length < MAX_INQUIRY_PHOTOS && (
              <button
                type="button"
                className={styles.dropzone}
                data-dragging={dragging ? "" : undefined}
                onClick={() => fileInput.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  void addFiles(event.dataTransfer.files)
                }}
                disabled={busy || preparing}
                aria-describedby={`${id}-photos-hint`}
                data-testid="inquiry-add-photo"
              >
                <span className={styles.dropIcon} aria-hidden="true">
                  +
                </span>
                <span className={styles.dropText}>
                  {preparing
                    ? "Připravuji fotky…"
                    : drafts.length
                      ? "Přidat další fotku"
                      : "Přidat fotky"}
                </span>
                <span className={styles.dropHint}>
                  JPG, PNG nebo HEIC · {drafts.length}/{MAX_INQUIRY_PHOTOS}
                </span>
              </button>
            )}

            <input
              ref={fileInput}
              type="file"
              accept={INQUIRY_PHOTO_ACCEPT}
              multiple
              hidden
              onChange={(event) => void addFiles(event.target.files)}
              data-testid="inquiry-file-input"
            />

            <p className={styles.photoStatus} role="status" aria-live="polite">
              {photoStatus}
            </p>
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Kontakt</legend>
          <div className={styles.grid}>
            {textField("name", "Jméno", {
              required: true,
              placeholder: "Vaše jméno",
              autoComplete: "name",
              maxLength: INQUIRY_LIMITS.name,
            })}
            {textField("email", "E-mail", {
              required: true,
              type: "email",
              placeholder: "vas@email.cz",
              autoComplete: "email",
              maxLength: INQUIRY_LIMITS.email,
            })}
            <div className={styles.field} data-invalid={errors.phone ? "" : undefined}>
              {label("phone", "Telefon", "(nepovinné)")}
              <PhoneInput
                id={fieldId("phone")}
                name="phone"
                className={styles.phoneRow}
                inputClassName={styles.input}
                placeholder="603 123 456"
                value={values.phone}
                onChange={(event) => update("phone", event.target.value)}
                disabled={busy}
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={describedBy("phone")}
              />
              {fieldError("phone")}
            </div>
          </div>
        </fieldset>

        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor={fieldId("website")}>Nevyplňujte</label>
          <input
            id={fieldId("website")}
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div className={styles.consent} data-invalid={errors.consent ? "" : undefined}>
          <div className={styles.check}>
            <input
              id={fieldId("consent")}
              name="consent"
              type="checkbox"
              checked={values.consent}
              onChange={(event) => update("consent", event.target.checked)}
              aria-required
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={describedBy("consent")}
              disabled={busy}
              data-testid="inquiry-consent"
            />
            <label htmlFor={fieldId("consent")}>
              Souhlasím s{" "}
              <LocalizedClientLink href={termsHref} target="_blank" rel="noopener">
                obchodními podmínkami
              </LocalizedClientLink>
              . <i>(povinné)</i>
            </label>
          </div>
          {fieldError("consent")}
          <p className={styles.fine}>
            Údaje z poptávky použijeme jen k vypracování nabídky —{" "}
            <LocalizedClientLink href={privacyHref} target="_blank" rel="noopener">
              zásady ochrany osobních údajů
            </LocalizedClientLink>
            .
          </p>
        </div>

        {submit.kind === "failed" && (
          <p
            ref={statusRef}
            className={styles.status}
            role="alert"
            data-testid="inquiry-error"
          >
            {submit.message}{" "}
            {Object.keys(errors).length === 0 && (
              <>
                Nebo mi napište rovnou na <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
              </>
            )}
          </p>
        )}

        <div className={styles.footer}>
          <p>Poptávka je nezávazná — nic tím neobjednáváte ani neplatíte.</p>
          <WebButton
            Kind="Button"
            type="submit"
            title={busy ? "Odesílám…" : preparing ? "Připravuji fotky…" : "Odeslat poptávku"}
            disabled={busy || preparing}
            className={styles.submit}
            testId="inquiry-submit"
          />
        </div>
      </form>
    </div>
  )
}
