import { createHash } from "crypto"
import { z } from "zod"

/**
 * Poptávka zakázky ze stránky Výroba (LEGAL_AUDIT.md §2, krok 1 doporučeného
 * procesu; §9 „Poptávkový formulář zakázky s povinným souhlasem s OP").
 *
 * ## Co poptávka je a co není
 *
 * Poptávka NENÍ objednávka ani smlouva. Zákazník popíše, co si představuje
 * (popis, rozměr, motiv, fotka místa, termín), Lucie pošle nabídku s cenou,
 * dodací lhůtou a zálohou a smlouva vzniká až potvrzením nabídky nebo
 * zaplacením zálohy (návrh článku OP „Výroba na zakázku", bod 2). Proto se
 * tu nic nezakládá v databázi: záznamem je e-mail majitelce a potvrzení
 * zákazníkovi — obě zprávy i s daty leží v tabulce notifikací Medusy.
 *
 * ## Proč souhlas s OP už u poptávky
 *
 * Zákazník tím bere na vědomí podmínky zakázky (záloha, vyloučení
 * odstoupení podle § 1837 písm. d) OZ) dřív, než mu přijde nabídka. Verze
 * OP, kterou viděl, a SERVEROVÝ čas souhlasu jdou do obou e-mailů — čas
 * z prohlížeče se nebere (dá se podvrhnout a bývá posunutý).
 *
 * Čisté funkce bez kontejneru — schéma, příprava fotek, omezovač i texty
 * e-mailů jdou ověřit unit testem (`__tests__/commission-inquiry.unit.spec.ts`).
 */

/* ---------------------------------------------------------------------------
 * Vstup
 * ------------------------------------------------------------------------ */

export const MAX_INQUIRY_PHOTOS = 6
/** Na fotku, po dekódování. Prohlížeč fotky zmenšuje na ~800 kB, tohle je pojistka. */
export const MAX_INQUIRY_PHOTO_BYTES = 6 * 1024 * 1024
/**
 * Všechny fotky dohromady, po dekódování. Base64 to nafoukne o třetinu,
 * takže tělo požadavku vyjde nejvýš ~12 MB — na to je nastavený limit těla
 * v `api/middlewares.ts` (`/store/commission-inquiries`, 14mb).
 */
export const MAX_INQUIRY_PHOTOS_TOTAL_BYTES = 9 * 1024 * 1024
export const INQUIRY_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const

/** Stropy délek — sdílí je schéma i formulář (maxLength) ve storefrontu. */
export const INQUIRY_LIMITS = {
  description: 4000,
  dimensions: 300,
  motif: 500,
  deadline: 200,
  name: 200,
  email: 320,
  phone: 40,
} as const

