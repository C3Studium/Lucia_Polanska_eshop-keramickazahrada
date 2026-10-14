import type { LegalDocumentVersion } from "../types"

/**
 * Všechny verze všech právních dokumentů.
 *
 * Každá verze je vlastní soubor `./<slug>/<YYYY-MM-DD>.ts` exportující
 * `LegalDocumentVersion` — staré verze se NEMAŽOU ani nepřepisují (váže se
 * k nim uzavřená smlouva). Nové znění = nový soubor s novým datem.
 */
export const ALL_VERSIONS: LegalDocumentVersion[] = []
