"use client"

import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useId, useRef, useState } from "react"

import { submitClaim } from "@lib/data/claims"
import {
  REQUESTED_RESOLUTION_LABEL,
  findOpenClaim,
  formatClaimDate,
  isClaimKind,
  withdrawBlockText,
  type ClaimKind,
  type ClaimRequestedResolution,
  type OrderClaims,
} from "@lib/util/claims"
import type { CommissionUpload } from "@lib/util/made-to-order"
import { compressImage } from "@lib/util/compress-image"
import ClaimStatus from "@modules/order/components/claim-status"
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

const KINDS: { value: ClaimKind; label: string; help: string }[] = [
  {
    value: "reklamace",
    label: "Reklamace",
    help: "Zboží dorazilo vadné nebo poškozené, nebo se vada objevila později.",
  },
  {
    value: "vraceni",
    label: "Vrácení zboží",
    help: "Chci zboží vrátit a dostat peníze zpět.",
  },
  {
    value: "odstoupeni",
    label: "Odstoupení od smlouvy (zrušení objednávky)",
    help: "Bez udání důvodu, do 14 dnů od převzetí (§1829).",
  },
]

const RESOLUTIONS: {
  value: ClaimRequestedResolution
  help: string
}[] = [
  { value: "repair", help: "Vadu opravíme." },
  { value: "replace", help: "Pošleme nový kus." },
  { value: "refund", help: "Vrátíme vám peníze." },
]

/**
 * Žádost o reklamaci / vrácení / odstoupení k JEDNÉ objednávce — z e-mailu,
 * z potvrzení i z účtu (všude s podepsaným tokenem). Odesílá do
 * `POST /store/orders/:id/claims`; majitelka pak rozhodne v modulu
 * „Reklamace a zrušení".
 *
 * Gating je ZE SERVERU (`GET …/claims`): `can_withdraw` + `withdraw_block_reason`
 * říkají, zda jde odstoupit / vrátit (zakázka §1837, lhůta 14 dnů §1829,
 * otevřená žádost). Tady se jen zamkne volba a ukáže důvod. U reklamace je
 * povinné „co požadujete" (oprava / výměna / vrácení peněz — §19/1 ZOS).
 *
 * Když už k objednávce běží otevřená žádost, místo formuláře se ukáže její
 * stav — server by druhou odmítl a zákazník by jen hádal proč.
 */
