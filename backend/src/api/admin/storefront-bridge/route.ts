import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  ADMIN_BRIDGE_TTL_SECONDS,
  signAdminBridgeToken,
} from "../../../lib/admin-bridge-token"
import { ADMIN_BRIDGE_SECRET } from "../../../lib/constants"
import { storefrontOrigin } from "../../../lib/storefront-url"

/**
 * „Otevřít web jako admin" — mints the handover token.
 *
 * Being able to call this at all *is* the authentication: `/admin` is behind
 * the framework's session guard, so whoever reaches this handler is already a
 * logged-in admin. The handler's whole job is to restate that fact in a form
 * the storefront can check on its own domain
 * (`lib/admin-bridge-token.ts` explains why the session itself cannot cross).
 *
 * The returned URL is single-use in spirit: the storefront swaps the token for
 * its own cookie and redirects, so the token stops appearing in the address
 * bar after the first hop.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const actorId = req.auth_context?.actor_id
  if (!actorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  if (!ADMIN_BRIDGE_SECRET) {
    res.status(503).json({
      message:
        "Propojení s webem není nastavené — chybí ADMIN_BRIDGE_SECRET. Doplňte ho na backendu i ve storefrontu (stejnou hodnotu).",
    })
    return
  }

  const origin = storefrontOrigin()
  if (!origin) {
    res.status(503).json({
      message:
        "Propojení s webem není nastavené — chybí STOREFRONT_PUBLIC_URL na backendu.",
    })
    return
  }

  /*
   * Where to land. Only a same-site path is accepted, never a whole URL: an
   * attacker who could talk an admin into following a crafted link would
   * otherwise get an open redirect that carries a live token with it.
   */
  const requested = String((req.query?.path as string) ?? "/")
  const path =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/"

  // The e-mail is for the bar's own label („přihlášen jako …"), so a shared
  // browser says who it thinks you are. Best-effort: a missing user is not a
  // reason to refuse the bridge.
  let email = ""
  try {
    const userModule = req.scope.resolve(Modules.USER)
    const users = (await (userModule as any).listUsers({ id: actorId })) as any[]
    email = users?.[0]?.email ?? ""
  } catch {
    email = ""
  }

  const token = signAdminBridgeToken(
    {
      email,
      exp: Math.floor(Date.now() / 1000) + ADMIN_BRIDGE_TTL_SECONDS,
    },
    ADMIN_BRIDGE_SECRET
  )

  const url = `${origin}/api/admin-bridge?token=${encodeURIComponent(
    token
  )}&redirect=${encodeURIComponent(path)}`

  res.setHeader("Cache-Control", "no-store")
  res.json({ url, expires_in: ADMIN_BRIDGE_TTL_SECONDS })
}
