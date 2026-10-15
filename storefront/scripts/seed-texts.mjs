// Ručně psané texty stránek do CMS.
//
// Spuštění:
//   node --import @c3studium/valecms/register.mjs scripts/seed-texts.mjs
//   node --import @c3studium/valecms/register.mjs scripts/seed-texts.mjs --write
//
// Texty, které dosud žily napevno v komponentách, se přenesou do bloků
// `siteCopy` — jednoho na sekci, s polem `page`, podle kterého je Studio
// v „Texty na webu" roztřídí po stránkách.
//
// ---------------------------------------------------------------------------
// Doplňuje, nepřepisuje
//
// Blok, který v CMS už je, se NEZAHODÍ. Doplní se do něj jen pole, která
// v něm ještě nejsou — tak, aby se dala do `global.prihlaseni` přidat slova
// vedle fotky, kterou tam založil `seed-galleries.mjs`, a přitom aby druhé
// spuštění nevrátilo text, který mezitím někdo ve Studiu změnil.
//
// Prázdné pole (`items: []`) se počítá jako „ještě tam není". Pole s obsahem
// je odpověď redaktora a to se nepřepisuje nikdy.
//
// Blok s rozpracovaným (nepublikovaným) konceptem se přeskočí celý —
// doplnění se publikuje, a s ním by na web odešly i Luciiny neuložené úpravy.
//
// ---------------------------------------------------------------------------
// Co zůstává v kódu
//
// Struktura, ne obsah. `id` a `category` u otázek filtrují seznam; `number`
// u kroků výroby drží pořadí, na kterém stojí scrollování. Kdyby šly měnit
// v CMS, rozpadlo by se chování stránky, ne jen její text.

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// Prostředí si skript musí načíst sám — neběží uvnitř Nextu. Bez toho spadne
// knihovna mlčky na vývojové úložiště `.cms-dev/` a běh vypadá úspěšně.
//
// Proměnná nastavená v prostředí vyhrává, i když je PRÁZDNÁ (`key in env`, ne
// `env[key]`). Jinak by `SUPABASE_SERVICE_ROLE_KEY=` — vědomé odpojení od
// ostrého CMS kvůli zkoušce nad souborovým úložištěm — tiše doplnil soubor
// `.env.local` a zápis by šel do produkce.
const loadEnv = (file) => {
    if (!fs.existsSync(file)) return
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
        if (!match) continue
        const [, key, raw] = match
        if (key in process.env) continue
        process.env[key] = raw.replace(/^["']|["']$/g, "")
    }
}
loadEnv(path.join(ROOT, ".env.local"))
loadEnv(path.join(ROOT, ".env"))

const WRITE = process.argv.includes("--write")
const log = (message) => console.log(message)

const read = (name) =>
    JSON.parse(fs.readFileSync(path.join(ROOT, "content", name), "utf8"))

const faq = read("faq.json")
const kroky = read("vyroba-kroky.json")
const auth = read("auth-portal.json")

/*
 * Právní dokumenty tu NEJSOU (od 15. 10. 2026).
 *
 * Dřív se sem zakládaly bloky `<stránka>.text` se zněním obchodních podmínek
 * a dalších dokumentů. Nic je nečte: právní dokumenty mají vlastní typ
 * `pravniDokument` a vlastní import (`scripts/seed-legal.mjs`), stránky
 * právních dokumentů ze seznamu stránek zmizely a vydané znění se bere
 * z otisku v repu. Blok, který by sem seed založil, by Lucie ve Studiu
 * upravovala — a na webu by se nezměnilo nic.
 */

/**
 * Bloky, které se mají v CMS objevit.
 *
 * `data` nese jen pole, která se doplňují — `key` a `page` k nim skript
 * přidá sám.
 */
const BLOCKS = [
    {
        /*
         * Krátké texty hera. Nadpis, podpis a fotka v tomhle bloku už jsou —
         * přišly migrací ze Sanity — a tenhle záznam je jen doplňuje o to, co
         * do CMS nikdy nešlo a stálo natvrdo v komponentě.
         *
         * Doplní se bezpečně: běh sahá u existujícího bloku výhradně na pole,
         * která jsou prázdná, takže `title`, `headline`, `body` ani `gallery`
         * se tímhle nepřepíšou.
         *
         * `accent` drží tři popisky v pořadí, v jakém se na stránce čtou: obočí
         * nad lockupem, pak levá a pravá půlka horní lišty. Číslo a jeho popisek
         * jdou do `items`, protože patří k sobě — v editoru je to jeden řádek se
         * dvěma poli, ne dva nesouvisející texty.
         */
        key: "index.hero",
        page: "index",
        title: "Hero — úvodní blok",
        data: {
            /*
             * Čtvrtá položka je slib pod nadpisem.
             *
             * Dřív byl druhou půlkou `body`, za výpustkou — tedy ve stejném poli jako nadpis.
             * Upravit se proto nedal: anotace pro vizuální editaci píše vždycky celé pole,
             * takže označit šlo jen jednoho ze dvou sourozenců. Vlastní pole to řeší.
             *
             * Mezery jsou tu narovnané. `body` je nese slepené („srespektemk materiálu,času")
             * po migraci ze Sanity a do nového pole nemá smysl přenášet cizí překlep.
             */
            accent: [
                "Keramika z píseckého ateliéru",
                "Autorská keramika",
                "Písek · od roku 2014",
                "Každý výrobek tvořím ručně s respektem k materiálu, času i lidem",
            ],
            items: [
                {
                    lead: "01",
                    label: "Ručně · pomalu · v malém počtu",
                    value: "",
                    note: "",
                },
            ],
        },
    },
    {
        key: "dotazy.otazky",
        page: "dotazy",
        title: "Otázky a odpovědi",
        data: {
            // Vlastní pole schématu, ne `items`: dvojice otázka/odpověď mají
            // v `siteCopy` svoje místo (`questions`) i vlastní validaci, a
            // editor u nich vidí „Otázka" a „Odpověď", ne „Popisek/Hodnota".
            questions: faq.map(({ question, answer }) => ({ question, answer })),
        },
    },
    {
        key: "vyroba.kroky",
        page: "vyroba",
        title: "Kroky výroby",
        data: {
            /*
             * Krok má v kódu šest textových polí, `items` čtyři. Do CMS jdou ty
             * čtyři, které se opravdu přepisují — nadpis, věta pod ním, odstavec
             * a zvýrazněný konec. `label` (štítek „Myšlenka · Funkce") a
             * `number` zůstávají v kódu: štítek je typografická ozdoba a číslo
             * drží pořadí, na kterém stojí scrollovací mechanismus.
             */
            items: kroky.map((step) => ({
                lead: step.number ?? "",
                label: step.title ?? "",
                value: step.text ?? "",
                note: step.accent ?? "",
            })),
        },
    },
    {
        // Doplní se k fotce, kterou sem založil seed-galleries.mjs.
        key: "global.prihlaseni",
        page: "global",
        title: "Přihlášení a registrace",
        data: {
            /*
             * Jen `login` a `register` — obnova hesla a ověření e-mailu jsou
             * podpůrné obrazovky a ty do CMS na přání nejdou. Jejich texty
             * zůstávají v komponentě.
             */
            items: ["login", "register"].flatMap((mode) => {
                const m = auth[mode]
                if (!m) return []
                return [
                    { lead: m.index ?? "", label: `${mode}.title`, value: m.title ?? "", note: m.accent ?? "" },
                    { lead: "", label: `${mode}.eyebrow`, value: m.eyebrow ?? "", note: "" },
                    { lead: "", label: `${mode}.note`, value: m.note ?? "", note: "" },
                ]
            }),
        },
    },
]

/* ------------------------------------------------- texty, které ležely v kódu -- */
//
// docs/cms/00-plan.md, E. Každý záznam nese PŘESNĚ text, který komponenta
// vykreslí, když je CMS prázdné — tak, aby první publikace nic nezměnila
// a Lucie ve Studiu viděla, co na webu opravdu stojí. Změní-li se výchozí
// text v komponentě, patří změna i sem (a naopak).
//
// `title` je u bloků, kde ho komponenta čte, obsah (nadpis); jinde jen jméno
// bloku ve Studiu.
//
// `accent` jen tam, kde drží JEDEN text. Víc textů jde do `items` klíčovaných
// popiskem: CMS z `accent` při čtení prázdné položky vyhazuje
// (`server/site/content.js`), takže vymazaná první by posunula všechny za ní
// — a tlačítko „Zaplatit objednávku" by dostalo nápis „Zobrazit košík".

/** `richText` drží knihovna jako HTML — jeden odstavec. */
const p = (text) =>
    `<p>${String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`

/** Položka klíčovaná popiskem (`itemValue(block, label)`). */
const item = (label, value, note = "") => ({ lead: "", label, value, note })

/** Blok `<stránka>.seo` — titulek a popis pro vyhledávače. */
const seoBlock = (page, title, description) => ({
    key: `${page}.seo`,
    page,
    title,
    data: { body: p(description) },
})

const TEXT_BLOCKS = [
    /* ------------------------------------------------------------ O mně -- */
    {
        key: "o-mne.uvod",
        page: "o-mne",
        title: "Jmenuji se",
        data: {
            headline: "Lucie Polanská",
            // V pořadí, v jakém se na stránce čtou.
            items: [
                item("oboci", "O mně · keramická zahrada"),
                item("lista.vlevo", "Ručně tvořeno"),
                item("lista.vpravo", "Písek · od roku 2014"),
                item("pozdrav", "Těší mě"),
                item("portret", "Ateliér · Písek"),
                item("kapitola", "Můj příběh"),
            ],
        },
    },
    {
        key: "o-mne.pribeh",
        page: "o-mne",
        // Lišta nad scénou: `title` vlevo, `headline` vpravo — `items` jsou kapitoly.
        title: "Příběh · Dvě kapitoly",
        data: {
            headline: "Kdo za keramikou stojí",
            // lead = nadpis kapitoly, label = začátek věty, note = její
            // zvýrazněný konec, value = odstavec (viz storyStepsFrom).
            items: [
                {
                    lead: "Kořeny",
                    label: "Jsem",
                    value: "Absolventka SPŠ keramické v Bechyni a máma dvou úžasných dětí. Naplno se keramice věnuji od roku 2014.",
                    note: "písecká rodačka.",
                },
                {
                    lead: "Rukopis",
                    label: "Svou originální poetikou",
                    value: "i volbou vysoce kvalitních materiálů má keramika osloví každého, kdo hledá výtvarnou i řemeslnou kvalitu.",
                    note: "a přírodním designem,",
                },
            ],
        },
    },
    {
        key: "o-mne.cta",
        page: "o-mne",
        title: "Teď je řada",
        data: {
            headline: "na vás.",
            items: [
                item("lista.vlevo", "04 · Pokračování"),
                item("lista.vpravo", "Ručně, v píseckém ateliéru"),
                item("oboci", "Z ateliéru k vám domů"),
            ],
            body: p("Podívejte se na keramiku pro zahradu i domov. Všechno vzniká pomalu a jen v malém počtu."),
        },
    },

    /* ------------------------------------------------------------ Obchod -- */
    {
        key: "obchod.vyber",
        page: "obchod",
        title: "Vyberte si něco,",
        data: {
            headline: "co vám zůstane.",
            accent: ["Co je právě k mání"],
            body: p(
                "Keramika na běžné používání, jednotlivé kusy i malé série. Drobné odchylky nejsou vada — podle nich poznáte, že to dělal člověk."
            ),
        },
    },

    /* --------------------------------------------------- Košík a nákup -- */
    {
        key: "kosik.uvod",
        page: "kosik",
        title: "Košík",
        data: {
            items: [item("oboci", "Váš výběr"), item("souhrn", "Bezpečná platba · pečlivé balení")],
            body: p("Všechno je dělané rukama. Než to pošleme, pečlivě to v ateliéru zabalíme."),
        },
    },
    {
        key: "kosik.prazdny",
        page: "kosik",
        title: "Košík",
        data: {
            accent: ["Prozkoumat produkty"],
            body: p("Zatím je prázdný. Podívejte se, co je v ateliéru — třeba vás něco chytne."),
        },
    },
    {
        key: "kosik.prihlaseni",
        page: "kosik",
        title: "Máte u nás účet?",
        data: {
            accent: ["Přihlásit se"],
            body: p("Přihlaste se a nemusíte znovu vyplňovat adresu."),
        },
    },
    {
        key: "kosik.platba-zrusena",
        page: "kosik",
        title: "Ještě není zaplaceno.",
        data: {
            headline: "Košík vám zůstal.",
            items: [
                item("oboci", "Objednávka čeká na zaplacení"),
                item("tlacitko.zaplatit", "Zaplatit objednávku"),
                item("tlacitko.kosik", "Zobrazit košík"),
            ],
            // Jen výzva — úvodní věta s důvodem od brány je v kódu.
            body: p(
                "Zaplaťte prosím objednávku, ať ji můžeme co nejdřív poslat — do té doby ji nemáme jak odeslat. Zboží vám v košíku zůstalo, stačí pokračovat."
            ),
        },
    },
    {
        key: "kosik.platba-potvrzena",
        page: "kosik",
        title: "Platbu máme.",
        data: {
            headline: "Ještě ji dokončujeme.",
            accent: ["Ověřujeme platbu"],
            body: p("Ještě chviličku — objednávku potvrzujeme a ukládáme. Stránku nemusíte obnovovat."),
        },
    },
    {
        key: "kosik.platba-ceka",
        page: "kosik",
        title: "Objednávku máme.",
        data: {
            headline: "Teď čekáme na banku.",
            items: [
                item("oboci", "Čekáme na banku"),
                item(
                    "poznamka",
                    "Stránka se sama každých pár vteřin obnoví. Klidně ji zavřete, na výsledek to nemá vliv."
                ),
            ],
            body: p(
                "Platbu jsme odeslali, banka ji ale zatím nepotvrdila. U převodu to bývá i pár hodin, o víkendu klidně déle. Nemusíte nic dělat — jakmile ji potvrdíme, napíšeme vám."
            ),
        },
    },
    {
        key: "kosik.objednavka-hotova",
        page: "kosik",
        title: "Děkujeme!",
        data: {
            headline: "Teď se do toho pustím.",
            accent: ["Objednávka je uložená"],
        },
    },
    {
        key: "kosik.objednavka-pomoc",
        page: "kosik",
        title: "Ozvěte se.",
        data: {
            accent: ["Potřebujete s něčím pomoct?"],
        },
    },
    {
        key: "kosik.rychly-nakup",
        page: "kosik",
        title: "Rychlý nákup.",
        data: {
            headline: "Bez zbytečného klikání.",
            accent: ["Rychlý nákup"],
            body: p("Vyberete provedení, doručení a bezpečně zaplatíte. Tři kroky a je to."),
        },
    },
    {
        key: "kosik.rychly-vysledek",
        page: "kosik",
        title: "Výsledek rychlého nákupu",
        data: {
            items: [
                item("hotovo.stitek", "Objednávka potvrzena"),
                item("hotovo.nadpis", "Děkujeme.", "Máme to."),
                item(
                    "hotovo.text",
                    "Potvrzení jsme poslali na váš e-mail. Jakmile to v ateliéru připravíme, dáme vám vědět."
                ),
                item("overujeme.stitek", "Platbu ověřujeme"),
                item("overujeme.nadpis", "Ještě", "malý okamžik."),
                item(
                    "overujeme.text",
                    "Platební brána nám zatím nedala vědět, jak to dopadlo. Objednávku držíme a napíšeme vám, jakmile to budeme vědět."
                ),
                item("zruseno.stitek", "Platba byla zrušena"),
                item("zruseno.nadpis", "Nic se", "neztratilo."),
                item(
                    "zruseno.text",
                    "Objednávka není zaplacená. Můžete se vrátit zpátky a zvolit jiný způsob platby."
                ),
                item("nedokonceno.stitek", "Objednávka se nedokončila"),
                item("nedokonceno.nadpis", "Zkusme to", "ještě jednou."),
                // Bez „Nic jsme vám nestrhli." — tvrzení o penězích drží kód a přidá ho za text.
                item("nedokonceno.text", "Platbu ani objednávku se nepovedlo potvrdit."),
            ],
        },
    },

    /* ---------------------------------------------------- Odběr novinek -- */
    {
        key: "newsletter.stavy",
        page: "newsletter",
        title: "Stavy odběru novinek",
        data: {
            items: [
                item("vychozi.stitek", "Novinky z ateliéru"),
                item("vychozi.nadpis", "Zůstaňte blízko", "ateliéru."),
                item(
                    "vychozi.text",
                    "K odběru novinek se přihlásíte formulářem v patičce e-shopu. Přijde vám e-mail s potvrzovacím odkazem — a teprve po jeho kliknutí se ozýváme."
                ),
                item("potvrzeno.stitek", "Odběr potvrzen"),
                item("potvrzeno.nadpis", "Jste blízko", "ateliéru."),
                item(
                    "potvrzeno.text",
                    "Děkujeme za potvrzení. Ozveme se, když z pece vyjdou nové objekty nebo když vypíšeme termíny kurzů — a jinak mlčíme. Odhlásit se můžete kdykoli odkazem v patičce každé zprávy."
                ),
                item("odhlaseno.stitek", "Odhlášení proběhlo"),
                item("odhlaseno.nadpis", "Rozcházíme se", "v dobrém."),
                item(
                    "odhlaseno.text",
                    "Žádné další zprávy z ateliéru už vám chodit nebudou. Kdybyste si to rozmysleli, formulář v patičce e-shopu na vás počká."
                ),
                // Bez `.text` — odstavec o tom, co chodit přestane a co dál, drží kód.
                item("odhlaseno-upozorneni.stitek", "Odhlášení proběhlo"),
                item("odhlaseno-upozorneni.nadpis", "Tyhle e-maily", "už nepřijdou."),
                item("jiz-odhlaseno.stitek", "Tady se nic nestalo"),
                item("jiz-odhlaseno.nadpis", "Tento e-mail je", "odhlášený."),
                item(
                    "jiz-odhlaseno.text",
                    "Potvrzovací odkaz patří k odběru, který byl mezitím odhlášen, takže jsme ho nechali být. Pokud novinky chcete, přihlaste se prosím znovu ve formuláři v patičce — přijde vám čerstvý potvrzovací e-mail."
                ),
                item("neplatny-odkaz.stitek", "Odkaz nesedí"),
                item("neplatny-odkaz.nadpis", "Tenhle odkaz", "není platný."),
                item(
                    "neplatny-odkaz.text",
                    "Nejspíš se při kopírování nepřenesl celý. Zkuste jej otevřít z e-mailu znovu, nebo nám napište na info@keramickazahrada.cz a vyřešíme to ručně."
                ),
                item("chyba.stitek", "Něco se pokazilo"),
                item("chyba.nadpis", "Tohle se", "nepovedlo."),
                item(
                    "chyba.text",
                    "Na naší straně se něco zadrhlo a změna se neuložila. Zkuste odkaz otevřít ještě jednou; kdyby to nepomohlo, napište nám na info@keramickazahrada.cz."
                ),
            ],
        },
    },

    /* ------------------------------------------------------ Napříč webem -- */
    {
        key: "global.kontaktni-okno",
        page: "global",
        title: "Kontaktní okno",
        data: {
            items: [
                item("hlavicka.stitek", "Kontakt · Ateliér"),
                item("hlavicka.odpoved", "Ozvu se do dvou pracovních dnů"),
                item("nadpis.oboci", "Napište přímo do ateliéru"),
                item("nadpis", "Napište mi."),
                item("nadpis.zmena", "Co potřebujete změnit?"),
                item("nadpis.zvyrazneni", "Ozvu se osobně."),
                item("temata.otazka", "S čím vám můžu pomoct?"),
                // Jen to, co je na tlačítku napsané — téma ve zprávě drží kód.
                item("tema.obecny", "Obecný dotaz"),
                item("tema.zakazka", "Zakázka"),
                item("tema.objednavka", "Objednávka"),
                item("tema.kurzy", "Kurzy"),
                item("odeslano.nadpis", "Zpráva odešla."),
                item(
                    "odeslano.text",
                    "Děkuju — ozvu se vám do dvou pracovních dnů. Když stojím u pece, může to výjimečně trvat o kousek déle. Kopii zprávy jsem vám neposílala; kdybyste si nebyli jistí, napište mi kdykoliv na {email}."
                ),
                item("zmena-odeslano.nadpis", "Žádost o změnu odešla."),
                item(
                    "zmena-odeslano.text",
                    "Děkuju — změnu s vámi domluvím osobně: zavolám vám, nebo odepíšu e-mailem, zpravidla do dvou pracovních dnů. Objednávka zatím zůstává, jak byla. Kdybyste mezitím potřebovali cokoli doplnit, napište mi na {email}."
                ),
                item("faq", "Nejprve se podívat do FAQ"),
            ],
        },
    },
    {
        key: "global.nenalezeno",
        page: "global",
        title: "Stránka nenalezena",
        data: {
            items: [item("odkaz.domu", "Zpět na úvodní stránku"), item("odkaz.obchod", "Zpět do obchodu")],
            body: p("Tuhle stránku jsme nenašli. Možná se přesunula, nebo tu nikdy nebyla."),
        },
    },
    {
        // Vlastní blok, ne `items` bloku `global.paticka`: ty čte MerchantBlock pozicí.
        key: "global.paticka-odkazy",
        page: "global",
        title: "Patička — skupiny odkazů",
        data: {
            items: [
                item("skupina.informace", "Informace"),
                item("skupina.objevovat", "Objevovat"),
                item("skupina.pomoc", "Pomoc"),
                item("stazeni", "Ke stažení"),
                item("stazeni.pdf", "Ke stažení (PDF)"),
                // Bez „© rok" — rok počítá kód a dá ho před větu.
                item("copyright", "Keramická zahrada. Všechna práva vyhrazena."),
            ],
        },
    },
    {
        key: "global.produkt",
        page: "global",
        title: "Stránka výrobku",
        data: {
            items: [
                item("doprava.nadpis", "Jak to k vám dorazí"),
                item(
                    "doprava.text",
                    "Keramiku pečlivě zabalíme a pošleme Českou poštou — na výdejní místo nebo do boxu Balíkovny, které si vyberete, nebo k vám domů (křehké kusy jako křehký balík). Vyzvednout si ji můžete i osobně v ateliéru."
                ),
                item("galerie.veta", "Na každém kusu je něco malinko jinak."),
                item("galerie.dovetek", "Přesně podle toho poznáte ruční práci."),
                item("vyprodano.stitek", "Právě vyprodáno"),
                item("vyprodano.nadpis", "Dejte mi vědět, až bude znovu."),
                item(
                    "vyprodano.text",
                    "Jakmile budeme mít {kus} znovu skladem, pošleme vám jeden krátký e-mail. Nic víc."
                ),
                item("dalsi.stitek", "Mohlo by se hodit · 03"),
                item("dalsi.kolekce", "Ze stejné kolekce"),
                item("dalsi.atelier", "Z ateliéru"),
                item("dalsi.nadpis", "Podívejte se ještě"),
                item("dalsi.zvyrazneni", "na tyhle kousky."),
                item("dalsi.text-kolekce", "Další kusy ze stejné kolekce."),
                item("dalsi.text-atelier", "Další kusy, které mám teď v ateliéru."),
                item("dalsi.dovetek", "Všechno vzniká ručně a jen v malém počtu."),
            ],
        },
    },

    /* --------------------------------------------------------------- SEO -- */
    // Titulek bez „| Keramická zahrada" — připojí ho kořenový layout. Úvodní
    // stránka je výjimka: je to značka sama a titulek se píše celý.
    seoBlock(
        "index",
        "Keramická zahrada | Autorská keramika Lucie Polanské",
        "Ručně tvořená keramika pro zahradu i domov z píseckého ateliéru Lucie Polanské. Hotové kusy, zakázková výroba i keramické kurzy."
    ),
    seoBlock(
        "kurzy",
        "Keramické kurzy",
        "Keramické kurzy pro děti a chystané kurzy pro dospělé v ateliéru u Písku."
    ),
    seoBlock(
        "o-mne",
        "O mně — Lucie Polanská",
        "Kdo je Lucie Polanská, jak se dostala ke keramice a co ji na téhle práci baví."
    ),
    seoBlock(
        "vyroba",
        "Jak vzniká keramika",
        "Sedm kroků ruční výroby keramiky — od prvního návrhu přes modelování a výpal až po hotový kus."
    ),
    seoBlock(
        "dotazy",
        "Časté otázky",
        "Odpovědi na to, na co se ptáte nejčastěji — keramika, zakázková výroba, doprava, vrácení zboží i kurzy."
    ),
    seoBlock(
        "obchod",
        "Obchod",
        "Keramika z ateliéru Lucie Polanské — pro zahradu i domov. Každý kus je dělaný rukama a je jen jeden."
    ),
]

BLOCKS.push(...TEXT_BLOCKS)

/** Má blok tohle pole už naplněné? Prázdné pole se počítá jako nenaplněné. */
const filled = (value) => {
    if (value === null || value === undefined || value === "") return false
    if (Array.isArray(value)) return value.length > 0
    return true
}

/**
 * Kam by se zapisovalo — stejná volba, jakou dělá `getAdminClient()`
 * (`server/supabaseAdmin.js`): DATABASE_URL → Postgres, jinak
 * SUPABASE_SERVICE_ROLE_KEY → Supabase, jinak souborové úložiště.
 *
 * Dřív tu stálo „bez DATABASE_URL nezapisuj", jenže CMS od 28. 9. 2026 jede
 * přes Supabase API a DATABASE_URL nemá — pojistka tak zablokovala i správný
 * cíl. Chránit je potřeba před opačnou chybou: zápisem do sledovaného
 * `.cms-dev/store.json`, když se omylem nenačetly přístupy. Souborové úložiště
 * proto jen s výslovně zadaným CMS_FILE_STORE_DIR.
 */
const target = () => {
    const env = process.env
    const insideRailway = Boolean(env.RAILWAY_ENVIRONMENT)
    const dbUrl = (insideRailway && env.DATABASE_PRIVATE_URL) || env.DATABASE_URL || env.DATABASE_PRIVATE_URL || ""
    if (dbUrl.trim()) {
        let host = "?"
        try {
            host = new URL(dbUrl).hostname
        } catch {}
        return { kind: "postgres", label: `Postgres (${host})` }
    }
    if (String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim()) {
        let host = "?"
        try {
            host = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "").hostname
        } catch {}
        return { kind: "supabase", label: `Supabase (${host})` }
    }
    const dir = String(env.CMS_FILE_STORE_DIR || "").trim()
    return {
        kind: "file",
        explicit: Boolean(dir),
        label: `souborové úložiště (${dir || path.join(ROOT, ".cms-dev")})`,
    }
}

