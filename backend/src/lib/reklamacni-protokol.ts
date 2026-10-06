import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import {
  SANSATION_BOLD_BASE64,
  SANSATION_REGULAR_BASE64,
} from "./assets/protokol-fonts"

/**
 * Reklamační protokol jako PDF — zákonné písemné potvrzení (§ 19 z. č. 634/1992
 * Sb.): kdo, co, kdy a jaký nárok se uplatňuje, a po vyřízení i jak a kdy.
 *
 * pdf-lib + vložený český font (Sansation) — standardní WinAnsi fonty českou
 * diakritiku neumí. Vrací bajty PDF; uložení do úložiště a odkaz do e-mailu
 * řeší volající.
 */

const SELLER = {
  name: process.env.SELLER_NAME || "Keramická zahrada — Lucie Polanská",
  address: process.env.SELLER_ADDRESS || "Putim 229, 397 01 Písek",
  // Prázdné, dokud se nenastaví — na dokladu se pak IČO prostě nevypíše.
  ico: process.env.SELLER_ICO || "",
  email: process.env.SELLER_EMAIL || "info@keramickazahrada.cz",
  phone: process.env.SELLER_PHONE || "+420 775 211 578",
}

export const PROTOCOL_TITLE: Record<string, string> = {
  reklamace: "Reklamační protokol",
  vraceni: "Protokol o vrácení zboží",
  odstoupeni: "Protokol o odstoupení od smlouvy",
}

export const PROTOCOL_KIND_LABEL: Record<string, string> = {
  reklamace: "Reklamace (vada zboží)",
  vraceni: "Vrácení zboží",
  odstoupeni: "Odstoupení od smlouvy do 14 dnů (§ 1829)",
}

export type ProtocolData = {
  protocolNumber: string
  kind: "reklamace" | "vraceni" | "odstoupeni" | null
  orderDisplayId: string
  customerName: string | null
  email: string
  createdAt: Date
  /** Zákazníkův popis vady / důvodu (prostý text). */
  reason: string
  /** Které zboží, slovy zákazníka (volitelné). */
  items?: string | null
  /** Vyplněné až při vyřízení — jinak je to „potvrzení o uplatnění". */
  resolution?: {
    /** „Schváleno — vrácení peněz" / „Zamítnuto" apod. */
    outcome: string
    note?: string | null
    decidedAt: Date
  } | null
  /** Když se vracely peníze. */
  refund?: { amount: number; currency: string; method: string; at: Date } | null
}

const fmtDate = (value: Date) =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(value)

const toBytes = (b64: string): Uint8Array =>
  new Uint8Array(Buffer.from(b64, "base64"))

