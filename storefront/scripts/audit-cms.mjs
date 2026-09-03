// Co je z webu napojené na CMS a co ne.
//
//   node --import @c3studium/valecms/register.mjs scripts/audit-cms.mjs
//
// Čte tři věci a dá je vedle sebe:
//
//   1. stránky deklarované v `valecms.config.ts` — jen ty jdou ve Studiu
//      rozkliknout v „Upravit kontent"
//   2. bloky, které v databázi opravdu leží, po stránkách
//   3. anotace `editable*()` v komponentách — co jde v náhledu kliknout
//
// Bez tohohle se stav odhaduje: blok může být v CMS a přitom ho žádná
// komponenta nečte, nebo naopak komponenta anotuje pole bloku, který nikdo
// nezaložil. Obojí vypadá zvenčí stejně — jako „nejde to upravit".

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

/** Všechny .tsx pod src/modules. */
const walk = (dir, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full, out)
        else if (entry.name.endsWith(".tsx")) out.push(full)
    }
    return out
}

const main = async () => {
    /*
     * ── 1. Stránky, tak jak je vidí knihovna
     *
     * Ne čtením `valecms.config.ts` regulárním výrazem: právní stránky v něm
     * vznikají cyklem nad polem, takže `route:` jako literál v souboru není
     * a audit je hlásil jako nedeklarované. Načte se tedy skutečná
     * konfigurace — je to jediný zdroj, který ví, co `defineSite` opravdu
     * dostalo.
     */
    const site = (await import("../src/lib/valecms.config.ts")).default
    const routes = (site?.pages ?? []).map((p) => p.route ?? p?.def?.route).filter(Boolean)

    // ── 2. Bloky v databázi
    const { getAdminClient, createDocumentRepository } = await import("@c3studium/valecms/server")
    const documents = createDocumentRepository({ client: getAdminClient() })
    let rows = []
    for (let p = 1; p <= 20; p += 1) {
        const r = await documents.list({ page: p, perPage: 100 })
        const list = r?.rows ?? []
        if (!list.length) break
        rows = rows.concat(list)
        if (rows.length >= (r.total ?? 0)) break
    }
    const blocks = rows.filter((r) => r.type === "siteCopy")
    const buttons = rows.filter((r) => r.type === "tlacitko")

    // ── 3. Anotace v komponentách
    const annotations = []
    for (const file of walk(path.join(ROOT, "src/modules"))) {
        const source = fs.readFileSync(file, "utf8")
        for (const line of source.split(/\r?\n/)) {
            if (!/editable(Link|Lines|List|Set|Doc)?\(/.test(line)) continue
            if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue
            if (/^\s*import/.test(line)) continue
            const m = /editable(Link|Lines|List|Set|Doc)?\(\s*([A-Za-z_$][\w$?.]*)/.exec(line)
            if (!m) continue
            annotations.push({
                file: path.relative(path.join(ROOT, "src/modules"), file).replace(/\\/g, "/"),
                target: m[2],
            })
        }
    }

    // ── Výpis
    console.log("\n╔══ STRÁNKY V KONFIGURACI (jdou rozkliknout v Upravit kontent)")
    for (const r of routes) console.log(`║  ${r}`)

    console.log("\n╔══ BLOKY V DATABÁZI, po stránkách")
    const byPage = {}
    for (const b of blocks) (byPage[b.data?.page ?? "?"] ??= []).push(b)
    for (const [page, list] of Object.entries(byPage).sort()) {
        /*
         * `global` routu nemá a mít nemá — je to `defineGlobals`, tedy to, co
         * visí pod každou stránkou. Označit ho jako nedeklarovaný by byl
         * falešný poplach, který se po pár bězích přestane číst.
         */
        const declared =
            page === "global" ||
            routes.some((r) => (r === "/cz" ? page === "index" : r.endsWith("/" + page)))
        console.log(`║  ${page.padEnd(8)} ${declared ? "  " : "⚠ "}${list.length} bloků`)
        for (const b of list.sort((a, z) => (a.data?.key ?? "").localeCompare(z.data?.key ?? ""))) {
            const fields = Object.keys(b.data ?? {})
                .filter((k) => !["key", "page"].includes(k))
                .map((k) => `${k}(${Array.isArray(b.data[k]) ? b.data[k].length : 1})`)
            console.log(`║      ${(b.data?.key ?? "?").padEnd(22)} ${fields.join(" ")}`)
        }
    }
    console.log(`║  tlačítka: ${buttons.length}`)

    console.log("\n╔══ ANOTACE V KOMPONENTÁCH (co jde v náhledu kliknout)")
    const byFile = {}
    for (const a of annotations) (byFile[a.file] ??= []).push(a.target)
    for (const [file, targets] of Object.entries(byFile).sort()) {
        console.log(`║  ${file.padEnd(46)} ${targets.length}× → ${[...new Set(targets)].join(", ")}`)
    }
    console.log(`║  celkem ${annotations.length} anotací v ${Object.keys(byFile).length} souborech\n`)
}

main().catch((error) => {
    console.error(`\nAudit selhal: ${error.message}\n`)
    process.exitCode = 1
})
