import "server-only"

import { cookies } from "next/headers"
import {
  ADMIN_BRIDGE_TTL_SECONDS,
  verifyAdminBridgeToken,
  type AdminBridgeClaims,
} from "@lib/util/admin-bridge-token"

/**
 * „Je tohle admin?" — answered from the storefront's own cookie, never from
 * the backend's.
 *
 * The bar exists so that spotting something wrong on the live shop is one
 * click from the screen that fixes it. What it must not become is a way for
 * a visitor to *learn* anything: an unauthenticated request gets a page with
 * no bar and no trace that a bar exists.
 *
 * The cookie holds the same signed token the backend minted
 * (`admin-bridge-token.ts`), so this check is a signature check — not a
 * database lookup, and not a flag a browser can simply set. Without the shared
 * secret the verification always fails, which is the right way for a
 * misconfigured deployment to break.
 */

export const ADMIN_BRIDGE_COOKIE = "kz_admin"

const secret = (): string => process.env.ADMIN_BRIDGE_SECRET ?? ""

/** The admin behind this request, or null. */
export const getAdminBridgeSession =
  async (): Promise<AdminBridgeClaims | null> => {
    const configured = secret()
    if (!configured) {
      return null
    }
    try {
      const token = (await cookies()).get(ADMIN_BRIDGE_COOKIE)?.value
      return verifyAdminBridgeToken(token, configured)
    } catch {
      // Reading cookies throws in a statically rendered context; a page that
      // cannot see the request simply has no admin.
      return null
    }
  }

/** Cookie options for both setting and clearing — one definition, no drift. */
export const adminBridgeCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: ADMIN_BRIDGE_TTL_SECONDS,
}
