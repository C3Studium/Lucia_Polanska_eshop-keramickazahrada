import { round2, toNumber } from "../claims/refund-rules"
import { readCommissionPieces } from "../commission-brief"
import { isClearanceProduct } from "../clearance"
import {
  commissionLineOf,
  commissionTitleOf,
  commissionVariantSuffix,
} from "../made-to-order/commission-line"
import {
  agreedExtrasTotal,
  commissionMoney,
} from "../made-to-order/commission-money"
import { deliveryContext } from "../order-delivery-context"
import { lineQuantityOf, lineRevenueOf } from "../order-quantity"
import { isServiceLine, withPackagingUnderProducts } from "../packaging-lines"
import { isPriceOnRequest } from "../price-on-request"
import { formatCzechDateTime } from "../potvrzeni-zakazky/fields"
import {
  DOBIRKA_PROVIDER_ID,
  PICKUP_PAYMENT_PROVIDER_ID,
  RETIRED_PICKUP_PAYMENT_PROVIDER_IDS,
} from "../ship-gate"
import { isGiftVoucherProduct, VOUCHER_LINE_KEYS, voucherLineKind } from "../voucher"

/**
 * List pro dílnu — ČISTÉ mapování objednávky na hotové texty tabulek PDF
 * (`./pdf.ts`). Bez I/O a bez kontejneru, testuje se bez databáze
 * (`lib/__tests__/workshop-sheet.unit.spec.ts`).
 *
 * Co tu je a co ne (Matěj 17. 11. 2026): „všechno, co je potřeba v dílně" —
 * komu, co, jak zabalit a poslat, co zákazník chce u zakázky a jestli je
 * zaplaceno. Žádné statistiky, žádná technická ID ani metadata.
 *
 * Peníze a příznaky se nepočítají znovu: zakázka přes `commissionMoney`,
 * doručení přes `deliveryContext`, balné přes `isServiceLine` / pořadí
 * `withPackagingUnderProducts`, zadání po kusech přes `readCommissionPieces`.
 */

export type SheetRow = { label: string; value: string; bold?: boolean }

export type SheetItem = {
  title: string
  /** Provedení, rozměr na míru, údaje poukazu, popis vady — každý řádek zvlášť. */
  details: string[]
  quantity: string
  unit_price: string
  total: string
  /** Křehké, Mrazuvzdorné, Velká zásilka, Zakázka, Poukaz, … */
  flags: string[]
  /** Balné / doběrečné — řádek objednávky, ale ne výrobek. */
  service: boolean
}

export type SheetPiece = { label: string; specification: string; photos: string[] }

export type SheetCommission = {
  title: string
  stage: string
  pieces: SheetPiece[]
  internal_note: string | null
  money: SheetRow[]
}

export type WorkshopSheet = {
  number: string
  placed_at: string
  customer: SheetRow[]
  items: SheetItem[]
  commissions: SheetCommission[]
  payment: SheetRow[]
  customer_note: string | null
  /** Poznámka pro dílnu z adminu (`order.metadata.admin_note`, 19. 11. 2026). */
  admin_note: string | null
}

export type WorkshopSheetSource = {
  /** Objednávka z `query.graph` (pole viz `WORKSHOP_ORDER_FIELDS`). */
  order: any
  /** Zakázky objednávky, každá s `payment_requests`. Prázdné = žádné (nebo ještě nezaložené). */
  commissions?: any[] | null
  /** „uhrazeno dárkovým poukazem …" (`voucherNoteForOrder`), nebo null. */
  voucher_note?: string | null
}

const NBSP = " "

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

const isDefaultVariant = (title: string) => !title || /^default( variant| title)?$/i.test(title)

/** „1 234 Kč" / „1 234,50 Kč" — celé koruny bez „,00", čitelnější na papíře. */
export const formatSheetMoney = (value: unknown, currencyCode?: string | null): string => {
  const amount = round2(toNumber(value))
  const whole = Math.abs(amount % 1) < 0.005
  const number = new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })
    .format(amount)
    // Intl dává úzkou nezlomitelnou mezeru (U+202F), font ji nemá.
    .replace(/[   ]/g, NBSP)
  const code = String(currencyCode || "CZK").toUpperCase()
  return `${number}${NBSP}${code === "CZK" ? "Kč" : code}`
}

