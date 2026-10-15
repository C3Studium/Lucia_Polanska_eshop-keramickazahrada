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
import { defineGlobals, definePage, defineSite, defineSurface } from '@c3studium/valecms/site'

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
 *
 * `index.seo` — titulek stránky (`title`, celý, bez přípony — úvodní stránka je
 * značka sama) a popis pro vyhledávače (první odstavec `body`). Stejný blok
 * `<stránka>.seo` mají Kurzy, O mně, Výroba, Dotazy a Obchod; tam se k titulku
 * „| Keramická zahrada" připojí samo (`getPageSeo`).
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
 * `kurzy.rezervace` (texty kolem termínů; termíny samy drží Medusa),
 * `kurzy.seo` (titulek a popis pro vyhledávače).
 *
 * Nadpis okna rezervace (RezervaceModal) čte `title` + `headline` téhož bloku
 * `kurzy.rezervace` — jedna věta, jedno místo. `accent` toho bloku zůstává
 * poziční (`accent.0`–`accent.5`), jak ho dnes čte sekce s termíny.
 *
 * Přibylo ve druhém kole (položky klíčované popiskem):
 * `kurzy.rezervace-okno` — texty okna rezervace a karet termínů: `oboci`,
 * `prazdne`, `kalendar.napoveda`, `termin.obsazeno` (i v sekci s termíny),
 * `cekacka.uvod`, `cekacka.tlacitko`, `cekacka.hotovo.nadpis`,
 * `cekacka.hotovo.text` (zástupci `{osoby}`, `{email}`; věta „Místo se
 * přitom nedrží…" je v kódu), `souhrn.oboci`, `souhrn.nadpis` (konec
 * v `note`), `souhrn.text` (zástupce `{email}`). V kódu: souhlasy, storno
 * podmínky, způsoby platby, ceny a chybové hlášky.
 * `kurzy.rezervace-stavy` — stránka rezervace z e-mailu
 * (`/kurzy/rezervace/[id]`): `<stav>.stitek`, `<stav>.nadpis` (konec
 * v `note`), `<stav>.text` pro `termin-zrusen`, `zruseno-vami`, `zruseno`,
 * `zaplaceno`, `na-miste`, `zpracovava`, `nezaplaceno`; `zmena.nadpis`,
 * `zmena.napoveda`, `zruseni.otazka`. Věty o vracení peněz (zrušený termín
 * po zaplacení, zrušení zákazníkem, potvrzení zrušení) a lhůta 48 hodin
 * jsou v kódu — `zruseno-vami` proto `.text` nemá. Adresa je dynamická, upravuje
 * se ve formuláři bloku.
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
 * Bloky: `o-mne.uvod` (hero: položky `oboci`, `lista.vlevo`,
 * `lista.vpravo`, `pozdrav`, `portret`, `kapitola`; „Jmenuji se" v `title`,
 * podpis v `headline`), `o-mne.pribeh` (lišta nad scénou v `title`
 * a `headline`, kapitoly v `items` — nadpis/začátek věty/zvýrazněný
 * konec/odstavec v `lead`/`label`/`note`/`value`, štítek a číslo zůstávají
 * v kódu), `o-mne.galerie` (4 fotky: 2 shader, 2 příběh), `o-mne.cta` (závěr:
 * položky `lista.vlevo`, `lista.vpravo`, `oboci`; nadpis `title` +
 * `headline`, věta `body`; tlačítko je `tlacitko` `o-mne.vyrobky`),
 * `o-mne.seo`.
 *
 * Víc krátkých textů jednoho bloku = položky klíčované popiskem, ne pozice
 * v `accent`: CMS z `accent` při čtení prázdné položky vyhazuje, takže by
 * vymazaný první text posunul všechny za ním. `accent` jen tam, kde drží
 * jediný text — to platí pro všechny bloky níž.
 *
 * `o-mne.hero` (aboutHero) je pozůstatek migrace ze Sanity a stránka ho nečte —
 * proto nový klíč `o-mne.uvod`: čtení starého bloku by na webu vyměnilo
 * dnešní texty za ty ze Sanity.
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
 * `vyroba.galerie` (7 fotek kroků), `vyroba.cta` (závěr, texty + 2 fotky),
 * `vyroba.seo` (titulek a popis pro vyhledávače).
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
 * seznamu a kontaktní výzva), `dotazy.galerie` (fotky shaderu + kontaktu),
 * `dotazy.seo` (titulek a popis pro vyhledávače).
 *
 * Dvě odpovědi (rozbitá zásilka, vrácení) dává vždy kód (`lib/legal/faq.ts`,
 * `PINNED_FAQ_ANSWERS`) — slibují zákonná práva. Otázka, kategorie a pořadí
 * zůstávají ze Studia, odpověď na tato témata se ve Studiu měnit nedá.
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

