import { lineQuantityOf } from "../order-quantity"
import { isPickupOrder } from "../review-request-rules"
import { WITHDRAWAL_DAYS } from "./constants"
import { isMadeToOrderItem, type MadeToOrderSource } from "./made-to-order"
import {
  isServiceItem,
  itemTitleOf,
  ITEMS_NOT_IN_ORDER,
  ITEMS_QUANTITY_INVALID,
  ITEMS_QUANTITY_TOO_HIGH,
  perUnitOf,
  type ClaimItemSelection,
  type ClaimLineItem,
  type ClaimSourceItem,
} from "./line-items"
import { round2, toNumber } from "./refund-rules"

/**
 * Odstoupení od smlouvy online (§ 1829–1837 OZ, tlačítko § 1830a) — čistá
 * pravidla bez kontejneru, dokazovaná testem (`__tests__/claims-withdrawal`).
 *
 * ## Kdy lhůta běží (§ 1829 odst. 1 písm. b) OZ)
 *
 * Lhůta 14 dnů běží od PŘEVZETÍ zboží, u dodávky po částech od převzetí
 * posledního kusu. „Končí uplynutím 14 dnů ode dne následujícího po dni
 * převzetí" (NV 29/2023 Sb., příloha) — den převzetí se nepočítá, lhůta končí
 * ve 23:59:59 čtrnáctého dne pražského času. Připadne-li konec na sobotu,
 * neděli nebo svátek, posouvá se na nejbližší pracovní den (§ 607 OZ).
 *
 * Okamžik převzetí podle toho, co o zásilce opravdu víme:
 *
 * | Co víme | Převzetí | `basis` |
 * |---|---|---|
 * | nic neodešlo | lhůta ještě neběží — odstoupit lze | `not_shipped` |
 * | `fulfillment.delivered_at` (nativní „doručeno") | ten okamžik | `delivered` |
 * | osobní odběr | `shipped_at` = vyzvednutí u pultu (`complete-personal-pickup`) | `pickup` |
 * | sledování ČP s `delivered_at` | ten okamžik | `delivered` |
 * | sledování ČP běží, doručeno ještě není | lhůta ještě neběží — odstoupit lze | `in_transit` |
 * | odesláno, o doručení nic nevíme | `shipped_at` + 7 dnů (rezerva) | `estimated` |
 *
 * Fulfillment `delivered_at` sledování zásilek NEnastavuje — razítko převzetí
 * žije v řádku `parcel_tracking` (modul sledování), proto ho volající
 * přibalí k objednávce (`order.parcel_tracking`, viz `attachParcelTracking`).
 *
 * ## Proč rezerva 7 dnů u neznámého převzetí
 *
 * Bez potvrzeného doručení by lhůta od odeslání krátila zákazníka o dny na
 * cestě a uložení na poště — a pravidlo, které je přísnější než zákon, je
 * neplatné. Proto se převzetí odhaduje VE PROSPĚCH zákazníka: odeslání
 * + 7 dnů (běžné doručení 1–2 dny + uložení na poště), lhůta tedy končí
 * nejdřív 21. den po odeslání. Kdo chce přesnější lhůtu, potřebuje sledování.
 *
 * ## Zakázka po položkách (§ 1837 písm. d) OZ)
 *
 * Výjimka platí pro zboží vyrobené podle přání spotřebitele — u smíšené
 * objednávky se odstupuje od běžného zboží, zakázkové položky se z odstoupení
 * VYJÍMAJÍ na serveru, ať prohlížeč pošle cokoli.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Rezerva na doručení, když převzetí nikdo nepotvrdil (viz hlavička). */
export const UNKNOWN_TAKEOVER_BUFFER_DAYS = 7

// --- pražský kalendář --------------------------------------------------------

export type PlainDate = { year: number; month: number; day: number }

const PRAGUE_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

