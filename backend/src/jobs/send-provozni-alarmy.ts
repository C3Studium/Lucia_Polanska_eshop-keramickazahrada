import type { MedusaContainer } from "@medusajs/framework/types"
import { posliSouhrnChyb } from "../lib/provozni-hlidka/souhrn-chyb"
import { sUlohou } from "../lib/provozni-hlidka/uloha"

/**
 * Souhrn chyb pro vývojáře — každé 4 hodiny (4. 11. 2026).
 *
 * Matěj: místo e-mailu ke každé chybě jeden e-mail za 4 hodiny se vším, co
 * se za tu dobu pokazilo (3. 11. jich odešlo 42 a vyčerpaly denní limit
 * Resendu). Když se nic nepokazilo, nepřijde nic.
 *
 * Slot ve 20:00 UTC tu chybí schválně: tehdy jde večerní provozní souhrn
 * (`send-provozni-souhrn`), který frontu vezme s sebou — jinak by přišly dva
 * e-maily ve stejnou minutu.
 */
async function sendProvozniAlarmy(container: MedusaContainer) {
  await posliSouhrnChyb(container)
}

/* Běh i pád úlohy jde do provozního deníku; pád navíc do souhrnu chyb (e-mail nejvýš po 4 h). */
export default sUlohou("send-provozni-alarmy", sendProvozniAlarmy)

export const config = {
  name: "send-provozni-alarmy",
  /* UTC: 1, 5, 9, 13, 17 v Praze v zimě (v létě o hodinu později); 21:00
     pokrývá večerní provozní souhrn. */
  schedule: "0 0,4,8,12,16 * * *",
}
