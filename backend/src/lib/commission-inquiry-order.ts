import { z } from "zod"
import type { InquiryRecord } from "./commission-inquiry-records"
import {
  clampContractPercentage,
  DEFAULT_CONTRACT_DEPOSIT_PERCENTAGE,
  MAX_CONTRACT_DEPOSIT_PERCENTAGE,
} from "./made-to-order/contract-deposit"
import { isPickupOption, methodDataFor } from "./made-to-order/shipping-choice"
import { DEFAULT_RATES, shipmentPrice, type ShippingRates } from "./shipping-rates"

/**
 * Objednávka z poptávky zakázky (17. 11. 2026, Matěj: „zákazník poptá kus na
 * míru, pak jde vytvořit objednávku, přijde e-mail, že je objednávka
 * založená, a dál to jede normálně").
 *
 * ## Proč objednávka „za 0 Kč s cenou po domluvě"
 *
 * Zakázku nese řádek objednávky a platební kolekce se snímkem
 * `production_lines` — přesně tak, jak ji zakládá pokladna. Z toho
 * `initialize-merchant-order` udělá zakázku (diář, Postup objednávky,
 * e-maily, faktury, štítek ČP). Cenu tu ale nikdo v pokladně nezaplatil, a
 * jediná cesta, jak zákazník zaplatí zakázku BEZ pokladny, je „Cena po
 * domluvě" (`lib/made-to-order/agreed-price`): řádek za 0 Kč, domluvená
 * cena + záloha na zakázce, e-mail s odkazy „zaplatit zálohu / celé",
 * výroba nezačne bez zaplacené zálohy. Objednávka z poptávky je proto
 * k nerozeznání od objednávky výrobku s cenou po domluvě z obchodu:
 *
 * - řádek bez varianty z katalogu (žádný „univerzální" výrobek neexistuje;
 *   zakázka se k řádku váže přes `line_item_id`, ne přes variantu),
 * - nativní doprava za 0 Kč (poštovné se platí přes zakázku —
 *   `shipping-choice.ts`, jinak by se platilo dvakrát),
 * - snímková kolekce za 0 Kč bez platby (jako pokladna u nulového košíku).
 *
 * Tady jsou jen čisté funkce (unit test bez kontejneru); zápis dělá
 * `workflows/create-inquiry-order.ts` a routa
 * `api/admin/commission-inquiries/[id]/create-order`.
 */

export const INQUIRY_ORDER_LIMITS = {
  title: 200,
  brief: 5000,
  price: 1_000_000,
  quantity: 50,
} as const

const money = (label: string) =>
  z.coerce
    .number({ message: `${label} musí být číslo.` })
    .min(0, { message: `${label} nemůže být záporné.` })
    .max(INQUIRY_ORDER_LIMITS.price, { message: `${label} je nějak vysoké — zkontrolujte ho.` })

const AddressSchema = z.object({
  address_1: z
    .string()
    .trim()
    .min(1, { message: "Doplňte ulici a číslo domu." })
    .max(200, { message: "Ulice je moc dlouhá." }),
  address_2: z.string().trim().max(200).optional().nullable(),
  city: z
    .string()
    .trim()
    .min(1, { message: "Doplňte město." })
    .max(120, { message: "Město je moc dlouhé." }),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{3}\s?\d{2}$/, { message: "PSČ má pět číslic, třeba 397 01." }),
  company: z.string().trim().max(200).optional().nullable(),
})

