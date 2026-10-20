import type { OptionalCategory } from "@lib/util/cookie-consent"

export type CategoryCopy = {
  /** `null` for the necessary category, which is not part of the decision. */
  key: OptionalCategory | null
  title: string
  description: string
}

/**
 * The four groups the visitor decides between, in the order the cookies page describes them.
 *
 * Necessary comes first and is shown switched on and disabled: hiding it would be worse than
 * useless — people need to see what runs regardless, and that it is a short list.
 *
 * Texty musí sedět se skutečným soupisem v `@lib/legal/cookies-inventory.ts` (tabulka na
 * stránce Cookies). Když se změní, CO kategorie zahrnuje, zvyš `CONSENT_VERSION`
 * v `@lib/util/cookie-consent.ts` — starý souhlas se na nový rozsah nevztahuje.
 */
export const consentCategories: readonly CategoryCopy[] = [
  {
    key: null,
    title: "Nezbytné",
    description:
      "Košík, přihlášení do účtu, průchod objednávkou a uložení této volby. Patří sem i mapa výdejních míst Zásilkovny a Balíkovny, když si vybíráte doručení, a platební brána ComGate při placení — ty si mohou na svých stránkách uložit vlastní cookies. Bez toho objednávku nedokončíte, proto to nejde vypnout.",
  },
  {
    key: "preferences",
    title: "Preferenční",
    description:
      "Zapamatují si vaše volby, například naposledy použitý způsob platby, abyste je nemuseli zadávat znovu. Zůstávají jen ve vašem prohlížeči.",
  },
  {
    key: "analytics",
    title: "Analytické",
    description:
      "Google Analytics 4 (Google Ireland Ltd.) — statistiky, které stránky lidé navštěvují a kde se v obchodě ztrácejí, abychom ho mohli zlepšovat. Načte se jen s vaším souhlasem a jen pokud měření na webu právě používáme. Google přitom zpracuje i vaši IP adresu a data může přenést do USA.",
  },
  {
    key: "marketing",
    title: "Marketingové a obsah třetích stran",
    description:
      "Mapa Google v kontaktu se načte hned, bez dalšího klikání — Google si přitom ukládá vlastní cookies a může je použít i pro reklamu. Se souhlasem s analytickými cookies smí Google Analytics data propojit i s reklamními službami Google. Reklamu na webu zatím neprovozujeme.",
  },
] as const
