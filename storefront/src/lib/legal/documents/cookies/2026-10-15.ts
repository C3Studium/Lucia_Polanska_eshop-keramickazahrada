import {
  COOKIE_INVENTORY,
  type CookieCategory,
  type CookieEntry,
} from "../../cookies-inventory"
import type { LegalBlock, LegalDocumentVersion } from "../../types"

/**
 * Používání cookies — znění od 15. 10. 2026.
 *
 * Tabulky se skládají ze soupisu `cookies-inventory.ts` (udržuje ho
 * workstream E spolu s lištou souhlasu), takže stránka nemůže tvrdit něco
 * jiného, než web dělá. Kategorie odpovídají liště
 * (`modules/layout/CookieNotice/categories.ts`). Položky `staffOnly`
 * (administrace, redakce) jsou ve zvláštní malé tabulce.
 *
 * Odstraněny rozporné odstavce předchozího znění (01–04 a 07 — „nesbíráme
 * osobní údaje" vedle Google Analytics), LEGAL_AUDIT.md §8.
 */

const STORAGE_LABEL: Record<CookieEntry["storage"], string> = {
  cookie: "cookie",
  localStorage: "úložiště prohlížeče (localStorage)",
  sessionStorage: "úložiště relace (sessionStorage)",
}

const CATEGORY_LABEL: Record<CookieCategory, string> = {
  necessary: "Nezbytné",
  preferences: "Preferenční",
  analytics: "Analytické",
  marketing: "Marketingové",
}

const HEAD = ["Název", "Kde je uložená", "K čemu slouží", "Kdo ji nastavuje", "Jak dlouho"]

const rowOf = (entry: CookieEntry): string[] => [
  entry.name,
  STORAGE_LABEL[entry.storage],
  entry.purpose,
  entry.provider,
  entry.duration,
]

const publicEntries = (category: CookieCategory) =>
  COOKIE_INVENTORY.filter((entry) => entry.category === category && !entry.staffOnly)

/** Tabulka jedné kategorie, nebo věta, že žádné takové nepoužíváme. */
const categoryBlocks = (category: CookieCategory): LegalBlock[] => {
  const entries = publicEntries(category)
  if (!entries.length) {
    return [
      {
        type: "p",
        text: `**${CATEGORY_LABEL[category]}:** žádné takové cookies ani záznamy v úložišti prohlížeče dnes nepoužíváme.`,
      },
    ]
  }
  return [
    {
      type: "table",
      caption: `${CATEGORY_LABEL[category]} cookies a úložiště`,
      head: HEAD,
      rows: entries.map(rowOf),
    },
  ]
}

const staffEntries = COOKIE_INVENTORY.filter((entry) => entry.staffOnly)

const usesAnalytics = publicEntries("analytics").length > 0
const usesMarketing = publicEntries("marketing").length > 0

