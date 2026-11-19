import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { posliChybuCeniku } from "../../../../../lib/international-shipping"

/**
 * Zkušební e-mail „ceník ČP se nepodařilo stáhnout" na vývojářskou adresu
 * (19. 11. 2026, Matěj: „pošli dev e-mail, který přijde, když to nefunguje").
 * Stejný text jako skutečné upozornění, jen s „[ZKOUŠKA]" a větou navíc.
 * Nic nestahuje ani nemění.
 */
export const POST = async (_req: MedusaRequest, res: MedusaResponse) => {
  const outcome = await posliChybuCeniku(_req.scope, {
    klic: `cp-cenik-chyba-zkouska:${Date.now()}`,
    chyby: [
      { country: "de", chyba: "HTTP 403: Access denied (ukázka — kalkulačka ČP odmítla dotaz)" },
      { country: "fr", chyba: "odpověď není JSON (HTTP 503): Service Unavailable (ukázka)" },
    ],
    zemi: 10,
    posledniStazeni: new Date().toISOString(),
    zkouska: true,
  })
  res.json({ odeslano: outcome?.email ?? "nevím" })
}
