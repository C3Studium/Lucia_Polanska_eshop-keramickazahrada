import "server-only"

import { draftMode } from "next/headers"
import {
  documentId,
  getSiteCopy,
  readEditable,
  readerFor,
  stringValue,
} from "@c3studium/valecms/server/site"
import { BUTTON_PREFIX } from "@lib/util/site-copy"
import type { CopyBlocks, CopyButton, CopyFile, CopyPage, FaqCategory, FaqQuestion } from "@lib/util/site-copy"

/**
 * Redakční texty a fotky webu — z ValeCMS, ne ze Sanity.
 *
 * Jediné místo, kudy se do stránek dostane obsah, který nespravuje Medusa.
 * Produkty, ceny, sklad, objednávky, kurzy a rezervace jsou Medusa a berou se
 * dál přes ostatní moduly v `@lib/data`; tohle je hero, uvítací texty, kontakt
 * a mapa.
 *
 * ## Proč přes vlastní modul, a ne `getSiteCopy` přímo ve stránce
 *
 * Kvůli dvěma věcem, které by se jinak opisovaly do každé stránky:
 *
 * - **Výpadek CMS nesmí shodit web.** Když je databáze nedostupná, vrátí se
 *   prázdno a komponenty se vykreslí se svými zabudovanými zálohami. Stejné
 *   rozhodnutí, jaké dělá middleware u regionů — degradovat, ne spadnout.
 * - **Klíče bloků na jednom místě.** `index.hero` je smlouva mezi migrací
 *   (`scripts/migrate-sanity-to-cms.mjs`), konfigurací webu
 *   (`src/lib/valecms.config.ts`) a komponentou. Rozházené po stránkách by
 *   se ta trojice rozešla při prvním přejmenování.
 *
 * Tvar bloku a čtečky nad ním bydlí v `@lib/util/site-copy`, protože je
 * potřebují i klientské komponenty — tenhle modul je serverový.
 */

export type { CopyBlock, CopyBlocks, CopyImage, CopyPage } from "@lib/util/site-copy"

const EMPTY: CopyBlocks = {}

/**
 * Bloky jedné stránky, klíčované podle `key` (`index.hero`, `global.mapa`…).
 *
 * Nikdy nevyhodí. Stránka, která se nedá načíst, je pořád stránka — jen s tím,
 * co mají komponenty napevno.
 */
/**
 * Jsme uvnitř náhledu Studia?
 *
 * Náhled zapíná draft cookie (`/api/studio/preview`), a jen tehdy se čtou
 * koncepty. Má to jeden důsledek, na kterém stojí vizuální editace: čtečka
 * konceptů připojí ke každému bloku `id` dokumentu, ze kterého přišel, a bez
 * toho `id` nemá `editable()` co napsat na element — překryv by pak neměl co
 * chytit pod kurzorem.
 *
 * Mimo náhled tedy čteme publikované a `id` je null. To není nedostatek, ale
 * záměr: veřejné HTML nemá nést nic o editaci.
 */
export const getPageCopy = async (page: CopyPage): Promise<CopyBlocks> => {
  /*
   * `draftMode()` schválně MIMO try/catch.
   *
   * Je to dynamické API: jeho zavolání má stránku přepnout na vykreslení za
   * běhu, a Next to dělá vyhozením vlastní výjimky, kterou sám o patro výš
   * chytá. Obalit ho `try/catch` znamená tu výjimku spolknout — stránka
   * zůstane předgenerovaná, `isEnabled` je navždy false, čte se publikovaná
   * verze bez `id` dokumentů, a `editable()` v komponentách proto nemá co
   * napsat. Ve Studiu se to projeví jako „0 upravitelných prvků" na stránce,
   * která se jinak vykresluje správně — a hledá se to úplně jinde.
   *
   * Guard níž je jen kolem čtení z databáze, kam patří.
   */
  const preview = (await draftMode()).isEnabled

  try {
    const blocks = await getSiteCopy(
      preview ? { page, read: readEditable } : { page }
    )
    return (blocks ?? EMPTY) as CopyBlocks
  } catch (error) {
    console.error(`[cms] Obsah stránky "${page}" se nepodařilo načíst.`, error)
    return EMPTY
  }
}

