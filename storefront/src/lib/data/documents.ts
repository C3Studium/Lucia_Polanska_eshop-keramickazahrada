import { sdk } from "@lib/config"

import { getCacheOptions } from "./cookies"

/**
 * Dokument ke stažení podle jména — PDF spravovaná v administraci (Dokumenty).
 *
 * Po jednom, ne seznamem: stránka ví, co chce, a nemá důvod tahat celou
 * knihovnu kvůli jednomu souboru. Backend na nenahraný dokument odpovídá 404,
 * takže tady stačí `null` a volající ukáže svůj náhradní text — rozlišovat
 * „slot neexistuje" od „soubor chybí" nemusí nikdo.
 *
 * Selhání se schválně nepropaguje. Chybějící PDF nesmí shodit stránku
 * s potvrzením objednávky; ta je pro zákazníka důležitější než odkaz na ní.
 *
 * Od 4. 11. 2026 to odsud nikdo nevolá: formulář k reklamaci na potvrzení
 * objednávky nahradil odkaz na vydávaný „Reklamační protokol" (právní
 * dokumenty) a jiné zadrátované místo web nemá. Funkce zůstává, protože
 * zůstává i cesta, pro kterou je — vlastní PDF nahrané v administraci
 * (Právní věci › Dokumenty) se z kódu volá právě takhle.
 */
export type SiteDocument = {
  key: string
  title: string
  url: string
  file_name: string | null
  mime_type: string | null
  size: number | null
}

export const getSiteDocument = async (
  key: string
): Promise<SiteDocument | null> => {
  const next = {
    ...(await getCacheOptions("documents")),
  }

  return sdk.client
    .fetch<{ document: SiteDocument }>(`/store/documents/${key}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ document }) => document ?? null)
    .catch(() => null)
}
