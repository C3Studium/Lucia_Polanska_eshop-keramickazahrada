import "server-only"

import { fact, type LegalFacts } from "@lib/legal/facts"

import { getLegalFacts } from "./legal-facts"

export type MerchantIdentity = {
  name: string
  address: string
  registrationNumber: string
  email: string
  phone: string
  /** Dial-safe form for `tel:` — the display form carries spaces. */
  phoneDial: string
  website: string
  /*
   * Bez čísla účtu, IBAN a SWIFT (dřív `bankAccount`/`iban`/`swift`). Nic na
   * webu je nečetlo, a přitom se s celým objektem serializovaly do RSC dat
   * každé stránky (patička a kontakt ho dostávají jako prop) — i s napevno
   * zapsaným účtem jako výchozí hodnotou, ač který účet platí, je otevřená
   * otázka (OPEN_QUESTIONS #1). Číslo účtu pro texty je právní údaj
   * `bank.account` (administrace obchodu), až ho Lucie potvrdí.
   */
}

/**
 * Identita prodávající ze zadaných právních údajů — čistá funkce.
 *
 * Údaje se vyplňují v administraci obchodu („Právní údaje") a čtou je i
 * obchodní podmínky, pokladna a e-maily, takže patička a kontakt říkají
 * totéž co doklady. Proměnné prostředí (`SIDLO_ADRESA`, `IDENTIFIKACNI_CISLO`)
 * zůstávají jen jako záloha pro údaj, který v administraci někdo vymazal,
 * a pevné hodnoty za nimi proto, aby blok nikdy nebyl prázdný.
 */
export const merchantIdentityFrom = (facts: LegalFacts): MerchantIdentity => {
  const phone = fact("seller.phone", facts) ?? "+420 775 211 578"
  return {
    name: fact("seller.name", facts) ?? "Lucie Polanská",
    address: fact("seller.address", facts) ?? (process.env.SIDLO_ADRESA || "Putim 229, 397 01 Písek"),
    registrationNumber:
      fact("seller.ico", facts) ?? (process.env.IDENTIFIKACNI_CISLO || "03441482"),
    email: fact("seller.email", facts) ?? "info@keramickazahrada.cz",
    phone,
    phoneDial: phone.replace(/[^\d+]/g, ""),
    website: process.env.INTERNETOVA_ADRESA || "www.keramickazahrada.cz",
  }
}

/**
 * The seller's legal identity, as it must appear to a Czech customer before they buy.
 *
 * Z právních údajů obchodu (`getLegalFacts()` — administrace, cache 60 s,
 * záloha z kódu). Server-only: read this in a layout or page and pass the
 * result down.
 */
export const getMerchantIdentity = async (): Promise<MerchantIdentity> =>
  merchantIdentityFrom(await getLegalFacts())
