import { SUPPORT_EMAIL } from "@lib/constants/contact"

/**
 * Czech messages for the backend's English errors.
 *
 * A customer must never read a raw backend string mid-checkout. Every entry is matched
 * case-insensitively against the message the backend returned; the first match wins, so the
 * more specific patterns come first. Anything unmatched falls back to `GENERIC_ERROR`, which
 * says what to do next rather than what went wrong.
 */

export const GENERIC_ERROR = `Něco se nepovedlo. Zkuste to prosím znovu, nebo nám napište na ${SUPPORT_EMAIL}.`

type ErrorRule = {
  /** Every token must appear in the backend message for the rule to match. */
  match: string[]
  message: string
}

const RULES: ErrorRule[] = [
  // --- stock and availability -------------------------------------------------
  {
    match: ["not associated with any stock location"],
    message:
      "Tento objekt momentálně nelze objednat — nemá nastavenou skladovou dostupnost. Napište nám prosím a rádi to vyřešíme.",
  },
  {
    match: ["insufficient inventory"],
    message:
      "Tento objekt už není skladem v požadovaném množství. Zkuste prosím snížit počet kusů.",
  },
  {
    match: ["not enough inventory"],
    message:
      "Tento objekt už není skladem v požadovaném množství. Zkuste prosím snížit počet kusů.",
  },
  {
    match: ["variant", "does not have", "inventory"],
    message: "Tento objekt už bohužel není skladem.",
  },

  // --- shipping ---------------------------------------------------------------
  {
    match: ["shipping options", "do not have a price"],
    message:
      "Zvolený způsob dopravy teď není dostupný. Vyberte prosím jiný, nebo nám napište.",
  },
  {
    match: ["shipping option", "not found"],
    message: "Zvolený způsob dopravy už není dostupný. Vyberte prosím jiný.",
  },
  {
    match: ["no shipping method"],
    message: "Vyberte prosím způsob doručení.",
  },

  // --- cart -------------------------------------------------------------------
  {
    match: ["cart", "not found"],
    message:
      "Košík se nepodařilo najít. Obnovte prosím stránku — obsah košíku by měl zůstat zachovaný.",
  },
  {
    match: ["cart", "already completed"],
    message: "Tato objednávka už byla dokončena. Podívejte se prosím do e-mailu s potvrzením.",
  },
  {
    match: ["line item", "not found"],
    message: "Tuto položku se v košíku nepodařilo najít. Obnovte prosím stránku.",
  },

  // --- payment ----------------------------------------------------------------
  {
    match: ["payment", "authorization"],
    message:
      "Platbu se nepodařilo autorizovat. Zkuste to prosím znovu, nebo zvolte jiný způsob platby.",
  },
  {
    match: ["payment session", "not found"],
    message: "Platba vypršela. Vraťte se prosím o krok zpět a vyberte způsob platby znovu.",
  },
  {
    match: ["payment collection"],
    message:
      "Platbu se nepodařilo připravit. Zkuste to prosím znovu, nebo zvolte jiný způsob platby.",
  },

  // --- account and authentication ---------------------------------------------
  {
    match: ["identity with email", "already exists"],
    message: "Účet s tímto e-mailem už existuje. Zkuste se prosím přihlásit.",
  },
  {
    match: ["email", "already exists"],
    message: "Účet s tímto e-mailem už existuje. Zkuste se prosím přihlásit.",
  },
  {
    match: ["invalid email or password"],
    message: "E-mail nebo heslo nesouhlasí. Zkuste to prosím znovu.",
  },
  {
    match: ["unauthorized"],
    message: "Přihlášení vypršelo. Přihlaste se prosím znovu.",
  },
  {
    match: ["invalid token"],
    message: "Odkaz už není platný. Nechte si prosím poslat nový.",
  },
  {
    match: ["password", "too short"],
    message: "Heslo je příliš krátké. Použijte prosím alespoň 8 znaků.",
  },

  // --- address and region -----------------------------------------------------
  {
    match: ["country", "not found"],
    message: "Do této země zatím nedoručujeme. Vyberte prosím jinou.",
  },
  {
    match: ["region", "not found"],
    message: "Tuto zemi doručení se nepodařilo načíst. Obnovte prosím stránku.",
  },

  // --- discounts --------------------------------------------------------------
  {
    match: ["promotion", "not found"],
    message: "Tento slevový kód neznáme. Zkontrolujte prosím jeho zápis.",
  },
  {
    match: ["discount", "not found"],
    message: "Tento slevový kód neznáme. Zkontrolujte prosím jeho zápis.",
  },

  // --- transport --------------------------------------------------------------
  {
    match: ["no response received"],
    message:
      "Spojení se serverem se nepodařilo navázat. Zkontrolujte prosím připojení a zkuste to znovu.",
  },
  {
    match: ["failed to fetch"],
    message:
      "Spojení se serverem se nepodařilo navázat. Zkontrolujte prosím připojení a zkuste to znovu.",
  },
]

/**
 * Maps a backend message to Czech. Messages that are already Czech pass through untouched,
 * so a translated backend response is never mangled.
 */
export function toCzechErrorMessage(raw: unknown): string {
  const message = typeof raw === "string" ? raw.trim() : ""

  if (!message) {
    return GENERIC_ERROR
  }

  if (isCzech(message)) {
    return message
  }

  const haystack = message.toLowerCase()
  const rule = RULES.find((candidate) =>
    candidate.match.every((token) => haystack.includes(token))
  )

  return rule?.message ?? GENERIC_ERROR
}

/** Czech diacritics are the cheapest reliable signal that a message is already translated. */
function isCzech(message: string) {
  return /[áčďéěíňóřšťúůýž]/i.test(message)
}