/**
 * Všechny bloky `siteCopy`, ne první stovka.
 *
 * Knihovna stránku tiše ořízne na 100 (`MAX_PER_PAGE` v `server/query.js`),
 * takže `perPage: 500` vracelo jen prvních sto — a blok za nimi by se tvářil
 * jako chybějící a založil se podruhé. Proto po stránkách, dokud nesedí `total`.
 */
const listAllCopy = async (documents) => {
    const rows = []
    for (let page = 1; page <= 100; page += 1) {
        const result = await documents.list({
            type: "siteCopy",
            sort: { field: "data.key", direction: "asc" },
            page,
            perPage: 100,
        })
        rows.push(...result.rows)
        if (!result.rows.length || rows.length >= (result.total ?? 0)) break
    }
    return rows
}

const main = async () => {
    log(`\nTexty do CMS${WRITE ? "" : "  (nasucho)"}\n`)

    const where = target()
    log(`Cíl: ${where.label}\n`)

    if (WRITE && where.kind === "file" && !where.explicit) {
        throw new Error(
            "Nenačetly se přístupy k CMS (DATABASE_URL ani SUPABASE_SERVICE_ROLE_KEY) — " +
                "zapisovalo by se do sledovaného .cms-dev/. Pro zkoušku nad souborovým " +
                "úložištěm nastavte CMS_FILE_STORE_DIR."
        )
    }

    const { getAdminClient, createDocumentRepository } = await import("@c3studium/valecms/server")
    const documents = createDocumentRepository({ client: getAdminClient() })

    let created = 0
    let merged = 0
    let kept = 0
    const now = new Date().toISOString()

    /*
     * Bloky se hledají podle `key` UVNITŘ typu `siteCopy`.
     *
     * Ne podle `legacy_id` — ten není napříč typy jedinečný. `kod/index.hero`
     * patří TLAČÍTKU „Prohlédnout výrobky"; hero blok přišel migrací ze Sanity
     * a nese její UUID. Hledání podle legacy id proto vrátilo tlačítko a
     * doplnilo mu `accent` a `items` — pole, která na tlačítku nemají co dělat.
     * (Stalo se. Muselo se to vracet ručně.)
     *
     * Klíč uvnitř typu je navíc to, čím se blok identifikuje i v kódu
     * (`copy["index.hero"]`), takže se hledá totéž, co hledá komponenta.
     */
    /*
     * Klíč i naplněnost se čtou z KONCEPTU, je-li nějaký, jinak z publikovaného.
     *
     * Blok, který ve Studiu vznikl a ještě nebyl publikován, má klíč jen
     * v `draft` — hledání jen v `data` by ho nenašlo a založilo by se vedle
     * něj druhý, publikovaný blok s týmž klíčem. Na webu by pak vyhrál ten,
     * kterého si čtečka všimne poslední.
     */
    const rows = await listAllCopy(documents)
    const keyOf = (row) => row.draft?.key ?? row.data?.key
    const byKey = new Map(
        rows.filter((row) => typeof keyOf(row) === "string").map((row) => [keyOf(row), row])
    )

    /*
     * Rozpracovaný koncept = Lucie na bloku právě pracuje. Doplnit pole
     * a publikovat by její neuložené úpravy pustilo na web dřív, než sama
     * řekne (`update()` přepíše koncept, `publish()` ho vydá). Takový blok se
     * přeskočí a vypíše; doplní se dalším během, až bude publikovaný.
     */
    const pendingDraft = (row) =>
        Boolean(row.draft) && JSON.stringify(row.draft) !== JSON.stringify(row.data)
    let skipped = 0

    for (const block of BLOCKS) {
        const found = byKey.get(block.key) ?? null

        const fields = Object.entries(block.data)
        const counts = fields
            .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.length : 1}`)
            .join(", ")

        if (found && (pendingDraft(found) || found.status !== "published")) {
            const why = found.status !== "published" ? "jen koncept, nepublikovaný" : "rozpracovaný koncept"
            log(`  ! ${block.key.padEnd(26)} ${why} — nesahám (doplní se, až ho Lucie publikuje)`)
            skipped += 1
            continue
        }

        if (!found) {
            log(`  + ${block.key.padEnd(26)} ${counts}`)
            created += 1
            if (!WRITE) continue
            await documents.importRow({
                id: crypto.randomUUID(),
                type: "siteCopy",
                status: "published",
                data: { key: block.key, page: block.page, title: block.title, ...block.data },
                draft: null,
                created_at: now,
                updated_at: now,
                published_at: now,
                legacy_source: "kod",
                legacy_id: block.key,
            })
            continue
        }

        // Existuje — doplní se jen to, co v něm ještě není. Výš je zaručeno, že
        // koncept buď není, nebo je shodný s publikovaným, takže `draft ?? data`
        // je tentýž obsah, jaký vidí Studio.
        const current = found.draft ?? found.data ?? {}
        const missing = fields.filter(([name]) => !filled(current[name]))

        if (!missing.length) {
            log(`  = ${block.key.padEnd(26)} má vše — nesahám`)
            kept += 1
            continue
        }

        log(`  ~ ${block.key.padEnd(26)} doplňuji ${missing.map(([n]) => n).join(", ")}`)
        merged += 1
        if (!WRITE) continue

        /*
         * `update()` a pak `publish()` — dva kroky, protože to tak API myslí.
         *
         * `update()` zapisuje KONCEPT a nic víc; na web se změna dostane až
         * publikací. Samotné `update({ status: 'published' })` proto nestačí:
         * ten klíč metoda nebere, text zůstane v konceptu a další běh ho bude
         * doplňovat znovu. (Vyzkoušeno — `global.prihlaseni` skončilo
         * s prázdnými `items` v datech a plnými v konceptu.)
         *
         * `replacePublished()` by zapsalo rovnou do publikovaných dat a bylo
         * by o krok kratší, ale NEZAKLÁDÁ REVIZI. Archiv je na to, aby šlo
         * odpovědět „co na webu stálo tohohle dne", a změna, která se do něj
         * nezapíše, tu odpověď tiše zkreslí. Krok navíc stojí za úplný archiv.
         *
         * Opakovaný běh nic nezanáší: `publish()` pozná, že se publikuje totéž,
         * co už je venku, a revizi nezaloží.
         */
        await documents.update({
            id: found.id,
            data: { ...current, ...Object.fromEntries(missing) },
        })
        await documents.publish({ id: found.id })
    }

    log(
        `\n${WRITE ? "Hotovo" : "Nasucho"}: ${created} nových, ${merged} doplněných, ` +
            `${kept} beze změny, ${skipped} přeskočených (koncept).`
    )
    if (!WRITE) log(`Spusťte znovu s --write.`)
    log("")
}

main().catch((error) => {
    console.error(`\nSeed selhal: ${error.message}\n`)
    process.exitCode = 1
})
