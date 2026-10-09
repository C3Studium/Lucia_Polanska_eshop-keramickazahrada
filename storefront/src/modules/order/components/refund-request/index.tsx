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
  type ClaimOrderItem,
  type ClaimRequestedResolution,
  type OrderClaims,
} from "@lib/util/claims"
import type { CommissionUpload } from "@lib/util/made-to-order"
import { compressImage } from "@lib/util/compress-image"
import { convertToLocale } from "@lib/util/money"
import ClaimStatus from "@modules/order/components/claim-status"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"

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

/** Počet kusů sevřený do 1..objednáno — z tlačítek i z ručně psaného čísla. */
const clampQty = (value: number, max: number) =>
  Math.min(Math.max(1, Math.floor(Number(value) || 1)), Math.max(1, max))

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
 * Položky (§11.1): server posílá `order_items`, zákazník zaškrtne, kterých kusů
 * se to týká, a kolik. U reklamace povinně aspoň jedna, u vrácení volitelně
 * (nic = celá objednávka), u odstoupení se nevybírá (celá objednávka). Když
 * server `order_items` ještě neposílá, výběr se nevykreslí a formulář funguje
 * jako dřív.
 *
 * Poškozeno přepravou (§11.3): přepínač u reklamace. Zapnutý → fotky povinné
 * (server bez nich vrátí 400) a posílá se `damage_cause: "carrier"`, majitelka
 * dostane pokyn podat reklamaci u České pošty; zákazníkova reklamace běží dál.
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
  claimForm = null,
}: {
  orderId: string
  token: string
  claims: OrderClaims
  /** Předvolený druh z odkazu (`?kind=`) — „Zrušit objednávku" míří na
      odstoupení, „Reklamace" na reklamaci. Zamčená/neznámá hodnota → reklamace. */
  initialKind?: string
  currencyCode?: string
  /** Dokument „co dělat s poškozenou zásilkou" (týž jako u „Než zásilku
      převezmete"); když je, nápověda u přepínače na něj odkáže. */
  claimForm?: { title: string; url: string } | null
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
  /** id položky → počet kusů; nezaškrtnuté položky v mapě nejsou. */
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [carrierDamage, setCarrierDamage] = useState(false)
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  )
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()
  const fileInput = useRef<HTMLInputElement>(null)

  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: currencyCode })

  // Jen položky, které dávají smysl vybrat (kladný počet); poplatky a nuly ne.
  const orderItems: ClaimOrderItem[] = (claims.order_items ?? []).filter(
    (item) => item && item.id && Number(item.quantity) > 0
  )
  const hasOrderItems = orderItems.length > 0

  const toggleItem = (item: ClaimOrderItem) =>
    setSelected((current) => {
      if (item.id in current) {
        const { [item.id]: _removed, ...rest } = current
        return rest
      }
      return { ...current, [item.id]: 1 }
    })

  const setQty = (item: ClaimOrderItem, value: number) =>
    setSelected((current) =>
      item.id in current
        ? { ...current, [item.id]: clampQty(value, item.quantity) }
        : current
    )

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
  // Výběr položek: u odstoupení se neukazuje (jde o celou objednávku),
  // u reklamace je povinný, u vrácení volitelný.
  const showItems = hasOrderItems && kind !== "odstoupeni"
  const needsItems = kind === "reklamace" && hasOrderItems
  const selectedItems = orderItems
    .filter((item) => item.id in selected)
    .map((item) => ({ id: item.id, quantity: selected[item.id] }))
  // Přepínač žije jen u reklamace; u jiného druhu se neposílá, i když zůstal
  // zaškrtnutý z dřívějška.
  const carrierOn = kind === "reklamace" && carrierDamage
  const photosRequired = carrierOn
  const photosMissing = photosRequired && photos.length === 0

  const canSend =
    Boolean(detail.trim()) &&
    (!needsResolution || resolution !== null) &&
    (!needsItems || selectedItems.length > 0) &&
    !photosMissing &&
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
      // Odstoupení = celá objednávka, výběr se neposílá (server ho ignoruje).
      items: showItems && selectedItems.length ? selectedItems : undefined,
      damage_cause: carrierOn ? "carrier" : undefined,
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

      {/* §11.1: kterých kusů se to týká. Bez `order_items` ze serveru se
          nevykreslí a žádost jde jako dřív (jen text). */}
      {showItems && (
        <fieldset className={styles.items}>
          <legend className={styles.legend}>
            Které produkty? <i>{needsItems ? "(povinné)" : "(nepovinné)"}</i>
          </legend>
          {!needsItems && (
            <p className={styles.itemsHelp}>
              Nic nevybráno = vracíte celou objednávku.
            </p>
          )}
          <ul className={styles.itemList}>
            {orderItems.map((item) => {
              const checked = item.id in selected
              const qty = checked ? selected[item.id] : 1
              const inputId = `${fieldId}-qty-${item.id}`
              return (
                <li
                  key={item.id}
                  className={styles.item}
                  data-checked={checked || undefined}
                >
                  <label className={styles.itemMain}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={state === "sending"}
                      onChange={() => toggleItem(item)}
                    />
                    <span className={styles.itemThumb}>
                      <Thumbnail thumbnail={item.thumbnail} size="square" />
                    </span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      <span className={styles.itemMeta}>
                        {item.variant_title ? `${item.variant_title} · ` : ""}
                        objednáno {item.quantity} ks · {money(item.unit_price)}
                        {item.quantity > 1 ? "/ks" : ""}
                      </span>
                    </span>
                  </label>
                  {/* Počet kusů jen tam, kde je z čeho vybírat — u jediného
                      kusu by stepper jen zabíral místo. */}
                  {item.quantity > 1 && (
                    <div
                      className={styles.stepper}
                      role="group"
                      aria-label={`Počet kusů — ${item.title}`}
                    >
                      <button
                        type="button"
                        onClick={() => setQty(item, qty - 1)}
                        disabled={!checked || qty <= 1 || state === "sending"}
                        aria-label="Méně kusů"
                      >
                        −
                      </button>
                      <input
                        id={inputId}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={item.quantity}
                        value={qty}
                        disabled={!checked || state === "sending"}
                        onChange={(event) =>
                          setQty(item, Number(event.target.value))
                        }
                        aria-label="Počet kusů"
                      />
                      <button
                        type="button"
                        onClick={() => setQty(item, qty + 1)}
                        disabled={
                          !checked || qty >= item.quantity || state === "sending"
                        }
                        aria-label="Více kusů"
                      >
                        +
                      </button>
                      <span className={styles.stepperOf}>z {item.quantity}</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {needsItems && selectedItems.length === 0 && (
            <p className={styles.hint}>
              Zaškrtněte aspoň jeden produkt, kterého se reklamace týká.
            </p>
          )}
        </fieldset>
      )}

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

      {/* §11.3: poškozeno přepravou — reklamaci u ČP podává majitelka,
          zákazníkova reklamace běží dál; fotky jsou pak povinné. */}
      {kind === "reklamace" && (
        <label
          className={`${styles.carrier} ${carrierDamage ? styles.carrierOn : ""}`}
        >
          <input
            type="checkbox"
            checked={carrierDamage}
            disabled={state === "sending"}
            onChange={(event) => setCarrierDamage(event.target.checked)}
          />
          <span className={styles.kindText}>
            <span className={styles.kindLabel}>
              Balík dorazil poškozený (přepravou)
            </span>
            <span className={styles.kindHelp}>
              Reklamaci u České pošty podáme my — vaše reklamace u nás běží dál
              jako obvykle. Potřebujeme k tomu aspoň jednu fotku obalu a
              poškozeného zboží.
              {claimForm?.url ? (
                <>
                  {" "}
                  Co dělat s poškozenou zásilkou:{" "}
                  <a href={claimForm.url} target="_blank" rel="noreferrer">
                    {claimForm.title || "postup a formulář"}
                  </a>
                  .
                </>
              ) : null}
            </span>
          </span>
        </label>
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
              ? hasOrderItems
                ? "Proč vracíte — pár slov stačí."
                : "Které kusy vracíte a proč — pár slov stačí."
              : "Důvod udávat nemusíte; napište aspoň, že odstupujete od celé objednávky, nebo kterých kusů se to týká."
        }
        required
      />

      {/* Fotky vady — ať zákazník ukáže, co je špatně (u reklamace nejcennější;
          u poškození přepravou povinné). */}
      <div className={styles.photos}>
        <span className={styles.photosLabel}>
          Fotky <em>{photosRequired ? "povinné" : "nepovinné"}</em> —{" "}
          {photosRequired
            ? "obal i poškozené zboží"
            : kind === "reklamace"
              ? "ukažte, co je špatně"
              : "stav zboží"}
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
        {photosMissing && (
          <p className={styles.hint} aria-live="polite">
            U poškození přepravou potřebujeme aspoň jednu fotku obalu a zboží —
            bez ní žádost nejde odeslat.
          </p>
        )}
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