/* ---------------------------------------------- další redakční stránky -- */
// Obchod, košík, … — texty, které dřív ležely jen v kódu (docs/cms/00-plan.md, E).
// Bez importu z vedlejšího souboru: konfiguraci čtou i Node skripty
// (`--import @c3studium/valecms/register.mjs`) a relativní import bez přípony
// by tam neprošel.
//
// Výchozí text každého bloku zůstává v komponentě a CMS ho jen přebíjí —
// prázdný blok (nebo výpadek CMS) = web jako dřív. `scripts/seed-texts.mjs`
// bloky založí s dnešními texty, ať je Lucie ve Studiu najde vyplněné.
//
// Co tu schválně NENÍ: texty vázané na zákon nebo na logiku obchodu —
// souhlasy, předsmluvní informace a nápověda v pokladně, poučení o
// odstoupení, ceny a § 12a, upozornění u zakázek, vysvětlení řazení
// v obchodě, chybové hlášky. Ty se mění v PR, ne ve Studiu.
//
// ## Stránka výrobku jako globální bloky
//
// Společné texty všech výrobků (`global.produkt`) nejsou stránka: routa
// `/cz/products/[handle]` je dynamická a `definePage` ji přijme jen s `paths`
// nad zdrojem z CMS (`site/define.js`) — výrobky ale drží Medusa, CMS žádný
// takový zdroj nemá. Globální blok se při publikaci přegeneruje všude
// (`routesForDocument` → `everywhere`), takže dojde i na každý výrobek.
const textPages: ReturnType<typeof definePage>[] = [
    /**
     * Obchod — katalog.
     *
     * Bloky: `obchod.vyber` (úvod nad katalogem: obočí `accent.0`, nadpis
     * `title` + zvýrazněný `headline`, odstavec `body`), `obchod.seo`,
     * `obchod.katalog` (položky: `filtry.nadpis`; prázdný výsledek
     * `prazdne.stitek`, `prazdne.nadpis`, `prazdne.text`, `prazdne.tlacitko`;
     * chyba načtení `chyba.stitek`, `chyba.nadpis`, `chyba.text`; záložní texty
     * karty výrobku `karta.druh` a `karta.popis` — jen když výrobek vlastní
     * nemá; vada u kusu „Poškozený" je vždy z kódu).
     *
     * Filtry a vysvětlení řazení („Doporučené", FEATURED_EXPLANATION) zůstávají
     * v kódu — popisují logiku katalogu a musí s ní souhlasit. Velké hero
     * obchodu (`ShopHero`) se dnes nevykresluje, a proto pro něj blok není.
     */
    definePage({
        route: '/cz/store',
        title: 'Obchod',
        copy: 'obchod',
        sources: {},
    }),
    /**
     * Košík a nákup — od košíku po poděkování.
     *
     * Bloky na samotné stránce košíku: `kosik.uvod` (nadpis `title`, věta
     * `body`, položky `oboci` — před počtem kusů — a `souhrn` — poznámka
     * nad souhrnem), `kosik.prazdny` (prázdný košík: `title`, `body`, tlačítko
     * `accent.0`), `kosik.prihlaseni` (výzva k přihlášení: `title`, `body`,
     * tlačítko `accent.0`), `kosik.vypis` (výpis a souhrn: `polozky.oboci`,
     * `polozky.nadpis`, `souhrn.oboci`, `souhrn.nadpis`, `souhrn.nadpis-kratky`
     * — na telefonu —, `souhrn.tlacitko`; částky, doprava a DPH jsou v kódu).
     *
     * Stejná stránka nese i texty kroků, které na vlastní adrese bez
     * parametru nejsou (`/cart/[id]/…`, `/order/[id]/confirmed`,
     * `/express-checkout/…`) — upravují se ve formuláři bloku:
     * `kosik.platba-zrusena` (nadpis, výzva k zaplacení v `body`, položky
     * `oboci`, `tlacitko.zaplatit`, `tlacitko.kosik`; věta s důvodem od
     * brány je v kódu), `kosik.platba-potvrzena`
     * (čekání, než se objednávka uloží; stav „sama se nedokončila — znovu
     * neplaťte" je v kódu), `kosik.platba-ceka` (čekání na banku, položky
     * `oboci` a `poznamka` o obnovování), `kosik.objednavka-hotova` (poděkování:
     * obočí `accent.0`, `title`, `headline`), `kosik.objednavka-pomoc`
     * (okénko s kontaktem: obočí `accent.0`, nadpis `title`),
     * `kosik.rychly-nakup` (úvod rychlého nákupu: lišta `accent.0`, `title`,
     * `headline`, `body`), `kosik.rychly-vysledek` (výsledky rychlého nákupu,
     * položky `hotovo.*`, `overujeme.*`, `zruseno.*`, `nedokonceno.*` —
     * `.stitek`, `.nadpis` s koncem v `note`, `.text`; věta „Nic jsme vám
     * nestrhli." za neúspěšnou platbou je v kódu).
     */
    definePage({
        route: '/cz/cart',
        title: 'Košík a nákup',
        copy: 'kosik',
        sources: {},
    }),
    /**
     * Odběr novinek — kam vedou odkazy z e-mailů (potvrzení, odhlášení).
     *
     * Blok: `newsletter.stavy` — položky `<stav>.stitek`, `<stav>.nadpis`
     * (konec nadpisu v `note`) a `<stav>.text` pro `vychozi`, `potvrzeno`,
     * `odhlaseno`, `odhlaseno-upozorneni`, `jiz-odhlaseno`, `neplatny-odkaz`,
     * `chyba`. Odstavec u odmítnutí upozornění (`odhlaseno-upozorneni`) je
     * v kódu: říká, co přestane chodit a co chodit dál bude.
     */
    definePage({
        route: '/cz/newsletter',
        title: 'Odběr novinek',
        copy: 'newsletter',
        sources: {},
    }),
    /**
     * Účet zákazníka — přihlášení, přehled, objednávky.
     *
     * Na `/cz/account` je podle stavu buď přihlášení, nebo přehled účtu; náhled
     * Studia (bez přihlášeného zákazníka) ukáže přihlášení, ostatní bloky se
     * upravují ve formuláři.
     *
     * Bloky (položky klíčované popiskem): `ucet.formular` (formulář přihlášení
     * a registrace: `prihlaseni.nadpis`, `prihlaseni.text`, `prihlaseni.tlacitko`,
     * `prihlaseni.bez-uctu`, `prihlaseni.zalozit`, `prihlaseni.zapomenute`,
     * `registrace.nadpis`, `registrace.text`, `registrace.tlacitko`,
     * `registrace.mate-ucet`, `registrace.prihlasit`), `ucet.prehled` (přehled
     * po přihlášení: `oboci`, `pozdrav`, `prihlasen`, `profil.popisek`,
     * `profil.hotovo`, `adresy.text`, `objednavky.nadpis`, `objednavky.prazdne`),
     * `ucet.objednavky` (seznam objednávek: `oboci`, `nadpis` se zvýrazněným
     * koncem v `note`, `text`; bez objednávky `prazdne.nadpis`, `prazdne.text`;
     * počet objednávek je údaj).
     *
     * Hero vedle formuláře (nadpis, obočí, poznámka) je dál `global.prihlaseni`.
     * V kódu zůstává: souhlas pod registrací, popisky polí, chybové hlášky,
     * obnova hesla a ověření e-mailu (podpůrné obrazovky — do Studia na přání
     * nejdou, viz `global.prihlaseni`) a mazání účtu (co se smaže a co musí
     * zůstat kvůli účetnictví).
     */
    definePage({
        route: '/cz/account',
        title: 'Účet zákazníka',
        copy: 'ucet',
        sources: {},
    }),
    /**
     * Pokladna — jen úvodní věty, nic z toho, co se k objednávce váže.
     *
     * Bez košíku je pokladna 404, takže se bloky upravují ve formuláři.
     *
     * Bloky: `pokladna.uvod` (hlavička: `title` + zvýrazněný `headline`, věta
     * `body`, položka `zpet` — odkaz do košíku; počet výrobků je údaj),
     * `pokladna.souhrn` (pravý sloupec: `oboci`, `nadpis`), `pokladna.kroky`
     * (úvodní věty kroků: `doprava.otazka`, `platba.otazka`, `adresa.ulozene`,
     * `adresa.firma`).
     *
     * V kódu zůstává všechno ostatní: souhlasy a předsmluvní informace, názvy
     * a pořadí kroků, věty u způsobů platby (záloha, Balíkovna, dobírka, kdy se
     * platí), slevové kódy a jejich pravidla, upozornění u zakázky a dovolené,
     * chybové hlášky, ceny.
     */
    definePage({
        route: '/cz/checkout',
        title: 'Pokladna',
        copy: 'pokladna',
        sources: {},
    }),
]

