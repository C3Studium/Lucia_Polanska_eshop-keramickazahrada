import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import {
  SANSATION_BOLD_BASE64,
  SANSATION_REGULAR_BASE64,
} from "./assets/protokol-fonts"
import type { LegalFactValues } from "./legal-facts"
import { intlLocale, pick, type EmailLocale, type Localized } from "./email-locale"
import { getLegalFacts } from "./merchant-settings"

/**
 * Reklamační protokol jako PDF — zákonné písemné potvrzení (§ 19 z. č. 634/1992
 * Sb.): kdo, co, kdy a jaký nárok se uplatňuje, a po vyřízení i jak a kdy.
 *
 * pdf-lib + vložený český font (Sansation) — standardní WinAnsi fonty českou
 * diakritiku neumí. Vrací bajty PDF; uložení do úložiště a odkaz do e-mailu
 * řeší volající.
 */

export type ProtocolSeller = {
  name: string
  address: string
  /** Prázdné = na dokladu se IČO nevypíše. */
  ico: string
  email: string
  phone: string
}

/** Záloha, když právní údaje nejde přečíst (nebo údaj chybí). */
const FALLBACK_SELLER: ProtocolSeller = {
  name: process.env.SELLER_NAME || "Keramická zahrada — Lucie Polanská",
  address: process.env.SELLER_ADDRESS || "Putim 229, 397 01 Písek",
  // Prázdné, dokud se nenastaví — na dokladu se pak IČO prostě nevypíše.
  ico: process.env.SELLER_ICO || "",
  email: process.env.SELLER_EMAIL || "info@keramickazahrada.cz",
  phone: process.env.SELLER_PHONE || "+420 775 211 578",
}

/**
 * Prodávající na protokolu — z právních údajů (administrace → Právní údaje),
 * stejně jako v obchodních podmínkách a reklamačním řádu. Doklad musí mít
 * prodávajícího celého, takže nevyplněný údaj spadne na zálohu.
 */
export const protocolSeller = (
  facts?: Partial<LegalFactValues> | null
): ProtocolSeller => ({
  name: facts?.["seller.name"] || FALLBACK_SELLER.name,
  address: facts?.["seller.address"] || FALLBACK_SELLER.address,
  ico: facts?.["seller.ico"] || FALLBACK_SELLER.ico,
  email: facts?.["seller.email"] || FALLBACK_SELLER.email,
  phone: facts?.["seller.phone"] || FALLBACK_SELLER.phone,
})

export const PROTOCOL_TITLE: Record<string, string> = {
  reklamace: "Reklamační protokol",
  vraceni: "Protokol o vrácení zboží",
  odstoupeni: "Protokol o odstoupení od smlouvy",
  // Zrušení zakázky podle OP (LEGAL_AUDIT.md § 0, Z4–Z6) — není to odstoupení.
  zruseni_zakazky: "Protokol o zrušení zakázky",
}

export const PROTOCOL_KIND_LABEL: Record<string, string> = {
  reklamace: "Reklamace (vada zboží)",
  vraceni: "Vrácení zboží",
  odstoupeni: "Odstoupení od smlouvy do 14 dnů (§ 1829)",
  zruseni_zakazky: "Zrušení zakázky (obchodní podmínky, čl. Výroba na zakázku)",
}

/**
 * Popisky protokolu v jazyce objednávky (lib/email-locale).
 *
 * Protokol je generovaný záznam — popisky, údaje žádosti a jedna zákonná
 * poznámka —, ne právní dokument jako reklamační řád. Zákazník ze Slovenska,
 * Polska či Německa mu proto má rozumět. Čeština je původní znění (tabulky
 * `PROTOCOL_TITLE` a `PROTOCOL_KIND_LABEL` výš zůstávají její jedinou
 * kopií); odkazy na paragrafy jsou na české předpisy, v cizím jazyce
 * s výslovným „českého…", ať je jasné, čí zákon to je.
 */
type ProtocolCopy = {
  titles: Record<string, string>
  kinds: Record<string, string>
  fallbackTitle: string
  fallbackKind: string
  confirmationPrefix: string
  numberPrefix: string
  seller: string
  buyer: string
  order: string
  kind: string
  submittedAt: string
  reason: string
  goods: string
  damageCause: string
  requested: string
  resolutionHeading: string
  decisionHeading: string
  resolution: string
  resolvedAt: string
  decidedAt: string
  note: string
  refundLines: string
  creditNote: string
  refundAmount: string
  refundTotal: string
  methodCard: string
  methodTransfer: string
  legalResolvedClaim: string
  legalResolvedOther: string
  legalOpenClaim: string
  legalOpenOther: string
}

