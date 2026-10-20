import { isPublishedPdfUrl } from "./pdf-published"
import { formatVersionDate, LEGAL_PATHS, type LegalRegistry } from "./registry"

/**
 * Znění obchodních podmínek, podle kterého se objednávka uzavřela — pro
 * archiv smlouvy v účtu a na potvrzení (OP čl. III a IV, § 1827 OZ).
 *
 * Jen na serveru: registr nese plné znění všech dokumentů a do prohlížeče
 * nepatří. Stránka spočítá tenhle malý objekt a klientským komponentám ho
 * podá jako prop.
 */
export type OrderTermsRef = {
  /** Verze = datum účinnosti, `2026-10-15`. */
  version: string
  /** „15. 10. 2026". */
  validFrom: string
  /** Stránka toho znění bez prefixu země (`/smluvni-podminky/2026-10-15`). */
  href: string
  /** Veřejné PDF — jen nahrané do úložiště (absolutní https), jinak null. */
  pdfUrl: string | null
}

export type OrderLike = {
  created_at?: string | Date | null
  metadata?: Record<string, unknown> | null
}

const VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Verze z `order.metadata.terms_version` (zapisuje ji checkout) — VŽDY, když
 * je zapsaná ve správném tvaru, i kdyby ji registr zrovna neznal. Verze, která
 * existuje jen ve Studiu, při výpadku CMS v registru chybí; dosadit za ni
 * „platnou v den objednávky" by ukázalo jiné znění, než se kterým zákazník
 * souhlasil. Odkaz pak vede na stránku té verze (bez PDF, dokud ho manifest
 * nezná).
 *
 * Jen když verze zapsaná není (objednávky z doby před záznamem) nebo je
 * nečitelná, bere se verze platná v den vytvoření objednávky. Neznámé datum → null.
 */
export const orderTermsRefFrom = (
  registry: LegalRegistry,
  order: OrderLike
): OrderTermsRef | null => {
  const raw = order.metadata?.terms_version
  const recorded = typeof raw === "string" && VERSION_PATTERN.test(raw.trim()) ? raw.trim() : null
  const created = order.created_at ? new Date(order.created_at) : null
  const version =
    recorded ??
    /* Neplatné datum by `Intl.DateTimeFormat` v `currentVersion` shodilo. */
    (created && !Number.isNaN(created.getTime())
      ? registry.currentVersion("obchodni-podminky", created)?.version ?? null
      : null)

  if (!version) return null

  const pdf = registry.pdfEntry("obchodni-podminky", version)
  return {
    version,
    validFrom: formatVersionDate(version),
    href: `${LEGAL_PATHS["obchodni-podminky"]}/${version}`,
    /* Pracovní PDF (s `[[DOPLNIT]]`) se nenahrává a nenabízí. */
    pdfUrl: pdf && isPublishedPdfUrl(pdf.url) ? pdf.url : null,
  }
}
