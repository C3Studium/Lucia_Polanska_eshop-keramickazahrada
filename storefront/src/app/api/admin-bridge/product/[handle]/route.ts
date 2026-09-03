import { NextRequest, NextResponse } from "next/server"
import { backendUrl, sdk } from "@lib/config"
import { getAdminBridgeSession } from "@lib/data/admin-bridge"

/**
 * „Upravit produkt" — from a product page to that product in the admin.
 *
 * The bar knows the handle (it is in the URL it is standing on); the admin
 * needs the id. Resolving it here rather than in the bar keeps the bar a plain
 * link — no client-side lookup, no product id rendered into a public page —
 * and the redirect hop is invisible.
 *
 * Guarded like everything else the bar touches: a visitor without a valid
 * admin cookie is sent to the product page instead, so this cannot be used as
 * a handle→id oracle.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params
  const url = new URL(request.url)
  const country = (url.searchParams.get("cc") || "cz").toLowerCase()
  const productPage = new URL(`/${country}/products/${handle}`, url.origin)

  const session = await getAdminBridgeSession()
  if (!session) {
    return NextResponse.redirect(productPage)
  }

  try {
    const { products } = await sdk.client.fetch<{
      products: { id: string }[]
    }>("/store/products", {
      method: "GET",
      query: { handle, limit: 1, fields: "id" },
      cache: "no-store",
    })

    const id = products?.[0]?.id
    if (!id) {
      return NextResponse.redirect(productPage)
    }

    // The shop's own simple product editor, not the native Medusa page —
    // it is where `backend/src/admin/routes/produkt/[id]` lives.
    return NextResponse.redirect(`${backendUrl}/app/produkt/${id}`)
  } catch {
    return NextResponse.redirect(productPage)
  }
}
