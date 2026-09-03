import { NextRequest, NextResponse } from "next/server"
import { sdk } from "@lib/config"
import { getAuthHeaders } from "@lib/data/cookies"

export const runtime = "nodejs"

export async function DELETE(
  req: NextRequest,
  // `params` je od Next 15 Promise, ne objekt. Se synchronním tvarem se
  // vygenerovaný validátor routy neshodne a build spadne na `ParamCheck`.
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params)?.id
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, message: "Missing or invalid wishlist item id" },
        { status: 400 }
      )
    }

    const authHeaders = await getAuthHeaders()
    if (!("authorization" in authHeaders)) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      )
    }

    const incomingPk = req.headers.get("x-publishable-api-key") || req.headers.get("x-publishable-key")
    const publishableKey = incomingPk || process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
    if (!publishableKey) {
      return NextResponse.json(
        { success: false, message: "Missing publishable key configuration" },
        { status: 500 }
      )
    }

    const cookieHeader = req.headers.get("cookie") || undefined
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
      ...authHeaders,
      "x-publishable-api-key": publishableKey,
      "x-publishable-key": publishableKey,
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    }

    await sdk.client.fetch(`/store/customers/me/wishlists/items/${id}`, {
      method: "DELETE",
      headers,
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    const message = e?.message || "Failed to delete wishlist item"
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