const nameOf = (...sources: any[]): string => {
  for (const source of sources) {
    const name = [text(source?.first_name), text(source?.last_name)].filter(Boolean).join(" ")
    if (name) return name
  }
  return ""
}

const COUNTRY_NAMES: Record<string, string> = {
  cz: "Česko",
  sk: "Slovensko",
  pl: "Polsko",
  de: "Německo",
  at: "Rakousko",
}

/** Adresa na řádky: ulice, PSČ a město, země jen mimo Česko. */
const addressLines = (address: any): string[] => {
  if (!address) return []
  const country = text(address.country_code).toLowerCase()
  return [
    [text(address.address_1), text(address.address_2)].filter(Boolean).join(", "),
    [text(address.postal_code), text(address.city)].filter(Boolean).join(" "),
    country && country !== "cz" ? COUNTRY_NAMES[country] ?? country.toUpperCase() : "",
  ].filter(Boolean)
}

const addressKey = (address: any): string =>
  [nameOf(address), text(address?.company), ...addressLines(address)]
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")

// ── Zákazník ────────────────────────────────────────────────────────────────

const customerRows = (order: any): SheetRow[] => {
  const shipping = order?.shipping_address ?? null
  const billing = order?.billing_address ?? null
  const meta = (order?.metadata ?? {}) as Record<string, unknown>
  const delivery = deliveryContext(order)
  const method = ((order?.shipping_methods ?? []) as any[])[0] ?? null
  const currency = order?.currency_code

  const rows: SheetRow[] = [
    { label: "Jméno", value: nameOf(shipping, billing, order?.customer) || "—", bold: true },
    { label: "E-mail", value: text(order?.email) || text(order?.customer?.email) || "—" },
    {
      label: "Telefon",
      value: text(shipping?.phone) || text(billing?.phone) || text(order?.customer?.phone) || "—",
    },
  ]

  if (method) {
    const price = toNumber(method.total ?? method.amount)
    rows.push({
      label: "Doprava",
      value: `${text(method.name) || "Doprava"}${price > 0.005 ? ` · ${formatSheetMoney(price, currency)}` : ""}`,
      bold: true,
    })
  }

  if (delivery.method === "pickup") {
    rows.push({ label: "Předání", value: "Osobní odběr v ateliéru" })
  } else if (delivery.method === "balikovna") {
    const point = delivery.pickup_point
    const lines = point
      ? [`Balíkovna ${point.name}`, point.address, point.zip ? `PSČ ${point.zip}` : ""]
      : ["Balíkovna", ...addressLines(shipping)]
    rows.push({
      label: "Výdejna",
      value: [nameOf(shipping), ...lines].filter(Boolean).join("\n"),
    })
  } else if (shipping) {
    rows.push({
      label: "Doručit na",
      value: [nameOf(shipping), text(shipping.company), ...addressLines(shipping)]
        .filter(Boolean)
        .join("\n"),
    })
  }

  // Fakturace: firma (IČO/DIČ z pokladny), jinak jen když se adresa liší od doručení.
  const company = text(billing?.company) || text(shipping?.company)
  const ico = text(meta.firma_ico)
  const dic = text(meta.firma_dic)
  if (ico || dic) {
    const firmAddress = [
      text(meta.firma_ulice),
      [text(meta.firma_psc), text(meta.firma_mesto)].filter(Boolean).join(" "),
    ].filter(Boolean)
    rows.push({
      label: "Fakturace",
      value: [
        company,
        [ico ? `IČO ${ico}` : "", dic ? `DIČ ${dic}` : ""].filter(Boolean).join(" · "),
        ...(firmAddress.length ? firmAddress : addressLines(billing)),
      ]
        .filter(Boolean)
        .join("\n"),
    })
  } else if (billing && addressLines(billing).length && addressKey(billing) !== addressKey(shipping)) {
    rows.push({
      label: "Fakturace",
      value: [nameOf(billing), text(billing.company), ...addressLines(billing)].filter(Boolean).join("\n"),
    })
  }

  return rows
}

