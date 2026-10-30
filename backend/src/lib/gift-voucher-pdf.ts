import fontkit from "@pdf-lib/fontkit"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib"
import { SANSATION_BOLD_BASE64, SANSATION_REGULAR_BASE64 } from "./assets/protokol-fonts"
import { resolveFixedKeyProvider, sha256Hex } from "./potvrzeni-zakazky/store"
import type { EmailAttachmentRef } from "./legal/order-legal"
import { getLegalFacts } from "./merchant-settings"
import { formatVoucherCode } from "../modules/gift-voucher/code"
import { formatVoucherCzk, formatVoucherDate } from "./gift-voucher-view"
import { giftVoucherLink } from "./gift-voucher-link"

/**
 * Dárkový poukaz jako PDF — elektronická podoba té vytištěné kartičky.
 *
 * Předloha je kartička z dílny: bílý podklad, modrý nadpis „Dárkový poukaz
 * na nákup keramiky“, pod ním „v hodnotě …“, vlevo dole dílna, adresa
 * a telefon, vpravo modro-tyrkysový květinový ornament. Elektronický poukaz
 * vypadá stejně — jen místo ručně dopsané částky nese vytištěnou hodnotu,
 * kód k uplatnění a platnost, které vytištěná kartička nemá.
 *
 * Jedna strana A4 na výšku: nahoře karta v poměru originálu (DL), kterou jde
 * vystřihnout a darovat, pod ní to, co patří spíš kupujícímu — komu, od koho,
 * věnování a jak se poukaz uplatní.
 *
 * Ukládá se jako pozvánka na kurz (`course-invitation.ts`): do R2 pod
 * `gift-vouchers/<poukaz>/poukaz-<otisk>.pdf`. Otisk v názvu znamená, že po
 * změně údajů (prodloužená platnost, opravené věnování) vznikne nový soubor
 * a ten starý zůstane platný u staršího e-mailu.
 */

export type GiftVoucherPdfInput = {
  /** Id poukazu — jen do názvu souboru a do patičky. */
  voucherId: string
  /** Kód k uplatnění, už naformátovaný („KZ-7HQ4-M2XP“). */
  code: string
  /** Hodnota při vystavení („1 500 Kč“). */
  value: string
  /** Zbývá k uplatnění, když je to míň než hodnota, jinak null. */
  balance?: string | null
  /** Platnost („30. 10. 2027“). */
  validUntil: string
  /**
   * Kdy poukaz vznikl (ISO). Razí se do PDF jako datum vytvoření — MUSÍ být
   * odvozené z poukazu, ne z hodin: `doc.save()` jinak zapíše „teď“ a tentýž
   * poukaz vystavený dvakrát má jiné bajty. A protože klíč v úložišti nese
   * otisk obsahu, přibyla by při každém vystavení další kopie téhož souboru.
   */
  issuedAt?: string | null
  recipientName?: string | null
  buyerName?: string | null
  dedication?: string | null
  /** Stránka poukazu na webu, nebo prázdné — pak se neuvádí. */
  voucherUrl?: string | null
  sellerName: string
  /** „Lucie Polanské“ do věty „v keramické dílně …“; bez něj se odvodí. */
  sellerNameGenitive?: string | null
  sellerAddress: string
  sellerPhone: string
  sellerEmail: string
  sellerWeb: string
  /** Co se zůstatkem při nákupu pod hodnotu (z Právních údajů), nebo prázdné. */
  remainderNote?: string | null
}

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 48
const CONTENT_W = PAGE_W - MARGIN * 2

