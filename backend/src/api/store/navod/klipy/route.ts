import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { NAVOD_MODULE } from "../../../../modules/navod"

/**
 * Návod pro zákazníky — jen klipy obchodu (`area = store`), ne admin.
 * Obchod je kešuje (lib/navod v storefrontu), tak ať je odpověď malá.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const navod = req.scope.resolve(NAVOD_MODULE) as any
  const rows = await navod.listNavodKlips({ area: "store" }, { take: 500 })
  res.setHeader("Cache-Control", "public, max-age=300")
  res.json({
    klipy: Object.fromEntries(
      rows.map((row: any) => [row.key, { url: row.url, width: row.width, height: row.height }])
    ),
  })
}
