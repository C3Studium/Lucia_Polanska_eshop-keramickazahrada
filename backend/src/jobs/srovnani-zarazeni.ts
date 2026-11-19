import type { MedusaContainer } from "@medusajs/framework/types"
import { srovnejZarazeni } from "../lib/zarazeni-hlidka"
import { sUlohou } from "../lib/provozni-hlidka/uloha"

/**
 * Každou hodinu bezpečné opravy zařazení (lib/zarazeni-hlidka): vazby na
 * smazané kategorie pryč, publikovanému výrobku bez kanálu kanál obchodu.
 * Co musí rozhodnout člověk, hlásí kontrola „Zařazení výrobků" v hlídce.
 */
async function srovnaniZarazeni(container: MedusaContainer) {
  await srovnejZarazeni(container)
}

/* Běh i pád úlohy jde do provozního deníku; pád navíc do souhrnu chyb (e-mail nejvýš po 4 h). */
export default sUlohou("srovnani-zarazeni", srovnaniZarazeni)

export const config = {
  name: "srovnani-zarazeni",
  schedule: "50 * * * *",
}
