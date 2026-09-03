import "server-only"

import { getShopStatus } from "@lib/data/shop-status"
import type { Notice } from "@lib/util/notices"

export type { Notice, NoticeKind } from "@lib/util/notices"

/**
 * Oznámení pro pás v heru: dovolená a novinka z administrace.
 *
 * Obojí drží backend v nastavení obchodu a vydává je na `/store/shop-status`
 * (`vacation` a `announcement`). Sem se to jen přetvaruje do seznamu, protože
 * pás nezajímá, odkud věta přišla — zajímá ho, kolik jich je a v jakém pořadí
 * mají jet.
 *
 * Pořadí je záměr: dovolená první. Když je dílna zavřená, je to ta zpráva,
 * kvůli které návštěvník možná nedokončí objednávku, a novinka o novém kusu je
 * proti tomu vedlejší.
 *
 * Prázdný seznam je normální stav, ne chyba — většinu roku není co hlásit.
 * Komponenta na něj reaguje tím, že pás vůbec nevykreslí; viz IntroHero.
 */

/**
 * `revalidate: 60` si nese `getShopStatus`, takže pás může být minutu pozadu
 * za administrací — nikdy ne den. Výpadek backendu vrací prázdný seznam a
 * stránka se vykreslí bez pásu; oznámení není nic, kvůli čemu má padat hero.
 */
/**
 * Datum návratu, česky a bez času („16. 8. 2026").
 *
 * Formátuje se TADY, na serveru, a do komponenty jde hotový řetězec — viz
 * `Notice.date`. Locale je natvrdo `cs-CZ`, ne prostředí: web je český a
 * server, který běží s jiným nastavením, by jinak psal datum po americku.
 *
 * Nečitelná hodnota vrací `null`, ne „Invalid Date". Pole je v administraci
 * nepovinné a datum, kterému nikdo nerozumí, je horší než žádné.
 */
const czechDate = (value: string | null | undefined): string | null => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(parsed)
}

export async function getHeroNotices(): Promise<Notice[]> {
  const status = await getShopStatus()
  if (!status) return []

  const out: Notice[] = []

  if (status.vacation?.message) {
    /*
     * Datum jde vedle vzkazu, ne do něj. Majitelka píše do administrace jen
     * větu („Testovací dovolená…") a den návratu vyplňuje zvlášť — spojit obojí
     * do jednoho řetězce by znamenalo, že pás nemůže datum odlišit sazbou a že
     * vzkaz bez data a s datem vypadají jako dva různé texty.
     */
    out.push({
      kind: "vacation",
      message: status.vacation.message.trim(),
      date: czechDate(status.vacation.until),
    })
  }

  if (status.announcement?.message) {
    out.push({
      kind: "announcement",
      message: status.announcement.message.trim(),
      href: status.announcement.link || null,
    })
  }

  return out
}
