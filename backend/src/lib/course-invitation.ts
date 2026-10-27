import fontkit from "@pdf-lib/fontkit"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib"
import { SANSATION_BOLD_BASE64, SANSATION_REGULAR_BASE64 } from "./assets/protokol-fonts"
import { resolveFixedKeyProvider, sha256Hex } from "./potvrzeni-zakazky/store"
import type { EmailAttachmentRef } from "./legal/order-legal"

/**
 * Pozvánka na kurz (PDF) — příloha potvrzení rezervace.
 *
 * Jedna strana A4, kterou si zákazník vytiskne nebo ukáže v telefonu: jaký
 * kurz, kdy, kde, na koho, kolik osob, jestli je zaplaceno, co si vzít
 * s sebou a jak se ozvat. Není to daňový doklad (ten je faktura z iDokladu)
 * ani smlouva (ta je v e-mailu a v obchodních podmínkách).
 *
 * Ukládá se do úložiště souborů (R2) pod `courses/<rezervace>/pozvanka-<hash>.pdf`
 * a do e-mailu jde odkazem jako příloha (Resend si ji stáhne). Hash v názvu:
 * po změně počtu osob vznikne nová pozvánka, stará zůstane platná u starého
 * e-mailu.
 */

export type CourseInvitationInput = {
  reservationId: string
  customerName: string
  courseTitle: string
  /** Už naformátované (Europe/Prague), např. „středa 28. 10. 2026 17:00". */
  courseDate: string
  courseLocation: string
  /** „3 hodiny" nebo "". */
  courseDuration: string
  partySize: number
  /** „900 Kč". */
  totalAmount: string
  paid: boolean
  sellerName: string
  sellerPhone: string
  sellerEmail: string
  sellerWeb: string
  /** Storno podmínky z Právních údajů, nebo "" (pak odkaz na OP). */
  cancellationTerms: string
}

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 56
const CONTENT_W = PAGE_W - MARGIN * 2

