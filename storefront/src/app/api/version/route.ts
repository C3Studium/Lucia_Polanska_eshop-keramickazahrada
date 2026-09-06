import { NextResponse } from "next/server"

import { BUILD_STAMP } from "@lib/util/session-version"

/*
 * Která verze obchodu právě běží.
 *
 * Otevřená záložka se sem ptá, aby poznala, že mezitím vyšlo nasazení — sama
 * o něm neví, protože její stránka se načetla z předchozí verze a od té chvíle
 * žije jen v prohlížeči. Odpověď je pár bajtů a nesmí se cachovat, jinak by
 * záložka dostávala starou hodnotu a nikdy se nedozvěděla nic nového.
 *
 * `NEXT_PUBLIC_BUILD_STAMP` Next zapéká při sestavení, takže i pod `next start`
 * se tu vrací otisk toho buildu, který server obsluhuje — ne otisk poslední
 * změny prostředí.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET() {
  return NextResponse.json(
    { stamp: BUILD_STAMP },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}
