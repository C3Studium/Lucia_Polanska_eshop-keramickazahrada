import { NextResponse } from "next/server"

import { carryCartToCurrentVersion } from "@lib/data/cart-version"

/*
 * Převede košík na právě běžící verzi obchodu.
 *
 * Musí to být route handler, ne stránka: `_medusa_cart_id` je httpOnly cookie
 * a přepsat ji jde jen tam, kde se skládá odpověď — při vykreslování to Next
 * zakazuje. Volá se jednou po nasazení, když prohlížeč sám pozná, že jeho
 * uložený otisk verze už neplatí (viz `@lib/util/session-version`).
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  try {
    const vysledek = await carryCartToCurrentVersion()

    return NextResponse.json(vysledek, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    /*
     * Neúspěch tu nesmí nic rozbít: zákazníkovi zůstane košík, jaký měl,
     * a k pokladně se dostane stejně jako dosud. Zapisuje se proto, aby se
     * o tom vědělo, ne aby se na to čekalo.
     */
    console.error("[košík] převod na novou verzi selhal:", error)

    return NextResponse.json(
      { stav: "chyba" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    )
  }
}
