"use client"

import Image from "next/image"
import { useId, useRef, useState } from "react"

import { submitReturnRequest } from "@lib/data/return-requests"
import type { GuestRefundContext } from "@lib/data/guest-refund"
import type { CommissionUpload } from "@lib/util/made-to-order"
import { compressImage } from "@lib/util/compress-image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import styles from "./style.module.scss"

const MAX_PHOTOS = 6
/* Horní mez VSTUPNÍHO souboru — komprese ho pak stlačí na pár set kB. */
const MAX_SOURCE_BYTES = 40 * 1024 * 1024
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic"

type PhotoDraft = {
  id: string
  name: string
  preview: string
  upload: CommissionUpload
}

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("read failed"))
    reader.readAsDataURL(file)
  })

type Kind = "reklamace" | "vraceni" | "odstoupeni"

const KINDS: { value: Kind; label: string; help: string }[] = [
  {
    value: "reklamace",
    label: "Reklamace (vada zboží)",
    help: "Zboží dorazilo vadné nebo poškozené, nebo se vada objevila později.",
  },
  {
    value: "vraceni",
    label: "Vrácení zboží",
    help: "Chci zboží vrátit.",
  },
  {
    value: "odstoupeni",
    label: "Odstoupení od smlouvy do 14 dnů",
    help: "Bez udání důvodu, do 14 dnů od převzetí (§1829).",
  },
]

const REASON_LABEL: Record<Kind, string> = {
  reklamace: "Reklamace (vada zboží)",
  vraceni: "Vrácení zboží",
  odstoupeni: "Odstoupení od smlouvy do 14 dnů",
}

/**
 * Žádost o reklamaci / vrácení / odstoupení k JEDNÉ objednávce — otevřená z
 * e-mailu (token už prokázal vlastnictví, číslo + e-mail nese kontext). Odešle
 * do veřejného intake `/store/return-requests`; majitelka pak rozhodne v adminu.
 *
 * Právo: odstoupení do 14 dnů (§1829) se u zboží na míru NENABÍZÍ (§1837) —
 * když je celá objednávka zakázková, ta volba je zamčená s vysvětlením.
 */
const isKind = (value: unknown): value is Kind =>
  value === "reklamace" || value === "vraceni" || value === "odstoupeni"

