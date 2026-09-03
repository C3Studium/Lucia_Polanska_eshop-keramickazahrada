// Souhlasí kód s tím, co v CMS leží?
//
//   node --import @c3studium/valecms/register.mjs scripts/verify-cms.mjs
//
// Jen čte, nic nemění. Odpovídá na tři otázky, které audit sám nezodpoví:
//
//   1. Sáhne kód po bloku, který v CMS není? (stránka se vykreslí se zálohou
//      a nikdo se nedozví, že obsah chybí)
//   2. Leží v CMS blok, po kterém nikdo nesáhne? (redaktor ho upraví,
//      publikuje a na webu se nezmění nic)
//   3. Sedí klíč tlačítka v kódu s klíčem v CMS?
//
// Klíče se z kódu čtou jako literály — `copy["index.hero"]`, `button(copy,
// "menu.uvod")`. Klíč složený za běhu by tenhle skript nenašel; proto se
// v tomhle projektu žádný nesestavuje.

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

const walk = (dir, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full, out)
        else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full)
    }
    return out
}

const main = async () => {
    // ── Co kód čte
    const files = [
        ...walk(path.join(ROOT, "src/app")),
        ...walk(path.join(ROOT, "src/modules")),
    ]

    const usedBlocks = new Map()
    const usedButtons = new Map()

    for (const file of files) {
        const source = fs.readFileSync(file, "utf8")
        const rel = path.relative(ROOT, file).replace(/\\/g, "/")

        // `copy["index.hero"]`, `copy?.["o-mne.galerie"]`
        for (const m of source.matchAll(/copy\??\.?\[\s*"([a-z0-9.-]+)"\s*\]/gi)) {
            if (!usedBlocks.has(m[1])) usedBlocks.set(m[1], [])
            usedBlocks.get(m[1]).push(rel)
        }
        // `button(copy, "menu.uvod")`, `button(buttons, link.cms)` se nepočítá
        for (const m of source.matchAll(/button\(\s*[A-Za-z_$][\w$?.]*\s*,\s*"([a-z0-9.-]+)"\s*\)/gi)) {
            if (!usedButtons.has(m[1])) usedButtons.set(m[1], [])
            usedButtons.get(m[1]).push(rel)
        }
        // `cms: "footer.facebook"` — tabulky odkazů v patičce a menu
        for (const m of source.matchAll(/\bcms:\s*"([a-z0-9.-]+)"/gi)) {
            if (!usedButtons.has(m[1])) usedButtons.set(m[1], [])
            usedButtons.get(m[1]).push(rel)
        }
    }

    // ── Co v CMS je
    const { getAdminClient, createDocumentRepository } = await import("@c3studium/valecms/server")
    const documents = createDocumentRepository({ client: getAdminClient() })

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

    const live = await fetchAll(false)
    const archived = await fetchAll(true)

    const blockKeys = new Set(live.filter((r) => r.type === "siteCopy").map((r) => r.data?.key))
    const archivedKeys = new Set(archived.filter((r) => r.type === "siteCopy").map((r) => r.data?.key))
    const buttonKeys = new Set(live.filter((r) => r.type === "tlacitko").map((r) => r.data?.klic))

    let problems = 0
    const say = (mark, line) => {
        console.log(`${mark} ${line}`)
        if (mark === "✗") problems += 1
    }

    console.log("\n── Bloky, které kód čte")
    for (const [key, where] of [...usedBlocks].sort()) {
        if (blockKeys.has(key)) say("✓", `${key.padEnd(26)} ${where.length}× v kódu`)
        else if (archivedKeys.has(key)) say("✗", `${key.padEnd(26)} JE V ARCHIVU, ale kód ho čte — ${where[0]}`)
        else say("✗", `${key.padEnd(26)} V CMS NENÍ — ${where[0]}`)
    }

    console.log("\n── Bloky v CMS, které nikdo nečte")
    const orphans = [...blockKeys].filter((k) => k && !usedBlocks.has(k)).sort()
    if (!orphans.length) console.log("✓ žádné")
    for (const key of orphans) say("✗", `${key.padEnd(26)} leží v CMS, web ho ignoruje`)

    console.log("\n── Tlačítka")
    for (const [key, where] of [...usedButtons].sort()) {
        if (buttonKeys.has(key)) say("✓", `${key.padEnd(26)} ${where.length}× v kódu`)
        else say("✗", `${key.padEnd(26)} V CMS NENÍ — ${where[0]}`)
    }
    const unusedButtons = [...buttonKeys].filter((k) => k && !usedButtons.has(k)).sort()
    for (const key of unusedButtons) {
        console.log(`· ${key.padEnd(26)} v CMS je, kód ho zatím nečte`)
    }

    console.log(
        `\n${problems ? `✗ ${problems} nesrovnalostí` : "✓ kód a CMS souhlasí"}` +
            `  ·  ${blockKeys.size} bloků, ${buttonKeys.size} tlačítek, ${archivedKeys.size} v archivu\n`
    )
    if (problems) process.exitCode = 1
}

main().catch((error) => {
    console.error(`\nKontrola selhala: ${error.message}\n`)
    process.exitCode = 1
})