// ── Položky ─────────────────────────────────────────────────────────────────

const truthy = (value: unknown) => value === true || value === "true"

/** Řádky, které vyrábí zakázka: značka zadání na řádku, nebo zakázka s tímto řádkem. */
const commissionLineIds = (order: any, commissions: any[]): Set<string> => {
  const ids = new Set<string>()
  const items = ((order?.items ?? []) as any[]).filter((item) => item && !isServiceLine(item))
  for (const item of items) {
    if ((item.metadata as any)?.made_to_order) ids.add(String(item.id))
  }
  for (const commission of commissions) {
    if (commission?.line_item_id) ids.add(String(commission.line_item_id))
  }
  return ids
}

const itemFlags = (item: any, isCommission: boolean): string[] => {
  const product = (item?.product?.metadata ?? {}) as Record<string, unknown>
  const line = (item?.metadata ?? {}) as Record<string, unknown>
  const flags: string[] = []
  if (isCommission) flags.push("Zakázka")
  if (line.ship_fragile === true || truthy(product.fragile)) flags.push("Křehké")
  if (truthy(product.frost_resistant)) flags.push("Mrazuvzdorné")
  if (line.ship_class === "velke" || product.shipping_class === "velke") flags.push("Velká zásilka")
  if (isGiftVoucherProduct(product)) flags.push("Poukaz")
  if (truthy(product.is_personalized)) flags.push("Na míru")
  if (isClearanceProduct(item?.product)) flags.push("Poškozený kus")
  return flags
}

const itemDetails = (item: any): string[] => {
  const product = (item?.product?.metadata ?? {}) as Record<string, unknown>
  const line = (item?.metadata ?? {}) as Record<string, unknown>
  const details: string[] = []
  const variant = text(item?.variant_title)
  if (!isDefaultVariant(variant)) details.push(variant)

  const height = toNumber(line.height)
  const width = toNumber(line.width)
  if (truthy(product.is_personalized) && height > 0 && width > 0) {
    details.push(`Rozměr: výška ${height} cm × šířka ${width} cm`)
  }

  if (isGiftVoucherProduct(product)) {
    const kind = voucherLineKind(line)
    if (kind) details.push(kind === "physical" ? "Tištěný poukaz — přibalit" : "Elektronický poukaz (e-mailem)")
    const recipient = text(line[VOUCHER_LINE_KEYS.recipientName])
    if (recipient) details.push(`Pro: ${recipient}`)
    const dedication = text(line[VOUCHER_LINE_KEYS.dedication])
    if (dedication) details.push(`Věnování: „${dedication}“`)
  }

  if (isClearanceProduct(item?.product)) {
    const damage = text(product.clearance_damage)
    if (damage) details.push(`Vada: ${damage}`)
  }
  return details
}

const sheetItems = (order: any, commissionIds: Set<string>): SheetItem[] => {
  const currency = order?.currency_code
  const items = withPackagingUnderProducts(((order?.items ?? []) as any[]).filter(Boolean))
  return items.map((item) => {
    const service = isServiceLine(item)
    const quantity = lineQuantityOf(item) || 1
    const unit = toNumber(item?.unit_price)
    // Řádek zakázky z poptávky nemá výrobek — příznak nese sám (lib/commission-inquiry-order).
    const onRequest =
      !service &&
      unit <= 0.005 &&
      (isPriceOnRequest(item?.product?.metadata) || isPriceOnRequest(item?.metadata))
    return {
      title: service
        ? text(item?.title) || "Balné"
        : text(item?.product_title) || text(item?.title) || "Položka",
      details: service ? [] : itemDetails(item),
      quantity: String(quantity),
      unit_price: onRequest ? "po domluvě" : formatSheetMoney(unit, currency),
      total: onRequest ? "po domluvě" : formatSheetMoney(lineRevenueOf(item), currency),
      flags: service ? [] : itemFlags(item, commissionIds.has(String(item?.id))),
      service,
    }
  })
}

