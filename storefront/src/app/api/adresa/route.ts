`import { NextResponse } from "next/server"
`
`export const dynamic = "force-dynamic"
`
`/**
` * Našeptávač adres v pokladně (15. 11. 2026) — přes Mapy.cz (api.mapy.cz,
` * Suggest). Klíč je jen na serveru (\`MAPY_API_KEY\`, zdarma na
` * developer.mapy.cz); bez něj routa vrací prázdný seznam a pole Adresa
` * funguje jako dřív. Jen Česko, jen adresy s číslem domu.
` *
` * Odpověď: [{ ulice: "Rokycanova 12", psc: "39701", mesto: "Písek" }]
` */
`type Polozka = { ulice: string; psc: string; mesto: string }
`
`export async function GET(request: Request) {
`  const key = process.env.MAPY_API_KEY
`  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 120)
`  if (!key || q.length < 3) {
`    return NextResponse.json({ adresy: [] as Polozka[] })
`  }
`  try {
`    const url = new URL("https://api.mapy.cz/v1/suggest")
`    url.searchParams.set("lang", "cs")
`    url.searchParams.set("limit", "6")
`    url.searchParams.set("type", "regional.address")
`    url.searchParams.set("locality", "cz")
`    url.searchParams.set("query", q)
`    url.searchParams.set("apikey", key)
`    const response = await fetch(url, { signal: AbortSignal.timeout(4000), cache: "no-store" })
`    if (!response.ok) return NextResponse.json({ adresy: [] })
`    const data = (await response.json()) as {
`      items?: Array<{
`        name?: string
`        zip?: string
`        regionalStructure?: Array<{ name?: string; type?: string }>
`      }>
`    }
`    const adresy: Polozka[] = (data.items ?? [])
`      .map((item) => {
`        const struktura = item.regionalStructure ?? []
`        const mesto =
`          struktura.find((r) => r.type === "regional.municipality")?.name ??
`          struktura.find((r) => r.type === "regional.municipality_part")?.name ??
`          ""
`        return {
`          ulice: String(item.name ?? "").trim(),
`          psc: String(item.zip ?? "").replace(/\s+/g, ""),
`          mesto: String(mesto).trim(),
`        }
`      })
`      .filter((a) => a.ulice)
`    return NextResponse.json(
`      { adresy },
`      { headers: { "Cache-Control": "private, max-age=300" } }
`    )
`  } catch {
`    return NextResponse.json({ adresy: [] })
`  }
`}
