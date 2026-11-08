import { NextResponse } from "next/server"

/**
 * „Na jaké adresy se díváš?" — obchodní strana vzájemného ohlášení.
 *
 * Dvojče `backend/src/api/hooks/parovani/route.ts`; tam je i důvod, proč to
 * existuje. Stručně: backend a obchod se na sebe odkazují proměnnými, a když
 * se jedna rozejde, přestane fungovat něco, co nikomu nehlásí chybu. Tahle
 * routa jen řekne, co si obchod myslí; porovnává provozní hlídka backendu.
 *
 * Bezpečnost: sdílené tajemství v hlavičce — bez něj by to byl veřejný výpis
 * konfigurace.
 */

/** Sdílené tajemství. Vlastní, nebo to od revalidace — ať se nehlídají dvě. */
const parovaciTajemstvi = (): string =>
  process.env.SERVICE_PAIR_SECRET || process.env.REVALIDATE_SECRET || ""

const bezLomitka = (hodnota: string | undefined | null): string | null =>
  hodnota ? hodnota.replace(/\/+$/, "") : null

export async function GET(request: Request) {
  const tajemstvi = parovaciTajemstvi()

  if (!tajemstvi) {
    return NextResponse.json(
      {
        ok: false,
        zprava:
          "Není nastavené SERVICE_PAIR_SECRET ani REVALIDATE_SECRET — spárování nejde ověřit.",
      },
      { status: 503 }
    )
  }

  if (request.headers.get("x-pair-secret") !== tajemstvi) {
    return NextResponse.json(
      { ok: false, zprava: "Neplatné tajemství." },
      { status: 401 }
    )
  }

  return NextResponse.json({
    ok: true,
    sluzba: "storefront",
    /* Za koho se obchod sám vydává — adresa v odkazech, e-mailech a sitemapě. */
    ja: bezLomitka(process.env.NEXT_PUBLIC_BASE_URL),
    /* Odkud čte data. Tohle je ta proměnná, kvůli které 6. 11. spadl celý web. */
    backend: bezLomitka(
      process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
    ),
    /* Přijme obchod klepnutí na obnovu katalogu? */
    revalidace: Boolean(process.env.REVALIDATE_SECRET),
  })
}
