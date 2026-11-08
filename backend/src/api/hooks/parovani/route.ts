import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * „Na jaké adresy se díváš?" — vzájemné ohlášení backendu a obchodu.
 *
 * ## Proč to existuje
 *
 * Backend a obchod se na sebe odkazují proměnnými: backend zná adresu obchodu
 * (`STOREFRONT_PUBLIC_URL`, klepe na ni při změně katalogu), obchod zná adresu
 * backendu (`MEDUSA_BACKEND_URL`, čte z ní data). Dokud obě sedí, nikdo o nich
 * neví. Jakmile se jedna rozejde, přestane fungovat něco, co nikomu nehlásí
 * chybu — jen se to tiše chová jinak.
 *
 * Změřeno 8. 11. 2026 po přesunu na keramickazahrada.cz: backend klepal na
 * adresu, kde stojí starý WordPress, obchod neměl `REVALIDATE_SECRET`, a
 * majitelka den upravovala ceny, názvy a fotky, aniž by se v obchodě cokoli
 * změnilo. Obě strany přitom běžely a tvářily se zdravě.
 *
 * Tahle routa jen ŘEKNE, co si ta která služba myslí. Porovnání dělá provozní
 * hlídka (`lib/provozni-hlidka/kontroly.ts`, kontrola „Spárování služeb"),
 * takže nesoulad vyplave sám a s konkrétními hodnotami — ne až tím, že si
 * někdo všimne, že se web neobnovuje.
 *
 * ## Bezpečnost
 *
 * `/hooks/*` je bez přihlášení, takže si routa žádá sdílené tajemství sama.
 * Bez něj by to byl veřejný výpis konfigurace.
 */

/** Sdílené tajemství. Vlastní, nebo to od revalidace — ať se nemusí hlídat dvě. */
export const parovaciTajemstvi = (): string =>
  process.env.SERVICE_PAIR_SECRET || process.env.REVALIDATE_SECRET || ""

const bezLomitka = (hodnota: string | undefined | null): string | null =>
  hodnota ? hodnota.replace(/\/+$/, "") : null

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const tajemstvi = parovaciTajemstvi()

  if (!tajemstvi) {
    res.status(503).json({
      ok: false,
      zprava:
        "Není nastavené SERVICE_PAIR_SECRET ani REVALIDATE_SECRET — spárování nejde ověřit.",
    })
    return
  }

  if (req.headers["x-pair-secret"] !== tajemstvi) {
    res.status(401).json({ ok: false, zprava: "Neplatné tajemství." })
    return
  }

  res.json({
    ok: true,
    sluzba: "backend",
    /* Za koho se backend sám vydává — tohle jméno se peče i do administrace. */
    ja: bezLomitka(process.env.BACKEND_PUBLIC_URL),
    /* Kam klepe při změně katalogu. */
    storefront: bezLomitka(
      process.env.STOREFRONT_PUBLIC_URL || process.env.MEDUSA_STOREFRONT_URL
    ),
    /* Odkud se servírují fotky výrobků. */
    obrazky: bezLomitka(process.env.R2_PUBLIC_URL),
    /* Má čím klepnout? Samotná adresa nestačí. */
    revalidace: Boolean(process.env.REVALIDATE_SECRET),
  })
}
