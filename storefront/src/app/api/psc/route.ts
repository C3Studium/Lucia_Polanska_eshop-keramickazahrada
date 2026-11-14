import { NextResponse } from "next/server"
import { normalizujPsc } from "@lib/util/psc"
import data from "@lib/data/psc-obce.json"

/**
 * PSČ → obce pro doplnění města v adrese (14. 11. 2026). Data z České pošty,
 * viz `scripts/psc-build.mjs`. Bez dat vrací prázdný seznam a formulář se
 * chová jako dřív.
 */
const mapa = data as Record<string, string[]>

export async function GET(request: Request) {
  const psc = normalizujPsc(new URL(request.url).searchParams.get("psc"))
  const obce = psc ? mapa[psc] ?? [] : []
  return NextResponse.json(
    { obce },
    { headers: { "cache-control": "public, max-age=86400" } }
  )
}
