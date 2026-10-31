/**
 * Název země v jazyce té země — „Deutschland“, ne „Germany“.
 *
 * Medusa posílá `display_name` anglicky, takže přepínač zemí v navigaci
 * hlásil Čechovi „Czech Republic“ a Němci „Germany“. Vlajka vedle anglického
 * názvu je zvláštní dvakrát: kdo hledá svou zem, hledá ji tak, jak se jmenuje
 * doma (přání Matěje 31. 10. 2026).
 *
 * Jména nepíšeme ručně — bere se `Intl.DisplayNames` v jazyce té země, takže
 * stačí vědět, kterým jazykem se kde mluví. Ruční seznam by stárnul a u
 * diakritiky („Česko“, „Ísland“) by se chyboval.
 *
 * Když zemi neznáme nebo `Intl` selže (starý prohlížeč), vrátí se to, co
 * přišlo z Medusy — radši anglicky než prázdno.
 */

/**
 * Úřední (nebo nejrozšířenější) jazyk země. U víc jazyků ten, kterým se
 * země sama nejčastěji píše: Belgie nizozemsky, Švýcarsko německy.
 */
const COUNTRY_LOCALE: Record<string, string> = {
  at: "de",
  be: "nl",
  bg: "bg",
  ch: "de",
  cy: "el",
  cz: "cs",
  de: "de",
  dk: "da",
  ee: "et",
  es: "es",
  fi: "fi",
  fr: "fr",
  gb: "en",
  gr: "el",
  hr: "hr",
  hu: "hu",
  ie: "en",
  is: "is",
  it: "it",
  li: "de",
  lt: "lt",
  lu: "fr",
  lv: "lv",
  mt: "mt",
  nl: "nl",
  no: "nb",
  pl: "pl",
  pt: "pt",
  ro: "ro",
  rs: "sr",
  se: "sv",
  si: "sl",
  sk: "sk",
  ua: "uk",
  us: "en",
}

export const countryEndonym = (
  iso2: string | null | undefined,
  fallback?: string | null
): string => {
  const code = String(iso2 ?? "").trim().toLowerCase()
  const zaloha = (fallback ?? "").trim() || code.toUpperCase()
  if (!code) return zaloha

  const locale = COUNTRY_LOCALE[code]
  if (!locale) return zaloha

  try {
    const name = new Intl.DisplayNames([locale], { type: "region" }).of(
      code.toUpperCase()
    )
    /* `of()` vrací zpátky kód, když jméno nezná — to by byl horší popisek
       než anglický název z Medusy. */
    return name && name.toUpperCase() !== code.toUpperCase() ? name : zaloha
  } catch {
    return zaloha
  }
}