export default function RefundRequest({
  orderId,
  token,
  claims,
  initialKind,
  currencyCode = "czk",
}: {
  orderId: string
  token: string
  claims: OrderClaims
  /** Předvolený druh z odkazu (`?kind=`) — „Zrušit objednávku" míří na
      odstoupení, „Reklamace" na reklamaci. Zamčená/neznámá hodnota → reklamace. */
  initialKind?: string
  currencyCode?: string
}) {
  const router = useRouter()
  const { countryCode } = useParams<{ countryCode: string }>()
  const openClaim = findOpenClaim(claims)
  const withdrawBlocked = !claims.can_withdraw
  const blockText = withdrawBlockText(claims)
  const isLocked = (kind: ClaimKind) => kind !== "reklamace" && withdrawBlocked

  const preselected: ClaimKind =
    isClaimKind(initialKind) && !isLocked(initialKind) ? initialKind : "reklamace"
  const [kind, setKind] = useState<ClaimKind>(preselected)
  const [resolution, setResolution] = useState<ClaimRequestedResolution | null>(
    null
  )
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

  const needsResolution = kind === "reklamace"
  const canSend =
    Boolean(detail.trim()) &&
    (!needsResolution || resolution !== null) &&
    state !== "sending"

  const send = async () => {
    if (!canSend) return
    setState("sending")
    setError(null)
    const result = await submitClaim(orderId, token, {
      kind,
      reason: detail.trim(),
      requested_resolution: needsResolution ? resolution ?? undefined : undefined,
      photos: photos.length ? photos.map((p) => p.upload) : undefined,
    })
    if ("error" in result) {
      setState("error")
      setError(result.error)
      return
    }
    setState("sent")
    // Stav žádosti žije na vlastní stránce (časová osa, protokol, pokyny).
    router.push(
      `/${countryCode}/order/${orderId}/claims?token=${encodeURIComponent(token)}`
    )
  }

  // Už běží žádost → její stav místo formuláře (server druhou odmítne).
  if (openClaim) {
    return (
      <div className={styles.root}>
        <p className={styles.openLead}>
          K této objednávce už máme otevřenou žádost. Jakmile se něco pohne,
          ozveme se e-mailem; další žádost půjde podat, až bude tahle uzavřená.
        </p>
        <ClaimStatus
          orderId={orderId}
          token={token}
          claims={claims}
          currencyCode={currencyCode}
          only={[openClaim]}
          showAllLink={claims.requests.length > 1}
        />
      </div>
    )
  }

  if (state === "sent") {
    return (
      <p className={styles.sent} role="status">
        Máme to. Potvrzení posíláme e-mailem — a stav žádosti můžete sledovat{" "}
        <LocalizedClientLink
          href={`/order/${orderId}/claims?token=${encodeURIComponent(token)}`}
        >
          tady
        </LocalizedClientLink>
        .
      </p>
    )
  }

  const deadlineHelp =
    claims.can_withdraw && claims.withdrawal_deadline
      ? ` Lhůta běží do ${formatClaimDate(claims.withdrawal_deadline)}.`
      : ""

  return (
    <div className={styles.root}>
      <fieldset className={styles.kinds}>
        <legend className={styles.legend}>Co chcete řešit?</legend>
        {KINDS.map((k) => {
          const disabled = isLocked(k.value)
          const help = disabled
            ? blockText
            : k.value === "odstoupeni"
              ? `${k.help}${deadlineHelp}`
              : k.help
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
                <span className={styles.kindHelp}>{help}</span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {/* §19/1 ZOS: protokol musí nést požadovaný způsob vyřízení. */}
      {needsResolution && (
        <fieldset className={styles.resolutions}>
          <legend className={styles.legend}>
            Co požadujete? <i>(povinné)</i>
          </legend>
          <div className={styles.resolutionGrid}>
            {RESOLUTIONS.map((r) => (
              <label key={r.value} className={styles.resolution}>
                <input
                  type="radio"
                  name="requested-resolution"
                  value={r.value}
                  checked={resolution === r.value}
                  onChange={() => setResolution(r.value)}
                />
                <span className={styles.kindText}>
                  <span className={styles.kindLabel}>
                    {REQUESTED_RESOLUTION_LABEL[r.value]}
                  </span>
                  <span className={styles.kindHelp}>{r.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label htmlFor={fieldId} className={styles.label}>
        {kind === "reklamace"
          ? "Popište vadu"
          : kind === "vraceni"
            ? "Co vracíte"
            : "Napište nám pár slov"}{" "}
        <i>(povinné)</i>
      </label>
      <textarea
        id={fieldId}
        className={styles.input}
        rows={4}
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        placeholder={
          kind === "reklamace"
            ? "Co je špatně a kdy jste si toho všimli — pár slov stačí."
            : kind === "vraceni"
              ? "Které kusy vracíte a proč — pár slov stačí."
              : "Důvod udávat nemusíte; napište aspoň, že odstupujete od celé objednávky, nebo kterých kusů se to týká."
        }
        required
      />

      {/* Fotky vady — ať zákazník ukáže, co je špatně (u reklamace nejcennější). */}
      <div className={styles.photos}>
        <span className={styles.photosLabel}>
          Fotky <em>nepovinné</em> —{" "}
          {kind === "reklamace" ? "ukažte, co je špatně" : "stav zboží"}
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
          disabled={!canSend}
        >
          {state === "sending" ? "Odesíláme…" : "Odeslat žádost"}
        </button>
      </div>

      <p className={styles.legal}>
        {kind === "reklamace"
          ? "Reklamaci vyřídíme do 30 dnů a o výsledku vás vyrozumíme e-mailem; protokol dostanete hned po odeslání. "
          : "Peníze vracíme do 14 dnů od odstoupení; smíme počkat, než k nám zboží dorazí. "}
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
