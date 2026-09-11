/**
 * Zkušební režim — obchod běží nanečisto.
 *
 * ## K čemu to je
 *
 * Vyzkoušet celou cestu objednávky (zaplacení, e-maily, osobní odběr) na živém
 * obchodě znamená vyrobit objednávky, které nejsou skutečné. Pro e-maily to
 * nevadí — pošlou se na testovací adresu a je po nich. Pro **účetnictví** to
 * vadí hodně: iDoklad vystaví fakturu, vytrhne číslo z číselné řady, a to
 * číslo se nevrací. Deset zkušebních objednávek udělá deset děr v číslování,
 * které pak musí někdo vysvětlovat.
 *
 * ## Co přepínač opravdu dělá
 *
 * **iDoklad se vypne.** To je jediná polovina, kterou umí ovládat za běhu —
 * faktura vzniká v procesu, který má k nastavení obchodu přístup.
 *
 * **ComGate zůstává na proměnné.** Platební poskytovatel dostává `test`
 * z konfigurace při startu a žije ve vlastním kontejneru modulu, kde modul
 * obchodu není — nastavení obchodu si tedy za běhu přečíst nemůže. Ostrý
 * provoz se přepíná `COMGATE_TEST` a restartem. Přepínač v administraci to
 * proto o ComGate jen **říká**; skutečný stav ukazuje `comgateJeZkusebni()`,
 * čtený z prostředí, takže stránka nikdy netvrdí něco jiného, než co platí.
 *
 * Rozdělit to takhle je poctivější než tvářit se, že přepínač ovládá obojí:
 * tichý nesoulad mezi tím, co je zaškrtnuté, a tím, kam jdou peníze, je přesně
 * ten druh chyby, kterou nikdo nenajde včas.
 */

import type { MedusaContainer } from "@medusajs/framework/types"
import { getMerchantSettings } from "./merchant-settings"

/**
 * Je zapnutý zkušební režim?
 *
 * Chyba se snáší jako „ne": kdyby se nastavení nepodařilo přečíst, obchod má
 * fakturovat. Neposlaná faktura je horší než faktura navíc.
 */
export const jeZkusebniRezim = async (
  container: MedusaContainer
): Promise<boolean> => {
  try {
    const settings = await getMerchantSettings(container)
    return settings.test_mode_enabled === true
  } catch {
    return false
  }
}

/**
 * Běží ComGate nanečisto?
 *
 * Čte se z prostředí, protože právě odtud to poskytovatel bere. Tohle je
 * hlášení o skutečnosti, ne přání.
 */
export const comgateJeZkusebni = (): boolean =>
  ["1", "true", "yes", "on"].includes(
    String(process.env.COMGATE_TEST ?? "")
      .trim()
      .toLowerCase()
  )
