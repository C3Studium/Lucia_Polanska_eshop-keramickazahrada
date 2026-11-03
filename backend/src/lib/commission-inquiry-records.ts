import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { CommissionInquiryInput, InquiryContext } from "./commission-inquiry"
import { productLink } from "./storefront-url"

/**
 * Poptávky zakázek v administraci (stránka Zakázková výroba → Poptávky).
 *
 * ## Kde poptávka žije
 *
 * V tabulce notifikací, jako dosud (`lib/commission-inquiry.ts`): každá
 * poptávka má položku zvonku (`channel: "feed"`, `trigger_type:
 * "commission-inquiry"`, klíč `mn:commission-inquiry:<otisk>`). Vlastní
 * tabulka by znamenala migraci a druhé místo, kde poptávka leží; tahle
 * položka vzniká u každé poptávky odjakživa, takže seznam ukáže i ty staré.
 *
 * - **Údaje**: nové poptávky mají v `data.inquiry` uložená pole tak, jak je
 *   zákazník vyplnil (zapisuje store routa hned po upozornění). Staré je
 *   nemají — ty se přečtou z textu upozornění, který skládá
 *   `buildInquiryOwnerNotification` (stejný kód = stejný tvar; test hlídá,
 *   že se text a čtení nerozejdou).
 * - **Stav**: `data.inquiry_status`. Bez něj = „Nová". Zvonek čte jen
 *   `data.title`/`data.description`, další klíče mu nevadí.
 *
 * Čisté funkce nahoře jdou do unit testu bez kontejneru; dvě funkce dole
 * sahají na notifikační modul.
 */

export const INQUIRY_TRIGGER = "commission-inquiry"

export const INQUIRY_STATUSES = ["new", "answered", "done"] as const
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "Nová",
  answered: "Odpovězeno",
  done: "Vyřízeno",
}

export const isInquiryStatus = (value: unknown): value is InquiryStatus =>
  typeof value === "string" && (INQUIRY_STATUSES as readonly string[]).includes(value)

/** Kolik položek se nejvýš načte — ateliér jich má desítky za rok, ne stovky. */
export const INQUIRY_LIST_LIMIT = 500

/** Co se ukládá do `data.inquiry` u nových poptávek. */
export type StoredInquiry = {
  name: string
  email: string
  phone: string | null
  description: string
  dimensions: string | null
  motif: string | null
  deadline: string | null
  product_title: string | null
  product_handle: string | null
  photo_urls: string[]
  photos_failed: number
  received_at: string
}

/** Jedna poptávka, jak ji dostane stránka. `id` = id položky zvonku. */
export type InquiryRecord = {
  id: string
  received_at: string
  status: InquiryStatus
  name: string
  email: string
  phone: string | null
  description: string
  dimensions: string | null
  motif: string | null
  deadline: string | null
  product_title: string | null
  product_url: string | null
  photo_urls: string[]
  photos_failed: number
}

const clean = (value: unknown): string => (typeof value === "string" ? value.trim() : "")
const orNull = (value: unknown): string | null => clean(value) || null

export const buildStoredInquiry = (
  input: CommissionInquiryInput,
  context: InquiryContext
): StoredInquiry => ({
  name: clean(input.name),
  email: clean(input.email),
  phone: orNull(input.phone),
  description: clean(input.description),
  dimensions: orNull(input.dimensions),
  motif: orNull(input.motif),
  deadline: orNull(input.deadline),
  product_title: orNull(input.product_title) ?? orNull(input.product_handle),
  product_handle: orNull(input.product_handle),
  photo_urls: [...context.photoUrls],
  photos_failed: context.photosFailed,
  received_at: context.receivedAt.toISOString(),
})

/* ---------------------------------------------------------------------------
 * Čtení starých poptávek z textu upozornění
 * ------------------------------------------------------------------------ */

/** Text upozornění píše „neuvedeno"/„neuveden" místo prázdného pole. */
const blankWords = new Set(["neuvedeno", "neuveden"])
const fieldValue = (value: string | undefined): string | null => {
  const text = clean(value)
  return text && !blankWords.has(text) ? text : null
}

/** První řádek, který začíná `prefix`, bez něj. */
const lineAfter = (lines: string[], prefix: string, from = 0): string | undefined => {
  for (let index = from; index < lines.length; index += 1) {
    if (lines[index].startsWith(prefix)) return lines[index].slice(prefix.length)
  }
  return undefined
}

export type ParsedOwnerText = Omit<StoredInquiry, "received_at" | "product_handle"> & {
  product_url: string | null
}

