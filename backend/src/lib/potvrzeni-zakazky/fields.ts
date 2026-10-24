import { isMadeToOrderItem } from "../claims/made-to-order"
import type { LegalFactValues } from "../legal-facts"
import {
  formatVersionDate,
  LEGAL_MANIFEST,
  legalPageUrl,
  type LegalManifest,
} from "../legal"
import { orderDocumentVersion } from "../legal/order-legal"
import { commissionMoney } from "../made-to-order/commission-money"
import { isServiceLine } from "../packaging-lines"

/**
 * Pole PDF „Potvrzení zakázky" (LEGAL_AUDIT § 0, Z11) — ČISTÉ mapování
 * objednávky, produkční objednávky, profilu výroby a právních údajů na
 * hodnoty `{{…}}` ze vzoru `potvrzeni-zakazky.html`. Bez I/O, bez Medusy,
 * testuje se bez kontejneru.
 *
 * Zásada: nic se nevymýšlí. Co v datech není, je „neuvedeno" (nebo prázdný
 * řetězec tam, kde šablona hodnotu jen připojuje, např. `vat.note`). Prodávající
 * je z právních údajů (administrace → Právní údaje), ne natvrdo v kódu.
 */

export const NEUVEDENO = "neuvedeno"

/** Všechny `{{…}}` ze vzoru — hotové texty, jak se tisknou. */
export type CommissionConfirmationInput = {
  /**
   * Který ze dvou dokumentů se sází (24. 10. 2026).
   *
   * - `zakazka` — výroba podle zadání: nese brief, zálohu, dobu výroby
   *   a výjimku z odstoupení (§ 1837 písm. d) OZ).
   * - `objednavka` — kupní smlouva na běžné zboží: nese seznam položek,
   *   lhůtu odeslání a **právo odstoupit do 14 dnů**, tedy přesně opačný
   *   příběh než zakázka.
   *
   * Společné zůstává všechno ostatní — strany, ceny, vady, souhlasy
   * i celé rozvržení, stránkování a patička.
   */
  kind: "zakazka" | "objednavka"
  /**
   * Položky objednávky — jen u `objednavka`, kde zastávají to, čím je
   * u zakázky zadání. Službové řádky (doprava, balné) sem nepatří, ty jsou
   * v cenové tabulce.
   */
  items: {
    title: string
    /** „2×" u množství nad jedna, jinak prázdné. */
    quantity: string
    amount: string
  }[]
  /** Jen u `objednavka`: co se zákazníkovi slibuje o odeslání a vrácení. */
  delivery: {
    /** Věta z právních údajů (`delivery.dispatchTime`), nebo „neuvedeno". */
    dispatch: string
    /**
     * Odhad nákladů na vrácení zboží (`withdrawal.returnCostEstimate`).
     *
     * § 1820 odst. 1 písm. g) OZ ho chce u zboží, které pro svou povahu
     * nelze vrátit obvyklou poštovní cestou — keramika křehká je, takže
     * sem patří. Prázdné = údaj chybí a věta se vynechá.
     */
    return_cost: string
  }
  order: {
    /** „#1234" — číslo objednávky, jak ho zná zákazník. */
    number: string
    placed_at: string
    confirmed_at: string
    /**
     * Okamžik, který PDF nese jako datum vytvoření (metadata dokumentu) —
     * pevná hodnota, ať stejný vstup dá stejné bajty.
     */
    placed_at_iso: string
  }
  terms: {
    /** „15. 10. 2026" — znění OP, se kterým zákazník souhlasil. */
    version: string
    /** Surová verze (`2026-10-15`) pro `confirmation_terms_version`; null bez verze. */
    version_raw: string | null
  }
  seller: {
    brand: string
    name: string
    address: string
    ico: string
    email: string
    phone: string
    /** „zapsaná v živnostenském rejstříku vedeném …" (§ 435 OZ). */
    register: string
  }
  customer: {
    name: string
    address: string
    email: string
    phone: string
  }
  product: {
    title: string
    /** „ — Modrá glazura" nebo prázdné u výchozí varianty. */
    variant_suffix: string
  }
  brief: {
    text: string
    /** Adresy fotek zadání (https), nejvýš 3 — generátor je stáhne. */
    photos: string[]
  }
  shipping: {
    method: string
  }
  price: {
    /** „Kč" u CZK, jinak kód měny. */
    currency: string
    item: string
    /** Ostatní zboží v objednávce mimo zakázku (smíšený košík), null = nic. */
    other: string | null
    shipping: string
    total: string
    paid: string
    deposit: string
    balance: string
    /**
     * Objednávka má víc položek (další zakázka nebo běžné zboží) → Celkem /
     * Zaplaceno / Zbývá platí PRO TUTO POLOŽKU; doprava a balné jsou jen
     * informace (platí se jednou s objednávkou) a `other` se netiskne.
     */
    per_item: boolean
    /** Věta pod tabulkou u `per_item` („Objednávka obsahuje další položky; doprava … se platí jednou s objednávkou."), jinak null. */
    note: string | null
  }
  deposit: {
    method: string
    paid_at: string
  }
  mto: {
    /** Smluvní záloha v procentech („25"). */
    deposit: string
    lead_time_min: string
    lead_time_max: string
  }
  vat: {
    /** „, nejsme plátci DPH" · „ včetně DPH" · „" (údaj chybí). */
    note: string
  }
  links: {
    complaints: string
    /** Poučení o odstoupení — jen u `objednavka`, kde se na ně odkazuje. */
    withdrawal: string
  }
  consent: {
    terms_at: string
    mto_at: string
  }
}