const PROTOCOL_COPY: Localized<ProtocolCopy> = {
  cs: {
    titles: PROTOCOL_TITLE,
    kinds: PROTOCOL_KIND_LABEL,
    fallbackTitle: "Protokol o žádosti",
    fallbackKind: "Žádost o vrácení",
    confirmationPrefix: "Potvrzení o vyřízení",
    numberPrefix: "č.",
    seller: "Prodávající",
    buyer: "Kupující",
    order: "Objednávka",
    kind: "Druh žádosti",
    submittedAt: "Datum uplatnění",
    reason: "Popis / důvod",
    goods: "Zboží",
    damageCause: "Příčina poškození",
    requested: "Požadovaný způsob vyřízení",
    resolutionHeading: "Vyřízení",
    decisionHeading: "Rozhodnutí",
    resolution: "Způsob vyřízení",
    resolvedAt: "Datum vyřízení",
    decidedAt: "Datum rozhodnutí",
    note: "Poznámka",
    refundLines: "Vrácené položky",
    creditNote: "Dobropis",
    refundAmount: "Vrácená částka",
    refundTotal: "Vráceno celkem",
    methodCard: "na platební kartu přes ComGate",
    methodTransfer: "převodem na bankovní účet",
    legalResolvedClaim:
      "Toto je písemné potvrzení o datu a způsobu vyřízení reklamace (§ 19 odst. 3 zákona č. 634/1992 Sb., o ochraně spotřebitele). Nesouhlasíte-li s vyřízením, můžete se obrátit na Českou obchodní inspekci (www.coi.cz), případně na soud.",
    legalResolvedOther:
      "Toto je písemné potvrzení o vyřízení odstoupení od smlouvy / vrácení zboží. Přijaté peněžní prostředky se vrací do 14 dnů (§ 1832 občanského zákoníku), přičemž prodávající smí vyčkat na vrácení zboží (§ 1832 odst. 4).",
    legalOpenClaim:
      "Reklamace se vyřizuje bez zbytečného odkladu, nejpozději do 30 dnů od uplatnění (§ 19 zákona č. 634/1992 Sb., o ochraně spotřebitele), nedohodnou-li se strany jinak.",
    legalOpenOther:
      "Při odstoupení od smlouvy vrátí prodávající všechny přijaté peněžní prostředky do 14 dnů (§ 1832 občanského zákoníku); u zboží vyrobeného na míru nelze od smlouvy odstoupit (§ 1837).",
  },
  sk: {
    titles: {
      reklamace: "Reklamačný protokol",
      vraceni: "Protokol o vrátení tovaru",
      odstoupeni: "Protokol o odstúpení od zmluvy",
      zruseni_zakazky: "Protokol o zrušení zákazky",
    },
    kinds: {
      reklamace: "Reklamácia (vada tovaru)",
      vraceni: "Vrátenie tovaru",
      odstoupeni: "Odstúpenie od zmluvy do 14 dní (§ 1829 českého Občianskeho zákonníka a čl. 9 smernice 2011/83/EÚ)",
      zruseni_zakazky: "Zrušenie zákazky (obchodné podmienky, čl. Výroba na zákazku)",
    },
    fallbackTitle: "Protokol o žiadosti",
    fallbackKind: "Žiadosť o vrátenie",
    confirmationPrefix: "Potvrdenie o vybavení",
    numberPrefix: "č.",
    seller: "Predávajúci",
    buyer: "Kupujúci",
    order: "Objednávka",
    kind: "Druh žiadosti",
    submittedAt: "Dátum uplatnenia",
    reason: "Popis / dôvod",
    goods: "Tovar",
    damageCause: "Príčina poškodenia",
    requested: "Požadovaný spôsob vybavenia",
    resolutionHeading: "Vybavenie",
    decisionHeading: "Rozhodnutie",
    resolution: "Spôsob vybavenia",
    resolvedAt: "Dátum vybavenia",
    decidedAt: "Dátum rozhodnutia",
    note: "Poznámka",
    refundLines: "Vrátené položky",
    creditNote: "Dobropis",
    refundAmount: "Vrátená suma",
    refundTotal: "Vrátené spolu",
    methodCard: "na platobnú kartu cez ComGate",
    methodTransfer: "prevodom na bankový účet",
    legalResolvedClaim:
      "Toto je písomné potvrdenie o dátume a spôsobe vybavenia reklamácie (§ 19 ods. 3 českého zákona č. 634/1992 Zb., o ochrane spotrebiteľa). Ak nesúhlasíte s vybavením, môžete sa obrátiť na Českú obchodnú inšpekciu (www.coi.cz), prípadne na súd.",
    legalResolvedOther:
      "Toto je písomné potvrdenie o vybavení odstúpenia od zmluvy / vrátenia tovaru. Prijaté peňažné prostriedky sa vracajú do 14 dní (§ 1832 českého Občianskeho zákonníka a čl. 13 smernice 2011/83/EÚ), pričom predávajúci môže počkať na vrátenie tovaru (§ 1832 ods. 4 českého Občianskeho zákonníka a čl. 13 ods. 3 smernice 2011/83/EÚ).",
    legalOpenClaim:
      "Reklamácia sa vybavuje bez zbytočného odkladu, najneskôr do 30 dní od uplatnenia (§ 19 českého zákona č. 634/1992 Zb., o ochrane spotrebiteľa), ak sa strany nedohodnú inak.",
    legalOpenOther:
      "Pri odstúpení od zmluvy vráti predávajúci všetky prijaté peňažné prostriedky do 14 dní (§ 1832 českého Občianskeho zákonníka a čl. 13 smernice 2011/83/EÚ); pri tovare vyrobenom na mieru nemožno od zmluvy odstúpiť (§ 1837 písm. d) českého Občianskeho zákonníka a čl. 16 písm. c) smernice 2011/83/EÚ).",
  },
  pl: {
    titles: {
      reklamace: "Protokół reklamacyjny",
      vraceni: "Protokół zwrotu towaru",
      odstoupeni: "Protokół odstąpienia od umowy",
      zruseni_zakazky: "Protokół anulowania zamówienia indywidualnego",
    },
    kinds: {
      reklamace: "Reklamacja (wada towaru)",
      vraceni: "Zwrot towaru",
      odstoupeni: "Odstąpienie od umowy w ciągu 14 dni (§ 1829 czeskiego kodeksu cywilnego oraz art. 9 dyrektywy 2011/83/UE)",
      zruseni_zakazky: "Anulowanie zamówienia indywidualnego (regulamin, art. Wykonanie na zamówienie)",
    },
    fallbackTitle: "Protokół wniosku",
    fallbackKind: "Wniosek o zwrot",
    confirmationPrefix: "Potwierdzenie rozpatrzenia",
    numberPrefix: "nr",
    seller: "Sprzedawca",
    buyer: "Kupujący",
    order: "Zamówienie",
    kind: "Rodzaj zgłoszenia",
    submittedAt: "Data złożenia",
    reason: "Opis / powód",
    goods: "Towar",
    damageCause: "Przyczyna uszkodzenia",
    requested: "Żądany sposób rozpatrzenia",
    resolutionHeading: "Rozpatrzenie",
    decisionHeading: "Decyzja",
    resolution: "Sposób załatwienia",
    resolvedAt: "Data załatwienia",
    decidedAt: "Data decyzji",
    note: "Uwaga",
    refundLines: "Zwrócone pozycje",
    creditNote: "Faktura korygująca",
    refundAmount: "Zwrócona kwota",
    refundTotal: "Zwrócono łącznie",
    methodCard: "na kartę płatniczą przez ComGate",
    methodTransfer: "przelewem na rachunek bankowy",
    legalResolvedClaim:
      "Niniejszy dokument jest pisemnym potwierdzeniem daty i sposobu rozpatrzenia reklamacji (§ 19 ust. 3 czeskiej ustawy nr 634/1992 Sb. o ochronie konsumentów). Jeśli nie zgadzają się Państwo z rozstrzygnięciem, mogą Państwo zwrócić się do Czeskiej Inspekcji Handlowej (www.coi.cz) lub do sądu.",
    legalResolvedOther:
      "Niniejszy dokument jest pisemnym potwierdzeniem załatwienia odstąpienia od umowy / zwrotu towaru. Otrzymane środki pieniężne zwraca się w ciągu 14 dni (§ 1832 czeskiego kodeksu cywilnego oraz art. 13 dyrektywy 2011/83/UE), przy czym sprzedawca może wstrzymać się ze zwrotem do chwili otrzymania towaru (§ 1832 ust. 4 czeskiego kodeksu cywilnego oraz art. 13 ust. 3 dyrektywy 2011/83/UE).",
    legalOpenClaim:
      "Reklamację rozpatruje się bez zbędnej zwłoki, najpóźniej w ciągu 30 dni od jej złożenia (§ 19 czeskiej ustawy nr 634/1992 Sb. o ochronie konsumentów), chyba że strony uzgodnią inaczej.",
    legalOpenOther:
      "W razie odstąpienia od umowy sprzedawca zwraca wszystkie otrzymane środki pieniężne w ciągu 14 dni (§ 1832 czeskiego kodeksu cywilnego oraz art. 13 dyrektywy 2011/83/UE); od umowy dotyczącej towaru wykonanego na zamówienie nie można odstąpić (§ 1837 lit. d) czeskiego kodeksu cywilnego oraz art. 16 lit. c) dyrektywy 2011/83/UE).",
  },
  de: {
    titles: {
      reklamace: "Reklamationsprotokoll",
      vraceni: "Protokoll über die Rücksendung der Ware",
      odstoupeni: "Widerrufsprotokoll",
      zruseni_zakazky: "Protokoll über die Stornierung der Auftragsarbeit",
    },
    kinds: {
      reklamace: "Reklamation (Mangel der Ware)",
      vraceni: "Rücksendung der Ware",
      odstoupeni: "Widerruf innerhalb von 14 Tagen (§ 1829 des tschechischen Bürgerlichen Gesetzbuchs und Art. 9 der Richtlinie 2011/83/EU)",
      zruseni_zakazky: "Stornierung der Auftragsarbeit (AGB, Abschnitt Anfertigung auf Bestellung)",
    },
    fallbackTitle: "Protokoll zur Anfrage",
    fallbackKind: "Erstattungsanfrage",
    confirmationPrefix: "Bestätigung der Erledigung",
    numberPrefix: "Nr.",
    seller: "Verkäuferin",
    buyer: "Käufer",
    order: "Bestellung",
    kind: "Art der Anfrage",
    submittedAt: "Datum der Geltendmachung",
    reason: "Beschreibung / Grund",
    goods: "Ware",
    damageCause: "Ursache der Beschädigung",
    requested: "Gewünschte Art der Erledigung",
    resolutionHeading: "Erledigung",
    decisionHeading: "Entscheidung",
    resolution: "Art der Erledigung",
    resolvedAt: "Datum der Erledigung",
    decidedAt: "Datum der Entscheidung",
    note: "Anmerkung",
    refundLines: "Erstattete Positionen",
    creditNote: "Gutschrift",
    refundAmount: "Erstatteter Betrag",
    refundTotal: "Insgesamt erstattet",
    methodCard: "auf die Zahlungskarte über ComGate",
    methodTransfer: "per Überweisung auf das Bankkonto",
    legalResolvedClaim:
      "Dies ist die schriftliche Bestätigung über Datum und Art der Erledigung der Reklamation (§ 19 Abs. 3 des tschechischen Gesetzes Nr. 634/1992 Slg. über den Verbraucherschutz). Wenn Sie mit der Erledigung nicht einverstanden sind, können Sie sich an die Tschechische Handelsinspektion (www.coi.cz) oder an ein Gericht wenden.",
    legalResolvedOther:
      "Dies ist die schriftliche Bestätigung über die Erledigung des Widerrufs / der Rücksendung. Erhaltene Zahlungen werden innerhalb von 14 Tagen erstattet (§ 1832 des tschechischen Bürgerlichen Gesetzbuchs und Art. 13 der Richtlinie 2011/83/EU); die Verkäuferin darf die Erstattung verweigern, bis sie die Ware zurückerhalten hat (§ 1832 Abs. 4 des tschechischen Bürgerlichen Gesetzbuchs und Art. 13 Abs. 3 der Richtlinie 2011/83/EU).",
    legalOpenClaim:
      "Die Reklamation wird ohne unnötige Verzögerung erledigt, spätestens innerhalb von 30 Tagen nach ihrer Geltendmachung (§ 19 des tschechischen Gesetzes Nr. 634/1992 Slg. über den Verbraucherschutz), sofern die Parteien nichts anderes vereinbaren.",
    legalOpenOther:
      "Beim Widerruf erstattet die Verkäuferin alle erhaltenen Zahlungen innerhalb von 14 Tagen (§ 1832 des tschechischen Bürgerlichen Gesetzbuchs und Art. 13 der Richtlinie 2011/83/EU); bei Waren, die nach Kundenvorgaben angefertigt werden, besteht kein Widerrufsrecht (§ 1837 Buchst. d des tschechischen Bürgerlichen Gesetzbuchs und Art. 16 Buchst. c der Richtlinie 2011/83/EU).",
  },
  en: {
    titles: {
      reklamace: "Complaint record",
      vraceni: "Record of returned goods",
      odstoupeni: "Record of withdrawal from the contract",
      zruseni_zakazky: "Record of commission cancellation",
    },
    kinds: {
      reklamace: "Complaint (defective goods)",
      vraceni: "Return of goods",
      odstoupeni:
        "Withdrawal from the contract within 14 days (Section 1829 of the Czech Civil Code and Article 9 of Directive 2011/83/EU)",
      zruseni_zakazky: "Cancellation of a commission (Terms and Conditions, section Made to order)",
    },
    fallbackTitle: "Request record",
    fallbackKind: "Refund request",
    confirmationPrefix: "Confirmation of settlement",
    numberPrefix: "No.",
    seller: "Seller",
    buyer: "Buyer",
    order: "Order",
    kind: "Type of request",
    submittedAt: "Date submitted",
    reason: "Description / reason",
    goods: "Goods",
    damageCause: "Cause of damage",
    requested: "Requested remedy",
    resolutionHeading: "Settlement",
    decisionHeading: "Decision",
    resolution: "How it was settled",
    resolvedAt: "Date settled",
    decidedAt: "Date of decision",
    note: "Note",
    refundLines: "Refunded items",
    creditNote: "Credit note",
    refundAmount: "Amount refunded",
    refundTotal: "Total refunded",
    methodCard: "to the payment card via ComGate",
    methodTransfer: "by bank transfer",
    legalResolvedClaim:
      "This is written confirmation of the date and manner in which the complaint was settled (Section 19(3) of Czech Act No. 634/1992 Coll., on Consumer Protection). If you disagree with the outcome, you may contact the Czech Trade Inspection Authority (www.coi.cz) or the courts.",
    legalResolvedOther:
      "This is written confirmation that the withdrawal from the contract / return of goods has been settled. Payments received are refunded within 14 days (Section 1832 of the Czech Civil Code and Article 13 of Directive 2011/83/EU); the seller may withhold the refund until the goods have been received back (Section 1832(4) of the Czech Civil Code and Article 13(3) of Directive 2011/83/EU).",
    legalOpenClaim:
      "A complaint is settled without undue delay and no later than 30 days after it was made (Section 19 of Czech Act No. 634/1992 Coll., on Consumer Protection), unless the parties agree otherwise.",
    legalOpenOther:
      "On withdrawal from the contract, the seller refunds all payments received within 14 days (Section 1832 of the Czech Civil Code and Article 13 of Directive 2011/83/EU); there is no right of withdrawal for goods made to the consumer's specifications (Section 1837(d) of the Czech Civil Code and Article 16(c) of Directive 2011/83/EU).",
  },
}

