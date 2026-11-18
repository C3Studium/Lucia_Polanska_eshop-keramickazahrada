import type { MedusaContainer } from "@medusajs/framework/types"
import { syncVyprodeje } from "../lib/vyprodej"
import { sUlohou } from "../lib/provozni-hlidka/uloha"

/**
 * Pojistka k `vyprodej-sync`: sklad změněný ručně (Sklad, naskladnění) událost
 * výrobku nevydá — „do vyprodání zásob" by o vyprodaném kusu jinak nevěděl.
 */
async function syncVyprodejeJob(container: MedusaContainer) {
  await syncVyprodeje(container)
}

/* Běh i pád úlohy jde do provozního deníku; pád navíc do souhrnu chyb (e-mail nejvýš po 4 h). */
export default sUlohou("sync-vyprodeje", syncVyprodejeJob)

export const config = {
  name: "sync-vyprodeje",
  schedule: "*/15 * * * *",
}
