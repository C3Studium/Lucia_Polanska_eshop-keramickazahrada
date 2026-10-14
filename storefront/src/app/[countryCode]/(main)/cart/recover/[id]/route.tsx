import { NextRequest } from "next/server"
import { retrieveCart } from "../../../../../../lib/data/cart"
import { setCartId } from "../../../../../../lib/data/cookies"
import { notFound } from "next/navigation"
type Params = Promise<{
  id: string
}>

/* `?step=payment` — z e-mailu „Platba neprošla": rovnou na krok platby v
   pokladně. Jiné hodnoty se ignorují (žádné přesměrování podle adresy). */
const CHECKOUT_STEPS = new Set(["payment"])

/**
 * Obnoví košík z odkazu v e-mailu (opuštěný košík, „Platba neprošla").
 *
 * Proč stránka, a ne rovnou HTTP přesměrování: cookie košíku je
 * `SameSite=Strict` a klik z e-mailu je navigace z cizího webu — prohlížeč pak
 * cookie nastaví, ale na přesměrovaný požadavek (pořád součást té cizí
 * navigace) ji nepošle a zákazník by přistál v prázdném košíku. Krok, který
 * udělá až tahle stránka, je navigace z našeho webu a cookie jde s ním.
 */
export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const cart = await retrieveCart(id)

  if (!cart) {
    return notFound()
  }

  await setCartId(id)

  const countryCode = String(
    cart.shipping_address?.country_code || cart.region?.countries?.[0]?.iso_2 || ""
  ).toLowerCase()
  const prefix = /^[a-z]{2}$/.test(countryCode) ? `/${countryCode}` : ""

  const step = req.nextUrl.searchParams.get("step") ?? ""
  const target =
    CHECKOUT_STEPS.has(step) && !cart.completed_at
      ? `${prefix}/checkout?step=${step}`
      : `${prefix}/cart`

  const html = `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0;url=${target}">
<title>Načítáme váš košík…</title>
</head>
<body>
<p>Načítáme váš košík… <a href="${target}">Pokračovat</a></p>
<script>location.replace(${JSON.stringify(target)})</script>
</body>
</html>`

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}
