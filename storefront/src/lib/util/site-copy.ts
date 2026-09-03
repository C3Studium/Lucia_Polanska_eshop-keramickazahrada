/**
 * Tvar redakčního obsahu a čtečky nad ním — bez serveru.
 *
 * Rozdělené od `@lib/data/site-copy` schválně: tenhle soubor si importují
 * klientské komponenty (hero, úvod e-shopu, kurzy), a ten druhý nese
 * `server-only`, protože sahá do databáze. Kdyby to bylo v jednom modulu,
 * první `"use client"` komponenta, která si vezme `galleryUrl`, vtáhne do
 * klientského balíku i čtení z databáze — a build spadne na „You're importing
 * a component that needs server-only".
 *
 * Typy se z klientského balíku vytratí samy, funkce ne. Proto je dělicí čára
 * tady a ne u `import type`.
 */

/** Jeden blok tak, jak ho vrací `getSiteCopy`. */
export type CopyBlock = {
  id: string | null
  key: string
  title: string
  headline: string
  accent: string[]
  /** HTML. Na holý text je `bodyText`. */
  body: string
  bodyText: string
  image: CopyImage | null
  gallery: CopyImage[]
  items: { lead: string; label: string; value: string; note: string }[]
  /**
   * Dvojice otázka + odpověď, v pořadí bloku.
   *
   * Vlastní pole schématu, ne `items`: `siteCopy` na ně místo má a editor
   * u nich vidí „Otázka" a „Odpověď" místo „Popisek / Hodnota".
   */
  questions: { question: string; answer: string }[]
}

/**
 * Jedna otázka ze stránky Dotazy — dokument typu `qna`.
 *
 * `id` nese jen čtení konceptů (náhled Studia); veřejné čtení ho nechává
 * `null` a anotace `editableDoc` se bez něj prostě nevypíše. `kategorie` je
 * jméno čipu ve filtru, slovo od slova — viz deklaraci typu.
 */
export type FaqQuestion = {
  id: string | null
  question: string
  answer: string
  kategorie: string
  poradi: number
}

/** Kategorie dotazů — dokument typu `qnaKategorie`; čip ve filtru. */
export type FaqCategory = {
  id: string | null
  nazev: string
  poradi: number
}

export type CopyImage = {
  id?: string
  url: string
  alt?: string
  width?: number | null
  height?: number | null
}

export type CopyBlocks = Record<string, CopyBlock | undefined>

/** Stránky, které mají v CMS vlastní skupinu bloků (viz valecms.config.ts). */
export type CopyPage =
  | "index"
  | "kurzy"
  | "o-mne"
  | "vyroba"
  | "dotazy"
  // Právní dokumenty — klíč stránky je totéž slovo jako routa.
  | "smluvni-podminky"
  | "ochrana-osobnich-udaju"
  | "cookies"
  | "odstoupeni-od-smlouvy"
  | "reklamacni-protokol"
  | "doprava-a-platba"
  | "global"

/** N-tý obrázek galerie bloku, nebo `fallback`. */
export const galleryUrl = (
  block: CopyBlock | undefined,
  index: number,
  fallback: string
): string => block?.gallery?.[index]?.url || fallback

/** Samostatný obrázek bloku, nebo `fallback`. */
export const imageUrl = (
  block: CopyBlock | undefined,
  fallback: string
): string => block?.image?.url || fallback

/**
 * Odstavce bloku, jako pole.
 *
 * Hranici odstavce nese `body` — autorské HTML —, ne `bodyText`. `plainText()`
 * v CMS nahrazuje `</p>` MEZEROU, ne zalomením, a pak srazí bílé znaky, takže
 * `bodyText` je vždycky jediná řádka. Konzumenti, kteří z něj chtěli odstavce
 * přes `.split("\n")`, proto dostávali vždycky jednu položku: hero udělalo
 * displejový nadpis z CELÉHO textu bloku a lede mu zůstalo prázdné, úvod
 * e-shopu slil oba odstavce do levého sloupce a pravý spadl na zálohu.
 *
 * `bodyText` zůstává jako záloha pro blok, který HTML nemá.
 */
const collapse = (text: string): string =>
  text
    .replace(/<[^>]*>/g, "")
    // U+00A0, ne obyčejná mezera — `&nbsp;` dekóduje na znak, který pojmenovává.
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    /*
     * Nedělená mezera přežije ze stejného důvodu, z jakého ji chrání `plainText`
     * v CMS: `\s` ji matchuje, takže naivní srážení na obyčejnou mezeru by zahodilo
     * přesně ten znak, který české sazbě drží jednopísmennou předložku na řádku.
     */
    .replace(/\s+/g, (run) => (/[  ]/.test(run) ? " " : " "))
    .trim()

