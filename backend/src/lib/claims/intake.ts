import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  customerName,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../customer-email"
import { getMerchantSettings } from "../merchant-settings"
import { notifyMerchant } from "../notify"
import { orderClaimsUrl } from "../order-access-link"
import { parcelCodeOf } from "../parcel-tracking/start"
import {
  buildAndStoreProtocol,
  nextProtocolSequence,
  protocolNumberFor,
} from "../reklamacni-protokol"
import { RETURN_REQUEST_MODULE } from "../../modules/return-request"
import type ReturnRequestModuleService from "../../modules/return-request/service"
import { shouldAutoCancel } from "./auto-cancel"
import { autoCancelClaim } from "./auto-cancel-action"
import {
  blocksNewClaim,
  blocksWithdrawal,
  CLAIM_CHANNEL_LABEL,
  CLAIM_CHANNEL_ONLINE,
  claimReasonFor,
  CP_CLAIM_FORM_URL,
  CP_CLAIM_INFO_URL,
  CP_DAMAGE_REPORT_DEADLINE_TEXT,
  damageCauseLabel,
  damageCauseSentence,
  deadlineTextFor,
  isClaimKind,
  isDamageCause,
  isNewClaimResolution,
  kindLabel,
  photosRequiredFor,
  resolutionLabel,
  resolveByFor,
  type ClaimChannel,
  type ClaimKind,
  type DamageCause,
  type RequestedResolution,
} from "./constants"
import {
  allMadeToOrder,
  isOrderCancelled,
  refundMethodKindOf,
  WITHDRAW_BLOCK_CANCELLED,
  WITHDRAW_BLOCK_MADE_TO_ORDER,
  WITHDRAW_BLOCK_OPEN_REQUEST,
  WITHDRAW_BLOCK_OPEN_WITHDRAWAL,
  withdrawBlockDeadline,
  type ClaimOrder,
} from "./context"
import {
  lineItemsText,
  photosRequiredMessage,
  resolveClaimLineItems,
  type ClaimItemSelection,
  type ClaimLineItem,
} from "./line-items"
import { isMadeToOrderItem } from "./made-to-order"
import { goodsShipped } from "./money"
import { loadClaimProduction } from "./production"
import { capturedTotal, MONEY_EPSILON } from "./refund-rules"
import {
  parseRefundAccount,
  REFUND_ACCOUNT_REQUIRED,
  refundAccountNeeded,
  refundAccountRequiredFor,
  storedRefundAccount,
} from "./refund-account"
import {
  formatPragueDate,
  formatPragueDateTime,
  refundMethodTextFor,
  resolveWithdrawalItems,
  takeoverTextFor,
  withdrawalReturnAddress,
  withdrawalTimingFor,
  type WithdrawalItemsVerdict,
} from "./withdrawal"

/**
 * Sdílený intake žádosti (docs/reklamace-a-zruseni.md §4) — JEDNA cesta pro
 * tokenovou routu `POST /store/orders/:id/claims` i záložní
 * `POST /store/return-requests` (číslo + e-mail). Dřív to bylo celé v jedné
 * routě; dvě kopie intake by se rozešly u první změny lhůty nebo e-mailu.
 *
 * Co tu je: fotky vady do úložiště, lhůta `resolve_by`, snapshot
 * `withdrawal_deadline`, protokol (PDF), potvrzovací e-mail zákazníkovi a
 * zvonek majitelce. Co tu NENÍ: ověření vlastnictví — to dělá volající
 * (token, nebo číslo + e-mail), protože se liší, a teprve pak smí volat sem.
 *
 * Od 14. 10. 2026 (odstoupení online, § 1830a OZ; reklamace § 19 odst. 1 ZOS):
 * - okamžik odeslání `submitted_at` = čas serveru při přijetí (ne hodiny
 *   prohlížeče) a kanál `channel`; obojí jde do potvrzení (datum a čas);
 * - odstoupení může být ČÁSTEČNÉ (vybrané zboží) a zakázkové položky se
 *   z něj vyjímají na serveru (`resolveWithdrawalItems`);
 * - lhůta pro odstoupení běží od převzetí (`withdrawal.ts`), snapshot
 *   převzetí `takeover_at` se ukládá k žádosti;
 * - u reklamace se 30denní lhůta `resolve_by` počítá od uplatnění (odeslání
 *   žádosti), ne od doručení zboží (§ 19 odst. 3 ZOS).
 */