const hex = (value: string): RGB => {
  const n = parseInt(value.replace("#", ""), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/* Barvy z vytištěné předlohy: sytá modř nadpisu a tyrkys na konci ornamentu. */
const INK = hex("#1b5ba6")
const INK_TEAL = hex("#3aa6ba")
const CARD = hex("#ffffff")
const PAPER = hex("#f5f1ea")
const TEXT = hex("#1a1917")
const MUTED = hex("#6b645c")
const HAIR = hex("#cfc4b6")

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

/**
 * Druhý pád jména majitelky do věty „v keramické dílně …“, jak je na
 * vytištěné kartičce („Lucie Polanské“).
 *
 * Zvládá ženská jména, o která tu jde: `-á` → `-é` (Polanská → Polanské),
 * `-a` → `-y` (Jana → Jany), `-e`/`-ě` zůstává (Lucie → Lucie). Cokoli
 * jiného nechá být — radši jméno v prvním pádě než vymyšlený tvar. Kdo
 * potřebuje jiný, pošle ho v `sellerNameGenitive`.
 */
export const dilnaGenitive = (name: string): string =>
  String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/á$/.test(word)) return `${word.slice(0, -1)}é`
      if (/[eě]$/.test(word)) return word
      if (/a$/.test(word)) return `${word.slice(0, -1)}y`
      return word
    })
    .join(" ")

/** Modř → tyrkys podle `t` (0–1) — ornament přechází jako na předloze. */
const ornamentColor = (t: number): RGB => {
  const k = Math.min(1, Math.max(0, t))
  const mix = (a: number, b: number) => a + (b - a) * k
  return rgb(
    mix(INK.red, INK_TEAL.red),
    mix(INK.green, INK_TEAL.green),
    mix(INK.blue, INK_TEAL.blue)
  )
}

/**
 * Květinový ornament z předlohy — shluk pětilistých kvítků, u kraje větší
 * a sytě modré, ke středu drobnější a tyrkysové.
 *
 * Kvítek je pět kroužků kolem šestého: kresba se tím skládá ze samých
 * `drawCircle`, které pdf-lib vykreslí všude stejně — žádné otáčené elipsy
 * ani ručně psané SVG dráhy, kde by se chyba poznala až v hotovém PDF.
 *
 * Rozmístění je pseudonáhodné, ale se stálým semínkem: tentýž poukaz vyjde
 * pokaždé stejně. Jinak by se otisk souboru měnil při každém vystavení
 * a v úložišti by přibývaly kopie téhož poukazu.
 */
const drawOrnament = (
  page: PDFPage,
  options: { cx: number; cy: number; radius: number }
) => {
  const { cx, cy, radius } = options
  let seed = 20261030
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }

  const flower = (x: number, y: number, size: number, color: RGB) => {
    for (let petal = 0; petal < 5; petal++) {
      const angle = (petal / 5) * Math.PI * 2 + Math.PI / 10
      page.drawCircle({
        x: x + Math.cos(angle) * size * 1.05,
        y: y + Math.sin(angle) * size * 1.05,
        size: size * 0.62,
        color,
      })
    }
    page.drawCircle({ x, y, size: size * 0.42, color: CARD })
    page.drawCircle({ x, y, size: size * 0.22, color })
  }

  /* Čtyři prstence od středu ven; vnější je hustší a větší jako na kartičce. */
  const rings = [
    { r: 0.24, count: 5, size: 2.6 },
    { r: 0.48, count: 9, size: 3.4 },
    { r: 0.72, count: 13, size: 4.4 },
    { r: 0.95, count: 17, size: 5.2 },
  ]
  rings.forEach((ring, index) => {
    const offset = random() * Math.PI * 2
    for (let i = 0; i < ring.count; i++) {
      const angle = offset + (i / ring.count) * Math.PI * 2
      const jitter = 0.92 + random() * 0.16
      const x = cx + Math.cos(angle) * radius * ring.r * jitter
      const y = cy + Math.sin(angle) * radius * ring.r * jitter * 0.96
      /* Tyrkys dole a uvnitř, sytá modř nahoře a u kraje — jako na předloze. */
      const t = 0.75 - index * 0.2 + (0.5 - Math.sin(angle)) * 0.25
      flower(x, y, ring.size * (0.85 + random() * 0.3), ornamentColor(t))
    }
  })

  /* Drobné pupeny mezi kvítky — zahušťují shluk, ať nevypadá jako mřížka. */
  for (let i = 0; i < 26; i++) {
    const angle = random() * Math.PI * 2
    const distance = radius * (0.2 + random() * 0.85)
    page.drawCircle({
      x: cx + Math.cos(angle) * distance,
      y: cy + Math.sin(angle) * distance * 0.96,
      size: 0.9 + random() * 1.3,
      color: ornamentColor(random()),
    })
  }
}