export type ProtocolData = {
  /**
   * Jazyk protokolu = jazyk objednávky (lib/email-locale). Bez něj česky.
   * Hodnoty (způsob vyřízení, položky, příčina) skládá volající v témže
   * jazyce; volný text zákazníka a majitelky jde, jak byl napsán.
   */
  locale?: EmailLocale | null
  protocolNumber: string
  kind: "reklamace" | "vraceni" | "odstoupeni" | "zruseni_zakazky" | null
  orderDisplayId: string
  customerName: string | null
  email: string
  createdAt: Date
  /** Zákazníkův popis vady / důvodu (prostý text). */
  reason: string
  /**
   * Které zboží — formátovaný seznam z `line_items` (řádek za položku,
   * oddělené `\n`), nebo slova zákazníka u starých žádostí (volitelné).
   */
  items?: string | null
  /**
   * Věta „Příčina poškození" (§11.3 dopravce, §13.7 poškozený kus) — hotový
   * text z `damageCauseSentence`, tiskne se doslova; null = běžná vada.
   */
  damageCause?: string | null
  /** Co zákazník POŽADUJE (jen reklamace, §19/1 ZOS) — český popisek. */
  requestedResolution?: string | null
  /** Vyplněné až při vyřízení — jinak je to „potvrzení o uplatnění". */
  resolution?: {
    /** „Schváleno — vrácení peněz" / „Zamítnuto" apod. */
    outcome: string
    note?: string | null
    decidedAt: Date
  } | null
  /** Když se vracely peníze — jedna položka (zpětná kompatibilita). */
  refund?: ProtocolRefund | null
  /** Všechny refundace (částečné a opakované) — řádek za každou. */
  refunds?: ProtocolRefund[] | null
  /**
   * „Potvrzení o vyřízení" (§19/3 ZOS): hlavička to řekne, zákonná poznámka
   * mluví o vyřízení, ne o lhůtě. Bez něj je to potvrzení o uplatnění, případně
   * s rozhodnutím.
   */
  confirmation?: boolean
}

