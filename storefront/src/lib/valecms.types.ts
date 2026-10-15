// Typy obsahu, které tenhle web má.
//
// Typ je jméno, titulek a pole. Studio z toho staví editor, server proti tomu
// validuje a web přes to čte — takže pole, které tu není, neexistuje nikde.
//
// Dva typy si veze knihovna a jsou tu proto převzaté, ne deklarované znovu:
//
//   siteCopy  bloky textu na stránkách. Na něm stojí `copy: 'index'`
//             v konfiguraci — stránka tím říká "všechny bloky s page: 'index'".
//   review    recenze i s moderací a hlasy.
//
// Deklarovat vlastní typ stejného jména není přejmenování, ale kolize: registr
// je odmítne, protože `cms_document.type` je v databázi holý řetězec a dvě
// deklarace téhož jména by od sebe nešly rozeznat.
//
// Vlastní typy musí projít přes `defineType` a `defineField`. Holý objekt se
// stejnými klíči vypadá stejně a projde i čtením, ale zápis na něm spadne:
// pole si nese chování (viditelnost, práva, validaci), ne jen data.
import { defineField, defineType } from '@c3studium/valecms/core'
import siteCopy from '@c3studium/valecms/schemas/siteCopy.js'
import review from '@c3studium/valecms/schemas/review.js'
// S příponou a atributem, ne `./legal/registry`: tenhle soubor čtou i Node
// skripty (`--import @c3studium/valecms/register.mjs`) a relativní import bez
// přípony by tam neprošel. JSON s `with { type: 'json' }` Node načte sám.
import pdfManifest from './legal/pdf-manifest.json' with { type: 'json' }

/**
 * Tlačítka na webu.
 *
 * Vlastní typ, a ne pole v `siteCopy`, ze dvou důvodů. `siteCopy` má
 * `key page title headline accent body image gallery items` a nic z toho není
 * odkaz — `value` v položkách by adresu unesl, ale v editoru by se u ní psalo
 * „Hodnota / obsah" a za rok by nikdo nevěděl, proč. A tlačítko není text
 * stránky: tentýž „Prohlédnout výrobky" stojí na úvodní stránce, u kurzů,
 * v „O mně" i ve „Výrobě", takže patří jednomu záznamu, ne pěti blokům.
 *
 * ## Klíč
 *
 * `klic` je smlouva s kódem — komponenta si tlačítko vyzvedne podle něj
 * (`index.hero`, `footer.facebook`). Přejmenovat ho znamená přepsat i
 * komponentu; proto se nevymýšlí za běhu a proto je povinný.
 *
 * ## Proč je `href` nepovinný
 *
 * Tlačítka, která vedou dovnitř webu, si cíl drží v kódu: `/store` je routa
 * téhle aplikace a mění se s ní, ne s obsahem. Editovat se u nich má název,
 * nic víc — a o tom nerozhoduje schéma, ale anotace v komponentě:
 * `editable(t, 'label')` otevře textové pole, `editableLink(t, …)` popup
 * s názvem i adresou. Jedno pole, dvě chování, přesně podle toho, kam
 * tlačítko vede.
 */
const tlacitko = defineType({
    name: 'tlacitko',
    title: 'Tlačítka',
    fields: [
        defineField({
            name: 'klic',
            title: 'Klíč',
            type: 'string',
            description: 'Které tlačítko to je — např. index.hero. Mění se jen spolu s kódem.',
            validation: (rule) => rule.required().max(60),
        }),
        defineField({
            name: 'label',
            title: 'Název',
            type: 'string',
            description: 'Co je na tlačítku napsané.',
            validation: (rule) => rule.required().max(60),
        }),
        defineField({
            name: 'href',
            title: 'Odkaz',
            type: 'url',
            description:
                'Jen u tlačítek, která vedou mimo web (Facebook, Instagram). ' +
                'U odkazů uvnitř webu zůstává prázdné — cíl drží kód.',
        }),
    ],
})