// ── Zakázky ─────────────────────────────────────────────────────────────────

export const COMMISSION_STAGE_LABELS: Record<string, string> = {
  specification_pending: "Čeká na potvrzení zadání",
  confirmed: "Zadání potvrzeno",
  in_production: "Ve výrobě",
  awaiting_balance: "Hotová — čeká na doplatek",
  ready_to_ship: "Hotová a zaplacená",
  completed: "Dokončeno",
  cancelled: "Zrušeno",
}

/** Zadání po kusech ze všech řádků zakázky; u jediného kusu bez čísla. */
const piecesOf = (sourceItems: any[], fallbackNote: string): SheetPiece[] => {
  const raw = sourceItems.flatMap((item) =>
    readCommissionPieces(item?.metadata as Record<string, unknown>, lineQuantityOf(item) || 1)
  )
  const pieces = raw.map((piece, index) => ({
    label: raw.length > 1 ? `Kus ${index + 1}` : "Zadání",
    specification: text(piece.specification),
    photos: (piece.photos ?? []).filter(Boolean),
  }))
  if (!pieces.some((piece) => piece.specification || piece.photos.length) && fallbackNote) {
    return [{ label: "Zadání", specification: fallbackNote, photos: [] }]
  }
  return pieces.length ? pieces : [{ label: "Zadání", specification: fallbackNote, photos: [] }]
}

const productionLinesOf = (order: any): any[] =>
  ((order?.payment_collections ?? []) as any[]).flatMap((collection) =>
    collection?.metadata?.made_to_order && Array.isArray(collection?.metadata?.production_lines)
      ? collection.metadata.production_lines
      : []
  )

