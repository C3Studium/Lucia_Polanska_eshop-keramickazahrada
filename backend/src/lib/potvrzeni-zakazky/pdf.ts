import fontkit from "@pdf-lib/fontkit"
import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  PDFString,
  rgb,
  type RGB,
} from "pdf-lib"
import {
  SANSATION_BOLD_BASE64,
  SANSATION_REGULAR_BASE64,
} from "../assets/protokol-fonts"
import type { CommissionConfirmationInput } from "./fields"

/**
 * PDF „Potvrzení zakázky" (LEGAL_AUDIT § 0, Z11; § 1827 odst. 2 OZ) —
 * rozvržení a doslovné texty podle vzoru `potvrzeni-zakazky.html`
 * (sekce 01–08, dvě strany jako `potvrzeni-zakazky-VZOR.pdf`).
 *
 * pdf-lib + vložený Sansation (jediný font s českou diakritikou, který v repu
 * je — vzor má patkové Noto Serif, to bez souboru fontu vysadit nejde).
 *
 * DETERMINISMUS: stejný vstup → stejné bajty → stejný sha256, na tom stojí
 * neměnnost dokladu v R2 (`store.ts`). Proto: pevné metadata (datum = datum
 * objednávky, Producer/Creator pevně), `useObjectStreams: false`, a žádný
 * zdroj náhody — pdf-lib si názvy fontů/XObjectů suffixuje ze SEEDOVANÉHO
 * generátoru (`PDFContext.rng`, seed 1), takže jsou stejné při každém běhu
 * (test to hlídá).
 */

/** Stažení fotky zadání — vrací bajty JPEG/PNG, nebo null (jiný formát, chyba). */
export type ImageFetcher = (url: string) => Promise<Uint8Array | null>

export type GenerateOptions = {
  /** Bez něj se fotky netisknou a místo nich je rámeček „foto u objednávky". */
  fetchImage?: ImageFetcher
}

// ── Rozměry a barvy (ze vzoru) ──────────────────────────────────────────────
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 51.02 // 18 mm
const CONTENT_W = PAGE_W - MARGIN * 2
const FOOTER_H = 26
const BOTTOM = MARGIN + FOOTER_H
const PHOTO = 85.04 // 30 mm
// Vzor má 10,5 pt patkové Noto Serif s řádkem 1,45; Sansation je širší, takže
// se stejný text vejde na dvě strany až s 10 pt a řádkem 1,38.
const BODY = 10
const LINE = 1.38

