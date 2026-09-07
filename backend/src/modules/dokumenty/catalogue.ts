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
 */
export type DocumentSlot = {
  key: string
  title: string
  /** Kde na webu se ukazuje — aby bylo z administrace poznat, co se rozbije. */
  where: string
  required: boolean
}

export const DOCUMENT_SLOTS: DocumentSlot[] = [
  {
    key: "reklamacni-formular",
    title: "Formulář k reklamaci",
    where: "Potvrzení objednávky — blok „Převzetí zásilky“",
    required: true,
  },
]

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
