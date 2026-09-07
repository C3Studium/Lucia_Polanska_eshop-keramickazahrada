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
