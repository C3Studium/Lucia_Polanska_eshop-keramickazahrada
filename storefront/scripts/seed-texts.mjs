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
const loadEnv = (file) => {
    if (!fs.existsSync(file)) return
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
        if (!match) continue
        const [, key, raw] = match
        if (process.env[key]) continue
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
const pravni = read("pravni.json")

/**
 * Právní dokument jako blok.
 *
 * Jedna sekce = jedna položka. `lead` nese `id`, protože na něm visí kotva
 * v adrese a boční navigace — do CMS jde, aby bylo vidět, ke které sekci
 * text patří, ale komponenta ho z bloku NEČTE. Odkaz, který si někdo uložil,
 * nesmí přestat platit tím, že redaktor přepsal nadpis.
 *
 * Odstavce se spojují prázdným řádkem a odrážky novým — editor tak upravuje
 * celou sekci v jednom poli, což u právního textu odpovídá tomu, jak se
 * doopravdy mění: ne po větách, ale po odstavcích.
 */
const legalBlock = (slug, page) => ({
    key: `${page}.text`,
    page,
    title: pravni[slug].label,
    data: {
        items: pravni[slug].sections.map((section) => ({
            lead: section.id,
            label: section.title,
            value: section.paragraphs.join("\n\n"),
            note: section.bullets.join("\n"),
        })),
    },
})

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

    /*
     * Právní dokumenty — vlastní stránka v CMS pro každý.
     *
     * Ne jeden blok se šesti sekcemi: jsou to šest samostatných dokumentů,
     * mění se každý jindy a editor je má hledat pod tou stránkou, kterou
     * upravuje. Klíč stránky odpovídá routě, takže `page` v CMS a adresa
     * na webu jsou totéž slovo.
     */
    legalBlock("smluvni-podminky", "smluvni-podminky"),
    legalBlock("ochrana-osobnich-udaju", "ochrana-osobnich-udaju"),
    legalBlock("cookies", "cookies"),
    legalBlock("odstoupeni-od-smlouvy", "odstoupeni-od-smlouvy"),
    legalBlock("reklamacni-protokol", "reklamacni-protokol"),
    legalBlock("doprava-a-platba", "doprava-a-platba"),
]

/** Má blok tohle pole už naplněné? Prázdné pole se počítá jako nenaplněné. */
const filled = (value) => {
    if (value === null || value === undefined || value === "") return false
    if (Array.isArray(value)) return value.length > 0
    return true
}

const main = async () => {
    log(`\nTexty do CMS${WRITE ? "" : "  (nasucho)"}\n`)

    if (!process.env.DATABASE_URL && WRITE) {
        throw new Error(
            "Chybí DATABASE_URL — zapisovalo by se do vývojového úložiště .cms-dev/, ne do databáze."
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
    const { rows } = await documents.list({ type: "siteCopy", perPage: 500 })
    const byKey = new Map(
        rows
            .filter((row) => typeof row.data?.key === "string")
            .map((row) => [row.data.key, row])
    )

    for (const block of BLOCKS) {
        const found = byKey.get(block.key) ?? null

        const fields = Object.entries(block.data)
        const counts = fields
            .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.length : 1}`)
            .join(", ")

        if (!found) {
            log(`  + ${block.key.padEnd(20)} ${counts}`)
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

        // Existuje — doplní se jen to, co v něm ještě není.
        const current = found.data ?? {}
        const missing = fields.filter(([name]) => !filled(current[name]))

        if (!missing.length) {
            log(`  = ${block.key.padEnd(20)} má vše — nesahám`)
            kept += 1
            continue
        }

        log(`  ~ ${block.key.padEnd(20)} doplňuji ${missing.map(([n]) => n).join(", ")}`)
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
            `${kept} beze změny.`
    )
    if (!WRITE) log(`Spusťte znovu s --write.`)
    log("")
}

main().catch((error) => {
    console.error(`\nSeed selhal: ${error.message}\n`)
    process.exitCode = 1
})