/* ------------------------------------------------ právní dokumenty -- */
/*
 * Právní dokumenty — znění ve Studiu, vydané znění zamčené (od 15. 10. 2026,
 * docs/cms/00-plan.md, C).
 *
 * Obchodní podmínky, reklamační řád a protokol, odstoupení, ochrana osobních
 * údajů, cookies a doprava a platba jsou typ `pravniDokument` („Právní
 * dokumenty", `valecms.types.ts`): jeden dokument = jedno znění s datem
 * platnosti, celé — kapitoly s kotvami, bloky, odstavce. Web je čte přes
 * sloučený registr (`src/lib/legal/registry.ts`, `@lib/data/legal-registry`):
 * znění ze Studia přebíjí kopii v repu, ale VYDANÉ znění (PDF zveřejněné
 * v úložišti) se bere jen z otisku v repu a Studio ho nepustí změnit
 * (`app/api/cms/[...route]` + `lib/legal/cms-guard.ts`).
 *
 * Starý blok `<stránka>.text` (siteCopy), který kdysi přepisoval znění
 * kapitolu po kapitole podle pořadí, se nečte a nevrací — proto tu stránky
 * nemají `copy`. Mají jen `sources`: tím se objeví v náhledu Studia
 * a publikace právního dokumentu přegeneruje jejich adresy. (Stránky jsou
 * beztak dynamické — layout čte cookies.) Publikace kteréhokoli znění sáhne
 * na všechny právní stránky: tělo dokumentu nemá `kind`, podle kterého by se
 * zdroj dal zúžit (`sourceHolds` v `site/deps.js`), a sedm stránek navíc nic
 * nestojí.
 */
