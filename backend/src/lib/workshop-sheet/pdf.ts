import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, PDFString, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib"
import { SANSATION_BOLD_BASE64, SANSATION_REGULAR_BASE64 } from "../assets/protokol-fonts"
import type { SheetRow, WorkshopSheet } from "./data"

/**
 * List pro dílnu (PDF) — A4 na výšku, jednoduché tabulky k vytištění.
 *
 * pdf-lib + vložený Sansation (stejně jako Potvrzení zakázky a prezenční
 * listina): jediný font v repu s českou diakritikou. Černobíle, protože se
 * tiskne v dílně — důraz nese řez a rámeček, ne barva.
 *
 * Fotky zadání jako miniatury jen přes `fetchImage` (JPEG/PNG); bez něj nebo
 * u jiného formátu rámeček „foto v administraci".
 */

export type SheetImageFetcher = (url: string) => Promise<Uint8Array | null>

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 40
const CONTENT_W = PAGE_W - MARGIN * 2
const FOOTER = 26
const BOTTOM = MARGIN + FOOTER
const BODY = 11
const SMALL = 9.5
const LEAD = 1.3
const PAD = 5
const THUMB = 78
const MAX_PHOTOS_PER_COMMISSION = 8

const INK = rgb(0, 0, 0)
const MUTED = rgb(0.35, 0.35, 0.35)
const GRID = rgb(0.6, 0.6, 0.6)
const HEAD_BG = rgb(0.9, 0.9, 0.9)
const SERVICE_BG = rgb(0.96, 0.96, 0.96)

type Para = { text: string; bold?: boolean; size?: number; color?: RGB }
type Line = { text: string; font: PDFFont; size: number; color: RGB; height: number }
type Column = { width: number; align?: "left" | "right" }
type Row = { cells: Para[][]; fill?: RGB }

const toBytes = (base64: string) => new Uint8Array(Buffer.from(base64, "base64"))

/** Znaky, které font nemá (emoji, typografické uvozovky…), nahradí nebo vypustí. */
const makeSanitizer = (font: PDFFont) => {
  const supported = new Set<number>(font.getCharacterSet())
  const fallback: Record<string, string> = {
    "„": '"',
    "“": '"',
    "”": '"',
    "‚": "'",
    "‘": "'",
    "’": "'",
    "–": "-",
    "—": "-",
    "…": "...",
    " ": " ",
    " ": " ",
    "×": "x",
    "\t": " ",
  }
  // Náhrady jsou ASCII (font je má) nebo NBSP → mezera, takže rekurze končí.
  const one = (ch: string): string => {
    if (ch === "\n") return ch
    if (supported.has(ch.codePointAt(0) ?? 0)) return ch
    const replacement = fallback[ch]
    return replacement === undefined ? "" : Array.from(replacement).map(one).join("")
  }
  return (value: string): string =>
    Array.from(String(value ?? "").replace(/\r\n?/g, "\n"))
      .map(one)
      .join("")
}