/** Rozměr karty v bodech — poměr vytištěné kartičky 210 × 99 mm. */
const CARD_W = CONTENT_W
const CARD_H = Math.round(CARD_W * (99 / 210))

/**
 * Přední strana kartičky: nadpis, hodnota, dílna, kód a platnost, vpravo
 * ornament. Kreslí se do zadaného obdélníku, takže ji umí jak shrnující
 * jednostránkový poukaz, tak list k oboustrannému tisku — jedna kresba, aby
 * se obě podoby nemohly rozejít.
 */
const drawVoucherFront = (
  page: PDFPage,
  fonts: Fonts,
  input: GiftVoucherPdfInput,
  box: { x: number; y: number; w: number; h: number }
) => {
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    color: CARD,
    borderColor: HAIR,
    borderWidth: 0.6,
  })

  /*
   * Ornament vpravo. Střed i poloměr jsou odsazené tak, aby ani nejzazší
   * okvětní lístek nepřetekl přes okraj karty na podklad stránky — na
   * kartičce ornament do kraje splývá, tady by vypadal jako chyba tisku.
   */
  drawOrnament(page, {
    cx: box.x + box.w - box.h * 0.52,
    cy: box.y + box.h / 2,
    radius: box.h * 0.38,
  })

  const textX = box.x + 30
  const textW = box.w - box.h - 30
  let y = box.y + box.h - 42

  page.drawText("Dárkový poukaz", { x: textX, y, size: 24, font: fonts.bold, color: INK })
  y -= 27
  page.drawText("na nákup keramiky", { x: textX, y, size: 24, font: fonts.bold, color: INK })
  y -= 36
  page.drawText("v hodnotě", { x: textX, y, size: 15, font: fonts.bold, color: INK })
  page.drawText(input.value, {
    x: textX + fonts.bold.widthOfTextAtSize("v hodnotě", 15) + 12,
    y,
    size: 15,
    font: fonts.bold,
    color: INK,
  })

  y = box.y + 76
  const dilna = (input.sellerNameGenitive || "").trim() || dilnaGenitive(input.sellerName)
  for (const row of [
    `v keramické dílně ${dilna}`,
    input.sellerAddress,
    input.sellerPhone ? `tel.: ${input.sellerPhone}` : "",
  ].filter(Boolean)) {
    for (const part of wrap(row, fonts.regular, 10, textW)) {
      page.drawText(part, { x: textX, y, size: 10, font: fonts.regular, color: TEXT })
      y -= 14
    }
  }

  /* Kód a platnost — to, co vytištěná kartička nemá a elektronická mít musí. */
  page.drawText(input.code, { x: textX, y: box.y + 24, size: 15, font: fonts.bold, color: TEXT })
  page.drawText(`platí do ${input.validUntil}`, {
    x: textX + fonts.bold.widthOfTextAtSize(input.code, 15) + 14,
    y: box.y + 26,
    size: 9,
    font: fonts.regular,
    color: MUTED,
  })
}

/**
 * Rubová strana kartičky: komu, od koho, věnování a jak se poukaz uplatní.
 *
 * Má smysl jen u listu k tisku — na jednostránkovém poukazu tohle všechno
 * stojí pod kartou a nikdo nic neotáčí. Dlouhé věnování se tu nesmí
 * rozlézt přes okraj, takže se pod podlahou přestane kreslit.
 */
