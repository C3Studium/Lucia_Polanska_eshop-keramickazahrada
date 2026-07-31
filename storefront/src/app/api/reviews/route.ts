import { NextResponse } from "next/server"
import { getAuthHeaders } from "@lib/data/cookies"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { title, content, rating, product_id, first_name, last_name } = body || {}

    // Validate required fields (allow empty first/last name; backend accepts empty strings)
    const hasContent = typeof content === "string" && content.trim().length > 0
    const numericRating = typeof rating === "number" ? rating : parseInt(String(rating), 10)
    const validRating = Number.isFinite(numericRating) && numericRating >= 1 && numericRating <= 5
    const hasProductId = typeof product_id === "string" && product_id.trim().length > 0

    if (!hasContent || !validRating || !hasProductId) {
      return NextResponse.json(
        { message: "Invalid request: content, rating (1-5) and product_id are required" },
        { status: 400 }
      )
    }

    const authHeaders = await getAuthHeaders()
    if (!("authorization" in authHeaders)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const backend = (
      process.env.MEDUSA_BACKEND_URL ||
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
      ""
    ).replace(/\/+$/, "")

    if (!backend) {
      return NextResponse.json(
        { message: "Backend URL is not configured" },
        { status: 500 }
      )
    }

    const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

    const res = await fetch(`${backend}/store/reviews`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders,
        ...(publishableKey
          ? { "x-publishable-api-key": publishableKey, "x-publishable-key": publishableKey }
          : {}),
      },
      body: JSON.stringify({
        title,
        content,
        rating: numericRating,
        product_id,
        first_name: typeof first_name === "string" ? first_name : "",
        last_name: typeof last_name === "string" ? last_name : "",
      }),
      cache: "no-store",
    })

    let data: any = null
    try {
      data = await res.json()
    } catch {
      data = null
    }

    if (!res.ok) {
      return NextResponse.json(
        { message: data?.message || data?.error || data || "Failed to create review" },
        { status: res.status }
      )
    }

    return NextResponse.json(data ?? { success: true }, { status: 200 })
  } catch (err) {
    console.error("[Reviews proxy] Failed to create review:", err)
    return NextResponse.json(
      { message: "Unexpected error while creating review" },
      { status: 500 }
    )
  }
}