export const generateWorkshopSheetPdf = async (
  sheet: WorkshopSheet,
  options: { fetchImage?: SheetImageFetcher; createdAt?: Date } = {}
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create({ updateMetadata: false })
  doc.registerFontkit(fontkit)
  const regular = await doc.embedFont(toBytes(SANSATION_REGULAR_BASE64), { subset: true })
  const bold = await doc.embedFont(toBytes(SANSATION_BOLD_BASE64), { subset: true })
  const clean = makeSanitizer(regular)

  const title = `Objednávka #${sheet.number} — list pro dílnu`
  const stamp = options.createdAt ?? new Date()
  doc.setTitle(clean(title))
  doc.setAuthor("Keramická zahrada")
  doc.setProducer("Keramická zahrada — e-shop")
  doc.setCreator("list pro dílnu (pdf-lib)")
  doc.setLanguage("cs-CZ")
  doc.setCreationDate(stamp)
  doc.setModificationDate(stamp)

  let page!: PDFPage
  let y = 0
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - MARGIN
  }
  newPage()

  // ── Text ────────────────────────────────────────────────────────────────
  const wrap = (para: Para, width: number): Line[] => {
    const font = para.bold ? bold : regular
    const size = para.size ?? BODY
    const color = para.color ?? INK
    const height = size * LEAD
    const lines: Line[] = []
    const w = (value: string) => font.widthOfTextAtSize(value, size)
    for (const paragraph of clean(para.text).split("\n")) {
      let line = ""
      for (const word of paragraph.split(/ +/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word
        if (w(next) <= width) {
          line = next
          continue
        }
        if (line) lines.push({ text: line, font, size, color, height })
        let rest = word
        // Slovo delší než sloupec (odkaz, e-mail) se láme po znacích.
        while (w(rest) > width && rest.length > 1) {
          let cut = rest.length - 1
          while (cut > 1 && w(rest.slice(0, cut)) > width) cut -= 1
          lines.push({ text: rest.slice(0, cut), font, size, color, height })
          rest = rest.slice(cut)
        }
        line = rest
      }
      lines.push({ text: line, font, size, color, height })
    }
    return lines
  }

  const drawLines = (lines: Line[], x: number, yTop: number, width: number, align: "left" | "right" = "left") => {
    let cursor = yTop
    for (const line of lines) {
      cursor -= line.height
      if (!line.text) continue
      const lineWidth = line.font.widthOfTextAtSize(line.text, line.size)
      page.drawText(line.text, {
        x: align === "right" ? x + width - lineWidth : x,
        y: cursor + (line.height - line.size) / 2 + line.size * 0.2,
        size: line.size,
        font: line.font,
        color: line.color,
      })
    }
  }

  const height = (lines: Line[]) => lines.reduce((sum, line) => sum + line.height, 0)

  // ── Tabulka (řádek se smí rozdělit přes stránku po řádcích textu) ─────────
  const table = (columns: Column[], header: string[] | null, rows: Row[]) => {
    const drawHeader = () => {
      if (!header) return
      const cells = header.map((label, index) =>
        wrap({ text: label, bold: true, size: SMALL }, columns[index].width - PAD * 2)
      )
      const h = Math.max(...cells.map(height)) + PAD * 2
      let x = MARGIN
      cells.forEach((lines, index) => {
        const width = columns[index].width
        page.drawRectangle({ x, y: y - h, width, height: h, color: HEAD_BG, borderColor: GRID, borderWidth: 0.5 })
        drawLines(lines, x + PAD, y - PAD, width - PAD * 2, columns[index].align)
        x += width
      })
      y -= h
    }

    const drawPart = (cells: Line[][], fill?: RGB) => {
      const h = Math.max(...cells.map(height)) + PAD * 2
      let x = MARGIN
      cells.forEach((lines, index) => {
        const width = columns[index].width
        page.drawRectangle({
          x,
          y: y - h,
          width,
          height: h,
          ...(fill ? { color: fill } : {}),
          borderColor: GRID,
          borderWidth: 0.5,
        })
        drawLines(lines, x + PAD, y - PAD, width - PAD * 2, columns[index].align)
        x += width
      })
      y -= h
    }

    const minRow = BODY * LEAD * 2 + PAD * 2
    if (y - BOTTOM < minRow + (header ? 24 : 0)) newPage()
    drawHeader()

    for (const row of rows) {
      let cells = row.cells.map((paras, index) =>
        paras.flatMap((para) => wrap(para, columns[index].width - PAD * 2))
      )
      for (;;) {
        const need = Math.max(...cells.map(height)) + PAD * 2
        const available = y - BOTTOM
        if (need <= available) {
          drawPart(cells, row.fill)
          break
        }
        if (available < minRow) {
          newPage()
          drawHeader()
          continue
        }
        // Co se vejde, na tuhle stranu; zbytek řádku pokračuje na další.
        const room = available - PAD * 2
        const split = cells.map((lines) => {
          let used = 0
          let count = 0
          for (const line of lines) {
            if (used + line.height > room) break
            used += line.height
            count += 1
          }
          return count
        })
        drawPart(cells.map((lines, index) => lines.slice(0, split[index])), row.fill)
        cells = cells.map((lines, index) => lines.slice(split[index]))
        newPage()
        drawHeader()
      }
    }
  }

  const kv = (rows: SheetRow[], labelWidth = 120) =>
    table(
      [{ width: labelWidth }, { width: CONTENT_W - labelWidth }],
      null,
      rows.map((row) => ({
        cells: [
          [{ text: row.label, size: SMALL, color: MUTED }],
          [{ text: row.value || "—", bold: row.bold }],
        ],
      }))
    )

  const section = (label: string, keep = 70) => {
    if (y - BOTTOM < keep + 30) newPage()
    y -= 14
    page.drawText(clean(label.toUpperCase()), { x: MARGIN, y: y - 12, size: 12, font: bold, color: INK })
    y -= 18
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 1, color: INK })
    y -= 6
  }

  const paragraph = (para: Para, gapAfter = 4) => {
    const lines = wrap(para, CONTENT_W)
    if (y - height(lines) < BOTTOM) newPage()
    drawLines(lines, MARGIN, y, CONTENT_W)
    y -= height(lines) + gapAfter
  }

  // ── Hlavička ──────────────────────────────────────────────────────────────
  page.drawText("KERAMICKÁ ZAHRADA", { x: MARGIN, y: y - 9, size: 9, font: regular, color: MUTED })
  y -= 14
  for (const line of wrap({ text: title, bold: true, size: 20 }, CONTENT_W)) {
    y -= line.height
    page.drawText(line.text, { x: MARGIN, y: y + 4, size: line.size, font: line.font, color: INK })
  }
  paragraph({ text: `Objednáno ${sheet.placed_at}`, size: BODY, color: MUTED }, 2)

  // ── 1 Zákazník ───────────────────────────────────────────────────────────
  section("Zákazník")
  kv(sheet.customer)

  // ── 2 Položky ────────────────────────────────────────────────────────────
  section("Položky")
  {
    const columns: Column[] = [
      { width: 205 },
      { width: 34, align: "right" },
      { width: 72, align: "right" },
      { width: 76, align: "right" },
      { width: CONTENT_W - 205 - 34 - 72 - 76 },
    ]
    table(
      columns,
      ["Název · provedení", "Ks", "Cena/ks", "Celkem", "Pozor"],
      sheet.items.map((item) => ({
        fill: item.service ? SERVICE_BG : undefined,
        cells: [
          [
            { text: item.title, bold: !item.service, size: item.service ? SMALL : BODY },
            ...item.details.map((detail) => ({ text: detail, size: SMALL, color: MUTED })),
          ],
          [{ text: item.quantity, bold: !item.service, size: item.service ? SMALL : BODY }],
          [{ text: item.unit_price, size: item.service ? SMALL : BODY }],
          [{ text: item.total, size: item.service ? SMALL : BODY }],
          item.flags.length ? item.flags.map((flag) => ({ text: flag, bold: true, size: SMALL })) : [{ text: "" }],
        ],
      }))
    )
  }

  // ── 3 Zakázka ────────────────────────────────────────────────────────────
  if (sheet.commissions.length) {
    // Miniatury fotek — stáhnou se naráz, chyba = rámeček místo fotky.
    const images = new Map<string, PDFImage | null>()
    const urls = [
      ...new Set(
        sheet.commissions.flatMap((commission) =>
          commission.pieces.flatMap((piece) => piece.photos).slice(0, MAX_PHOTOS_PER_COMMISSION)
        )
      ),
    ]
    await Promise.all(
      urls.map(async (url) => {
        let image: PDFImage | null = null
        try {
          const bytes = options.fetchImage ? await options.fetchImage(url) : null
          if (bytes && bytes.length > 3) {
            if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) image = await doc.embedJpg(bytes)
            else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
              image = await doc.embedPng(bytes)
          }
        } catch {
          image = null
        }
        images.set(url, image)
      })
    )

    sheet.commissions.forEach((commission, index) => {
      section(sheet.commissions.length > 1 ? `Zakázka ${index + 1} z ${sheet.commissions.length}` : "Zakázka", 120)
      paragraph({ text: commission.title, bold: true, size: 13 }, 4)
      kv([
        { label: "Stav", value: commission.stage, bold: true },
        ...commission.pieces.map((piece) => ({
          label: piece.label,
          value: [
            piece.specification || "(bez textu)",
            piece.photos.length ? `Fotek od zákazníka: ${piece.photos.length}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        })),
        ...(commission.internal_note ? [{ label: "Interní poznámka", value: commission.internal_note }] : []),
        ...commission.money,
      ])

      // Fotky pod tabulkou, s popiskem kusu; klik v PDF otevře originál.
      const photos = commission.pieces
        .flatMap((piece) => piece.photos.map((url) => ({ url, label: piece.label })))
        .slice(0, MAX_PHOTOS_PER_COMMISSION)
      if (!photos.length) return
      y -= 8
      const perRow = Math.floor((CONTENT_W + 8) / (THUMB + 8))
      for (let start = 0; start < photos.length; start += perRow) {
        const rowPhotos = photos.slice(start, start + perRow)
        const rowHeight = THUMB + 16
        if (y - rowHeight < BOTTOM) newPage()
        rowPhotos.forEach((photo, column) => {
          const bx = MARGIN + column * (THUMB + 8)
          const by = y - THUMB
          const image = images.get(photo.url) ?? null
          page.drawRectangle({ x: bx, y: by, width: THUMB, height: THUMB, borderColor: GRID, borderWidth: 0.5 })
          if (image) {
            const scale = Math.min(THUMB / image.width, THUMB / image.height)
            const w = image.width * scale
            const h = image.height * scale
            page.drawImage(image, { x: bx + (THUMB - w) / 2, y: by + (THUMB - h) / 2, width: w, height: h })
          } else {
            const label = "foto v administraci"
            const lw = regular.widthOfTextAtSize(label, 7.5)
            page.drawText(label, { x: bx + (THUMB - lw) / 2, y: by + THUMB / 2 - 3, size: 7.5, font: regular, color: MUTED })
          }
          if (/^https?:\/\//i.test(photo.url)) {
            const annot = doc.context.obj({
              Type: "Annot",
              Subtype: "Link",
              Rect: [bx, by, bx + THUMB, by + THUMB],
              Border: [0, 0, 0],
              A: { Type: "Action", S: "URI", URI: PDFString.of(photo.url) },
            })
            page.node.addAnnot(doc.context.register(annot))
          }
          page.drawText(clean(photo.label), { x: bx, y: by - 11, size: 8, font: regular, color: MUTED })
        })
        y -= rowHeight
      }
    })
  }

  // ── 4 Platba ─────────────────────────────────────────────────────────────
  section("Platba")
  kv(sheet.payment)

  // ── 5 Poznámka zákazníka ─────────────────────────────────────────────────
  if (sheet.customer_note) {
    section("Poznámka zákazníka")
    table([{ width: CONTENT_W }], null, [{ cells: [[{ text: sheet.customer_note }]] }])
  }

  // ── 6 Poznámky dílny + odškrtávání ───────────────────────────────────────
  {
    // Řádků na psaní tolik, kolik se vejde na stránku (3–8); méně než 3 → nová strana.
    const lineGap = 20
    const checksHeight = 36
    const sectionHead = 14 + 18 + 6
    const fits = (room: number) => Math.floor((room - sectionHead - 10 - 16 - checksHeight) / lineGap)
    /* Poznámka pro dílnu z adminu (19. 11. 2026) — vytištěná nahoře
       v sekci, linky na ruční psaní pokračují pod ní. */
    if (sheet.admin_note) {
      section("Poznámky dílny")
      table([{ width: CONTENT_W }], null, [{ cells: [[{ text: sheet.admin_note }]] }])
    }
    if (fits(y - BOTTOM) < 3) newPage()
    const ruled = Math.min(8, fits(y - BOTTOM))
    const boxHeight = ruled * lineGap + 10
    section(sheet.admin_note ? "Další poznámky" : "Poznámky dílny", 0)
    page.drawRectangle({ x: MARGIN, y: y - boxHeight, width: CONTENT_W, height: boxHeight, borderColor: INK, borderWidth: 0.8 })
    for (let index = 1; index <= ruled; index += 1) {
      const ly = y - index * lineGap
      page.drawLine({ start: { x: MARGIN + 10, y: ly }, end: { x: MARGIN + CONTENT_W - 10, y: ly }, thickness: 0.4, color: GRID })
    }
    y -= boxHeight + 16

    const labels = ["Vyrobeno", "Zabaleno", "Štítek", "Odesláno / předáno"]
    const slot = CONTENT_W / labels.length
    labels.forEach((label, index) => {
      const x = MARGIN + index * slot
      page.drawRectangle({ x, y: y - 14, width: 14, height: 14, borderColor: INK, borderWidth: 1 })
      page.drawText(clean(label), { x: x + 20, y: y - 11.5, size: BODY, font: bold, color: INK })
    })
    y -= checksHeight
  }

  // ── Patička ───────────────────────────────────────────────────────────────
  const pages = doc.getPages()
  pages.forEach((p, index) => {
    const lineY = MARGIN + 12
    p.drawLine({ start: { x: MARGIN, y: lineY }, end: { x: MARGIN + CONTENT_W, y: lineY }, thickness: 0.4, color: GRID })
    p.drawText(clean(`Objednávka #${sheet.number} · list pro dílnu`), {
      x: MARGIN,
      y: lineY - 11,
      size: 8.5,
      font: regular,
      color: MUTED,
    })
    const right = `strana ${index + 1} z ${pages.length}`
    p.drawText(right, {
      x: MARGIN + CONTENT_W - regular.widthOfTextAtSize(right, 8.5),
      y: lineY - 11,
      size: 8.5,
      font: regular,
      color: MUTED,
    })
  })

  return doc.save({ useObjectStreams: false })
}