const drawVoucherBack = (
  page: PDFPage,
  fonts: Fonts,
  input: GiftVoucherPdfInput,
  box: { x: number; y: number; w: number; h: number }
) => {
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    color: CARD,
    borderColor: HAIR,
    borderWidth: 0.6,
  })

  const padX = 30
  const innerX = box.x + padX
  const innerW = box.w - padX * 2

  /*
   * Návod, jak poukaz uplatnit, se sází ZDOLA.
   *
   * Nahoře je věnování, které píše zákazník a může být dlouhé (až 500
   * znaků). Kdyby se kreslilo shora dolů a návod po něm, dlouhé věnování by
   * návod vytlačilo z kartičky — a bez něj je z poukazu jen papír s číslem.
   * Proto se nejdřív spočítá, kolik místa návod potřebuje, a věnování
   * dostane to, co zbude.
   */
  const bottom: Array<{ text: string; size: number; font: PDFFont; color: RGB }> = []
  const push = (text: string, size: number, font: PDFFont, color: RGB) => {
    for (const part of wrap(text, font, size, innerW)) {
      bottom.push({ text: part, size, font, color })
    }
  }
  push(
    `Kód ${input.code} zadejte v košíku do pole pro slevový kód; jeho hodnota se odečte od ceny nákupu. ` +
      "Uplatnit ho jde i přímo v dílně.",
    9.5,
    fonts.regular,
    TEXT
  )
  if (input.balance) {
    push(`Zbývá ${input.balance} z ${input.value}.`, 9.5, fonts.bold, TEXT)
  }
  if (input.remainderNote) {
    push(`Když nákup nedosáhne hodnoty poukazu, ${input.remainderNote}.`, 8.5, fonts.regular, MUTED)
  }
  push(`Poukaz platí do ${input.validUntil}.`, 8.5, fonts.regular, MUTED)

  const LEAD = 1.45
  const bottomH = bottom.reduce((sum, row) => sum + row.size * LEAD, 0) + 13
  /* Spodek karty: kontakt, nad ním návod — a teprve nad tím smí být věnování. */
  const bottomTop = box.y + 30 + bottomH
  const floor = bottomTop + 8
  let y = box.y + box.h - 34

  const line = (value: string, size: number, font: PDFFont, color: RGB, lead = LEAD) => {
    for (const part of wrap(value, font, size, innerW)) {
      if (y < floor) return
      page.drawText(part, { x: innerX, y, size, font, color })
      y -= size * lead
    }
  }
  const label = (value: string) => {
    if (y < floor) return
    page.drawText(value.toUpperCase(), {
      x: innerX,
      y,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
    })
    y -= 13
  }

  if (input.recipientName) {
    label("Pro")
    line(input.recipientName, 13, fonts.bold, TEXT)
    y -= 4
  }
  if (input.buyerName) {
    label("Od")
    line(input.buyerName, 11, fonts.regular, TEXT)
    y -= 4
  }
  if (input.dedication) {
    label("Věnování")
    line(input.dedication, 11, fonts.regular, TEXT, 1.5)
    y -= 4
  }

  if (input.recipientName || input.buyerName || input.dedication) {
    page.drawLine({
      start: { x: innerX, y: bottomTop + 2 },
      end: { x: innerX + innerW, y: bottomTop + 2 },
      thickness: 0.6,
      color: HAIR,
    })
  }

  /* Spodní blok: nadpis a za ním předpočítané řádky návodu. */
  y = bottomTop
  page.drawText("JAK POUKAZ UPLATNIT", {
    x: innerX,
    y,
    size: 7.5,
    font: fonts.regular,
    color: MUTED,
  })
  y -= 13
  for (const row of bottom) {
    page.drawText(row.text, { x: innerX, y, size: row.size, font: row.font, color: row.color })
    y -= row.size * LEAD
  }

  /* Kontakt dole, ať je karta použitelná i sama o sobě. */
  const contact = [input.sellerName, input.sellerPhone, input.sellerWeb]
    .filter(Boolean)
    .join("  ·  ")
  page.drawText(wrap(contact, fonts.regular, 8, innerW)[0] ?? "", {
    x: innerX,
    y: box.y + 18,
    size: 8,
    font: fonts.regular,
    color: MUTED,
  })
}

/**
 * Značky pro střih — čtyři rohy, krátké vlasové čárky kousek od karty.
 * Bez nich se karta na A4 stříhá od oka a hrana nikdy nesedí.
 */
