// Tenhle web, jako konfigurace.
//
// VALECMS je knihovna; tenhle soubor je jediný popis toho, z čeho se skládá
// TENHLE web. Stránka je route, dokumenty, které drží, a to, kam jejich pole
// padají do props, které dostanou sekce.
//
// Musí projít přes `defineSite`. Holý objekt se stejnými klíči projde čtením
// i buildem a rozbije se až při publikaci: revalidace se ptá téhle konfigurace,
// které stránky přegenerovat, a na nezpracovaném objektu neví.
//
// ## Co sem patří a co ne
//
// Jen redakční obsah. Produkty, ceny, sklad, objednávky, kurzy a rezervace
// jsou Medusa a zůstávají v Meduse — CMS se jich nedotkne. Sem patří texty a
// obrázky, které dřív žily v Sanity: hero na úvodní stránce, uvítací blok
// e-shopu, text o kurzech, kontakt, mapa.
//
// ## Klíče bloků
//
// `copy: 'index'` znamená „všechny bloky typu siteCopy, které mají
// `page: 'index'`". Ty hodnoty zároveň naplňují výběr ve formuláři — schéma
// siteCopy čte volby pole `page` právě odsud, takže stránka, která tu není,
// nejde v CMS naplnit textem („Neplatná volba").
//
// Vlastní `key` bloku je dotovaný identifikátor (`index.hero`), podle kterého
// si ho komponenta vyzvedne. Je to smlouva s kódem — přejmenovat ho znamená
// přepsat i komponentu.
import { defineGlobals, definePage, defineSite } from '@c3studium/valecms/site'

/**
 * Úvodní stránka.
 *
 * Bloky, které tu dnes stojí (klíče odpovídají tomu, co se migruje ze Sanity):
 * `index.hero` (introHero), `index.news` (newsText), `index.ecom-intro`
 * (ecomIntro), `index.ecom-entry`, `index.ecom-desc`, `index.ecom-cta`.
 *
 * Přibylo mimo migraci: `index.ecom-carousel` — texty sekce „02 · Výběr z ateliéru"
 * (lišta, uvození, věta o zakázkách, popisek scrollování). Fotky karuselu v tom bloku
 * NEJSOU a nemají tam být: jdou odjinud a upravovat je přes CMS už jednou rozbilo
 * backend i e-shop.
 */
/*
 * ## Proč jsou routy s `/cz`, a ne `/`
 *
 * Stránky webu žijí pod `app/[countryCode]/…`, takže veřejná adresa úvodní
 * stránky je `/cz`, ne `/`. Deklarovat tu `/` má dva důsledky, oba špatné:
 *
 * 1. Náhled by se rozbil. `preview/frame.js` dělá u kořene výjimku —
 *    `path === '/' ? HOME_PREVIEW_PATH : path` — a načte do iframu
 *    `/studio/preview/home`. Tuhle stránku ale nikdo nezakládá: není v
 *    `DOCS.md`, instalátor ji nevytváří a `doctor` ji nekontroluje. Catch-all
 *    `app/studio/[[...path]]` ji spolkne a v rámu se objeví samo Studio —
 *    „Tento typ obsahu neexistuje", nula upravitelných prvků.
 * 2. Publikace by přegenerovala cestu, která neexistuje.
 *
 * S konkrétní routou výjimka nenastane, rám načte skutečnou adresu a
 * revalidace míří na stránku, která opravdu je.
 */
const homepage = definePage({
    route: '/cz',
    title: 'Hlavní stránka',
    // Všechny bloky typu siteCopy, které mají `page: 'index'`.
    copy: 'index',
    // Pojmenované zdroje dokumentů. Klíč je jméno, pod kterým dorazí do props.
    sources: {},
})

/**
 * Kurzy — jen ta textová část.
 *
 * Termíny, kapacity, ceny a rezervace drží Medusa (`/admin/courses/*`); CMS
 * sem dodává jen úvodní text a fotky. Kdyby tohle někdy začalo popisovat
 * termíny, jsou to dva zdroje pravdy o jedné věci.
 *
 * Bloky: `kurzy.intro` (hero + fotky v nadpisu), `kurzy.about` (scéna „Pro
 * koho" se třemi publiky v `items`), `kurzy.galerie` (fotky publik),
 * `kurzy.rezervace` (texty kolem termínů; termíny samy drží Medusa).
 */
const kurzy = definePage({
    route: '/cz/kurzy',
    title: 'Kurzy',
    copy: 'kurzy',
    sources: {},
})

/**
 * O mně.
 *
 * Bloky: `o-mne.hero` (aboutHero).
 */
const oMne = definePage({
    route: '/cz/o-mne',
    title: 'O mně',
    copy: 'o-mne',
    sources: {},
})

/**
 * Výroba — jak kus vzniká.
 *
 * Bloky: `vyroba.hero` (úvodní scéna, texty + 2 fotky), `vyroba.kroky`
 * (kroky: nadpis/věta/odstavec/zvýraznění v `items`, lišty a outro v `accent`),
 * `vyroba.galerie` (7 fotek kroků), `vyroba.cta` (závěr, texty + 2 fotky).
 */
const vyroba = definePage({
    route: '/cz/vyroba',
    title: 'Výroba',
    copy: 'vyroba',
    sources: {},
})