const legalPage = (route: string, title: string) =>
    definePage({ route, title, sources: { pravni: { type: 'pravniDokument' } } })

const legalPages: ReturnType<typeof definePage>[] = [
    legalPage('/cz/smluvni-podminky', 'Obchodní podmínky'),
    /*
     * Konkrétní znění obchodních podmínek (`/cz/smluvni-podminky/2026-10-15`) —
     * archiv pro objednávky uzavřené podle staršího znění. Jediný dokument,
     * který stránku po verzích má (`VERSIONED_SLUGS` v `LegalPage`).
     */
    definePage({
        route: '/cz/smluvni-podminky/[version]',
        title: 'Obchodní podmínky — znění',
        sources: { pravni: { type: 'pravniDokument' } },
        paths: {
            pravni: (body: Record<string, unknown>) =>
                body?.dokument === 'obchodni-podminky' &&
                typeof body?.platnost === 'string' &&
                /^\d{4}-\d{2}-\d{2}$/.test(body.platnost)
                    ? `/cz/smluvni-podminky/${body.platnost}`
                    : null,
        },
    }),
    legalPage('/cz/reklamacni-rad', 'Reklamační řád'),
    legalPage('/cz/reklamacni-protokol', 'Reklamační protokol'),
    legalPage('/cz/odstoupeni-od-smlouvy', 'Odstoupení od smlouvy'),
    legalPage('/cz/ochrana-osobnich-udaju', 'Ochrana osobních údajů'),
    legalPage('/cz/cookies', 'Používání cookies'),
    legalPage('/cz/doprava-a-platba', 'Doprava a platba'),
]

