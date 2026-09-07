import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { DOKUMENTY_MODULE } from "../../../../modules/dokumenty"
import type DokumentyModuleService from "../../../../modules/dokumenty/service"

/**
 * Jeden dokument podle jména: `/store/documents/reklamacni-formular`.
 *
 * Po jednom, ne seznamem, schválně. Stránka ví, co chce, a nemá důvod tahat
 * celou knihovnu kvůli jednomu PDF — a hlavně: co se nedostane na drát, to se
 * nedá omylem vypsat někam, kam nepatří.
 *
 * Chybějící dokument je **404**, ne prázdná odpověď. Stránka pak nemusí
 * rozlišovat „nenahráno" od „nahráno prázdné" a ukáže svůj náhradní text.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const key = req.params.key
  const service = req.scope.resolve<DokumentyModuleService>(DOKUMENTY_MODULE)
  const [document] = (await service.listSiteDocuments({ key })) as any[]

  if (!document) {
    return res.status(404).json({ message: `Dokument „${key}" není nahraný.` })
  }

  res.json({
    document: {
      key: document.key,
      title: document.title,
      url: document.file_url,
      file_name: document.file_name,
      mime_type: document.mime_type,
      size: document.size,
    },
  })
}
