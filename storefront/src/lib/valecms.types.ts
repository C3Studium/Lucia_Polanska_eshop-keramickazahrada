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
 * Dokumenty ke stažení.
 *
 * Formuláře, které si zákazník tiskne a posílá zpátky — reklamační protokol,
 * odstoupení od smlouvy — a cokoliv dalšího, co má viset u právního textu
 * jako soubor.
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
    fields: [
        defineField({
            name: 'nazev',
            title: 'Název',
            type: 'string',
            description: 'Co si návštěvník stáhne — např. „Reklamační protokol (PDF)".',
            validation: (rule) => rule.required().max(120),
        }),
        defineField({
            name: 'stranka',
            title: 'Stránka',
            type: 'select',
            description: 'U kterého dokumentu se odkaz vypíše.',
            options: {
                list: [
                    { title: 'Reklamační protokol', value: 'reklamacni-protokol' },
                    { title: 'Odstoupení od smlouvy', value: 'odstoupeni-od-smlouvy' },
                    { title: 'Obchodní podmínky', value: 'smluvni-podminky' },
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

export const types = [siteCopy, review, tlacitko, soubor, qnaKategorie, qna, clanek]

// Typ, o kterém se píšou recenze (např. 'consultant'), nebo null.
export const reviewSubjectType = null
