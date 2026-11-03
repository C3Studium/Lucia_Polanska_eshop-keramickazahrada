import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  likePattern,
  parseSearchQuery,
  SEARCH_LIMIT_PER_KIND,
} from "../../../lib/admin-search"
import { PHASE_LABEL } from "../../../lib/parcel-tracking/classify"
import { COURSE_MODULE } from "../../../modules/course"
import type CourseModuleService from "../../../modules/course/service"
import { GIFT_VOUCHER_MODULE } from "../../../modules/gift-voucher"
import {
  normalizeVoucherCode,
  VOUCHER_STATE_LABEL,
  voucherState,
} from "../../../modules/gift-voucher/code"
import type GiftVoucherModuleService from "../../../modules/gift-voucher/service"
import { PARCEL_TRACKING_MODULE } from "../../../modules/parcel-tracking"
import type { ParcelPhase } from "../../../modules/parcel-tracking/phases"
import type ParcelTrackingModuleService from "../../../modules/parcel-tracking/service"

/**
 * GET /admin/search?q= — hledání odkudkoli (Ctrl+K v Přehledu).
 *
 * Matěj 3. 11. 2026: „můžeš dát, ale asi se používat nebude" — proto
 * jednoduše: pět malých dotazů s limitem, každý jen když napsaný text dává
 * smysl (číslo → objednávka, kód → poukaz, podací číslo → zásilka), a
 * výsledkem jsou jen odkazy do administrace. Nic se tu nepočítá ani nemění.
 *
 * Objednávky hledá nativní `q` modulu objednávek (e-mail, číslo, jméno
 * a adresa z doručovací i fakturační adresy) — stejné hledání jako seznam
 * objednávek v Meduse. Když jeden druh spadne, ostatní se vrátí dál.
 */

type SearchResult = {
  type: "order" | "product" | "voucher" | "course" | "parcel"
  id: string
  title: string
  subtitle: string | null
  to: string
}

const dateFormat = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Europe/Prague",
})

const formatDate = (value: unknown): string | null => {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date)
}

const formatMoney = (amount: unknown, currency: unknown): string => {
  const value = Number(amount)
  try {
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: String(currency || "czk").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0)
  } catch {
    return `${Number.isFinite(value) ? value : 0} Kč`
  }
}

const PRODUCT_STATUS: Record<string, string> = {
  published: "zveřejněný",
  draft: "koncept",
  proposed: "návrh",
  rejected: "zamítnutý",
}

