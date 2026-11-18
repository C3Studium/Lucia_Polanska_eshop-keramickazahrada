import type { MedusaContainer } from "@medusajs/framework/types"
import { settleSoldClearance } from "../lib/clearance-lifecycle"
import { sUlohou } from "../lib/provozni-hlidka/uloha"

/**
 * Pojistka k `clearance-settle`: prodané poškozené kusy, jejichž objednávka
 * se mezitím odeslala (smazat) nebo zrušila (vrátit do obchodu).
 */
async function settleSoldClearanceJob(container: MedusaContainer) {
  await settleSoldClearance(container)
}

/* Běh i pád úlohy jde do provozního deníku; pád navíc do souhrnu chyb (e-mail nejvýš po 4 h). */
export default sUlohou("settle-sold-clearance", settleSoldClearanceJob)

export const config = {
  name: "settle-sold-clearance",
  schedule: "25 * * * *",
}
