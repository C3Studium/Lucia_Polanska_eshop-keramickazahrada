import type { LegalRegistry } from "@lib/legal/registry"

/**
 * Záznam souhlasu k objednávce — klíče v `cart.metadata`, které Medusa při
 * dokončení košíku zkopíruje do `order.metadata`. Je to důkaz, že zákazník
 * před odesláním objednávky viděl a odsouhlasil konkrétní znění dokumentů
 * (§ 1820, § 1826 OZ) a u zakázky i poučení o vyloučení odstoupení
 * (§ 1837 písm. d) OZ).
 *
 * Verze se počítají na SERVERU (serverová akce `recordCheckoutConsent`) —
 * hodiny prohlížeče se kolem data účinnosti nového znění můžou plést —
 * a z PUBLIKOVANÉHO sloučeného registru (`getPublishedLegalRegistry()`: repo +
 * Studio), takže se zapíše verze, kterou zákazník na webu opravdu viděl,
 * i když vznikla jen ve Studiu.
 * Čas zaškrtnutí je naopak z prohlížeče (`*_at`), protože to je okamžik, kdy
 * zákazník klikl; serverový čas k objednávce dopíše backend
 * (`terms_recorded_at`, subscriber `order-consent`).
 *
 * Při převodu košíku na novou verzi obchodu (`lib/data/cart-version.ts`) se
 * `terms_*` záměrně nepřenáší — souhlas se dává znovu v aktuálním znění.
 */

export const CONSENT_METADATA_KEYS = [
  "terms_version",
  "terms_accepted_at",
  "withdrawal_info_version",
  "privacy_version",
  "made_to_order_ack_at",
  "made_to_order_ack_version",
] as const

export type ConsentMetadataKey = (typeof CONSENT_METADATA_KEYS)[number]

/** Verze dokumentu, nebo „unknown", dokud registr žádnou nemá. */
const versionOf = (
  registry: Pick<LegalRegistry, "currentVersion">,
  slug: "odstoupeni-od-smlouvy" | "ochrana-osobnich-udaju",
  now: Date
) => registry.currentVersion(slug, now)?.version ?? "unknown"

/** Čas z prohlížeče, jen když je to opravdu ISO datum (jinak serverový). */
const validIso = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length > 40) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/**
 * Patch metadat košíku. U košíku BEZ zakázky se klíče zakázky zapíšou jako
 * `""` — Medusa metadata slučuje a klíč smaže jen prázdný řetězec, takže by
 * jinak mohl zůstat starý souhlas z dřívějšího obsahu košíku.
 */
export const consentMetadataPatch = ({
  registry,
  now,
  clientAcceptedAt,
  madeToOrder,
}: {
  /** Publikovaný sloučený registr (`getPublishedLegalRegistry()`). */
  registry: Pick<LegalRegistry, "currentTermsVersion" | "currentVersion">
  now: Date
  clientAcceptedAt?: string | null
  madeToOrder: boolean
}): Record<ConsentMetadataKey, string> => {
  const termsVersion = registry.currentTermsVersion(now)
  const acceptedAt = validIso(clientAcceptedAt) ?? now.toISOString()

  return {
    terms_version: termsVersion,
    terms_accepted_at: acceptedAt,
    withdrawal_info_version: versionOf(registry, "odstoupeni-od-smlouvy", now),
    privacy_version: versionOf(registry, "ochrana-osobnich-udaju", now),
    // Pravidla zakázky jsou v OP (čl. Výroba na zakázku) — poučení se tedy
    // váže k verzi OP, se kterou zákazník nakupuje.
    made_to_order_ack_at: madeToOrder ? acceptedAt : "",
    made_to_order_ack_version: madeToOrder ? termsVersion : "",
  }
}