const sheetCommissions = (order: any, commissions: any[], commissionIds: Set<string>): SheetCommission[] => {
  const currency = order?.currency_code
  const money = (value: unknown) => formatSheetMoney(value, currency)

  if (commissions.length) {
    return commissions.map((commission) => {
      const line: any = commissionLineOf(order, commission)
      const sourceItems = commission.line_item_id
        ? line
          ? [line]
          : []
        : ((order?.items ?? []) as any[]).filter(
            (item) => item && !isServiceLine(item) && commissionIds.has(String(item.id))
          )
      const quantity = toNumber(commission.line_quantity) || (line ? lineQuantityOf(line) : 0)
      const computed = commissionMoney(commission, commission.payment_requests ?? [])
      const extras = agreedExtrasTotal(commission)
      const rows: SheetRow[] = [
        {
          label: "Cena zakázky",
          value: computed.item_total > 0.005 ? money(computed.item_total) : "po domluvě (zatím neurčena)",
        },
        { label: "Záloha zaplacena", value: money(computed.deposit_paid_raw) },
        ...(computed.balance_paid > 0.005
          ? [{ label: "Doplatek zaplacen", value: money(computed.balance_paid) }]
          : []),
        ...(computed.surcharge > 0.005 ? [{ label: "Příplatek", value: money(computed.surcharge) }] : []),
        ...(extras > 0.005 ? [{ label: "Poštovné a balné (domluvené)", value: money(extras) }] : []),
        {
          label: "Zbývá doplatit",
          value: computed.outstanding > 0.005 ? money(computed.outstanding) : "nic — zaplaceno",
          bold: true,
        },
      ]
      return {
        title: `${commissionTitleOf(order, commission) ?? "Zakázka"}${commissionVariantSuffix(line?.variant_title)}${
          quantity > 1 ? ` · ${quantity} ks` : ""
        }`,
        stage: COMMISSION_STAGE_LABELS[String(commission.stage ?? "")] ?? "Čeká na potvrzení zadání",
        pieces: piecesOf(sourceItems, text(commission.customer_note)),
        internal_note: text(commission.internal_note) || null,
        money: rows,
      }
    })
  }

  /*
   * Zakázky ještě nejsou založené. E-mail o nové objednávce běží na
   * `order.placed` souběžně se subscriberem, který je zakládá — nečeká se
   * na něj: v tu chvíli je každá zakázka „Čeká na potvrzení zadání", bez
   * interní poznámky, a zadání i zaplacená záloha jsou už na řádku
   * a v kolekci plateb (`production_lines`).
   */
  const lines = productionLinesOf(order)
  const items = ((order?.items ?? []) as any[]).filter(
    (item) =>
      item &&
      !isServiceLine(item) &&
      (commissionIds.has(String(item.id)) ||
        lines.some(
          (line) =>
            (line?.line_item_id && line.line_item_id === item.id) ||
            (line?.variant_id && line.variant_id === item.variant_id)
        ))
  )
  return items.map((item) => {
    const planned = lines.find(
      (line) =>
        (line?.line_item_id && line.line_item_id === item.id) ||
        (line?.variant_id && line.variant_id === item.variant_id)
    )
    const price = round2(planned?.line_total !== undefined ? toNumber(planned.line_total) : lineRevenueOf(item))
    const deposit = round2(toNumber(planned?.deposit_amount))
    const outstanding = Math.max(0, round2(price - deposit))
    const quantity = lineQuantityOf(item)
    const variant = text(item.variant_title)
    return {
      title: `${text(item.product_title) || text(item.title) || "Zakázka"}${
        isDefaultVariant(variant) ? "" : ` — ${variant}`
      }${quantity > 1 ? ` · ${quantity} ks` : ""}`,
      stage: COMMISSION_STAGE_LABELS.specification_pending,
      pieces: piecesOf([item], ""),
      internal_note: null,
      money: [
        { label: "Cena zakázky", value: price > 0.005 ? money(price) : "po domluvě (zatím neurčena)" },
        { label: "Záloha zaplacena", value: money(deposit) },
        {
          label: "Zbývá doplatit",
          value: outstanding > 0.005 ? money(outstanding) : "nic — zaplaceno",
          bold: true,
        },
      ],
    }
  })
}

// ── Platba ──────────────────────────────────────────────────────────────────

const isPickupProvider = (id: string) =>
  id === PICKUP_PAYMENT_PROVIDER_ID || RETIRED_PICKUP_PAYMENT_PROVIDER_IDS.includes(id)

export const paymentMethodLabel = (providerIds: string[]): string => {
  if (providerIds.some((id) => id.startsWith("pp_dobirka") || id === DOBIRKA_PROVIDER_ID)) return "Dobírka"
  if (providerIds.some(isPickupProvider)) return "Při vyzvednutí v ateliéru"
  if (providerIds.some((id) => id.startsWith("pp_comgate"))) return "Online — karta nebo převod (ComGate)"
  if (providerIds.some((id) => id.startsWith("pp_system"))) return "Bez platby (0 Kč)"
  return providerIds.length ? "Online platba" : "—"
}

