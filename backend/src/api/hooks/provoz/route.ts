import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { ohlasHned } from "../../../lib/provozni-hlidka"
import { zapisProvoz } from "../../../lib/provozni-hlidka/zapis"

/**
 * Chyby z obchodu do provozního deníku (3. 11. 2026).
 *
 * ## Proč to vede přes backend
 *
 * Obchod je druhá služba a vlastní plánovač ani e-maily nemá. Když na webu
 * spadne stránka, dozví se to log na Railway a nikdo jiný. Next ale umí
 * ohlásit každou chybu požadavku (`instrumentation.ts`), takže ji stačí
 * poslat sem — a tím se chyby webu dostanou do stejného deníku a stejného
 * denního souhrnu jako všechno ostatní.
 *
 * ## Ověření
 *
 * Sdíleným tajemstvím `ADMIN_BRIDGE_SECRET`, které obě služby už mají.
 * Porovnává se v konstantním čase; bez nastaveného tajemství se nepřijímá
 * nic (jinak by šlo z internetu plnit deník a vyčerpat denní limit e-mailů).
 *
 * Odpověď je vždy rychlá a nikdy neopakuje, co přišlo — ohlašovatel chyb
 * nesmí být cesta, jak si nechat něco vrátit zpět.
 */

const TeloSchema = z.object({
  /** `page`, `api`, `render`, `client` — odkud to přišlo. */
  kde: z.string().max(40).default("web"),
  /** Cesta, na které to spadlo. */
  cesta: z.string().max(500).default(""),
  zprava: z.string().max(2000),
  stopa: z.string().max(4000).optional(),
  /** `error` nebo `warning`; varování se zapíše, ale nebudí. */
  uroven: z.enum(["error", "warning"]).default("error"),
})

const tajemstviSedi = (hlavicka: unknown): boolean => {
  const tajemstvi = (process.env.ADMIN_BRIDGE_SECRET ?? "").trim()
  if (!tajemstvi) return false

  const poslane = String(hlavicka ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim()
  if (!poslane) return false

  const a = Buffer.from(poslane)
  const b = Buffer.from(tajemstvi)
  /* `timingSafeEqual` vyhodí na různých délkách — délka sama o sobě
     tajemstvím není, takže se porovná až po kontrole. */
  return a.length === b.length && timingSafeEqual(a, b)
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!tajemstviSedi(req.headers.authorization)) {
    res.status(401).json({ prijato: false })
    return
  }

  const telo = TeloSchema.safeParse(req.body)
  if (!telo.success) {
    res.status(400).json({ prijato: false })
    return
  }

  const { kde, cesta, zprava, stopa, uroven } = telo.data

  await zapisProvoz(req.scope, {
    druh: "web",
    akce: `web:${kde}`,
    stav: uroven === "error" ? "chyba" : "ok",
    kdo: "obchod",
    popis: zprava.slice(0, 300),
    detail: { cesta, chyba: zprava, ...(stopa ? { stopa } : {}) },
  })

  if (uroven === "error") {
    await ohlasHned(req.scope, {
      klic: `web-${kde}`,
      nazev: "Chyba na webu",
      zprava: `${cesta || "neznámá stránka"}: ${zprava}`,
      detail: [
        `Kde: ${kde}`,
        `Cesta: ${cesta || "neuvedena"}`,
        `Chyba: ${zprava}`,
        ...(stopa ? [stopa] : []),
      ],
    })
  }

  res.json({ prijato: true })
}