const hex = (value: string): RGB => {
  const n = parseInt(value.replace("#", ""), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}
const PAPER = hex("#f3ebe1")
const CHARCOAL = hex("#1f1e1b")
const OLIVE = hex("#6f7259")
const MUTED = hex("#6b645c")
const HAIR = hex("#cfc4b6")
const CARD = hex("#fbf7f2")

type Fonts = { regular: PDFFont; bold: PDFFont }

/** Zalomení textu do šířky (po slovech). */
const wrap = (text: string, font: PDFFont, size: number, width: number): string[] => {
  const lines: string[] = []
  for (const paragraph of String(text).split(/\n+/)) {
    let line = ""
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= width || !line) {
        line = next
      } else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

const persons = (count: number): string =>
  count === 1 ? "1 osoba" : count < 5 ? `${count} osoby` : `${count} osob`

export const generateCourseInvitationPdf = async (input: CourseInvitationInput): Promise<Uint8Array> => {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fonts: Fonts = {
    regular: await doc.embedFont(Buffer.from(SANSATION_REGULAR_BASE64, "base64"), { subset: true }),
    bold: await doc.embedFont(Buffer.from(SANSATION_BOLD_BASE64, "base64"), { subset: true }),
  }
  doc.setTitle(`Pozvánka na kurz — ${input.courseTitle}`)
  doc.setAuthor(input.sellerName)
  doc.setCreator("Keramická zahrada")
  doc.setProducer("Keramická zahrada")
  doc.setLanguage("cs-CZ")

  const page: PDFPage = doc.addPage([PAGE_W, PAGE_H])
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER })

  let y = PAGE_H - MARGIN

  const text = (value: string, opts: { size: number; bold?: boolean; color?: RGB; x?: number }) => {
    page.drawText(value, {
      x: opts.x ?? MARGIN,
      y,
      size: opts.size,
      font: opts.bold ? fonts.bold : fonts.regular,
      color: opts.color ?? CHARCOAL,

    })
  }
  const paragraph = (value: string, size: number, color: RGB = CHARCOAL, width = CONTENT_W, x = MARGIN, lead = 1.45) => {
    for (const line of wrap(value, fonts.regular, size, width)) {
      page.drawText(line, { x, y, size, font: fonts.regular, color })
      y -= size * lead
    }
  }
  const rule = (gapBefore = 14, gapAfter = 22) => {
    y -= gapBefore
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.6, color: HAIR })
    y -= gapAfter
  }

  /* Hlavička */
  text("KERAMICKÁ ZAHRADA · ATELIÉR LUCIE POLANSKÉ", { size: 8.5, color: OLIVE })
  y -= 46
  text("Pozvánka", { size: 40, bold: false })
  y -= 30
  text("na kurz keramiky", { size: 20, color: OLIVE })
  rule(22, 30)

  /* Kurz */
  text("KURZ", { size: 8, color: MUTED })
  y -= 24
  for (const line of wrap(input.courseTitle, fonts.bold, 22, CONTENT_W)) {
    text(line, { size: 22, bold: true })
    y -= 28
  }
  y -= 6

  /* Údaje v kartě */
  const rows: Array<[string, string]> = [
    ["Kdy", input.courseDate],
    ["Kde", input.courseLocation || "—"],
    ...(input.courseDuration ? ([["Délka", input.courseDuration]] as Array<[string, string]>) : []),
    ["Na jméno", input.customerName],
    ["Počet osob", persons(input.partySize)],
    [input.paid ? "Zaplaceno" : "Platí se na místě", input.totalAmount],
  ]
  const LABEL_W = 120
  const rowHeights = rows.map(([, value]) => Math.max(1, wrap(value, fonts.regular, 12, CONTENT_W - 32 - LABEL_W).length) * 17 + 12)
  const cardH = rowHeights.reduce((sum, h) => sum + h, 0) + 16
  page.drawRectangle({ x: MARGIN, y: y - cardH + 14, width: CONTENT_W, height: cardH, color: CARD, borderColor: HAIR, borderWidth: 0.6 })
  y -= 8
  rows.forEach(([label, value], index) => {
    page.drawText(label.toUpperCase(), { x: MARGIN + 16, y: y + 2, size: 8, font: fonts.regular, color: MUTED })
    const lines = wrap(value, fonts.regular, 12, CONTENT_W - 32 - LABEL_W)
    lines.forEach((line, i) => {
      page.drawText(line, {
        x: MARGIN + 16 + LABEL_W,
        y: y - i * 17 + 1,
        size: 12,
        font: index === rows.length - 1 ? fonts.bold : fonts.regular,
        color: CHARCOAL,
      })
    })
    y -= rowHeights[index]
  })
  y -= 18

  /* Co s sebou */
  text("CO SI VZÍT S SEBOU", { size: 8, color: MUTED })
  y -= 18
  paragraph(
    "Pohodlné oblečení, kterému nevadí hlína, a dobrou náladu. Hlínu, nářadí i zástěry máme v dílně připravené. Přijďte prosím pár minut před začátkem.",
    11
  )
  y -= 12

  /* Storno */
  text("KDYBY VÁM TERMÍN NEVYŠEL", { size: 8, color: MUTED })
  y -= 18
  paragraph(
    input.cancellationTerms ||
      "Ozvěte se nám co nejdřív — podmínky zrušení najdete v obchodních podmínkách (kapitola Kurzy).",
    10.5,
    CHARCOAL
  )

  /* Kontakt dole */
  const footerTop = MARGIN + 70
  if (y > footerTop + 20) y = footerTop
  else y -= 20
  page.drawLine({ start: { x: MARGIN, y: y + 14 }, end: { x: PAGE_W - MARGIN, y: y + 14 }, thickness: 0.6, color: HAIR })
  text("Těším se na vás.", { size: 14, color: OLIVE })
  y -= 22
  const contact = [input.sellerName, input.sellerPhone, input.sellerEmail, input.sellerWeb].filter(Boolean).join("  ·  ")
  paragraph(contact, 9.5, MUTED)
  paragraph(`Číslo rezervace: ${input.reservationId}`, 8, MUTED)

  return doc.save({ useObjectStreams: false })
}

/**
 * Uloží pozvánku do úložiště a vrátí přílohu e-mailu, nebo null.
 *
 * R2 (`modules/minio-file`) umí pevný klíč — pozvánka má stabilní adresu podle
 * obsahu. Jiné úložiště (lokální v sandboxu) dostane obyčejný upload přes
 * modul souborů.
 */
export const storeCourseInvitation = async (
  container: MedusaContainer,
  input: CourseInvitationInput
): Promise<EmailAttachmentRef | null> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const provider = resolveFixedKeyProvider(container)
  const bytes = await generateCourseInvitationPdf(input)
  if (!provider) {
    const fileModule = container.resolve(Modules.FILE) as any
    const [file] = await fileModule.createFiles([
      {
        filename: `pozvanka-${input.reservationId.replace(/[^0-9A-Za-z_-]/g, "")}.pdf`,
        mimeType: "application/pdf",
        content: Buffer.from(bytes).toString("base64"),
        access: "public",
      },
    ])
    if (!file?.url) {
      logger.warn(`[kurzy] Pozvánku k rezervaci ${input.reservationId} se nepodařilo uložit — e-mail odejde bez ní.`)
      return null
    }
    return { filename: "pozvanka-na-kurz.pdf", url: file.url }
  }
  const key = `courses/${input.reservationId.replace(/[^0-9A-Za-z_-]/g, "")}/pozvanka-${sha256Hex(bytes).slice(0, 8)}.pdf`
  const url = (await provider.objectExistsAtKey(key))
    ? provider.publicUrlForKey(key)
    : (await provider.putObjectAtKey(key, bytes, "application/pdf")).url
  return { filename: "pozvanka-na-kurz.pdf", url }
}
