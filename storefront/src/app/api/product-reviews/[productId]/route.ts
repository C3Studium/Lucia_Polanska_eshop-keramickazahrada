import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sdk } from "@lib/config"

export async function GET(
  req: NextRequest,
  // `params` je od Next 15 Promise, ne objekt. Se synchronním tvarem se
  // vygenerovaný validátor routy neshodne a build spadne na `ParamCheck`.
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get("_medusa_jwt")?.value
  const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  const search = req.nextUrl.searchParams
  const limit = Number(search.get("limit") || 10)
  const offset = Number(search.get("offset") || 0)

  const baseHeaders: Record<string, string> = {
    ...(pk ? { "x-publishable-api-key": pk, "x-publishable-key": pk } : {}),
  }
  const authHeaders: Record<string, string> = token
    ? { authorization: `Bearer ${token}` }
    : {}

  try {
    // Public, approved product reviews
    const productResp = await sdk.client.fetch<{
      reviews: any[]
      average_rating: number
      limit: number
      offset: number
      count: number
    }>(`/store/products/${productId}/reviews`, {
      method: "GET",
      headers: baseHeaders,
      query: { limit, offset, order: "-created_at" },
      cache: "no-store",
    })

    let combined = Array.isArray(productResp.reviews)
      ? productResp.reviews.filter((r) => !!r)
      : []

    // If user is logged in, merge in user's own reviews for this product (even if pending)
    if (token) {
      try {
        const meResp = await sdk.client.fetch<{
          reviews: any[]
        }>(`/store/customers/me/reviews`, {
          method: "GET",
          headers: { ...baseHeaders, ...authHeaders },
          cache: "no-store",
          query: { limit: 50, order: "-created_at" },
        })

        const mineForProduct = (Array.isArray(meResp.reviews) ? meResp.reviews : [])
          .filter((r) => !!r && r.product_id === productId)

        const seen = new Set(combined.map((r: any) => r.id))
        for (const r of mineForProduct) {
          if (!seen.has(r.id)) {
            combined.push(r)
            seen.add(r.id)
          }
        }
      } catch (e) {
        // ignore merging errors
      }
    }

    return NextResponse.json({
      reviews: combined,
      average_rating: productResp.average_rating,
      limit: productResp.limit,
      offset: productResp.offset,
      count: productResp.count,
    })
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message || "Failed to load product reviews" },
      { status: 500 }
    )
  }
}