/**
 * Další soubory ke stažení.
 *
 * Soubory, které mají viset u právního textu nebo v patičce — návod na péči
 * o keramiku, ceník kurzů, mapa příjezdu. NE oficiální PDF právních
 * dokumentů: ta generuje `pnpm legal:build` přímo ze znění (typ „Právní
 * dokumenty") a stránka je nabízí sama. Dřív se sem nahrávalo PDF obchodních
 * podmínek ručně a s textem se neaktualizovalo — stránka pak vedle nového
 * znění nabízela staré. Proto se tyhle soubory vypisují ZVLÁŠŤ, pod nadpisem
 * „Další soubory ke stažení", a popis pole to říká nahlas.
 *
 * ## Proč vlastní typ
 *
 * `siteCopy` pole pro soubor nemá; nejblíž je `image`, a PDF není obrázek.
 * Knihovna médií přitom `application/pdf` bere (viz `ALLOWED_MIME` v
 * `server/media.js`), takže soubor má kam. Chybělo jen místo, odkud si na
 * něj web ukáže.
 *
 * ## Klíč a stránka
 *
 * `stranka` říká, u kterého dokumentu se odkaz vypíše — stejná slova jako
 * `page` u `siteCopy`, aby se to hledalo na jednom místě. `poradi` drží
 * pořadí v seznamu; bez něj by se soubory řadily podle vzniku, což je
 * pořadí, kterému nikdo nerozumí.
 */
const soubor = defineType({
    name: 'soubor',
    title: 'Soubory ke stažení',
    description:
        'Další soubory k právním stránkám a do patičky (návod, ceník…). Oficiální PDF obchodních ' +
        'podmínek, reklamačního řádu a dalších dokumentů se vytváří samo ze znění v „Právních dokumentech" — ' +
        'sem je nenahrávejte, na webu by se ukázalo staré PDF vedle nového znění.',
    fields: [
        defineField({
            name: 'nazev',
            title: 'Název',
            type: 'string',
            description: 'Co si návštěvník stáhne — např. „Péče o keramiku na zahradě (PDF)".',
            validation: (rule) => rule.required().max(120),
        }),
        defineField({
            name: 'stranka',
            title: 'Kde se nabízí',
            type: 'select',
            description:
                'Na stránce dokumentu se soubor vypíše pod nadpisem „Další soubory ke stažení", ' +
                'odděleně od oficiálního PDF dokumentu. „Patička webu" = skupina „Ke stažení" dole na každé stránce.',
            options: {
                list: [
                    { title: 'Patička webu', value: 'paticka' },
                    { title: 'Obchodní podmínky', value: 'smluvni-podminky' },
                    { title: 'Reklamační řád', value: 'reklamacni-rad' },
                    { title: 'Reklamační protokol', value: 'reklamacni-protokol' },
                    { title: 'Odstoupení od smlouvy', value: 'odstoupeni-od-smlouvy' },
                    { title: 'Ochrana osobních údajů', value: 'ochrana-osobnich-udaju' },
                    { title: 'Doprava a platba', value: 'doprava-a-platba' },
                    { title: 'Používání cookies', value: 'cookies' },
                ],
            },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'popis',
            title: 'Popis',
            type: 'text',
            description: 'Jedna věta pod odkazem. Nepovinné.',
        }),
        defineField({
            name: 'soubor',
            title: 'Soubor',
            type: 'file',
            description: 'PDF nebo obrázek z knihovny médií.',
            options: { accept: 'application/pdf,image/*' },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'poradi',
            title: 'Pořadí',
            type: 'number',
            description: 'Menší číslo je výš. Bez něj se řadí podle názvu.',
        }),
    ],
})

