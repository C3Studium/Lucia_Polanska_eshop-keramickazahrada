import { round2 } from "./utils"

/**
 * Položky dobropisu z návrhu iDokladu (docs/reklamace-a-zruseni.md §13.3) —
 * ČISTÉ, dokazované testem (`__tests__/credit-note`).
 *
 * ## Výchozí bod: `GET /CreditNotes/Default/{invoiceId}`
 *
 * iDoklad vrátí návrh dobropisu s položkami původní faktury (obrácenými).
 * Plný dobropis = návrh beze změny. Částečný = z návrhu se PONECHAJÍ jen
 * položky odpovídající košíku vrácení a zkrátí se jim množství; nové řádky
 * (komponenta balíčku, ruční částka) dostanou sazbu DPH z návrhu.
 *
 * ## Proč je párování opatrné
 *
 * Řádek faktury vznikl z `product_title || title` položky objednávky
 * (`buildInvoiceItems`), takže název je jediný spolehlivý klíč; cena za kus
 * se navíc musí shodovat s tím, co se vrací (u zakázkové položky seříznuté
 * zaplaceným nesedí — pak párovat nesmíme). Když cokoli nesedí, nebo košík
 * chybí, dobropis má JEDEN řádek „Vrácení — …" na vrácenou částku vč. DPH:
 * účetně správně (částka i sazba sedí), jen bez rozpisu. Lepší poctivý
 * jeden řádek než rozpis, který nesedí s penězi.
 *
 * ## Znaménko
 *
 * Některé agendy vracejí v návrhu záporná množství (obrácené položky),
 * jiné kladná s typem dokladu. Zjistí se z návrhu a nové řádky ho kopírují.
 */

export type CreditNoteDraftItem = Record<string, unknown> & {
  Name?: string
  Amount?: number
  UnitPrice?: number
  PriceType?: number
  VatRateType?: number
  IsTaxMovement?: boolean
  DiscountPercentage?: number
  ItemType?: number
}

export type CreditNoteLine = {
  type: "item" | "component" | "shipping" | "custom"
  title?: string | null
  quantity?: number
  unit_total?: number
  amount: number
}

export type BuildCreditNoteItemsInput = {
  /** Vrácená částka (vč. DPH) — součet položek dobropisu musí sedět na haléř. */
  amount: number
  lines?: CreditNoteLine[] | null
  /** Do popisku jediného řádku při záložní strategii. */
  orderDisplayId: string
  /** `VatRateType`, když návrh žádné položky nemá (neplátce = Zero). */
  vatRateTypeFallback: number
}

export type CreditNoteStrategy = "full" | "matched" | "single"

export type CreditNoteItemsResult = {
  items: CreditNoteDraftItem[]
  strategy: CreditNoteStrategy
}

const TOLERANCE = 0.011

const num = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizedName = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()

/**
 * Řádek dopravy na faktuře: „Poštovné…", u starých faktur i samostatné
 * „Balné". Od 12. 10. 2026 je balné položka u výrobku („Balné — Pítko") —
 * ta k poštovnému NEpatří a páruje se jako běžná položka.
 */
const isShippingName = (value: unknown): boolean => {
  const name = normalizedName(value)
  return name.startsWith("postovne") || name === "balne"
}

const isRoundingName = (value: unknown): boolean =>
  normalizedName(value) === "zaokrouhleni"

const draftItemsOf = (draft: Record<string, unknown>): CreditNoteDraftItem[] =>
  Array.isArray(draft?.Items)
    ? (draft.Items as unknown[]).filter(
        (item): item is CreditNoteDraftItem => Boolean(item) && typeof item === "object"
      )
    : []

const lineValue = (item: CreditNoteDraftItem): number =>
  round2(Math.abs(num(item.Amount)) * num(item.UnitPrice))

/** Nový řádek dobropisu ve tvaru, který POST /CreditNotes bere. */
const newItem = (
  template: CreditNoteDraftItem | undefined,
  input: { name: string; quantity: number; unitPrice: number; sign: 1 | -1; vatRateType: number }
): CreditNoteDraftItem => ({
  Name: input.name.slice(0, 200) || "Vrácení",
  Amount: input.sign * input.quantity,
  UnitPrice: round2(input.unitPrice),
  // PriceType 0 = s DPH — ceny v obchodě jsou konečné spotřebitelské.
  PriceType: typeof template?.PriceType === "number" ? template.PriceType : 0,
  VatRateType:
    typeof template?.VatRateType === "number" ? template.VatRateType : input.vatRateType,
  IsTaxMovement: false,
  DiscountPercentage: 0,
  // ItemType 0 = běžná položka.
  ItemType: 0,
})

