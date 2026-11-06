import type { MedusaContainer } from "@medusajs/framework/types"

import { getMerchantSettings } from "./merchant-settings"

/**
 * Nabízí obchod kurzy? Jedno místo pro obě poloviny vypínače.
 *
 * Stránka `/kurzy` se podle `courses_enabled` překreslí na kontaktní tlačítko
 * (přes `/store/shop-status`), ale to samo nestačí: odkaz na rezervaci si
 * někdo mohl uložit nebo ho má ve starém e-mailu, a bez kontroly na serveru
 * by se kurz dal objednat i po vypnutí. Rezervace i žádost o místo se proto
 * ptají tady.
 *
 * Selhané čtení nastavení kurzy **nevypíná**. Zavřít zájemci rezervaci kvůli
 * chybě na pozadí je horší než pustit ji ve chvíli, kdy byly zrovna vypnuté.
 */
export const areCoursesEnabled = async (
  scope: MedusaContainer
): Promise<boolean> => {
  const settings = await getMerchantSettings(scope).catch(() => null)
  return settings?.courses_enabled !== false
}

/** Co se při vypnutých kurzech řekne zájemci — tytéž věty jako na stránce. */
export const COURSES_DISABLED_MESSAGE =
  "Kurzy teď nevypisujeme. Napište nám prosím přes kontaktní formulář a ozveme se, jakmile budou nové termíny."
