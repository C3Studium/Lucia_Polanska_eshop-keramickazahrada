import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ACTIVITY_LOG_MODULE } from "../../../../modules/activity-log"
import type ActivityLogModuleService from "../../../../modules/activity-log/service"
import { soucty, type ZaznamProvozu } from "../../../../lib/provozni-hlidka/denik"
import { spustKontroly } from "../../../../lib/provozni-hlidka"
import { DRUH_FRONTY } from "../../../../lib/provozni-hlidka/fronta"

/**
 * Provozní deník pro stránku Přehled → Provoz (3. 11. 2026).
 *
 * Odpovídá na tři otázky, které se jinak dají zjistit jen z denního e-mailu:
 * co se za zvolené okno stalo (součty po druzích), co selhalo (s důvodem)
 * a jak jsou na tom teď kontroly.
 *
 * Kontroly se spouštějí jen na vyžádání (`kontroly=1`). Některé sahají na
 * web a do skladu, takže by při každém otevření stránky dělaly práci, o
 * kterou si nikdo neřekl.
 */

const cele = (hodnota: unknown, vychozi: number): number => {
  const cislo = Number(hodnota)
  return Number.isFinite(cislo) && cislo >= 0 ? Math.floor(cislo) : vychozi
}

const HODINA = 60 * 60 * 1000

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve(
    ACTIVITY_LOG_MODULE
  ) as ActivityLogModuleService

  /* Okno v hodinách — výchozí den, strop týden (nad tím to přestává být
     přehled a začíná to být export). */
  const hodin = Math.min(cele(req.query.hodin, 24), 24 * 7)
  const limit = Math.min(cele(req.query.limit, 100), 500)
  const jenChyby = req.query.stav === "chyba"

  const od = new Date(Date.now() - hodin * HODINA)

  /* Účetnictví fronty vývojářských e-mailů není provozní záznam; výslovná
     volba druhu níž ho ale zpřístupní. Viz `DRUH_FRONTY`. */
  const filtry: Record<string, unknown> = {
    created_at: { $gte: od },
    kind: { $ne: DRUH_FRONTY },
  }
  if (jenChyby) filtry.status = "chyba"
  if (typeof req.query.druh === "string" && req.query.druh) {
    filtry.kind = req.query.druh
  }

  const [zaznamy, celkem] = await service.listAndCountActivityEvents(
    filtry as never,
    { take: limit, order: { created_at: "DESC" } }
  )

  /* Součty se počítají nad celým oknem, ne nad stránkou — jinak by
     „14 plateb" znamenalo jen „14 plateb na první stránce". */
  const proSoucty = (await service.listActivityEvents(
    { created_at: { $gte: od }, kind: { $ne: DRUH_FRONTY } } as never,
    { take: 5000, order: { created_at: "DESC" } }
  )) as unknown as ZaznamProvozu[]

  const kontroly =
    req.query.kontroly === "1" ? await spustKontroly(req.scope) : null

  res.json({
    od: od.toISOString(),
    hodin,
    celkem,
    soucty: soucty(proSoucty),
    zaznamy,
    ...(kontroly ? { kontroly } : {}),
  })
}
