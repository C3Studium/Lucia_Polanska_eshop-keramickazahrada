// Vytáhne texty z komponent do `content/*.json`.
//
//   node scripts/extract-texts.mjs
//
// Dvojice k `seed-texts.mjs`: tenhle skript čte, co dnes stojí v kódu, ten
// druhý to nalije do CMS. Rozdělené proto, že seed se pouští opakovaně a nemá
// smysl u každého běhu znovu parsovat komponenty — a hlavně proto, že ty JSONy
// jsou ZÁZNAM. Až se text v komponentě přepíše na `block?.x || "…"`, zůstane
// v nich to, co na webu stálo předtím, a jde se k tomu vrátit.
//
// Čte se regulárním výrazem, ne AST parserem: hledá se pár konkrétních polí ve
// dvou polích konstant, ne obecný JavaScript. Kdyby se tvar zdroje změnil,
// skript to řekne — každý nepřečtený záznam vypíše nahlas a nikdy ho tiše
// nevynechá.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT = path.join(ROOT, "content")

/** Hodnota řetězcového pole `name` v úryvku, i s escapovanými uvozovkami. */
const str = (name, chunk) => {
    const re = new RegExp(name + ':\\s*"((?:[^"\\\\]|\\\\.)*)"')
    const m = re.exec(chunk)
    return m ? m[1].replace(/\\"/g, '"') : null
}

/** Úryvky jednotlivých položek pole `name` ve `file`. */
const records = (file, name, indent) => {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8")
    const start = source.indexOf(name)
    if (start < 0) throw new Error(`V ${file} není "${name}".`)
    const block = source.slice(start, source.indexOf("\n]", start))
    return block.split(new RegExp(`\\n${" ".repeat(indent)}\\{`)).slice(1)
}

const write = (name, value, note) => {
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, 1) + "\n")
    console.log(`  ${name.padEnd(24)} ${note}`)
}

console.log("\nTexty z komponent → content/\n")

// ── Otázky a odpovědi
{
    const out = []
    for (const c of records("src/modules/dotazy/FAQ/index.tsx", "const faq = [", 4)) {
        const id = str("id", c)
        const question = str("title", c)
        const answer = str("desc", c)
        if (id && question && answer) out.push({ id, category: str("category", c), question, answer })
        else console.log(`  ! nepřečtená otázka: ${id ?? c.slice(0, 40).replace(/\n/g, " ")}`)
    }
    write("faq.json", out, `${out.length} otázek`)
}

// ── Kroky výroby
{
    const out = records("src/modules/vyroba/gallery/index.tsx", "export const processSteps = [", 2).map(
        (c) => ({
            number: str("number", c),
            title: str("title", c),
            label: str("label", c),
            lead: str("lead", c),
            accent: str("accent", c),
            text: str("text", c),
        })
    )
    for (const step of out) if (!step.title) console.log(`  ! krok bez nadpisu: ${step.number}`)
    write("vyroba-kroky.json", out, `${out.length} kroků`)
}

// ── Texty přihlašovacího portálu
{
    const source = fs.readFileSync(
        path.join(ROOT, "src/modules/account/components/auth-portal/index.tsx"),
        "utf8"
    )
    const start = source.indexOf("const copy = {")
    const block = source.slice(start, source.indexOf("\n}", start))
    const out = {}
    for (const mode of ["login", "register", "recovery", "verification"]) {
        const at = block.indexOf(mode + ": {")
        if (at < 0) {
            console.log(`  ! režim ${mode} nenalezen`)
            continue
        }
        const chunk = block.slice(at, block.indexOf("},", at))
        out[mode] = {
            index: str("index", chunk),
            eyebrow: str("eyebrow", chunk),
            title: str("title", chunk),
            accent: str("accent", chunk),
            note: str("note", chunk),
            word: str("word", chunk),
        }
    }
    write("auth-portal.json", out, `${Object.keys(out).length} režimů`)
}

// ── Právní stránky
//
// Sekce dokumentu je `{ id, title, paragraphs[], bullets[] }`. Do CMS jde
// nadpis, odstavce a odrážky; `id` zůstává, protože na něm visí kotvy
// a boční navigace — přejmenovat ho v CMS by rozbilo odkazy, které si
// někdo uložil.
//
// Odstavce se čtou i přes zalomení a spojovníky, protože v právních textech
// jsou dlouhé a psané na víc řádků. Pole řetězců se proto parsuje zvlášť.
{
    const PAGES = [
        ["smluvni-podminky", "Obchodní podmínky"],
        ["ochrana-osobnich-udaju", "Ochrana osobních údajů"],
        ["cookies", "Používání cookies"],
        ["odstoupeni-od-smlouvy", "Odstoupení od smlouvy"],
        ["reklamacni-protokol", "Reklamační protokol"],
        ["doprava-a-platba", "Doprava a platba"],
    ]

    /** Řetězce v poli `name: [ … ]` uvnitř úryvku. */
    const list = (name, chunk) => {
        const at = chunk.indexOf(name + ":")
        if (at < 0) return []
        const open = chunk.indexOf("[", at)
        if (open < 0) return []
        let depth = 0
        let end = open
        for (let i = open; i < chunk.length; i += 1) {
            if (chunk[i] === "[") depth += 1
            if (chunk[i] === "]") {
                depth -= 1
                if (!depth) {
                    end = i
                    break
                }
            }
        }
        const inner = chunk.slice(open + 1, end)
        return [...inner.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) =>
            m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n")
        )
    }

    const out = {}
    for (const [slug, label] of PAGES) {
        /*
         * Obchodní podmínky mají sekce ve vlastním `data.ts`, ostatní přímo
         * ve stránce. Je to nejdelší dokument z šesti a rozdělený je právem;
         * pro čtení to znamená zkusit obojí, ne předpokládat jedno.
         */
        const candidates = [
            `src/app/[countryCode]/(main)/${slug}/data.ts`,
            `src/app/[countryCode]/(main)/${slug}/page.tsx`,
        ].filter((f) => fs.existsSync(path.join(ROOT, f)))

        let source = ""
        let start = -1
        for (const file of candidates) {
            source = fs.readFileSync(path.join(ROOT, file), "utf8")
            start = source.indexOf("sections: LegalSectionData[] = [")
            if (start >= 0) break
        }
        if (start < 0) {
            console.log(`  ! ${slug}: pole sekcí nenalezeno`)
            continue
        }
        const block = source.slice(start, source.indexOf("\n]", start))
        const chunks = block.split(/\n  \{/).slice(1)
        const sections = []
        for (const c of chunks) {
            const id = str("id", c)
            const title = str("title", c)
            if (!id || !title) {
                console.log(`  ! ${slug}: sekce bez id nebo nadpisu`)
                continue
            }
            sections.push({ id, title, paragraphs: list("paragraphs", c), bullets: list("bullets", c) })
        }
        out[slug] = { label, sections }
    }

    const total = Object.values(out).reduce((n, p) => n + p.sections.length, 0)
    write("pravni.json", out, `${Object.keys(out).length} stránek, ${total} sekcí`)
}

console.log("")
