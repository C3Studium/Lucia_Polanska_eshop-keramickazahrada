import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { retrieveCustomer } from "@lib/data/customer"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { old_password, new_password, confirm_password } = body || {}

    if (!old_password || !new_password || !confirm_password) {
      return NextResponse.json({ message: "Vyplňte prosím všechna pole." }, { status: 400 })
    }
    if (new_password !== confirm_password) {
      return NextResponse.json({ message: "Nová hesla se neshodují." }, { status: 400 })
    }
    if (typeof new_password !== "string" || new_password.length < 8) {
      return NextResponse.json({ message: "Nové heslo musí mít aspoň 8 znaků." }, { status: 400 })
    }

    const cookieStore = await cookies()
    const token = cookieStore.get("_medusa_jwt")?.value
    const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
    if (!token) {
      return NextResponse.json({ message: "Nejste přihlášeni." }, { status: 401 })
    }

    // Zjisti email přihlášeného zákazníka
    const customer = await retrieveCustomer({ forceFresh: true })
    const email = customer?.email
    if (!email) {
      return NextResponse.json({ message: "Váš účet se nepovedlo načíst." }, { status: 400 })
    }

    // 1) deleguj na backend: /store/customers/me/password (nový flow)
    const res = await fetch(`${process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"}/store/customers/me/password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
        ...(pk ? { "x-publishable-api-key": pk, "x-publishable-key": pk } : {}),
      },
  body: JSON.stringify({ old_password, new_password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return NextResponse.json({ message: data?.message || "Heslo se nepovedlo změnit." }, { status: res.status })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || "Něco se nepovedlo." }, { status: 500 })
  }
}