/**
 * Dotazy — jedna otázka = jeden dokument.
 *
 * ## Proč vlastní typ, a ne pole v `siteCopy`
 *
 * Otázky nejdřív žily jako pole `questions` v blocích textů. To dává jeden
 * formulář na celou skupinu — jenže redaktor pracuje s otázkou: v obsahu chce
 * seznam otázek podle názvu, rozkliknout jednu a dostat popup s názvem i
 * odpovědí, a stejný popup chce i v „upravit kontent" po kliknutí na otázku
 * na stránce (`editableDoc` umí otevřít formulář typu právě jen nad celým
 * dokumentem). Jednotka práce je otázka, tak je otázka dokument.
 *
 * ## Kategorie
 *
 * `kategorie` je jméno kategorie, ke které se otázka hlásí — kategorie se
 * zakládají a řadí ve vlastní sekci (typ `qnaKategorie` níž). Jméno, které
 * žádné kategorii nepatří, čip stejně vytvoří, aby otázka nezmizela; jen
 * stojí za těmi seřazenými.
 */
/**
 * Kategorie dotazů — zakládají se tady, otázky se k nim hlásí jménem.
 *
 * Vlastní dokumenty, aby kategorie šla založit, přejmenovat a seřadit dřív,
 * než má první otázku — a aby čip ve filtru nevznikal překlepem. Otázka se ke
 * kategorii hlásí polem `kategorie` (stejné jméno); Studio zatím neumí
 * vnořený strom ani select z cizích dokumentů, takže vazba je jménem — viz
 * CMSTODO.
 */
const qnaKategorie = defineType({
    name: 'qnaKategorie',
    title: 'Kategorie dotazů',
    fields: [
        defineField({
            name: 'nazev',
            title: 'Název',
            type: 'string',
            description: 'Jméno čipu ve filtru. Otázka se hlásí přesně tímhle jménem.',
            validation: (rule) => rule.required().max(60),
        }),
        defineField({
            name: 'poradi',
            title: 'Pořadí',
            type: 'number',
            description: 'Menší číslo je víc vlevo.',
        }),
    ],
    preview: (doc: Record<string, unknown>) => ({
        title: (doc?.nazev as string) || 'Bez názvu',
        subtitle: '',
    }),
    orderings: [
        {
            name: 'poradi',
            title: 'Podle pořadí',
            by: [{ field: 'poradi', direction: 'asc' as const }],
        },
    ],
})

const qna = defineType({
    name: 'qna',
    title: 'Dotazy',
    fields: [
        defineField({
            name: 'question',
            title: 'Otázka',
            type: 'string',
            description: 'Jak se zákazník ptá — celou větou, s otazníkem.',
            validation: (rule) => rule.required().max(200),
        }),
        defineField({
            name: 'answer',
            title: 'Odpověď',
            type: 'text',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'kategorie',
            title: 'Kategorie',
            type: 'string',
            description:
                'Jméno kategorie ze sekce Kategorie dotazů, slovo od slova. ' +
                'Prázdné = otázka jen pod „Vše".',
            validation: (rule) => rule.max(60),
        }),
        defineField({
            name: 'poradi',
            title: 'Pořadí',
            type: 'number',
            description:
                'Menší číslo je výš. Řadí otázky i čipy kategorií — čip stojí ' +
                'tam, kde jeho první otázka.',
        }),
    ],
    // V seznamu se dokument jmenuje otázkou a podtitulkem je kategorie.
    preview: (doc: Record<string, unknown>) => ({
        title: (doc?.question as string) || 'Bez otázky',
        subtitle: (doc?.kategorie as string) || '—',
    }),
    orderings: [
        {
            name: 'poradi',
            title: 'Podle pořadí',
            by: [{ field: 'poradi', direction: 'asc' as const }],
        },
    ],
})

/* ----------------------------------------------------- právní dokumenty -- */

