import { isMadeToOrderItem, type MadeToOrderSource } from "../claims/made-to-order"
import { isServiceLine } from "../packaging-lines"
import {
  findVersion,
  formatVersionDate,
  LEGAL_MANIFEST,
  legalPageUrl,
  legalPdfFor,
  sellerFacts,
  termsVersionUrl,
  versionValidAt,
  type LegalManifest,
  type LegalSlug,
  type SellerFacts,
} from "./index"

/**
 * Smlouva a poučení k objednávce — co potvrzovací e-mail přikládá a cituje
 * (§ 1827 odst. 2 OZ: potvrzení smlouvy v textové podobě včetně obchodních
 * podmínek).
 *
 * Verze obchodních podmínek se bere z objednávky (`metadata.terms_version`,
 * ukládá checkout při souhlasu). Starší objednávky ji nemají, nebo nesou
 * předregistrovou hodnotu („2026-08") — pak platí verze účinná v den
 * vytvoření objednávky. Totéž pro poučení o odstoupení
 * (`metadata.withdrawal_info_version`).
 *
 * Čisté funkce (bez Medusy) — testují se bez kontejneru.
 */

/** Příloha e-mailu jako odkaz na hostovaný soubor (Resend `attachments[].path`). */
export type EmailAttachmentRef = { filename: string; url: string }

export type OrderLegalDocument = {
  slug: LegalSlug
  title: string
  version: string
  /** „15. 10. 2026". */
  version_label: string
  /** Stránka dokumentu na webu (u OP stránka té konkrétní verze). */
  page_url: string
  /**
   * PDF té verze, nebo `null`, když ještě není vygenerované / nahrané, nebo
   * je to pracovní znění s `[[DOPLNIT]]` (to zákazník nedostane ani odkazem).
   */
  pdf_url: string | null
  /** PDF existuje, ale je pracovní znění — jen pro log, šablona ho nečte. */
  pdf_draft: boolean
  /** Přiloženo k e-mailu? Doplňuje krok workflow po ověření dostupnosti. */
  attached: boolean
}

export type OrderLegalEmailData = {
  seller: SellerFacts
  terms: OrderLegalDocument | null
  withdrawal: OrderLegalDocument | null
  /** Aktuální stránky dokumentů (bez verze). Prázdné bez nastaveného storefrontu. */
  terms_url: string
  withdrawal_url: string
  complaints_url: string
  privacy_url: string
  /** Názvy položek vyrobených na zakázku — u nich odstoupení neplatí (§ 1837 písm. d). */
  made_to_order_items: string[]
  /** Celá objednávka je zakázka (bez balného a doběrečného). */
  all_made_to_order: boolean
}

type OrderItemLike = MadeToOrderSource & {
  title?: string | null
  product_title?: string | null
  variant_id?: string | null
  product_id?: string | null
}

export type OrderLike = {
  created_at?: string | Date | null
  metadata?: Record<string, unknown> | null
  items?: Array<OrderItemLike | null> | null
}

/** Verze z metadat, pokud ji manifest zná; jinak verze platná v den objednávky. */
export const orderDocumentVersion = (
  slug: LegalSlug,
  stored: unknown,
  createdAt: OrderLike["created_at"],
  manifest: LegalManifest = LEGAL_MANIFEST
): string | null =>
  findVersion(slug, stored, manifest)?.version ??
  versionValidAt(slug, createdAt ?? new Date(), manifest)

const documentFor = (
  slug: LegalSlug,
  version: string | null,
  pageUrl: string,
  manifest: LegalManifest
): OrderLegalDocument | null => {
  if (!version) {
    return null
  }
  const entry = findVersion(slug, version, manifest)
  const pdf = legalPdfFor(slug, version, manifest)
  return {
    slug,
    title: entry?.title || manifest.documents[slug]?.title || slug,
    version,
    version_label: formatVersionDate(version),
    page_url: pageUrl,
    pdf_url: pdf && !pdf.draft ? pdf.url : null,
    pdf_draft: Boolean(pdf?.draft),
    attached: false,
  }
}

/** Položky na zakázku podle stejné detekce jako modul reklamací. */
export const madeToOrderTitles = (items: OrderLike["items"]): string[] =>
  (items ?? [])
    .filter((item): item is OrderItemLike => Boolean(item) && !isServiceLine(item))
    .filter((item) => isMadeToOrderItem(item))
    .map((item) => String(item.product_title || item.title || "").trim())
    .filter(Boolean)