const cookies: LegalDocumentVersion = {
  slug: "cookies",
  title: "Používání cookies",
  version: "2026-10-15",
  summary:
    "Které cookies web používá, k čemu slouží a jak svůj souhlas kdykoli změníte.",
  pdf: false,
  sections: [
    {
      id: "co-jsou-cookies",
      title: "Co jsou cookies",
      blocks: [
        {
          type: "p",
          text: "Cookies jsou malé textové soubory, které si web ukládá do vašeho prohlížeče. Podobně fungují i úložiště prohlížeče (localStorage a sessionStorage) — i ta tady uvádíme.",
        },
        {
          type: "p",
          text: "Některé cookies jsou nezbytné, aby obchod vůbec fungoval (košík, přihlášení); ty smíme ukládat bez vašeho souhlasu. Všechny ostatní ukládáme jen tehdy, když s nimi souhlasíte (§ 89 odst. 3 zákona č. 127/2005 Sb., o elektronických komunikacích). Dokud v liště nic nezvolíte, ukládají se jen nezbytné.",
        },
      ],
    },
    {
      id: "kategorie",
      title: "Kategorie cookies",
      blocks: [
        {
          type: "ul",
          items: [
            "**Nezbytné** — košík, přihlášení do účtu, zabezpečení objednávky a uložení vaší volby cookies. Bez nich obchod nefunguje, proto souhlas nepotřebují a nelze je vypnout.",
            "**Preferenční** — pamatují si vaše volby, například naposledy použitý způsob platby, abyste je nemuseli zadávat znovu. Jen s vaším souhlasem.",
            usesAnalytics
              ? "**Analytické** — statistiky návštěvnosti, které nám ukazují, co na webu lidé hledají a kde se ztrácejí. Jen s vaším souhlasem; nikomu je neprodáváme."
              : "**Analytické** — statistiky návštěvnosti. Dnes je nepoužíváme; kdybychom je zapnuli (Google Analytics), načtou se jen s vaším souhlasem.",
            usesMarketing
              ? "**Marketingové** — měření účinnosti reklamy a obsah ze sociálních sítí. Jen s vaším souhlasem."
              : "**Marketingové** — měření účinnosti reklamy a obsah ze sociálních sítí. Dnes je nepoužíváme; bez vašeho souhlasu by se nenačetly vůbec.",
          ],
        },
      ],
    },
    {
      id: "seznam",
      title: "Seznam cookies a úložišť",
      blocks: [
        {
          type: "p",
          text: "Toto jsou všechny cookies a záznamy v úložišti prohlížeče, které web ukládá. U položek s hvězdičkou (*) se název liší podle konkrétní objednávky nebo informačního pruhu.",
        },
        ...categoryBlocks("necessary"),
        ...categoryBlocks("preferences"),
        ...categoryBlocks("analytics"),
        ...categoryBlocks("marketing"),
        ...(staffEntries.length
          ? ([
              {
                type: "table",
                caption: "Jen pro správu webu",
                head: HEAD,
                rows: staffEntries.map(rowOf),
              },
              {
                type: "p",
                text: "Tyto cookies dostane jen majitelka obchodu a redakce po přihlášení do administrace. Běžnému návštěvníkovi se neukládají.",
              },
            ] satisfies LegalBlock[])
          : []),
      ],
    },
    {
      id: "treti-strany",
      title: "Služby třetích stran",
      blocks: [
        {
          type: "ul",
          items: [
            "**Platební brána ComGate** — při platbě vás přesměrujeme na stránky ComGate, které používají vlastní cookies podle svých zásad.",
            "**Mapy Google** — mapa v okně Kontakt se načte až po vašem kliknutí. Teprve pak může Google ukládat své cookies.",
            "**Balíkovna (Česká pošta)** — mapa výdejních míst v pokladně se načte, až když si výdejní místo vybíráte; Česká pošta při tom může používat vlastní cookies.",
            "**Google Analytics** — načte se jen tehdy, pokud statistiky zapneme a vy s nimi souhlasíte.",
          ],
        },
        {
          type: "p",
          text: "Cookies, které tyto služby ukládají, najdete i v [seznamu výše](/cookies#seznam). Jejich přesný počet a dobu uložení určuje daný poskytovatel.",
        },
      ],
    },
    {
      id: "nastaveni",
      title: "Jak souhlas změnit nebo odvolat",
      blocks: [
        {
          type: "p",
          text: "Svou volbu můžete kdykoli změnit nebo souhlas odvolat odkazem **„Nastavení cookies“** v patičce webu — znovu se otevře lišta s volbami. Odvolání je stejně snadné jako udělení souhlasu.",
        },
        {
          type: "p",
          text: "Cookies můžete také smazat nebo zablokovat v nastavení prohlížeče. Zablokujete-li i nezbytné, nemusí obchod fungovat — například se nezapamatuje košík.",
        },
      ],
    },
    {
      id: "vice",
      title: "Více informací",
      blocks: [
        {
          type: "p",
          text: "Jak zacházíme s osobními údaji, popisují [Zásady ochrany osobních údajů](/ochrana-osobnich-udaju). S dotazy nám pište na {{seller.email}}.",
        },
      ],
    },
  ],
}

export default cookies
