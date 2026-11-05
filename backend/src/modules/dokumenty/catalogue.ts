/**
 * Dokumenty, které web očekává.
 *
 * Tenhle seznam **není** výčet toho, co může existovat — nové dokumenty se
 * zakládají v administraci a pojmenují se tam. Je to výčet toho, co má web
 * někde napevno zadrátované a bez čeho se nějaké místo na stránce nezobrazí
 * celé. Proto se z něj berou dvě věci a nic víc:
 *
 *  1. bloky, které administrace ukáže i prázdné, ať je vidět, co chybí,
 *  2. upozornění v Přehledu, když povinný dokument nahraný není.
 *
 * Kdo přidá do kódu další `getSiteDocument("neco")`, přidá sem řádek. Kdo si
 * jen chce někam nahrát PDF a odkázat na něj ručně, sem nesahá vůbec.
 *
 * ## Proč je prázdný (4. 11. 2026)
 *
 * Jediným slotem byl `reklamacni-formular` — místo pro formulář k reklamaci
 * u poškozené zásilky. Ten slot zmizel, protože se nedá naplnit ničím
 * rozumným:
 *
 * - **Česká pošta formulář ke stažení nevydává.** Jediný, co zveřejňuje
 *   (`formular-reklamace-pdf`, verze 09/2024), platí výslovně pro „Balík Do
 *   ruky nad 30 kg a Balíkovna plus nad 30 kg". Keramická zásilka takovou
 *   hmotnost nemá, takže by tam viselo PDF, které se na ni nevztahuje.
 *   U běžné zásilky se reklamace podává na kterékoli poště, nebo
 *   elektronicky — nic se předem nevyplňuje.
 * - **Vlastní protokol není nahrávaný soubor, ale právní dokument.**
 *   „Reklamační protokol" má svoje vydávané znění
 *   (`storefront/src/lib/legal/documents/reklamacni-protokol`), stránku
 *   `/reklamacni-protokol#formular` a vygenerované PDF v manifestu. Nahrát
 *   jeho kopii sem by znamenalo druhý zdroj pravdy, který nikdo neudrží
 *   v souladu s vydaným zněním.
 *
 * Katalog zůstává, i když je prázdný: typ i pomocné funkce drží přesně to
 * chování, na kterém stojí Přehled a administrace, a další zadrátované místo
 * se sem přidá jedním řádkem.
 */
export type DocumentSlot = {
  key: string
  title: string
  /** Kde na webu se ukazuje — aby bylo z administrace poznat, co se rozbije. */
  where: string
  required: boolean
}

export const DOCUMENT_SLOTS: DocumentSlot[] = []

export const findSlot = (key: string) =>
  DOCUMENT_SLOTS.find((slot) => slot.key === key) ?? null

/**
 * Očekávané dokumenty, které nemají nahraný soubor. Povinné první — jen na ty
 * se upozorňuje.
 */
export const missingSlots = (nahrane: { key: string }[]) => {
  const mame = new Set(nahrane.map((document) => document.key))

  return DOCUMENT_SLOTS.filter((slot) => !mame.has(slot.key)).sort(
    (a, b) => Number(b.required) - Number(a.required)
  )
}