const pragueWallClock = (instant: Date) => {
  const parts: Record<string, number> = {}
  for (const part of PRAGUE_PARTS.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value)
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    // h23 hlásí půlnoc v některých verzích ICU jako 24.
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

/** Pražské kalendářní datum okamžiku. */
export const pragueDateOf = (instant: Date): PlainDate => {
  const wall = pragueWallClock(instant)
  return { year: wall.year, month: wall.month, day: wall.day }
}

/** Posun Prahy proti UTC (ms) v daném okamžiku — +1 h v zimě, +2 h v létě. */
const pragueOffsetMs = (instant: Date): number => {
  const wall = pragueWallClock(instant)
  const asIfUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second
  )
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * Poslední milisekunda pražského dne (23:59:59.999) jako okamžik UTC.
 * Dvojí odhad posunu — změna času je ve 2–3 h ráno, ne o půlnoci, takže
 * konec dne má vždy jednoznačný okamžik.
 */
export const endOfPragueDay = (date: PlainDate): Date => {
  const asIfUtc = Date.UTC(date.year, date.month - 1, date.day, 23, 59, 59, 999)
  const guess = asIfUtc - pragueOffsetMs(new Date(asIfUtc))
  return new Date(asIfUtc - pragueOffsetMs(new Date(guess)))
}

/** Kalendářní aritmetika bez časové zóny (UTC jen normalizuje přetečení). */
export const addPlainDays = (date: PlainDate, days: number): PlainDate => {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

const sameDay = (a: PlainDate, b: PlainDate) =>
  a.year === b.year && a.month === b.month && a.day === b.day

/** Velikonoční neděle (gregoriánský kalendář, algoritmus Meeus/Jones/Butcher). */
export const easterSunday = (year: number): PlainDate => {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { year, month, day }
}

/**
 * Státní a ostatní svátky ČR (zákon č. 245/2000 Sb.) — pevné dny + Velký
 * pátek a Velikonoční pondělí.
 */
const FIXED_HOLIDAYS = new Set([
  "1-1",
  "5-1",
  "5-8",
  "7-5",
  "7-6",
  "9-28",
  "10-28",
  "11-17",
  "12-24",
  "12-25",
  "12-26",
])

export const isCzechPublicHoliday = (date: PlainDate): boolean => {
  if (FIXED_HOLIDAYS.has(`${date.month}-${date.day}`)) return true
  const easter = easterSunday(date.year)
  return sameDay(date, addPlainDays(easter, -2)) || sameDay(date, addPlainDays(easter, 1))
}

export const isWorkingDay = (date: PlainDate): boolean => {
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()
  return weekday !== 0 && weekday !== 6 && !isCzechPublicHoliday(date)
}

/**
 * Konec 14denní lhůty od převzetí: 14. den po dni převzetí (pražský
 * kalendář), posunutý na nejbližší pracovní den (§ 607 OZ), do 23:59:59.999.
 */
export const withdrawalPeriodEndFor = (
  takeover: Date,
  days: number = WITHDRAWAL_DAYS
): Date => {
  let last = addPlainDays(pragueDateOf(takeover), days)
  while (!isWorkingDay(last)) {
    last = addPlainDays(last, 1)
  }
  return endOfPragueDay(last)
}

// --- převzetí a lhůta ----------------------------------------------------------

export type TakeoverBasis =
  | "not_shipped"
  | "in_transit"
  | "delivered"
  | "pickup"
  | "estimated"

export type WithdrawalTimingSource = {
  fulfillments?: Array<{
    shipped_at?: unknown
    delivered_at?: unknown
    canceled_at?: unknown
  } | null> | null
  shipping_methods?: unknown[] | null
  /** Řádek `parcel_tracking` objednávky (přibalí `attachParcelTracking`). */
  parcel_tracking?: { delivered_at?: unknown; done?: boolean | null } | null
}

export type WithdrawalTiming = {
  basis: TakeoverBasis
  /** Převzetí — potvrzené, nebo u `estimated` odhad (odeslání + 7 dnů). */
  takeover_at: Date | null
  /** Nejpozdější odeslání nezrušené zásilky. */
  shipped_at: Date | null
  /** Konec lhůty; null = lhůta ještě neběží (neodesláno / na cestě). */
  deadline: Date | null
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value as string)
  return Number.isFinite(date.getTime()) ? date : null
}

/**
 * Převzetí a konec lhůty pro odstoupení (tabulka v hlavičce). U více zásilek
 * běží lhůta od převzetí té poslední; je-li kterákoli ještě na cestě, lhůta
 * neběží vůbec.
 */
export const withdrawalTimingFor = (order: WithdrawalTimingSource): WithdrawalTiming => {
  const shipped = (order.fulfillments ?? []).filter(
    (fulfillment) =>
      fulfillment && !fulfillment.canceled_at && toDate(fulfillment.shipped_at)
  ) as Array<{ shipped_at?: unknown; delivered_at?: unknown }>
  if (!shipped.length) {
    return { basis: "not_shipped", takeover_at: null, shipped_at: null, deadline: null }
  }

  const pickup = isPickupOrder(order)
  const tracking = order.parcel_tracking ?? null
  const trackedDelivery = toDate(tracking?.delivered_at)

  let latestShipped: Date | null = null
  let latest: { at: Date; basis: TakeoverBasis } | null = null
  let inTransit = false

  for (const fulfillment of shipped) {
    const shippedAt = toDate(fulfillment.shipped_at) as Date
    if (!latestShipped || shippedAt > latestShipped) latestShipped = shippedAt

    const delivered = toDate(fulfillment.delivered_at)
    let entry: { at: Date; basis: TakeoverBasis } | null = null
    if (delivered) {
      entry = { at: delivered, basis: "delivered" }
    } else if (pickup) {
      entry = { at: shippedAt, basis: "pickup" }
    } else if (trackedDelivery) {
      // Doručení před odesláním je chyba v datech (odesláno zapsané pozdě) —
      // ve prospěch zákazníka platí pozdější z obou.
      entry = {
        at: trackedDelivery > shippedAt ? trackedDelivery : shippedAt,
        basis: "delivered",
      }
    } else if (tracking && !tracking.done) {
      inTransit = true
    } else {
      entry = {
        at: new Date(shippedAt.getTime() + UNKNOWN_TAKEOVER_BUFFER_DAYS * DAY_MS),
        basis: "estimated",
      }
    }
    if (entry && (!latest || entry.at > latest.at)) latest = entry
  }

  if (inTransit || !latest) {
    return { basis: "in_transit", takeover_at: null, shipped_at: latestShipped, deadline: null }
  }
  return {
    basis: latest.basis,
    takeover_at: latest.at,
    shipped_at: latestShipped,
    deadline: withdrawalPeriodEndFor(latest.at),
  }
}

// --- formátování (pražský čas) -----------------------------------------------

const pad2 = (value: number) => String(value).padStart(2, "0")

/** „15. 10. 2026" (pražský kalendář); prázdné u neplatného vstupu. */
export const formatPragueDate = (value: unknown): string => {
  const date = toDate(value)
  if (!date) return ""
  const wall = pragueWallClock(date)
  return `${wall.day}. ${wall.month}. ${wall.year}`
}

/** „15. 10. 2026 v 14:32" (pražský čas) — datum a čas odeslání do potvrzení. */
export const formatPragueDateTime = (value: unknown): string => {
  const date = toDate(value)
  if (!date) return ""
  const wall = pragueWallClock(date)
  return `${wall.day}. ${wall.month}. ${wall.year} v ${pad2(wall.hour)}:${pad2(wall.minute)}`
}

/** Převzetí slovy — do formuláře, potvrzení i e-mailu. */
export const takeoverTextFor = (timing: WithdrawalTiming): string => {
  switch (timing.basis) {
    case "delivered":
      return formatPragueDate(timing.takeover_at)
    case "pickup":
      return `${formatPragueDate(timing.takeover_at)} (osobní odběr)`
    case "estimated":
      return `převzetí nemáme potvrzené — zásilka odešla ${formatPragueDate(timing.shipped_at)}`
    case "in_transit":
      return "zásilka je na cestě — lhůta ještě neběží"
    default:
      return "zboží jsme ještě neodeslali"
  }
}

// --- položky ---------------------------------------------------------------------

export const WITHDRAWAL_ITEM_MADE_TO_ORDER =
  "Vyrobeno na zakázku podle vašeho zadání — od koupě nelze odstoupit (§ 1837 písm. d) občanského zákoníku). Má-li vadu, můžete ho reklamovat."

export const WITHDRAWAL_NOTHING_WITHDRAWABLE =
  "Od koupě vybraného zboží nelze odstoupit — je vyrobené na zakázku podle vašeho zadání (§ 1837 písm. d) občanského zákoníku). Má-li vadu, uplatněte prosím reklamaci."

export type WithdrawalSourceItem = ClaimSourceItem & MadeToOrderSource

export type WithdrawalSourceOrder = {
  currency_code?: string | null
  items?: WithdrawalSourceItem[] | null
}

/** Položka objednávky ve formuláři odstoupení (`withdrawal.items` v GET). */
export type WithdrawalItemView = {
  id: string
  title: string
  variant_title: string | null
  thumbnail: string | null
  quantity: number
  unit_price: number
  total: number
  is_made_to_order: boolean
  /** Lze od koupě odstoupit (není zakázka na míru). */
  withdrawable: boolean
  /** Proč ne — u zakázky věta s § 1837 písm. d). */
  block_reason: string | null
}

const goodsOf = (order: WithdrawalSourceOrder): WithdrawalSourceItem[] =>
  (order.items ?? []).filter(
    (item) => typeof item?.id === "string" && item.id && !isServiceItem(item)
  )

export const withdrawalItemsOf = (order: WithdrawalSourceOrder): WithdrawalItemView[] =>
  goodsOf(order).map((item) => {
    const quantity = lineQuantityOf(item)
    const unit = perUnitOf(item)
    const madeToOrder = isMadeToOrderItem(item)
    return {
      id: item.id as string,
      title: itemTitleOf(item),
      variant_title: item.variant_title?.trim() || null,
      thumbnail: item.thumbnail || null,
      quantity,
      unit_price: unit,
      total: round2(unit * quantity),
      is_made_to_order: madeToOrder,
      withdrawable: !madeToOrder,
      block_reason: madeToOrder ? WITHDRAWAL_ITEM_MADE_TO_ORDER : null,
    }
  })

const snapshotOf = (
  item: WithdrawalSourceItem,
  quantity: number,
  currency: string
): ClaimLineItem => {
  const unit = perUnitOf(item)
  return {
    line_item_id: item.id as string,
    title: itemTitleOf(item),
    variant_title: item.variant_title?.trim() || null,
    thumbnail: item.thumbnail || null,
    quantity,
    unit_price: unit,
    total: round2(unit * quantity),
    currency_code: currency,
  }
}

export type WithdrawalItemsVerdict =
  | {
      ok: true
      /** Zboží, od jehož koupě se odstupuje (snapshot jako u reklamace). */
      line_items: ClaimLineItem[]
      /** Zakázkové položky, které se z odstoupení vyjímají (§ 1837 písm. d). */
      excluded: ClaimLineItem[]
      /** Odstoupení od CELÉ smlouvy (vše, nic vyjmuto, plné počty). */
      whole: boolean
    }
  | { ok: false; message: string }

/**
 * Výběr zboží pro odstoupení:
 * - bez výběru (null / prázdné pole — záložní routa, starší storefront) =
 *   veškeré zboží, od kterého odstoupit lze;
 * - s výběrem: id musí patřit objednávce, počet celé číslo 1..objednáno;
 *   zakázkové položky se z výběru TIŠE vyjmou (rozhoduje server, ne prohlížeč);
 * - když po vyjmutí nic nezbude → odmítnout s vysvětlením § 1837 písm. d).
 */
export const resolveWithdrawalItems = (
  order: WithdrawalSourceOrder,
  selection: ClaimItemSelection[] | null | undefined
): WithdrawalItemsVerdict => {
  const goods = goodsOf(order)
  const currency = String(order.currency_code || "czk").toLowerCase()
  const withdrawable = goods.filter((item) => !isMadeToOrderItem(item))
  const madeToOrder = goods.filter((item) => isMadeToOrderItem(item))

  const picked = new Map<string, number>()
  if (!selection || !selection.length) {
    // Objednávka bez čitelných položek (stará data) — odstoupení od celé
    // smlouvy se kvůli tomu neodmítá; žádost pak jen nemá seznam zboží.
    if (!goods.length) {
      return { ok: true, line_items: [], excluded: [], whole: true }
    }
    for (const item of withdrawable) {
      // Nečitelné množství (0) nesmí položku z odstoupení vypustit.
      picked.set(item.id as string, Math.max(1, lineQuantityOf(item)))
    }
  } else {
    const byId = new Map(goods.map((item) => [item.id as string, item]))
    const merged = new Map<string, number>()
    for (const entry of selection) {
      if (!entry || typeof entry.id !== "string" || !entry.id) {
        return { ok: false, message: ITEMS_NOT_IN_ORDER }
      }
      const quantity = toNumber(entry.quantity)
      if (!Number.isInteger(quantity) || quantity < 1) {
        return { ok: false, message: ITEMS_QUANTITY_INVALID }
      }
      merged.set(entry.id, (merged.get(entry.id) ?? 0) + quantity)
    }
    for (const [id, quantity] of merged) {
      const source = byId.get(id)
      if (!source) {
        return { ok: false, message: ITEMS_NOT_IN_ORDER }
      }
      const ordered = lineQuantityOf(source)
      if (ordered > 0 && quantity > ordered) {
        return { ok: false, message: ITEMS_QUANTITY_TOO_HIGH }
      }
      if (isMadeToOrderItem(source)) continue
      picked.set(id, quantity)
    }
  }

  if (!picked.size) {
    return { ok: false, message: WITHDRAWAL_NOTHING_WITHDRAWABLE }
  }

  const byId = new Map(goods.map((item) => [item.id as string, item]))
  const lineItems = [...picked].map(([id, quantity]) =>
    snapshotOf(byId.get(id) as WithdrawalSourceItem, quantity, currency)
  )
  const excluded = madeToOrder.map((item) =>
    snapshotOf(item, lineQuantityOf(item), currency)
  )
  const whole =
    !madeToOrder.length &&
    withdrawable.every(
      (item) => (picked.get(item.id as string) ?? 0) >= lineQuantityOf(item)
    )
  return { ok: true, line_items: lineItems, excluded, whole }
}

// --- vrácení peněz a adresa ------------------------------------------------------

export type RefundMethodKind = "card" | "account" | "none"

/** Účet zamaskovaný do potvrzení: `••••5399/0800`, IBAN `SK•• … 5399`. */
export const maskRefundAccount = (display: string | null | undefined): string | null => {
  const value = (display ?? "").trim()
  if (!value) return null
  const czech = /^(?:\d{1,6}-)?(\d{2,10})\/(\d{4})$/.exec(value.replace(/\s+/g, ""))
  if (czech) {
    return `••••${czech[1].slice(-4)}/${czech[2]}`
  }
  const compact = value.replace(/\s+/g, "")
  return `${compact.slice(0, 2)}•• •••• ${compact.slice(-4)}`
}

/** Jak se peníze vrátí — věta do formuláře, potvrzení i e-mailu (§ 1832 odst. 1). */
export const refundMethodTextFor = (
  kind: RefundMethodKind,
  accountDisplay?: string | null
): string => {
  // „card" = zaplaceno přes ComGate — a ta bere i převod, Apple Pay
  // a Google Pay, takže ne „na kartu", ale stejnou cestou přes bránu.
  if (kind === "card") {
    return "Stejným platebním prostředkem, jakým jste platili — vrátíme je stejnou cestou, jakou jste platili (přes ComGate)."
  }
  if (kind === "account") {
    const masked = maskRefundAccount(accountDisplay)
    return masked
      ? `Převodem na účet ${masked}, který jste uvedli (objednávku jste neplatili online přes ComGate).`
      : "Převodem na účet — objednávku jste neplatili online přes ComGate."
  }
  return "Zatím jste nic nezaplatili — není co vracet."
}

/** Adresa pro vrácení zboží: Lucie Polanská (prodávající), ne značka obchodu. */
export const WITHDRAWAL_RETURN_ADDRESS = "Lucie Polanská, Putim 229, 397 01 Písek"

const LEGACY_RETURN_ADDRESS = "Keramická zahrada Putim 229 397 01 Písek"

/**
 * Adresa z nastavení obchodu, když ji majitelka změnila; výchozí „Keramická
 * zahrada…" (značka, ne osoba) se nahradí jménem prodávající — vzorové
 * poučení chce jméno a adresu toho, komu se zboží vrací (NV 29/2023 [6]).
 */
export const withdrawalReturnAddress = (settingsAddress?: string | null): string => {
  const lines = String(settingsAddress ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length || lines.join(" ") === LEGACY_RETURN_ADDRESS) {
    return WITHDRAWAL_RETURN_ADDRESS
  }
  return lines.join(", ")
}
