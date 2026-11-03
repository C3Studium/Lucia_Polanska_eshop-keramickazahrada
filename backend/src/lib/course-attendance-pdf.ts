import fontkit from "@pdf-lib/fontkit"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib"
import { SANSATION_BOLD_BASE64, SANSATION_REGULAR_BASE64 } from "./assets/protokol-fonts"
import { resolveFixedKeyProvider, sha256Hex } from "./potvrzeni-zakazky/store"
import type { EmailAttachmentRef } from "./legal/order-legal"
import {
  attendanceSummary,
  formatKc,
  persons,
  type AttendanceRow,
} from "./course-attendance"

/**
 * Prezenční listina termínu kurzu (PDF) — příloha e-mailu majitelce 12 h
 * před začátkem (`jobs/course-attendance-sheet.ts`).
 *
 * A4 na šířku, aby se vešla tabulka: kdo přijde, kontakt, kolik osob, co je
 * zaplacené a kolik vybrat na místě, poznámka a místo na podpis. Políčko
 * vlevo je na odškrtnutí u dveří. Tentýž obsah tiskne admin z detailu
 * termínu (`routes/kurzy-sprava/[id]`) — řádky počítá `course-attendance.ts`.
 */

export type AttendanceSheetInput = {
  termId: string
  courseTitle: string
  /** Už naformátované (Europe/Prague). */
  courseDate: string
  courseLocation: string
  /** „3 hodiny" nebo "". */
  courseDuration: string
  rows: AttendanceRow[]
}

const PAGE_W = 841.89
const PAGE_H = 595.28
const MARGIN = 36
const CONTENT_W = PAGE_W - MARGIN * 2

const hex = (value: string): RGB => {
  const n = parseInt(value.replace("#", ""), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}
const CHARCOAL = hex("#1f1e1b")
const OLIVE = hex("#6f7259")
const MUTED = hex("#6b645c")
const HAIR = hex("#b9ad9e")
const HEAD_BG = hex("#f3ebe1")

type Fonts = { regular: PDFFont; bold: PDFFont }

/** Zalomení do šířky; příliš dlouhé slovo (e-mail) se láme po znacích. */
const wrap = (value: string, font: PDFFont, size: number, width: number): string[] => {
  const lines: string[] = []
  for (const paragraph of String(value).split(/\n+/)) {
    let line = ""
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= width) {
        line = next
        continue
      }
      if (line) lines.push(line)
      line = ""
      let rest = word
      while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
        let cut = rest.length - 1
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut -= 1
        lines.push(rest.slice(0, cut))
        rest = rest.slice(cut)
      }
      line = rest
    }
    if (line) lines.push(line)
  }
  return lines.length ? lines : [""]
}

type Column = {
  label: string
  width: number
  cell: (row: AttendanceRow) => { lines: string[]; bold?: boolean; sub?: string }
  align?: "right"
}

const SIZE = 9
const LEAD = 11.5
const PAD = 5