export const CreateInquiryOrderSchema = z
  .object({
    /** Jméno, e-mail a telefon z poptávky — majitelka je smí opravit. */
    name: z
      .string()
      .trim()
      .min(1, { message: "Doplňte jméno zákazníka." })
      .max(200, { message: "Jméno je moc dlouhé." })
      .optional(),
    email: z
      .string()
      .trim()
      .max(320, { message: "E-mail je moc dlouhý." })
      .email({ message: "Zkontrolujte e-mail zákazníka — na něj odejde potvrzení." })
      .optional(),
    phone: z.string().trim().max(40, { message: "Telefon je moc dlouhý." }).optional().nullable(),
    title: z
      .string()
      .trim()
      .min(1, { message: "Doplňte název zakázky." })
      .max(INQUIRY_ORDER_LIMITS.title, { message: "Název zakázky je moc dlouhý." }),
    brief: z
      .string()
      .trim()
      .min(1, { message: "Doplňte zadání — co se bude vyrábět." })
      .max(INQUIRY_ORDER_LIMITS.brief, { message: "Zadání je moc dlouhé." }),
    /** Cena VÝROBKU za celou zakázku v Kč. 0 = cenu pošlete později z objednávky. */
    price: money("Cena"),
    deposit_percentage: z.coerce
      .number({ message: "Záloha musí být číslo." })
      .min(1, { message: "Záloha musí být aspoň 1 %." })
      .max(MAX_CONTRACT_DEPOSIT_PERCENTAGE, {
        message: `Záloha může být nejvýš ${MAX_CONTRACT_DEPOSIT_PERCENTAGE} % ceny.`,
      })
      .optional(),
    quantity: z.coerce
      .number({ message: "Počet kusů musí být číslo." })
      .int({ message: "Počet kusů musí být celé číslo." })
      .min(1, { message: "Aspoň jeden kus." })
      .max(INQUIRY_ORDER_LIMITS.quantity, { message: "Tolik kusů najednou nejde." })
      .optional(),
    delivery: z.enum(["pickup", "post"], { message: "Vyberte dopravu." }),
    address: AddressSchema.optional().nullable(),
    /** Velikost zásilky a křehkost — z nich poštovné podle ceníku dopravy. */
    parcel_size: z.enum(["male", "velke"]).optional(),
    fragile: z.boolean().optional(),
    /** Poštovné a balné ručně; bez nich poštovné z ceníku a balné 0. */
    shipping_total: money("Poštovné").optional().nullable(),
    packaging_total: money("Balné").optional().nullable(),
    send_payment_link: z.boolean().optional(),
    /** Které fotky z poptávky převzít; bez pole všechny. */
    photo_urls: z.array(z.string().trim().url()).max(20).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.delivery === "post" && !value.address) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Pro Českou poštu doplňte doručovací adresu.",
      })
    }
  })

export type CreateInquiryOrderInput = z.infer<typeof CreateInquiryOrderSchema>

export const INVALID_INQUIRY_ORDER =
  "Zkontrolujte prosím vyplněné údaje — něco chybí, nebo je v jiném tvaru."

/** První česká hláška ze schématu; vestavěné anglické se nahradí obecnou. */
export const inquiryOrderIssueMessage = (error: z.ZodError): string => {
  const message = error.issues[0]?.message ?? ""
  return /[áčďéěíňóřšťúůýž]/i.test(message) ? message : INVALID_INQUIRY_ORDER
}

export const INQUIRY_ALREADY_ORDERED = "K téhle poptávce už objednávka existuje."

/* ---------------------------------------------------------------------------
 * Drobnosti
 * ------------------------------------------------------------------------ */

const round2 = (value: number) => Math.round(value * 100) / 100

/** „Jana Nováková" → Jana / Nováková; jedno slovo = jen křestní. */
export const splitName = (name: string): { first_name: string; last_name: string } => {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { first_name: "", last_name: "" }
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") }
}

/** PSČ ve tvaru, jaký píše pokladna („397 01"). */
export const formatPostalCode = (value: string): string => {
  const digits = String(value ?? "").replace(/\s+/g, "")
  return /^\d{5}$/.test(digits) ? `${digits.slice(0, 3)} ${digits.slice(3)}` : String(value ?? "").trim()
}

/* ---------------------------------------------------------------------------
 * Doprava
 * ------------------------------------------------------------------------ */

export type ShippingOptionLike = {
  id: string
  name?: string | null
  provider_id?: string | null
  data?: Record<string, unknown> | null
  service_zone?: { geo_zones?: Array<{ country_code?: string | null } | null> | null } | null
}

const servesCzechia = (option: ShippingOptionLike): boolean => {
  const zones = option.service_zone?.geo_zones ?? []
  // Bez zón (neúplný dotaz) neodmítat — rozhodne pak jen druh volby.
  return !zones.length || zones.some((zone) => String(zone?.country_code ?? "").toLowerCase() === "cz")
}