/* ------------------------------------------------------------- povrchy -- */
/*
 * Texty, na které v „Upravit kontent" nejde kliknout (od 15. 10. 2026).
 *
 * Klikací úprava hledá prvek podle polohy na stránce. Co je zavřené (okno,
 * panel v menu), co se ukáže jen v určitém stavu (výsledek platby, stránka
 * z e-mailu, prázdný katalog), co potřebuje košík nebo přihlášení (pokladna,
 * účet) a co na stránce vidět není vůbec (SEO), tak na stránce najít nejde.
 * Studio to nabízí ve dvou záložkách vedle „Stránek" — v obou formulář se
 * VŠEMI texty bloku, i těmi, které na stránce v daném stavu nejsou (věty po
 * odeslání, vzory polí, stavy plateb…):
 *
 * - **Modály** — okna a panely. Když je okno na stránce, která je zrovna
 *   v rámu, otevře se pod formulářem samo (`useStudioSurface` v komponentě,
 *   výběr uzavírá `surfaceRoot`), ať je vidět, o čem formulář je. Rezervace
 *   kurzu je jen na Kurzech, ostatní okna na každé stránce.
 * - **Seznamy** — stavy, kroky nákupu, účet, stránky z e-mailu, SEO.
 *
 * Formulář ukládá KONCEPT. Publikuje se v Obsahu (Texty na webu → blok →
 * Publikovat, nebo Přehled → Naposledy upraveno): tlačítko Publikovat
 * v „Upravit kontent" bere jen bloky, které jsou vidět na stránce v rámu,
 * a zavřené okno ani stav tam nejsou (ValeCMS 0.1.52, nahlášeno autorovi).
 * Texty otevřeného okna jdou upravit i klikáním: Náhled → otevřít okno na
 * stránce (Kontakt, lupa, košík, „Vybrat termín") → Náhled vypnout → klik
 * na text; takové úpravy Publikovat nahoře najde.
 *
 * Povrchy schválně NEMAJÍ `preview` (stránku, na kterou Studio rám přepne):
 * ve Studiu pod App Routerem změna `?p=` přemountuje celé Studio (segment
 * stránky je klíčovaný parametry adresy), takže výběr povrchu by po přepnutí
 * rámu zmizel a záložka spadla na „Stránky". Změřeno 15. 10. 2026, nahlášeno.
 *
 * `name` je smlouva s komponentou (`useStudioSurface('kontaktni-okno')`),
 * `copy` je `key` bloku. Pořadí je pořadí ve Studiu.
 */
const modal = (name: string, title: string, copy: string) =>
    defineSurface({ name, title, copy, kind: 'modal' })
const form = (name: string, title: string, copy: string) =>
    defineSurface({ name, title, copy, kind: 'list' })