export const generateAttendanceSheetPdf = async (input: AttendanceSheetInput): Promise<Uint8Array> => {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fonts: Fonts = {
    regular: await doc.embedFont(Buffer.from(SANSATION_REGULAR_BASE64, "base64"), { subset: true }),
    bold: await doc.embedFont(Buffer.from(SANSATION_BOLD_BASE64, "base64"), { subset: true }),
  }
  doc.setTitle(`Prezenční listina — ${input.courseTitle}`)
  doc.setCreator("Keramická zahrada")
  doc.setProducer("Keramická zahrada")
  doc.setLanguage("cs-CZ")

  const summary = attendanceSummary(input.rows)

  const fixed = 22 + 118 + 80 + 128 + 36 + 70 + 70 + 100
  const columns: Column[] = [
    { label: "", width: 22, cell: () => ({ lines: [""] }) },
    { label: "Jméno", width: 118, cell: (row) => ({ lines: [row.name], bold: true }) },
    { label: "Telefon", width: 80, cell: (row) => ({ lines: [row.phone || "—"] }) },
    { label: "E-mail", width: 128, cell: (row) => ({ lines: [row.email || "—"] }) },
    { label: "Osob", width: 36, cell: (row) => ({ lines: [String(row.party_size)] }), align: "right" },
    {
      label: "Zaplaceno",
      width: 70,
      cell: (row) => ({ lines: [row.paid > 0 ? formatKc(row.paid) : "—"], sub: row.payment_note }),
      align: "right",
    },
    {
      label: "Vybrat na místě",
      width: 70,
      cell: (row) => ({ lines: [row.due > 0 ? formatKc(row.due) : "—"], bold: row.due > 0 }),
      align: "right",
    },
    { label: "Poznámka", width: CONTENT_W - fixed, cell: (row) => ({ lines: [row.note] }) },
    { label: "Podpis", width: 100, cell: () => ({ lines: [""] }) },
  ]

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  const draw = (value: string, x: number, size: number, opts: { bold?: boolean; color?: RGB } = {}) =>
    page.drawText(value, { x, y, size, font: opts.bold ? fonts.bold : fonts.regular, color: opts.color ?? CHARCOAL })

  /* Hlavička listiny — jen na první straně. */
  draw("KERAMICKÁ ZAHRADA · PREZENČNÍ LISTINA", MARGIN, 8, { color: OLIVE })
  y -= 24
  for (const line of wrap(input.courseTitle, fonts.bold, 18, CONTENT_W)) {
    draw(line, MARGIN, 18, { bold: true })
    y -= 22
  }
  const when = [input.courseDate, input.courseDuration].filter(Boolean).join(" · ")
  draw(`${when}${input.courseLocation ? `  ·  ${input.courseLocation}` : ""}`, MARGIN, 11)
  y -= 16
  draw(
    `${persons(summary.people)} · ${summary.reservations} ${
      summary.reservations === 1 ? "rezervace" : summary.reservations < 5 ? "rezervace" : "rezervací"
    } · vybrat na místě celkem ${summary.due_total > 0 ? formatKc(summary.due_total) : "nic"}`,
    MARGIN,
    10,
    { color: MUTED }
  )
  y -= 18

  const headerRow = () => {
    const h = 18
    page.drawRectangle({ x: MARGIN, y: y - h + 4, width: CONTENT_W, height: h, color: HEAD_BG })
    let x = MARGIN
    for (const column of columns) {
      const label = column.label.toUpperCase()
      const w = fonts.bold.widthOfTextAtSize(label, 7)
      page.drawText(label, {
        x: column.align === "right" ? x + column.width - PAD - w : x + PAD,
        y: y - 9,
        size: 7,
        font: fonts.bold,
        color: MUTED,
      })
      x += column.width
    }
    y -= h
  }

  headerRow()

  for (const row of input.rows) {
    const cells = columns.map((column) => {
      const cell = column.cell(row)
      const font = cell.bold ? fonts.bold : fonts.regular
      const lines = cell.lines.flatMap((line) => wrap(line, font, SIZE, column.width - PAD * 2))
      const sub = cell.sub ? wrap(cell.sub, fonts.regular, 7, column.width - PAD * 2) : []
      return { column, font, lines, sub }
    })
    const lineCount = Math.max(...cells.map((cell) => cell.lines.length + cell.sub.length * 0.8))
    const h = Math.max(30, lineCount * LEAD + PAD * 2 + 2)

    if (y - h < MARGIN + 14) {
      page = doc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
      draw(`${input.courseTitle} · ${input.courseDate} (pokračování)`, MARGIN, 9, { color: MUTED })
      y -= 16
      headerRow()
    }

    const top = y
    let x = MARGIN
    for (const { column, font, lines, sub } of cells) {
      let ly = top - PAD - SIZE
      for (const line of lines) {
        const w = font.widthOfTextAtSize(line, SIZE)
        page.drawText(line, {
          x: column.align === "right" ? x + column.width - PAD - w : x + PAD,
          y: ly,
          size: SIZE,
          font,
          color: CHARCOAL,
        })
        ly -= LEAD
      }
      for (const line of sub) {
        const w = fonts.regular.widthOfTextAtSize(line, 7)
        page.drawText(line, {
          x: column.align === "right" ? x + column.width - PAD - w : x + PAD,
          y: ly + 2,
          size: 7,
          font: fonts.regular,
          color: MUTED,
        })
        ly -= 9
      }
      x += column.width
    }
    /* Políčko na odškrtnutí. */
    page.drawRectangle({
      x: MARGIN + 6,
      y: top - PAD - 12,
      width: 11,
      height: 11,
      borderColor: CHARCOAL,
      borderWidth: 0.8,
    })
    y -= h
    page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_W - MARGIN, y: y + 4 }, thickness: 0.5, color: HAIR })
  }

  /* Patička s počtem stran. */
  const pages = doc.getPages()
  pages.forEach((p, index) => {
    const label = `Strana ${index + 1} z ${pages.length}`
    p.drawText(label, {
      x: PAGE_W - MARGIN - fonts.regular.widthOfTextAtSize(label, 7.5),
      y: MARGIN - 18,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
    })
  })

  return doc.save({ useObjectStreams: false })
}

/**
 * Uloží listinu do úložiště a vrátí přílohu e-mailu, nebo null.
 *
 * Listina nese jména a kontakty — adresa proto obsahuje otisk obsahu
 * (neuhádnutelná), jako pozvánky a potvrzení zakázek. Jiné úložiště než R2
 * (sandbox) dostane obyčejný upload; e-mail bez https adresy půjde bez
 * přílohy (Resend provider ji vynechá).
 */
export const storeAttendanceSheet = async (
  container: MedusaContainer,
  input: AttendanceSheetInput
): Promise<EmailAttachmentRef | null> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const bytes = await generateAttendanceSheetPdf(input)
  const safeId = input.termId.replace(/[^0-9A-Za-z_-]/g, "")
  const filename = "prezencni-listina.pdf"
  const provider = resolveFixedKeyProvider(container)
  if (!provider) {
    const fileModule = container.resolve(Modules.FILE) as any
    const [file] = await fileModule.createFiles([
      {
        filename: `prezencni-listina-${safeId}.pdf`,
        mimeType: "application/pdf",
        content: Buffer.from(bytes).toString("base64"),
        access: "public",
      },
    ])
    if (!file?.url) {
      logger.warn(`[kurzy] Prezenční listinu termínu ${input.termId} se nepodařilo uložit — e-mail odejde bez ní.`)
      return null
    }
    return { filename, url: file.url }
  }
  const key = `courses/terms/${safeId}/prezencni-listina-${sha256Hex(bytes).slice(0, 16)}.pdf`
  const url = (await provider.objectExistsAtKey(key))
    ? provider.publicUrlForKey(key)
    : (await provider.putObjectAtKey(key, bytes, "application/pdf")).url
  return { filename, url }
}