const drawCropMarks = (
  page: PDFPage,
  box: { x: number; y: number; w: number; h: number }
) => {
  const gap = 6
  const len = 12
  const corners = [
    { x: box.x, y: box.y, sx: -1, sy: -1 },
    { x: box.x + box.w, y: box.y, sx: 1, sy: -1 },
    { x: box.x, y: box.y + box.h, sx: -1, sy: 1 },
    { x: box.x + box.w, y: box.y + box.h, sx: 1, sy: 1 },
  ]
  for (const corner of corners) {
    page.drawLine({
      start: { x: corner.x + corner.sx * gap, y: corner.y },
      end: { x: corner.x + corner.sx * (gap + len), y: corner.y },
      thickness: 0.5,
      color: HAIR,
    })
    page.drawLine({
      start: { x: corner.x, y: corner.y + corner.sy * gap },
      end: { x: corner.x, y: corner.y + corner.sy * (gap + len) },
      thickness: 0.5,
      color: HAIR,
    })
  }
}

const embedFonts = async (doc: PDFDocument): Promise<Fonts> => ({
  regular: await doc.embedFont(Buffer.from(SANSATION_REGULAR_BASE64, "base64"), { subset: true }),
  bold: await doc.embedFont(Buffer.from(SANSATION_BOLD_BASE64, "base64"), { subset: true }),
})

/** Když poukaz datum vzniku nenese, ať je aspoň stálé (viz `issuedAt`). */
const FALLBACK_STAMP = new Date("2026-10-30T00:00:00.000Z")

const setMeta = (doc: PDFDocument, input: GiftVoucherPdfInput, title: string) => {
  doc.setTitle(title)
  doc.setAuthor(input.sellerName)
  doc.setCreator("Keramická zahrada")
  doc.setProducer("Keramická zahrada")
  doc.setLanguage("cs-CZ")
  const issued = input.issuedAt ? new Date(input.issuedAt) : null
  const stamp = issued && !Number.isNaN(issued.getTime()) ? issued : FALLBACK_STAMP
  doc.setCreationDate(stamp)
  doc.setModificationDate(stamp)
}

/**
 * Poukaz k oboustrannému tisku — dvě stránky A4, na každé jedna strana
 * kartičky (30. 10. 2026, přání majitelky).
 *
 * Shrnující poukaz výš má kartu nahoře a pod ní vysvětlení pro kupujícího;
 * tenhle soubor je naopak rovnou dárek: vytisknout oboustranně, vystřihnout
 * podle značek a je z toho kartička s kódem, jakou má dílna vytištěnou.
 *
 * Karta je na obou stránkách přesně uprostřed — svisle i vodorovně. Tím
 * sedne rub na líc bez ohledu na to, jestli tiskárna otáčí po delší, nebo
 * po kratší hraně; kdyby byla jen vycentrovaná vodorovně, jedno z těch
 * dvou nastavení by rub posunulo.
 */
export const generateGiftVoucherPrintPdf = async (
  input: GiftVoucherPdfInput
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create({ updateMetadata: false })
  doc.registerFontkit(fontkit)
  const fonts = await embedFonts(doc)
  setMeta(doc, input, `Dárkový poukaz ${input.code} — k tisku`)

  const box = {
    x: (PAGE_W - CARD_W) / 2,
    y: (PAGE_H - CARD_H) / 2,
    w: CARD_W,
    h: CARD_H,
  }

  const front = doc.addPage([PAGE_W, PAGE_H])
  drawCropMarks(front, box)
  drawVoucherFront(front, fonts, input, box)

  const back = doc.addPage([PAGE_W, PAGE_H])
  drawCropMarks(back, box)
  drawVoucherBack(back, fonts, input, box)

  return doc.save({ useObjectStreams: false })
}