type AddressLike = {
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  postal_code?: string | null
  city?: string | null
  phone?: string | null
} | null | undefined

export type ConfirmationOrderLike = {
  id?: string
  display_id?: number | string | null
  email?: string | null
  created_at?: string | Date | null
  currency_code?: string | null
  total?: unknown
  shipping_total?: unknown
  metadata?: Record<string, unknown> | null
  customer?: {
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
    email?: string | null
  } | null
  billing_address?: AddressLike
  shipping_address?: AddressLike
  shipping_methods?: Array<{ name?: string | null; total?: unknown } | null> | null
  items?: Array<{
    id?: string
    title?: string | null
    product_title?: string | null
    variant_title?: string | null
    variant_id?: string | null
    product_id?: string | null
    quantity?: unknown
    total?: unknown
    metadata?: Record<string, unknown> | null
    product?: {
      metadata?: Record<string, unknown> | null
      categories?: Array<{ handle?: string | null } | null> | null
    } | null
  } | null> | null
  payment_collections?: Array<{
    amount?: unknown
    status?: string | null
    metadata?: Record<string, unknown> | null
    payments?: Array<unknown> | null
    payment_sessions?: Array<{ provider_id?: string | null; status?: string | null } | null> | null
  } | null> | null
}

export type ConfirmationProductionOrderLike = {
  id?: string
  created_at?: string | Date | null
  /** Řádek objednávky (zakázka = položka, od 20. 10. 2026); null/chybí = legacy zakázka za celou objednávku. */
  line_item_id?: string | null
  line_title?: string | null
  line_quantity?: unknown
  line_total?: unknown
  order_extras_paid?: unknown
  surcharge?: unknown
  deposit_percentage?: unknown
  deposit_amount?: unknown
  original_total?: unknown
  agreed_total?: unknown
  currency_code?: string | null
  customer_note?: string | null
  payment_requests?: Array<{
    type?: string | null
    status?: string | null
    amount?: unknown
    selected_method?: string | null
    paid_at?: string | Date | null
  } | null> | null
}

export type ConfirmationProfileLike = {
  production_time_min_days?: unknown
  production_time_max_days?: unknown
} | null | undefined

/** Zápis v diáři zakázky od zákazníka (fotky zadání). */
export type ConfirmationNoteLike = {
  created_by?: string | null
  images?: unknown
  image_url?: string | null
}

