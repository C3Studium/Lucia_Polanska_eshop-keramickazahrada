/**
 * Hláška do toastu (a do chybového řádku) — vždy česky.
 *
 * Naše texty jsou české, ale skoro každý chybový toast bral `error.message`
 * a ten u chyb, které nevznikly v našem kódu, mluví anglicky: validace
 * Medusy („Invalid request: …"), nenalezený záznam („… was not found"),
 * výpadek sítě v prohlížeči („Failed to fetch"). Majitelka pak viděla
 * angličtinu přesně ve chvíli, kdy něco nejde (14. 10. 2026).
 *
 * Česká hláška ze serveru (naše routy hlásí česky) projde beze změny — nese
 * konkrétní důvod. Anglická se přeloží podle druhu chyby a připojí za
 * zálohu volajícího („Uložení se nepodařilo. Některý údaj chybí…"); co
 * neznáme, nahradí záloha sama. Originál jde do konzole, ať se dá dohledat.
 */

const CESKE_ZNAKY = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/

/*
 * Anglická slova, ze kterých se pozná hláška Medusy nebo prohlížeče. Česká
 * hláška bez háčků („Dobropis vystaven.") je nemá, takže projde; „to", „no",
 * „do" a „a" tu schválně nejsou — v češtině jsou běžná.
 */
const ANGLICTINA =
  /\b(the|was|were|is|are|has|have|been|this|that|an|you|your|not|found|failed|fail|invalid|error|request|cannot|can't|could|unable|must|with|for|of|already|unauthori[sz]ed|forbidden|expected|field|required|missing|created|updated|deleted|exists|unknown|unexpected|occurred|something|happened|went|wrong|please|try|again|network|fetch|timeout|timed|internal|server|too|many|payload|large|permission|allowed|duplicate|conflict)\b/i

const PREKLADY: [RegExp, string][] = [
  [/failed to fetch|networkerror|network request failed|load failed|err_network|err_internet/i, "Nepodařilo se spojit se serverem — zkontrolujte připojení a zkuste to znovu."],
  [/unauthori[sz]ed|not authenticated|\b401\b|jwt|session expired/i, "Přihlášení vypršelo — přihlaste se prosím znovu."],
  [/forbidden|not allowed|permission|\b403\b/i, "Na tuhle akci nemáte oprávnění nebo ji teď nejde provést."],
  [/was not found|not found|does not exist|\b404\b/i, "Záznam už neexistuje — obnovte prosím stránku."],
  [/already exists|duplicate|unique constraint|conflict|\b409\b/i, "Takový záznam už existuje."],
  [/invalid request|validation|is required|expected|invalid|must be/i, "Některý údaj chybí nebo má špatný tvar."],
  [/too many requests|rate limit|\b429\b/i, "Příliš mnoho požadavků naráz — chvilku počkejte a zkuste to znovu."],
  [/timeout|timed out|\b504\b/i, "Server neodpověděl včas — zkuste to prosím znovu."],
  [/payload too large|file too large|\b413\b/i, "Soubor je příliš velký."],
  [/internal server error|unknown error|unexpected|\b50[0-3]\b/i, "Na serveru nastala chyba — zkuste to prosím znovu."],
]

const tecka = (text: string) => (/[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`)

/** Text hlášky z čehokoli, co může přiletět jako chyba. */
const textChyby = (error: unknown): string => {
  if (!error) return ""
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "")
  }
  return ""
}

/** Hláška pro uživatele: česká ze serveru beze změny, jinak česky přeložená. */
export const ceskyText = (message: unknown, fallback: string): string => {
  const text = typeof message === "string" ? message.trim() : ""
  if (!text) return fallback
  if (CESKE_ZNAKY.test(text) || !ANGLICTINA.test(text)) return text

  console.warn("[admin] anglická hláška nahrazena českou:", text)
  const preklad = PREKLADY.find(([vzor]) => vzor.test(text))?.[1]
  return preklad ? `${tecka(fallback)} ${preklad}` : fallback
}

/** Hláška z chyby (Error, odpověď SDK, řetězec…) — vždy česky. */
export const ceskaChyba = (error: unknown, fallback: string): string =>
  ceskyText(textChyby(error), fallback)