/**
 * Přečte text, který skládá `buildInquiryOwnerNotification`. Popis zákazníka
 * může mít víc řádků i prázdné řádky, proto se bere od „Co si představuje:"
 * po POSLEDNÍ „Rozměry:" — ten za popisem píše náš kód. `null`, když text
 * nemá tvar poptávky (nic se nevymýšlí).
 */
export const parseOwnerDescription = (text: unknown): ParsedOwnerText | null => {
  if (typeof text !== "string" || !text.trim()) return null
  const normalized = text.replace(/\r\n/g, "\n")
  const lines = normalized.split("\n")

  const from = /^(.*) <([^<>\s]+@[^<>\s]+)>$/.exec(lineAfter(lines, "Od: ") ?? "")
  const descStart = normalized.indexOf("\nCo si představuje:\n")
  const descEnd = normalized.lastIndexOf("\n\nRozměry: ")
  if (!from || descStart < 0 || descEnd < descStart) return null

  const description = normalized
    .slice(descStart + "\nCo si představuje:\n".length, descEnd)
    .trim()

  const head = normalized.slice(0, descStart).split("\n")
  const tail = normalized.slice(descEnd + 2).split("\n")

  // „K výrobku: Název — https://…" (odkaz jen když obchod znal svou adresu).
  const productRaw = clean(lineAfter(head, "K výrobku: "))
  const productMatch = /^(.*?) — (https?:\/\/\S+)$/.exec(productRaw)

  const photoHeader = tail.findIndex((line) => line.startsWith("Fotografie místa ("))
  const photo_urls: string[] = []
  if (photoHeader >= 0) {
    for (let index = photoHeader + 1; index < tail.length; index += 1) {
      const line = tail[index].trim()
      if (!/^https?:\/\/\S+$/.test(line)) break
      photo_urls.push(line)
    }
  }
  const failed = /^Pozor: (\d+) fot/.exec(tail.find((line) => line.startsWith("Pozor: ")) ?? "")

  return {
    name: clean(from[1]),
    email: clean(from[2]),
    phone: fieldValue(lineAfter(head, "Telefon: ")),
    description,
    dimensions: fieldValue(lineAfter(tail, "Rozměry: ")),
    motif: fieldValue(lineAfter(tail, "Motiv / text / číslo: ")),
    deadline: fieldValue(lineAfter(tail, "Termín: ")),
    product_title: productMatch ? clean(productMatch[1]) || null : productRaw || null,
    product_url: productMatch ? productMatch[2] : null,
    photo_urls,
    photos_failed: failed ? Number(failed[1]) : 0,
  }
}

/* ---------------------------------------------------------------------------
 * Notifikace → poptávka
 * ------------------------------------------------------------------------ */

export type InquiryNotification = {
  id: string
  created_at?: string | Date | null
  idempotency_key?: string | null
  data?: Record<string, unknown> | null
}

const asStored = (value: unknown): StoredInquiry | null => {
  const candidate = value as Partial<StoredInquiry> | null | undefined
  if (!candidate || typeof candidate !== "object") return null
  if (!clean(candidate.email) || !clean(candidate.description)) return null
  return candidate as StoredInquiry
}