/**
 * Volba dopravy pro zakázku z poptávky: osobní odběr v ateliéru, nebo Česká
 * pošta na adresu v Česku (`data.id === "cp-address"`; ne Balíkovna, ne
 * zahraničí, ne zpětná zásilka). `null`, když taková volba v obchodě není.
 */
export const pickShippingOption = (
  options: ShippingOptionLike[],
  delivery: "pickup" | "post"
): ShippingOptionLike | null => {
  const usable = (options ?? []).filter(
    (option) => option && option.data?.is_return !== true && servesCzechia(option)
  )
  if (delivery === "pickup") {
    return usable.find((option) => isPickupOption(option)) ?? null
  }
  return (
    usable.find(
      (option) =>
        !isPickupOption(option) &&
        String(option.data?.id ?? "") === "cp-address" &&
        option.data?.international !== true
    ) ?? null
  )
}

/** Ceník volby (`data.rates`) doplněný výchozími cenami České pošty. */
export const ratesOf = (option: ShippingOptionLike | null | undefined): ShippingRates => ({
  ...DEFAULT_RATES.posta,
  ...(((option?.data as Record<string, unknown> | null)?.rates ?? {}) as Partial<ShippingRates>),
})

/**
 * Poštovné podle ceníku — tatáž funkce jako pokladna (`shipmentPrice`), jen
 * velikost a křehkost zadává majitelka místo razítek z výrobku.
 */
export const postageFor = (
  option: ShippingOptionLike | null | undefined,
  parcel: { parcel_size?: "male" | "velke"; fragile?: boolean }
): number =>
  shipmentPrice(ratesOf(option), [
    {
      quantity: 1,
      metadata: {
        ship_class: parcel.parcel_size ?? "male",
        ship_fragile: parcel.fragile !== false,
      },
    },
  ])

/* ---------------------------------------------------------------------------
 * Plán objednávky
 * ------------------------------------------------------------------------ */

export type InquiryOrderAddress = {
  first_name: string
  last_name: string
  phone: string
  company: string
  address_1: string
  address_2: string
  city: string
  postal_code: string
  country_code: string
}

export type InquiryOrderPlan = {
  email: string
  address: InquiryOrderAddress
  shipping_method: {
    shipping_option_id: string
    name: string
    amount: number
    data: Record<string, unknown>
  }
  personal_pickup: boolean
  item: {
    title: string
    quantity: number
    unit_price: number
    requires_shipping: boolean
    is_discountable: boolean
    metadata: Record<string, unknown>
  }
  order_metadata: Record<string, unknown>
  deposit_percentage: number
  specification: string
  photos: string[]
  /** Domluvená cena k odeslání (`sendAgreedPrice`); `null` = cenu pošle majitelka později. */
  agreed_price: {
    price: number
    deposit_percentage: number
    deposit_amount: number
    shipping_total: number
    packaging_total: number
  } | null
  /** Cena zadaná bez odeslání e-mailu — jen poznámka pro majitelku u zakázky. */
  internal_note: string | null
}

const formatKc = (value: number): string =>
  `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value)} Kč`

/**
 * ČISTÉ: poptávka + formulář → co se založí. Nesahá na kontejner; volby
 * dopravy a výchozí procento zálohy dostane zvenku.
 */