/**
 * Právní dokumenty — jedno znění (verze) = jeden dokument.
 *
 * Obchodní podmínky, reklamační řád a protokol, odstoupení, ochrana osobních
 * údajů, cookies a doprava a platba. Web je čte přes registr
 * (`src/lib/legal/registry.ts` + `@lib/data/legal-registry`) a převod mezi
 * tímhle tvarem a tvarem registru je v `src/lib/legal/cms.ts` — tamtéž se
 * hlídá, že je bezeztrátový (`scripts/legal-cms-roundtrip.test.mjs`).
 *
 * ## Verze = datum platnosti
 *
 * `platnost` je klíč verze: ukládá se k objednávce (`terms_version`), je
 * v názvu PDF i v adrese archivního znění (`/smluvni-podminky/2026-10-15`).
 * Nové znění se proto nepíše přes staré, ale jako nový dokument s pozdějším
 * datem — staré dál platí pro objednávky, které se podle něj uzavřely.
 *
 * ## Vydané znění je zamčené
 *
 * Jakmile má verze PDF zveřejněné v úložišti (`pdf-manifest.json`, https
 * adresa — zapíše ji `pnpm legal:upload`), web ji bere jen z otisku v repu
 * a catch-all routa CMS (`app/api/cms/[...route]`, `lib/legal/cms-guard.ts`)
 * odmítne její úpravu, smazání i stažení. Tady se to jen ukazuje: náhled
 * v seznamu říká „Vydané (PDF) — uzamčeno" a pole jsou jen pro čtení.
 * `readOnly` je jen pro oko — rozhoduje server.
 *
 * ## Proč rámeček nemá tabulku a nejde zanořit
 *
 * `defineField` skládá pole hned při deklaraci, takže schéma nemůže odkazovat
 * samo na sebe — rámeček je proto o úroveň mělčí než kapitola a smí v něm být
 * odstavec a seznam (víc dnešní dokumenty nepotřebují; převod `cms.ts`
 * odmítne jiné nahlas).
 */

/** Dokumenty, které registr zná — stejné klíče jako `LEGAL_PATHS` (`lib/legal/registry.ts`, hlídá test). */
const PRAVNI_DOKUMENTY = [
    { title: 'Obchodní podmínky', value: 'obchodni-podminky' },
    { title: 'Reklamační řád', value: 'reklamacni-rad' },
    { title: 'Reklamační protokol', value: 'reklamacni-protokol' },
    { title: 'Odstoupení od smlouvy', value: 'odstoupeni-od-smlouvy' },
    { title: 'Ochrana osobních údajů', value: 'ochrana-osobnich-udaju' },
    { title: 'Používání cookies', value: 'cookies' },
    { title: 'Doprava a platba', value: 'doprava-a-platba' },
]

/**
 * Údaje `{{…}}`, které jde do textu vložit — klíče a popisky jako v
 * `lib/legal/facts.ts` (test hlídá, že tu žádný nechybí). Hodnoty se vyplňují
 * v administraci obchodu („Právní údaje"), ne tady.
 */
const PRAVNI_UDAJE = [
    ['seller.name', 'jméno prodávající'],
    ['seller.address', 'adresa sídla'],
    ['seller.ico', 'IČO'],
    ['seller.email', 'e-mail'],
    ['seller.phone', 'telefon'],
    ['seller.web', 'doména obchodu'],
    ['seller.webUrl', 'adresa obchodu (https://…)'],
    ['bank.account', 'číslo účtu'],
    ['vat.status', 'plátce DPH ano/ne'],
    ['mto.deposit', 'výše zálohy u zakázky'],
    ['course.cancellation', 'storno podmínky kurzů'],
    ['course.minAge', 'minimální věk dítěte na kurzu'],
    ['course.pickupDeadline', 'do kdy vyzvednout výrobek z kurzu'],
    ['voucher.validity', 'platnost dárkového poukazu'],
    ['voucher.remainder', 'co se stane se zůstatkem poukazu'],
    ['privacy.newsletterTool', 'nástroj na rozesílku newsletteru'],
    ['privacy.hosting', 'hosting a jeho sídlo'],
    ['withdrawal.returnCostEstimate', 'odhad nákladů na vrácení zboží poštou'],
    ['delivery.dispatchTime', 'dodací lhůta zboží skladem'],
] as const

const ZNACKA_KRATCE = 'Značky: **tučně**, [text odkazu](/cesta#kotva), {{údaj}}, [[DOPLNIT: co chybí]] — celá nápověda je u „Kapitoly".'

