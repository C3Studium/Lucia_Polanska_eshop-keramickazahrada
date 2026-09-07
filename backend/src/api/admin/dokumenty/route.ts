import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { DOKUMENTY_MODULE } from "../../../modules/dokumenty"
import { DOCUMENT_SLOTS, findSlot } from "../../../modules/dokumenty/catalogue"
import type DokumentyModuleService from "../../../modules/dokumenty/service"

/**
 * Dokumenty ke stažení — správa z administrace.
 *
 * GET vrací dva seznamy zvlášť:
 *
 *  - `expected` — místa, která web očekává (viz `catalogue.ts`), i když v nich
 *    zatím nic není. Prázdné slovo se musí ukázat, jinak se o chybějícím
 *    dokumentu nikdo nedozví.
 *  - `extra` — cokoli dalšího, co si někdo nahrál a pojmenoval sám.
 *
 * POST uloží k jednomu jménu adresu souboru; jméno může být nové. Samotné
 * nahrání dělá běžné `/admin/uploads` (MinIO) a sem přijde jen to, co z něj
 * vypadlo — druhé úložiště by znamenalo druhé místo, kde se soubory ztrácejí.
 */
export const PostAdminDocumentSchema = z.object({
  /* Malá písmena, číslice a pomlčky: jméno jde do adresy `/store/documents/:key`
     a volá se z kódu, takže diakritika a mezery by z něj udělaly past. */
  key: z
    .string()
    .min(1)
    .regex(
      /^[a-z0-9][a-z0-9-]*$/,
      "Jméno smí mít jen malá písmena bez diakritiky, číslice a pomlčky."
    ),
  file_url: z.string().min(1),
  file_name: z.string().optional(),
  mime_type: z.string().optional(),
  size: z.number().optional(),
  title: z.string().optional(),
})

const naVystup = (document: any) => ({
  id: document.id,
  key: document.key,
  title: document.title,
  file_url: document.file_url,
  file_name: document.file_name,
  mime_type: document.mime_type,
  size: document.size,
  updated_at: document.updated_at,
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<DokumentyModuleService>(DOKUMENTY_MODULE)
  const ulozene = (await service.listSiteDocuments({})) as any[]
  const podleKlice = new Map(ulozene.map((document) => [document.key, document]))
  const ocekavane = new Set(DOCUMENT_SLOTS.map((slot) => slot.key))

  res.json({
    expected: DOCUMENT_SLOTS.map((slot) => ({
      ...slot,
      uploaded: podleKlice.has(slot.key)
        ? naVystup(podleKlice.get(slot.key))
        : null,
    })),
    extra: ulozene
      .filter((document) => !ocekavane.has(document.key))
      .map(naVystup),
  })
}

export async function POST(
  req: MedusaRequest<z.infer<typeof PostAdminDocumentSchema>>,
  res: MedusaResponse
) {
  const { key, title, ...soubor } = req.validatedBody
  const slot = findSlot(key)

  // Očekávaný slot má název v katalogu; u vlastního ho musí zadat člověk,
  // jinak by v seznamu visel dokument beze jména.
  const nazev = title?.trim() || slot?.title

  if (!nazev) {
    return res
      .status(400)
      .json({ message: "Dokument potřebuje název, pod kterým se ukáže." })
  }

  const service = req.scope.resolve<DokumentyModuleService>(DOKUMENTY_MODULE)
  const [stavajici] = (await service.listSiteDocuments({ key })) as any[]

  // Jedno jméno = jeden platný dokument. Nahrání nového přepisuje, nepřidává:
  // historii verzí by nikdo nečetl a v seznamu by překážela.
  const data = { ...soubor, title: nazev }

  const document = stavajici
    ? await service.updateSiteDocuments({ id: stavajici.id, ...data })
    : await service.createSiteDocuments({ key, ...data })

  res.json({ document })
}