export const planInquiryOrder = (input: {
  inquiry: InquiryRecord
  form: CreateInquiryOrderInput
  shippingOption: ShippingOptionLike
  defaultDepositPercentage?: number
}): InquiryOrderPlan => {
  const { inquiry, form, shippingOption } = input
  const name = (form.name ?? inquiry.name ?? "").trim()
  const email = (form.email ?? inquiry.email ?? "").trim()
  const phone = (form.phone === undefined ? inquiry.phone : form.phone)?.trim() ?? ""
  const { first_name, last_name } = splitName(name)
  const pickup = isPickupOption(shippingOption)
  const quantity = Math.max(1, Math.floor(form.quantity ?? 1))
  const specification = form.brief.trim()

  // Fotky jen z poptávky — cizí adresu sem formulář podstrčit nemůže.
  const allowed = new Set(inquiry.photo_urls)
  const photos = (form.photo_urls ?? inquiry.photo_urls).filter((url) => allowed.has(url))

  const depositPercentage = clampContractPercentage(
    form.deposit_percentage ?? input.defaultDepositPercentage ?? DEFAULT_CONTRACT_DEPOSIT_PERCENTAGE
  )

  const address: InquiryOrderAddress = {
    first_name,
    last_name,
    phone,
    company: (!pickup && form.address?.company?.trim()) || "",
    address_1: pickup ? "" : form.address?.address_1?.trim() ?? "",
    address_2: pickup ? "" : form.address?.address_2?.trim() ?? "",
    city: pickup ? "" : form.address?.city?.trim() ?? "",
    postal_code: pickup ? "" : formatPostalCode(form.address?.postal_code ?? ""),
    country_code: "cz",
  }

  const parcel = { parcel_size: form.parcel_size ?? "male", fragile: form.fragile !== false } as const
  const shippingTotal = pickup
    ? 0
    : round2(
        form.shipping_total !== undefined && form.shipping_total !== null
          ? form.shipping_total
          : postageFor(shippingOption, parcel)
      )
  const packagingTotal = pickup ? 0 : round2(form.packaging_total ?? 0)

  const price = round2(form.price)
  const send = price > 0.005 && form.send_payment_link !== false
  const depositAmount = round2((price * depositPercentage) / 100)

  return {
    email,
    address,
    shipping_method: {
      shipping_option_id: shippingOption.id,
      name: String(shippingOption.name ?? (pickup ? "Osobní odběr" : "Česká pošta")),
      // Nativní doprava za 0 Kč — poštovné se platí přes zakázku (shipping-choice.ts).
      amount: 0,
      data: methodDataFor(shippingOption),
    },
    personal_pickup: pickup,
    item: {
      title: form.title.trim(),
      quantity,
      unit_price: 0,
      requires_shipping: true,
      is_discountable: false,
      metadata: {
        made_to_order: {
          specification,
          ...(photos.length ? { photos } : {}),
        },
        // Řádek bez výrobku z katalogu: cenu nese zakázka (cena po domluvě).
        price_on_request: true,
        commission_inquiry_id: inquiry.id,
        // Razítka zásilky jako u výrobku z košíku (lib/packaging.ts).
        ship_class: parcel.parcel_size,
        ship_fragile: parcel.fragile,
      },
    },
    order_metadata: {
      locale: "cs",
      country_code: "cz",
      commission_inquiry_id: inquiry.id,
      created_from: "commission-inquiry",
    },
    deposit_percentage: depositPercentage,
    specification,
    photos,
    agreed_price: send
      ? {
          price,
          deposit_percentage: depositPercentage,
          deposit_amount: depositAmount,
          shipping_total: shippingTotal,
          packaging_total: packagingTotal,
        }
      : null,
    internal_note:
      price > 0.005 && !send
        ? `Cena z poptávky: ${formatKc(price)}, záloha ${depositPercentage} %${
            shippingTotal > 0.005 ? `, poštovné ${formatKc(shippingTotal)}` : ""
          }${packagingTotal > 0.005 ? `, balné ${formatKc(packagingTotal)}` : ""} — zákazníkovi zatím neodeslaná.`
        : null,
  }
}

/**
 * Snímek zakázkového řádku pro platební kolekci — stejný tvar, jaký píše
 * pokladna (`prepare-made-to-order-payment`) u výrobku s cenou po domluvě:
 * vše nula, smluvní procento zálohy pro pozdější domluvenou cenu.
 */
export const inquiryProductionLine = (input: {
  lineItemId: string
  depositPercentage: number
  specification: string
}) => ({
  line_item_id: input.lineItemId,
  product_id: null,
  variant_id: null,
  line_total: 0,
  deposit_percentage: input.depositPercentage,
  deposit_amount: 0,
  contract_deposit_percentage: input.depositPercentage,
  contract_deposit_amount: 0,
  contract_line_base: 0,
  production_time_min_days: null,
  production_time_max_days: null,
  specification: input.specification || null,
})

/** Metadata snímkové kolekce (`made_to_order` + `production_lines`). */
export const inquirySnapshotCollectionMetadata = (input: {
  lineItemId: string
  depositPercentage: number
  specification: string
  inquiryId: string
}): Record<string, unknown> => ({
  made_to_order: true,
  original_cart_total: 0,
  checkout_payment_amount: 0,
  production_lines: [inquiryProductionLine(input)],
  commission_inquiry_id: input.inquiryId,
})
