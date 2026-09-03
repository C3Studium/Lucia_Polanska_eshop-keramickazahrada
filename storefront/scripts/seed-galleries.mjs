// Galerie fotek do CMS.
//
// Spuštění:
//   node --import @c3studium/valecms/register.mjs scripts/seed-galleries.mjs
//   node --import @c3studium/valecms/register.mjs scripts/seed-galleries.mjs --write
//
// Fotky z `public/` už v knihovně médií leží (scripts/migrate-public-to-cms.mjs).
// Tenhle skript k nim založí bloky `siteCopy`, přes které si je komponenty
// vyzvednou — bez bloku je fotka v knihovně, ale stránka o ní neví.
//
// ---------------------------------------------------------------------------
// Proč `gallery`, a ne `image`
//
// `siteCopy` má obojí: `image` pro jednu fotku a `gallery` pro pole. Všechny
// čtyři skupiny jsou uspořádané sady, kde na pořadí záleží — sedm kroků výroby
// není sedm nezávislých obrázků. `gallery` drží pořadí a Studio ho umí
// přetahovat myší; sedm samostatných polí `image` by pořadí zakódovalo do
// jmen a přehodit dva kroky by znamenalo přepsat obě.
//
// ---------------------------------------------------------------------------
// Existující blok se nepřepisuje
//
// Stejné pravidlo jako u tlačítek: seed zakládá výchozí stav, ne pravdu.
// Kdyby přepisoval, druhé spuštění by vrátilo galerii na to, co bylo v kódu,
// a redaktorka by o změny přišla, aniž by se čehokoli dotkla.

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

/**
 * Bloky a fotky, které nesou.
 *
 * `soubory` jsou jména v knihovně BEZ otisku, který k nim úložiště přidalo —
 * hledá se podle konce cesty, protože prefix je detail uložení, ne identita.
 * Pořadí je pořadí na stránce.
 */
const GALLERIES = [
    {
        key: "vyroba.galerie",
        page: "vyroba",
        title: "Kroky výroby",
        soubory: [
            "vyroba-1.png",
            "vyroba-2.png",
            "vyroba-3.png",
            "vyroba-4.png",
            "vyroba-5.png",
            "vyroba-6.png",
            "galerie-1.jpg",
        ],
    },
    {
        key: "o-mne.galerie",
        page: "o-mne",
        title: "Fotky k příběhu",
        soubory: ["o-mne-1.png", "o-mne-2.png", "o-mne-3.png", "o-mne-4.png"],
    },
    {
        key: "dotazy.galerie",
        page: "dotazy",
        title: "Fotky u dotazů",
        // Malými písmeny a s pomlčkami: úložiště jména normalizuje při nahrání,
        // takže `FAQ1.png` je v knihovně `dotazy-faq1.png`. Hledá se podle toho,
        // co v knihovně opravdu leží, ne podle toho, jak se soubor jmenoval na disku.
        soubory: ["dotazy-faq1.png", "dotazy-faq2.png", "dotazy-faq3.png", "dotazy-faq4.png"],
    },
    {
        // Tři typy kurzů — dětské, skupinové, výsledek. Úvod stránky si své
        // tři fotky bere z `kurzy.intro`, tohle je jiná trojice níž.
        key: "kurzy.galerie",
        page: "kurzy",
        title: "Fotky u typů kurzů",
        soubory: ["galerie-4.jpg", "galerie-9.jpg", "galerie-2.jpg"],
    },
    {
        // Pozadí přihlašovacího a registračního modalu. Jedna fotka, ale
        // vlastní blok: je to jediné místo, kde ji návštěvník potká, a míchat
        // ji mezi fotky úvodní stránky by znamenalo, že se změní obojí naráz.
        key: "global.prihlaseni",
        page: "global",
        title: "Fotka u přihlášení",
        soubory: ["galerie-1.jpg"],
    },
    {
        key: "index.galerie",
        page: "index",
        title: "Plovoucí galerie",
        soubory: [
            "galerie-1.jpg",
            "galerie-2.jpg",
            "galerie-3.jpg",
            "galerie-4.jpg",
            "galerie-5.jpg",
            "galerie-6.jpg",
            "galerie-7.jpg",
            "galerie-8.jpg",
            "galerie-9.jpg",
            "galerie-10.jpg",
            "galerie-11.jpg",
            "galerie-12.jpg",
            "galerie-home-image.png",
        ],
    },
]

