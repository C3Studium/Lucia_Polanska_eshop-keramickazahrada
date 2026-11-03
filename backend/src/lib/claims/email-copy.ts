import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  emailLocaleOf,
  intlLocale,
  localizedLineTitle,
  pick,
  piecesLabel,
  type EmailLocale,
  type Localized,
} from "../email-locale"
import {
  CLAIM_CHANNEL_LABEL,
  damageCauseSentence,
  deadlineTextFor,
  isClaimKind,
  isCommissionCancelKind,
  isEditRefundKind,
  kindLabel,
  resolutionLabel,
  type ClaimChannel,
  type ClaimKind,
} from "./constants"
import { claimLineItemsOf, lineItemsText, type ClaimLineItem } from "./line-items"
import { refundLineText, refundLinesText, SHIPPING_LINE_TITLE } from "./refund-lines"
import { requestRefunds } from "./refund-rules"
import {
  formatPragueDate,
  formatPragueDateTime,
  maskRefundAccount,
  refundMethodTextFor,
  takeoverTextFor,
  type RefundMethodKind,
  type WithdrawalTiming,
} from "./withdrawal"

/**
 * Texty e-mailů modulu „Reklamace a zrušení" v jazyce zákazníka.
 *
 * ## Proč zvlášť, a ne v `constants.ts`
 *
 * Popisky v `constants.ts` (druh žádosti, způsob vyřízení, kanál…) čte
 * i administrace a protokol — ty zůstávají česky. E-mail zákazníkovi ze
 * Slovenska, Polska nebo Německa ale musí mluvit jeho jazykem, a to včetně
 * vět, které do `data` skládá odesílací kód (lhůta, způsob vrácení peněz,
 * převzetí…). Každá funkce tu pro češtinu vrací PŘESNĚ to, co dosavadní
 * česká funkce (deleguje na ni) — česká cesta se tím nemění.
 *
 * Volný text od lidí (důvod zákazníka, poznámka a důvod zamítnutí od
 * majitelky, pokyny k vrácení z nastavení) se nepřekládá: je to jejich
 * řeč, ne text šablony.
 */

const isCs = (locale: EmailLocale | null | undefined) => !locale || locale === "cs"

// --- data a částky --------------------------------------------------------------