export type ConfirmationFieldsArgs = {
  order: ConfirmationOrderLike
  productionOrder: ConfirmationProductionOrderLike | null | undefined
  profile?: ConfirmationProfileLike
  facts?: Partial<LegalFactValues> | null
  manifest?: LegalManifest
  notes?: ConfirmationNoteLike[] | null
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return Number(candidate.value ?? candidate.numeric_ ?? candidate.raw ?? 0)
  }
  return Number(value ?? 0)
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** „1 234,50" — česky, vždy dvě desetinná místa, bez symbolu měny. */
export const formatCzechMoney = (value: unknown): string => {
  const numeric = toNumber(value)
  if (!Number.isFinite(numeric)) return NEUVEDENO
  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(numeric)
    // Intl dává úzkou nezlomitelnou mezeru (U+202F); PDF font ji nemusí mít,
    // obyčejná nezlomitelná mezera vypadá stejně a je ve fontu jistě.
    .replace(/[  ]/g, " ")
}

/** „20. 10. 2026 14:05" v pražském čase; nic → „neuvedeno". */
export const formatCzechDateTime = (value: unknown): string => {
  if (!value) return NEUVEDENO
  const date = new Date(value as string)
  if (Number.isNaN(date.getTime())) return NEUVEDENO
  const parts = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return `${get("day")}. ${get("month")}. ${get("year")} ${get("hour")}:${get("minute")}`
}

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : ""

const orDefault = (value: unknown, fallback = NEUVEDENO): string => text(value) || fallback

const isDefaultVariantTitle = (title: string) =>
  !title || /^default( variant| title)?$/i.test(title)

/** Jméno z adresy nebo účtu — nikdy „undefined undefined". */
const nameOf = (...sources: Array<{ first_name?: string | null; last_name?: string | null } | null | undefined>) => {
  for (const source of sources) {
    const name = [text(source?.first_name), text(source?.last_name)].filter(Boolean).join(" ")
    if (name) return name
  }
  return ""
}

/** „Putim 229, 397 01 Písek" — domácí adresa (billing), výdejna je v shipping. */
const addressLine = (address: AddressLike): string => {
  if (!address) return ""
  const parts = [
    text(address.company),
    text(address.address_1),
    text(address.address_2),
    [text(address.postal_code), text(address.city)].filter(Boolean).join(" "),
  ].filter(Boolean)
  return parts.join(", ")
}

/**
 * Věta o DPH z faktu `vat.status` („nejsme plátci DPH" / „ano, jsme plátci").
 * Chybějící fakt → prázdné a varování; PDF pak nic netvrdí.
 */
export const vatNoteFor = (status: string | null | undefined): { note: string; warning: string | null } => {
  const value = text(status).toLowerCase()
  if (!value) {
    return {
      note: "",
      warning:
        `Právní údaj „DPH" (vat.status) není vyplněný — Potvrzení zakázky o DPH nic neříká. Doplňte ho v administraci → Právní údaje.`,
    }
  }
  if (value.startsWith("ne")) return { note: ", nejsme plátci DPH", warning: null }
  if (value.startsWith("ano")) return { note: " včetně DPH", warning: null }
  return {
    note: "",
    warning: `Právní údaj „DPH" („${text(status)}") nezačíná „ne" ani „ano" — Potvrzení zakázky o DPH nic neříká.`,
  }
}

const providerLabel = (providerId: string): string | null => {
  if (providerId.startsWith("pp_comgate")) return "online přes platební bránu ComGate"
  if (providerId.startsWith("pp_dobirka")) return "dobírka"
  if (providerId.startsWith("pp_system")) return "bez online platby"
  return null
}