const fullName = (person: any): string =>
  [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim()

const join = (parts: (string | null | undefined | false)[]): string | null => {
  const text = parts.filter(Boolean).join(" · ")
  return text || null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = parseSearchQuery(req.query.q)
  if (!parsed.text) {
    res.status(200).json({ q: "", results: [] })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const take = SEARCH_LIMIT_PER_KIND

  /** Jeden spadlý druh nesmí shodit celé hledání. */
  const safe = async <T>(label: string, run: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await run()
    } catch (error) {
      logger.warn(`[admin-search] ${label}: ${(error as Error)?.message ?? error}`)
      return []
    }
  }

  const [orders, products, vouchers, reservations, parcels] = await Promise.all([
    // ---- Objednávky: číslo přesně, jinak nativní hledání ------------------
    safe<any>("objednávky", async () => {
      const filters = parsed.orderNumber
        ? { display_id: parsed.orderNumber }
        : parsed.words
          ? { q: parsed.words }
          : null
      if (!filters) return []
      const { data } = await query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "email",
          "created_at",
          "customer.first_name",
          "customer.last_name",
          "shipping_address.first_name",
          "shipping_address.last_name",
        ],
        filters: { ...filters, is_draft_order: false } as never,
        pagination: { take, skip: 0, order: { created_at: "DESC" } },
      })
      return data as any[]
    }),

    // ---- Produkty podle názvu ---------------------------------------------
    safe<any>("produkty", async () => {
      if (!parsed.words) return []
      const { data } = await query.graph({
        entity: "product",
        fields: ["id", "title", "status"],
        filters: { title: { $ilike: likePattern(parsed.words) } } as never,
        pagination: { take, skip: 0, order: { title: "ASC" } },
      })
      return data as any[]
    }),

    // ---- Dárkové poukazy podle kódu ---------------------------------------
    safe<any>("poukazy", async () => {
      if (!parsed.voucherCode) return []
      const service = req.scope.resolve<GiftVoucherModuleService>(GIFT_VOUCHER_MODULE)
      const code = parsed.voucherCode
      // Starší kódy jsou uložené s pomlčkami („KZ-9VJJ-KHKB"), napsaný kód
      // bývá bez nich — v databázi se proto hledá se zástupným znakem mezi
      // písmeny a přesně se dofiltruje podle kódu bez pomlček.
      const candidates = (await service.listGiftVouchers(
        { code: { $ilike: `%${code.split("").join("%")}%` } } as never,
        { take: 50, order: { created_at: "DESC" } } as never
      )) as any[]
      return candidates
        .filter((voucher) => normalizeVoucherCode(voucher.code).includes(code))
        .slice(0, take)
    }),

    // ---- Rezervace kurzů podle jména / e-mailu ----------------------------
    safe<any>("rezervace kurzů", async () => {
      if (!parsed.words) return []
      const service = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
      const pattern = likePattern(parsed.words)
      return (await service.listCourseReservations(
        { $or: [{ name: { $ilike: pattern } }, { email: { $ilike: pattern } }] } as never,
        { take, relations: ["term"], order: { created_at: "DESC" } } as never
      )) as any[]
    }),

    // ---- Zásilky ČP podle podacího čísla ----------------------------------
    safe<any>("zásilky", async () => {
      if (!parsed.parcelCode) return []
      const service = req.scope.resolve<ParcelTrackingModuleService>(PARCEL_TRACKING_MODULE)
      return (await service.listParcelTrackings(
        { parcel_code: { $ilike: likePattern(parsed.parcelCode) } } as never,
        { take } as never
      )) as any[]
    }),
  ])

  // Zásilka nese jen id objednávky — číslo objednávky do podtitulku.
  const parcelOrderIds = parcels.map((parcel) => parcel.order_id).filter(Boolean)
  const displayById = new Map<string, unknown>()
  if (parcelOrderIds.length) {
    const rows = await safe<any>("čísla objednávek", async () => {
      const { data } = await query.graph({
        entity: "order",
        fields: ["id", "display_id"],
        filters: { id: parcelOrderIds },
      })
      return data as any[]
    })
    for (const row of rows) displayById.set(row.id, row.display_id)
  }

  const results: SearchResult[] = [
    ...orders.map((order) => {
      const name = fullName(order.customer) || fullName(order.shipping_address)
      return {
        type: "order" as const,
        id: order.id,
        title: `Objednávka #${order.display_id}`,
        subtitle: join([name, order.email, formatDate(order.created_at)]),
        to: `/orders/${order.id}`,
      }
    }),
    ...parcels.map((parcel) => {
      const display = displayById.get(parcel.order_id)
      return {
        type: "parcel" as const,
        id: parcel.id,
        title: `Zásilka ${parcel.parcel_code}`,
        subtitle: join([
          display ? `objednávka #${display}` : null,
          PHASE_LABEL[parcel.phase as ParcelPhase] ?? null,
        ]),
        to: `/orders/${parcel.order_id}`,
      }
    }),
    ...vouchers.map((voucher) => ({
      type: "voucher" as const,
      id: voucher.id,
      title: `Poukaz ${voucher.code}`,
      subtitle: join([
        VOUCHER_STATE_LABEL[voucherState(voucher)],
        `zůstatek ${formatMoney(voucher.balance, voucher.currency_code)}`,
        voucher.recipient_name || voucher.buyer_name,
      ]),
      // Poukazy zatím nemají vlastní stránku — seznam s předvyplněným hledáním.
      to: `/poukazy?q=${encodeURIComponent(voucher.code)}`,
    })),
    ...reservations.map((reservation) => ({
      type: "course" as const,
      id: reservation.id,
      title: `Rezervace kurzu — ${reservation.name}`,
      subtitle: join([
        reservation.term?.title,
        formatDate(reservation.term?.starts_at),
        reservation.status === "cancelled" ? "zrušená" : null,
      ]),
      to: reservation.term?.id ? `/kurzy-sprava/${reservation.term.id}` : "/kurzy-sprava",
    })),
    ...products.map((product) => ({
      type: "product" as const,
      id: product.id,
      title: product.title || "Bez názvu",
      subtitle: join(["produkt", PRODUCT_STATUS[product.status] ?? null]),
      to: `/produkt/${product.id}`,
    })),
  ]

  res.setHeader("Cache-Control", "no-store")
  res.status(200).json({ q: parsed.text, results })
}
