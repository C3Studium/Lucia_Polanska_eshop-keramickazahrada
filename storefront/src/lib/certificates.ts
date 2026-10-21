/**
 * Protokoly o zdravotní nezávadnosti glazur (LEGAL_AUDIT.md § 0b, N1).
 *
 * Keramika, u které tvrdíme „zdravotně nezávadné glazury“ nebo ji nabízíme
 * na jídlo a pití, podléhá nařízení (ES) č. 1935/2004 a vyhlášce č. 38/2001 Sb.
 * (limity uvolňování olova a kadmia). Tvrzení smí v popisu stát jen u glazury,
 * ke které je tady protokol. Stránka `/certifikaty` je vypisuje; FAQ a popisy
 * produktů na ni odkazují.
 *
 * Soubory jdou do R2 (`legal/certifikaty/<rok>-<glazura>.pdf`, veřejné URL
 * `https://img.matejforejt.com/...`) stejně jako právní PDF. Nový protokol =
 * nový záznam tady + nahrání souboru; bez protokolu glazuru NEPŘIDÁVAT.
 *
 * Zatím prázdné: protokoly má Lucie u sebe (zpráva pro Lucii, otázka
 * „certifikáty“). Dokud nejsou nahrané, stránka říká, že se seznam doplňuje,
 * a skript `backend/src/scripts/food-claims.ts` umí tvrzení z popisů
 * odstranit / vrátit.
 */

export type GlazeCertificate = {
  /** Název glazury tak, jak ho používá Lucie v popisech („transparentní lesklá“). */
  glaze: string
  /** Kdo zkoušel (laboratoř) — z protokolu. */
  laboratory: string
  /** Datum protokolu (ISO `YYYY-MM-DD`). */
  issuedAt: string
  /** Číslo protokolu, je-li na něm. */
  number?: string
  /** Veřejná URL PDF (https). */
  url: string
  /** Co protokol pokrývá (např. „olovo a kadmium, 4% kyselina octová, 24 h“). */
  scope?: string
}

export const GLAZE_CERTIFICATES: readonly GlazeCertificate[] = []

/**
 * Prohlášení o shodě k elektru, které obchod prodává (LEGAL_AUDIT § 0b, N3):
 * bezdrátový zvonek BZ8-113 (Elektrobock CZ s.r.o., RED 2014/53/EU, RoHS).
 * Zvonkové keramické tlačítko samo elektronika není — má jen spínací kontakt
 * (48 V DC, 2 A, IP44) a prohlášení nepotřebuje.
 */
export type ConformityDeclaration = {
  /** Výrobek tak, jak se jmenuje v obchodě. */
  product: string
  /** Odkaz na produkt (cesta bez země). */
  productPath: string
  /** Výrobce / dovozce z prohlášení. */
  manufacturer: string
  /** Předpisy, se kterými je výrobek ve shodě. */
  scope: string
  /** Datum vystavení (ISO). */
  issuedAt: string
  /** Veřejná URL PDF (https) — doplní se po nahrání do R2. */
  url: string | null
}

export const CONFORMITY_DECLARATIONS: readonly ConformityDeclaration[] = [
  {
    product: "Bezdrátový zvonek BZ8-113",
    productPath: "/products/bezdratovy-zvonek-bz8-113",
    manufacturer: "ELEKTROBOCK CZ s.r.o., Blanenská 1763, 664 34 Kuřim",
    scope: "směrnice 2014/53/EU (RED), NV č. 426/2016 Sb.; 2011/65/EU (RoHS), NV č. 481/2012 Sb.; 433,92 MHz, < 10 mW",
    issuedAt: "2017-06-13",
    url: null,
  },
]

export const hasGlazeCertificates = (): boolean => GLAZE_CERTIFICATES.length > 0
