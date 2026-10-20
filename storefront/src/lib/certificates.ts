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

export const hasGlazeCertificates = (): boolean => GLAZE_CERTIFICATES.length > 0
