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
  type ClaimDamageCause,
  type ClaimItemInput,
  type ClaimKind,
  type ClaimOrderItem,
  type ClaimOrderItemComponent,
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

/**
 * „Co se stalo" u reklamace (§13.7). `"defect"` = vada / nefunkčnost →
 * `damage_cause` se neposílá; `"damaged"` a `"carrier"` jdou na server a
 * vyžadují aspoň jednu fotku.
 */
type CauseChoice = "defect" | ClaimDamageCause

const CAUSES: {
  value: CauseChoice
  label: string
  help: string
  /** Fotky povinné (server bez nich vrátí 400). */
  photos: boolean
}[] = [
  {
    value: "defect",
    label: "Vada nebo nefunkčnost",
    help: "Zboží nefunguje, jak má, nebo se vada objevila při používání.",
    photos: false,
  },
  {
    value: "damaged",
    label: "Poškozený kus",
    help: "Viditelné poškození — prasklina, odštípnutí, chybějící část. Potřebujeme aspoň jednu fotku poškození.",
    photos: true,
  },
  {
    value: "carrier",
    label: "Balík dorazil poškozený — přepravou",
    help: "Reklamaci u České pošty podáme my — vaše reklamace u nás běží dál jako obvykle. Potřebujeme k tomu aspoň jednu fotku obalu a poškozeného zboží.",
    photos: true,
  },
]

/** Počet kusů sevřený do 1..objednáno — z tlačítek i z ručně psaného čísla. */
const clampQty = (value: number, max: number) =>
  Math.min(Math.max(1, Math.floor(Number(value) || 1)), Math.max(1, max))

/** Komponenty balíčku (§13.5), které dávají smysl vybrat; bez nich = běžná položka. */
const bundleComponents = (item: ClaimOrderItem): ClaimOrderItemComponent[] =>
  (item.components ?? []).filter(
    (component) =>
      component && component.product_id && Number(component.quantity) > 0
  )