const hex = (value: string): RGB => {
  const n = parseInt(value.replace("#", ""), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}
const INK = hex("#1f1d1a")
const LEAD = hex("#3d3a35")
const MUTED = hex("#6b665e")
const ACCENT = hex("#b4553a")
const HAIR = hex("#d8d3cb")
const ROW = hex("#ebe7e0")
const BOX_BG = hex("#faf3ee")
const BRIEF_BG = hex("#f6f4f0")
const PH_BG = hex("#fbeee8")
const PHOTO_BORDER = hex("#b8b2a8")
const PHOTO_TEXT = hex("#9a948a")

const NBSP = " "

// ── Text s běhy (tučné části, barva, zvýraznění, odkaz) ─────────────────────
type Run = {
  text: string
  bold?: boolean
  color?: RGB
  size?: number
  /** `.ph` ze vzoru — červený text na světlém podkladu (záloha %). */
  highlight?: boolean
  href?: string
}

const r = (text: string, extra: Omit<Run, "text"> = {}): Run => ({ text, ...extra })
const b = (text: string): Run => ({ text, bold: true })

type Segment = Run & { x: number; width: number; font: PDFFont; fontSize: number }
type Line = { segments: Segment[]; height: number; size: number }

const toBytes = (base64: string): Uint8Array => new Uint8Array(Buffer.from(base64, "base64"))

/** Zalomí běhy do řádků dané šířky; `\n` v textu je tvrdý konec řádku. */
const wrap = (
  runs: Run[],
  maxWidth: number,
  baseSize: number,
  fonts: { regular: PDFFont; bold: PDFFont }
): Line[] => {
  const lines: Line[] = []
  let current: Segment[] = []
  let x = 0
  let lineSize = baseSize

  // Mezera „visí" přes hranici běhů („časem. " + tučné „Od tohoto…") — proto
  // žije mimo smyčku běhů a nuluje se jen s novým řádkem.
  let pendingSpace = false

  const flush = () => {
    lines.push({ segments: current, height: lineSize * LINE, size: lineSize })
    current = []
    x = 0
    lineSize = baseSize
    pendingSpace = false
  }

  for (const run of runs) {
    const font = run.bold ? fonts.bold : fonts.regular
    const size = run.size ?? baseSize
    const width = (text: string) => font.widthOfTextAtSize(text, size)
    const paragraphs = run.text.split("\n")
    paragraphs.forEach((paragraph, paragraphIndex) => {
      if (paragraphIndex > 0) flush()
      // Dělí se jen na obyčejné mezery — nezlomitelná (U+00A0) drží „1 234,50 Kč" pohromadě.
      const tokens = paragraph.split(/([ \t]+)/).filter((token) => token.length)
      for (const token of tokens) {
        if (/^[ \t]+$/.test(token)) {
          pendingSpace = current.length > 0 || x > 0
          continue
        }
        const push = (text: string) => {
          const w = width(text)
          current.push({ ...run, text, x, width: w, font, fontSize: size })
          x += w
          lineSize = Math.max(lineSize, size)
        }
        const spaceW = pendingSpace ? width(" ") : 0
        let word = token
        if (x + spaceW + width(word) > maxWidth && x > 0) {
          flush()
        }
        // Slovo delší než řádek (adresa) se láme po znacích.
        while (width(word) > maxWidth) {
          let cut = word.length
          while (cut > 1 && width(word.slice(0, cut)) > maxWidth) cut -= 1
          push(word.slice(0, cut))
          flush()
          word = word.slice(cut)
        }
        if (pendingSpace && x > 0) {
          if (run.href || run.highlight) {
            // Mezera před odkazem/zvýrazněním zůstane obyčejná — ať podtržení
            // a podklad nezačínají o mezeru dřív.
            const w = width(" ")
            current.push({ ...run, href: undefined, highlight: undefined, text: " ", x, width: w, font, fontSize: size })
            x += w
            push(word)
          } else {
            push(" " + word)
          }
        } else {
          push(word)
        }
        pendingSpace = false
      }
    })
  }
  if (current.length || !lines.length) flush()
  return lines
}

// ── Bloky (měří se, pak kreslí — kvůli zlomu stránky) ───────────────────────
type Block = {
  height: number
  draw: (x: number, yTop: number) => void
  /** Rozdělí blok na část, která se vejde do `height`, a zbytek (jen odstavce). */
  split?: (height: number) => [Block, Block] | null
}

export const generateCommissionConfirmationPdf = async (
  input: CommissionConfirmationInput,
  options: GenerateOptions = {}
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create({ updateMetadata: false })
  doc.registerFontkit(fontkit)
  const regular = await doc.embedFont(toBytes(SANSATION_REGULAR_BASE64), { subset: true })
  const bold = await doc.embedFont(toBytes(SANSATION_BOLD_BASE64), { subset: true })
  const fonts = { regular, bold }

  // Pevná metadata — datum objednávky, ne „teď" (viz determinismus v hlavičce).
  const stamp = new Date(input.order.placed_at_iso)
  doc.setTitle(`Potvrzení zakázky č. ${input.order.number}`)
  doc.setSubject("Potvrzení kupní smlouvy na výrobek podle zadání (§ 1827 odst. 2 OZ)")
  doc.setAuthor(input.seller.brand)
  doc.setProducer("Keramická zahrada — e-shop")
  doc.setCreator("potvrzeni-zakazky (pdf-lib)")
  doc.setCreationDate(stamp)
  doc.setModificationDate(stamp)

  const pages: PDFPage[] = []
  let page!: PDFPage
  let y = 0

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H])
    pages.push(page)
    y = PAGE_H - MARGIN
  }
  newPage()

  // ── Kreslicí primitiva ────────────────────────────────────────────────────
  const drawLines = (lines: Line[], x: number, yTop: number, align: "left" | "right" = "left", width = 0) => {
    let cursor = yTop
    for (const line of lines) {
      const lineWidth = line.segments.reduce((max, seg) => Math.max(max, seg.x + seg.width), 0)
      const shift = align === "right" ? width - lineWidth : 0
      const baseline = cursor - line.height + (line.height - line.size) / 2 + line.size * 0.22
      for (const seg of line.segments) {
        const sx = x + shift + seg.x
        if (seg.highlight) {
          page.drawRectangle({
            x: sx - 1,
            y: baseline - seg.fontSize * 0.25,
            width: seg.width + 2,
            height: seg.fontSize * 1.3,
            color: PH_BG,
          })
        }
        page.drawText(seg.text, {
          x: sx,
          y: baseline,
          size: seg.fontSize,
          font: seg.font,
          color: seg.color ?? (seg.highlight ? ACCENT : INK),
        })
        if (seg.href) {
          page.drawLine({
            start: { x: sx, y: baseline - 1.5 },
            end: { x: sx + seg.width, y: baseline - 1.5 },
            thickness: 0.5,
            color: seg.color ?? INK,
          })
          const annot = doc.context.obj({
            Type: "Annot",
            Subtype: "Link",
            Rect: [sx, baseline - 3, sx + seg.width, baseline + seg.fontSize],
            Border: [0, 0, 0],
            A: { Type: "Action", S: "URI", URI: PDFString.of(seg.href) },
          })
          page.node.addAnnot(doc.context.register(annot))
        }
      }
      cursor -= line.height
    }
  }

  /** Text s prostrkáním (verzálky hlavičky a nadpisů sekcí) — pdf-lib ho neumí samo. */
  const drawSpaced = (
    text: string,
    x: number,
    baseline: number,
    size: number,
    font: PDFFont,
    color: RGB,
    spacing: number
  ): number => {
    let cursor = x
    for (const ch of text) {
      page.drawText(ch, { x: cursor, y: baseline, size, font, color })
      cursor += font.widthOfTextAtSize(ch, size) + spacing
    }
    return cursor - x - spacing
  }

  const paragraph = (
    runs: Run[],
    opts: { size?: number; width?: number; color?: RGB; gapAfter?: number; align?: "left" | "right" } = {}
  ): Block => {
    const size = opts.size ?? BODY
    const width = opts.width ?? CONTENT_W
    const colored = opts.color ? runs.map((run) => ({ color: opts.color, ...run })) : runs
    const lines = wrap(colored, width, size, fonts)
    const gap = opts.gapAfter ?? 0
    const build = (subset: Line[], gapAfter: number): Block => ({
      height: subset.reduce((sum, line) => sum + line.height, 0) + gapAfter,
      draw: (x, yTop) => drawLines(subset, x, yTop, opts.align, width),
      split: (available) => {
        let used = 0
        let count = 0
        for (const line of subset) {
          if (used + line.height > available) break
          used += line.height
          count += 1
        }
        if (count < 2 || count >= subset.length) return null
        return [build(subset.slice(0, count), 0), build(subset.slice(count), gapAfter)]
      },
    })
    return build(lines, gap)
  }

  const spacer = (height: number): Block => ({ height, draw: () => undefined })

  /** Položí bloky pod sebe; `padTop` před prvním. */
  const stack = (blocks: Block[]): Block => ({
    height: blocks.reduce((sum, block) => sum + block.height, 0),
    draw: (x, yTop) => {
      let cursor = yTop
      for (const block of blocks) {
        block.draw(x, cursor)
        cursor -= block.height
      }
    },
  })

  /**
   * Umístí blok do toku; nevejde-li se, rozdělí ho (odstavce) nebo založí
   * stranu. `keepWith` = kolik místa musí zbýt POD blokem (nadpis sekce nesmí
   * osiřet na konci strany bez svého obsahu).
   */
  const place = (block: Block, keepWith = 0) => {
    let current = block
    if (keepWith > 0 && current.height + keepWith > y - BOTTOM && y < PAGE_H - MARGIN - 1) {
      newPage()
    }
    while (current.height > y - BOTTOM) {
      const available = y - BOTTOM
      const parts = current.split?.(available) ?? null
      if (parts) {
        parts[0].draw(MARGIN, y)
        newPage()
        current = parts[1]
        continue
      }
      if (y < PAGE_H - MARGIN - 1) {
        newPage()
        continue
      }
      break // vyšší než celá strana — kreslí se přes okraj, radši než nic
    }
    current.draw(MARGIN, y)
    y -= current.height
  }

  // ── Komponenty ze vzoru ───────────────────────────────────────────────────
  /** `h2`: linka nahoře, číslo sekce červeně, verzálky s prostrkáním. */
  const heading = (number: string, title: string, width = CONTENT_W): Block => ({
    height: 12 + 6 + 11 + 5,
    draw: (x, yTop) => {
      const lineY = yTop - 12
      page.drawLine({ start: { x, y: lineY }, end: { x: x + width, y: lineY }, thickness: 0.5, color: HAIR })
      const baseline = lineY - 6 - 9
      const w = drawSpaced(number, x, baseline, 9, bold, ACCENT, 0.9)
      drawSpaced(title.toUpperCase(), x + w + 6, baseline, 9, bold, MUTED, 0.9)
    },
  })

  type KvRow = { label: string; value: Run[] | Block }
  /** `table.kv`: popisek 30 % šedě, hodnota; linka pod řádkem kromě posledního. */
  const kvTable = (rows: KvRow[], width = CONTENT_W): Block => {
    const labelW = width * 0.3
    const valueW = width - labelW
    const built = rows.map((row) => {
      const value: Block =
        Array.isArray(row.value) ? paragraph(row.value, { width: valueW }) : row.value
      const label = paragraph([r(row.label, { color: MUTED, size: 9 })], { width: labelW - 10 })
      return { label, value, height: Math.max(label.height, value.height) + 6 }
    })
    return {
      height: built.reduce((sum, row) => sum + row.height, 0),
      draw: (x, yTop) => {
        let cursor = yTop
        built.forEach((row, index) => {
          row.label.draw(x, cursor - 3)
          row.value.draw(x + labelW, cursor - 3)
          cursor -= row.height
          if (index < built.length - 1) {
            page.drawLine({ start: { x, y: cursor }, end: { x: x + width, y: cursor }, thickness: 0.4, color: ROW })
          }
        })
      },
    }
  }

  /** `.brief`: zadání zákazníka — podklad, levá linka, zachované odřádkování. */
  const briefBox = (text: string, width: number): Block => {
    const inner = paragraph([r(text, { size: 9.5 })], { width: width - 20, size: 9.5 })
    return {
      height: inner.height + 16,
      draw: (x, yTop) => {
        page.drawRectangle({ x, y: yTop - inner.height - 16, width, height: inner.height + 16, color: BRIEF_BG })
        page.drawRectangle({ x, y: yTop - inner.height - 16, width: 2, height: inner.height + 16, color: INK })
        inner.draw(x + 10, yTop - 8)
      },
    }
  }

  // Fotky: stažené JPEG/PNG jako miniatury, jinak rámeček s textem.
  const images = new Map<string, PDFImage | null>()
  for (const url of input.brief.photos.slice(0, 3)) {
    let image: PDFImage | null = null
    try {
      const bytes = options.fetchImage ? await options.fetchImage(url) : null
      if (bytes && bytes.length > 3) {
        if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
          image = await doc.embedJpg(bytes)
        } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
          image = await doc.embedPng(bytes)
        }
      }
    } catch {
      image = null
    }
    images.set(url, image)
  }

  const photosRow = (urls: string[]): Block => ({
    height: urls.length ? PHOTO + 6 : 0,
    draw: (x, yTop) => {
      urls.forEach((url, index) => {
        const bx = x + index * (PHOTO + 6)
        const by = yTop - 6 - PHOTO
        const image = images.get(url) ?? null
        if (image) {
          const scale = Math.min(PHOTO / image.width, PHOTO / image.height)
          const w = image.width * scale
          const h = image.height * scale
          page.drawRectangle({ x: bx, y: by, width: PHOTO, height: PHOTO, borderColor: HAIR, borderWidth: 0.5 })
          page.drawImage(image, { x: bx + (PHOTO - w) / 2, y: by + (PHOTO - h) / 2, width: w, height: h })
        } else {
          page.drawRectangle({
            x: bx,
            y: by,
            width: PHOTO,
            height: PHOTO,
            borderColor: PHOTO_BORDER,
            borderWidth: 0.5,
            borderDashArray: [2, 2],
          })
          const label = "foto u objednávky"
          const w = regular.widthOfTextAtSize(label, 8)
          page.drawText(label, { x: bx + (PHOTO - w) / 2, y: by + PHOTO / 2 - 3, size: 8, font: regular, color: PHOTO_TEXT })
        }
      })
    },
  })

  type SumRow = { label: Run[]; amount: string; total?: boolean }
  /** `table.sum`: popisek vlevo (může se zalomit), částka vpravo; řádek Celkem s linkou a tučně. */
  const sumTable = (rows: SumRow[]): Block => {
    const moneyW = CONTENT_W * 0.28
    const labelW = CONTENT_W - moneyW - 8
    const built = rows.map((row) => {
      const label = paragraph(row.total ? row.label.map((run) => ({ ...run, bold: true })) : row.label, { width: labelW })
      const amount = paragraph([row.total ? b(row.amount) : r(row.amount)], { width: moneyW, align: "right" })
      const pad = row.total ? 5 : 3
      return { label, amount, pad, total: Boolean(row.total), height: Math.max(label.height, amount.height) + pad + 3 }
    })
    return {
      height: built.reduce((sum, row) => sum + row.height, 0),
      draw: (x, yTop) => {
        let cursor = yTop
        for (const row of built) {
          if (row.total) {
            page.drawLine({ start: { x, y: cursor }, end: { x: x + CONTENT_W, y: cursor }, thickness: 0.8, color: INK })
          }
          row.label.draw(x, cursor - row.pad)
          row.amount.draw(x + CONTENT_W - moneyW, cursor - row.pad)
          cursor -= row.height
        }
      },
    }
  }

  /** `ol`: číslo s odsazením, položky s mezerou 4pt; dělí se po položkách. */
  const orderedList = (items: Run[][]): Block => {
    const indent = 16
    const blocks = items.map((runs, index) => {
      const body = paragraph(runs, { width: CONTENT_W - indent })
      return {
        height: body.height + 4,
        draw: (x: number, yTop: number) => {
          const line = wrap([r(`${index + 1}.`)], indent, BODY, fonts)
          drawLines(line, x, yTop)
          body.draw(x + indent, yTop)
        },
      } as Block
    })
    const build = (subset: Block[]): Block => ({
      ...stack(subset),
      split: (available) => {
        let used = 0
        let count = 0
        for (const block of subset) {
          if (used + block.height > available) break
          used += block.height
          count += 1
        }
        if (count < 1 || count >= subset.length) return null
        return [build(subset.slice(0, count)), build(subset.slice(count))]
      },
    })
    return build(blocks)
  }

  /** `.box`: rámeček s podkladem (06). */
  const box = (runs: Run[]): Block => {
    const inner = paragraph(runs, { width: CONTENT_W - 22 })
    const height = inner.height + 18
    return {
      height: height + 16,
      draw: (x, yTop) => {
        page.drawRectangle({
          x,
          y: yTop - 8 - height,
          width: CONTENT_W,
          height,
          color: BOX_BG,
          borderColor: ACCENT,
          borderWidth: 0.6,
        })
        inner.draw(x + 11, yTop - 8 - 9)
      },
    }
  }

  /** `.consent`: zaškrtnutý rámeček + text + čas (malé, šedě). Fajfku font nemá — kreslí se. */
  const consentRow = (text: string, at: string): Block => {
    const body = paragraph([r(text), r(" " + at, { size: 8.5, color: MUTED })], { width: CONTENT_W - 18 })
    return {
      height: body.height + 4,
      draw: (x, yTop) => {
        const top = yTop - 2.5
        page.drawRectangle({ x, y: top - 10, width: 10, height: 10, borderColor: INK, borderWidth: 0.8 })
        page.drawLine({ start: { x: x + 2.3, y: top - 5.2 }, end: { x: x + 4.3, y: top - 7.6 }, thickness: 1, color: INK })
        page.drawLine({ start: { x: x + 4.3, y: top - 7.6 }, end: { x: x + 7.9, y: top - 2.4 }, thickness: 1, color: INK })
        body.draw(x + 18, yTop)
      },
    }
  }

  const small = (runs: Run[], gapAfter = 0): Block =>
    paragraph(runs, { size: 8.5, color: MUTED, gapAfter })

  // ── Hlavička ──────────────────────────────────────────────────────────────
  {
    const top = y
    const brandBase = top - 9
    drawSpaced(input.seller.brand.toUpperCase(), MARGIN, brandBase, 9, regular, MUTED, 0.72)
    page.drawText("Potvrzení zakázky", { x: MARGIN, y: brandBase - 16, size: 13, font: bold, color: INK })

    const right = (text: string, baseline: number, size: number, font: PDFFont, color: RGB) =>
      page.drawText(text, { x: MARGIN + CONTENT_W - font.widthOfTextAtSize(text, size), y: baseline, size, font, color })
    right("Objednávka", brandBase, 9, regular, MUTED)
    right(input.order.number, brandBase - 15, 12, bold, INK)
    right(
      `odeslána ${input.order.placed_at} · potvrzena ${input.order.confirmed_at}`,
      brandBase - 28,
      9,
      regular,
      MUTED
    )
    const ruleY = brandBase - 36
    page.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: MARGIN + CONTENT_W, y: ruleY }, thickness: 1.2, color: INK })
    y = ruleY - 12
  }

  place(paragraph([b("Výrobek podle vašeho zadání")], { size: 18, gapAfter: 4 }))
  place(
    paragraph(
      [
        r(
          `Potvrzujeme kupní smlouvu, kterou jste s námi uzavřel(a) objednávkou v e-shopu. Toto potvrzení a obchodní podmínky ve znění od ${input.terms.version} (v příloze) jsou smlouva — uschovejte si je.`
        ),
      ],
      { color: LEAD, gapAfter: 12 }
    )
  )

  // ── 01 Prodávající · 02 Kupující (dva sloupce) ────────────────────────────
  {
    const gap = 18
    const colW = (CONTENT_W - gap) / 2
    const sellerCol = stack([
      heading("01", "Prodávající", colW),
      kvTable(
        [
          { label: "Jméno", value: [r(`${input.seller.name}, podnikající fyzická osoba`)] },
          { label: "Sídlo · IČO", value: [r(`${input.seller.address} · ${input.seller.ico}`)] },
          { label: "Kontakt", value: [r(`${input.seller.email} · ${input.seller.phone}`)] },
        ],
        colW
      ),
    ])
    const buyerCol = stack([
      heading("02", "Kupující", colW),
      kvTable(
        [
          { label: "Jméno", value: [r(input.customer.name)] },
          { label: "Adresa", value: [r(input.customer.address)] },
          { label: "Kontakt", value: [r(`${input.customer.email} · ${input.customer.phone}`)] },
        ],
        colW
      ),
    ])
    place({
      height: Math.max(sellerCol.height, buyerCol.height),
      draw: (x, yTop) => {
        sellerCol.draw(x, yTop)
        buyerCol.draw(x + colW + gap, yTop)
      },
    })
  }

  // ── 03 Co vyrábíme ────────────────────────────────────────────────────────
  place(heading("03", "Co vyrábíme"), 40)
  {
    const valueW = CONTENT_W * 0.7
    place(
      kvTable([
        {
          label: "Výrobek",
          value: [b(input.product.title), r(input.product.variant_suffix)],
        },
        {
          label: "Vaše zadání",
          value: stack([briefBox(input.brief.text, valueW), photosRow(input.brief.photos.slice(0, 3))]),
        },
      ])
    )
  }
  place(spacer(6))
  place(
    small(
      [
        r(
          "Zadání jste zapsal(a) do objednávky a je pro obě strany závazné. Chcete-li ho změnit, napište nám co nejdřív — po zahájení výroby je změna možná jen dohodou a může změnit cenu i termín."
        ),
      ],
      0
    )
  )

  // ── 04 Cena a platby ──────────────────────────────────────────────────────
  const cur = input.price.currency
  place(heading("04", "Cena a platby"), 40)
  place(
    sumTable([
      { label: [r("Cena výrobku")], amount: `${input.price.item}${NBSP}${cur}` },
      ...(input.price.other !== null
        ? [{ label: [r("Další zboží v objednávce")], amount: `${input.price.other}${NBSP}${cur}` }]
        : []),
      { label: [r(`Doprava a balné (${input.shipping.method})`)], amount: `${input.price.shipping}${NBSP}${cur}` },
      { label: [r("Celkem")], amount: `${input.price.total}${NBSP}${cur}`, total: true },
      {
        label: [
          r(`Zaplaceno při objednávce (${input.deposit.method}, ${input.deposit.paid_at}) — z toho záloha `),
          r(`${input.mto.deposit}${NBSP}%`, { highlight: true, size: 9 }),
          r(` = ${input.price.deposit}${NBSP}${cur}`),
        ],
        amount: `${input.price.paid}${NBSP}${cur}`,
      },
      { label: [r("Zbývá doplatit po dokončení, před odesláním")], amount: `${input.price.balance}${NBSP}${cur}` },
    ])
  )
  place(spacer(6))
  place(
    small([
      r(
        `Ceny jsou konečné${input.vat.note}. Odkaz k doplatku vám pošleme e-mailem po schválení výrobku. Nezaplatíte-li ani po připomenutí do 30 dnů, platí, že jste zakázku zrušil(a) po zahájení výroby (bod 06, odst. 2).`
      ),
    ])
  )

  // ── 05 Jak to půjde dál ───────────────────────────────────────────────────
  place(heading("05", "Jak to půjde dál"), 40)
  place(
    orderedList([
      [
        b("Zahájení výroby."),
        r(" Začneme po připsání platby. V den, kdy začneme, vám pošleme e-mail „Zakázka je ve výrobě“ s datem a časem. "),
        b("Od tohoto e-mailu je výroba zahájena"),
        r(" — pro obě strany závazně, bez ohledu na pozdější tvrzení kohokoliv."),
      ],
      [
        b("Dokončení"),
        r(" do "),
        b(`${input.mto.lead_time_max}${NBSP}dnů od zahájení výroby`),
        r(
          ` (obvykle ${input.mto.lead_time_min}–${input.mto.lead_time_max}${NBSP}dnů; ruční výroba, sušení a dva výpaly). Praskne-li kus při výpalu, uděláme ho znovu bez příplatku a dáme vědět o novém termínu. Nestihneme-li ani ten, můžete od smlouvy odstoupit a vrátíme vám všechno.`
        ),
      ],
      [
        b("Schválení před výpalem."),
        r(
          " Pošleme vám fotografii hotového tvaru. Máte 5 pracovních dnů (připomeneme se). Schválíte-li ji, nebo se neozvete, je vyfocená podoba ujednanou vlastností výrobku (§ 2161 odst. 1 písm. a) OZ) a rozdíl proti vaší představě už není vadou. Nesoulad se zadáním — jiné číslo, text či motiv — "
        ),
        b("zůstává vadou vždy"),
        r("."),
      ],
      [b("Odeslání"), r(" do 2 pracovních dnů od doplatku, pojištěný křehký balík.")],
    ])
  )

  // ── 06 Zrušení zakázky a vrácení peněz ────────────────────────────────────
  place(heading("06", "Zrušení zakázky a vrácení peněz"), 40)
  place(
    box([
      b("Výrobek vzniká podle vašeho zadání, proto na něj neplatí vrácení do 14 dnů bez udání důvodu"),
      r(
        " (§ 1837 písm. d) OZ). Potvrdil(a) jste to před odesláním objednávky, spolu s tím, že záloha se po zahájení výroby nevrací."
      ),
    ])
  )
  place(
    orderedList([
      [
        b("Zrušíte-li před zahájením výroby"),
        r(
          " (před e-mailem z bodu 05/1): vrátíme vám všechno, co jste zaplatil(a), do 14 dnů, stejnou cestou, jakou jste platil(a)."
        ),
      ],
      [
        b("Zrušíte-li po zahájení výroby:"),
        r(
          ` záloha (${input.price.deposit}${NBSP}${cur}, nejvýše 50${NBSP}% ceny výrobku) se nevrací — pokrývá materiál, návrh, rezervovanou kapacitu a práci, které jsme do kusu vložili a který už nikomu jinému neprodáme. Všechno, co jste zaplatil(a) nad zálohu, vám vrátíme do 14 dnů stejnou cestou a doplatek po vás nepožadujeme. Rozpracovaný nebo hotový výrobek zůstává nám.`
        ),
      ],
      [
        b("Zrušíme-li my"),
        r(" (nejde vyrobit, nestihneme ani náhradní termín): vrátíme vám všechno do 14 dnů stejnou cestou."),
      ],
    ])
  )

  // ── 07 Vady ───────────────────────────────────────────────────────────────
  place(heading("07", "Vady"), 40)
  place(
    paragraph([
      r(
        "Za vady odpovídáme 2 roky od převzetí; vada do 1 roku se považuje za vadu při převzetí. Reklamaci vyřídíme do 30 dnů od uplatnění. Dorazí-li výrobek rozbitý, napište nám s fotografiemi — s dopravcem to řešíme my. "
      ),
      b("Vadou není"),
      r(
        " odstín a kresba glazury, drobné nerovnosti a stopy ruční práce ani drobná odchylka rozměru — každý kus vzniká rukama a žádné dva nejsou stejné. "
      ),
      b("Vadou je"),
      r(
        " prasklina, odštěpek, odlupující se glazura, jiný motiv, text nebo rozměr než ve schválené podobě, a poškození při přepravě. Při vadě máte právo nejprve na opravu nebo nový kus, pak na slevu nebo vrácení peněz (§ 2169–2171 OZ). Podrobně v "
      ),
      r("Reklamačním řádu", input.links.complaints ? { href: input.links.complaints } : {}),
      r("."),
    ])
  )

  // ── 08 Co jste odsouhlasil(a) při objednávce ──────────────────────────────
  place(heading("08", "Co jste odsouhlasil(a) při objednávce"), 40)
  place(
    consentRow(
      `Seznámil(a) jsem se s obchodními podmínkami ve znění od ${input.terms.version} včetně článku Výroba na zakázku.`,
      input.consent.terms_at
    )
  )
  place(
    consentRow(
      "Beru na vědomí, že výrobek podle mého zadání nelze vrátit ve 14denní lhůtě a že záloha se po zahájení výroby nevrací.",
      input.consent.mto_at
    )
  )
  place(spacer(6))
  place(
    small([
      r(
        `Souhlasy jsou uložené u objednávky č. ${input.order.number} s verzí podmínek a časem podle našeho serveru. Smlouva byla uzavřena česky, na dálku; toto potvrzení je její potvrzení v textové podobě (§ 1827 odst. 2 OZ). Spory lze řešit mimosoudně u České obchodní inspekce (Štěpánská 796/44, 110 00 Praha 1, www.coi.cz). Přílohy: Obchodní podmínky ${input.terms.version} · Poučení o odstoupení · Reklamační řád (PDF).`
      ),
    ])
  )

  // ── Patička na každé straně ───────────────────────────────────────────────
  // Vlevo prodávající (IČO hned za jménem jako ve vzoru PDF); adresa a e-mail
  // jen když se vejdou vedle pravého textu — jinak se vypouští odzadu.
  const footerParts = [
    input.seller.brand,
    input.seller.name,
    `IČO ${input.seller.ico}`,
    input.seller.address,
    input.seller.email,
  ]
  const footerRight = `Potvrzení zakázky č. ${input.order.number} · OP ${input.terms.version}`
  for (const p of pages) {
    const lineY = MARGIN + 14
    p.drawLine({ start: { x: MARGIN, y: lineY }, end: { x: MARGIN + CONTENT_W, y: lineY }, thickness: 0.4, color: HAIR })
    const rightW = regular.widthOfTextAtSize(footerRight, 7.5)
    const parts = [...footerParts]
    let left = parts.join(" · ")
    while (parts.length > 1 && regular.widthOfTextAtSize(left, 7.5) > CONTENT_W - rightW - 12) {
      parts.pop()
      left = parts.join(" · ")
    }
    p.drawText(left, { x: MARGIN, y: lineY - 10, size: 7.5, font: regular, color: MUTED })
    p.drawText(footerRight, { x: MARGIN + CONTENT_W - rightW, y: lineY - 10, size: 7.5, font: regular, color: MUTED })
  }

  // Bez objektových streamů — ty by sice byly menší, ale kompresi nechceme
  // mít v cestě determinismu (bajt po bajtu stejné PDF = stejný otisk).
  return doc.save({ useObjectStreams: false })
}