// Fotky vady / zboží — stejný kontrakt jako `store/made-to-order/media`:
// base64 (s `data:` prefixem i bez), limit počtu a velikosti, jen obrázky.
export const MAX_PHOTOS = 6
const MAX_PHOTO_BYTES = 6 * 1024 * 1024
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
])

export type IntakePhoto = { filename: string; mime_type: string; data: string }

const decodePhoto = (data: string): Buffer => {
  const comma = data.indexOf(",")
  const payload =
    data.startsWith("data:") && comma > -1 ? data.slice(comma + 1) : data
  return Buffer.from(payload, "base64")
}

const safePhotoName = (filename: string): string => {
  const cleaned = filename
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-120)
  return cleaned || "reklamace-foto"
}

/**
 * Nahraje fotky vady do úložiště a vrátí jejich URL. Volá se AŽ po ověření
 * vlastnictví, takže anonym nemá jak něco nahrát. Chybná fotka (špatný
 * formát / prázdná / moc velká) se přeskočí — žádost kvůli jedné fotce nepadá.
 */
export const uploadReturnPhotos = async (
  container: MedusaContainer,
  photos: IntakePhoto[]
): Promise<string[]> => {
  const prepared = photos
    .slice(0, MAX_PHOTOS)
    .map((photo) => {
      if (!ALLOWED_MIME.has(photo.mime_type.toLowerCase())) return null
      const buffer = decodePhoto(photo.data)
      if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) return null
      return {
        filename: safePhotoName(photo.filename),
        mimeType: photo.mime_type,
        content: buffer.toString("base64"),
        access: "public" as const,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  if (!prepared.length) return []

  try {
    const fileModule = container.resolve(Modules.FILE)
    const uploaded = await fileModule.createFiles(prepared)
    return (Array.isArray(uploaded) ? uploaded : [uploaded])
      .map((file: any) => file?.url)
      .filter((url: unknown): url is string => typeof url === "string")
  } catch {
    // Úložiště je doplněk — bez fotek žádost platí dál (zákazník je dopošle).
    return []
  }
}

/** The real person's name, or null — never a stored „Vážený zákazníku". */
export const realCustomerName = (order: any): string | null => {
  const name = customerName(order)
  return name === "Vážený zákazníku" ? null : name
}

export type ClaimIntakeInput = {
  kind: ClaimKind | null
  /**
   * Popis od zákazníka. Povinný jen u reklamace (12. 10. 2026, Matěj:
   * odstoupení a vrácení jsou bez textu) — prázdný se uloží jako výchozí věta
   * podle druhu (`claimReasonFor`). U odstoupení online je to nepovinný důvod.
   */
  reason?: string | null
  requested_resolution?: RequestedResolution | string | null
  /** Free text — which pieces are coming back (jen záložní routa). */
  items?: string | null
  /**
   * Vybrané položky `{ id, quantity }` (§11.1) — tokenová routa posílá vždy
   * pole (i prázdné); null/undefined = volající bez výběru položek. U
   * odstoupení prázdný výběr = veškeré zboží, od kterého odstoupit lze.
   */
  line_items?: ClaimItemSelection[] | null
  /**
   * `"carrier"` = zásilka dorazila poškozená (§11.3), `"damaged"` = poškozený
   * kus (§13.7) — u poškozeného kusu jsou fotky povinné.
   */
  damage_cause?: DamageCause | string | null
  photos?: IntakePhoto[] | null
  /**
   * Účet pro vrácení převodem (`refund-account.ts`). `undefined` = volající
   * pole nemá (záložní routa, starší storefront) → nehlídá se; řetězec / null
   * = formulář ho má → u nekartové objednávky povinný podle druhu žádosti.
   */
  refund_account?: string | null
  /**
   * Jméno z formuláře odstoupení (předvyplněné z objednávky, zákazník ho může
   * opravit). Prázdné = jméno z objednávky.
   */
  customer_name?: string | null
}

export type ClaimRuleVerdict =
  | { ok: true }
  | { ok: false; message: string }

export const CLAIM_REASON_REQUIRED =
  "U reklamace prosím popište vadu — co je špatně a kdy jste si toho všimli."
export const CLAIM_RESOLUTION_REQUIRED =
  "U reklamace prosím uveďte, co požadujete — výměnu, nebo vrácení peněz (§ 19 zákona o ochraně spotřebitele)."

/**
 * Serverová pravidla §4 + §11.1 — čistá funkce (testovatelná bez kontejneru):
 * - §1837: čistá zakázka → `odstoupeni`/`vraceni` nejde; u smíšené objednávky
 *   se zakázkové položky z odstoupení vyjmou, vrátit je nejde;
 * - zrušená objednávka → `odstoupeni`/`vraceni` nejde;
 * - 14 dnů od PŘEVZETÍ pro `odstoupeni`/`vraceni` (neodesláno / na cestě =
 *   lhůta neběží; převzetí neznámé = odeslání + 7 dnů, `withdrawal.ts`);
 * - u `reklamace` je popis vady povinný; u odstoupení / vrácení ne
 *   (12. 10. 2026, Matěj — uloží se výchozí věta, `claimReasonFor`);
 * - u `reklamace` je `requested_resolution` povinné (§19/1 ZOS) a smí být jen
 *   výměna nebo vrácení peněz — opravu nová žádost nenabízí (12. 10. 2026,
 *   Matěj; `NEW_CLAIM_RESOLUTIONS`), staré žádosti s `repair` čte vše dál;
 * - položky: u reklamace i vrácení aspoň jedna (když volající výběr má), id
 *   patří objednávce, množství ≤ objednané (`resolveClaimLineItems`); u
 *   odstoupení aspoň jedna položka, od které odstoupit lze;
 * - poškozený kus → aspoň jedna fotka (§13.7);
 * - fronta: reklamaci a vrácení blokuje KTERÁKOLI otevřená žádost (jedna na
 *   objednávku); odstoupení jen otevřené odstoupení / vrácení
 *   (`blocksWithdrawal` — tlačítko § 1830a nesmí zastavit běžící reklamace).
 */
export const checkClaimRules = (
  order: ClaimOrder,
  existingRequests: Array<{ status?: string | null; kind?: string | null }>,
  input: ClaimIntakeInput,
  now: Date = new Date()
): ClaimRuleVerdict => {
  if (input.kind === "odstoupeni" || input.kind === "vraceni") {
    if (allMadeToOrder(order)) {
      return { ok: false, message: WITHDRAW_BLOCK_MADE_TO_ORDER }
    }
    if (isOrderCancelled(order)) {
      return { ok: false, message: WITHDRAW_BLOCK_CANCELLED }
    }
    const deadline = withdrawalTimingFor(order).deadline
    if (deadline && now.getTime() > deadline.getTime()) {
      return { ok: false, message: withdrawBlockDeadline(deadline) }
    }
  }
  if (input.kind === "reklamace") {
    if (!(input.reason ?? "").trim()) {
      return { ok: false, message: CLAIM_REASON_REQUIRED }
    }
    if (!isNewClaimResolution(input.requested_resolution)) {
      return { ok: false, message: CLAIM_RESOLUTION_REQUIRED }
    }
  }
  if (input.kind === "odstoupeni") {
    const withdrawal = resolveWithdrawalItems(order as any, input.line_items)
    if (withdrawal.ok === false) {
      return withdrawal
    }
  } else {
    const items = resolveClaimLineItems(order, input.kind, input.line_items)
    if (items.ok === false) {
      return items
    }
  }
  if (input.refund_account !== undefined) {
    const account = parseRefundAccount(input.refund_account)
    if (account && account.ok === false) {
      return { ok: false, message: account.message }
    }
    if (
      !account &&
      refundAccountNeeded(order as any) &&
      refundAccountRequiredFor(input.kind, input.requested_resolution)
    ) {
      return { ok: false, message: REFUND_ACCOUNT_REQUIRED }
    }
  }
  if (photosRequiredFor(input.damage_cause) && !(input.photos?.length ?? 0)) {
    return { ok: false, message: photosRequiredMessage(input.damage_cause) }
  }
  if (input.kind === "odstoupeni") {
    if (existingRequests.some((request) => blocksWithdrawal(request))) {
      return { ok: false, message: WITHDRAW_BLOCK_OPEN_WITHDRAWAL }
    }
  } else if (existingRequests.some((request) => blocksNewClaim(request))) {
    return { ok: false, message: WITHDRAW_BLOCK_OPEN_REQUEST }
  }
  return { ok: true }
}

/**
 * Co zákazník vidí na obrazovce hned po odeslání (a co přesně stojí
 * v potvrzovacím e-mailu) — obsah prohlášení, datum a čas odeslání.
 */
export type ClaimConfirmation = {
  id: string
  kind: ClaimKind | null
  submitted_at: string
  /** „15. 10. 2026 v 14:32" (Europe/Prague). */
  submitted_at_text: string
  channel: ClaimChannel
  channel_text: string
  order_display_id: string
  order_date_text: string
  customer_name: string | null
  email: string | null
  takeover_text: string | null
  /** Zboží, kterého se žádost týká (u odstoupení: od jehož koupě se odstupuje). */
  items: ClaimLineItem[]
  /** Odstoupení: zakázkové položky vyjmuté z odstoupení (§ 1837 písm. d). */
  excluded_items: ClaimLineItem[]
  /** Odstoupení od celé smlouvy. */
  whole_order: boolean
  /** Důvod, jen když ho zákazník napsal. */
  reason: string | null
  refund_method_text: string | null
  return_address: string | null
  goods_shipped: boolean
  /** Nic nebylo zaplaceno — v dalších krocích se o vracení peněz nemluví. */
  nothing_to_refund: boolean
  auto_cancelled: boolean
}

export type CreatedClaim = {
  request: any
  protocolUrl: string | null
  /** §13.1 — žádost rovnou schválena, vyřízena a objednávka zrušena. */
  autoCancelled: boolean
  submittedAt: Date
  confirmation: ClaimConfirmation
}

/** Předmět potvrzení o přijetí podle druhu (§6). */
export const REFUND_REQUEST_SUBJECT: Record<string, string> = {
  reklamace: "Reklamaci jsme přijali",
  vraceni: "Žádost o vrácení zboží jsme přijali",
  odstoupeni: "Potvrzujeme přijetí vašeho odstoupení od smlouvy",
}

/** Předmět potvrzení, když server objednávku rovnou zrušil (§13.1). */
export const REFUND_REQUEST_AUTO_CANCELLED_SUBJECT: Record<string, string> = {
  vraceni: "Žádost o vrácení jsme přijali — objednávka je zrušená",
  odstoupeni: "Potvrzujeme přijetí vašeho odstoupení od smlouvy — objednávka je zrušená",
}

/**
 * Okamžik převzetí, který se ukládá k žádosti (`return_request.takeover_at`).
 *
 * Odstoupení / vrácení ho má z `withdrawalTimingFor` (počítá z něj lhůtu);
 * reklamace ho dřív neukládala vůbec (NULL i u doručené objednávky), ač je to
 * údaj, od kterého běží záruka a podle kterého admin posuzuje včasnost. Teď
 * stejným výpočtem — doručení ze sledování ČP, osobní odběr, odhad z
 * odeslání; neodesláno / na cestě = null.
 */
export const takeoverSnapshotFor = (
  kind: string | null,
  order: Parameters<typeof withdrawalTimingFor>[0],
  withdrawalTiming?: ReturnType<typeof withdrawalTimingFor> | null
): Date | null => {
  if (withdrawalTiming) {
    return withdrawalTiming.takeover_at
  }
  if (kind === "reklamace" || kind === "odstoupeni" || kind === "vraceni") {
    return withdrawalTimingFor(order).takeover_at
  }
  return null
}

/**
 * Založí žádost se všemi důsledky (fotky, protokol, e-maily). Pravidla
 * (`checkClaimRules`) si volající ověří PŘED tím — tady se už jen zakládá.
 *
 * Auto-zrušení (§13.1): odstoupení / vrácení bez zachycené platby a bez
 * odeslání se hned schválí, vyřídí a objednávka zruší (`auto-cancel-action`;
 * rozhodnutí samo je čisté v `auto-cancel.ts`). I tehdy dostane zákazník
 * POTVRZENÍ PŘIJETÍ s obsahem a datem a časem odeslání (§ 1830a — povinné
 * u odstoupení online), jen s větou, že objednávka je zrušená; majitelka
 * zvonek bez e-mailu.
 */
export const createClaim = async (
  container: MedusaContainer,
  params: {
    order: ClaimOrder & Record<string, any>
    input: ClaimIntakeInput
    /** Už načtené žádosti k objednávce (pro číslování protokolu). */
    existingRequests?: any[]
    /** Kudy žádost přišla — výchozí online (obě zákaznické routy). */
    channel?: ClaimChannel
  }
): Promise<CreatedClaim> => {
  const { order, input } = params
  const service = container.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )
  const kind = isClaimKind(input.kind) ? input.kind : null
  const isWithdrawalKind = kind === "odstoupeni" || kind === "vraceni"
  // Okamžik odeslání = čas serveru při přijetí. Z něj běží 30 dnů reklamace
  // (§ 19 ZOS) i 14 dnů na vrácení peněz (§ 1832) a ukazuje se v potvrzení.
  const now = new Date()
  const channel = params.channel ?? CLAIM_CHANNEL_ONLINE

  const existing =
    params.existingRequests ??
    ((await service.listReturnRequests({ order_id: order.id } as never)) as any[])

  // Fotky vady nahrajeme až TEĎ — po ověření vlastnictví, ať nejde zneužít
  // k anonymnímu plnění úložiště. Výsledek jsou URL, která uložíme k žádosti.
  const photoUrls = input.photos?.length
    ? await uploadReturnPhotos(container, input.photos)
    : []

  const legacyItemsText =
    typeof input.items === "string" && input.items.trim().length
      ? input.items.trim()
      : null

  // Snapshot vybraných položek (§11.1) — pravidla už prošla v `checkClaimRules`,
  // tady se jen sestaví; kdyby přece jen neprošla (volající pravidla přeskočil),
  // žádost se založí bez položek, ne s rozbitými.
  //
  // Odstoupení: zboží, od jehož koupě se odstupuje (bez zakázky). Od celé
  // smlouvy → `line_items` null (= celá objednávka, jak to čte admin); jinak
  // vybrané položky. E-mail i protokol vypíšou zboží vždy.
  const withdrawal: WithdrawalItemsVerdict | null =
    kind === "odstoupeni" ? resolveWithdrawalItems(order as any, input.line_items) : null
  const withdrawnItems = withdrawal && withdrawal.ok ? withdrawal.line_items : []
  const excludedItems = withdrawal && withdrawal.ok ? withdrawal.excluded : []
  const wholeOrder = Boolean(withdrawal && withdrawal.ok && withdrawal.whole)

  let lineItems: ClaimLineItem[] | null
  if (kind === "odstoupeni") {
    lineItems = withdrawnItems.length && !wholeOrder ? withdrawnItems : null
  } else {
    const resolved = resolveClaimLineItems(order, kind, input.line_items)
    lineItems = resolved.ok && resolved.line_items?.length ? resolved.line_items : null
  }
  const damageCause: DamageCause | null = isDamageCause(input.damage_cause)
    ? input.damage_cause
    : null
  // Položky slovy — přednostně formátovaný seznam, jinak starý text zákazníka.
  const itemsText =
    (kind === "odstoupeni" ? lineItemsText(withdrawnItems) : lineItemsText(lineItems)) ??
    legacyItemsText
  const excludedText = lineItemsText(excludedItems)
  // Účet pro vrácení převodem — normalizovaný (pravidla už prošla).
  const refundAccount = storedRefundAccount(input.refund_account)
  // Důvod, jak ho zákazník napsal (u odstoupení nepovinný) — do potvrzení
  // jen skutečný text, ne výchozí věta.
  const customerReason = (input.reason ?? "").trim() || null
  const formName = (input.customer_name ?? "").trim().slice(0, 200) || null

  // Snapshot převzetí a lhůty pro odstoupení (jen tam, kde dává smysl) —
  // později odeslaná zásilka už lhůtu téhle žádosti nepohne.
  const timing = isWithdrawalKind ? withdrawalTimingFor(order) : null
  // Převzetí ukládá i reklamace (od něj běží záruka, § 2165 OZ) — stejně
  // jako u odstoupení, jen bez lhůty a textu do potvrzení.
  const takeoverAt = takeoverSnapshotFor(kind, order, timing)
  const resolveBy = resolveByFor(kind, now)

  const request = await service.createReturnRequests({
    order_id: order.id,
    order_display_id: String(order.display_id),
    email: order.email ?? "",
    customer_name: formName ?? realCustomerName(order) ?? undefined,
    kind,
    resolve_by: resolveBy,
    submitted_at: now,
    channel,
    // Odstoupení / vrácení chodí bez textu → výchozí věta podle druhu, ať
    // admin, protokol i e-maily nečtou prázdný řádek (12. 10. 2026, Matěj).
    reason: claimReasonFor(kind, input.reason),
    requested_resolution:
      kind === "reklamace" ? (input.requested_resolution ?? null) : null,
    withdrawal_deadline: timing?.deadline ?? null,
    takeover_at: takeoverAt,
    // jsonb stores a bare string just fine; the generated DTO merely types the
    // json column as an object, hence the cast.
    items: legacyItemsText as unknown as Record<string, unknown>,
    line_items: lineItems as unknown as Record<string, unknown>,
    damage_cause: damageCause,
    refund_account: refundAccount?.display ?? null,
    photos: (photoUrls.length ? photoUrls : null) as unknown as Record<
      string,
      unknown
    >,
    status: "pending",
  })

  // Reklamační protokol (PDF) — zákonné písemné potvrzení o uplatnění. Druhá a
  // další žádost na téže objednávce v roce dostane příponu -2, -3 (žádné
  // přepisy PDF). Chyba generování/úložiště žádost neshodí (url zůstane null).
  const protocolNumber = protocolNumberFor(
    kind,
    String(order.display_id),
    now,
    nextProtocolSequence(existing, now)
  )
  const protocol = await buildAndStoreProtocol(container, {
    protocolNumber,
    kind,
    orderDisplayId: String(order.display_id),
    customerName: formName ?? realCustomerName(order),
    email: order.email ?? "",
    createdAt: now,
    reason: request.reason,
    items: itemsText,
    damageCause: damageCauseSentence(damageCause),
    requestedResolution:
      kind === "reklamace" ? resolutionLabel(input.requested_resolution) : null,
  }).catch(() => ({ url: null as string | null, number: protocolNumber }))
  await service
    .updateReturnRequests({
      id: request.id,
      protocol_url: protocol.url,
      protocol_number: protocol.number,
    })
    .catch(() => undefined)

  // Potvrzení přijetí (odstoupení: textově bez odkladu, s obsahem a datem
  // a časem odeslání — NV 29/2023 pokyn [4]; reklamace: § 19 odst. 1 ZOS —
  // datum uplatnění, obsah, požadovaný způsob vyřízení). Předmět i text podle
  // druhu; odkaz na stav žádosti ve storefrontu přes podepsaný token. Žádná
  // částka — nic ještě není rozhodnuto.
  const settings = isWithdrawalKind
    ? await getMerchantSettings(container).catch(() => null)
    : null
  const returnAddress = isWithdrawalKind
    ? withdrawalReturnAddress(settings?.return_address)
    : null
  const shipped = goodsShipped(order)
  const submittedText = formatPragueDateTime(now)
  const refundKind = refundMethodKindOf(order)
  const refundMethodText =
    isWithdrawalKind ||
    (kind === "reklamace" && input.requested_resolution === "refund")
      ? refundMethodTextFor(refundKind, refundAccount?.display ?? null)
      : null
  const takeoverText = timing ? takeoverTextFor(timing) : null
  const deadlineText =
    resolveBy && kind === "reklamace"
      ? `nejpozději do ${formatPragueDate(resolveBy)} (30 dnů od uplatnění reklamace)`
      : resolveBy && isWithdrawalKind
        ? `nejpozději do ${formatPragueDate(resolveBy)} (14 dnů od odstoupení)`
        : deadlineTextFor(kind)
  const claimsUrl = orderClaimsUrl(order.id)

  const emailData: Record<string, unknown> = {
    subject: REFUND_REQUEST_SUBJECT[kind ?? ""] ?? "Žádost o vrácení jsme přijali",
    customerName: customerName(order),
    orderNumber: orderNumber(order),
    orderLink: orderLink(order),
    kind,
    submittedAt: submittedText,
    submittedChannel: CLAIM_CHANNEL_LABEL[channel],
    // U reklamace popis vady (povinný), jinak jen důvod, který zákazník napsal.
    ...(kind === "reklamace"
      ? { refundReason: request.reason }
      : customerReason
        ? { refundReason: customerReason }
        : !kind
          ? { refundReason: request.reason }
          : {}),
    ...(kind === "reklamace" && input.requested_resolution
      ? { requestedResolution: resolutionLabel(input.requested_resolution) }
      : {}),
    ...(itemsText ? { items: itemsText } : {}),
    ...(excludedText ? { excludedItems: excludedText } : {}),
    ...(kind === "odstoupeni" ? { wholeOrder } : {}),
    ...(isWithdrawalKind
      ? {
          orderDate: formatPragueDate(order.created_at),
          goodsShipped: shipped,
          nothingToRefund: refundKind === "none",
          ...(takeoverText ? { takeoverText } : {}),
          ...(returnAddress ? { returnAddress } : {}),
        }
      : {}),
    ...(refundMethodText ? { refundMethodText } : {}),
    ...(damageCause === "carrier" ? { carrierDamage: true } : {}),
    ...(damageCause === "damaged" ? { damagedItem: true } : {}),
    deadlineText,
    ...(claimsUrl ? { claimsUrl } : {}),
    ...(protocol.url ? { protocolUrl: protocol.url } : {}),
  }

  const confirmation = (autoCancelled: boolean): ClaimConfirmation => ({
    id: request.id,
    kind,
    submitted_at: now.toISOString(),
    submitted_at_text: submittedText,
    channel,
    channel_text: CLAIM_CHANNEL_LABEL[channel],
    order_display_id: String(order.display_id ?? ""),
    order_date_text: formatPragueDate(order.created_at),
    customer_name: formName ?? realCustomerName(order),
    email: order.email ?? null,
    takeover_text: takeoverText,
    items: kind === "odstoupeni" ? withdrawnItems : (lineItems ?? []),
    excluded_items: excludedItems,
    whole_order: wholeOrder,
    reason: customerReason,
    refund_method_text: refundMethodText,
    return_address: returnAddress,
    goods_shipped: shipped,
    nothing_to_refund: refundKind === "none",
    auto_cancelled: autoCancelled,
  })

  // Auto-zrušení (§13.1): nezaplaceno + neodesláno + žádná zakázka → hotovo
  // bez majitelky. Rozhodnutí je čisté (`shouldAutoCancel`), vstupy z
  // objednávky (`CLAIM_ORDER_FIELDS` nese platby i fulfillmenty) a z modulu
  // zakázek. Selhání auto-zrušení žádost neshodí — spadne na běžnou cestu
  // (potvrzení o přijetí + rozhodnutí majitelky) a zaloguje se.
  if (isWithdrawalKind) {
    const production = await loadClaimProduction(container, order.id).catch(() => null)
    const flags = {
      kind,
      nothing_captured: capturedTotal(order as any) <= MONEY_EPSILON,
      goods_shipped: shipped,
      is_commission:
        Boolean(production) || (order.items ?? []).some((item) => isMadeToOrderItem(item)),
    }
    if (shouldAutoCancel(flags)) {
      try {
        const result = await autoCancelClaim(container, {
          request: { ...request, protocol_url: protocol.url, protocol_number: protocol.number },
          order,
          // Potvrzení přijetí s obsahem a datem a časem — i u zrušení hned.
          confirmationEmail: {
            ...emailData,
            subject:
              REFUND_REQUEST_AUTO_CANCELLED_SUBJECT[kind ?? ""] ??
              "Žádost jsme přijali — objednávka je zrušená",
            autoCancelled: true,
          },
        })
        return {
          request: result.request,
          protocolUrl: result.protocolUrl,
          autoCancelled: true,
          submittedAt: now,
          confirmation: confirmation(true),
        }
      } catch (error) {
        container
          .resolve(ContainerRegistrationKeys.LOGGER)
          .warn(
            `[claims] Auto-zrušení žádosti ${request.id} selhalo (${
              error instanceof Error ? error.message : String(error)
            }) — pokračuje běžná cesta.`
          )
      }
    }
  }

  await sendCustomerEmail(container, {
    template: "refund-request",
    to: order.email,
    key: `refund-request:${request.id}`,
    orderId: order.id,
    data: emailData,
  })

  // She works from her inbox (D7), and an unanswered return request is a
  // customer left waiting — so this one is bell + e-mail, not bell-only.
  // Položky každá na svém řádku (šablona ctí `\n`), ostatní jedním řádkem.
  const photosLine = photoUrls.length
    ? `${photoUrls.length} ${photoUrls.length === 1 ? "fotka" : "fotky"} vady`
    : null
  await notifyMerchant(container, {
    key: `mn:return-req:${request.id}`,
    title: `${kindLabel(kind)} k objednávce #${order.display_id}`,
    description: [
      [
        `Odesláno ${submittedText} (${CLAIM_CHANNEL_LABEL[channel]})`,
        `Důvod: ${request.reason}`,
        kind === "reklamace" && input.requested_resolution
          ? `Požaduje: ${resolutionLabel(input.requested_resolution)}`
          : null,
        kind === "odstoupeni"
          ? wholeOrder
            ? "Od celé smlouvy"
            : "Jen od vybraného zboží"
          : null,
        damageCause ? damageCauseLabel(damageCause) : null,
        photosLine,
        refundAccount ? `Účet pro vrácení: ${refundAccount.display}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      // U vrácení je výběr položek jediné, co zákazník vyplnil — musí být
      // v e-mailu vidět, co se vrací (12. 10. 2026, Matěj).
      itemsText
        ? `${kind === "vraceni" ? "Vracené zboží" : kind === "odstoupeni" ? "Odstupuje od" : "Zboží"}:\n${itemsText}`
        : null,
      excludedText
        ? `Vyjmuto z odstoupení (zakázka, § 1837 písm. d):\n${excludedText}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
    audience: "owner",
    urgent: false,
    email: true,
    resource: { id: order.id, type: "order" },
  })

  // Poškozeno přepravou (§11.3): druhé, URGENTNÍ upozornění s e-mailem.
  // Škodu u České pošty řeší majitelka (14. 10. 2026, právní audit §4.1 — za
  // vadu při převzetí odpovídá prodávající, lhůta ČP je její věc, ne
  // zákazníkova). Proto tady všechno, co k tomu potřebuje: číslo zásilky,
  // lhůta ČP, formulář, fotky a co je poškozené.
  if (damageCause === "carrier") {
    await notifyMerchant(container, {
      key: `mn:carrier-damage:${request.id}`,
      title: `Zásilka #${order.display_id} dorazila poškozená — uplatněte škodu u České pošty`,
      description: carrierDamageDescription({
        parcelCode: parcelCodeOf(order),
        itemsText,
        photoUrls,
        reason: request.reason,
      }),
      audience: "owner",
      urgent: true,
      email: true,
      resource: { id: order.id, type: "order" },
    }).catch(() => undefined)
  }

  return {
    request,
    protocolUrl: protocol.url,
    autoCancelled: false,
    submittedAt: now,
    confirmation: confirmation(false),
  }
}

/**
 * Text upozornění „poškozeno přepravou" (§11.3) — čistá funkce, ať jde
 * ověřit bez kontejneru: číslo zásilky (nebo že chybí), že škodu u ČP řeší
 * majitelka (zákazníkovi to podmínkou reklamace není), odkaz na stránku
 * a formulář ČP, lhůta, fotky od zákazníka a co je poškozené.
 */
export const carrierDamageDescription = (input: {
  parcelCode: string | null
  itemsText: string | null
  photoUrls: string[]
  reason: string
}): string =>
  [
    input.parcelCode
      ? `Číslo zásilky: ${input.parcelCode}`
      : "Číslo zásilky se nepodařilo dohledat (objednávka nemá podací číslo ČP) — najděte ho prosím v podacím archu.",
    "Škodu u České pošty řešíte vy jako odesílatel (pojištění balíku). Zákazník reklamuje u nás a lhůta pošty jeho reklamaci nepodmiňuje — za vadu při převzetí odpovídáte vy (§ 2161 OZ).",
    "Pokud Česká pošta vyžaduje součinnost příjemce (např. sepsat záznam o poškození na pobočce), požádejte o ni zákazníka — jako prosbu, ne podmínku vyřízení.",
    CP_DAMAGE_REPORT_DEADLINE_TEXT,
    `Postup ČP: ${CP_CLAIM_INFO_URL}`,
    `Formulář ČP (PDF): ${CP_CLAIM_FORM_URL}`,
    `Zákazník popisuje: ${input.reason}`,
    input.itemsText ? `Poškozené zboží:\n${input.itemsText}` : null,
    // Fotky jsou u poškození přepravou dobrovolné — prázdný seznam může
    // znamenat obojí (neposlal / nepodařilo se uložit).
    input.photoUrls.length
      ? `Fotky od zákazníka (${input.photoUrls.length}):\n${input.photoUrls.join("\n")}`
      : "Zákazník fotky nepřiložil (nebo se je nepodařilo uložit) — pro ČP si je případně vyžádejte e-mailem.",
    "Pro zákazníka jde dál o běžnou reklamaci — schválit, vyměnit nebo vrátit cenu položek.",
  ]
    .filter(Boolean)
    .join("\n")