const ZNACKA =
    'Jak psát text: **tučně** · [text odkazu](/smluvni-podminky#odstoupeni) — odkaz na stránku webu bez /cz, ' +
    'nebo celá adresa https://…, mailto:…, tel:… · {{údaj}} dosadí údaj z administrace obchodu („Právní údaje"), ' +
    'takže ho nepište ručně · [[DOPLNIT: co chybí]] zvýrazní žlutě údaj, který ještě nemáme — znění s ním se nesmí ' +
    'vydat. Údaje: ' +
    PRAVNI_UDAJE.map(([key, label]) => `{{${key}}} ${label}`).join(', ') +
    '.'

/*
 * Rychlá kontrola značky přímo ve formuláři (chyba se ukáže u pole hned).
 *
 * Jen to nejčastější — překlep v `{{údaji}}`, neuzavřené `{{`, `[[` a lichý
 * počet `**`. Úplnou kontrolu (kotvy, prázdné bloky, odkazy) dělá převod
 * `src/lib/legal/cms.ts` při publikaci a zámek publikaci s chybou odmítne;
 * tady by byla druhá kopie téhož. Sem se nesmí importovat `lib/legal`
 * (Node skripty čtou tenhle soubor bez bundleru), proto vlastní krátká verze.
 */
const ZNAME_UDAJE = new Set<string>(PRAVNI_UDAJE.map(([key]) => key))

const znackaChyba = (value: unknown): string | true => {
    if (typeof value !== 'string' || !value) return true
    const udaj = /\{\{([^}]*)\}\}/g
    let shoda: RegExpExecArray | null
    while ((shoda = udaj.exec(value)) !== null) {
        if (!ZNAME_UDAJE.has(shoda[1])) {
            return `Neznámý údaj {{${shoda[1]}}} — seznam údajů je v nápovědě u „Kapitoly“.`
        }
    }
    const bezUdaju = value.replace(/\{\{([^}]*)\}\}/g, '')
    if (bezUdaju.indexOf('{{') !== -1 || bezUdaju.indexOf('}}') !== -1) {
        return 'Neuzavřený údaj „{{“ / „}}“ — údaj se píše {{seller.email}}.'
    }
    if (/\[\[DOPLNIT:\s*\]\]/.test(value)) return 'Prázdné [[DOPLNIT: ]] — napište, co chybí.'
    if (value.replace(/\[\[DOPLNIT:[^\]]*\]\]/g, '').indexOf('[[') !== -1) {
        return 'Neuzavřené nebo nepovolené „[[“ — zástupný text se píše [[DOPLNIT: co chybí]].'
    }
    if ((value.split('**').length - 1) % 2 !== 0) return 'Lichý počet „**“ — tučné písmo se píše **takhle**.'
    return true
}