export const paragraphs = (block: CopyBlock | undefined): string[] => {
  const html = (block?.body || "").trim()

  if (html) {
    const parts = html
      .split(/<\/(?:p|div|h[1-6]|li)\s*>|<br\s*\/?>/i)
      .map(collapse)
      .filter(Boolean)

    if (parts.length) {
      return parts
    }
  }

  return (block?.bodyText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * Hodnota položky bloku podle popisku.
 *
 * Přepínače sekcí a drobné údaje (adresa, otevírací doba) migrace ukládá do
 * `items` jako tečkované dvojice — `ecomSection.desc.benefits` = `"false"`.
 * Tohle je čtečka, aby se to v komponentě nehledalo cyklem.
 */
export const itemValue = (
  block: CopyBlock | undefined,
  label: string
): string | undefined =>
  block?.items?.find((item) => item.label === label)?.value

/**
 * Přepínač sekce.
 *
 * Chybějící hodnota znamená ZAPNUTO: nová stránka má být vidět, dokud někdo
 * vědomě neřekne jinak. Opačná volba by znamenala, že prázdné CMS schová celý
 * web a nikdo nepozná proč.
 */
export const sectionEnabled = (
  block: CopyBlock | undefined,
  label: string
): boolean => itemValue(block, label) !== "false"

/* -------------------------------------------------------------- tlačítka -- */

/**
 * Jedno tlačítko z CMS (typ `tlacitko`).
 *
 * `id` je identifikátor dokumentu a je tam jen v náhledu Studia — bez něj
 * nemá `editable()` co napsat na element a překryv nemá co chytit. Mimo
 * náhled je null, protože veřejné HTML nemá nést nic o editaci. Stejné
 * pravidlo jako u `CopyBlock`.
 */
export type CopyButton = {
  id: string | null
  klic: string
  label: string
  /** Jen u tlačítek mimo web. Uvnitř webu drží cíl kód. */
  href: string
}

/** Tlačítka pod klíčem `tlacitko.<klic>`, ve stejné mapě jako bloky. */
export const BUTTON_PREFIX = "tlacitko."

/**
 * Tlačítko podle klíče, nebo `undefined`.
 *
 * Bere tutéž mapu, kterou komponenty dostávají jako `copy` — tlačítka v ní
 * bydlí pod vlastním prefixem, takže se nemají jak potkat s klíči bloků
 * a stránky nepotřebují druhý prop.
 */
export const button = (
  /*
   * Bere obojí: celou mapu stránky (kde tlačítka bydlí vedle bloků) i samotnou
   * mapu tlačítek, kterou dostává patička. Jsou to dva tvary téhož — klíč
   * s prefixem a hodnota tlačítko — a rozlišovat je dvěma funkcemi by jen
   * nutilo volajícího vědět, odkud jeho mapa přišla.
   */
  copy: Record<string, unknown> | undefined,
  klic: string
): CopyButton | undefined =>
  copy?.[BUTTON_PREFIX + klic] as CopyButton | undefined

/**
 * Název tlačítka, se zálohou zabudovanou v komponentě.
 *
 * Prázdný text z CMS je záloha, ne prázdné tlačítko: nepojmenované tlačítko
 * je nepoužitelné a nikdo ho tak nemyslel.
 */
export const buttonLabel = (
  copy: CopyBlocks | undefined,
  klic: string,
  fallback: string
): string => button(copy, klic)?.label?.trim() || fallback

/** Adresa tlačítka mimo web, se zálohou. */
export const buttonHref = (
  copy: CopyBlocks | undefined,
  klic: string,
  fallback: string
): string => button(copy, klic)?.href?.trim() || fallback

/* --------------------------------------------------------------- shadery -- */

/**
 * Fotky bloku pro shader — adresa a poměr stran.
 *
 * Shadery načítají obrázek přímo do textury (`THREE.TextureLoader`), ne přes
 * `next/image`, a potřebují znát poměr stran DŘÍV, než se textura načte:
 * karty se rozmisťují při prvním renderu a čekat na obrázek by znamenalo
 * skok v rozvržení. `next/image` si tenhle rozměr zjišťuje sám, shader ne.
 *
 * Rozměry v CMS jsou, protože je knihovna při nahrání změří z bytů souboru.
 * Když u fotky chybí, použije se poměr ze zálohy na stejné pozici — a když
 * není ani ta, čtvercový. Nikdy se nedělí nulou.
 *
 * Chybějící fotka v bloku znamená zálohu z kódu, takže shader nikdy nedostane
 * kratší pole, než čeká — počet karet je jeho rozvržení, ne obsah.
 */
export const shaderImages = <T extends { src: string; aspect: number }>(
  block: CopyBlock | undefined,
  fallback: readonly T[]
): { src: string; aspect: number }[] =>
  fallback.map((item, index) => {
    const photo = block?.gallery?.[index]
    if (!photo?.url) return { src: item.src, aspect: item.aspect }
    const width = Number(photo.width ?? 0)
    const height = Number(photo.height ?? 0)
    return {
      src: photo.url,
      aspect: width > 0 && height > 0 ? width / height : item.aspect,
    }
  })

/* -------------------------------------------------- soubory ke stažení -- */

/**
 * Jeden dokument ke stažení (typ `soubor`).
 *
 * `url` míří do knihovny médií, tedy na jinou doménu než web — `CMS_MEDIA_HOST`.
 * To je záměr knihovny: bucket na téže doméně by z otevřeného PDF udělal
 * stránku webu se vším, co k tomu patří.
 */
export type CopyFile = {
  id: string | null
  nazev: string
  popis: string
  url: string
  /** MIME z knihovny — podle něj se pozná PDF od obrázku. */
  mime: string
  /** Velikost v bajtech, 0 když ji knihovna neuvádí. */
  size: number
}