export const generateGiftVoucherPdf = async (
  input: GiftVoucherPdfInput
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create({ updateMetadata: false })
  doc.registerFontkit(fontkit)
  const fonts = await embedFonts(doc)
  setMeta(doc, input, `Dárkový poukaz ${input.code}`)

  const page: PDFPage = doc.addPage([PAGE_W, PAGE_H])
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER })

  /* ---- Karta (poměr vytištěné kartičky 210 × 99 mm) ---- */
  const cardX = MARGIN
  const cardY = PAGE_H - MARGIN - CARD_H
  drawVoucherFront(page, fonts, input, {
    x: cardX,
    y: cardY,
    w: CARD_W,
    h: CARD_H,
  })
  /* ---- Pod kartou: komu, od koho, věnování, jak uplatnit ---- */
  let y = cardY - 34
  /* Dlouhé věnování nesmí natéct do patičky — pod touhle hranicí se nekreslí. */
  const FLOOR = MARGIN + 70
  const line = (value: string, size: number, font: PDFFont, color: RGB, lead = 1.5) => {
    for (const part of wrap(value, font, size, CONTENT_W)) {
      if (y < FLOOR) return
      page.drawText(part, { x: MARGIN, y, size, font, color })
      y -= size * lead
    }
  }
  const label = (value: string) => {
    if (y < FLOOR) return
    page.drawText(value.toUpperCase(), { x: MARGIN, y, size: 8, font: fonts.regular, color: MUTED })
    y -= 16
  }

  if (input.recipientName || input.buyerName || input.dedication) {
    if (input.recipientName) {
      label("Pro")
      line(input.recipientName, 14, fonts.bold, TEXT)
      y -= 6
    }
    if (input.buyerName) {
      label("Od")
      line(input.buyerName, 12, fonts.regular, TEXT)
      y -= 6
    }
    if (input.dedication) {
      label("Věnování")
      line(input.dedication, 12, fonts.regular, TEXT, 1.6)
      y -= 6
    }
    if (y >= FLOOR) {
      page.drawLine({
        start: { x: MARGIN, y: y + 6 },
        end: { x: PAGE_W - MARGIN, y: y + 6 },
        thickness: 0.6,
        color: HAIR,
      })
    }
    y -= 20
  }

  label("Jak poukaz uplatnit")
  line(
    `Kód ${input.code} zadejte v košíku do pole pro slevový kód; jeho hodnota se odečte od ceny nákupu. ` +
      "Uplatnit ho jde i v dílně — stačí ho ukázat v telefonu nebo vytištěný.",
    11,
    fonts.regular,
    TEXT
  )
  y -= 8
  if (input.balance) {
    line(`Na poukazu zbývá ${input.balance} z ${input.value}.`, 11, fonts.bold, TEXT)
    y -= 4
  }
  if (input.remainderNote) {
    line(`Když nákup nedosáhne hodnoty poukazu, ${input.remainderNote}.`, 10.5, fonts.regular, MUTED)
    y -= 4
  }
  line(`Poukaz platí do ${input.validUntil}.`, 10.5, fonts.regular, MUTED)

  /* ---- Patička ---- */
  const footerY = MARGIN + 34
  page.drawLine({
    start: { x: MARGIN, y: footerY + 22 },
    end: { x: PAGE_W - MARGIN, y: footerY + 22 },
    thickness: 0.6,
    color: HAIR,
  })
  const contact = [input.sellerName, input.sellerPhone, input.sellerEmail, input.sellerWeb]
    .filter(Boolean)
    .join("  ·  ")
  page.drawText(contact, { x: MARGIN, y: footerY + 6, size: 9, font: fonts.regular, color: MUTED })
  if (input.voucherUrl) {
    page.drawText(wrap(input.voucherUrl, fonts.regular, 7.5, CONTENT_W)[0] ?? "", {
      x: MARGIN,
      y: footerY - 8,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
    })
  }

  return doc.save({ useObjectStreams: false })
}

/**
 * Údaje pro PDF z uloženého poukazu — jedno místo pro e-mail, administraci
 * i stránku poukazu, aby se tytéž tři cesty nerozešly v tom, co na poukazu
 * stojí. Fakta o prodávající se berou z Právních údajů (stejně jako je nese
 * web a dokumenty), ne z konstant v kódu.
 */