export const buildCreditNoteItems = (
  draft: Record<string, unknown>,
  input: BuildCreditNoteItemsInput
): CreditNoteItemsResult => {
  const draftItems = draftItemsOf(draft)
  const sign: 1 | -1 = draftItems.some((item) => num(item.Amount) < 0) ? -1 : 1
  const template = draftItems.find((item) => !isRoundingName(item.Name)) ?? draftItems[0]
  const amount = round2(input.amount)

  // Plný dobropis: součet návrhu = vrácená částka → návrh beze změny.
  if (draftItems.length) {
    const draftTotal = round2(draftItems.reduce((sum, item) => sum + lineValue(item), 0))
    if (Math.abs(draftTotal - amount) <= TOLERANCE) {
      return { items: draftItems, strategy: "full" }
    }
  }

  const matched = matchLines(draftItems, input.lines ?? [], sign, template, input.vatRateTypeFallback)
  if (matched) {
    const total = round2(matched.reduce((sum, item) => sum + lineValue(item), 0))
    if (Math.abs(total - amount) <= TOLERANCE) {
      return { items: matched, strategy: "matched" }
    }
  }

  return {
    items: [
      newItem(template, {
        name: `Vrácení — objednávka #${input.orderDisplayId}`,
        quantity: 1,
        unitPrice: amount,
        sign,
        vatRateType: input.vatRateTypeFallback,
      }),
    ],
    strategy: "single",
  }
}

/**
 * Páruje řádky košíku na položky návrhu; null, jakmile něco nesedí (volající
 * spadne na jeden řádek). Položka: název + cena za kus + dost kusů. Poštovné:
 * všechny řádky „Poštovné…" / „Balné" z návrhu, celé. Komponenta a ruční
 * částka: nový řádek.
 */
const matchLines = (
  draftItems: CreditNoteDraftItem[],
  lines: CreditNoteLine[],
  sign: 1 | -1,
  template: CreditNoteDraftItem | undefined,
  vatRateType: number
): CreditNoteDraftItem[] | null => {
  if (!lines.length) {
    return null
  }
  const remaining = draftItems.map((item) => Math.abs(num(item.Amount)))
  const result: CreditNoteDraftItem[] = []

  for (const line of lines) {
    const quantity = Math.max(0, Math.trunc(num(line.quantity)))
    if (line.type === "item") {
      if (quantity < 1) return null
      const unit = round2(num(line.amount) / quantity)
      const index = draftItems.findIndex(
        (item, i) =>
          !isRoundingName(item.Name) &&
          normalizedName(item.Name) === normalizedName(line.title) &&
          remaining[i] >= quantity &&
          Math.abs(round2(num(item.UnitPrice)) - unit) <= TOLERANCE
      )
      if (index < 0) return null
      remaining[index] -= quantity
      result.push({ ...draftItems[index], Amount: sign * quantity })
    } else if (line.type === "shipping") {
      const indices = draftItems
        .map((item, i) => (isShippingName(item.Name) && remaining[i] > 0 ? i : -1))
        .filter((i) => i >= 0)
      if (!indices.length) return null
      const total = round2(indices.reduce((sum, i) => sum + lineValue(draftItems[i]), 0))
      if (Math.abs(total - round2(num(line.amount))) > TOLERANCE) return null
      for (const i of indices) {
        result.push({ ...draftItems[i], Amount: sign * remaining[i] })
        remaining[i] = 0
      }
    } else if (line.type === "component") {
      if (quantity < 1) return null
      result.push(
        newItem(template, {
          name: `Vrácení — ${line.title ?? "komponenta balíčku"}`,
          quantity,
          unitPrice: num(line.amount) / quantity,
          sign,
          vatRateType,
        })
      )
    } else if (line.type === "custom") {
      result.push(
        newItem(template, {
          name: `Vrácení — ${line.title ?? "částka"}`,
          quantity: 1,
          unitPrice: num(line.amount),
          sign,
          vatRateType,
        })
      )
    } else {
      return null
    }
  }
  return result
}
