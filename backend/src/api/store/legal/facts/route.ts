import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { getLegalFacts } from "../../../../lib/merchant-settings"

/**
 * GET /store/legal/facts — právní údaje obchodu, jen ke čtení.
 *
 * Web je dosazuje za `{{klíč}}` do obchodních podmínek, poučení, zásad
 * a pokladny (`storefront/src/lib/data/legal-facts.ts` → `getLegalFacts()`).
 * Vyplňují se v administraci („Právní údaje", merchant setting `legal_facts`)
 * a platné hodnoty skládá `resolveLegalFacts` (`lib/legal-facts.ts`):
 * chybějící klíč = výchozí hodnota z kódu, nevyplněný = `null`.
 *
 * `{ facts: Record<klíč, string | null>, updated_at: string | null }`.
 *
 * Nic tajného: jsou to tytéž údaje, které stojí v obchodních podmínkách na
 * webu. Publikovatelný klíč vynucuje Medusa pro celé `/store/*` sama.
 *
 * Poškozená hodnota v nastavení routu neshodí — čtení nastavení ji zahodí
 * a platí výchozí. Když nastavení nejde přečíst vůbec (databáze), odpoví
 * 503 bez cache, ale i tak s výchozími údaji: storefront si pak vezme svou
 * zálohu (tytéž hodnoty) a za minutu se zeptá znovu — výpadek se nezapíše
 * do cache na minutu jako platná odpověď.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { facts, updated_at, source } = await getLegalFacts(req.scope)

  if (source !== "settings") {
    res.setHeader("Cache-Control", "no-store")
    res.status(503).json({
      message: "Právní údaje se nepodařilo načíst — posílám výchozí hodnoty.",
      facts,
      updated_at: null,
    })
    return
  }

  // Údaje se mění zřídka; minuta v cache prohlížeče/CDN nikomu neublíží
  // a změna v administraci se na webu projeví nejpozději do minuty.
  res.setHeader("Cache-Control", "public, max-age=60")
  res.status(200).json({ facts, updated_at })
}