/**
 * Bloky stránky i globální dohromady.
 *
 * Patička a kontakt visí pod každou routou, takže je stránka potřebuje spolu
 * se svými — a dva `await` v každé komponentě je přesně to opakování, kterému
 * se tenhle modul vyhýbá. Vlastní bloky stránky mají přednost, kdyby se klíč
 * někdy potkal.
 */
export const getPageCopyWithGlobal = async (
  page: Exclude<CopyPage, "global">
): Promise<CopyBlocks> => {
  const [own, global] = await Promise.all([
    getPageCopy(page),
    getPageCopy("global"),
  ])
  return { ...global, ...own }
}

/* -------------------------------------------------------------- tlačítka -- */

/**
 * Tlačítka z CMS, do téže mapy jako bloky.
 *
 * ## Proč do stejné mapy, a ne jako druhý prop
 *
 * Stránky dnes načtou obsah jednou a pošlou ho dolů jako `copy`; komponenty si
 * z něj berou svůj blok podle klíče. Druhý prop by tuhle trasu zdvojil — a
 * musel by projít každou mezikomponentou, která dnes jen podává `copy` dál.
 * Tlačítka proto bydlí v téže mapě pod prefixem `tlacitko.`, kde se nemají jak
 * potkat s klíči bloků.
 *
 * ## Proč vlastní čtečka, a ne `sources` v konfiguraci
 *
 * `sources` se čtou přes `getPageContent(route)`, což je jiná trasa, než jakou
 * tenhle web používá (`getSiteCopy` přes `getPageCopy`). Přepnout na ni znamená
 * přepsat čtení na všech stránkách kvůli deseti tlačítkům. `readerFor` je
 * tatáž čtečka, kterou `getPageContent` uvnitř používá — jen zavolaná přímo.
 *
 * Tlačítko je jeden záznam pro celý web: „Prohlédnout výrobky" stojí na úvodní
 * stránce, v „O mně" i ve „Výrobě" a má být na jednom místě. Proto se načítají
 * všechna, bez ohledu na stránku.
 */
export const getButtons = async (): Promise<Record<string, CopyButton>> => {
  // Stejný důvod jako u `getPageCopy` výš: `draftMode()` je dynamické API a
  // musí zůstat MIMO try/catch, jinak se spolkne bailout a stránka zůstane
  // předgenerovaná — bez `id` a tím i bez editovatelnosti.
  const preview = (await draftMode()).isEnabled

  try {
    /*
     * `readerFor` je v deklaracích knihovny `(): unknown`, takže se tvar musí
     * doplnit tady. Není to obcházení kontroly — čtečka opravdu vrací pole
     * těl dokumentů, jen to typy zatím neříkají. (Nahlášeno autorovi.)
     */
    const read = readerFor({ draft: preview }) as (options: {
      type: string
      sort?: { field: string; direction: "asc" | "desc" }
      perPage?: number
    }) => Promise<Record<string, unknown>[]>

    const rows = await read({
      type: "tlacitko",
      sort: { field: "data.klic", direction: "asc" },
      perPage: 100,
    })

    const out: Record<string, CopyButton> = {}
    for (const data of rows) {
      const klic = stringValue(data.klic).trim()
      if (!klic) continue
      out[BUTTON_PREFIX + klic] = {
        id: documentId(data),
        klic,
        label: stringValue(data.label),
        href: stringValue(data.href),
      }
    }
    return out
  } catch (error) {
    console.error("[cms] Tlačítka se nepodařilo načíst.", error)
    return {}
  }
}

/**
 * Bloky stránky, globální bloky a tlačítka — jedna mapa, jeden `await`.
 *
 * Tohle je to, co stránky volají. `getPageCopyWithGlobal` zůstává vedle pro
 * volající, kteří tlačítka nepotřebují.
 */
export const getPageContentFull = async (
  page: Exclude<CopyPage, "global">
): Promise<CopyBlocks> => {
  const [blocks, buttons] = await Promise.all([
    getPageCopyWithGlobal(page),
    getButtons(),
  ])
  return { ...blocks, ...(buttons as unknown as CopyBlocks) }
}

/* --------------------------------------------------------------- dotazy -- */

/**
 * Otázky stránky Dotazy — dokumenty typu `qna`, seřazené podle `poradi`.
 *
 * Tatáž trasa jako `getButtons`: `readerFor` přímo, v náhledu čtení konceptů
 * (to jediné připojuje `id`, na kterém visí popup `editableDoc`). Nikdy
 * nevyhodí — stránka bez otázek spadne na seznam v kódu, viz FAQBody.
 */