export type ProtocolRefund = {
  amount: number
  currency: string
  method: string
  at: Date
  note?: string | null
  /** Řádky košíku vrácení (§13.2) — „název · ks · částka", každý zvlášť. */
  lines?: string[] | null
  /** Číslo dobropisu k této refundaci (§13.3), nebo věta, proč není. */
  creditNote?: string | null
}

const fmtDate = (value: Date, locale?: EmailLocale | null) =>
  new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(value)

const toBytes = (b64: string): Uint8Array =>
  new Uint8Array(Buffer.from(b64, "base64"))

export const generateProtocolPdf = async (
  data: ProtocolData,
  seller: ProtocolSeller = protocolSeller()
): Promise<Uint8Array> => {
  const locale = data.locale ?? null
  const copy = pick(locale, PROTOCOL_COPY)
  const intl = intlLocale(locale)
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
  // Hodnota s `\n` (seznam položek) jde řádek po řádku — `text()` láme jen
  // podle šířky a konec řádku by jinak splynul s dalším.
  const field = (label: string, value: string) => {
    page.drawText(label.toUpperCase(), {
      x: margin,
      y,
      size: 8,
      font: regular,
      color: muted,
    })
    y -= 12
    const lines = String(value || "—")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length)
    for (const line of lines.length ? lines : ["—"]) {
      text(line, { size: 11, gap: 4 })
    }
    space(4)
  }

  // ── Hlavička ──────────────────────────────────────────────────────────────
  const title = copy.titles[data.kind ?? "reklamace"] ?? copy.fallbackTitle
  text(data.confirmation ? `${copy.confirmationPrefix} — ${title}` : title, {
    font: bold,
    size: data.confirmation ? 16 : 18,
    gap: 4,
  })
  text(`${copy.numberPrefix} ${data.protocolNumber}`, { color: muted, size: 10, gap: 12 })
  rule()

  // ── Strany ────────────────────────────────────────────────────────────────
  text(copy.seller, { font: bold, size: 11, gap: 4 })
  text(seller.name, { size: 10.5, gap: 3 })
  text(seller.address, { size: 10.5, gap: 3 })
  if (seller.ico) text(`IČO: ${seller.ico}`, { size: 10.5, gap: 3 })
  text([seller.email, seller.phone].filter(Boolean).join(" · "), {
    size: 10,
    color: muted,
    gap: 3,
  })
  space(10)

  text(copy.buyer, { font: bold, size: 11, gap: 4 })
  if (data.customerName) text(data.customerName, { size: 10.5, gap: 3 })
  text(data.email, { size: 10.5, gap: 3 })
  space(8)
  rule()

  // ── Uplatnění ─────────────────────────────────────────────────────────────
  field(copy.order, `#${data.orderDisplayId}`)
  field(copy.kind, copy.kinds[data.kind ?? ""] ?? copy.fallbackKind)
  field(copy.submittedAt, fmtDate(data.createdAt, locale))
  field(copy.reason, data.reason)
  if (data.items) field(copy.goods, data.items)
  // Příčina poškození: u dopravce musí být vidět, že reklamaci u České pošty
  // podává příjemce (12. 10. 2026, Matěj); u poškozeného kusu, že důkazem
  // jsou fotky. Věta přichází hotová (`damageCauseSentence`), ať PDF nic
  // neskládá.
  if (data.damageCause) {
    field(copy.damageCause, data.damageCause)
  }
  if (data.requestedResolution) {
    field(copy.requested, data.requestedResolution)
  }

  // ── Vyřízení ──────────────────────────────────────────────────────────────
  if (data.resolution) {
    rule()
    text(data.confirmation ? copy.resolutionHeading : copy.decisionHeading, {
      font: bold,
      size: 11,
      gap: 6,
    })
    field(copy.resolution, data.resolution.outcome)
    field(
      data.confirmation ? copy.resolvedAt : copy.decidedAt,
      fmtDate(data.resolution.decidedAt, locale)
    )
    if (data.resolution.note) field(copy.note, data.resolution.note)
  }
  // Refundace — každá na vlastním řádku (částečné a opakované vrácení, §1833).
  const refunds: ProtocolRefund[] = [
    ...(data.refunds ?? []),
    ...(data.refund && !(data.refunds ?? []).length ? [data.refund] : []),
  ]
  const fmtRefund = (refund: ProtocolRefund) =>
    `${new Intl.NumberFormat(intl, {
      style: "currency",
      currency: (refund.currency || "CZK").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(refund.amount)} (${
      refund.method === "comgate" ? copy.methodCard : copy.methodTransfer
    }, ${fmtDate(refund.at, locale)})${refund.note ? ` — ${refund.note}` : ""}`
  // Košík vrácení (§13.2) a dobropis (§13.3) pod každou refundací — potvrzení
  // musí říkat „za co" a „jakým dokladem", ne jen kolik.
  const refundDetails = (refund: ProtocolRefund) => {
    if (refund.lines?.length) {
      field(copy.refundLines, refund.lines.join("\n"))
    }
    if (refund.creditNote) {
      field(copy.creditNote, refund.creditNote)
    }
  }
  if (refunds.length === 1) {
    field(copy.refundAmount, fmtRefund(refunds[0]))
    refundDetails(refunds[0])
  } else if (refunds.length > 1) {
    refunds.forEach((refund, index) => {
      field(`${copy.refundAmount} ${index + 1}`, fmtRefund(refund))
      refundDetails(refund)
    })
    const total = refunds.reduce((sum, refund) => sum + refund.amount, 0)
    field(
      copy.refundTotal,
      new Intl.NumberFormat(intl, {
        style: "currency",
        currency: (refunds[0].currency || "CZK").toUpperCase(),
        maximumFractionDigits: 2,
      }).format(total)
    )
  }

  // ── Zákonná poznámka ──────────────────────────────────────────────────────
  space(10)
  const legal = data.confirmation
    ? data.kind === "reklamace"
      ? copy.legalResolvedClaim
      : copy.legalResolvedOther
    : data.kind === "reklamace"
      ? copy.legalOpenClaim
      : copy.legalOpenOther
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
  page.drawText(copy.seller, { x: margin, y, size: 9, font: regular, color: muted })
  page.drawText(copy.buyer, {
    x: margin + contentWidth - colW,
    y,
    size: 9,
    font: regular,
    color: muted,
  })

  return await doc.save()
}

