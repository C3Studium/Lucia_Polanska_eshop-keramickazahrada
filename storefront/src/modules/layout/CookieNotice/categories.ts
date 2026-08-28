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
 */
export const consentCategories: readonly CategoryCopy[] = [
  {
    key: null,
    title: "Nezbytné",
    description:
      "Košík, přihlášení, volba země a zabezpečení objednávky. Bez nich obchod nefunguje, proto je nelze vypnout.",
  },
  {
    key: "preferences",
    title: "Preferenční",
    description:
      "Pamatují si vaše volby — například naposledy použitý způsob platby — abyste je nemuseli zadávat znovu.",
  },
  {
    key: "analytics",
    title: "Analytické",
    description:
      "Anonymní statistiky o tom, které stránky lidé hledají a kde se ztrácejí. Slouží nám ke zlepšování obchodu, nikomu je neprodáváme.",
  },
  {
    key: "marketing",
    title: "Marketingové",
    description:
      "Měření účinnosti reklamy a obsah ze sociálních sítí. Bez vašeho souhlasu se nenačítají vůbec.",
  },
] as const
