import crypto from "crypto"

/**
 * Čisté funkce poukazů — kód, platnost, stav. Bez frameworku, testují se
 * samostatně (`__tests__/gift-voucher.unit.spec.ts`).
 */

/** Bez 0/O, 1/I/L a 5/S — kód se opisuje z papíru a diktuje do telefonu. */
const ALPHABET = "ABCDEFGHJKMNPQRTUVWXYZ2346789"

/**
 * 8 znaků, např. `7HQ4M2XP` — 29⁸ ≈ 5·10¹¹ kombinací. Na tisíc vydaných
 * poukazů je šance trefit platný kód zkoušením zhruba 1 : 500 milionů na
 * pokus, takže se nedá uhodnout ani „vypůjčit" od jiného poukazu. Kód je
 * zároveň slevovým kódem v obchodě (`lib/gift-voucher-promotion.ts`).
 * `crypto.randomBytes` + zamítání nad násobkem abecedy = rovnoměrné rozdělení.
 */
export const VOUCHER_CODE_LENGTH = 8

export const generateVoucherCode = (random: (n: number) => Buffer = crypto.randomBytes): string => {
  const limit = 256 - (256 % ALPHABET.length)
  let out = ""
  while (out.length < VOUCHER_CODE_LENGTH) {
    for (const byte of random(16)) {
      if (byte < limit && out.length < VOUCHER_CODE_LENGTH) out += ALPHABET[byte % ALPHABET.length]
    }
  }
  return out
}

/**
 * Kód tak, jak ho kdo napsal („7hq4 m2xp", „7HQ4-M2XP ") → tvar v databázi
 * i ve slevovém kódu. Velikost písmen, mezery a pomlčky nehrají roli.
 */
export const normalizeVoucherCode = (raw: string): string =>
  String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")

/** Vypadá to jako kód poukazu (8 znaků z abecedy poukazů)? */
export const looksLikeVoucherCode = (raw: string): boolean => {
  const code = normalizeVoucherCode(raw)
  return code.length === VOUCHER_CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c))
}

/** Pro čtení na papíře a v e-mailu: `7HQ4 M2XP`. Do pole se dá zadat i s mezerou. */
export const formatVoucherCode = (code: string): string =>
  code.length === VOUCHER_CODE_LENGTH ? `${code.slice(0, 4)} ${code.slice(4)}` : code

/** Kampaň poukazu v modulu akcí — podle ní se poukazy schovávají ze seznamu slev. */
export const VOUCHER_CAMPAIGN_PREFIX = "gift-voucher-"

/** Posun Prahy proti UTC v daný okamžik, v minutách (60 v zimě, 120 v létě). */
const pragueOffsetMinutes = (at: Date): number => {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Prague", timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+1"
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!m) return 60
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

/**
 * „RRRR-MM-DD" → 23:59:59 toho dne v Praze (jako okamžik v UTC). Poukaz platí
 * celý uvedený den v létě i v zimě a datum v administraci, na webu
 * i v e-mailech je stejné.
 */
export const pragueEndOfDay = (isoDate: string): Date => {
  const [y, mo, d] = isoDate.split("-").map(Number)
  const guess = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59))
  return new Date(guess.getTime() - pragueOffsetMinutes(guess) * 60_000)
}

/** Datum (RRRR-MM-DD) okamžiku v Praze. */
export const pragueDateOf = (at: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(at)

/** Konec platnosti: o `months` měsíců později, konec toho dne v Praze. */
export const defaultValidUntil = (from: Date, months = 12): Date => {
  const [y, m, d] = pragueDateOf(from).split("-").map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, d))
  return pragueEndOfDay(target.toISOString().slice(0, 10))
}

/** „12 měsíců", „1 rok", „2 roky" → měsíce. Neznámý tvar → 12. */
export const monthsFromValidityText = (text: string | null | undefined): number => {
  const t = String(text ?? "").toLowerCase()
  const n = Number((t.match(/\d+/) ?? ["1"])[0]) || 1
  if (/rok|let/.test(t)) return n * 12
  if (/měs|mes/.test(t)) return n
  return 12
}

export type VoucherState = "pending_payment" | "active" | "used" | "expired" | "cancelled" | "refunded"

/** Stav, jak ho ukazuje administrace i stránka poukazu. */
export const voucherState = (
  v: {
    status: string
    payment_status: string
    balance: number
    valid_until: Date | string
    refunded_at?: Date | string | null
  },
  now: Date = new Date()
): VoucherState => {
  // Vrácené peníze mají přednost před vším: poukaz je spotřebovaný navždy.
  if (v.refunded_at) return "refunded"
  if (v.status === "cancelled") return "cancelled"
  if (v.payment_status !== "paid") return "pending_payment"
  if (Number(v.balance) <= 0) return "used"
  if (new Date(v.valid_until).getTime() < now.getTime()) return "expired"
  return "active"
}

export const VOUCHER_STATE_LABEL: Record<VoucherState, string> = {
  pending_payment: "Čeká na platbu",
  active: "Platný",
  used: "Vyčerpaný",
  expired: "Propadlý",
  cancelled: "Zrušený",
  refunded: "Peníze vráceny",
}

/** Hodnoty, které Lucie nabízí (odpověď z 20. 10.: „500, 1000, 1500…"), libovolná částka jde taky. */
export const VOUCHER_VALUE_LIMITS = { min: 100, max: 50000 } as const
