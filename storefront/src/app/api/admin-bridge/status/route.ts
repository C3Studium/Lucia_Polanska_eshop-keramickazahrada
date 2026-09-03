import { NextResponse } from "next/server"
import { backendUrl } from "@lib/config"
import { getAdminBridgeSession } from "@lib/data/admin-bridge"

/**
 * „Jsem admin?" — asked by the bar, answered from the httpOnly cookie.
 *
 * ## Why the bar cannot just ask on the server
 *
 * Product pages are statically prerendered (`generateStaticParams`), and the
 * storefront's own convention wraps `cookies()` in try/catch
 * (`lib/data/cookies.ts`) — which means Next never sees the dynamic access and
 * happily bakes the page at build time, when there is no cookie and therefore
 * no admin. A server-rendered bar would be baked *out* of exactly the pages
 * the bar is most useful on.
 *
 * Making those pages dynamic would fix it and cost the shop its static
 * product pages. So the bar asks here instead: the page stays static, this
 * route stays dynamic, and the bar appears a moment after load for the one
 * person who has the cookie.
 *
 * Leaks nothing: without a valid cookie the answer is a flat `false`, and
 * `backendUrl` is already public (`NEXT_PUBLIC_MEDUSA_BACKEND_URL`).
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getAdminBridgeSession()

  const body = session
    ? { admin: true as const, email: session.email, backendUrl }
    : { admin: false as const }

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store, private" },
  })
}
