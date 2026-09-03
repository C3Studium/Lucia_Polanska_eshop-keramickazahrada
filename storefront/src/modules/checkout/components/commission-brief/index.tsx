"use client"

import Image from "next/image"
import { useId, useRef, useState, useTransition } from "react"

import type {
  CommissionNote,
  CommissionUpload,
} from "@lib/util/made-to-order"

import styles from "./style.module.scss"

const MAX_PHOTOS = 6
const MAX_BYTES = 6 * 1024 * 1024
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic"

type Draft = { id: string; name: string; preview: string; upload: CommissionUpload }

type Props = {
  /** Free text already saved — the brief as it stands. */
  note: string
  /** Photos already saved, as URLs. */
  photos: string[]
  /** What the piece is, for the heading. */
  title?: string
  /** Diary entries, when this is rendering against a placed order. */
  notes?: CommissionNote[]
  /**
   * `checkout` edits one brief in place; `order` appends to a diary that already has history
   * in it, so the saved entries are listed above the box.
   */
  variant: "checkout" | "order"
  onSubmitAction: (input: {
    note: string
    keepPhotos: string[]
    newPhotos: CommissionUpload[]
  }) => Promise<{ success: boolean; message?: string; photos?: string[]; notes?: CommissionNote[] }>
}

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("read failed"))
    reader.readAsDataURL(file)
  })

/**
 * The brief for a commissioned piece: what the customer wants, in their words and their
 * photographs.
 *
 * A zakázka is the one thing in the shop that does not exist yet, so it is the one thing that
 * cannot be described by a product page. „Takhle vypadá ta fasáda", „v téhle modré, ne té na
 * fotce" — that is the difference between the right piece and an expensive misunderstanding,
 * and it needs a picture more than it needs a paragraph.
 *
 * It stays open after the order is placed, because what someone meant usually becomes sayable
 * only once they can see the thing starting.
 */
