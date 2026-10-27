/**
 * Výchozí texty bloku `kurzy.rezervace-okno` — okno rezervace a karty termínů.
 *
 * Tady, a ne v komponentě, protože větu u obsazeného termínu čte okno
 * (RezervaceModal) i sekce s nejbližšími termíny (Rezervace) a mají znít
 * stejně. Položky klíčované popiskem; `scripts/seed-texts.mjs` nese tytéž
 * věty (změna tady = změna tam).
 *
 * Zástupci `{osoby}`, `{email}`, `{obsazeno}`, `{kapacita}`, `{volno}` a `{max}`
 * se dosazují v komponentě (`fillPlaceholders`).
 *
 * Co tu schválně NENÍ: souhlasy a storno podmínky (§ 1837 písm. j) OZ, fakta
 * z administrace), způsoby platby, ceny a názvy cenových pásem, chybové
 * hlášky, a věta „Místo se přitom nedrží…" — říká, jak čekací listina
 * funguje, a musí s tím souhlasit.
 */
export const REZERVACE_OKNO_DEFAULTS = {
  oboci: "Kurzy · Rezervace",
  prazdne:
    "Právě nejsou vypsané žádné termíny. Napište mi a dám vám vědět, jakmile vypíšu další.",
  "kalendar.napoveda": "Vyberte v kalendáři označený den a jeho termíny se ukážou tady.",
  "termin.obsazeno": "obsazeno · dáme vědět, až se uvolní",
  /** Lišta nahoře v okně u zvoleného termínu. */
  "kurz.obsazenost": "Přihlášeno {obsazeno} z {kapacita} · {volno}",
  /** Pod počtem osob, když už další přidat nejde, protože termín nemá víc míst. */
  "pocet.limit":
    "Víc osob už přidat nejde — tenhle termín má volno jen pro {osoby}. Pro větší skupinu vyberte jiný termín nebo nám napište.",
  /** Totéž, když míst je dost, ale online rezervace má strop. */
  "pocet.strop": "Online jde najednou rezervovat nejvýš {max} osob. Pro větší skupinu nám prosím napište.",
  "cekacka.uvod":
    "Termín je plně obsazený. Nechte nám kontakt a napíšeme vám, jakmile se místo uvolní.",
  "cekacka.tlacitko": "Dejte mi vědět",
  /** Žádost o místo na plném termínu (od 28. 10. 2026 místo čekací listiny). */
  "zadost.uvod":
    "Termín je plně obsazený. Pošlete nám žádost — podívám se, jestli pro vás můžu udělat výjimku, a ozvu se e-mailem nebo telefonem. Zatím nic neplatíte.",
  "zadost.tlacitko": "Poslat žádost o místo",
  "zadost.hotovo.nadpis": "Žádost mám, ozvu se vám.",
  "zadost.hotovo.text":
    "Žádost pro {osoby} jsem dostala. Jakmile rozhodnu, napíšu vám na {email} — když místo bude, přijde odkaz, kde si vyberete platbu.",
  "cekacka.hotovo.nadpis": "Dáme vědět, až se uvolní místo.",
  "cekacka.hotovo.text":
    "Jakmile se na termínu uvolní místo pro {osoby}, pošleme vám zprávu na {email}.",
  "souhrn.oboci": "Rezervace přijata",
  "souhrn.nadpis": "Těšíme se na vás.",
  /** `note` položky `souhrn.nadpis` — zvýrazněný konec nadpisu. */
  "souhrn.nadpis#note": "Místo máte rezervované.",
  "souhrn.text":
    "Co bude dál: potvrzení jsme právě poslali na {email}. Před kurzem vám ještě přijde připomínka — a zaplatíte až na místě, hotově nebo kartou. Kdyby vám termín nakonec nevyšel, rezervaci zrušíte přímo z e-mailu.",
} as const

export type RezervaceOknoLabel = Exclude<keyof typeof REZERVACE_OKNO_DEFAULTS, `${string}#note`>

/** Věta za odstavcem čekací listiny — pravidlo, ne redakční text; do CMS nepatří. */
export const WAITLIST_RULE = "Místo se přitom nedrží — patří tomu, kdo dřív dokončí rezervaci."
