"use client"

import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useId, useRef, useState, type ReactNode } from "react"

import { submitClaim } from "@lib/data/claims"
import {
  CARRIER_DAMAGE_CUSTOMER_TEXT,
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
import WithdrawalEntry from "@modules/order/components/withdrawal/entry"
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
    help: "Chci zboží vrátit a dostat peníze zpět — stačí vybrat, které kusy.",
  },
  {
    value: "odstoupeni",
    label: "Odstoupení od smlouvy (zrušení objednávky)",
    help: "Bez udání důvodu, do 14 dnů od převzetí (§ 1829). Pokračujete na formulář s kontrolou před odesláním.",
  },
]

/**
 * Co zákazník u reklamace požaduje. 12. 10. 2026, Matěj: jen výměna nebo
 * vrácení peněz — „Oprava" (`repair`) z formuláře zmizela a server ji
 * u nové žádosti odmítne (`NEW_CLAIM_RESOLUTIONS`); staré žádosti s opravou
 * dál ukazuje stav žádosti i admin.
 */
const RESOLUTIONS: {
  value: ClaimRequestedResolution
  help: string
}[] = [
  { value: "replace", help: "Pošleme nový kus." },
  { value: "refund", help: "Vrátíme vám peníze." },
]

/**
 * „Co se stalo" u reklamace (§13.7). `"defect"` = vada → `damage_cause` se
 * neposílá; `"damaged"` (poškozený kus) a `"carrier"` (balík dorazil
 * poškozený) jdou na server a vyžadují aspoň jednu fotku. Mapování na
 * `damage_cause` zůstává beze změny (12. 10. 2026 se měnily jen popisky).
 */
type CauseChoice = "defect" | ClaimDamageCause