const pragueParts = (value: unknown) => {
  const date = value instanceof Date ? value : value ? new Date(value as string) : null
  if (!date || Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  // Den a měsíc bez úvodní nuly („8. 10.", „8.10.") — `en-GB` je doplňuje.
  return {
    day: String(Number(get("day"))),
    month: String(Number(get("month"))),
    year: get("year"),
    hour: get("hour"),
    minute: get("minute"),
  }
}

/** „15 October 2026" (en) — pražský kalendář, měsíc slovem (číselné datum je v angličtině dvojznačné). */
const englishPragueDate = (value: unknown): string => {
  const date = value instanceof Date ? value : value ? new Date(value as string) : null
  if (!date || Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

/** „15. 10. 2026" (cs, sk) / „15.10.2026" (pl, de) / „15 October 2026" (en) — pražský kalendář. */
export const claimDate = (value: unknown, locale?: EmailLocale | null): string => {
  if (isCs(locale)) return formatPragueDate(value)
  if (locale === "en") return englishPragueDate(value)
  const p = pragueParts(value)
  if (!p) return ""
  return locale === "sk" ? `${p.day}. ${p.month}. ${p.year}` : `${p.day}.${p.month}.${p.year}`
}

/** Datum a čas odeslání žádosti do potvrzení (pražský čas). */
export const claimDateTime = (value: unknown, locale?: EmailLocale | null): string => {
  if (isCs(locale)) return formatPragueDateTime(value)
  const p = pragueParts(value)
  if (!p) return ""
  const time = `${p.hour}:${p.minute}`
  return pick(locale, {
    cs: "",
    sk: `${p.day}. ${p.month}. ${p.year} o ${time}`,
    pl: `${p.day}.${p.month}.${p.year}, godz. ${time}`,
    de: `${p.day}.${p.month}.${p.year} um ${time} Uhr`,
    en: `${englishPragueDate(value)} at ${time}`,
  })
}

const money = (amount: number, currency: string, locale: EmailLocale) =>
  new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: String(currency || "CZK").toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

// --- popisky --------------------------------------------------------------------

const KIND: Record<ClaimKind | "uprava" | "zruseni_zakazky" | "fallback", Localized<string>> = {
  reklamace: { cs: "", sk: "Reklamácia", pl: "Reklamacja", de: "Reklamation", en: "Complaint" },
  vraceni: { cs: "", sk: "Vrátenie tovaru", pl: "Zwrot towaru", de: "Rücksendung der Ware", en: "Return of goods" },
  odstoupeni: {
    cs: "",
    sk: "Odstúpenie od zmluvy",
    pl: "Odstąpienie od umowy",
    de: "Widerruf",
    en: "Withdrawal from the contract",
  },
  uprava: {
    cs: "",
    sk: "Vrátenie rozdielu po úprave objednávky",
    pl: "Zwrot różnicy po zmianie zamówienia",
    de: "Erstattung der Differenz nach Änderung der Bestellung",
    en: "Refund of the difference after an order change",
  },
  zruseni_zakazky: {
    cs: "",
    sk: "Zrušenie zákazky",
    pl: "Anulowanie zamówienia indywidualnego",
    de: "Stornierung der Auftragsarbeit",
    en: "Cancellation of the commission",
  },
  fallback: { cs: "", sk: "Žiadosť o vrátenie", pl: "Wniosek o zwrot", de: "Erstattungsanfrage", en: "Refund request" },
}

/** Druh žádosti slovy (u zákazníka; admin čte `kindLabel`). */
export const claimKindText = (kind: string | null | undefined, locale?: EmailLocale | null): string => {
  if (isCs(locale)) return kindLabel(kind)
  const key = isClaimKind(kind)
    ? kind
    : isEditRefundKind(kind)
      ? "uprava"
      : isCommissionCancelKind(kind)
        ? "zruseni_zakazky"
        : "fallback"
  return pick(locale, KIND[key])
}

const RESOLUTION: Record<string, Localized<string>> = {
  repair: { cs: "", sk: "oprava", pl: "naprawa", de: "Reparatur", en: "repair" },
  replace: {
    cs: "",
    sk: "výmena za nový kus",
    pl: "wymiana na nowy egzemplarz",
    de: "Austausch gegen ein neues Stück",
    en: "replacement with a new piece",
  },
  discount: {
    cs: "",
    sk: "primeraná zľava z ceny",
    pl: "odpowiednie obniżenie ceny",
    de: "angemessene Preisminderung",
    en: "a reasonable price reduction",
  },
  refund: {
    cs: "",
    sk: "vrátenie peňazí",
    pl: "zwrot pieniędzy",
    de: "Erstattung des Kaufpreises",
    en: "refund of the purchase price",
  },
}

/** Způsob vyřízení / požadované vyřízení slovy; neznámé → "". */
export const claimResolutionText = (
  value: string | null | undefined,
  locale?: EmailLocale | null
): string => {
  if (isCs(locale)) return resolutionLabel(value)
  return value && RESOLUTION[value] ? pick(locale, RESOLUTION[value]) : ""
}

const CHANNEL: Record<ClaimChannel, Localized<string>> = {
  online: {
    cs: "",
    sk: "online na webe obchodu",
    pl: "online przez stronę sklepu",
    de: "online über die Website des Shops",
    en: "online via the shop's website",
  },
}

export const claimChannelText = (channel: ClaimChannel, locale?: EmailLocale | null): string =>
  isCs(locale) ? CLAIM_CHANNEL_LABEL[channel] : pick(locale, CHANNEL[channel] ?? CHANNEL.online)

/** Věta „Příčina poškození" do protokolu (`damageCauseSentence` v jazyce). */
export const claimDamageSentence = (value: unknown, locale?: EmailLocale | null): string | null => {
  if (isCs(locale)) return damageCauseSentence(value)
  if (value === "carrier") {
    return pick(locale, {
      cs: "",
      sk: "Poškodené pri preprave — zásielka dorazila poškodená. Za poškodenie zodpovedá predávajúci; škodu u prepravcu rieši sám.",
      pl: "Uszkodzone w transporcie — przesyłka dotarła uszkodzona. Za uszkodzenie odpowiada sprzedawca; szkodę z przewoźnikiem wyjaśnia sam.",
      de: "Transportschaden – die Sendung kam beschädigt an. Für den Schaden haftet die Verkäuferin; die Abwicklung mit dem Versanddienst übernimmt sie selbst.",
      en: "Damaged in transit — the parcel arrived damaged. The seller is responsible for the damage and deals with the carrier herself.",
    })
  }
  if (value === "damaged") {
    return pick(locale, {
      cs: "",
      sk: "Poškodený kus — viditeľné poškodenie tovaru (fotky priložené k žiadosti).",
      pl: "Uszkodzony egzemplarz — widoczne uszkodzenie towaru (zdjęcia dołączone do zgłoszenia).",
      de: "Beschädigtes Stück – sichtbare Beschädigung der Ware (Fotos der Anfrage beigefügt).",
      en: "Damaged piece — visible damage to the goods (photos attached to the request).",
    })
  }
  return null
}

/**
 * „Schváleno — oprava" / „Zamítnuto" / „Žádost stornována" do protokolu
 * v jazyce objednávky. `czech` = výsledek `decisionOutcome` (volající ho má).
 */
export const decisionOutcomeText = (
  request: { status?: string | null; resolution?: string | null },
  czech: string,
  locale?: EmailLocale | null
): string => {
  if (isCs(locale)) return czech
  const status = request.status ?? ""
  if (status === "rejected") {
    return pick(locale, { cs: "", sk: "Zamietnuté", pl: "Odrzucono", de: "Abgelehnt", en: "Rejected" })
  }
  if (status === "cancelled") {
    return pick(locale, {
      cs: "",
      sk: "Žiadosť stornovaná",
      pl: "Wniosek wycofany",
      de: "Anfrage storniert",
      en: "Request withdrawn",
    })
  }
  const label = claimResolutionText(request.resolution, locale)
  const approved = pick(locale, { cs: "", sk: "Schválené", pl: "Zaakceptowano", de: "Genehmigt", en: "Approved" })
  return label ? `${approved} — ${label}` : approved
}

// --- lhůty ----------------------------------------------------------------------

/**
 * Lhůta v potvrzení přijetí: s konkrétním datem u reklamace (30 dnů od
 * uplatnění) a odstoupení (14 dnů), jinak obecně podle druhu.
 */
export const intakeDeadlineText = (
  kind: string | null,
  resolveBy: Date | null,
  locale?: EmailLocale | null
): string => {
  const isWithdrawalKind = kind === "odstoupeni" || kind === "vraceni"
  if (resolveBy && kind === "reklamace") {
    const date = claimDate(resolveBy, locale)
    return pick(locale, {
      cs: `nejpozději do ${date} (30 dnů od uplatnění reklamace)`,
      sk: `najneskôr do ${date} (30 dní od uplatnenia reklamácie)`,
      pl: `najpóźniej do ${date} (30 dni od złożenia reklamacji)`,
      de: `spätestens bis ${date} (30 Tage nach Eingang der Reklamation)`,
      en: `by ${date} at the latest (30 days from the date the complaint was made)`,
    })
  }
  if (resolveBy && isWithdrawalKind) {
    const date = claimDate(resolveBy, locale)
    return pick(locale, {
      cs: `nejpozději do ${date} (14 dnů od odstoupení)`,
      sk: `najneskôr do ${date} (14 dní od odstúpenia)`,
      pl: `najpóźniej do ${date} (14 dni od odstąpienia)`,
      de: `spätestens bis ${date} (14 Tage nach dem Widerruf)`,
      en: `by ${date} at the latest (14 days from your withdrawal)`,
    })
  }
  if (isCs(locale)) return deadlineTextFor(kind)
  return kind === "reklamace"
    ? pick(locale, {
        cs: "",
        sk: "do 30 dní od uplatnenia reklamácie",
        pl: "w ciągu 30 dni od złożenia reklamacji",
        de: "innerhalb von 30 Tagen nach Eingang der Reklamation",
        en: "within 30 days from the date the complaint was made",
      })
    : pick(locale, {
        cs: "",
        sk: "do 14 dní",
        pl: "w ciągu 14 dni",
        de: "innerhalb von 14 Tagen",
        en: "within 14 days",
      })
}

/** Lhůta v e-mailu „schváleno" (rozhodnutí majitelky). */
export const approvedDeadlineText = (
  kind: string | null,
  resolution: string,
  state: { nothingToReturn: boolean; nothingToRefund: boolean },
  locale?: EmailLocale | null
): string => {
  if (state.nothingToReturn) {
    return state.nothingToRefund
      ? nothingPaidText(locale)
      : pick(locale, {
          cs: "peníze vrátíme do 14 dnů",
          sk: "peniaze vrátime do 14 dní",
          pl: "pieniądze zwrócimy w ciągu 14 dni",
          de: "den Betrag erstatten wir innerhalb von 14 Tagen",
          en: "we will refund the money within 14 days",
        })
  }
  if (kind === "reklamace") {
    return pick(locale, {
      cs: "vyřídíme do 30 dnů od uplatnění reklamace",
      sk: "vybavíme do 30 dní od uplatnenia reklamácie",
      pl: "rozpatrzymy w ciągu 30 dni od złożenia reklamacji",
      de: "wir erledigen sie innerhalb von 30 Tagen nach Eingang der Reklamation",
      en: "we will settle it within 30 days from the date the complaint was made",
    })
  }
  return resolution === "discount"
    ? pick(locale, {
        cs: "část ceny vrátíme do 14 dnů",
        sk: "časť ceny vrátime do 14 dní",
        pl: "część ceny zwrócimy w ciągu 14 dni",
        de: "einen Teil des Preises erstatten wir innerhalb von 14 Tagen",
        en: "we will refund part of the price within 14 days",
      })
    : pick(locale, {
        cs: "peníze vrátíme do 14 dnů od přijetí zboží",
        sk: "peniaze vrátime do 14 dní od prijatia tovaru",
        pl: "pieniądze zwrócimy w ciągu 14 dni od otrzymania towaru",
        de: "den Betrag erstatten wir innerhalb von 14 Tagen nach Eingang der Ware",
        en: "we will refund the money within 14 days of receiving the goods",
      })
}

/** „nebylo zaplaceno — není co vracet". */
export const nothingPaidText = (locale?: EmailLocale | null): string =>
  pick(locale, {
    cs: "nebylo zaplaceno — není co vracet",
    sk: "nebolo zaplatené — nie je čo vracať",
    pl: "nic nie zostało zapłacone — nie ma czego zwracać",
    de: "es wurde nichts bezahlt – es gibt nichts zu erstatten",
    en: "nothing was paid — there is nothing to refund",
  })

/** Jak zákazník zboží vrací (řádek „Způsob vrácení"). */
export const returnMethodText = (locale?: EmailLocale | null): string =>
  pick(locale, {
    cs: "Zásilka na adresu ateliéru",
    sk: "Zásielka na adresu ateliéru",
    pl: "Przesyłka na adres pracowni",
    de: "Versand an die Adresse der Werkstatt",
    en: "By post to the studio's address",
  })

// --- peníze ---------------------------------------------------------------------

/** Jak se peníze vrátí — věta do potvrzení přijetí (§ 1832 odst. 1 OZ). */
export const intakeRefundMethodText = (
  kind: RefundMethodKind,
  accountDisplay: string | null,
  locale?: EmailLocale | null
): string => {
  if (isCs(locale)) return refundMethodTextFor(kind, accountDisplay)
  if (kind === "card") {
    return pick(locale, {
      cs: "",
      sk: "Rovnakým platobným prostriedkom, akým ste platili — vrátim ich rovnakou cestou (cez ComGate).",
      pl: "Tym samym środkiem płatności, którym Państwo zapłacili — zwrócę je tą samą drogą (przez ComGate).",
      de: "Über dasselbe Zahlungsmittel, mit dem Sie bezahlt haben – ich erstatte den Betrag auf demselben Weg (über ComGate).",
      en: "Using the same payment method you paid with — I will send it back the same way (via ComGate).",
    })
  }
  if (kind === "account") {
    const masked = maskRefundAccount(accountDisplay)
    return masked
      ? pick(locale, {
          cs: "",
          sk: `Prevodom na účet ${masked}, ktorý ste uviedli (objednávku ste neplatili online cez ComGate).`,
          pl: `Przelewem na podane przez Państwa konto ${masked} (zamówienie nie było opłacone online przez ComGate).`,
          de: `Per Überweisung auf das von Ihnen angegebene Konto ${masked} (Sie haben die Bestellung nicht online über ComGate bezahlt).`,
          en: `By bank transfer to the account ${masked} you gave me (the order was not paid online via ComGate).`,
        })
      : pick(locale, {
          cs: "",
          sk: "Prevodom na účet — objednávku ste neplatili online cez ComGate.",
          pl: "Przelewem na konto — zamówienie nie było opłacone online przez ComGate.",
          de: "Per Überweisung – Sie haben die Bestellung nicht online über ComGate bezahlt.",
          en: "By bank transfer — the order was not paid online via ComGate.",
        })
  }
  return pick(locale, {
    cs: "",
    sk: "Zatiaľ ste nič nezaplatili — nie je čo vracať.",
    pl: "Na razie nic Państwo nie zapłacili — nie ma czego zwracać.",
    de: "Sie haben noch nichts bezahlt – es gibt nichts zu erstatten.",
    en: "You haven't paid anything yet — there is nothing to refund.",
  })
}

/**
 * Způsob vrácení po rozhodnutí (e-maily „vracím peníze" / „vyřízeno").
 * Šablony podle slova „ComGate" poznají platbu přes bránu — drží ho každý jazyk.
 * `czech` = výsledek `refundMethodLabel` pro češtinu (volající ho má po ruce).
 */
export const decidedRefundMethodText = (
  method: unknown,
  accountDisplay: string | null,
  czech: string,
  locale?: EmailLocale | null
): string => {
  if (isCs(locale)) return czech
  if (method === "comgate") {
    return pick(locale, {
      cs: "",
      sk: "rovnakou cestou, akou ste platili (cez ComGate) — na účte do 3–5 pracovných dní",
      pl: "tą samą drogą, którą Państwo płacili (przez ComGate) — na koncie w ciągu 3–5 dni roboczych",
      de: "auf demselben Weg, auf dem Sie bezahlt haben (über ComGate) – auf Ihrem Konto innerhalb von 3–5 Werktagen",
      en: "the same way you paid (via ComGate) — in your account within 3–5 working days",
    })
  }
  return accountDisplay
    ? pick(locale, {
        cs: "",
        sk: `prevodom na váš účet ${accountDisplay}`,
        pl: `przelewem na Państwa konto ${accountDisplay}`,
        de: `per Überweisung auf Ihr Konto ${accountDisplay}`,
        en: `by bank transfer to your account ${accountDisplay}`,
      })
    : pick(locale, {
        cs: "",
        sk: "prevodom na váš účet (ak číslo účtu ešte nemáme, ozveme sa vám)",
        pl: "przelewem na Państwa konto (jeśli nie mamy jeszcze numeru konta, odezwiemy się)",
        de: "per Überweisung auf Ihr Konto (falls uns Ihre Kontonummer noch fehlt, melden wir uns)",
        en: "by bank transfer to your account (if we don't have your account number yet, we'll get in touch)",
      })
}

/** Předpona věty o dobropisu (zkušební režim, kdy doklad zatím není). */
export const creditNotePrefix = (locale?: EmailLocale | null): string =>
  pick(locale, {
    cs: "Opravný daňový doklad (dobropis)",
    sk: "Opravný daňový doklad (dobropis)",
    pl: "Faktura korygująca",
    de: "Gutschrift (Rechnungskorrektur)",
    en: "Credit note (corrective tax document)",
  })

// --- převzetí -------------------------------------------------------------------

/** Převzetí slovy do potvrzení odstoupení. */
export const takeoverText = (timing: WithdrawalTiming, locale?: EmailLocale | null): string => {
  if (isCs(locale)) return takeoverTextFor(timing)
  const at = claimDate(timing.takeover_at, locale)
  switch (timing.basis) {
    case "delivered":
      return at
    case "pickup":
      return `${at} (${pick(locale, {
        cs: "",
        sk: "osobný odber",
        pl: "odbiór osobisty",
        de: "Selbstabholung",
        en: "collected in person",
      })})`
    case "electronic":
      return `${at} (${pick(locale, {
        cs: "",
        sk: "poukaz doručený e-mailom",
        pl: "bon doręczony e-mailem",
        de: "Gutschein per E-Mail zugestellt",
        en: "voucher delivered by e-mail",
      })})`
    case "estimated": {
      const shipped = claimDate(timing.shipped_at, locale)
      return pick(locale, {
        cs: "",
        sk: `prevzatie nemáme potvrdené — zásielka odišla ${shipped}`,
        pl: `nie mamy potwierdzenia odbioru — przesyłka została nadana ${shipped}`,
        de: `die Zustellung ist nicht bestätigt – das Paket wurde am ${shipped} versandt`,
        en: `delivery has not been confirmed — the parcel was sent on ${shipped}`,
      })
    }
    case "in_transit":
      return pick(locale, {
        cs: "",
        sk: "zásielka je na ceste — lehota ešte nebeží",
        pl: "przesyłka jest w drodze — termin jeszcze nie biegnie",
        de: "das Paket ist unterwegs – die Frist läuft noch nicht",
        en: "the parcel is on its way — the period has not started yet",
      })
    default:
      return pick(locale, {
        cs: "",
        sk: "tovar sme ešte neodoslali",
        pl: "towar nie został jeszcze wysłany",
        de: "die Ware wurde noch nicht versandt",
        en: "the goods have not been sent yet",
      })
  }
}

// --- položky --------------------------------------------------------------------

/** Název řádku objednávky v jazyce e-mailu podle id řádku (nebo český snímek). */
export type ClaimTitleLookup = (lineItemId: string | null | undefined, czech: string) => string

const keepCzech: ClaimTitleLookup = (_id, czech) => czech

/** Provedení „Standardní" v cizojazyčném e-mailu nic neříká — vynechá se. */
const CESKE_VYCHOZI_PROVEDENI = /^(standardní|výchozí|default(\s+variant)?)$/i

/** Řádek „Název · varianta · N ks · částka" v jazyce e-mailu. */
const claimLineIn = (item: ClaimLineItem, locale: EmailLocale, titleOf: ClaimTitleLookup) =>
  [
    titleOf(item.line_item_id, item.title),
    item.variant_title && !CESKE_VYCHOZI_PROVEDENI.test(item.variant_title.trim())
      ? item.variant_title
      : null,
    `${item.quantity} ${piecesLabel(locale)}`,
    money(item.total, item.currency_code, locale),
  ]
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .join(" · ")

/** `lineItemsText` v jazyce e-mailu (čeština beze změny). */
export const claimLinesText = (
  lineItems: unknown,
  locale?: EmailLocale | null,
  titleOf: ClaimTitleLookup = keepCzech
): string | null => {
  if (isCs(locale)) return lineItemsText(lineItems)
  const items = claimLineItemsOf(lineItems)
  if (!items.length) return null
  return items.map((item) => claimLineIn(item, locale as EmailLocale, titleOf)).join("\n")
}

/** `claimItemsText` v jazyce e-mailu: položky, jinak text zákazníka. */
export const claimItemsTextIn = (
  request: { line_items?: unknown; items?: unknown },
  locale?: EmailLocale | null,
  titleOf: ClaimTitleLookup = keepCzech
): string | null => {
  const formatted = claimLinesText(request.line_items, locale, titleOf)
  if (formatted) return formatted
  return typeof request.items === "string" && request.items.trim().length
    ? request.items.trim()
    : null
}

type RefundLineLike = Parameters<typeof refundLineText>[0]

const SHIPPING_TITLES: Record<string, Localized<string>> = {
  [SHIPPING_LINE_TITLE]: {
    cs: SHIPPING_LINE_TITLE,
    sk: "Poštovné a balné",
    pl: "Wysyłka i opakowanie",
    de: "Versand und Verpackung",
    en: "Postage and packaging",
  },
  "Poštovné": { cs: "Poštovné", sk: "Poštovné", pl: "Wysyłka", de: "Versand", en: "Postage" },
}

/** Řádek košíku vrácení v jazyce e-mailu. */
const refundLineIn = (
  line: RefundLineLike,
  currency: string,
  locale: EmailLocale,
  titleOf: ClaimTitleLookup
): string => {
  const title =
    line.type === "custom"
      ? `${pick(locale, { cs: "", sk: "Vrátenie", pl: "Zwrot", de: "Erstattung", en: "Refund" })} — ${
          line.title ?? pick(locale, { cs: "", sk: "suma", pl: "kwota", de: "Betrag", en: "amount" })
        }`
      : line.type === "shipping"
        ? (() => {
            const raw = line.title ?? SHIPPING_LINE_TITLE
            return SHIPPING_TITLES[raw] ? pick(locale, SHIPPING_TITLES[raw]) : raw
          })()
        : line.type === "component"
          ? `${line.title ?? ""} (${pick(locale, {
              cs: "",
              sk: "súčasť balíčka",
              pl: "element zestawu",
              de: "Teil des Sets",
              en: "part of a set",
            })})`.trim()
          : titleOf(line.line_item_id ?? null, line.title ?? "")
  const quantity =
    (line.type === "item" || line.type === "component") && (line.quantity ?? 0) > 0
      ? `${line.quantity} ${piecesLabel(locale)}`
      : null
  return [title, quantity, money(line.amount, currency, locale)].filter(Boolean).join(" · ")
}

/** `refundLinesText` v jazyce e-mailu (čeština beze změny). */
export const refundLinesTextIn = (
  lines: RefundLineLike[] | null | undefined,
  currency: string,
  locale?: EmailLocale | null,
  titleOf: ClaimTitleLookup = keepCzech
): string | null => {
  if (isCs(locale)) return refundLinesText(lines as never, currency)
  return lines && lines.length
    ? lines.map((line) => refundLineIn(line, currency, locale as EmailLocale, titleOf)).join("\n")
    : null
}

/** Všechny řádky přes všechny refundace žádosti (potvrzení o vyřízení). */
export const requestRefundLinesTextIn = (
  request: any,
  currency: string,
  locale?: EmailLocale | null,
  titleOf: ClaimTitleLookup = keepCzech
): string | null =>
  refundLinesTextIn(
    requestRefunds(request).flatMap((refund) => refund.lines ?? []) as RefundLineLike[],
    currency,
    locale,
    titleOf
  )

// --- předměty -------------------------------------------------------------------

/** Předmět potvrzení přijetí žádosti; `null` = výchozí předmět šablony. */
export const intakeSubject = (
  kind: string | null,
  autoCancelled: boolean,
  locale?: EmailLocale | null
): string => {
  if (autoCancelled) {
    if (kind === "vraceni") {
      return pick(locale, {
        cs: "Žádost o vrácení jsem přijala — objednávka je zrušená",
        sk: "Žiadosť o vrátenie som prijala — objednávka je zrušená",
        pl: "Przyjęłam wniosek o zwrot — zamówienie zostało anulowane",
        de: "Ihre Rücksendeanfrage ist eingegangen – die Bestellung ist storniert",
        en: "I've received your return request — the order has been cancelled",
      })
    }
    if (kind === "odstoupeni") {
      return pick(locale, {
        cs: "Potvrzuji přijetí vašeho odstoupení od smlouvy — objednávka je zrušená",
        sk: "Potvrdzujem prijatie vášho odstúpenia od zmluvy — objednávka je zrušená",
        pl: "Potwierdzam otrzymanie odstąpienia od umowy — zamówienie zostało anulowane",
        de: "Ich bestätige den Eingang Ihres Widerrufs – die Bestellung ist storniert",
        en: "I confirm receipt of your withdrawal from the contract — the order has been cancelled",
      })
    }
    return pick(locale, {
      cs: "Vaši žádost jsem přijala — objednávka je zrušená",
      sk: "Vašu žiadosť som prijala — objednávka je zrušená",
      pl: "Przyjęłam Państwa wniosek — zamówienie zostało anulowane",
      de: "Ihre Anfrage ist eingegangen – die Bestellung ist storniert",
      en: "I've received your request — the order has been cancelled",
    })
  }
  if (kind === "reklamace") {
    return pick(locale, {
      cs: "Reklamaci jsem přijala",
      sk: "Reklamáciu som prijala",
      pl: "Przyjęłam reklamację",
      de: "Ihre Reklamation ist bei mir eingegangen",
      en: "I've received your complaint",
    })
  }
  if (kind === "vraceni") {
    return pick(locale, {
      cs: "Žádost o vrácení zboží jsem přijala",
      sk: "Žiadosť o vrátenie tovaru som prijala",
      pl: "Przyjęłam wniosek o zwrot towaru",
      de: "Ihre Anfrage zur Rücksendung ist bei mir eingegangen",
      en: "I've received your request to return goods",
    })
  }
  if (kind === "odstoupeni") {
    return pick(locale, {
      cs: "Potvrzuji přijetí vašeho odstoupení od smlouvy",
      sk: "Potvrdzujem prijatie vášho odstúpenia od zmluvy",
      pl: "Potwierdzam otrzymanie odstąpienia od umowy",
      de: "Ich bestätige den Eingang Ihres Widerrufs",
      en: "I confirm receipt of your withdrawal from the contract",
    })
  }
  return pick(locale, {
    cs: "Vaši žádost jsem přijala",
    sk: "Vašu žiadosť som prijala",
    pl: "Przyjęłam Państwa wniosek",
    de: "Ihre Anfrage ist bei mir eingegangen",
    en: "I've received your request",
  })
}

export const approvedSubject = (kind: string | null, locale?: EmailLocale | null): string =>
  kind === "reklamace"
    ? pick(locale, {
        cs: "Reklamace uznána",
        sk: "Reklamácia je uznaná",
        pl: "Reklamacja została uznana",
        de: "Ihre Reklamation wurde anerkannt",
        en: "Your complaint has been accepted",
      })
    : pick(locale, {
        cs: "Vrácení schváleno",
        sk: "Vrátenie je schválené",
        pl: "Zwrot został zaakceptowany",
        de: "Ihre Rücksendung ist genehmigt",
        en: "Your return has been approved",
      })

export const rejectedSubject = (kind: string | null, locale?: EmailLocale | null): string =>
  kind === "reklamace"
    ? pick(locale, {
        cs: "Reklamaci nemůžeme uznat",
        sk: "Reklamáciu nemôžeme uznať",
        pl: "Nie możemy uznać reklamacji",
        de: "Ihre Reklamation können wir leider nicht anerkennen",
        en: "We're unable to accept your complaint",
      })
    : pick(locale, {
        cs: "Žádost o vrácení nemůžeme přijmout",
        sk: "Žiadosť o vrátenie nemôžeme prijať",
        pl: "Nie możemy przyjąć wniosku o zwrot",
        de: "Ihrer Rücksendeanfrage können wir leider nicht stattgeben",
        en: "We're unable to accept your return request",
      })

export const resolvedSubject = (kind: string | null, locale?: EmailLocale | null): string =>
  kind === "reklamace"
    ? pick(locale, {
        cs: "Reklamace je vyřízená — potvrzení",
        sk: "Reklamácia je vybavená — potvrdenie",
        pl: "Reklamacja rozpatrzona — potwierdzenie",
        de: "Ihre Reklamation ist erledigt – Bestätigung",
        en: "Your complaint has been settled — confirmation",
      })
    : kind === "uprava"
      ? pick(locale, {
          cs: "Rozdíl po úpravě objednávky jsem vám vrátila",
          sk: "Rozdiel po úprave objednávky som vám vrátila",
          pl: "Zwróciłam różnicę po zmianie zamówienia",
          de: "Ich habe Ihnen die Differenz nach der Änderung Ihrer Bestellung erstattet",
          en: "I've refunded the difference after your order change",
        })
      : pick(locale, {
          cs: "Vrácení je vyřízené — potvrzení",
          sk: "Vrátenie je vybavené — potvrdenie",
          pl: "Zwrot zakończony — potwierdzenie",
          de: "Ihre Rücksendung ist erledigt – Bestätigung",
          en: "Your return has been completed — confirmation",
        })

export const autoCancelledSubject = (locale?: EmailLocale | null): string =>
  pick(locale, {
    cs: "Objednávku jsem na vaši žádost zrušila",
    sk: "Objednávku som na vašu žiadosť zrušila",
    pl: "Na Państwa prośbę anulowałam zamówienie",
    de: "Ich habe Ihre Bestellung auf Ihren Wunsch storniert",
    en: "I've cancelled your order as you requested",
  })

// --- kontext objednávky ---------------------------------------------------------

export type ClaimEmailContext = {
  locale: EmailLocale
  /** Název řádku v jazyce e-mailu podle `line_item_id`. */
  titleOf: ClaimTitleLookup
  /** Řádky objednávky s `product.metadata` (pro `refundEmailLineItems`). */
  order: { items: any[] } | null
}

/**
 * Jazyk objednávky + překlady názvů jejích řádků — jedním dotazem, ať
 * odesílatel e-mailu (žádost zná jen `order_id`) nemusí znát pole objednávky.
 * Nikdy nevyhodí: bez objednávky je e-mail česky a názvy zůstanou.
 */
export const loadClaimEmailContext = async (
  container: MedusaContainer,
  orderId: string | null | undefined
): Promise<ClaimEmailContext> => {
  const fallback: ClaimEmailContext = { locale: "cs", titleOf: keepCzech, order: null }
  if (!orderId) return fallback
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "metadata",
        "shipping_address.country_code",
        "billing_address.country_code",
        "items.id",
        "items.title",
        "items.product_title",
        "items.variant_title",
        "items.thumbnail",
        "items.metadata",
        "items.variant_id",
        "items.product_id",
        "items.product.metadata",
      ],
      filters: { id: orderId },
    })
    const order = (data?.[0] as any) ?? null
    if (!order) return fallback
    const locale = emailLocaleOf(order)
    const byId = new Map<string, any>(
      ((order.items ?? []) as any[]).filter((item) => item?.id).map((item) => [item.id, item])
    )
    const titleOf: ClaimTitleLookup = (lineItemId, czech) => {
      const item = lineItemId ? byId.get(lineItemId) : null
      if (!item || locale === "cs") return czech
      const translated = localizedLineTitle(item, locale)
      // Snímek řádku (`czech`) je autorita, když se řádek mezitím jmenuje jinak.
      return translated && translated !== (item.product_title ?? item.title ?? "").trim()
        ? translated
        : czech
    }
    return { locale, titleOf, order }
  } catch {
    return fallback
  }
}
