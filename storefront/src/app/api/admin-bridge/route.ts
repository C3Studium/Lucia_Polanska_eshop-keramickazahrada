import { NextRequest, NextResponse } from "next/server"
import {
  ADMIN_BRIDGE_COOKIE,
  adminBridgeCookieOptions,
} from "@lib/data/admin-bridge"
import { ADMIN_BRIDGE_HINT_COOKIE } from "@lib/util/admin-bridge-hint"
import { verifyAdminBridgeToken } from "@lib/util/admin-bridge-token"

/**
 * The handover: token in the URL once, first-party cookie from then on.
 *
 * The admin arrives here from the backend's „Otevřít web jako admin" carrying
 * a signed statement that it was an admin who asked. This route checks the
 * signature, trades it for a cookie on the storefront's own domain, and
 * redirects — so the token leaves the address bar immediately and is never
 * in a page the browser might keep, share or log.
 *
 * `GET ?logout=1` throws the cookie away again, which is what the bar's
 * „Skrýt lištu" does.
 */

// The token check uses node:crypto, so this must not run on the edge runtime.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Only a path on this site — never a whole URL, which would be an open redirect. */
const safeRedirect = (value: string | null): string => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/"
  }
  return value
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const target = safeRedirect(url.searchParams.get("redirect"))

  if (url.searchParams.get("logout") === "1") {
    const response = NextResponse.redirect(new URL(target, url.origin))
    response.cookies.set(ADMIN_BRIDGE_COOKIE, "", {
      ...adminBridgeCookieOptions,
      maxAge: 0,
    })
    response.cookies.set(ADMIN_BRIDGE_HINT_COOKIE, "", {
      ...adminBridgeCookieOptions,
      httpOnly: false,
      maxAge: 0,
    })
    return response
  }

  const secret = process.env.ADMIN_BRIDGE_SECRET ?? ""
  const token = url.searchParams.get("token")
  const claims = verifyAdminBridgeToken(token, secret)

  if (!claims) {
    /*
     * A bad, expired or unsigned token is not an error page — it is just a
     * visitor. Redirecting to the plain site tells an attacker probing this
     * endpoint nothing about whether the secret, the format or the expiry was
     * what let them down.
     */
    return NextResponse.redirect(new URL(target, url.origin))
  }

  // The cookie must never outlive the statement inside it.
  const maxAge = Math.max(0, claims.exp - Math.floor(Date.now() / 1000))

  const response = NextResponse.redirect(new URL(target, url.origin))
  response.cookies.set(ADMIN_BRIDGE_COOKIE, token as string, {
    ...adminBridgeCookieOptions,
    maxAge,
  })
  /*
   * The readable marker that lets the bar skip its status request for
   * everyone else (`lib/util/admin-bridge-hint.ts`). It carries no claim —
   * the answer still comes from the signed cookie above — so it is safe for
   * it to be visible to scripts, and it must be, or it has no purpose.
   */
  response.cookies.set(ADMIN_BRIDGE_HINT_COOKIE, "1", {
    ...adminBridgeCookieOptions,
    httpOnly: false,
    maxAge,
  })
  return response
}