export default function CommissionBrief({
  note,
  photos,
  title,
  notes = [],
  variant,
  onSubmitAction,
}: Props) {
  const [text, setText] = useState(note)
  const [kept, setKept] = useState(photos)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [entries, setEntries] = useState(notes)
  const [status, setStatus] = useState<{ kind: "idle" | "saved" | "error"; message?: string }>({
    kind: "idle",
  })
  const [isPending, startTransition] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)
  const fieldId = useId()

  const total = kept.length + drafts.length

  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    setStatus({ kind: "idle" })

    const room = MAX_PHOTOS - total
    if (room <= 0) {
      setStatus({ kind: "error", message: `Víc než ${MAX_PHOTOS} fotek bohužel nejde přidat.` })
      return
    }

    const accepted: Draft[] = []
    for (const file of Array.from(files).slice(0, room)) {
      if (file.size > MAX_BYTES) {
        setStatus({
          kind: "error",
          message: `„${file.name}" je větší než 6 MB — přidejte prosím menší.`,
        })
        continue
      }
      const data = await readAsBase64(file).catch(() => null)
      if (!data) continue
      accepted.push({
        id: `${file.name}-${file.size}-${accepted.length}`,
        name: file.name,
        preview: data,
        upload: { filename: file.name, mime_type: file.type, data },
      })
    }

    setDrafts((current) => [...current, ...accepted])
    if (fileInput.current) fileInput.current.value = ""
  }

  const save = () => {
    if (isPending) return
    if (!text.trim() && !kept.length && !drafts.length) {
      setStatus({ kind: "error", message: "Napište prosím pár slov, nebo přiložte fotku." })
      return
    }

    startTransition(async () => {
      const result = await onSubmitAction({
        note: text,
        keepPhotos: kept,
        newPhotos: drafts.map((draft) => draft.upload),
      })

      if (!result.success) {
        setStatus({ kind: "error", message: result.message ?? "Nepovedlo se to uložit." })
        return
      }

      if (result.photos) setKept(result.photos)
      if (result.notes) {
        setEntries(result.notes)
        // The order variant appends; once saved the box starts empty again.
        setText("")
        setKept([])
      }
      setDrafts([])
      setStatus({ kind: "saved" })
    })
  }

  return (
    <section
      className={variant === "order" ? styles.rootOrder : styles.root}
      aria-busy={isPending || undefined}
      data-testid="commission-brief"
    >
      <header className={styles.header}>
        <p className={styles.eyebrow}>Zakázková výroba</p>
        <h3 className={styles.heading}>
          {variant === "order" ? "Napište mi" : "Co si představujete?"}
        </h3>
        {title && <p className={styles.piece}>{title}</p>}
        <p className={styles.lede}>
          {variant === "order"
            ? "Napadlo vás ještě něco? Napište mi a klidně přiložte fotky — čtu to u rozdělané práce."
            : "Napište, jak si to představujete, a přiložte fotky. Podle toho to vyrobím."}
        </p>
      </header>

      {/* data-lenis-prevent: the thread scrolls itself, otherwise Lenis eats the wheel
          and touch and scrolls the page instead of the conversation. */}
      {variant === "order" && entries.length > 0 && (
        <ol
          className={styles.thread}
          data-lenis-prevent
          data-testid="commission-thread"
        >
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={
                entry.author === "customer" ? styles.entryMine : styles.entryAtelier
              }
            >
              <span className={styles.entryWho}>
                {entry.author === "customer" ? "Vy" : "Ateliér"}
              </span>
              {entry.text && <p className={styles.entryText}>{entry.text}</p>}
              {entry.image_url && (
                <a
                  href={entry.image_url}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.entryPhoto}
                >
                  <Image src={entry.image_url} alt="" width={220} height={160} unoptimized />
                </a>
              )}
            </li>
          ))}
        </ol>
      )}

      <label className={styles.label} htmlFor={fieldId}>
        Poznámka
      </label>
      <textarea
        id={fieldId}
        className={styles.textarea}
        value={text}
        rows={variant === "order" ? 3 : 5}
        maxLength={2000}
        placeholder="Rozměry, barva, nápis, kam to přijde…"
        onChange={(event) => {
          setText(event.target.value)
          setStatus({ kind: "idle" })
        }}
        disabled={isPending}
        data-testid="commission-note-input"
      />

      <div className={styles.photos}>
        {kept.map((url) => (
          <figure key={url} className={styles.photo}>
            <Image src={url} alt="" width={120} height={120} unoptimized />
            <button
              type="button"
              onClick={() => setKept((current) => current.filter((u) => u !== url))}
              disabled={isPending}
              aria-label="Odebrat fotku"
            >
              ×
            </button>
          </figure>
        ))}
        {drafts.map((draft) => (
          <figure key={draft.id} className={styles.photoDraft}>
            <Image src={draft.preview} alt="" width={120} height={120} unoptimized />
            <button
              type="button"
              onClick={() =>
                setDrafts((current) => current.filter((d) => d.id !== draft.id))
              }
              disabled={isPending}
              aria-label="Odebrat fotku"
            >
              ×
            </button>
          </figure>
        ))}

        {total < MAX_PHOTOS && (
          <button
            type="button"
            className={styles.add}
            onClick={() => fileInput.current?.click()}
            disabled={isPending}
            data-testid="commission-add-photo"
          >
            <span aria-hidden="true">+</span>
            Přidat fotku
          </button>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(event) => void pick(event.target.files)}
        data-testid="commission-file-input"
      />

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.save}
          onClick={save}
          disabled={isPending}
          data-testid="commission-save"
        >
          {isPending
            ? "Ukládám…"
            : variant === "order"
            ? "Odeslat do ateliéru"
            : "Uložit k zakázce"}
        </button>
        <span
          className={status.kind === "error" ? styles.error : styles.ok}
          role="status"
          aria-live="polite"
        >
          {status.kind === "error"
            ? status.message
            : status.kind === "saved"
            ? "Uloženo — díky, mám to."
            : `${total}/${MAX_PHOTOS} fotek`}
        </span>
      </div>
    </section>
  )
}
