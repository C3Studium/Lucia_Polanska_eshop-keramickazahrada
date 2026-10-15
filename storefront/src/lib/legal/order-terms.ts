import "server-only"

import { isPublishedPdfUrl } from "./pdf-published"
import { currentVersion, formatVersionDate, getVersion, LEGAL_PATHS, pdfEntry } from "./registry"

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

type OrderLike = {
  created_at?: string | Date | null
  metadata?: Record<string, unknown> | null
}

/**
 * Verze z `order.metadata.terms_version` (zapisuje ji checkout), pokud ji
 * registr zná; jinak verze platná v den vytvoření objednávky (starší
 * objednávky z doby před záznamem verze). Neznámé datum → null.
 */
export const orderTermsRef = (order: OrderLike): OrderTermsRef | null => {
  const recorded = order.metadata?.terms_version
  const created = order.created_at ? new Date(order.created_at) : null
  const doc =
    (typeof recorded === "string" ? getVersion("obchodni-podminky", recorded) : null) ??
    /* Neplatné datum by `Intl.DateTimeFormat` v `currentVersion` shodilo. */
    (created && !Number.isNaN(created.getTime())
      ? currentVersion("obchodni-podminky", created)
      : null)

  if (!doc) return null

  const pdf = pdfEntry("obchodni-podminky", doc.version)
  return {
    version: doc.version,
    validFrom: formatVersionDate(doc.version),
    href: `${LEGAL_PATHS["obchodni-podminky"]}/${doc.version}`,
    /* Pracovní PDF (s `[[DOPLNIT]]`) se nenahrává a nenabízí. */
    pdfUrl: pdf && isPublishedPdfUrl(pdf.url) ? pdf.url : null,
  }
}
