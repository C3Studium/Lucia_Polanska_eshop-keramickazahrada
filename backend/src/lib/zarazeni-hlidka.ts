import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Hlídka zařazení výrobků (19. 11. 2026, Matěj: „ať se to nestane, když se
 * udělá nějaká nová změna").
 *
 * Audit téhož dne našel, že obchod ukazuje přesně to, co databáze — rozdíl
 * „zaškrtnuté v adminu, v obchodě není" dělaly skryté výrobky — a jednu
 * skutečnou chybu: vazby výrobků na SMAZANÉ kategorie (Medusa kategorii jen
 * označí smazanou, vazby nechá). Tohle drží stav čistý dál:
 *
 * - `srovnejZarazeni` opraví, co jde opravit bez rozhodování: smaže vazby
 *   na smazané kategorie a publikovanému výrobku bez prodejního kanálu
 *   doplní výchozí kanál obchodu (jinak ho obchod nevidí). Volá ho
 *   subscriber na smazání kategorie a hodinová úloha `srovnani-zarazeni`.
 * - `najdiChybyZarazeni` (kontrola provozní hlídky „Zařazení výrobků")
 *   hlásí, co musí rozhodnout člověk: publikovaný výrobek, který není
 *   v žádné kolekci ani kategorii, je v kategorii bez kolekce (v menu ho
 *   nikdo nenajde), ve vypnuté kategorii, nebo má smazanou hlavní kolekci.
 *
 * Skryté výrobky se nekontrolují — skrýt výrobek je rozhodnutí majitelky.
 */

export type ZarazeniVstup = {
  vyrobky: Array<{
    id: string
    title: string
    status: string
    collection_id: string | null
    category_ids: string[]
    sales_channel_ids: string[]
  }>
  kategorie: Array<{
    id: string
    name: string
    is_active: boolean
    is_internal: boolean
    collection_id: string | null
  }>
  kolekce: string[]
  vazbyNaSmazane: number
}

export const najdiChybyZarazeni = (vstup: ZarazeniVstup): string[] => {
  const kategorie = new Map(vstup.kategorie.map((k) => [k.id, k]))
  const kolekce = new Set(vstup.kolekce)
  const chyby: string[] = []

  for (const v of vstup.vyrobky) {
    if (v.status !== "published") continue
    const jeho = v.category_ids.map((id) => kategorie.get(id)).filter(Boolean) as ZarazeniVstup["kategorie"]
    if (!v.sales_channel_ids.length) {
      chyby.push(`${v.title} · publikovaný bez prodejního kanálu — obchod ho nevidí`)
    }
    if (!v.collection_id && !jeho.some((k) => k.collection_id)) {
      chyby.push(`${v.title} · publikovaný, ale v žádné kolekci — v nabídce obchodu není`)
    }
    if (v.collection_id && !kolekce.has(v.collection_id)) {
      chyby.push(`${v.title} · hlavní kolekce je smazaná`)
    }
    for (const k of jeho) {
      if (!k.collection_id) {
        chyby.push(`${v.title} · kategorie „${k.name}" nepatří žádné kolekci — v menu obchodu není`)
      }
      if (!k.is_active || k.is_internal) {
        chyby.push(`${v.title} · kategorie „${k.name}" je vypnutá — obchod v ní výrobek neukáže`)
      }
    }
  }
  if (vstup.vazbyNaSmazane > 0) {
    chyby.push(`vazby na smazané kategorie · ${vstup.vazbyNaSmazane} (uklidí je hodinová úloha)`)
  }
  return chyby
}

const knexOf = (container: MedusaContainer) =>
  container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

export const nactiZarazeni = async (container: MedusaContainer): Promise<ZarazeniVstup> => {
  const knex = knexOf(container)
  const [vyrobky, vazby, kategorie, kolekce, kanaly, smazane] = await Promise.all([
    knex("product").whereNull("deleted_at").select("id", "title", "status", "collection_id"),
    knex("product_category_product as x")
      .join("product_category as c", "c.id", "x.product_category_id")
      .whereNull("c.deleted_at")
      .select("x.product_id", "x.product_category_id"),
    knex("product_category").whereNull("deleted_at").select("id", "name", "is_active", "is_internal", "metadata"),
    knex("product_collection").whereNull("deleted_at").select("id"),
    knex("product_sales_channel").whereNull("deleted_at").select("product_id", "sales_channel_id"),
    knex("product_category_product as x")
      .join("product_category as c", "c.id", "x.product_category_id")
      .whereNotNull("c.deleted_at")
      .count({ n: "*" }),
  ])
  const katVyrobku = new Map<string, string[]>()
  for (const r of vazby) (katVyrobku.get(r.product_id) ?? katVyrobku.set(r.product_id, []).get(r.product_id)!).push(r.product_category_id)
  const kanalVyrobku = new Map<string, string[]>()
  for (const r of kanaly) (kanalVyrobku.get(r.product_id) ?? kanalVyrobku.set(r.product_id, []).get(r.product_id)!).push(r.sales_channel_id)
  return {
    vyrobky: vyrobky.map((v: any) => ({
      id: v.id,
      title: v.title,
      status: v.status,
      collection_id: v.collection_id ?? null,
      category_ids: katVyrobku.get(v.id) ?? [],
      sales_channel_ids: kanalVyrobku.get(v.id) ?? [],
    })),
    kategorie: kategorie.map((k: any) => {
      const meta = typeof k.metadata === "string" ? JSON.parse(k.metadata) : k.metadata
      return {
        id: k.id,
        name: k.name,
        is_active: Boolean(k.is_active),
        is_internal: Boolean(k.is_internal),
        collection_id: (meta?.collection_id as string) || null,
      }
    }),
    kolekce: kolekce.map((k: any) => k.id),
    vazbyNaSmazane: Number(smazane[0]?.n ?? 0),
  }
}

/** Bezpečné opravy bez rozhodování. Vrací, co udělalo. */
export const srovnejZarazeni = async (container: MedusaContainer) => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = knexOf(container)

  const smazano: number = await knex("product_category_product")
    .whereIn(
      "product_category_id",
      knex("product_category").whereNotNull("deleted_at").select("id")
    )
    .del()

  let doplnenKanal = 0
  const data = await nactiZarazeni(container)
  const bezKanalu = data.vyrobky.filter((v) => v.status === "published" && !v.sales_channel_ids.length)
  if (bezKanalu.length) {
    const storeModule = container.resolve(Modules.STORE) as any
    const [store] = (await storeModule.listStores({}, { select: ["id", "default_sales_channel_id"] })) as any[]
    const kanal = store?.default_sales_channel_id as string | undefined
    if (kanal) {
      const link = container.resolve(ContainerRegistrationKeys.LINK) as any
      await link.create(
        bezKanalu.map((v) => ({
          [Modules.PRODUCT]: { product_id: v.id },
          [Modules.SALES_CHANNEL]: { sales_channel_id: kanal },
        }))
      )
      doplnenKanal = bezKanalu.length
    }
  }

  if (smazano || doplnenKanal) {
    logger.info(
      `[zařazení] Srovnáno: ${smazano} vazeb na smazané kategorie pryč, ${doplnenKanal} výrobkům doplněn kanál obchodu.`
    )
  }
  return { smazano, doplnenKanal }
}
