import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  customerName,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../customer-email"
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
import {
  CP_CLAIM_FORM_URL,
  CP_DAMAGE_REPORT_DEADLINE_TEXT,
  damageCauseLabel,
  deadlineTextFor,
  isClaimKind,
  isDamageCause,
  isOpenStatus,
  kindLabel,
  REQUESTED_RESOLUTIONS,
  resolutionLabel,
  resolveByFor,
  type ClaimKind,
  type DamageCause,
  type RequestedResolution,
} from "./constants"
import {
  allMadeToOrder,
  WITHDRAW_BLOCK_MADE_TO_ORDER,
  WITHDRAW_BLOCK_OPEN_REQUEST,
  withdrawBlockDeadline,
  withdrawalDeadlineFor,
  type ClaimOrder,
} from "./context"
import {
  lineItemsText,
  PHOTOS_REQUIRED_FOR_CARRIER_DAMAGE,
  resolveClaimLineItems,
  type ClaimItemSelection,
  type ClaimLineItem,
} from "./line-items"

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
  reason: string
  requested_resolution?: RequestedResolution | string | null
  /** Free text — which pieces are coming back (jen záložní routa). */
  items?: string | null
  /**
   * Vybrané položky `{ id, quantity }` (§11.1) — tokenová routa posílá vždy
   * pole (i prázdné); null/undefined = volající bez výběru položek.
   */
  line_items?: ClaimItemSelection[] | null
  /** `"carrier"` = zásilka dorazila poškozená (§11.3) → fotky povinné. */
  damage_cause?: DamageCause | string | null
  photos?: IntakePhoto[] | null
}

export type ClaimRuleVerdict =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Serverová pravidla §4 + §11.1 — čistá funkce (testovatelná bez kontejneru):
 * - §1837: čistá zakázka → `odstoupeni`/`vraceni` nejde;
 * - 14 dnů od odeslání pro `odstoupeni`/`vraceni` (bez odeslání = bez lhůty);
 * - u `reklamace` je `requested_resolution` povinné (§19/1 ZOS);
 * - položky: u reklamace aspoň jedna (když volající výběr má), id patří
 *   objednávce, množství ≤ objednané (`resolveClaimLineItems`);
 * - poškození přepravou → aspoň jedna fotka (bez ní nejde reklamovat u ČP);
 * - nejvýš jedna OTEVŘENÁ žádost na objednávku.
 */
export const checkClaimRules = (
  order: ClaimOrder,
  existingRequests: Array<{ status?: string | null }>,
  input: ClaimIntakeInput,
  now: Date = new Date()
): ClaimRuleVerdict => {
  if (input.kind === "odstoupeni" || input.kind === "vraceni") {
    if (allMadeToOrder(order)) {
      return { ok: false, message: WITHDRAW_BLOCK_MADE_TO_ORDER }
    }
    const deadline = withdrawalDeadlineFor(order)
    if (deadline && now.getTime() > deadline.getTime()) {
      return { ok: false, message: withdrawBlockDeadline(deadline) }
    }
  }
  if (input.kind === "reklamace") {
    const requested = input.requested_resolution ?? ""
    if (!(REQUESTED_RESOLUTIONS as readonly string[]).includes(requested)) {
      return {
        ok: false,
        message:
          "U reklamace prosím uveďte, co požadujete — opravu, výměnu, nebo vrácení peněz (§ 19 zákona o ochraně spotřebitele).",
      }
    }
  }
  const items = resolveClaimLineItems(order, input.kind, input.line_items)
  if (items.ok === false) {
    return items
  }
  if (isDamageCause(input.damage_cause) && !(input.photos?.length ?? 0)) {
    return { ok: false, message: PHOTOS_REQUIRED_FOR_CARRIER_DAMAGE }
  }
  if (existingRequests.some((request) => isOpenStatus(request.status))) {
    return { ok: false, message: WITHDRAW_BLOCK_OPEN_REQUEST }
  }
  return { ok: true }
}

export type CreatedClaim = {
  request: any
  protocolUrl: string | null
}

/**
 * Založí žádost se všemi důsledky (fotky, protokol, e-maily). Pravidla
 * (`checkClaimRules`) si volající ověří PŘED tím — tady se už jen zakládá.
 */
