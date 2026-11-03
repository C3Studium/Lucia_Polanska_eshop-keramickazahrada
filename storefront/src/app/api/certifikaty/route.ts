import { NextResponse } from "next/server"
import { getCertificates } from "@lib/data/certificates"

/**
 * Publikované doklady ze Studia (typ `certifikat`) jako JSON.
 *
 * Čte ho backend (`backend/src/lib/glaze-protocols.ts`) — do databáze Studia
 * nevidí, a protokol o nezávadnosti glazury přikládá k potvrzení objednávky —
 * a karta výrobku (`SafetyNotice`), která na protokol odkazuje. Jen veřejné
 * údaje, které stojí i na /certifikaty; koncepty nikdy (bez draft cookie).
 */

/*
 * Soubor z knihovny médií Studia může mít relativní adresu
 * (`/api/cms/asset/…`). Backend ho přikládá k e-mailu a Resend bere jen
 * celou https adresu — proto se tu doplní adresa webu, ze které dotaz přišel
 * (za proxy podle `x-forwarded-*`).
 */
const absolute = (url: string, request: Request): string => {
  if (!url || /^https?:\/\//i.test(url)) return url
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host")
  const base = host ? `${proto || new URL(request.url).protocol.replace(":", "")}://${host}` : request.url
  return new URL(url, base).toString()
}

export async function GET(request: Request) {
  const { glazes, declarations } = await getCertificates()
  const certificates = {
    glazes: glazes.map((row) => ({ ...row, url: absolute(row.url, request) })),
    declarations: declarations.map((row) => ({ ...row, url: row.url ? absolute(row.url, request) : row.url })),
  }
  return NextResponse.json(certificates, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  })
}