/**
 * Objednávka se zakázkou z pokladny = kolekce platby s `made_to_order` a
 * neprázdnými `production_lines` — PŘESNĚ podmínka, za které
 * `initialize-merchant-order` zakládá produkční objednávku (a emituje event
 * pro Potvrzení zakázky). Úmyslně ne `isMadeToOrderItem`: produkt v kategorii
 * Zakázková výroba bez profilu výroby se prodává jako běžné zboží a produkční
 * objednávku nedostane — potvrzení mu musí poslat běžná cesta.
 */
export const isCommissionCheckoutOrder = (
  order: Pick<ConfirmationOrderLike, "payment_collections"> | null | undefined
): boolean =>
  (order?.payment_collections ?? []).some(
    (collection) =>
      Boolean(collection?.metadata?.made_to_order) &&
      Array.isArray(collection?.metadata?.production_lines) &&
      (collection!.metadata!.production_lines as unknown[]).length > 0
  )

/** Fotky zadání: z řádků objednávky i z diáře (zápisy zákazníka), bez duplicit, jen https. */
export const briefPhotosOf = (
  items: ConfirmationOrderLike["items"],
  notes: ConfirmationNoteLike[] | null | undefined,
  limit = 3
): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (value: unknown) => {
    const url = text(value)
    if (!/^https:\/\//i.test(url) || seen.has(url)) return
    seen.add(url)
    out.push(url)
  }
  for (const item of items ?? []) {
    const mto = (item?.metadata as any)?.made_to_order
    if (mto && typeof mto === "object" && Array.isArray(mto.photos)) {
      mto.photos.forEach(push)
    }
  }
  for (const note of notes ?? []) {
    if (note?.created_by !== "customer") continue
    if (Array.isArray(note.images)) note.images.forEach(push)
    push(note.image_url)
  }
  return out.slice(0, limit)
}

/**
 * Vstup generátoru. `warnings` jsou věci, které volající zaloguje (chybějící
 * fakt DPH apod.) — PDF se přesto vyrobí, jen bez té věty.
 */