export const getFaqQuestions = async (): Promise<FaqQuestion[]> => {
  // `draftMode()` MIMO try/catch — viz `getPageCopy` výš.
  const preview = (await draftMode()).isEnabled

  try {
    const read = readerFor({ draft: preview }) as (options: {
      type: string
      sort?: { field: string; direction: "asc" | "desc" }
      perPage?: number
    }) => Promise<Record<string, unknown>[]>

    const rows = await read({
      type: "qna",
      sort: { field: "data.poradi", direction: "asc" },
      perPage: 200,
    })

    return rows
      .map((data) => ({
        id: documentId(data),
        question: stringValue(data.question).trim(),
        answer: stringValue(data.answer).trim(),
        kategorie: stringValue(data.kategorie).trim(),
        poradi: typeof data.poradi === "number" ? data.poradi : 0,
      }))
      .filter((row) => row.question)
  } catch (error) {
    console.error("[cms] Dotazy se nepodařilo načíst.", error)
    return []
  }
}

/**
 * Kategorie dotazů — dokumenty `qnaKategorie`, seřazené podle `poradi`.
 *
 * Určují pořadí a znění čipů filtru; otázky se k nim hlásí jménem. Prázdný
 * seznam není chyba — čipy si pak stránka poskládá z jmen na otázkách.
 */
export const getFaqCategories = async (): Promise<FaqCategory[]> => {
  const preview = (await draftMode()).isEnabled

  try {
    const read = readerFor({ draft: preview }) as (options: {
      type: string
      sort?: { field: string; direction: "asc" | "desc" }
      perPage?: number
    }) => Promise<Record<string, unknown>[]>

    const rows = await read({
      type: "qnaKategorie",
      sort: { field: "data.poradi", direction: "asc" },
      perPage: 100,
    })

    return rows
      .map((data) => ({
        id: documentId(data),
        nazev: stringValue(data.nazev).trim(),
        poradi: typeof data.poradi === "number" ? data.poradi : 0,
      }))
      .filter((row) => row.nazev)
  } catch (error) {
    console.error("[cms] Kategorie dotazů se nepodařilo načíst.", error)
    return []
  }
}

/* -------------------------------------------------- soubory ke stažení -- */

/**
 * Dokumenty ke stažení pro jednu stránku (typ `soubor`).
 *
 * Řadí se podle `poradi`, při shodě podle názvu — pořadí vzniku je pořadí,
 * kterému nikdo nerozumí a které se změní při každém přenahrání souboru.
 *
 * Nikdy nevyhodí. Stránka bez seznamu souborů je pořád stránka; právní text
 * se má zobrazit, i když se knihovna médií nedovolá.
 */
export const getFiles = async (page: string): Promise<CopyFile[]> => {
  // `draftMode()` MIMO try/catch — viz `getPageCopy` výš.
  const preview = (await draftMode()).isEnabled

  try {
    const read = readerFor({ draft: preview }) as (options: {
      type: string
      perPage?: number
    }) => Promise<Record<string, unknown>[]>

    const rows = await read({ type: "soubor", perPage: 100 })

    return rows
      .filter((row) => stringValue(row.stranka) === page)
      .map((row) => {
        /*
         * Pole typu `file` drží buď celý snímek z knihovny, nebo jen její
         * identifikátor — schéma připouští obojí (`check` v core/fieldTypes).
         * Řetězec sám o sobě adresu nenese, takže z něj odkaz nepostavíme
         * a soubor se přeskočí; je to stav, který vznikne jen ručním
         * zásahem do dat, ne prací ve Studiu.
         */
        const file = row.soubor as Record<string, unknown> | string | null
        const asset = typeof file === "object" && file ? file : null
        return {
          id: documentId(row),
          nazev: stringValue(row.nazev),
          popis: stringValue(row.popis),
          url: stringValue(asset?.url),
          mime: stringValue(asset?.mime),
          size: Number(asset?.size ?? 0),
          poradi: Number(row.poradi ?? Number.MAX_SAFE_INTEGER),
        }
      })
      .filter((file) => file.url)
      .sort((a, b) => a.poradi - b.poradi || a.nazev.localeCompare(b.nazev, "cs"))
      .map(({ poradi, ...file }) => file)
  } catch (error) {
    console.error(`[cms] Soubory pro "${page}" se nepodařilo načíst.`, error)
    return []
  }
}