export default function RefundRequest({
  context,
  initialKind,
}: {
  context: GuestRefundContext
  /** Předvolený druh z odkazu (`?kind=`) — „Zrušit objednávku" míří na odstoupení,
      „Reklamace" na reklamaci. Neznámá/chybějící hodnota → výchozí reklamace. */
  initialKind?: string
}) {
  const withdrawalBlocked = context.all_made_to_order
  // Odstoupení je u zboží na míru zamčené — v tom případě předvolbu nebereme.
  const preselected =
    isKind(initialKind) &&
    !(initialKind === "odstoupeni" && withdrawalBlocked)
      ? initialKind
      : "reklamace"
  const [kind, setKind] = useState<Kind>(preselected)
  const [detail, setDetail] = useState("")
  const [photos, setPhotos] = useState<PhotoDraft[]>([])
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  )
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()
  const fileInput = useRef<HTMLInputElement>(null)

  const pickPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) {
      setError(`Víc než ${MAX_PHOTOS} fotek bohužel nejde přidat.`)
      return
    }
    const accepted: PhotoDraft[] = []
    for (const file of Array.from(files).slice(0, room)) {
      if (file.size > MAX_SOURCE_BYTES) {
        setError(`„${file.name}" je moc velká — přidejte prosím menší.`)
        continue
      }
      // Zmenšit a zkomprimovat (~800 kB). Když to prohlížeč neumí (HEIC na
      // desktopu), vezmi originál — backend má na fotku dost velký strop.
      let upload = await compressImage(file).catch(() => null)
      if (!upload) {
        const data = await readAsBase64(file).catch(() => null)
        if (!data) continue
        upload = { filename: file.name, mime_type: file.type, data }
      }
      accepted.push({
        id: `${file.name}-${file.size}-${accepted.length}`,
        name: file.name,
        preview: upload.data,
        upload,
      })
    }
    setPhotos((current) => [...current, ...accepted])
    if (fileInput.current) fileInput.current.value = ""
  }

  const send = async () => {
    if (!detail.trim() || state === "sending") return
    setState("sending")
    setError(null)
    // Druh zapisujeme do důvodu, aby ho majitelka viděla všude, kde se žádost
    // zobrazuje (notifikace, admin „Vrácení").
    const reason = `${REASON_LABEL[kind]} — ${detail.trim()}`
    const result = await submitReturnRequest({
      order_display_id: context.order_display_id,
      email: context.email,
      kind,
      reason,
      photos: photos.length ? photos.map((p) => p.upload) : undefined,
    })
    if (result.success) {
      setState("sent")
      return
    }
    setState("error")
    setError(result.message ?? null)
  }

  if (state === "sent") {
    return (
      <p className={styles.sent} role="status">
        Máme to. Ozveme se vám e-mailem, jakmile si vaši žádost projdeme.
      </p>
    )
  }

  return (
    <div className={styles.root}>
      <fieldset className={styles.kinds}>
        <legend className={styles.legend}>Co chcete řešit?</legend>
        {KINDS.map((k) => {
          const disabled = k.value === "odstoupeni" && withdrawalBlocked
          return (
            <label
              key={k.value}
              className={`${styles.kind} ${disabled ? styles.kindDisabled : ""}`}
            >
              <input
                type="radio"
                name="refund-kind"
                value={k.value}
                checked={kind === k.value}
                disabled={disabled}
                onChange={() => setKind(k.value)}
              />
              <span className={styles.kindText}>
                <span className={styles.kindLabel}>{k.label}</span>
                <span className={styles.kindHelp}>
                  {disabled
                    ? "Zboží na míru — ze zákona od něj nelze odstoupit (§1837)."
                    : k.help}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>

      <label htmlFor={fieldId} className={styles.label}>
        Napište nám detail <i>(povinné)</i>
      </label>
      <textarea
        id={fieldId}
        className={styles.input}
        rows={4}
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        placeholder="Co se stalo, nebo co chcete vrátit — pár slov stačí."
        required
      />

      {/* Fotky vady — ať zákazník ukáže, co je špatně (u reklamace nejcennější). */}
      <div className={styles.photos}>
        <span className={styles.photosLabel}>
          Fotky <em>nepovinné</em> — ukažte, co je špatně
        </span>
        <div className={styles.photoGrid}>
          {photos.map((photo) => (
            <figure key={photo.id} className={styles.photo}>
              <Image
                src={photo.preview}
                alt=""
                width={96}
                height={96}
                unoptimized
              />
              <button
                type="button"
                onClick={() =>
                  setPhotos((current) =>
                    current.filter((p) => p.id !== photo.id)
                  )
                }
                disabled={state === "sending"}
                aria-label="Odebrat fotku"
              >
                ×
              </button>
            </figure>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              className={styles.photoAdd}
              onClick={() => fileInput.current?.click()}
              disabled={state === "sending"}
            >
              <span aria-hidden="true">+</span>
              Přidat fotky
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(event) => void pickPhotos(event.target.files)}
        />
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.submit}
          onClick={send}
          disabled={!detail.trim() || state === "sending"}
        >
          {state === "sending" ? "Odesíláme…" : "Odeslat žádost"}
        </button>
      </div>

      <p className={styles.legal}>
        Podrobnosti najdete v{" "}
        <LocalizedClientLink href="/reklamacni-protokol">
          reklamačním řádu
        </LocalizedClientLink>{" "}
        a ve vzoru pro{" "}
        <LocalizedClientLink href="/odstoupeni-od-smlouvy">
          odstoupení od smlouvy
        </LocalizedClientLink>
        .
      </p>
    </div>
  )
}
