import { PDFDocument } from "pdf-lib"
import { isServiceLine } from "./packaging-lines"
import {
  MAX_KUSU,
  velikostPodleTrid,
  type VelikostZasilky,
} from "../modules/ceskaPostaFulfillment/parcel"

/**
 * Víc balíků na jednu adresu — štítek po balících a předvyplnění widgetu
 * (21. 11. 2026, Matěj).
 *
 * Česká pošta vrací u vícekusové zásilky JEDNO PDF se stránkou na balík
 * („1/2", „2/2" — ověřeno v testovacím prostředí). Tisknout jde rovnou celé,
 * ale widget nabídne i každý balík jako samostatné PDF: stránky se rozdělí
 * tady, žádné další volání ČP (reprint `parcelPrinting` by šel jen do doby,
 * kdy zásilka žije v evidenci).
 */

export type ParcelLabel = {
  /** Pořadí balíku (1 = hlavní) a celkem — „1/2". */
  index: number
  total: number
  tracking_number: string | null
  pdf_base64: string
}

/** Stránky štítku jako samostatná PDF. Jeden balík (nebo chyba) = `[]`. */
export const labelPerParcel = async (
  pdfBase64: string,
  parcelCodes: string[]
): Promise<ParcelLabel[]> => {
  try {
    const source = await PDFDocument.load(Buffer.from(pdfBase64, "base64"))
    const total = source.getPageCount()
    if (total <= 1) return []
    const parts: ParcelLabel[] = []
    for (let page = 0; page < total; page++) {
      const doc = await PDFDocument.create()
      const [copied] = await doc.copyPages(source, [page])
      doc.addPage(copied)
      parts.push({
        index: page + 1,
        total,
        tracking_number: parcelCodes[page] ?? null,
        pdf_base64: Buffer.from(await doc.save()).toString("base64"),
      })
    }
    return parts
  } catch {
    return []
  }
}

export type ParcelDefaults = {
  /** Předvybraná velikost: jen malé výrobky = S, aspoň jeden velký = M. */
  size: VelikostZasilky
  packages: number
  /** Kolik balíků jde zvolit: na adresu 5, Balíkovna (výdejna) jen 1. */
  max_packages: number
}

/** Co widget štítku předvyplní, z řádků objednávky. */
export const parcelDefaultsFor = (input: {
  items: Array<{ metadata?: Record<string, unknown> | null; variant_id?: string | null; product_id?: string | null }>
  balikovnaPickup: boolean
}): ParcelDefaults => {
  const classes = (input.items ?? [])
    .filter((item) => !isServiceLine(item as never) && !item?.metadata?.packaging_fee && !item?.metadata?.dobirka_fee)
    .map((item) => String(item?.metadata?.ship_class ?? ""))
  return {
    size: velikostPodleTrid(classes),
    packages: 1,
    max_packages: input.balikovnaPickup ? 1 : MAX_KUSU,
  }
}
