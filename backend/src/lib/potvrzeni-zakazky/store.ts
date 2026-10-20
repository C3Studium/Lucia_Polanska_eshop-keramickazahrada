import { createHash } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Uložení PDF „Potvrzení zakázky" do úložiště (R2 přes modul minio-file) pod
 * PEVNÝ klíč `orders/<order_id>/potvrzeni-zakazky.pdf` — neměnný doklad
 * k objednávce (Z11).
 *
 * Neměnnost: co jednou pod klíčem leží, se nepřepisuje. Když má nově
 * vygenerované PDF jiný otisk než to uložené (změnila se data objednávky,
 * právní údaje…), uloží se VEDLE jako `potvrzeni-zakazky-<sha256 prvních 8>.pdf`
 * a staré zůstane. Stejný otisk = nic se nenahrává, jen se vrátí adresa.
 */

export const CONFIRMATION_MIME = "application/pdf"

/** Bezpečný kus klíče z id řádku objednávky (`ordli_01J…`). */
const lineSuffix = (lineItemId?: string | null): string =>
  lineItemId ? `-${String(lineItemId).replace(/[^0-9A-Za-z_-]/g, "")}` : ""

/**
 * Pevný klíč PDF. Od 20. 10. 2026 (zakázka = položka) nese klíč id řádku
 * objednávky: `orders/<order>/potvrzeni-zakazky-<line_item_id>.pdf`; legacy
 * zakázka (celá objednávka) zůstává bez přípony, jak byla uložená.
 */
export const confirmationKeyFor = (orderId: string, lineItemId?: string | null): string =>
  `orders/${orderId}/potvrzeni-zakazky${lineSuffix(lineItemId)}.pdf`

export const confirmationVersionKeyFor = (
  orderId: string,
  sha256: string,
  lineItemId?: string | null
): string => `orders/${orderId}/potvrzeni-zakazky${lineSuffix(lineItemId)}-${sha256.slice(0, 8)}.pdf`

export const sha256Hex = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex")

export type StoredConfirmation = {
  key: string
  url: string
  sha256: string
  /** Nahrávalo se (true), nebo už objekt se stejným obsahem existoval (false). */
  uploaded: boolean
}

/** Co o uloženém PDF ví produkční objednávka (`confirmation_pdf_*`). */
export type PreviousConfirmation = {
  key?: string | null
  url?: string | null
  sha256?: string | null
}

/** Provider s nahráváním na zadaný klíč (náš `modules/minio-file`). */
export type FixedKeyFileProvider = {
  putObjectAtKey(key: string, bytes: Uint8Array, mimeType: string): Promise<{ key: string; url: string }>
  objectExistsAtKey(key: string): Promise<boolean>
  publicUrlForKey(key: string): string
}

const isFixedKeyProvider = (candidate: unknown): candidate is FixedKeyFileProvider =>
  Boolean(candidate) &&
  typeof (candidate as any).putObjectAtKey === "function" &&
  typeof (candidate as any).objectExistsAtKey === "function" &&
  typeof (candidate as any).publicUrlForKey === "function"

/**
 * Náš provider z file modulu. Modul sám nabízí jen `createFiles` s náhodným
 * klíčem; k provideru se jde přes `getProvider()` (obal) a jeho `fileProvider_`.
 * Lokální disk v dev pevný klíč neumí → null a volající spadne na `createFiles`.
 */
export const resolveFixedKeyProvider = (container: MedusaContainer): FixedKeyFileProvider | null => {
  try {
    const fileModule = container.resolve(Modules.FILE) as any
    const wrapper = typeof fileModule?.getProvider === "function" ? fileModule.getProvider() : null
    const provider = wrapper?.fileProvider_ ?? wrapper
    return isFixedKeyProvider(provider) ? provider : null
  } catch {
    return null
  }
}

/**
 * Rozhodnutí, kam PDF uložit — čistá část (testovaná): podle otisku, toho, co
 * objednávka už má, a toho, co leží v úložišti.
 */
export const planConfirmationStorage = (input: {
  orderId: string
  sha256: string
  previous?: PreviousConfirmation | null
  fixedKeyExists: boolean
  /** Řádek objednávky (zakázka = položka); chybí u legacy zakázky. */
  lineItemId?: string | null
}): { action: "reuse"; key: string } | { action: "upload"; key: string } => {
  const fixedKey = confirmationKeyFor(input.orderId, input.lineItemId)
  const previousKey = input.previous?.key || fixedKey
  if (input.previous?.sha256 === input.sha256) {
    return { action: "reuse", key: previousKey }
  }
  if (!input.fixedKeyExists) {
    return { action: "upload", key: fixedKey }
  }
  // Pod pevným klíčem je jiné (nebo neznámé) PDF — nepřepisovat, uložit vedle.
  return {
    action: "upload",
    key: confirmationVersionKeyFor(input.orderId, input.sha256, input.lineItemId),
  }
}

export const storeCommissionConfirmation = async (
  container: MedusaContainer,
  orderId: string,
  bytes: Uint8Array,
  previous?: PreviousConfirmation | null,
  /** Řádek objednávky, jehož zakázku PDF potvrzuje; bez něj legacy klíč bez přípony. */
  lineItemId?: string | null
): Promise<StoredConfirmation> => {
  const sha256 = sha256Hex(bytes)
  const provider = resolveFixedKeyProvider(container)
  const fixedKey = confirmationKeyFor(orderId, lineItemId)

  if (!provider) {
    if (previous?.sha256 === sha256 && previous.url) {
      return { key: previous.key || fixedKey, url: previous.url, sha256, uploaded: false }
    }
    // Dev/lokální disk: bez pevného klíče, ale PDF k objednávce být musí.
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `[potvrzení zakázky] Úložiště neumí nahrát na zadaný klíč — ukládám Potvrzení zakázky ${orderId} pod náhodným názvem.`
      )
    const fileModule = container.resolve(Modules.FILE)
    const [uploaded] = await fileModule.createFiles([
      {
        filename: `potvrzeni-zakazky-${orderId}${lineItemId ? `-${lineItemId}` : ""}.pdf`,
        mimeType: CONFIRMATION_MIME,
        content: Buffer.from(bytes).toString("base64"),
        access: "public" as const,
      },
    ])
    return { key: (uploaded as any)?.id ?? "", url: (uploaded as any)?.url ?? "", sha256, uploaded: true }
  }

  const fixedKeyExists = await provider.objectExistsAtKey(fixedKey)
  const plan = planConfirmationStorage({ orderId, sha256, previous, fixedKeyExists, lineItemId })

  if (plan.action === "reuse") {
    return { key: plan.key, url: previous?.url || provider.publicUrlForKey(plan.key), sha256, uploaded: false }
  }
  // Verze vedle pevného klíče je sama o sobě idempotentní (název nese otisk).
  if (plan.key !== fixedKey && (await provider.objectExistsAtKey(plan.key))) {
    return { key: plan.key, url: provider.publicUrlForKey(plan.key), sha256, uploaded: false }
  }
  const stored = await provider.putObjectAtKey(plan.key, bytes, CONFIRMATION_MIME)
  return { key: stored.key, url: stored.url, sha256, uploaded: true }
}
