import { NextResponse } from "next/server"

import { getCartId, removeCartId, removeExpressCartId } from "@lib/data/cookies"

/*
 * Zahodit rozdělaný košík — nástroj na vývoj.
 *
 * Zaseklý košík se z prohlížeče nedá odklidit ničím, co má člověk po ruce:
 * `_medusa_cart_id` je httpOnly cookie, takže na ni nesáhne ani skript na
 * stránce, ani tvrdý reload. Při ladění pokladny se přitom košík zasekne
 * pokaždé, když se objednávka nepodaří dokončit — a než se zjistí proč, je
 * potřeba mít čistý stůl.
 *
 * Košík se na backendu nemaže, jen se na něj přestane ukazovat: nový si
 * `getOrSetCart` založí při nejbližším přidání do košíku. Opuštěný sám vyprší
 * a v datech po něm nezbude nedodělek, který by někdo musel dohledávat.
 *
 * ### Odpovídá stránkou, ne přesměrováním
 *
 * Původně to po zahození rovnou vracelo na úvodní stránku — jenže když se pak
 * košík v navigaci nezměnil, nedalo se poznat, jestli se nic nesmazalo, nebo
 * jestli se smazalo něco jiného. Cookie se totiž váže na adresu: `localhost`
 * a `127.0.0.1` jsou pro prohlížeč dva různé weby, každý s vlastním košíkem.
 * Otevřít reset na jedné adrese a dívat se na obchod na druhé vypadá přesně
 * jako „nefunguje to". Proto tahle stránka řekne, co zahodila a kde.
 *
 * ### Jen na vývoji
 *
 * V ostrém provozu tenhle endpoint neexistuje — vrací 404, jako by tu nebyl.
 * Adresa bez jakéhokoli ověření, která komukoli zahodí košík, do obchodu
 * nepatří; stačilo by ji někam poslat jako odkaz.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const jenNaVyvoji = process.env.NODE_ENV !== "production"

const zahodit = async () => {
  const puvodni = await getCartId()

  await removeCartId()
  await removeExpressCartId()

  console.info(`[košík] zahozen na vyžádání: ${puvodni ?? "žádný košík nebyl"}`)

  return puvodni ?? null
}

const stranka = (puvodni: string | null, host: string) => `<!doctype html>
<html lang="cs"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Košík zahozen</title>
<style>
  body { margin:0; display:grid; place-items:center; min-height:100vh;
         font:16px/1.6 system-ui, sans-serif; background:#20211c; color:#efe7dc; }
  main { max-width:34rem; padding:2rem; }
  h1 { font-size:1.5rem; margin:0 0 .75rem; }
  code { background:rgba(255,255,255,.08); padding:.1rem .35rem; border-radius:.25rem; }
  p { margin:.5rem 0; }
  .vedlejsi { color:#a9a297; font-size:.9375rem; }
  a { color:#c9d1b4; }
</style></head><body><main>
<h1>${puvodni ? "Košík zahozen." : "Žádný košík tu nebyl."}</h1>
${
  puvodni
    ? `<p>Zahozený košík: <code>${puvodni}</code></p>
       <p class="vedlejsi">Nový vznikne při nejbližším přidání do košíku.</p>`
    : `<p class="vedlejsi">Na adrese <code>${host}</code> žádná cookie s košíkem nebyla.
       Pokud obchod prohlížíte na jiné adrese (<code>localhost</code> versus
       <code>127.0.0.1</code>), má tam vlastní košík — otevřete tuhle stránku tam.</p>`
}
<p><a href="/">Zpátky do obchodu</a></p>
</main></body></html>`

export async function GET(request: Request) {
  if (!jenNaVyvoji) {
    return new NextResponse(null, { status: 404 })
  }

  const puvodni = await zahodit()
  const host = new URL(request.url).host

  return new NextResponse(stranka(puvodni, host), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })
}

export async function POST() {
  if (!jenNaVyvoji) {
    return new NextResponse(null, { status: 404 })
  }

  const puvodni = await zahodit()

  return NextResponse.json(
    { zahozeno: puvodni },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  )
}