/**
 * Data pro sekci „Smlouva a poučení" a přílohy potvrzovacího e-mailu.
 *
 * Přílohy jsou jen PDF s absolutní https adresou; `attached` u dokumentů
 * zůstává `false` — nastaví ho až krok, který ověří, že je soubor dostupný
 * (`markAttached`).
 */
export const orderLegalInfo = (
  order: OrderLike | null | undefined,
  manifest: LegalManifest = LEGAL_MANIFEST
): { legal: OrderLegalEmailData; attachments: EmailAttachmentRef[] } => {
  const meta = order?.metadata ?? {}
  const createdAt = order?.created_at ?? null

  const termsVersion = orderDocumentVersion(
    "obchodni-podminky",
    meta.terms_version,
    createdAt,
    manifest
  )
  const withdrawalVersion = orderDocumentVersion(
    "odstoupeni-od-smlouvy",
    meta.withdrawal_info_version,
    createdAt,
    manifest
  )

  const terms = documentFor(
    "obchodni-podminky",
    termsVersion,
    termsVersion ? termsVersionUrl(termsVersion, manifest) : "",
    manifest
  )
  const withdrawal = documentFor(
    "odstoupeni-od-smlouvy",
    withdrawalVersion,
    legalPageUrl("odstoupeni-od-smlouvy", manifest),
    manifest
  )

  const goods = (order?.items ?? []).filter(
    (item): item is OrderItemLike => Boolean(item) && !isServiceLine(item)
  )
  const madeToOrder = madeToOrderTitles(goods)

  const attachments: EmailAttachmentRef[] = [terms, withdrawal]
    .filter((doc): doc is OrderLegalDocument => Boolean(doc?.pdf_url))
    .filter((doc) => /^https:\/\//i.test(doc.pdf_url as string))
    .map((doc) => ({
      filename: legalPdfFor(doc.slug, doc.version, manifest)!.filename,
      url: doc.pdf_url as string,
    }))

  return {
    legal: {
      seller: sellerFacts(manifest),
      terms,
      withdrawal,
      terms_url: legalPageUrl("obchodni-podminky", manifest),
      withdrawal_url: legalPageUrl("odstoupeni-od-smlouvy", manifest),
      complaints_url: legalPageUrl("reklamacni-rad", manifest),
      privacy_url: legalPageUrl("ochrana-osobnich-udaju", manifest),
      made_to_order_items: madeToOrder,
      all_made_to_order: goods.length > 0 && madeToOrder.length === goods.length,
    },
    attachments,
  }
}

/** Označí dokumenty, jejichž PDF opravdu jde s e-mailem. */
export const markAttached = (
  legal: OrderLegalEmailData,
  attached: EmailAttachmentRef[]
): OrderLegalEmailData => {
  const urls = new Set(attached.map((attachment) => attachment.url))
  const mark = (doc: OrderLegalDocument | null) =>
    doc ? { ...doc, attached: Boolean(doc.pdf_url && urls.has(doc.pdf_url)) } : null
  return { ...legal, terms: mark(legal.terms), withdrawal: mark(legal.withdrawal) }
}

type FetchLike = (
  url: string,
  init: { method: string; signal?: AbortSignal; redirect?: "follow" }
) => Promise<{ ok: boolean; status: number; headers: { get(name: string): string | null } }>

/**
 * Ověří, že přílohy jsou opravdu ke stažení (HEAD). Resend si soubor stahuje
 * sám — rozbitá URL by mohla shodit celé potvrzení objednávky, a to je
 * horší než potvrzení s odkazem místo přílohy.
 */
export const checkAttachmentUrls = async (
  attachments: EmailAttachmentRef[],
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = 5000
): Promise<{
  reachable: EmailAttachmentRef[]
  failed: Array<EmailAttachmentRef & { reason: string }>
}> => {
  const results = await Promise.all(
    attachments.map(async (attachment) => {
      try {
        const response = await fetchImpl(attachment.url, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(timeoutMs),
        })
        const type = response.headers.get("content-type") ?? ""
        if (!response.ok) {
          return { attachment, reason: `HTTP ${response.status}` }
        }
        if (/text\/html/i.test(type)) {
          return { attachment, reason: `čekal jsem PDF, přišlo ${type}` }
        }
        return { attachment, reason: null }
      } catch (error) {
        return {
          attachment,
          reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        }
      }
    })
  )
  return {
    reachable: results.filter((r) => r.reason === null).map((r) => r.attachment),
    failed: results
      .filter((r): r is { attachment: EmailAttachmentRef; reason: string } => r.reason !== null)
      .map((r) => ({ ...r.attachment, reason: r.reason })),
  }
}
