/**
 * Handle z adresy, jak ho zná Medusa.
 *
 * Next 15 dává parametr cesty ještě ZAKÓDOVANÝ: pro „zvonkové-tlačítko-jeřabina"
 * přijde `zvonkov%C3%A9-tla%C4%8D…` a Medusa takový handle nezná → „Stránka
 * nenalezena", přestože obchod výrobek ukazuje (13. 11. 2026). Rozbalit
 * a sjednotit na NFC — tak jsou handly uložené; macOS/iOS umí poslat
 * rozložené „é" (NFD). Osamělé „%" se rozbalit nedá, pak zůstane, jak je.
 */
export function productHandle(raw: string) {
  let handle = raw
  try {
    handle = decodeURIComponent(raw)
  } catch {
    // není co rozbalit
  }
  return handle.normalize("NFC")
}

/** „modelovaný-květináč-…-vážkou-20" → „modelovany-kvetinac-…-vazkou-20". */
export function asciiHandle(handle: string) {
  return handle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