/** Řádky tabulky Platba — způsob, stav slovy a celkem. */
export const paymentRows = (order: any, commissions: any[], voucherNote?: string | null): SheetRow[] => {
  const currency = order?.currency_code
  const money = (value: unknown) => formatSheetMoney(value, currency)
  const collections = (order?.payment_collections ?? []) as any[]
  const payments = collections
    .flatMap((collection) => collection?.payments ?? [])
    .filter((payment: any) => payment && !payment.canceled_at)
  const sessions = collections
    .flatMap((collection) => collection?.payment_sessions ?? [])
    .filter((session: any) => session && session.status !== "canceled")
  const providers = [
    ...new Set(
      [...payments, ...sessions].map((entry: any) => String(entry?.provider_id ?? "")).filter(Boolean)
    ),
  ]
  const total = round2(toNumber(order?.total))
  const captured =
    payments.some((payment: any) => Boolean(payment?.captured_at)) ||
    collections.some((collection) => toNumber(collection?.captured_amount) > 0.005)

  // Zaplaceno: platby mimo otevřenou kolekci doplatku (stejně jako e-mail
  // majitelce, `madeToOrderMoney`); u založených zakázek mluví jejich peníze.
  const paidAtCheckout = round2(
    collections
      .filter((collection) => !collection?.metadata?.made_to_order_balance)
      .flatMap((collection) => collection?.payments ?? [])
      .filter((payment: any) => payment && !payment.canceled_at)
      .reduce((sum: number, payment: any) => sum + toNumber(payment.amount), 0)
  )
  const commissionMoneys = commissions.map((commission) =>
    commissionMoney(commission, commission.payment_requests ?? [])
  )
  const isCommissionOrder = commissions.length > 0 || productionLinesOf(order).length > 0
  const outstanding = commissions.length
    ? round2(commissionMoneys.reduce((sum, item) => sum + item.outstanding, 0))
    : Math.max(0, round2(total - paidAtCheckout))
  const paid = commissions.length
    ? round2(commissionMoneys.reduce((sum, item) => sum + item.deposit_paid_raw + item.balance_paid, 0))
    : paidAtCheckout

  const dobirka = providers.some((id) => id.startsWith("pp_dobirka"))
  const pickup = providers.some(isPickupProvider)

  let status: string
  if (dobirka && !captured) {
    status = `Dobírka — dopravce vybere ${money(total)}`
  } else if (pickup && !captured) {
    status = `Platí při vyzvednutí — ${money(outstanding > 0.005 ? outstanding : total)}`
  } else if (outstanding <= 0.5) {
    status = "Zaplaceno"
  } else if (isCommissionOrder) {
    status = `Záloha ${money(paid)} zaplacena · zbývá doplatit ${money(outstanding)}`
  } else if (paid > 0.005) {
    status = `Zaplaceno ${money(paid)} · zbývá ${money(outstanding)}`
  } else {
    status = "Nezaplaceno — čeká na platbu"
  }

  return [
    { label: "Způsob", value: paymentMethodLabel(providers) },
    { label: "Stav", value: status, bold: true },
    ...(voucherNote ? [{ label: "Poukaz", value: voucherNote.charAt(0).toUpperCase() + voucherNote.slice(1) }] : []),
    { label: "Celkem", value: money(total), bold: true },
  ]
}

// ── Celek ───────────────────────────────────────────────────────────────────

/**
 * Poznámka zákazníka k celé objednávce. Pokladna dnes obecné pole nemá
 * (zadání zakázky je u zakázky); čte se, kdyby ho objednávka nesla.
 */
const customerNoteOf = (order: any): string | null => {
  const meta = (order?.metadata ?? {}) as Record<string, unknown>
  return text(meta.customer_note) || text(meta.order_note) || text(meta.note) || null
}

export const workshopSheetData = (source: WorkshopSheetSource): WorkshopSheet => {
  const { order } = source
  const commissions = (source.commissions ?? []).filter(Boolean)
  // Záměrně ne `isMadeToOrderItem`: produkt v kategorii Zakázková výroba bez
  // zadání na řádku se prodává jako běžné zboží — značka „Zakázka" jen tam,
  // kde zakázka opravdu vzniká (zadání na řádku nebo založená zakázka).
  const commissionIds = commissionLineIds(order, commissions)
  return {
    number: String(order?.display_id ?? ""),
    placed_at: formatCzechDateTime(order?.created_at),
    customer: customerRows(order),
    items: sheetItems(order, commissionIds),
    commissions: sheetCommissions(order, commissions, commissionIds),
    payment: paymentRows(order, commissions, source.voucher_note),
    customer_note: customerNoteOf(order),
    admin_note: text((order?.metadata ?? {}).admin_note) || null,
  }
}

export const workshopSheetFilename = (displayId: unknown): string =>
  `objednavka-${String(displayId ?? "").replace(/[^0-9A-Za-z_-]/g, "") || "bez-cisla"}-dilna.pdf`