export const createClaim = async (
  container: MedusaContainer,
  params: {
    order: ClaimOrder & Record<string, any>
    input: ClaimIntakeInput
    /** Už načtené žádosti k objednávce (pro číslování protokolu). */
    existingRequests?: any[]
  }
): Promise<CreatedClaim> => {
  const { order, input } = params
  const service = container.resolve<ReturnRequestModuleService>(
    RETURN_REQUEST_MODULE
  )
  const kind = isClaimKind(input.kind) ? input.kind : null
  const now = new Date()

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
  const resolved = resolveClaimLineItems(order, kind, input.line_items)
  const lineItems: ClaimLineItem[] | null =
    resolved.ok && resolved.line_items?.length ? resolved.line_items : null
  const damageCause: DamageCause | null = isDamageCause(input.damage_cause)
    ? input.damage_cause
    : null
  // Položky slovy — přednostně formátovaný seznam, jinak starý text zákazníka.
  const itemsText = lineItemsText(lineItems) ?? legacyItemsText

  // Snapshot lhůty pro odstoupení (jen tam, kde dává smysl) — později odeslaná
  // zásilka už lhůtu téhle žádosti nepohne.
  const withdrawalDeadline =
    kind === "odstoupeni" || kind === "vraceni"
      ? withdrawalDeadlineFor(order)
      : null

  const request = await service.createReturnRequests({
    order_id: order.id,
    order_display_id: String(order.display_id),
    email: order.email ?? "",
    customer_name: realCustomerName(order) ?? undefined,
    kind,
    resolve_by: resolveByFor(kind, now),
    reason: input.reason,
    requested_resolution:
      kind === "reklamace" ? (input.requested_resolution ?? null) : null,
    withdrawal_deadline: withdrawalDeadline,
    // jsonb stores a bare string just fine; the generated DTO merely types the
    // json column as an object, hence the cast.
    items: legacyItemsText as unknown as Record<string, unknown>,
    line_items: lineItems as unknown as Record<string, unknown>,
    damage_cause: damageCause,
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
    customerName: realCustomerName(order),
    email: order.email ?? "",
    createdAt: now,
    reason: request.reason,
    items: itemsText,
    damageCause: damageCauseLabel(damageCause),
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

  // Potvrzení přijetí (odstoupení: textově bez odkladu; reklamace: §19/1).
  // Předmět i text podle druhu; odkaz na stav žádosti ve storefrontu přes
  // podepsaný token. Žádná částka — nic ještě není rozhodnuto.
  const claimsUrl = orderClaimsUrl(order.id)
  await sendCustomerEmail(container, {
    template: "refund-request",
    to: order.email,
    key: `refund-request:${request.id}`,
    orderId: order.id,
    data: {
      subject: REFUND_REQUEST_SUBJECT[kind ?? ""] ?? "Žádost o vrácení jsme přijali",
      customerName: customerName(order),
      orderNumber: orderNumber(order),
      orderLink: orderLink(order),
      kind,
      refundReason: request.reason,
      ...(kind === "reklamace" && input.requested_resolution
        ? { requestedResolution: resolutionLabel(input.requested_resolution) }
        : {}),
      ...(itemsText ? { items: itemsText } : {}),
      ...(damageCause === "carrier" ? { carrierDamage: true } : {}),
      deadlineText: deadlineTextFor(kind),
      ...(claimsUrl ? { claimsUrl } : {}),
      ...(protocol.url ? { protocolUrl: protocol.url } : {}),
    },
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
        `Důvod: ${request.reason}`,
        kind === "reklamace" && input.requested_resolution
          ? `Požaduje: ${resolutionLabel(input.requested_resolution)}`
          : null,
        damageCause ? damageCauseLabel(damageCause) : null,
        photosLine,
      ]
        .filter(Boolean)
        .join(" · "),
      itemsText ? `Zboží:\n${itemsText}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    audience: "owner",
    urgent: false,
    email: true,
    resource: { id: order.id, type: "order" },
  })

  // Poškozeno přepravou (§11.3): druhé, URGENTNÍ upozornění s e-mailem —
  // reklamaci u České pošty musí podat majitelka (odesílatel), a to do dvou
  // pracovních dnů od dodání; zákazníkova žádost sama o sobě lhůtu nehlídá.
  if (damageCause === "carrier") {
    await notifyMerchant(container, {
      key: `mn:carrier-damage:${request.id}`,
      title: `Zásilka #${order.display_id} dorazila poškozená — podejte reklamaci u České pošty`,
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

  return { request, protocolUrl: protocol.url }
}

/**
 * Text upozornění „poškozeno přepravou" (§11.3) — čistá funkce, ať jde
 * ověřit bez kontejneru: číslo zásilky (nebo že chybí), odkaz na formulář ČP,
 * lhůta, fotky od zákazníka a co je poškozené.
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
      : "Číslo zásilky se nepodařilo dohledat (objednávka nemá podací číslo ČP) — doplňte ho z podacího archu.",
    `Formulář reklamace ČP: ${CP_CLAIM_FORM_URL}`,
    CP_DAMAGE_REPORT_DEADLINE_TEXT,
    `Zákazník popisuje: ${input.reason}`,
    input.itemsText ? `Poškozené zboží:\n${input.itemsText}` : null,
    // Fotky jsou u poškození přepravou povinné — prázdný seznam znamená, že
    // se je nepodařilo uložit, ne že je zákazník neposlal.
    input.photoUrls.length
      ? `Fotky od zákazníka (${input.photoUrls.length}):\n${input.photoUrls.join("\n")}`
      : "Fotky se nepodařilo uložit — vyžádejte je od zákazníka e-mailem (ČP je k reklamaci potřebuje).",
    "Pro zákazníka jde dál o běžnou reklamaci — schválit, zboží zpět, vrátit cenu položek.",
  ]
    .filter(Boolean)
    .join("\n")

/** Předmět potvrzení o přijetí podle druhu (§6). */
export const REFUND_REQUEST_SUBJECT: Record<string, string> = {
  reklamace: "Reklamaci jsme přijali",
  vraceni: "Žádost o vrácení zboží jsme přijali",
  odstoupeni: "Odstoupení od smlouvy jsme přijali",
}
