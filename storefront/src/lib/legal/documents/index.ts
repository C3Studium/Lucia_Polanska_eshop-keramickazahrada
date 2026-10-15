import type { LegalDocumentVersion } from "../types"

import cookies20261015 from "./cookies/2026-10-15"
import dopravaAPlatba20261015 from "./doprava-a-platba/2026-10-15"
import obchodniPodminky20150101 from "./obchodni-podminky/2015-01-01"
import obchodniPodminky20261015 from "./obchodni-podminky/2026-10-15"
import ochranaOsobnichUdaju20261015 from "./ochrana-osobnich-udaju/2026-10-15"
import odstoupeni20261015 from "./odstoupeni-od-smlouvy/2026-10-15"
import reklamacniProtokol20261015 from "./reklamacni-protokol/2026-10-15"
import reklamacniRad20261015 from "./reklamacni-rad/2026-10-15"

/**
 * Všechny verze všech právních dokumentů.
 *
 * Každá verze je vlastní soubor `./<slug>/<YYYY-MM-DD>.ts` exportující
 * `LegalDocumentVersion` — staré verze se NEMAŽOU ani nepřepisují (váže se
 * k nim uzavřená smlouva). Nové znění = nový soubor s novým datem.
 *
 * Kontrola tvaru (unikátní kotvy, známé {{fakty}}…): `./validate.ts`.
 */
export const ALL_VERSIONS: LegalDocumentVersion[] = [
  obchodniPodminky20150101,
  obchodniPodminky20261015,
  reklamacniRad20261015,
  reklamacniProtokol20261015,
  odstoupeni20261015,
  ochranaOsobnichUdaju20261015,
  cookies20261015,
  dopravaAPlatba20261015,
]
