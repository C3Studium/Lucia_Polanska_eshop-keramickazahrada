import { SUPPORT_EMAIL } from "@lib/constants/contact"

/**
 * Czech messages for the backend's English errors.
 *
 * A customer must never read a raw backend string mid-checkout. Every entry is matched
 * case-insensitively against the message the backend returned; the first match wins, so the
 * more specific patterns come first. Anything unmatched falls back to `GENERIC_ERROR`, which
 * says what to do next rather than what went wrong.
 */

export const GENERIC_ERROR = `Něco se nepovedlo. Zkuste to prosím znovu — a když to nepůjde, napište nám na ${SUPPORT_EMAIL} a vyřešíme to spolu.`

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
      "Tenhle výrobek teď nejde objednat — máme u něj špatně nastavený sklad. Napište nám prosím, rychle to spravíme.",
  },
  {
    match: ["insufficient inventory"],
    message:
      "Tolik kusů už bohužel nemáme. Zkuste prosím zadat menší počet.",
  },
  {
    match: ["not enough inventory"],
    message:
      "Tolik kusů už bohužel nemáme. Zkuste prosím zadat menší počet.",
  },
  {
    match: ["variant", "does not have", "inventory"],
    message: "Tenhle výrobek už bohužel není skladem.",
  },

  // --- shipping ---------------------------------------------------------------
  {
    match: ["shipping options", "do not have a price"],
    message:
      "Tenhle způsob dopravy teď nejde použít. Vyberte prosím jiný, nebo nám napište.",
  },
  {
    match: ["shipping option", "not found"],
    message: "Tenhle způsob dopravy už není dostupný. Vyberte prosím jiný.",
  },
  {
    match: ["no shipping method"],
    message: "Vyberte prosím způsob doručení.",
  },

  // --- shop configuration -----------------------------------------------------
  /*
   * Not a customer error at all: the sales channel behind the publishable key has been
   * disabled in the admin, so Medusa refuses every create *and* every update of a cart on it
   * — including saving the delivery address. It used to land on GENERIC_ERROR, which reads as
   * "try again" for something no amount of trying will fix. Named here so the sentence tells
   * the truth and the raw string is one search away in the log.
   */
  {
    match: ["disabled sales channel"],
    message:
      "Obchod teď nedokáže přijmout objednávku — chyba je na naší straně, ne u vás. Napište nám prosím na info@keramickazahrada.cz, ozveme se hned, jak to spravíme.",
  },

  // --- cart -------------------------------------------------------------------
  {
    match: ["cart", "not found"],
    message:
      "Košík se nám teď nepodařilo načíst. Obnovte prosím stránku — co jste si vybrali, by mělo zůstat.",
  },
  {
    match: ["cart", "already completed"],
    message: "Tuhle objednávku už máme hotovou. Podrobnosti najdete v e-mailu s potvrzením.",
  },
  {
    match: ["line item", "not found"],
    message: "Tuhle položku už v košíku nevidíme. Obnovte prosím stránku.",
  },

  // --- payment ----------------------------------------------------------------
  {
    match: ["payment", "authorization"],
    message:
      "Platba neprošla. Zkuste to prosím ještě jednou, nebo zvolte jiný způsob platby.",
  },
  {
    match: ["payment session", "not found"],
    message: "Platba mezitím vypršela. Vraťte se prosím o krok zpět a vyberte způsob platby znovu.",
  },
  {
    match: ["payment collection"],
    message:
      "Platbu se nepovedlo připravit. Zkuste to prosím ještě jednou, nebo zvolte jiný způsob platby.",
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
    message: "E-mail nebo heslo nesedí. Zkuste to prosím ještě jednou.",
  },
  {
    match: ["unauthorized"],
    message: "Přihlášení mezitím vypršelo. Přihlaste se prosím znovu.",
  },
  {
    match: ["invalid token"],
    message: "Tenhle odkaz už neplatí. Nechte si prosím poslat nový.",
  },
  {
    match: ["password", "too short"],
    message: "Heslo je příliš krátké. Použijte prosím alespoň 8 znaků.",
  },

  // --- address and region -----------------------------------------------------
  {
    match: ["country", "not found"],
    message: "Do téhle země zatím bohužel neposíláme. Vyberte prosím jinou.",
  },
  {
    match: ["region", "not found"],
    message: "Tuhle zemi se nepovedlo načíst. Obnovte prosím stránku.",
  },

  // --- discounts --------------------------------------------------------------
  {
    match: ["promotion", "not found"],
    message: "Tenhle slevový kód neznáme. Zkontrolujte prosím, jestli sedí.",
  },
  {
    match: ["discount", "not found"],
    message: "Tenhle slevový kód neznáme. Zkontrolujte prosím, jestli sedí.",
  },

  // --- transport --------------------------------------------------------------
  {
    match: ["no response received"],
    message:
      "Nepovedlo se nám spojit se serverem. Zkontrolujte prosím připojení a zkuste to znovu.",
  },
  {
    match: ["failed to fetch"],
    message:
      "Nepovedlo se nám spojit se serverem. Zkontrolujte prosím připojení a zkuste to znovu.",
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
