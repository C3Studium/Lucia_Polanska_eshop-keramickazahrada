import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { verifyAdminBridgeToken } from "../../../lib/admin-bridge-token"
import { ADMIN_BRIDGE_SECRET } from "../../../lib/constants"
import {
  ensureStudioPreviewCart,
  mintStudioPreviewCustomer,
  readStudioPreviewData,
} from "../../../lib/studio-preview"

/**
 * GET /store/studio-preview — ukázková data pro náhled ve Studiu.
 *
 * Volá to jen server storefrontu (`src/app/api/studio/ukazka`), a to až když
 * ověřil, že se ptá přihlášený redaktor Studia. Odpověď nese podepsané tokeny
 * k objednávkám, rezervaci a poukazům, takže bez důkazu se nevydá nic:
 * hlavička `x-studio-preview` je krátkodobý token podepsaný sdíleným
 * `ADMIN_BRIDGE_SECRET` (tentýž, kterým administrace podepisuje lištu
 * „Otevřít web jako admin"), s `email: "studio:…"` a platností nejvýš 5 minut.
 * Token administrátorské lišty (týden) tu neprojde.
 *
 * `?cart=1` k tomu založí nebo vrátí ukázkový košík, `?customer=1` vydá
 * patnáctiminutový token zákazníka pro stránky účtu (lib/studio-preview).
 */

const MAX_TTL_SECONDS = 5 * 60

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("Cache-Control", "no-store")

  if (!ADMIN_BRIDGE_SECRET) {
    res.status(503).json({ message: "Náhled Studia není nastavený (chybí ADMIN_BRIDGE_SECRET)." })
    return
  }
  const claims = verifyAdminBridgeToken(String(req.headers["x-studio-preview"] ?? ""), ADMIN_BRIDGE_SECRET)
  const now = Math.floor(Date.now() / 1000)
  if (!claims || !claims.email.startsWith("studio:") || claims.exp - now > MAX_TTL_SECONDS) {
    res.status(401).json({ message: "Neplatný požadavek náhledu." })
    return
  }

  if (req.query.customer === "1") {
    const customer = await mintStudioPreviewCustomer(req.scope).catch(() => null)
    res.json({ customer })
    return
  }

  if (req.query.cart === "1") {
    const cartId = await ensureStudioPreviewCart(req.scope).catch(() => null)
    res.json({ cart_id: cartId })
    return
  }

  res.json(await readStudioPreviewData(req.scope))
}