/**
 * Časté dotazy.
 *
 * Samotné otázky a odpovědi jsou položky bloku (`siteCopy` má na ně
 * `question`/`answer`), ne vlastní typ — je to text jedné stránky, ne
 * záznamy, na které by někdo odkazoval odjinud.
 *
 * Bloky: `dotazy.hero` (úvodní obrazovka), `dotazy.otazky` (texty kolem
 * seznamu a kontaktní výzva), `dotazy.galerie` (fotky shaderu + kontaktu).
 *
 * Samotné otázky NEJSOU blok: jsou to dokumenty typu `qna` (viz
 * valecms.types.ts) — jedna otázka = jeden dokument, ve Studiu vlastní
 * sekce „Dotazy". `kategorie` na otázce je jméno čipu ve filtru (stejné
 * slovo = stejný čip, prázdné = jen pod „Vše"), `poradi` řadí otázky i
 * čipy. Na stránce se otázka rozklikává přes `editableDoc` — popup
 * s celým formulářem. Fotky (`dotazy-FAQ1`…`FAQ4`) jsou v knihovně.
 */
const dotazy = definePage({
    route: '/cz/dotazy',
    title: 'Dotazy',
    copy: 'dotazy',
    sources: {},
})

/**
 * Právní dokumenty.
 *
 * Šest samostatných stránek, ne jedna se šesti kapitolami: každý dokument se
 * mění jindy a z jiného důvodu (obchodní podmínky se zákonem, doprava
 * s ceníkem dopravce), a editor je hledá pod tou stránkou, kterou upravuje.
 *
 * Sekce nesou `items` — jedna položka na kapitolu. `lead` v nich drží `id`,
 * na kterém visí kotva v adrese a boční navigace; do CMS jde jen proto, aby
 * bylo vidět, ke které kapitole text patří, a komponenta ho odtamtud nečte.
 * Odkaz, který si někdo uložil, nesmí přestat platit přejmenováním nadpisu.
 */
const legalPages = [
    ['/cz/smluvni-podminky', 'Obchodní podmínky', 'smluvni-podminky'],
    ['/cz/ochrana-osobnich-udaju', 'Ochrana osobních údajů', 'ochrana-osobnich-udaju'],
    ['/cz/cookies', 'Používání cookies', 'cookies'],
    ['/cz/odstoupeni-od-smlouvy', 'Odstoupení od smlouvy', 'odstoupeni-od-smlouvy'],
    ['/cz/reklamacni-protokol', 'Reklamační protokol', 'reklamacni-protokol'],
    ['/cz/doprava-a-platba', 'Doprava a platba', 'doprava-a-platba'],
].map(([route, title, copy]) =>
    definePage({ route, title, copy, sources: {} })
)

export default defineSite({
    pages: [homepage, kurzy, oMne, vyroba, dotazy, ...legalPages],
    /*
     * Jedenáct adres pro tentýž obsah.
     *
     * Stránky žijí pod `app/[countryCode]/` a Medusa má tři regiony:
     * Česká republika (cz), Polsko (pl) a Europe (sk, si, dk, fr, de, it, es,
     * se, gb). Úvodní stránka se tedy servíruje na jedenácti adresách, ne na
     * jedné — ověřeno, `/cz`, `/de`, `/pl` i `/gb` vrací 200.
     *
     * Bez tohohle seznamu by publikace přegenerovala jen `/cz/…` a zbylých
     * deset by drželo starý obsah. Navíc tiše: v CMS by to vypadalo jako
     * publikované.
     *
     * Není to o překladech — texty jsou jedny, česky. Jde o to, na kolika
     * adresách se vykreslují.
     *
     * Když v Meduse přibude region, patří jeho země i sem.
     */
    prefixes: ["cz", "pl", "sk", "si", "dk", "fr", "de", "it", "es", "se", "gb"],
    /*
     * Recenze spravuje Medusa, ne CMS.
     *
     * Backend má vlastní schvalování (`/admin/reviews`, workflow `create-review`,
     * store endpoint pro zákazníky). Kdyby je Studio nabízelo taky, jsou to dvě
     * fronty na jednu věc — a jedna z nich se dřív nebo později přehlédne.
     * Stejné pravidlo jako u produktů a kurzů: co drží Medusa, do CMS nepatří.
     *
     * Od 0.1.36 to zná i `SiteOptions`, takže obcházka přes `@ts-expect-error`
     * padla.
     */
    reviews: false,
    /*
     * E-maily posílá Medusa, ne CMS.
     *
     * Backend má vlastní resend modul a šablony: potvrzení objednávky,
     * rezervace kurzu, připomínka tři dny předem, zrušený termín, vrácení
     * peněz. Kdyby část psalo i CMS, zákazník dostane dva různé hlasy z jedné
     * firmy a nikdo neví, který systém co odeslal.
     */
    mail: false,
    // Co `_app` vykresluje pod každou routou — patička, kontakt. Publikace
    // takového bloku sáhne na každou stránku, a proto se to říká tady nahlas.
    //
    // Bloky: `global.kontakt` (kontakt), `global.mapa` (mapa),
    // `global.news-popup` (newsPopup).
    globals: defineGlobals({ copy: 'global', sources: {} }),
})
