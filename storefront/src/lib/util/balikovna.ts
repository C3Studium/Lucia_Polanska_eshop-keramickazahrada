/**
 * Balíkovna (Česká pošta) — rozpoznání dopravy a výběr výdejního místa.
 *
 * Widget je oficiální iframe `https://b2c.cpost.cz/locations/?type=BALIKOVNY`
 * (manuál „Balíkovna-widget-implementace", balikovna.cz). Výběr místa přijde
 * jako postMessage:
 *
 *   { message: "pickerResult", point: { id, zip, name, address, … } }
 *
 * Pozor na adresu štítku: skládá se VÝHRADNĚ ze slova „BALÍKOVNA" + ZIP +
 * NAME („BALÍKOVNA, 160 00 Praha 6"). PSČ v `point.address` je PSČ městské
 * části a od PSČ provozovny se většinou liší — proto se ukládají zip a name
 * zvlášť a adresa je jen popisná.
 */

export const BALIKOVNA_WIDGET_URL =
  "https://b2c.cpost.cz/locations/?type=BALIKOVNY"
export const BALIKOVNA_WIDGET_ORIGIN = "https://b2c.cpost.cz"

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("cs")

/** Balíkovna carriage, by the option's own name — same convention as dobirka.ts. */
export const isBalikovnaOption = (
  option: { name?: string | null } | null | undefined
) => fold(option?.name ?? "").includes("balikovna")

export type BalikovnaPoint = {
  id: string
  zip: string
  name: string
  address: string
  /**
   * Typ místa z widgetu: `POSTA`, `DEPO`, `PARTNER` (Žabka, Allwyn…) nebo
   * `BOX` (AlzaBox, OX Point…). U boxu se dobírka platí jen předem kartou
   * online — proto ji tam nenabízíme (viz `isBalikovnaBox`). Prázdné u
   * výběrů uložených před 11. 10. 2026.
   */
  subtype?: string
}

/**
 * Box = samoobslužný box, kde se dobírka NEPLATÍ na místě, jen předem kartou
 * online přes odkaz v SMS (Balíkovna). `BBOX` je BalíkoBOX — totéž.
 */
export const isBalikovnaBox = (subtype: string | null | undefined) =>
  typeof subtype === "string" && /^b?box$/i.test(subtype.trim())

/**
 * Widget s vypnutými boxy (`disableBoxes` — parametr widgetu ČP, box pak nejde
 * vybrat s hláškou „E-shop neumožňuje doručení do boxu"). Pro objednávku, která
 * už je na dobírku a mění výdejnu.
 */
export const BALIKOVNA_WIDGET_URL_NO_BOXES = `${BALIKOVNA_WIDGET_URL}&disableBoxes`

/** postMessage z widgetu → vybrané místo; cokoli jiného vrací null. */
export const parsePickerResult = (data: unknown): BalikovnaPoint | null => {
  const payload = data as
    | { message?: string; point?: Record<string, unknown> }
    | null
  if (!payload || payload.message !== "pickerResult" || !payload.point) {
    return null
  }
  const point = payload.point
  if (!point.zip || !point.name) return null
  return {
    id: point.id != null ? String(point.id) : "",
    zip: String(point.zip),
    name: String(point.name),
    address: point.address != null ? String(point.address) : "",
    subtype: typeof point.subtype === "string" ? point.subtype.toUpperCase() : "",
  }
}

/** Obnova výběru z cart.metadata — návrat na krok dopravy o něj nepřijde. */
export const balikovnaPointFromMetadata = (
  metadata: Record<string, unknown> | null | undefined
): BalikovnaPoint | null => {
  const zip = metadata?.balikovna_point_zip
  const name = metadata?.balikovna_point_name
  if (typeof zip !== "string" || typeof name !== "string" || !zip || !name) {
    return null
  }
  return {
    id:
      typeof metadata?.balikovna_point_id === "string"
        ? metadata.balikovna_point_id
        : "",
    zip,
    name,
    address:
      typeof metadata?.balikovna_point_address === "string"
        ? metadata.balikovna_point_address
        : "",
    subtype:
      typeof metadata?.balikovna_point_subtype === "string"
        ? metadata.balikovna_point_subtype
        : "",
  }
}

/** „160 00 Praha 6" — přesně to, co půjde na štítek za slovem BALÍKOVNA. */
export const formatBalikovnaPoint = (point: BalikovnaPoint) =>
  `${point.zip} ${point.name}`