/** Vytočitelné číslo: aspoň 6 číslic (stejné minimum jako u změny objednávky). */
const hasEnoughDigits = (value: string) => value.replace(/\D/g, "").length >= 6

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} je moc dlouhé — zkraťte ho prosím na ${max} znaků.` })
    .optional()

const PhotoSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(1).max(100),
  /** Base64, s `data:` předponou z prohlížeče i bez ní. */
  data: z.string().min(1),
})

export type InquiryPhoto = z.infer<typeof PhotoSchema>

export const CommissionInquirySchema = z.object({
  /** „Co si představujete" — jediné povinné pole zadání. */
  description: z
    .string()
    .trim()
    .min(1, { message: "Napište prosím, co si představujete." })
    .max(INQUIRY_LIMITS.description, {
      message: `Popis je moc dlouhý — zkraťte ho prosím na ${INQUIRY_LIMITS.description} znaků.`,
    }),
  dimensions: optionalText(INQUIRY_LIMITS.dimensions, "Pole s rozměry"),
  /** Motiv / text / číslo. */
  motif: optionalText(INQUIRY_LIMITS.motif, "Pole s motivem"),
  /** Termín — volný text („do Vánoc", „nespěchá"), ne datum. */
  deadline: optionalText(INQUIRY_LIMITS.deadline, "Pole s termínem"),
  name: z
    .string()
    .trim()
    .min(1, { message: "Napište prosím své jméno." })
    .max(INQUIRY_LIMITS.name, { message: "Jméno je moc dlouhé." }),
  email: z
    .string()
    .trim()
    .max(INQUIRY_LIMITS.email, { message: "E-mail je moc dlouhý." })
    .email({ message: "Zkontrolujte prosím e-mail — na něj vám pošlu nabídku." }),
  phone: z
    .string()
    .trim()
    .max(INQUIRY_LIMITS.phone, { message: "Telefon je moc dlouhý." })
    .refine((value) => !value || hasEnoughDigits(value), {
      message: "Zkontrolujte prosím telefon, nebo ho nechte prázdný.",
    })
    .optional(),
  /** Povinný, nezaškrtnutý checkbox „Souhlasím s obchodními podmínkami". */
  terms_accepted: z.literal(true, {
    message: "Bez souhlasu s obchodními podmínkami poptávku odeslat nejde.",
  }),
  /**
   * Verze OP, kterou zákazník viděl (`currentTermsVersion()` ve storefrontu,
   * datum účinnosti). Backend registr OP nemá, tak ji jen zapíše; „unknown"
   * = storefront zatím žádnou verzi nemá.
   */
  terms_version: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2}|unknown)$/, { message: "Neplatná verze podmínek." })
    .optional(),
  photos: z
    .array(PhotoSchema)
    .max(MAX_INQUIRY_PHOTOS, {
      message: `Přiložit jde nejvýš ${MAX_INQUIRY_PHOTOS} fotek.`,
    })
    .optional(),
  /** Honeypot — člověk pole nevidí; vyplněné = robot. */
  website: z.string().max(400).optional(),
})

export type CommissionInquiryInput = z.infer<typeof CommissionInquirySchema>

export const INVALID_INQUIRY =
  "Zkontrolujte prosím vyplněné údaje — něco chybí, nebo je v jiném tvaru."

/** První srozumitelná hláška ze schématu (všechny vlastní jsou česky). */
export const firstIssueMessage = (error: z.ZodError): string => {
  const issue = error.issues[0]
  const message = issue?.message ?? ""
  // Vestavěné hlášky zodu jsou anglicky („Invalid input…") — ty zákazníkovi
  // neukazujeme, jen vlastní české.
  return /[áčďéěíňóřšťúůýž]/i.test(message) ? message : INVALID_INQUIRY
}

/**
 * Honeypot se kontroluje NA SYROVÉM TĚLE, ještě před schématem: robot, který
 * vyplní všechno, často neprojde validací (třeba nezaškrtne souhlas) — a 400
 * by mu prozradilo, že ho formulář odmítl. Takhle dostane tiché „ok".
 */
export const isHoneypotFilled = (body: unknown): boolean => {
  const value = (body as { website?: unknown } | null | undefined)?.website
  return typeof value === "string" && value.trim().length > 0
}

/* ---------------------------------------------------------------------------
 * Fotky
 * ------------------------------------------------------------------------ */

export type PreparedInquiryFile = {
  filename: string
  mimeType: string
  /** Base64 bez předpony — tak ho chce File modul (jako /admin/uploads). */
  content: string
  access: "public"
}

/**
 * Plochý tvar, ne rozlišené sjednocení: backend nemá `strictNullChecks`,
 * takže by se `ok: true | false` v routě nezúžilo.
 */
export type PreparedPhotos = {
  ok: boolean
  files: PreparedInquiryFile[]
  totalBytes: number
  /** Česká hláška pro zákazníka, když `ok` je `false`. */
  message?: string
}

const refusePhotos = (message: string): PreparedPhotos => ({
  ok: false,
  files: [],
  totalBytes: 0,
  message,
})

const decodeBase64 = (data: string): Buffer => {
  const comma = data.indexOf(",")
  const payload = data.startsWith("data:") && comma > -1 ? data.slice(comma + 1) : data
  return Buffer.from(payload, "base64")
}

/**
 * Sedí obsah s deklarovaným typem? Typ posílá prohlížeč, takže se mu nevěří:
 * do veřejného úložiště nesmí pod „image/jpeg" projít HTML nebo spustitelný
 * soubor. Kontrolují se jen hlavičky formátů, které přijímáme.
 */
export const matchesImageSignature = (mime: string, buffer: Buffer): boolean => {
  switch (mime) {
    case "image/jpeg":
      return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    case "image/png":
      return (
        buffer.length > 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      )
    case "image/webp":
      return (
        buffer.length > 12 &&
        buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
        buffer.subarray(8, 12).toString("latin1") === "WEBP"
      )
    case "image/heic":
      // ISO BMFF: velikost boxu (4 B) a pak „ftyp".
      return buffer.length > 12 && buffer.subarray(4, 8).toString("latin1") === "ftyp"
    default:
      return false
  }
}

/** Název souboru, který se dá dát do bucketu, ať telefon fotku pojmenoval jakkoli. */
export const safeInquiryFileName = (filename: string): string => {
  const cleaned = filename
    .normalize("NFD")
    // Kombinující diakritika (U+0300–U+036F) po rozkladu NFD.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-100)
  return `poptavka-${cleaned || "foto"}`
}

/**
 * Ověří fotky (typ, obsah, velikost jednotlivě i dohromady) a připraví je
 * pro File modul. Na rozdíl od reklamací se špatná fotka nepřeskakuje mlčky:
 * formulář je ještě otevřený, zákazník ji může vyměnit — a poptávka bez
 * fotky, o které si myslí, že ji poslal, je horší než jasná hláška.
 */
export const preparePhotos = (photos: InquiryPhoto[]): PreparedPhotos => {
  if (photos.length > MAX_INQUIRY_PHOTOS) {
    return refusePhotos(`Přiložit jde nejvýš ${MAX_INQUIRY_PHOTOS} fotek.`)
  }

  const files: PreparedInquiryFile[] = []
  let totalBytes = 0

  for (const photo of photos) {
    const mime = photo.mime_type.trim().toLowerCase()
    if (!(INQUIRY_PHOTO_TYPES as readonly string[]).includes(mime)) {
      return refusePhotos("Přiložte prosím fotku ve formátu JPG, PNG, WEBP nebo HEIC.")
    }

    const buffer = decodeBase64(photo.data)
    if (!buffer.length) {
      return refusePhotos("Jedna z fotek dorazila prázdná. Zkuste ji přidat znovu.")
    }
    if (buffer.length > MAX_INQUIRY_PHOTO_BYTES) {
      return refusePhotos("Fotka je příliš velká — pošlete prosím menší než 6 MB.")
    }
    if (!matchesImageSignature(mime, buffer)) {
      return refusePhotos(
        "Jeden ze souborů není fotka, za kterou se vydává. Přidejte ho prosím znovu."
      )
    }

    totalBytes += buffer.length
    if (totalBytes > MAX_INQUIRY_PHOTOS_TOTAL_BYTES) {
      return refusePhotos(
        "Fotky jsou dohromady příliš velké. Přiložte jich prosím méně, zbytek mi můžete poslat e-mailem."
      )
    }

    files.push({
      filename: safeInquiryFileName(photo.filename),
      mimeType: mime,
      content: buffer.toString("base64"),
      access: "public",
    })
  }

  return { ok: true, files, totalBytes }
}

/* ---------------------------------------------------------------------------
 * Omezovač
 * ------------------------------------------------------------------------ */

/**
 * Klouzavé okno v paměti procesu — stejná výměna jako u kontaktního formuláře
 * (`api/store/contact`): restart počítadla vynuluje a druhá instance o nich
 * neví, což je u poptávkového formuláře přijatelné. Mapa má strop velikosti,
 * ať se z omezovače nedá udělat žrout paměti (úklid při zápisu, ne časovačem).
 */
export type WindowLimiter = {
  readonly name: string
  /** Vejde se ještě jeden pokus? Nic nezapisuje. */
  allows: (key: string, now: number) => boolean
  /** Zapíše pokus. */
  record: (key: string, now: number) => void
  /** Kolik klíčů si pamatuje (pro testy). */
  size: () => number
}

export const createWindowLimiter = (options: {
  name: string
  windowMs: number
  limit: number
  maxKeys?: number
}): WindowLimiter => {
  const { name, windowMs, limit, maxKeys = 5000 } = options
  const hits = new Map<string, number[]>()

  const live = (key: string, now: number) =>
    (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs)

  const sweep = (now: number) => {
    const expired: string[] = []
    hits.forEach((stamps, key) => {
      if (!stamps.some((stamp) => now - stamp < windowMs)) expired.push(key)
    })
    expired.forEach((key) => hits.delete(key))

    // Když ani po vymetení není místo, jdou ven nejdéle nedotčené (Map drží
    // pořadí vložení).
    let excess = hits.size - maxKeys
    if (excess <= 0) return
    const oldest: string[] = []
    hits.forEach((_, key) => {
      if (excess > 0) {
        oldest.push(key)
        excess -= 1
      }
    })
    oldest.forEach((key) => hits.delete(key))
  }

  return {
    name,
    allows: (key, now) => live(key, now).length < limit,
    record: (key, now) => {
      const stamps = live(key, now)
      stamps.push(now)
      // Smazat a vložit znovu = klíč se posune na konec pořadí (nejčerstvější).
      hits.delete(key)
      hits.set(key, stamps)
      if (hits.size > maxKeys) sweep(now)
    },
    size: () => hits.size,
  }
}

/**
 * Projde všechna okna; pokus se zapíše jen tehdy, když se vejde do VŠECH.
 * Odmítnutý pokus nic nezapisuje — jinak by netrpělivé klepání po odmítnutí
 * okno donekonečna prodlužovalo i člověku. Vrací jméno prvního okna, které
 * odmítlo, nebo `null`.
 */
export const consumeAll = (
  checks: Array<[WindowLimiter, string]>,
  now: number
): string | null => {
  for (const [limiter, key] of checks) {
    if (!limiter.allows(key, now)) return limiter.name
  }
  for (const [limiter, key] of checks) {
    limiter.record(key, now)
  }
  return null
}

/* ---------------------------------------------------------------------------
 * Texty e-mailů
 * ------------------------------------------------------------------------ */

export type InquiryContext = {
  /** Serverový čas přijetí = čas souhlasu s OP. */
  receivedAt: Date
  /** URL nahraných fotek, v pořadí. */
  photoUrls: string[]
  /** Kolik fotek se nepodařilo uložit (výpadek úložiště). */
  photosFailed: number
}

const clean = (value: string | null | undefined): string => (value ?? "").trim()

/** „14. 10. 2026 15:32:10" v pražském čase. */
export const formatPragueDateTime = (date: Date, withSeconds = false): string => {
  const parts = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""
  const time = [get("hour"), get("minute"), ...(withSeconds ? [get("second")] : [])].join(":")
  return `${get("day")}. ${get("month")}. ${get("year")} ${time}`
}

/** „15. 10. 2026" z `2026-10-15`; `null` pro „unknown" a chybějící verzi. */
export const termsVersionLabel = (version: string | null | undefined): string | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(version))
  if (!match) return null
  return `${Number(match[3])}. ${Number(match[2])}. ${match[1]}`
}

/** „1 fotka", „3 fotky", „5 fotek". */
export const photoCountLabel = (count: number): string => {
  if (count === 1) return "1 fotka"
  if (count >= 2 && count <= 4) return `${count} fotky`
  return `${count} fotek`
}

/**
 * Odkazy v textu, který jde na NEOVĚŘENOU adresu, se zneškodní.
 *
 * Potvrzení zákazníkovi opakuje, co napsal — a adresu si do formuláře může
 * napsat kdokoli. Bez tohohle by se formulář dal použít k rozesílání cizích
 * odkazů z adresy obchodu. Majitelka dostává text celý, včetně odkazů.
 */
export const neutralizeLinks = (text: string): string =>
  text.replace(/\b(?:https?:\/\/|www\.)\S+/gi, "(odkaz)")

/** Zkrácení pro opakování v potvrzení — celé znění má majitelka. */
export const truncateForEcho = (text: string, max = 1200): string =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text

/**
 * Otisk poptávky pro klíče notifikací. Stejná poptávka odeslaná dvakrát téhož
 * dne (dvojklik, „odešlo to?") = jeden e-mail; tatáž poptávka zítra už projde
 * — kdyby otisk na dni nezávisel, Medusa by ji jako odeslanou zahodila navždy.
 */
export const inquiryDigest = (input: CommissionInquiryInput, receivedAt: Date): string => {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(receivedAt)
  const photos = input.photos ?? []
  return createHash("sha1")
    .update(
      [
        day,
        clean(input.email).toLowerCase(),
        clean(input.description),
        clean(input.dimensions),
        clean(input.motif),
        clean(input.deadline),
        String(photos.length),
        String(photos.reduce((sum, photo) => sum + photo.data.length, 0)),
      ].join("|")
    )
    .digest("hex")
}

export type InquiryOwnerNotification = {
  key: string
  title: string
  description: string
  replyTo: string
}

/**
 * Upozornění majitelce (zvonek + e-mail přes `notifyMerchant`). Šablona
 * `merchant-notification` vypisuje popis s `white-space: pre-line`, takže
 * stačí prostý text po řádcích; URL fotek e-mailoví klienti proklikají sami.
 * Odpověď ze schránky jde rovnou zákazníkovi (Reply-To).
 */
export const buildInquiryOwnerNotification = (
  input: CommissionInquiryInput,
  context: InquiryContext
): InquiryOwnerNotification => {
  const name = clean(input.name)
  const email = clean(input.email)
  const phone = clean(input.phone)
  const version = clean(input.terms_version) || "unknown"
  const versionLabel = termsVersionLabel(version)
  const digest = inquiryDigest(input, context.receivedAt)

  const optional = (label: string, value: string | undefined) =>
    `${label}: ${clean(value) || "neuvedeno"}`

  const photoLines = context.photoUrls.length
    ? [`Fotografie místa (${context.photoUrls.length}):`, ...context.photoUrls]
    : ["Fotografie místa: žádné"]

  return {
    key: `mn:commission-inquiry:${digest}`,
    title: `Poptávka zakázky — ${name}`,
    description: [
      "Nová poptávka zakázky ze stránky Výroba. Odpovědí na tento e-mail píšete rovnou zákazníkovi.",
      "",
      `Od: ${name} <${email}>`,
      `Telefon: ${phone || "neuveden"}`,
      "",
      "Co si představuje:",
      clean(input.description),
      "",
      optional("Rozměry", input.dimensions),
      optional("Motiv / text / číslo", input.motif),
      optional("Termín", input.deadline),
      "",
      ...photoLines,
      ...(context.photosFailed > 0
        ? [
            `Pozor: ${photoCountLabel(context.photosFailed)} se nepodařilo uložit — požádejte zákazníka, ať je pošle e-mailem.`,
          ]
        : []),
      "",
      `Souhlas s obchodními podmínkami: ano — verze ${
        versionLabel ? `${version} (účinná od ${versionLabel})` : "neznámá"
      }, udělen ${formatPragueDateTime(context.receivedAt, true)} (čas serveru, Praha; ${context.receivedAt.toISOString()}).`,
      "",
      "Další krok: nabídka s cenou, dodací lhůtou a výší zálohy a s poučením, že zakázku vyrobenou podle zadání nelze vrátit ve 14denní lhůtě (§ 1837 písm. d) OZ).",
    ].join("\n"),
    replyTo: email,
  }
}

export const COMMISSION_INQUIRY_TEMPLATE = "commission-inquiry-received"

/**
 * Kam má jít odpověď na potvrzení — do ateliéru, ne na odesílací adresu
 * Resendu. Kontaktní e-mail z právních údajů (administrace → Právní údaje,
 * `seller.email` — tatáž adresa, kterou uvádějí obchodní podmínky); bez
 * něj stejná záloha jako reklamační protokol (`SELLER_EMAIL`, jinak adresa
 * z OP).
 */
export const sellerContactEmail = (liveEmail?: string | null): string =>
  (liveEmail?.trim() || process.env.SELLER_EMAIL || "info@keramickazahrada.cz").trim()

/** Data šablony `commission-inquiry-received` (viz `modules/resend/emails`). */
export type CommissionInquiryEmailData = {
  customerName: string
  description: string
  dimensions: string | null
  motif: string | null
  deadline: string | null
  phone: string | null
  photoCount: number
  termsVersion: string
  termsVersionLabel: string | null
  /** ISO čas souhlasu (server). */
  consentedAt: string
  /** „14. 10. 2026 15:32" (Praha). */
  consentedAtLabel: string
  termsUrl: string | null
  privacyUrl: string | null
  /** Odpověď na potvrzení má jít do ateliéru, ne na odesílací adresu. */
  reply_to?: string
}

export type InquiryCustomerEmail = {
  template: typeof COMMISSION_INQUIRY_TEMPLATE
  to: string
  key: string
  data: CommissionInquiryEmailData
}

/**
 * Potvrzení zákazníkovi. Text, který zákazník napsal, se opakuje zkrácený
 * a se zneškodněnými odkazy (viz `neutralizeLinks`); fotky jen počtem —
 * obrázky se na neověřenou adresu neposílají.
 */
export const buildInquiryCustomerEmail = (
  input: CommissionInquiryInput,
  context: InquiryContext,
  links: { storefrontBase: string; replyTo?: string | null }
): InquiryCustomerEmail => {
  const echo = (value: string | undefined) => {
    const text = clean(value)
    return text ? truncateForEcho(neutralizeLinks(text), 300) : null
  }
  const version = clean(input.terms_version) || "unknown"
  const base = links.storefrontBase.replace(/\/+$/, "")
  const replyTo = clean(links.replyTo)

  return {
    template: COMMISSION_INQUIRY_TEMPLATE,
    to: clean(input.email),
    key: `commission-inquiry:${inquiryDigest(input, context.receivedAt)}`,
    data: {
      customerName: clean(input.name),
      description: truncateForEcho(neutralizeLinks(clean(input.description))),
      dimensions: echo(input.dimensions),
      motif: echo(input.motif),
      deadline: echo(input.deadline),
      phone: clean(input.phone) || null,
      photoCount: context.photoUrls.length,
      termsVersion: version,
      termsVersionLabel: termsVersionLabel(version),
      consentedAt: context.receivedAt.toISOString(),
      consentedAtLabel: formatPragueDateTime(context.receivedAt),
      termsUrl: base ? `${base}/smluvni-podminky#vyroba-na-zakazku` : null,
      privacyUrl: base ? `${base}/ochrana-osobnich-udaju` : null,
      ...(replyTo ? { reply_to: replyTo } : {}),
    },
  }
}