/** Kolik kusů komponenty objednávka nese celkem: na jeden balíček × objednané balíčky. */
const componentMax = (item: ClaimOrderItem, component: ClaimOrderItemComponent) =>
  Math.max(1, Math.floor(Number(component.quantity) || 1) * Math.max(1, item.quantity))

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
 * Balíček (§13.5): položka s `components` se po zaškrtnutí rozbalí a zákazník
 * může označit jen postižené komponenty (počet ≤ kusů na balíček × objednané
 * balíčky). Posílá se `items[].components` jen když něco zaškrtl; jinak jde
 * celý balíček jako dřív.
 *
 * Co se stalo (§11.3, §13.7): u reklamace povinná volba — vada/nefunkčnost
 * (`damage_cause` se neposílá), poškozený kus (`"damaged"`) nebo poškozeno
 * přepravou (`"carrier"`). U obou poškození jsou fotky povinné (server bez
 * nich vrátí 400); u přepravy majitelka dostane pokyn podat reklamaci u České
 * pošty, zákazníkova reklamace běží dál.
 *
 * Auto-zrušení (§13.1): odstoupení / vrácení u nezaplacené a neodeslané
 * objednávky server rovnou vyřídí a objednávku zruší (`auto_cancelled`). Pak
 * se místo „posoudíme" řekne „zrušeno" a na stavovou stránku vede jen odkaz.
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
  /** id balíčku → (product_id komponenty → počet kusů); nezaškrtnuté chybí. */
  const [components, setComponents] = useState<
    Record<string, Record<string, number>>
  >({})
  /** „Co se stalo" u reklamace; `null` = ještě nevybráno (povinné). */
  const [cause, setCause] = useState<CauseChoice | null>(null)
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  )
  /** §13.1 — server žádost rovnou vyřídil a objednávku zrušil. */
  const [autoCancelled, setAutoCancelled] = useState(false)
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

  const toggleItem = (item: ClaimOrderItem) => {
    setSelected((current) => {
      if (item.id in current) {
        const { [item.id]: _removed, ...rest } = current
        return rest
      }
      return { ...current, [item.id]: 1 }
    })
    // Odškrtnutý balíček zapomene i výběr komponent — ať se neodešle nic,
    // co zákazník na obrazovce už nevidí.
    setComponents((current) => {
      if (!(item.id in current)) return current
      const { [item.id]: _removed, ...rest } = current
      return rest
    })
  }

  const setQty = (item: ClaimOrderItem, value: number) => {
    setSelected((current) =>
      item.id in current
        ? { ...current, [item.id]: clampQty(value, item.quantity) }
        : current
    )
    // Méně balíčků = nižší strop komponent; sevřít, co by přes něj přetékalo.
    setComponents((current) => {
      const forItem = current[item.id]
      if (!forItem) return current
      const next: Record<string, number> = {}
      for (const component of bundleComponents(item)) {
        if (component.product_id in forItem) {
          next[component.product_id] = clampQty(
            forItem[component.product_id],
            componentMax(item, component)
          )
        }
      }
      return { ...current, [item.id]: next }
    })
  }

  const toggleComponent = (
    item: ClaimOrderItem,
    component: ClaimOrderItemComponent
  ) =>
    setComponents((current) => {
      const forItem = { ...(current[item.id] ?? {}) }
      if (component.product_id in forItem) {
        delete forItem[component.product_id]
      } else {
        forItem[component.product_id] = 1
      }
      return { ...current, [item.id]: forItem }
    })

  const setComponentQty = (
    item: ClaimOrderItem,
    component: ClaimOrderItemComponent,
    value: number
  ) =>
    setComponents((current) => {
      const forItem = current[item.id]
      if (!forItem || !(component.product_id in forItem)) return current
      return {
        ...current,
        [item.id]: {
          ...forItem,
          [component.product_id]: clampQty(value, componentMax(item, component)),
        },
      }
    })

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
  const selectedItems: ClaimItemInput[] = orderItems
    .filter((item) => item.id in selected)
    .map((item) => {
      // Komponenty jen když zákazník nějakou zaškrtl — jinak jde celý balíček
      // a server se chová jako u běžné položky (§13.5).
      const picked = bundleComponents(item)
        .filter((component) => (components[item.id]?.[component.product_id] ?? 0) > 0)
        .map((component) => ({
          product_id: component.product_id,
          quantity: components[item.id][component.product_id],
        }))
      return picked.length
        ? { id: item.id, quantity: selected[item.id], components: picked }
        : { id: item.id, quantity: selected[item.id] }
    })
  // „Co se stalo" žije jen u reklamace; u jiného druhu se neposílá, i když
  // zůstalo vybrané z dřívějška.
  const needsCause = kind === "reklamace"
  const activeCause = needsCause ? cause : null
  const damageCause: ClaimDamageCause | undefined =
    activeCause === "carrier" || activeCause === "damaged" ? activeCause : undefined
  const photosRequired = Boolean(
    CAUSES.find((entry) => entry.value === activeCause)?.photos
  )
  const photosMissing = photosRequired && photos.length === 0

  const canSend =
    Boolean(detail.trim()) &&
    (!needsResolution || resolution !== null) &&
    (!needsCause || cause !== null) &&
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
      // Vada/nefunkčnost = bez příčiny; poškození jde na server (§13.7).
      damage_cause: damageCause,
    })
    if ("error" in result) {
      setState("error")
      setError(result.error)
      return
    }
    setState("sent")
    if (result.auto_cancelled) {
      // §13.1 — hotovo hned: zůstat tady a říct to, stavová stránka je jen odkaz.
      setAutoCancelled(true)
      return
    }
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
    const claimsHref = `/order/${orderId}/claims?token=${encodeURIComponent(token)}`
    // §13.1 — nezaplaceno + neodesláno: server už zrušil, není co posuzovat.
    if (autoCancelled) {
      return (
        <p className={styles.sent} role="status">
          Objednávka je zrušená. Nic jste nezaplatili, nic neposíláte —
          potvrzení máte v e-mailu. Podrobnosti najdete{" "}
          <LocalizedClientLink href={claimsHref}>tady</LocalizedClientLink>.
        </p>
      )
    }
    return (
      <p className={styles.sent} role="status">
        Máme to. Potvrzení posíláme e-mailem — a stav žádosti můžete sledovat{" "}
        <LocalizedClientLink href={claimsHref}>tady</LocalizedClientLink>.
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

                  {/* §13.5: balíček se po zaškrtnutí rozepíše na komponenty —
                      zákazník označí jen ty postižené. Nic zaškrtnuté = celý
                      balíček. */}
                  {checked && bundleComponents(item).length > 0 && (
                    <fieldset className={styles.components}>
                      <legend className={styles.componentsLegend}>
                        Které části balíčku? <i>(nepovinné — nic = celý balíček)</i>
                      </legend>
                      <ul className={styles.componentList}>
                        {bundleComponents(item).map((component) => {
                          const picked = components[item.id]?.[component.product_id]
                          const componentChecked = (picked ?? 0) > 0
                          const max = componentMax(item, component)
                          const componentQty = componentChecked ? picked : 1
                          return (
                            <li
                              key={component.product_id}
                              className={styles.component}
                              data-checked={componentChecked || undefined}
                            >
                              <label className={styles.componentMain}>
                                <input
                                  type="checkbox"
                                  checked={componentChecked}
                                  disabled={state === "sending"}
                                  onChange={() => toggleComponent(item, component)}
                                />
                                <span className={styles.componentThumb}>
                                  <Thumbnail
                                    thumbnail={component.thumbnail}
                                    size="square"
                                  />
                                </span>
                                <span className={styles.itemBody}>
                                  <span className={styles.componentTitle}>
                                    {component.title}
                                  </span>
                                  <span className={styles.itemMeta}>
                                    {component.quantity} ks v každém balíčku
                                    {typeof component.unit_share === "number" &&
                                    component.unit_share > 0
                                      ? ` · ${money(component.unit_share)}/ks`
                                      : ""}
                                  </span>
                                </span>
                              </label>
                              {max > 1 && (
                                <div
                                  className={`${styles.stepper} ${styles.stepperSmall}`}
                                  role="group"
                                  aria-label={`Počet kusů — ${component.title}`}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setComponentQty(item, component, componentQty - 1)
                                    }
                                    disabled={
                                      !componentChecked ||
                                      componentQty <= 1 ||
                                      state === "sending"
                                    }
                                    aria-label="Méně kusů"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={max}
                                    value={componentQty}
                                    disabled={!componentChecked || state === "sending"}
                                    onChange={(event) =>
                                      setComponentQty(
                                        item,
                                        component,
                                        Number(event.target.value)
                                      )
                                    }
                                    aria-label="Počet kusů"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setComponentQty(item, component, componentQty + 1)
                                    }
                                    disabled={
                                      !componentChecked ||
                                      componentQty >= max ||
                                      state === "sending"
                                    }
                                    aria-label="Více kusů"
                                  >
                                    +
                                  </button>
                                  <span className={styles.stepperOf}>z {max}</span>
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </fieldset>
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

      {/* §13.7: co se stalo — vada (bez příčiny), poškozený kus nebo poškozeno
          přepravou. U poškození jsou fotky povinné; u přepravy reklamaci u ČP
          podává majitelka, zákazníkova reklamace běží dál (§11.3). */}
      {needsCause && (
        <fieldset className={styles.causes}>
          <legend className={styles.legend}>
            Co se stalo? <i>(povinné)</i>
          </legend>
          {CAUSES.map((entry) => (
            <label
              key={entry.value}
              className={styles.cause}
              data-tone={entry.photos ? "warn" : undefined}
            >
              <input
                type="radio"
                name="damage-cause"
                value={entry.value}
                checked={cause === entry.value}
                disabled={state === "sending"}
                onChange={() => setCause(entry.value)}
              />
              <span className={styles.kindText}>
                <span className={styles.kindLabel}>{entry.label}</span>
                <span className={styles.kindHelp}>
                  {entry.help}
                  {entry.value === "carrier" && claimForm?.url ? (
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
          ))}
          {cause === null && (
            <p className={styles.hint}>Vyberte, co se stalo.</p>
          )}
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
          {activeCause === "carrier"
            ? "obal i poškozené zboží"
            : activeCause === "damaged"
              ? "poškození zblízka"
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
            {activeCause === "carrier"
              ? "U poškození přepravou potřebujeme aspoň jednu fotku obalu a zboží — bez ní žádost nejde odeslat."
              : "U poškozeného kusu potřebujeme aspoň jednu fotku poškození — bez ní žádost nejde odeslat."}
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