const surfaces = [
    // Modály — okno se pod formulářem otevře samo, je-li na stránce v rámu.
    modal('kontaktni-okno', 'Kontaktní okno', 'global.kontaktni-okno'),
    modal('rezervace-okno', 'Rezervace kurzu — okno (na stránce Kurzy)', 'kurzy.rezervace-okno'),
    modal('kosik-panel', 'Košík v menu a doprava zdarma', 'global.kosik'),
    modal('hledani', 'Hledání v menu', 'global.hledani'),

    // Seznamy.
    // Nákup — od košíku po poděkování (bez košíku nebo objednávky nejsou vidět).
    form('kosik.uvod', 'Košík — úvod, když v něm něco je', 'kosik.uvod'),
    form('kosik.vypis', 'Košík — výpis a souhrn', 'kosik.vypis'),
    form('kosik.prihlaseni', 'Košík — výzva k přihlášení', 'kosik.prihlaseni'),
    form('pokladna.uvod', 'Pokladna — hlavička', 'pokladna.uvod'),
    form('pokladna.souhrn', 'Pokladna — souhrn objednávky', 'pokladna.souhrn'),
    form('pokladna.kroky', 'Pokladna — úvodní věty kroků', 'pokladna.kroky'),
    form('platba.zrusena', 'Platba — nezaplaceno (zrušená platba)', 'kosik.platba-zrusena'),
    form('platba.potvrzena', 'Platba — dokončujeme objednávku', 'kosik.platba-potvrzena'),
    form('platba.ceka', 'Platba — čekáme na banku', 'kosik.platba-ceka'),
    form('objednavka.hotova', 'Objednávka — poděkování', 'kosik.objednavka-hotova'),
    form('objednavka.pomoc', 'Objednávka — okénko „Potřebujete pomoct?"', 'kosik.objednavka-pomoc'),
    form('rychly-nakup.uvod', 'Rychlý nákup — úvod', 'kosik.rychly-nakup'),
    form('rychly-nakup.vysledek', 'Rychlý nákup — výsledek platby', 'kosik.rychly-vysledek'),
    // Účet — bez přihlášení je vidět jen přihlašovací formulář.
    form('ucet.formular', 'Účet — přihlášení a registrace', 'ucet.formular'),
    form('ucet.hero', 'Účet — nadpis a fotka vedle formuláře', 'global.prihlaseni'),
    form('ucet.prehled', 'Účet — přehled po přihlášení', 'ucet.prehled'),
    form('ucet.objednavky', 'Účet — seznam objednávek', 'ucet.objednavky'),
    // Stavy a stránky, kam se chodí z e-mailu nebo omylem.
    form('produkt', 'Stránka výrobku — společné texty', 'global.produkt'),
    form('obchod.katalog', 'Obchod — filtry, prázdný výsledek a chyba', 'obchod.katalog'),
    form('newsletter.stavy', 'Odběr novinek — stránky z odkazů v e-mailu', 'newsletter.stavy'),
    form('newsletter.paticka', 'Newsletter v patičce — po odeslání', 'global.newsletter'),
    form('kurzy.rezervace-stavy', 'Rezervace kurzu — stránka z e-mailu', 'kurzy.rezervace-stavy'),
    form('nenalezeno', 'Stránka nenalezena (404)', 'global.nenalezeno'),
    // SEO — titulek a popis pro vyhledávače; na stránce vidět nejsou.
    form('seo.index', 'SEO — Úvodní stránka', 'index.seo'),
    form('seo.kurzy', 'SEO — Kurzy', 'kurzy.seo'),
    form('seo.o-mne', 'SEO — O mně', 'o-mne.seo'),
    form('seo.vyroba', 'SEO — Výroba', 'vyroba.seo'),
    form('seo.dotazy', 'SEO — Dotazy', 'dotazy.seo'),
    form('seo.obchod', 'SEO — Obchod', 'obchod.seo'),
]