export const giftVoucherPdfInputFor = async (
  container: MedusaContainer,
  voucher: any
): Promise<GiftVoucherPdfInput> => {
  const { facts } = await getLegalFacts(container)
  const value = Number(voucher.initial_value)
  const balance = Number(voucher.balance)
  return {
    voucherId: String(voucher.id),
    code: formatVoucherCode(voucher.code),
    value: formatVoucherCzk(value),
    /* Zůstatek jen když se liší — na nedotčeném poukazu by to byl šum. */
    balance: balance < value ? formatVoucherCzk(balance) : null,
    validUntil: formatVoucherDate(voucher.valid_until),
    /* Datum vzniku poukazu, ne čas vystavení PDF — viz `issuedAt`. */
    issuedAt: voucher.created_at ? new Date(voucher.created_at).toISOString() : null,
    recipientName: voucher.recipient_name ?? null,
    buyerName: voucher.buyer_name ?? null,
    dedication: voucher.dedication ?? null,
    voucherUrl: giftVoucherLink(voucher.id) || null,
    sellerName: String(facts["seller.name"] ?? ""),
    sellerAddress: String(facts["seller.address"] ?? ""),
    sellerPhone: String(facts["seller.phone"] ?? ""),
    sellerEmail: String(facts["seller.email"] ?? ""),
    sellerWeb: String(facts["seller.web"] ?? ""),
    remainderNote: String(facts["voucher.remainder"] ?? "") || null,
  }
}

/** Název souboru ke stažení — bez diakritiky a bez mezer v kódu. */
export const giftVoucherPdfFilename = (code: string): string =>
  `darkovy-poukaz-${String(code).replace(/[^0-9A-Za-z-]/g, "")}.pdf`

/** Totéž pro list k oboustrannému tisku — poznat je musí na první pohled. */
export const giftVoucherPrintPdfFilename = (code: string): string =>
  `darkovy-poukaz-${String(code).replace(/[^0-9A-Za-z-]/g, "")}-k-tisku.pdf`

/**
 * Uloží poukaz do úložiště a vrátí přílohu e-mailu, nebo null.
 *
 * Stejně jako pozvánka na kurz: R2 umí pevný klíč, takže tentýž poukaz má
 * stálou adresu a podruhé se nenahrává. Lokální disk v sandboxu pevný klíč
 * neumí → obyčejný upload přes modul souborů.
 */
export const storeGiftVoucherPdf = async (
  container: MedusaContainer,
  input: GiftVoucherPdfInput,
  /** „print" = list k oboustrannému tisku; jinak shrnující poukaz. */
  variant: "summary" | "print" = "summary"
): Promise<EmailAttachmentRef | null> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const print = variant === "print"
  const filename = print
    ? giftVoucherPrintPdfFilename(input.code)
    : giftVoucherPdfFilename(input.code)
  const bytes = print
    ? await generateGiftVoucherPrintPdf(input)
    : await generateGiftVoucherPdf(input)
  const provider = resolveFixedKeyProvider(container)
  if (!provider) {
    const fileModule = container.resolve(Modules.FILE) as any
    const [file] = await fileModule.createFiles([
      {
        filename,
        mimeType: "application/pdf",
        content: Buffer.from(bytes).toString("base64"),
        access: "public",
      },
    ])
    if (!file?.url) {
      logger.warn(`[poukazy] PDF poukazu ${input.code} se nepodařilo uložit — e-mail půjde bez přílohy.`)
      return null
    }
    return { filename, url: file.url }
  }
  const safeId = String(input.voucherId).replace(/[^0-9A-Za-z_-]/g, "")
  const stem = print ? "poukaz-k-tisku" : "poukaz"
  const key = `gift-vouchers/${safeId}/${stem}-${sha256Hex(bytes).slice(0, 8)}.pdf`
  const url = (await provider.objectExistsAtKey(key))
    ? provider.publicUrlForKey(key)
    : (await provider.putObjectAtKey(key, bytes, "application/pdf")).url
  return { filename, url }
}
