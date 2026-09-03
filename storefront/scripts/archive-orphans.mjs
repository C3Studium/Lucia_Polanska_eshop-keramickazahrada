// Bloky, které web nečte, do archivu.
//
//   node --import @c3studium/valecms/register.mjs scripts/archive-orphans.mjs
//   node --import @c3studium/valecms/register.mjs scripts/archive-orphans.mjs --write
//
// ---------------------------------------------------------------------------
// Proč vůbec
//
// Po migraci ze Sanity zůstalo v CMS deset bloků, které si žádná komponenta
// nebere. Není to nedodělané napojení — sekce, které je kreslily, ze stránek
// zmizely; `src/constants/images.ts`, přes který se fotky braly, dnes nikdo
// neimportuje.
//
// Nechat je v seznamu je horší než je odklidit. Redaktorka je vidí v „Texty
// na webu", upraví je, publikuje — a na webu se nezmění nic. Nedozví se proč
// a příště nebude vědět, čemu z toho seznamu věřit.
//
// ---------------------------------------------------------------------------
// Archiv, ne smazání
//
// `archive()` nastaví `archived_at`; data zůstanou a `restore()` je vrátí.
// Kdyby se některá sekce na web vrátila, je obsah připravený — u textů, které
// psal člověk a které se ze Sanity migrovaly jednou, to není teoretický rozdíl.
//
// ---------------------------------------------------------------------------
// Seznam se nedoplňuje sám
//
// Vyjmenovaný schválně. „Archivuj všechno, co grep nenajde" by při prvním
// překlepu v klíči odklidilo blok, který se čte — a rozdíl mezi „nikdo to
// nečte" a „hledal jsem špatně" grep nepozná.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const loadEnv = (file) => {
    if (!fs.existsSync(file)) return
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
        if (!m) continue
        if (process.env[m[1]]) continue
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
}
loadEnv(path.join(ROOT, ".env.local"))
loadEnv(path.join(ROOT, ".env"))

const WRITE = process.argv.includes("--write")
const log = (message) => console.log(message)

/** Klíč bloku a důvod, proč je bez domova. */
const ORPHANS = [
    ["index.ecom-cta", "sekce s 30 fotkami (roller) ze stránky zmizela"],
    ["index.ecom-desc", "popisné bloky e-shopu už se nevykreslují"],
    ["index.ecom-entry", "vstupní sekce s 5 fotkami ze stránky zmizela"],
    ["index.galerie", "plovoucí galerie — kreslila ji constants/images.ts, který nikdo neimportuje"],
    ["kurzy.about", "sekce O kurzech nahrazena texty přímo v Intro"],
    ["kurzy.cta", "závěrečná výzva kurzů se nevykresluje"],
    ["kurzy.sections", "přepínač sekce, kterou nikdo nečte"],
    ["global.kontakt", "blok newsletteru; kontaktní dialog má vlastní texty"],
    [
        "global.mapa",
        "adresu drží identita obchodníka (env, stejná data jako na fakturách) — " +
            "dva zdroje pravdy o údaji z rejstříku by byly horší; otevírací doba se nikde nevykresluje",
    ],
    ["global.news-popup", "oznámení; Hero čte index.news"],
]

const main = async () => {
    log(`\nOsiřelé bloky do archivu${WRITE ? "" : "  (nasucho)"}\n`)

    if (!process.env.DATABASE_URL && WRITE) {
        throw new Error("Chybí DATABASE_URL — bez něj by se sahalo do vývojového úložiště .cms-dev/.")
    }

    const { getAdminClient, createDocumentRepository } = await import("@c3studium/valecms/server")
    const documents = createDocumentRepository({ client: getAdminClient() })

    /*
     * Živé i archivované.
     *
     * `list()` archivované ve výchozím stavu NEVRACÍ (`archived = false`), takže
     * druhý běh nad hotovou prací hlásil „v CMS není" místo „už v archivu" —
     * což je rozdíl mezi „hotovo" a „něco se ztratilo". Načtou se obě sady
     * a archivované se poznají podle `archivedAt`.
     */
    const fetchAll = async (archived) => {
        let out = []
        for (let p = 1; p <= 20; p += 1) {
            const r = await documents.list({ page: p, perPage: 100, archived })
            const list = r?.rows ?? []
            if (!list.length) break
            out = out.concat(list)
            if (out.length >= (r.total ?? 0)) break
        }
        return out
    }

    const rows = [...(await fetchAll(false)), ...(await fetchAll(true))]

    let archived = 0
    let already = 0
    let missing = 0

    for (const [key, reason] of ORPHANS) {
        const doc = rows.find((r) => r.type === "siteCopy" && r.data?.key === key)

        if (!doc) {
            log(`  ? ${key.padEnd(20)} v CMS není`)
            missing += 1
            continue
        }
        if (doc.archivedAt ?? doc.archived_at) {
            log(`  = ${key.padEnd(20)} už v archivu`)
            already += 1
            continue
        }

        log(`  → ${key.padEnd(20)} ${reason}`)
        archived += 1
        if (!WRITE) continue
        await documents.archive({ id: doc.id })
    }

    log(
        `\n${WRITE ? "Hotovo" : "Nasucho"}: ${archived} ${WRITE ? "archivováno" : "k archivaci"}, ` +
            `${already} už v archivu, ${missing} nenalezeno.`
    )
    if (!WRITE) log(`Spusťte znovu s --write.`)
    log(`\nVrátit zpět jde ve Studiu v Archivu, nebo přes documents.restore({ id }).\n`)
}

main().catch((error) => {
    console.error(`\nArchivace selhala: ${error.message}\n`)
    process.exitCode = 1
})
