/**
 * Poptávka zakázky ze stránky Výroba → `POST /store/commission-inquiries`.
 *
 * ## Proč z prohlížeče, a ne server action
 *
 * Stejně jako kontaktní formulář (`modules/layout/ContactDialog`) jde
 * poptávka z prohlížeče PŘÍMO na backend s publishable key:
 * - backend omezuje počet poptávek i podle IP a skutečnou IP člověka vidí
 *   jen tehdy, když požadavek nejde přes server obchodu (ten by mu všechny
 *   poptávky poslal z jedné adresy),
 * - fotky jedou jako base64 v JSON a server action má vlastní strop těla
 *   (12 MB v `next.config.mjs`) — druhá brána navíc, o kterou by šlo zakopnout.
 *
 * Proto tenhle soubor nemá `"use server"` ani `server-only`: volá ho klientský
 * formulář (`modules/vyroba/InquiryForm/form.tsx`).
 *
 * Stropy níž zrcadlí backend (`backend/src/lib/commission-inquiry.ts`) —
 * formulář podle nich hlídá vstup dřív, než ho odešle. Rozhodující je backend.
 */

export const INQUIRY_LIMITS = {
  description: 4000,
  dimensions: 300,
  motif: 500,
  deadline: 200,
  name: 200,
  email: 320,
  phone: 40,
} as const

export const MAX_INQUIRY_PHOTOS = 6
/** Na fotku po kompresi / v originále, když ho prohlížeč zmenšit neumí. */
export const MAX_INQUIRY_PHOTO_BYTES = 6 * 1024 * 1024
/** Všechny fotky dohromady (backend: `MAX_INQUIRY_PHOTOS_TOTAL_BYTES`). */
export const MAX_INQUIRY_PHOTOS_TOTAL_BYTES = 9 * 1024 * 1024
export const INQUIRY_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic"

export type CommissionInquiryPhoto = {
  filename: string
  mime_type: string
  /** Base64 včetně `data:` předpony z prohlížeče. */
  data: string
}

export type CommissionInquiryInput = {
  description: string
  dimensions?: string
  motif?: string
  deadline?: string
  name: string
  email: string
  phone?: string
  /** Povinný, nezaškrtnutý checkbox — `true`, jinak se nic neodešle. */
  terms_accepted: true
  /** `currentTermsVersion()` — verze OP, kterou zákazník viděl. */
  terms_version: string
  photos?: CommissionInquiryPhoto[]
  /** Výrobek s cenou po domluvě, od kterého poptávka přišla. */
  product_handle?: string
  product_title?: string
  /** Honeypot. */
  website?: string
}

export type CommissionInquiryValues = {
  description: string
  dimensions: string
  motif: string
  deadline: string
  name: string
  email: string
  phone: string
  consent: boolean
}

export type CommissionInquiryField = keyof CommissionInquiryValues

export type CommissionInquiryErrors = Partial<Record<CommissionInquiryField, string>>

/** Stejně volné jako backend (zod `.email()` je přísnější — rozhodne on). */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const tooLong = (label: string, max: number) =>
  `${label} je moc dlouhé — zkraťte ho prosím na ${max} znaků.`

/**
 * Kontrola na klientovi — tytéž hlášky jako backend, ať zákazník nevidí dvě
 * různé věty pro tutéž chybu. Pořadí klíčů = pořadí polí ve formuláři
 * (první chyba dostane fokus).
 */
export const validateCommissionInquiry = (
  values: CommissionInquiryValues
): CommissionInquiryErrors => {
  const errors: CommissionInquiryErrors = {}
  const description = values.description.trim()
  const name = values.name.trim()
  const email = values.email.trim()
  const phone = values.phone.trim()

  if (!description) errors.description = "Napište prosím, co si představujete."
  else if (description.length > INQUIRY_LIMITS.description)
    errors.description = `Popis je moc dlouhý — zkraťte ho prosím na ${INQUIRY_LIMITS.description} znaků.`

  if (values.dimensions.trim().length > INQUIRY_LIMITS.dimensions)
    errors.dimensions = tooLong("Pole s rozměry", INQUIRY_LIMITS.dimensions)
  if (values.motif.trim().length > INQUIRY_LIMITS.motif)
    errors.motif = tooLong("Pole s motivem", INQUIRY_LIMITS.motif)
  if (values.deadline.trim().length > INQUIRY_LIMITS.deadline)
    errors.deadline = tooLong("Pole s termínem", INQUIRY_LIMITS.deadline)

  if (!name) errors.name = "Napište prosím své jméno."
  else if (name.length > INQUIRY_LIMITS.name) errors.name = "Jméno je moc dlouhé."

  if (!email || !EMAIL.test(email) || email.length > INQUIRY_LIMITS.email)
    errors.email = "Zkontrolujte prosím e-mail — na něj vám pošlu nabídku."

  if (phone && (phone.replace(/\D/g, "").length < 6 || phone.length > INQUIRY_LIMITS.phone))
    errors.phone = "Zkontrolujte prosím telefon, nebo ho nechte prázdný."

  if (!values.consent)
    errors.consent = "Bez souhlasu s obchodními podmínkami poptávku odeslat nejde."

  return errors
}

export type CommissionInquiryResult =
  | { ok: true }
  | { ok: false; status: number; message: string | null }

/** Hlášky backendu z téhle routy jsou česky; cizí (Medusa, proxy) anglicky. */
const looksCzech = (message: string) => /[áčďéěíňóřšťúůýž]/i.test(message)

const endpoint = () =>
  `${(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "").replace(/\/+$/, "")}/store/commission-inquiries`

export const submitCommissionInquiry = async (
  input: CommissionInquiryInput
): Promise<CommissionInquiryResult> => {
  try {
    const response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Bez publishable key odmítne backend celý jmenný prostor /store.
        ...(process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
          ? { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY }
          : {}),
      },
      body: JSON.stringify(input),
    })

    if (response.ok) return { ok: true }

    let message: string | null = null
    try {
      const body = (await response.json()) as { message?: unknown }
      if (typeof body?.message === "string" && looksCzech(body.message)) {
        message = body.message
      }
    } catch {
      // Tělo není JSON (413 z proxy apod.) — volající přeloží stav sám.
    }
    return { ok: false, status: response.status, message }
  } catch {
    return { ok: false, status: 0, message: null }
  }
}