export default defineSite({
    pages: [homepage, kurzy, oMne, vyroba, dotazy, ...textPages, ...legalPages],
    surfaces,
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
     * ZÁKAZNICKÉ e-maily posílá Medusa; CMS posílá jen ty svoje.
     *
     * Backend má vlastní resend modul a šablony: potvrzení objednávky,
     * rezervace kurzu, připomínka tři dny předem, zrušený termín, vrácení
     * peněz. To zůstává — pošta CMS k zákazníkovi nikdy nemluví. Posílá
     * pozvánky do Studia (přístup + heslo pro Luciu a redakci) a hlášení
     * o publikovaných změnách správci; s `mail: false` se pozvánky tvářily,
     * že odešly „jinou cestou", a reálně nechodily vůbec. Odesílatele čte
     * z CMS_MAIL_FROM + RESEND_API_KEY v .env.local — stejná ověřená doména
     * jako Medusa, jiný obsah i příjemci.
     */
    mail: true,
    // Co `_app` vykresluje pod každou routou — patička, kontakt. Publikace
    // takového bloku sáhne na každou stránku, a proto se to říká tady nahlas.
    //
    // Bloky: `global.kontakt` (kontakt), `global.mapa` (mapa),
    // `global.news-popup` (newsPopup).
    //
    // Přibylo s texty z kódu (docs/cms/00-plan.md, E):
    // `global.kontaktni-okno` (kontaktní okno — položky klíčované popiskem:
    // hlavička, nadpis, témata `tema.*`, věty po odeslání se zástupcem
    // `{email}`; souhlas pod formulářem zůstává v kódu; nový klíč, protože
    // `global.kontakt` je osiřelý blok ze Sanity s jinými texty),
    // `global.nenalezeno` (stránka 404: `title`, `body`, položky `odkaz.domu`
    // a `odkaz.obchod` — z košíku), `global.produkt` (společné texty stránek
    // výrobku: `doprava.*`, `galerie.*`, `vyprodano.*` se zástupcem `{kus}`,
    // `dalsi.*` — viz poznámka u `textPages`), `global.paticka-odkazy`
    // (patička: názvy skupin `skupina.*`, nadpis `stazeni` / `stazeni.pdf`,
    // věta za rokem `copyright` — vlastní blok, protože `items` bloku
    // `global.paticka` čte údaje obchodníka pozicí).
    //
    // Druhé kolo (položky klíčované popiskem, k dosavadním přibyly — staré
    // popisky beze změny):
    // `global.produkt` + nákup `nakup.vyber`, `nakup.pridat`, `nakup.pridavame`,
    // `nakup.pridano`, `nakup.v-kosiku`, `nakup.balne`; volba `volba.stitek`,
    // `volba.provedeni`; značky pod nákupem `znacky.baleni`, `znacky.rucne`,
    // `znacky.atelier`; recenze `recenze.oboci`, `recenze.nadpis` (konec
    // v `note`), `recenze.text`, `recenze.prihlaseni` (text o ověřování
    // recenzí zůstává v kódu; stav „Na objednávku / Skladem…", dobírka, režim
    // úpravy objednávky a zakázka taky),
    // `global.kontaktni-okno` + popisky a vzory polí `pole.jmeno`,
    // `pole.jmeno.vzor`, `pole.email`, `pole.email.vzor`, `pole.telefon`,
    // `pole.telefon.vzor`, `pole.zprava`, `pole.zprava.vzor`, tlačítko
    // `odeslat`, nápověda `posunout` („(povinné)" u polí drží kód — říká, co
    // formulář vyžaduje),
    // `global.newsletter` + položky `odeslano` a `chyba` (věty pod formulářem
    // v patičce; `accent` toho bloku zůstává poziční, jak ho čte patička),
    // `global.kosik` (košík napříč webem: panel v menu `panel.*`, doprava
    // zdarma `doprava.*` — částky počítá kód —, výzva k propojení košíku
    // s účtem `propojeni.*`),
    // `global.hledani` (hledání v menu: `prochazet`, `nic`, `prazdne`,
    // `prazdne.tlacitko`).
    globals: defineGlobals({ copy: 'global', sources: {} }),
})