/** Snímek média tak, jak ho blok nese ve svých datech. */
const imageValue = (row) => ({
    id: row.id,
    alt: row.alt ?? "",
    url: row.url,
    mime: row.mime,
    size: Number(row.sizeBytes ?? row.size_bytes ?? 0),
    width: row.width ?? null,
    height: row.height ?? null,
    filename: String(row.path ?? "").split("/").pop() ?? "",
})

const main = async () => {
    log(`\nGalerie do CMS${WRITE ? "" : "  (nasucho)"}\n`)

    if (!process.env.DATABASE_URL && WRITE) {
        throw new Error(
            "Chybí DATABASE_URL — zapisovalo by se do vývojového úložiště .cms-dev/, ne do databáze."
        )
    }

    const { getAdminClient, createStorageFromEnv, createDocumentRepository, createMediaRepository } =
        await import("@c3studium/valecms/server")

    const client = getAdminClient()
    const documents = createDocumentRepository({ client })
    const media = createMediaRepository({ client, storage: createStorageFromEnv() })

    // Celá knihovna jednou; hledání pak běží nad pamětí, ne přes dotaz na foto.
    let rows = []
    for (let p = 1; p <= 20; p += 1) {
        const page = await media.list({ page: p, perPage: 100 })
        const list = page?.rows ?? []
        if (!list.length) break
        rows = rows.concat(list)
        if (rows.length >= (page.total ?? 0)) break
    }

    /** Podle jména bez otisku úložiště. */
    const find = (name) =>
        rows.find((row) => String(row.path ?? "").split("/").pop()?.endsWith(`-${name}`)) ??
        rows.find((row) => String(row.path ?? "").split("/").pop() === name)

    log(`V knihovně ${rows.length} souborů.\n`)

    let created = 0
    let kept = 0
    const missing = []
    const now = new Date().toISOString()

    for (const gallery of GALLERIES) {
        const found = await documents
            .getByLegacy({ source: "kod", legacyId: gallery.key })
            .catch(() => null)

        if (found) {
            kept += 1
            log(`  = ${gallery.key.padEnd(16)} už v CMS — nepřepisuji`)
            continue
        }

        const images = []
        for (const name of gallery.soubory) {
            const row = find(name)
            if (!row) {
                missing.push(`${gallery.key}: ${name}`)
                continue
            }
            images.push(imageValue(row))
        }

        log(`  + ${gallery.key.padEnd(16)} ${images.length}/${gallery.soubory.length} fotek`)

        if (!WRITE) {
            created += 1
            continue
        }

        await documents.importRow({
            id: crypto.randomUUID(),
            type: "siteCopy",
            status: "published",
            data: {
                key: gallery.key,
                page: gallery.page,
                title: gallery.title,
                gallery: images,
            },
            draft: null,
            created_at: now,
            updated_at: now,
            published_at: now,
            legacy_source: "kod",
            legacy_id: gallery.key,
        })
        created += 1
    }

    log(
        `\n${WRITE ? "Hotovo" : "Nasucho"}: ${created} ${WRITE ? "založeno" : "k založení"}, ` +
            `${kept} ponecháno.`
    )
    if (missing.length) {
        log(`\nFotky, které se v knihovně nenašly (blok vznikne bez nich):`)
        for (const line of missing) log(`  ! ${line}`)
    }
    if (!WRITE) log(`\nSpusťte znovu s --write.`)
    log("")
}

main().catch((error) => {
    console.error(`\nSeed selhal: ${error.message}\n`)
    process.exitCode = 1
})
