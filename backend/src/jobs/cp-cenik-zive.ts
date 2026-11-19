import type { MedusaContainer } from "@medusajs/framework/types"
import { obnovCenikCp } from "../lib/international-shipping"
import { sUlohou } from "../lib/provozni-hlidka/uloha"

/**
 * Ceník České pošty do zahraničí — každou noc v 1:00 pražského času
 * (19. 11. 2026, Matěj). Stáhne ceny z kalkulačky postaonline.cz, uloží je
 * k volbě dopravy; při chybě pošle vývojáři e-mail a pokladna jede dál
 * z posledních stažených dat (lib/international-shipping → obnovCenikCp).
 *
 * Plánovač na Railway běží v UTC a 1:00 v Praze je podle letního času 0:00
 * nebo 23:00 UTC — úloha se proto spouští každou celou hodinu a pracuje jen
 * tehdy, když je v Praze právě 1 hodina.
 */
const hodinaVPraze = (now = new Date()): number =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", hour: "2-digit", hourCycle: "h23" }).format(now))

/* Do provozního deníku jde jen skutečný běh v 1:00, ne 23 prázdných hodin. */
const stazeni = sUlohou("cp-cenik-zive", (container: MedusaContainer) => obnovCenikCp(container))

export default async function cpCenikZive(container: MedusaContainer) {
  if (hodinaVPraze() !== 1) return
  await stazeni(container)
}

export const config = {
  name: "cp-cenik-zive",
  schedule: "0 * * * *",
}