const CAUSES: {
  value: CauseChoice
  label: string
  help: ReactNode
  /** Fotky povinné (server bez nich vrátí 400). */
  photos: boolean
}[] = [
  {
    value: "defect",
    // 12. 10. 2026, Matěj: místo „Vada nebo nefunkčnost" jen „Vada".
    label: "Vada",
    help: "Praskliny, protéká, odprýsknutá glazura…",
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
    label: "Balík dorazil poškozený",
    // 14. 10. 2026 (právní audit §4.1): poškození hlásíte nám, s dopravcem to
    // řešíme my — žádná lhůta pošty, fotky a obal jen prosba.
    help: "Zásilka přišla rozbitá nebo s poškozeným obalem. S dopravcem to vyřešíme sami — fotky obalu i zboží nám pomohou, pokud je máte.",
    photos: false,
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
 * povinné „co požadujete" (výměna / vrácení peněz — §19/1 ZOS; oprava se od
 * 12. 10. 2026 nenabízí).
 *
 * Co se vyplňuje podle druhu (12. 10. 2026, Matěj):
 * - odstoupení (zrušení objednávky) — od 14. 10. 2026 vlastní dvoustupňová
 *   stránka `/order/:id/odstoupeni` (§ 1830a OZ: předvyplněný formulář →
 *   kontrola → „Potvrdit odstoupení od smlouvy" → potvrzení s datem a
 *   časem). Tady jen vysvětlení a tlačítko „Odstoupit od smlouvy";
 * - vrácení zboží — jen VÝBĚR kusů (povinný), bez popisu a bez fotek;
 *   zakázka na míru je zamčená (§ 1837 písm. d);
 * - reklamace — kusy, co se stalo, co požaduje, popis vady a fotky.
 * Server pak u vrácení uloží výchozí důvod podle druhu.
 *
 * Položky (§11.1): server posílá `order_items`, zákazník zaškrtne, kterých kusů
 * se to týká, a kolik. U reklamace i vrácení povinně aspoň jedna, u
 * odstoupení se nevybírá (celá objednávka). Když server `order_items` ještě
 * neposílá, výběr se nevykreslí.
 *
 * Balíček (§13.5): položka s `components` se po zaškrtnutí rozbalí a zákazník
 * může označit jen postižené komponenty (počet ≤ kusů na balíček × objednané
 * balíčky). Posílá se `items[].components` jen když něco zaškrtl; jinak jde
 * celý balíček jako dřív.
 *
 * Co se stalo (§11.3, §13.7): u reklamace povinná volba — vada
 * (`damage_cause` se neposílá), poškozený kus (`"damaged"`, fotky povinné)
 * nebo balík dorazil poškozený (`"carrier"`, fotky vítány). U přepravy se
 * ukáže věta, že škodu s dopravcem řešíme my a zákazník nic dalšího podávat
 * nemusí (14. 10. 2026, právní audit §4.1 — za vadu při převzetí odpovídá
 * prodávající; lhůta České pošty je její věc). Dokument `claimForm` se
 * nabídne jen jako nepovinný.
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
  withdrawalElsewhere = false,
}: {
  orderId: string
  token: string
  claims: OrderClaims
  /** Předvolený druh z odkazu (`?kind=`) — „Reklamace" míří na reklamaci;
      `odstoupeni` stránka přesměruje na `/order/:id/odstoupeni` dřív, než se
      formulář vykreslí. Zamčená/neznámá hodnota → reklamace. */
  initialKind?: string
  currencyCode?: string
  /** Dokument „Formulář k reklamaci" (modul Dokumenty); když je, nabídne se
      u poškození přepravou jako NEPOVINNÁ příloha. */
  claimForm?: { title: string; url: string } | null
  /** Tlačítko „Odstoupit od smlouvy" už stránka ukazuje samostatně (účet) —
      volbu odstoupení tu pak nenabízet podruhé. */
  withdrawalElsewhere?: boolean
}) {
  const router = useRouter()
  const { countryCode } = useParams<{ countryCode: string }>()
  const openClaim = findOpenClaim(claims)
  const withdrawBlocked = !claims.can_withdraw
  const blockText = withdrawBlockText(claims)
  const isLocked = (kind: ClaimKind) => kind !== "reklamace" && withdrawBlocked
  const kinds = withdrawalElsewhere
    ? KINDS.filter((entry) => entry.value !== "odstoupeni")
    : KINDS

  const preselected: ClaimKind =
    isClaimKind(initialKind) &&
    !isLocked(initialKind) &&
    kinds.some((entry) => entry.value === initialKind)
      ? initialKind
      : "reklamace"
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
  /** Účet pro vrácení převodem — jen u objednávek neplacených kartou. */
  const [account, setAccount] = useState("")
  const fieldId = useId()
  const accountId = useId()
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
  // Výběr položek: u odstoupení se neukazuje (má vlastní stránku s výběrem),
  // u reklamace i vrácení je povinný (12. 10. 2026, Matěj: u vrácení je to
  // jediné, co zákazník vyplňuje — server bez něj žádost odmítne).
  const showItems = hasOrderItems && kind !== "odstoupeni"
  const needsItems = (kind === "reklamace" || kind === "vraceni") && hasOrderItems
  // Popis vady a fotky jen u reklamace — odstoupení ani vrácení je nemají.
  const needsDetail = kind === "reklamace"
  // Zakázku na míru vrátit nejde (§ 1837 písm. d) — u vrácení zamčená,
  // reklamovat ji jde. Server ji u vrácení odmítne taky.
  const lockedForReturn = (item: ClaimOrderItem) =>
    kind === "vraceni" && Boolean(item.is_made_to_order)
  const selectedItems: ClaimItemInput[] = orderItems
    .filter((item) => item.id in selected && !lockedForReturn(item))
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

  // Neplaceno kartou → peníze vracíme převodem. Účet je povinný, když se
  // peníze vrací (odstoupení, vrácení, reklamace s „vrácením peněz"); u
  // výměny nepovinný. Formát (kontrolní součet) hlídá server.
  const accountNeeded = Boolean(claims.refund_account_needed)
  const accountRequired =
    accountNeeded && (kind !== "reklamace" || resolution === "refund")
  const accountMissing = accountRequired && !account.trim()

  const canSend =
    kind !== "odstoupeni" &&
    (!needsDetail || Boolean(detail.trim())) &&
    (!needsResolution || resolution !== null) &&
    (!needsCause || cause !== null) &&
    (!needsItems || selectedItems.length > 0) &&
    !photosMissing &&
    !accountMissing &&
    state !== "sending"

  const send = async () => {
    if (!canSend) return
    setState("sending")
    setError(null)
    const result = await submitClaim(orderId, token, {
      kind,
      // Popis a fotky jen u reklamace — i kdyby zůstaly z dřívějšího
      // přepnutí druhu, k odstoupení / vrácení se neposílají.
      reason: needsDetail ? detail.trim() : undefined,
      requested_resolution: needsResolution ? resolution ?? undefined : undefined,
      photos: needsDetail && photos.length ? photos.map((p) => p.upload) : undefined,
      // Odstoupení = celá objednávka, výběr se neposílá (server ho ignoruje).
      items: showItems && selectedItems.length ? selectedItems : undefined,
      // Vada = bez příčiny; poškození jde na server (§13.7).
      damage_cause: damageCause,
      ...(accountNeeded ? { refund_account: account } : {}),
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
        {kinds.map((k) => {
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

      {/* Odstoupení má vlastní dvoustupňovou stránku (§ 1830a OZ):
          předvyplněný formulář → kontrola → „Potvrdit odstoupení od smlouvy".
          Tady jen vstup — žádné odeslání jedním kliknutím. */}
      {kind === "odstoupeni" && (
        <WithdrawalEntry
          orderId={orderId}
          token={token}
          claims={claims}
          variant="compact"
        />
      )}

      {/* §11.1: kterých kusů se to týká. Bez `order_items` ze serveru se
          nevykreslí. */}
      {showItems && (
        <fieldset className={styles.items}>
          <legend className={styles.legend}>
            {kind === "vraceni" ? "Které produkty vracíte?" : "Které produkty?"}{" "}
            <i>{needsItems ? "(povinné)" : "(nepovinné)"}</i>
          </legend>
          {kind === "vraceni" && (
            <p className={styles.itemsHelp}>
              Zaškrtněte kusy, které nám pošlete zpět — peníze za ně vrátíme.
            </p>
          )}
          <ul className={styles.itemList}>
            {orderItems.map((item) => {
              const locked = lockedForReturn(item)
              const checked = item.id in selected && !locked
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
                      disabled={state === "sending" || locked}
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
                      {locked && (
                        <span className={styles.hint}>
                          Vyrobeno na zakázku podle vašeho zadání — vrátit nejde
                          (§ 1837 písm. d) občanského zákoníku). Má-li vadu,
                          zvolte reklamaci.
                        </span>
                      )}
                    </span>
                  </label>
                  {/* Počet kusů jen tam, kde je z čeho vybírat — u jediného
                      kusu by stepper jen zabíral místo. */}
                  {item.quantity > 1 && !locked && (
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
              {kind === "vraceni"
                ? "Zaškrtněte aspoň jeden produkt, který vracíte."
                : "Zaškrtněte aspoň jeden produkt, kterého se reklamace týká."}
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

      {/* §13.7: co se stalo — vada (bez příčiny), poškozený kus nebo balík
          dorazil poškozený. U poškozeného kusu jsou fotky povinné; u přepravy
          vítané — s dopravcem to řešíme my (pokyn pod volbami, §11.3). */}
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
                <span className={styles.kindHelp}>{entry.help}</span>
              </span>
            </label>
          ))}
          {cause === null && (
            <p className={styles.hint}>Vyberte, co se stalo.</p>
          )}
        </fieldset>
      )}

      {/* 14. 10. 2026 (právní audit §4.1): poškození přepravou je vada při
          převzetí — odpovídá za ni prodávající (§ 2161 OZ) a s dopravcem si
          ji řeší sama. Zákazník reklamuje tady, bez lhůty České pošty; obal
          a fotky jsou prosba. Dřívější pokyn „do 2 pracovních dnů na poštu,
          jinak reklamaci nepřijme" byl v rozporu se zákonem. */}
      {needsCause && cause === "carrier" && (
        <div className={styles.carrierNotice} role="note">
          <p className={styles.carrierNoticeTitle}>
            S dopravcem to vyřešíme my
          </p>
          <p>{CARRIER_DAMAGE_CUSTOMER_TEXT}</p>
          {claimForm?.url ? (
            <p>
              Pokud chcete, můžete nám poslat i vyplněný{" "}
              <a href={claimForm.url} target="_blank" rel="noreferrer">
                {claimForm.title || "formulář k reklamaci"}
              </a>{" "}
              — není to ale potřeba, stačí tento formulář.
            </p>
          ) : null}
        </div>
      )}

      {/* Popis vady a fotky jen u reklamace (12. 10. 2026, Matěj) —
          odstoupení ani vrácení zboží je nepotřebují. */}
      {needsDetail && (
        <>
          <label htmlFor={fieldId} className={styles.label}>
            Popište vadu <i>(povinné)</i>
          </label>
          <textarea
            id={fieldId}
            className={styles.input}
            rows={4}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="Co je špatně a kdy jste si toho všimli — pár slov stačí."
            required
          />
        </>
      )}

      {/* Fotky vady — ať zákazník ukáže, co je špatně (u reklamace nejcennější;
          u poškození povinné). */}
      {needsDetail && (
        <div className={styles.photos}>
          <span className={styles.photosLabel}>
            Fotky <em>{photosRequired ? "povinné" : "nepovinné"}</em> —{" "}
            {activeCause === "carrier"
              ? "obal i poškozené zboží"
              : activeCause === "damaged"
                ? "poškození zblízka"
                : "ukažte, co je špatně"}
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
      )}

      {accountNeeded && kind !== "odstoupeni" && (
        <div className={styles.account}>
          <label htmlFor={accountId} className={styles.label}>
            Číslo účtu pro vrácení peněz{" "}
            <i>{accountRequired ? "(povinné)" : "(nepovinné)"}</i>
          </label>
          <input
            id={accountId}
            className={styles.input}
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            placeholder="např. 123456789/0800 nebo 19-123456789/0800"
            disabled={state === "sending"}
          />
          <p className={styles.hint}>
            Objednávku jste neplatili online přes ComGate, takže peníze posíláme převodem na
            účet. Stačí české číslo účtu, případně IBAN.
            {kind === "reklamace" && !accountRequired
              ? " U výměny ho vyplňovat nemusíte — hodí se, kdyby se nakonec vracely peníze."
              : ""}
          </p>
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {kind !== "odstoupeni" && (
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
      )}

      <p className={styles.legal}>
        {kind === "reklamace"
          ? "Reklamaci vyřídíme do 30 dnů od jejího uplatnění (odeslání tohoto formuláře) a o výsledku vás vyrozumíme e-mailem; potvrzení s datem a časem uplatnění a protokol dostanete hned po odeslání. U uznané reklamace vracíme cenu reklamovaných výrobků. "
          : "Peníze vracíme do 14 dnů od odstoupení (při vrácení celé objednávky i náklady na dodání ve výši nejlevnějšího nabízeného způsobu); smíme počkat, než k nám zboží dorazí. "}
        Podrobnosti najdete v{" "}
        <LocalizedClientLink href="/reklamacni-rad">
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