export const generateProtocolPdf = async (
  data: ProtocolData
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const regular = await doc.embedFont(toBytes(SANSATION_REGULAR_BASE64), {
    subset: true,
  })
  const bold = await doc.embedFont(toBytes(SANSATION_BOLD_BASE64), {
    subset: true,
  })

  const page: PDFPage = doc.addPage([595.28, 841.89]) // A4
  const margin = 56
  const contentWidth = page.getWidth() - margin * 2
  let y = page.getHeight() - margin

  const ink = rgb(0.11, 0.11, 0.09)
  const muted = rgb(0.42, 0.42, 0.38)
  const hair = rgb(0.8, 0.8, 0.78)

  const text = (
    value: string,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number } = {}
  ) => {
    const { font = regular, size = 10.5, color = ink, gap = 5 } = opts
    const words = String(value ?? "").split(/\s+/).filter((w) => w.length)
    let current = ""
    const flush = (t: string) => {
      page.drawText(t, { x: margin, y, size, font, color })
      y -= size + gap
    }
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) > contentWidth && current) {
        flush(current)
        current = word
      } else {
        current = candidate
      }
    }
    flush(current)
  }

  const space = (h = 8) => {
    y -= h
  }
  const rule = () => {
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: margin + contentWidth, y: y + 4 },
      thickness: 0.5,
      color: hair,
    })
    y -= 10
  }
  const field = (label: string, value: string) => {
    page.drawText(label.toUpperCase(), {
      x: margin,
      y,
      size: 8,
      font: regular,
      color: muted,
    })
    y -= 12
    text(value || "—", { size: 11, gap: 4 })
    space(4)
  }

  // ── Hlavička ──────────────────────────────────────────────────────────────
  text(PROTOCOL_TITLE[data.kind ?? "reklamace"] ?? "Protokol o žádosti", {
    font: bold,
    size: 18,
    gap: 4,
  })
  text(`č. ${data.protocolNumber}`, { color: muted, size: 10, gap: 12 })
  rule()

  // ── Strany ────────────────────────────────────────────────────────────────
  text("Prodávající", { font: bold, size: 11, gap: 4 })
  text(SELLER.name, { size: 10.5, gap: 3 })
  text(SELLER.address, { size: 10.5, gap: 3 })
  if (SELLER.ico) text(`IČO: ${SELLER.ico}`, { size: 10.5, gap: 3 })
  text(`${SELLER.email} · ${SELLER.phone}`, { size: 10, color: muted, gap: 3 })
  space(10)

  text("Kupující", { font: bold, size: 11, gap: 4 })
  if (data.customerName) text(data.customerName, { size: 10.5, gap: 3 })
  text(data.email, { size: 10.5, gap: 3 })
  space(8)
  rule()

  // ── Uplatnění ─────────────────────────────────────────────────────────────
  field("Objednávka", `#${data.orderDisplayId}`)
  field("Druh žádosti", PROTOCOL_KIND_LABEL[data.kind ?? ""] ?? "Žádost o vrácení")
  field("Datum uplatnění", fmtDate(data.createdAt))
  field("Popis / důvod", data.reason)
  if (data.items) field("Zboží", data.items)

  // ── Vyřízení ──────────────────────────────────────────────────────────────
  if (data.resolution) {
    rule()
    text("Vyřízení", { font: bold, size: 11, gap: 6 })
    field("Způsob vyřízení", data.resolution.outcome)
    field("Datum vyřízení", fmtDate(data.resolution.decidedAt))
    if (data.resolution.note) field("Poznámka", data.resolution.note)
  }
  if (data.refund) {
    field(
      "Vrácená částka",
      `${new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currency: (data.refund.currency || "CZK").toUpperCase(),
        maximumFractionDigits: 0,
      }).format(data.refund.amount)} (${
        data.refund.method === "comgate" ? "na platební kartu" : "ručně"
      }, ${fmtDate(data.refund.at)})`
    )
  }

  // ── Zákonná poznámka ──────────────────────────────────────────────────────
  space(10)
  const legal =
    data.kind === "reklamace"
      ? "Reklamace se vyřizuje bez zbytečného odkladu, nejpozději do 30 dnů od uplatnění (§ 19 zákona č. 634/1992 Sb., o ochraně spotřebitele), nedohodnou-li se strany jinak."
      : "Při odstoupení od smlouvy vrátí prodávající všechny přijaté peněžní prostředky do 14 dnů (§ 1832 občanského zákoníku); u zboží vyrobeného na míru nelze od smlouvy odstoupit (§ 1837)."
  text(legal, { size: 9, color: muted, gap: 4 })

  // ── Podpisy ───────────────────────────────────────────────────────────────
  space(34)
  const colW = contentWidth / 2 - 14
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + colW, y },
    thickness: 0.5,
    color: muted,
  })
  page.drawLine({
    start: { x: margin + contentWidth - colW, y },
    end: { x: margin + contentWidth, y },
    thickness: 0.5,
    color: muted,
  })
  y -= 12
  page.drawText("Prodávající", { x: margin, y, size: 9, font: regular, color: muted })
  page.drawText("Kupující", {
    x: margin + contentWidth - colW,
    y,
    size: 9,
    font: regular,
    color: muted,
  })

  return await doc.save()
}

/** Číslo protokolu z druhu, roku a čísla objednávky. */
export const protocolNumberFor = (
  kind: string | null,
  orderDisplayId: string,
  when: Date = new Date()
): string => {
  const prefix =
    kind === "odstoupeni" ? "ODS" : kind === "vraceni" ? "VRA" : "REK"
  return `${prefix}-${when.getFullYear()}-${orderDisplayId}`
}

/**
 * Vygeneruje protokol a uloží ho do úložiště (MinIO) — vrátí veřejné URL a číslo.
 * Chyba úložiště žádost neshodí (vrátí `url: null`); volající pak jen nedoplní
 * odkaz. Volá se při uplatnění (bez `resolution`) i při vyřízení (s ním).
 */
export const buildAndStoreProtocol = async (
  container: MedusaContainer,
  data: ProtocolData
): Promise<{ url: string | null; number: string }> => {
  try {
    const bytes = await generateProtocolPdf(data)
    const base64 = Buffer.from(bytes).toString("base64")
    const fileModule = container.resolve(Modules.FILE)
    const [uploaded] = await fileModule.createFiles([
      {
        filename: `Protokol-${data.protocolNumber}.pdf`,
        mimeType: "application/pdf",
        content: base64,
        access: "public" as const,
      },
    ])
    return { url: (uploaded as any)?.url ?? null, number: data.protocolNumber }
  } catch {
    return { url: null, number: data.protocolNumber }
  }
}