/**
 * Číslo protokolu z druhu, roku a čísla objednávky: `REK|VRA|ODS-<rok>-<obj>`.
 * Druhá a další žádost na téže objednávce v roce dostane příponu `-2`, `-3`
 * (`sequence`), ať se PDF nepřepisují.
 */
export const protocolNumberFor = (
  kind: string | null,
  orderDisplayId: string,
  when: Date = new Date(),
  sequence = 1
): string => {
  const prefix =
    kind === "odstoupeni"
      ? "ODS"
      : kind === "vraceni"
        ? "VRA"
        : kind === "zruseni_zakazky"
          ? "ZAK"
          : "REK"
  const suffix = sequence > 1 ? `-${sequence}` : ""
  return `${prefix}-${when.getFullYear()}-${orderDisplayId}${suffix}`
}

/**
 * Pořadí NOVÉ žádosti na objednávce v daném roce = kolik jich už v tom roce je
 * + 1. Počítá se před založením řádku (volající předá stávající žádosti).
 */
export const nextProtocolSequence = (
  existingRequests: Array<{ created_at?: string | Date | null }>,
  when: Date = new Date()
): number => {
  const year = when.getFullYear()
  const sameYear = existingRequests.filter((request) => {
    if (!request?.created_at) return false
    const created = new Date(request.created_at)
    return !Number.isNaN(created.getTime()) && created.getFullYear() === year
  })
  return sameYear.length + 1
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
    // Nikdy nevyhodí; bez nastavení jsou údaje výchozí z kódu.
    const { facts } = await getLegalFacts(container)
    const bytes = await generateProtocolPdf(data, protocolSeller(facts))
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