/** Klíče verzí, jejichž PDF je zveřejněné (https) — totéž pravidlo jako `isPublishedPdfUrl`. */
const VYDANE = new Set(
    ((pdfManifest as { entries?: { slug: string; version: string; url: string }[] }).entries ?? [])
        .filter((entry) => /^https:\/\//.test(entry.url))
        .map((entry) => `${entry.slug}@${entry.version}`)
)

const jeVydane = (doc: Record<string, unknown> | undefined) =>
    VYDANE.has(`${String(doc?.dokument ?? '')}@${String(doc?.platnost ?? '')}`)

/** Dnešek v Praze `YYYY-MM-DD` — jako `pragueToday()` v registru. */
const dnesVPraze = () =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Prague',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date())

const datumCesky = (value: unknown) => {
    const [y, m, d] = String(value ?? '').split('-').map(Number)
    return y && m && d ? `${d}. ${m}. ${y}` : ''
}

/**
 * Textová položka seznamu (`of`). Holý objekt, ne `defineField`: seznam si
 * člena normalizuje sám a označí ho jako položku (prázdná položka pak hlásí
 * chybu, místo aby prošla).
 */
type ZnackaPravidlo = { custom(test: (value: unknown) => string | true): unknown }
type DelkaPravidlo = {
    required(): { max(n: number): ZnackaPravidlo }
    max(n: number): ZnackaPravidlo
}
const textovaPolozka = (type: 'string' | 'text', max: number, povinna: boolean) => ({
    type,
    ...(type === 'text' ? { options: { rows: 2 } } : {}),
    validation: (rule: DelkaPravidlo) =>
        (povinna ? rule.required().max(max) : rule.max(max)).custom(znackaChyba),
})

// Bloky se skládají funkcí, ne sdíleným objektem: tentýž blok stojí v kapitole
// i v rámečku a každé místo potřebuje vlastní deklaraci (`defineField` je
// zmrazí a označí jako člen seznamu).
const odstavecBlok = () => ({
    type: 'object',
    name: 'odstavec',
    title: 'Odstavec',
    fields: [
        defineField({
            name: 'text',
            title: 'Text',
            type: 'text',
            options: { rows: 5 },
            description: ZNACKA_KRATCE,
            validation: (rule) => rule.required().max(6000).custom(znackaChyba),
        }),
    ],
})

const seznamBlok = () => ({
    type: 'object',
    name: 'seznam',
    title: 'Seznam',
    fields: [
        defineField({
            name: 'cislovany',
            title: 'Číslovaný',
            type: 'boolean',
            description: 'Zapnuto = 1., 2., 3. Vypnuto = odrážky.',
            initialValue: false,
        }),
        defineField({
            name: 'polozky',
            title: 'Položky',
            type: 'array',
            of: [textovaPolozka('text', 3000, true)],
            description: ZNACKA_KRATCE,
            validation: (rule) => rule.required().min(1),
        }),
    ],
})

const tabulkaBlok = () => ({
    type: 'object',
    name: 'tabulka',
    title: 'Tabulka',
    fields: [
        defineField({
            name: 'popisek',
            title: 'Popisek',
            type: 'string',
            description: 'Nepovinné — nad tabulkou, čtou ho i odečítače obrazovky.',
            validation: (rule) => rule.max(300).custom(znackaChyba),
        }),
        defineField({
            name: 'hlavicka',
            title: 'Záhlaví sloupců',
            type: 'array',
            of: [textovaPolozka('string', 300, true)],
            validation: (rule) => rule.required().min(1),
        }),
        defineField({
            name: 'radky',
            title: 'Řádky',
            type: 'array',
            description: 'Každý řádek má mít tolik buněk, kolik je sloupců v záhlaví.',
            of: [
                {
                    type: 'object',
                    name: 'radek',
                    title: 'Řádek',
                    fields: [
                        defineField({
                            name: 'bunky',
                            title: 'Buňky',
                            type: 'array',
                            of: [textovaPolozka('text', 3000, false)],
                            validation: (rule) => rule.required().min(1),
                        }),
                    ],
                },
            ],
            validation: (rule) =>
                rule.required().min(1).custom((radky: unknown, ctx: { parent?: { hlavicka?: unknown } }) => {
                    const hlavicka = ctx?.parent?.hlavicka
                    const sloupcu = Array.isArray(hlavicka) ? hlavicka.length : 0
                    const spatne = (Array.isArray(radky) ? radky : []).findIndex((radek: { bunky?: unknown } | null) => {
                        const bunky = radek?.bunky
                        return Array.isArray(bunky) && bunky.length !== sloupcu
                    })
                    return spatne === -1 || `Řádek ${spatne + 1} nemá ${sloupcu} buněk jako záhlaví.`
                }),
        }),
    ],
})

const ramecekBlok = () => ({
    type: 'object',
    name: 'ramecek',
    title: 'Rámeček',
    fields: [
        defineField({
            name: 'nadpis',
            title: 'Nadpis rámečku',
            type: 'string',
            description: 'Nepovinné. Rámeček zvýrazní důležité upozornění nebo vzorové poučení.',
            validation: (rule) => rule.max(300).custom(znackaChyba),
        }),
        defineField({
            name: 'bloky',
            title: 'Obsah rámečku',
            type: 'array',
            of: [odstavecBlok(), seznamBlok()],
            validation: (rule) => rule.required().min(1),
        }),
    ],
})

const formularBlok = () => ({
    type: 'object',
    name: 'formular',
    title: 'Formulář k vyplnění',
    fields: [
        defineField({
            name: 'nadpis',
            title: 'Nadpis formuláře',
            type: 'string',
            validation: (rule) => rule.max(300).custom(znackaChyba),
        }),
        defineField({
            name: 'pole',
            title: 'Řádky formuláře',
            type: 'array',
            of: [
                {
                    type: 'object',
                    name: 'pole',
                    title: 'Řádek',
                    fields: [
                        defineField({
                            name: 'popisek',
                            title: 'Popisek',
                            type: 'string',
                            validation: (rule) => rule.required().max(300).custom(znackaChyba),
                        }),
                        defineField({
                            name: 'hodnota',
                            title: 'Předvyplněno',
                            type: 'text',
                            options: { rows: 2 },
                            description: 'Např. adresát. Prázdné = volné místo k ručnímu vyplnění po vytištění.',
                            validation: (rule) => rule.max(1000).custom(znackaChyba),
                        }),
                    ],
                },
            ],
            validation: (rule) => rule.required().min(1),
        }),
        defineField({
            name: 'poznamka',
            title: 'Poznámka pod formulářem',
            type: 'text',
            options: { rows: 2 },
            validation: (rule) => rule.max(2000).custom(znackaChyba),
        }),
    ],
})

const pravniDokument = defineType({
    name: 'pravniDokument',
    title: 'Právní dokumenty',
    icon: 'lock',
    description:
        'Obchodní podmínky, reklamační řád, odstoupení, ochrana osobních údajů, cookies, doprava. ' +
        'Jeden záznam = jedno znění s datem platnosti. Změna = nový záznam s pozdějším datem; vydané znění ' +
        '(se zveřejněným PDF) už upravit nejde. U „Používání cookies" se kapitola s kotvou seznam (tabulky ' +
        'cookies) na webu vždy doplní ze soupisu cookies v kódu — tabulky tam neupravujte.',
    fields: [
        defineField({
            name: 'dokument',
            title: 'Dokument',
            type: 'select',
            description: 'Který dokument to je. U znění, které už platí, se nemění.',
            options: { list: PRAVNI_DOKUMENTY, layout: 'dropdown' },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'platnost',
            title: 'Platí od',
            type: 'date',
            description:
                'Datum účinnosti — od kdy znění platí. Je to zároveň číslo verze: ukládá se k objednávkám, je v názvu ' +
                'PDF i v adrese archivního znění. Dnešní nebo budoucí datum, nikdy zpětně. Nové znění = nový záznam ' +
                's pozdějším datem, starý nechte být (platí pro objednávky uzavřené podle něj).',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'nazev',
            title: 'Název',
            type: 'string',
            description: 'Nadpis stránky a PDF, např. „Obchodní podmínky".',
            options: { readOnly: jeVydane },
            validation: (rule) => rule.required().max(200).custom(znackaChyba),
        }),
        defineField({
            name: 'uvod',
            title: 'Úvod',
            type: 'text',
            options: { rows: 3, readOnly: jeVydane },
            description: 'Jedna dvě věty pod nadpisem, lidsky. Nepovinné. ' + ZNACKA_KRATCE,
            validation: (rule) => rule.max(2000).custom(znackaChyba),
        }),
        defineField({
            name: 'kapitoly',
            title: 'Kapitoly',
            type: 'array',
            description: ZNACKA,
            options: { readOnly: jeVydane },
            of: [
                {
                    type: 'object',
                    name: 'kapitola',
                    title: 'Kapitola',
                    fields: [
                        defineField({
                            name: 'nadpis',
                            title: 'Nadpis kapitoly',
                            type: 'string',
                            description: 'Např. „V. Odstoupení od kupní smlouvy".',
                            validation: (rule) => rule.required().max(300).custom(znackaChyba),
                        }),
                        defineField({
                            name: 'kotva',
                            title: 'Kotva',
                            type: 'string',
                            description:
                                'Konec adresy kapitoly (/smluvni-podminky#kotva) — malá písmena bez diakritiky, číslice ' +
                                'a pomlčky, např. odstoupeni. Po vydání neměnit, odkazují na ni e-maily, pokladna a dotazy.',
                            validation: (rule) =>
                                rule
                                    .required()
                                    .max(80)
                                    .regex(
                                        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                                        'Jen malá písmena bez diakritiky, číslice a pomlčky — např. "vraceni-zbozi".'
                                    ),
                        }),
                        defineField({
                            name: 'bloky',
                            title: 'Obsah kapitoly',
                            type: 'array',
                            of: [odstavecBlok(), seznamBlok(), tabulkaBlok(), ramecekBlok(), formularBlok()],
                            validation: (rule) => rule.required().min(1),
                        }),
                    ],
                },
            ],
            validation: (rule) =>
                rule.required().min(1).custom((kapitoly: unknown) => {
                    const videno = new Set<string>()
                    for (const kapitola of Array.isArray(kapitoly) ? kapitoly : []) {
                        const kotva = String((kapitola as { kotva?: unknown } | null)?.kotva ?? '').trim()
                        if (!kotva) continue
                        if (videno.has(kotva)) return `Kotva „${kotva}" je v dokumentu dvakrát — každá kapitola potřebuje vlastní.`
                        videno.add(kotva)
                    }
                    return true
                }),
        }),
        defineField({
            name: 'pdf',
            title: 'PDF ke stažení',
            type: 'boolean',
            description:
                'Vytvořit z tohoto znění PDF ke stažení a do příloh e-mailů. PDF vzniká při vydání znění ' +
                '(pnpm legal:build a legal:upload); u cookies a dopravy vypnuto — stačí stránka.',
            initialValue: true,
            options: { readOnly: jeVydane },
        }),
        defineField({
            name: 'archivni',
            title: 'Archivní znění',
            type: 'boolean',
            description:
                'Zůstává na vlastní adrese kvůli objednávkám, které se podle něj uzavíraly, ale na hlavní stránce ' +
                'dokumentu ani v patičce se nenabízí.',
            initialValue: false,
            options: { readOnly: jeVydane },
        }),
        defineField({
            name: 'poznamka',
            title: 'Interní poznámka',
            type: 'text',
            options: { rows: 3 },
            description: 'Co se změnilo, kdo to schválil (advokát). Na webu ani v PDF se nezobrazuje.',
            validation: (rule) => rule.max(2000),
        }),
    ],
    preview: (doc: Record<string, unknown>) => {
        const dokument = PRAVNI_DOKUMENTY.find((item) => item.value === doc?.dokument)
        const nazev = String(doc?.nazev || dokument?.title || 'Právní dokument')
        const od = datumCesky(doc?.platnost)
        const stav = jeVydane(doc)
            ? 'Vydané (PDF) — uzamčeno'
            : String(doc?.platnost ?? '') > dnesVPraze()
              ? 'Připravované'
              : 'Pracovní znění'
        return {
            title: od ? `${nazev} — platné od ${od}` : nazev,
            subtitle: doc?.archivni === true ? `${stav} · archivní` : stav,
        }
    },
    orderings: [
        {
            name: 'dokument',
            title: 'Podle dokumentu a platnosti',
            by: [
                { field: 'dokument', direction: 'asc' as const },
                { field: 'platnost', direction: 'desc' as const },
            ],
        },
        {
            name: 'platnost',
            title: 'Podle data platnosti',
            by: [{ field: 'platnost', direction: 'desc' as const }],
        },
    ],
})

// Příklad vlastního typu — smaž ho nebo přepiš.
const clanek = defineType({
    name: 'clanek',
    title: 'Článek',
    fields: [
        defineField({
            name: 'title',
            title: 'Nadpis',
            type: 'string',
            validation: (rule) => rule.required().max(200),
        }),
        defineField({ name: 'perex', title: 'Perex', type: 'text' }),
    ],
})

export const types = [siteCopy, review, tlacitko, soubor, pravniDokument, qnaKategorie, qna, clanek]

// Typ, o kterém se píšou recenze (např. 'consultant'), nebo null.
export const reviewSubjectType = null