const isoOf = (value: string | Date | null | undefined): string => {
  const date = value instanceof Date ? value : new Date(value ?? "")
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

export const inquiryFromNotification = (
  notification: InquiryNotification
): InquiryRecord | null => {
  const data = notification.data ?? {}
  const status: InquiryStatus = isInquiryStatus(data.inquiry_status)
    ? data.inquiry_status
    : "new"
  const stored = asStored(data.inquiry)

  if (stored) {
    const photos = Array.isArray(stored.photo_urls)
      ? stored.photo_urls.filter((url) => typeof url === "string" && url.length > 0)
      : []
    return {
      id: notification.id,
      received_at: isoOf(stored.received_at) || isoOf(notification.created_at),
      status,
      name: clean(stored.name),
      email: clean(stored.email),
      phone: orNull(stored.phone),
      description: clean(stored.description),
      dimensions: orNull(stored.dimensions),
      motif: orNull(stored.motif),
      deadline: orNull(stored.deadline),
      product_title: orNull(stored.product_title),
      product_url: productLink(orNull(stored.product_handle)) || null,
      photo_urls: photos,
      photos_failed: Number(stored.photos_failed) || 0,
    }
  }

  const parsed = parseOwnerDescription(data.description)
  if (!parsed) return null
  return {
    id: notification.id,
    received_at: isoOf(notification.created_at),
    status,
    ...parsed,
  }
}

/**
 * Klíč bez přípony opakovaného odeslání (`…:r2`) — opakovaná položka je
 * tatáž poptávka, v seznamu má být jednou.
 */
export const baseInquiryKey = (key: string | null | undefined): string =>
  (key ?? "").replace(/:r\d+$/, "")

/** Seznam pro stránku: bez duplicit, nejnovější nahoře. */
export const collectInquiries = (notifications: InquiryNotification[]): InquiryRecord[] => {
  const oldestFirst = [...notifications].sort(
    (a, b) => (isoOf(a.created_at) < isoOf(b.created_at) ? -1 : 1)
  )
  const seen = new Set<string>()
  const records: InquiryRecord[] = []
  for (const notification of oldestFirst) {
    const key = baseInquiryKey(notification.idempotency_key) || notification.id
    if (seen.has(key)) continue
    const record = inquiryFromNotification(notification)
    if (!record) continue
    seen.add(key)
    records.push(record)
  }
  return records.sort((a, b) => (a.received_at < b.received_at ? 1 : -1))
}

export const countInquiries = (records: InquiryRecord[]): Record<InquiryStatus, number> => {
  const counts: Record<InquiryStatus, number> = { new: 0, answered: 0, done: 0 }
  for (const record of records) counts[record.status] += 1
  return counts
}

/** Nová data položky se stavem — ostatní klíče (title, description…) zůstanou. */
export const withInquiryStatus = (
  data: Record<string, unknown> | null | undefined,
  status: InquiryStatus
): Record<string, unknown> => ({ ...(data ?? {}), inquiry_status: status })

/** Nová data položky s údaji poptávky — ostatní klíče i stav zůstanou. */
export const withStoredInquiry = (
  data: Record<string, unknown> | null | undefined,
  inquiry: StoredInquiry
): Record<string, unknown> => ({ ...(data ?? {}), inquiry })

/* ---------------------------------------------------------------------------
 * Notifikační modul
 * ------------------------------------------------------------------------ */

/**
 * `updateNotifications` modul má (generuje ho `MedusaService` jako u každého
 * modelu), jen ho veřejné typy nevypisují — proto úzké přetypování.
 */
type NotificationStore = {
  listNotifications: (
    filters: Record<string, unknown>,
    config?: Record<string, unknown>
  ) => Promise<InquiryNotification[]>
  updateNotifications: (data: { id: string; data: Record<string, unknown> }) => Promise<unknown>
}

const notificationStore = (container: MedusaContainer): NotificationStore =>
  container.resolve(Modules.NOTIFICATION) as unknown as NotificationStore

const INQUIRY_FIELDS = ["id", "created_at", "idempotency_key", "data"]

export const listInquiries = async (container: MedusaContainer): Promise<InquiryRecord[]> => {
  const rows = await notificationStore(container).listNotifications(
    { channel: "feed", trigger_type: INQUIRY_TRIGGER },
    { select: INQUIRY_FIELDS, take: INQUIRY_LIST_LIMIT, order: { created_at: "DESC" } }
  )
  return collectInquiries(rows)
}

/** Položka zvonku poptávky podle id; `null`, když to poptávka není. */
const findInquiryNotification = async (
  container: MedusaContainer,
  filters: Record<string, unknown>
): Promise<InquiryNotification | null> => {
  const [row] = await notificationStore(container).listNotifications(
    { ...filters, channel: "feed", trigger_type: INQUIRY_TRIGGER },
    { select: INQUIRY_FIELDS, take: 1 }
  )
  return row ?? null
}

/** Změní stav; vrací poptávku po změně, nebo `null`, když neexistuje. */
export const setInquiryStatus = async (
  container: MedusaContainer,
  id: string,
  status: InquiryStatus
): Promise<InquiryRecord | null> => {
  const row = await findInquiryNotification(container, { id })
  if (!row) return null
  const data = withInquiryStatus(row.data, status)
  await notificationStore(container).updateNotifications({ id: row.id, data })
  return inquiryFromNotification({ ...row, data })
}

/**
 * Dopíše k položce zvonku vyplněná pole (volá store routa po upozornění).
 * Když se to nepovede, nic se neztratí — stránka poptávku přečte z textu.
 */
export const attachStoredInquiry = async (
  container: MedusaContainer,
  ownerKey: string,
  inquiry: StoredInquiry
): Promise<boolean> => {
  const row = await findInquiryNotification(container, { idempotency_key: ownerKey })
  if (!row) return false
  // Dvojklik téhož dne: upozornění se podruhé neposlalo, tak ať i údaje
  // zůstanou ty první — ty, které majitelka má v e-mailu.
  if (asStored(row.data?.inquiry)) return true
  await notificationStore(container).updateNotifications({
    id: row.id,
    data: withStoredInquiry(row.data, inquiry),
  })
  return true
}
