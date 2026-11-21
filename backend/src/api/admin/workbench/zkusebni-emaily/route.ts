import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { posliZkusebniEmaily } from "../../../../lib/zkusebni-emaily"

/**
 * POST — tlačítko „Poslat zkušební e-maily" v Nastavení obchodu › E-maily
 * obchodu. Jeden e-mail na adresu obchodu, jeden vývojáři; zákazníkům nic.
 * Vrací, kam šly a jestli je Resend přijal (`lib/zkusebni-emaily.ts`).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await posliZkusebniEmaily(req.scope))
}