export const confirmationFieldsFor = ({
  order,
  productionOrder,
  profile,
  facts,
  manifest = LEGAL_MANIFEST,
  notes,
}: ConfirmationFieldsArgs): { fields: CommissionConfirmationInput; warnings: string[] } => {
  const warnings: string[] = []
  const meta = order.metadata ?? {}
  const items = (order.items ?? []).filter((item): item is NonNullable<typeof item> => Boolean(item))
  const goods = items.filter((item) => !isServiceLine(item))
  const services = items.filter((item) => isServiceLine(item))
  /*
   * Zakázka = položka (LEGAL_AUDIT § 0c, Z-A): zakázka s `line_item_id` potvrzuje
   * JEDEN řádek objednávky; všechno ostatní (další zakázky i běžné zboží) jsou
   * „další položky". Legacy zakázka (bez řádku) = celá objednávka jako dřív:
   * všechny zakázkové řádky dohromady, běžné zboží jako „další zboží".
   */
  /*
   * Bez zakázky se sází KLASICKÁ kupní smlouva (24. 10. 2026). Pozná se podle
   * toho, že žádná produkční objednávka nepřišla — ne podle metadat košíku,
   * která u běžného zboží vůbec nevznikají. Zakázková varování, zálohu,
   * dobu výroby a výjimku z odstoupení pak celé přeskočí.
   */
  const jeZakazka = Boolean(productionOrder)

  const perCommission = Boolean(productionOrder?.line_item_id)
  const ownLine = perCommission
    ? goods.find((item) => item.id === productionOrder?.line_item_id) ?? null
    : null
  const commissionLines = perCommission
    ? ownLine
      ? [ownLine]
      : []
    : goods.filter((item) => isMadeToOrderItem(item))
  const otherLines = perCommission
    ? goods.filter((item) => item !== ownLine)
    : goods.filter((item) => !isMadeToOrderItem(item))
  // Víc položek v objednávce → ceny PRO TUTO POLOŽKU, doprava jen jako informace.
  const perItem = perCommission && goods.length > 1
  if (perCommission && !ownLine) {
    warnings.push(
      `Řádek objednávky ${productionOrder?.line_item_id} k zakázce v objednávce není (odebraný úpravou?) — PDF bere název a cenu ze snímku zakázky.`
    )
  }

  // ── Objednávka a OP ───────────────────────────────────────────────────────
  const termsVersionRaw = orderDocumentVersion(
    "obchodni-podminky",
    meta.terms_version,
    order.created_at ?? null,
    manifest
  )
  const placedAt = order.created_at ? new Date(order.created_at) : null
  const placedAtIso =
    placedAt && !Number.isNaN(placedAt.getTime())
      ? placedAt.toISOString()
      : // Bez data objednávky (nemělo by nastat) — pevný bod, ať PDF zůstane deterministické.
        "1970-01-01T00:00:00.000Z"
  if (!order.created_at) warnings.push(`Objednávka nemá datum vytvoření — PDF ho uvádí jako „neuvedeno".`)

  // ── Prodávající (právní údaje) ────────────────────────────────────────────
  /*
   * Zápis do veřejného rejstříku (§ 435 OZ) — povinný údaj na obchodních
   * listinách, a potvrzení smlouvy jí je. Bez úřadu se uvede aspoň sám
   * zápis; s úřadem celá věta.
   */
  const registerAuthority = text(facts?.["seller.register"])
  if (!registerAuthority) {
    warnings.push(
      `Právní údaj „seller.register" (úřad vedoucí živnostenský rejstřík) chybí — dokument uvede zápis bez úřadu (§ 435 OZ).`
    )
  }

  const seller = {
    brand: "Keramická zahrada",
    name: orDefault(facts?.["seller.name"]),
    address: orDefault(facts?.["seller.address"]),
    ico: orDefault(facts?.["seller.ico"]),
    email: orDefault(facts?.["seller.email"]),
    phone: orDefault(facts?.["seller.phone"]),
    register: registerAuthority
      ? `zapsaná v živnostenském rejstříku vedeném ${registerAuthority}`
      : "zapsaná v živnostenském rejstříku",
  }
  for (const key of ["seller.name", "seller.address", "seller.ico", "seller.email", "seller.phone"] as const) {
    if (!text(facts?.[key])) warnings.push(`Právní údaj „${key}" chybí — v Potvrzení zakázky je „neuvedeno".`)
  }

  // ── Kupující ──────────────────────────────────────────────────────────────
  const customer = {
    name: nameOf(order.billing_address, order.shipping_address, order.customer) || NEUVEDENO,
    address: addressLine(order.billing_address) || addressLine(order.shipping_address) || NEUVEDENO,
    email: orDefault(order.email || order.customer?.email),
    phone: orDefault(
      order.billing_address?.phone || order.shipping_address?.phone || order.customer?.phone
    ),
  }

  // ── Co vyrábíme ───────────────────────────────────────────────────────────
  const titled = commissionLines.map((item) => {
    const title = text(item.product_title) || text(item.title) || NEUVEDENO
    const variant = text(item.variant_title)
    const suffix = isDefaultVariantTitle(variant) ? "" : ` — ${variant}`
    const quantity = toNumber(item.quantity)
    return { title, suffix: quantity > 1 ? `${suffix} · ${quantity} ks` : suffix }
  })
  // Zakázka bez řádku v objednávce (odebraný úpravou) — snímek názvu a množství ze zakázky.
  const snapshotQuantity = toNumber(productionOrder?.line_quantity)
  const snapshotTitle = text(productionOrder?.line_title)
  const product =
    titled.length === 1
      ? { title: titled[0].title, variant_suffix: titled[0].suffix }
      : titled.length > 1
        ? {
            title: titled.map((line) => `${line.title}${line.suffix}`).join("; "),
            variant_suffix: "",
          }
        : perCommission && snapshotTitle
          ? { title: snapshotTitle, variant_suffix: snapshotQuantity > 1 ? ` · ${snapshotQuantity} ks` : "" }
          : { title: NEUVEDENO, variant_suffix: "" }
  if (jeZakazka && !titled.length && product.title === NEUVEDENO) {
    warnings.push(`Objednávka nemá žádný zakázkový řádek — PDF uvádí výrobek jako „neuvedeno".`)
  }

  const specifications = commissionLines
    .map((item) => {
      const mto = (item.metadata as any)?.made_to_order
      return mto && typeof mto === "object" ? text(mto.specification) || text(mto.note) : ""
    })
    .filter(Boolean)
  const brief = {
    text: text(productionOrder?.customer_note) || specifications.join("\n\n") || NEUVEDENO,
    // Fotky zadání: u zakázky-položky jen její řádek a její diář (volající ho filtruje).
    photos: briefPhotosOf(perCommission ? commissionLines : items, notes),
  }

  // ── Cena a platby ─────────────────────────────────────────────────────────
  const currencyCode = String(order.currency_code || productionOrder?.currency_code || "czk").toLowerCase()
  const currency = currencyCode === "czk" ? "Kč" : currencyCode.toUpperCase()
  const sum = (lines: typeof goods) => round2(lines.reduce((acc, item) => acc + toNumber(item.total), 0))
  // Cena položky: u zakázky-položky ze snímku `line_total` (řádek mohl zmizet úpravou), jinak z řádků.
  const itemTotal =
    perCommission && productionOrder?.line_total !== null && productionOrder?.line_total !== undefined
      ? round2(toNumber(productionOrder.line_total))
      : sum(commissionLines)
  const otherTotal = sum(otherLines)
  const shippingTotal = round2(toNumber(order.shipping_total) + sum(services))
  const total = perItem ? itemTotal : round2(toNumber(order.total))

  const shippingNames = (order.shipping_methods ?? [])
    .map((method) => text(method?.name))
    .filter(Boolean)
  const shipping = { method: shippingNames.join(", ") || NEUVEDENO }

  const depositRequest = (productionOrder?.payment_requests ?? []).find(
    (request) => request?.type === "deposit"
  )
  /*
   * U zakázky je to pokladní kolekce označená `made_to_order` (zálohová),
   * u běžné objednávky prostě ta, kterou objednávka má. Dřív se hledala jen
   * ta zakázková, takže klasická smlouva hlásila „Zaplaceno 0".
   */
  const checkoutCollection = jeZakazka
    ? (order.payment_collections ?? []).find((collection) => collection?.metadata?.made_to_order)
    : (order.payment_collections ?? [])[0]
  const collectionPaid =
    Boolean(checkoutCollection) &&
    (["authorized", "completed", "captured"].includes(String(checkoutCollection?.status || "").toLowerCase()) ||
      (Array.isArray(checkoutCollection?.payments) && checkoutCollection!.payments!.length > 0))
  const depositPaid = depositRequest?.status === "paid"
  /*
   * Zaplaceno při objednávce. U zakázky-položky ve víc-položkové objednávce
   * jen to, co připadá NA TUTO POLOŽKU: záloha zakázky bez části, kterou první
   * zakázka nese za objednávku (běžné zboží, poštovné) —
   * `lib/made-to-order/commission-money`. Jinak celá pokladní platba, jak dřív.
   */
  const paid = depositPaid
    ? perItem
      ? commissionMoney(productionOrder ?? {}, productionOrder?.payment_requests ?? []).deposit_paid
      : round2(toNumber(depositRequest?.amount))
    : collectionPaid && !perItem
      ? round2(toNumber(checkoutCollection?.amount))
      : 0
  if (jeZakazka && !depositPaid && !collectionPaid) {
    warnings.push(`Záloha u zakázky zatím není zaplacená — PDF uvádí zaplaceno 0 a datum platby „neuvedeno".`)
  }

  const depositPercentage = toNumber(productionOrder?.deposit_percentage)
  const contractualDeposit =
    productionOrder?.deposit_amount !== null && productionOrder?.deposit_amount !== undefined
      ? round2(toNumber(productionOrder.deposit_amount))
      : // Starší zakázky (před 20. 10. 2026) částku nenesou — je to procento z ceny
        // zakázkových řádků, nejvýš jejich cena (stejný výpočet jako backend).
        Number.isFinite(depositPercentage) && depositPercentage > 0
        ? Math.min(itemTotal, round2((itemTotal * depositPercentage) / 100))
        : null
  const balance = round2(Math.max(0, total - paid))

  const sessions = (order.payment_collections ?? []).flatMap((collection) => collection?.payment_sessions ?? [])
  const providerIds = sessions
    .filter((session) => session && session.status !== "canceled")
    .map((session) => String(session?.provider_id ?? ""))
  const method =
    providerIds.map(providerLabel).find((label): label is string => Boolean(label)) ??
    (text(depositRequest?.selected_method) ? `platební metoda ${text(depositRequest?.selected_method)}` : NEUVEDENO)

  const price = {
    currency,
    item: formatCzechMoney(itemTotal),
    // U položky ve víc-položkové objednávce se „další zboží" netiskne — Celkem je jen tato položka.
    other: !perItem && otherLines.length ? formatCzechMoney(otherTotal) : null,
    shipping: formatCzechMoney(shippingTotal),
    total: formatCzechMoney(total),
    paid: formatCzechMoney(paid),
    deposit: contractualDeposit === null ? NEUVEDENO : formatCzechMoney(contractualDeposit),
    balance: formatCzechMoney(balance),
    per_item: perItem,
    note: perItem
      ? `Objednávka obsahuje další položky; doprava a balné ${formatCzechMoney(shippingTotal)} ${currency} se platí jednou s objednávkou.`
      : null,
  }
  if (jeZakazka && contractualDeposit === null) {
    warnings.push(`Produkční objednávka nemá smluvní zálohu (deposit_amount ani deposit_percentage) — PDF uvádí „neuvedeno".`)
  }

  const deposit = {
    method,
    /*
     * U zakázky datum ze zálohové žádosti. U běžné objednávky žádná taková
     * žádost není — platba v pokladně proběhne v okamžiku objednávky, takže
     * se uvádí její čas. Nezaplacená objednávka (převod, dobírka) nemá co
     * datovat.
     */
    paid_at: jeZakazka
      ? depositPaid
        ? formatCzechDateTime(depositRequest?.paid_at)
        : NEUVEDENO
      : collectionPaid
        ? formatCzechDateTime(order.created_at)
        : NEUVEDENO,
  }

  // ── Výroba ────────────────────────────────────────────────────────────────
  const days = (value: unknown) => {
    const numeric = toNumber(value)
    return Number.isFinite(numeric) && numeric > 0 && value !== null && value !== undefined
      ? String(Math.round(numeric))
      : NEUVEDENO
  }
  const mto = {
    deposit:
      Number.isFinite(depositPercentage) && productionOrder?.deposit_percentage !== null && productionOrder?.deposit_percentage !== undefined
        ? new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(depositPercentage)
        : NEUVEDENO,
    lead_time_min: days(profile?.production_time_min_days),
    lead_time_max: days(profile?.production_time_max_days),
  }
  if (jeZakazka && mto.lead_time_max === NEUVEDENO) {
    warnings.push(`Profil výroby nemá lhůtu dokončení (production_time_max_days) — PDF uvádí „neuvedeno".`)
  }

  // ── DPH, odkazy, souhlasy ─────────────────────────────────────────────────
  const vat = vatNoteFor(facts?.["vat.status"])
  if (vat.warning) warnings.push(vat.warning)

  // Souhlasy: serverové razítko objednávky (`terms_recorded_at`, subscriber
  // order-consent) platí pro oba souhlasy — zapsaly se spolu v jednom patchi
  // pokladny. Bez razítka čas z prohlížeče (`*_at`).
  const recordedAt = text(meta.terms_recorded_at)
  const termsAt = recordedAt || text(meta.terms_accepted_at)
  const mtoAck = text(meta.made_to_order_ack_at)
  const consent = {
    terms_at: termsAt ? formatCzechDateTime(termsAt) : NEUVEDENO,
    mto_at: mtoAck ? formatCzechDateTime(recordedAt || mtoAck) : NEUVEDENO,
  }
  if (!termsAt) warnings.push(`Objednávka nemá čas souhlasu s OP (terms_accepted_at) — PDF uvádí „neuvedeno".`)
  if (jeZakazka && !mtoAck) warnings.push(`Objednávka nemá poučení o zakázce (made_to_order_ack_at) — PDF uvádí „neuvedeno".`)

  const confirmedAt = productionOrder?.created_at ?? null

  /*
   * Bez zakázky se sází KLASICKÁ kupní smlouva. Rozpoznává se podle toho, že
   * žádná produkční objednávka nepřišla — ne podle metadat košíku, která
   * u běžného zboží vůbec nevznikají.
   */
  const kind: "zakazka" | "objednavka" = productionOrder ? "zakazka" : "objednavka"

  /*
   * Položky — u klasické smlouvy nahrazují zadání; službové řádky (doprava,
   * balné) sem nepatří, ty nese cenová tabulka. Měnu připojuje až generátor,
   * stejně jako u ostatních částek.
   */
  const confirmationItems = goods.map((item) => {
    const nazev = text(item.product_title) || text(item.title) || NEUVEDENO
    const varianta = text(item.variant_title)
    const mnozstvi = Math.trunc(toNumber(item.quantity) || 1)
    return {
      title: isDefaultVariantTitle(varianta) ? nazev : `${nazev} — ${varianta}`,
      quantity: mnozstvi > 1 ? `${mnozstvi}×` : "",
      amount: formatCzechMoney(toNumber(item.total)),
    }
  })

  const dispatch =
    typeof facts?.["delivery.dispatchTime"] === "string" &&
    facts["delivery.dispatchTime"].trim()
      ? facts["delivery.dispatchTime"].trim()
      : NEUVEDENO
  if (kind === "objednavka" && dispatch === NEUVEDENO) {
    warnings.push(
      `Chybí údaj „delivery.dispatchTime" — potvrzení objednávky uvádí lhůtu odeslání jako „neuvedeno".`
    )
  }

  /* § 1820 odst. 1 písm. g) OZ — u zboží, které nelze vrátit obvyklou
     poštovní cestou (a křehká keramika takové je), musí zákazník znát
     odhad nákladů na vrácení. */
  const returnCost = text(facts?.["withdrawal.returnCostEstimate"])
  if (kind === "objednavka" && !returnCost) {
    warnings.push(
      `Chybí údaj „withdrawal.returnCostEstimate" — potvrzení objednávky neuvede odhad nákladů na vrácení (§ 1820 odst. 1 písm. g) OZ).`
    )
  }

  return {
    fields: {
      kind,
      items: confirmationItems,
      delivery: { dispatch, return_cost: returnCost },
      order: {
        number: order.display_id !== null && order.display_id !== undefined ? `#${order.display_id}` : NEUVEDENO,
        placed_at: formatCzechDateTime(order.created_at),
        // Potvrzena = okamžik, kdy vznikla produkční objednávka (těsně před
        // odesláním tohoto potvrzení) — stálá hodnota, ať opakované vygenerování
        // dá stejný otisk.
        confirmed_at: formatCzechDateTime(confirmedAt),
        placed_at_iso: placedAtIso,
      },
      terms: {
        version: termsVersionRaw ? formatVersionDate(termsVersionRaw) : NEUVEDENO,
        version_raw: termsVersionRaw,
      },
      seller,
      customer,
      product,
      brief,
      shipping,
      price,
      deposit,
      mto,
      vat: { note: vat.note },
      links: {
        complaints: legalPageUrl("reklamacni-rad", manifest),
        withdrawal: legalPageUrl("odstoupeni-od-smlouvy", manifest),
      },
      consent,
    },
    warnings,
  }
}
