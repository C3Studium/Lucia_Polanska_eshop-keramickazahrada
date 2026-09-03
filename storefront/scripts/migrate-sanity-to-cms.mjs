// Sanity → ValeCMS. Jeden příkaz, opakovatelně.
//
//   node --import @c3studium/valecms/register.mjs scripts/migrate-sanity-to-cms.mjs
//     … nasucho, nic nezapíše; s --write doopravdy.
//
// `--import` zapne hook, kterým knihovna rozřeší `valecms.config` a
// `valecms.types` i mimo Next (od 0.1.28). Bez něj skript spadne na
// „Cannot find package 'valecms.types'".
//
// ## Co dělá
//
// Bere `content/sanity-export.json` — otisk celého datasetu, který stáhl
// `scripts/dump-sanity.mjs` — a přenese z něj do CMS dvě věci: obrázky do
// úložiště médií a texty jako bloky `siteCopy`. Produkty, ceny, sklad,
// objednávky, kurzy ani rezervace se nedotkne; ty drží Medusa a zůstávají tam.
//
// ## Proč přes knihovnu, a ne přímo SQL
//
// Zápis jde přes `createMediaRepository` a `createDocumentRepository` z
// `@c3studium/valecms/server`, tedy přesně tou cestou, kterou používá samo
// studio. Ručně sestavený INSERT by musel uhodnout tvar řádku, kontrolu typu
// souboru podle skutečných bytů, výpočet rozměrů i klíč objektu v bucketu — a
// první změna v knihovně by ho tiše rozešla s tím, co CMS čeká.
//
// ## Proč to jde pustit opakovaně
//
// Dvě nezávislé pojistky, obě z knihovny:
//
// - `media.upload()` počítá hash obsahu a stejné byty podruhé vrátí existující
//   řádek místo druhé kopie.
// - Dokumenty se hledají přes `getByLegacy({ source: 'sanity', legacyId })`.
//   Sloupce `legacy_source` a `legacy_id` jsou na to v tabulce právě proto;
//   `_id` ze Sanity je stabilní, takže druhý běh existující blok aktualizuje.
//
// Takže migrace není jednorázová akce, ale stav: pustí se, kolikrát je potřeba,
// a pokaždé srovná CMS s exportem.

import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"

/* ------------------------------------------------------------------ */
/* Prostředí                                                           */
/* ------------------------------------------------------------------ */

// Skript neběží uvnitř Nextu, takže `.env.local` si musí načíst sám.
const loadEnv = (file) => {
    if (!existsSync(file)) return
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
        const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
        if (!match) continue
        const [, key, raw] = match
        if (process.env[key]) continue
        process.env[key] = raw.replace(/^["']|["']$/g, "")
    }
}

const ROOT = process.cwd()
loadEnv(path.join(ROOT, ".env.local"))
loadEnv(path.join(ROOT, ".env"))

const WRITE = process.argv.includes("--write")
const FORCE = process.argv.includes("--force")
const VERBOSE = process.argv.includes("--verbose")
const EXPORT_FILE = path.join(ROOT, "content", "sanity-export.json")

/* ------------------------------------------------------------------ */
/* Mapování Sanity → siteCopy                                          */
/* ------------------------------------------------------------------ */

/**
 * Který dokument ze Sanity se stane kterým blokem.
 *
 * `key` je smlouva s kódem — komponenta si blok vyzvedne přesně pod tímhle
 * jménem — a `page` musí být jedna z hodnot, které deklaruje
 * `src/lib/valecms.config.ts`. Když tam stránka není, formulář hodnotu odmítne
 * hláškou „Neplatná volba", a to je chyba, kterou nikdo nehledá v konfiguraci.
 *
 * `title` je v schématu povinný, takže každý blok tu má náhradní nadpis pro
 * případ, že ho zdroj nenese.
 */
const BLOCKS = {
    introHero: { key: "index.hero", page: "index", title: "Úvodní hero" },
    newsText: { key: "index.news", page: "index", title: "Novinky" },
    ecomIntro: { key: "index.ecom-intro", page: "index", title: "Úvod e-shopu" },
    ecomEntry: { key: "index.ecom-entry", page: "index", title: "Vstup do e-shopu" },
    ecomDesc: { key: "index.ecom-desc", page: "index", title: "Popis e-shopu" },
    ecomCTA: { key: "index.ecom-cta", page: "index", title: "Výzva e-shopu" },
    mainPageSettings: { key: "index.sections", page: "index", title: "Zapnuté sekce" },

    kurzyIntro: { key: "kurzy.intro", page: "kurzy", title: "Úvod kurzů" },
    kurzyAbout: { key: "kurzy.about", page: "kurzy", title: "O kurzech" },
    kurzyCTA: { key: "kurzy.cta", page: "kurzy", title: "Výzva kurzů" },
    kurzySettings: { key: "kurzy.sections", page: "kurzy", title: "Zapnuté sekce" },

    aboutHero: { key: "o-mne.hero", page: "o-mne", title: "O mně" },

    kontakt: { key: "global.kontakt", page: "global", title: "Kontakt" },
    mapa: { key: "global.mapa", page: "global", title: "Kde nás najdete" },
    newsPopup: { key: "global.news-popup", page: "global", title: "Oznámení" },
}

/**
 * Která pole zdroje jdou do `title`, `headline` a `body`.
 *
 * Zbytek se nezahazuje — spadne do `items` jako `{ label, value }`, aby po
 * migraci nechyběl žádný text, který na webu dneska je. Radši blok, ve kterém
 * je něco navíc, než tiše ztracená věta.
 */
const FIELD_MAP = {
    // Jméno a příjmení zůstávají oddělené — hero je sází pod sebe jako podpis,
    // a slepené do jednoho pole by se v CMS nedaly rozdělit zpátky.
    introHero: { title: ["title1"], headline: ["title2"], body: ["content"] },
    newsText: { body: ["text"] },
    /*
     * Nadpis e-shopové sekce je sázený na tři řádky („Vítejte" / „v Keramické" /
     * „Zahradě"), takže se části nesmí slepit — zpátky by je nikdo nerozdělil,
     * „v Keramické" není jedno slovo. První jde do `title`, druhá do `headline`,
     * třetí spadne mezi `items` pod svým původním jménem.
     */
    ecomIntro: { title: ["title1"], headline: ["title2"], body: ["content1", "content2"] },
    ecomEntry: { title: ["title"], body: ["rotatingText"] },
    ecomDesc: { title: ["maintitle"] },
    ecomCTA: { title: ["title"], body: ["buttonText"] },
    kurzyIntro: { body: ["content"] },
    kurzyCTA: { title: ["title"], body: ["content"] },
    kontakt: { title: ["contactTitle"], headline: ["newsletterTitle"] },
    mapa: { title: ["title"], headline: ["titleSection"], body: ["address"] },
    newsPopup: { body: ["text"] },
}

/** Pole, která nesou obrázek nebo galerii. */
const IMAGE_FIELDS = new Set(["image", "backgroundImage", "pillarImage"])
const GALLERY_FIELDS = new Set(["images"])

/* ------------------------------------------------------------------ */
/* Převody hodnot                                                      */
/* ------------------------------------------------------------------ */

const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")

/**
 * `richText` drží knihovna jako HTML string (viz `core/fieldTypes.js`).
 * Texty ze Sanity jsou holé řetězce s prázdnými řádky mezi odstavci, takže
 * převod je rozdělit na odstavce a obalit je — ne uložit syrový text, který by
 * se v editoru zobrazil jako jeden slepenec.
 */
const toRichText = (value) => {
    const text = String(value ?? "").trim()
    if (!text) return ""
    return text
        .split(/\n{2,}/)
        .map((para) => `<p>${escapeHtml(para.trim()).replace(/\n/g, "<br />")}</p>`)
        .join("\n")
}

const isScalar = (value) =>
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"

/**
 * Zbylá pole na plochý seznam `{ label, value }`.
 *
 * Vnořené objekty se rozloží na tečkované popisky (`ecomSection.desc.benefits`)
 * místo jednoho JSON bloku. Přepínače sekcí ze Sanity jsou zanořené tři úrovně
 * hluboko a jako slepený JSON v textovém poli by se nedaly upravit — rozložené
 * jsou to jednotlivé řádky, u kterých je vidět, co dělají.
 */
const flatten = (value, prefix, out = []) => {
    if (value == null || value === "") return out
    if (isScalar(value)) {
        out.push({ lead: "", label: prefix, value: String(value), note: "" })
        return out
    }
    if (Array.isArray(value)) {
        value.forEach((entry, index) => flatten(entry, `${prefix}[${index}]`, out))
        return out
    }
    for (const [name, inner] of Object.entries(value)) {
        if (name.startsWith("_")) continue
        flatten(inner, `${prefix}.${name}`, out)
    }
    return out
}

/* ------------------------------------------------------------------ */
/* Běh                                                                 */
/* ------------------------------------------------------------------ */

const log = (...args) => console.log(...args)

const main = async () => {
    if (!existsSync(EXPORT_FILE)) {
        throw new Error(
            `Chybí ${path.relative(ROOT, EXPORT_FILE)} — nejdřív spusťte scripts/dump-sanity.mjs.`
        )
    }
    const docs = JSON.parse(readFileSync(EXPORT_FILE, "utf8"))

    // Assety jsou v exportu jako samostatné dokumenty; obsah na ně odkazuje
    // přes `asset._ref`.
    const assets = new Map(
        docs.filter((d) => d._type === "sanity.imageAsset").map((d) => [d._id, d])
    )
    const content = docs.filter((d) => BLOCKS[d._type])

    log(`Export: ${docs.length} dokumentů — ${content.length} obsahových, ${assets.size} obrázků.`)
    const unknown = [...new Set(docs.map((d) => d._type))].filter(
        (t) => !BLOCKS[t] && t !== "sanity.imageAsset" && t !== "product"
    )
    if (unknown.length) {
        log(`Bez mapování (přeskočí se): ${unknown.join(", ")}`)
    }

    const { getAdminClient, createStorageFromEnv, createMediaRepository, createDocumentRepository } =
        await import("@c3studium/valecms/server")

    const client = getAdminClient()
    const documents = createDocumentRepository({ client })

    /* -------------------------------------------------------------- */
    /* Pojistka: píšeme do správné databáze?                           */
    /* -------------------------------------------------------------- */
    //
    // Migrace je automatická, takže se musí sama umět zastavit. `DATABASE_URL`
    // se dá snadno zkopírovat z jiného projektu — a nalít obsah keramiky mezi
    // cizí data je přesně ten druh chyby, po které se těžko uklízí.
    //
    // Pravidlo: v cílové databázi nesmí být dokument, který nepochází odsud.
    const existing = await documents.list({ limit: 500 })
    const rows = existing?.rows ?? existing?.data ?? existing ?? []
    const foreign = (Array.isArray(rows) ? rows : []).filter(
        (row) => (row.legacySource ?? row.legacy_source ?? null) !== "sanity"
    )
    if (foreign.length && !FORCE) {
        const types = [...new Set(foreign.map((r) => r.type))].join(", ")
        const message =
            `V cílové databázi je ${foreign.length} dokumentů, které nepocházejí ze Sanity ` +
            `(typy: ${types}).\n` +
            `Vypadá to na databázi jiného webu. Zkontrolujte DATABASE_URL.\n` +
            `Když opravdu chcete psát sem, spusťte znovu s --force.`
        // Nasucho se nic nezapisuje, takže cizí databáze není důvod skončit —
        // je to varování. Zastavit se musí až běh, který by opravdu psal.
        if (WRITE) throw new Error(message)
        console.warn(`\nPOZOR: ${message}\n`)
    }

    /* -------------------------------------------------------------- */
    /* Obrázky                                                         */
    /* -------------------------------------------------------------- */

    const storage = createStorageFromEnv()
    const media = createMediaRepository({
        client,
        storage,
        // Migrace nese fotky, které na webu už roky jsou; limit pro ruční
        // nahrání (8 MB) by je odmítl a stránka by zůstala bez obrázku.
        maxBytes: 64 * 1024 * 1024,
    })

    /** Obrázky, které úložiště odmítlo — vypíšou se na konci. */
    const skippedImages = []

    /** Sanity asset `_id` → řádek v `cms_media`. */
    const uploaded = new Map()

    const ingest = async (ref) => {
        if (!ref) return null
        if (uploaded.has(ref)) return uploaded.get(ref)
        const asset = assets.get(ref)
        if (!asset?.url) {
            log(`  ! obrázek ${ref} není v exportu — přeskočeno`)
            return null
        }
        if (!WRITE) {
            uploaded.set(ref, { id: `dry-${createHash("sha1").update(ref).digest("hex").slice(0, 8)}` })
            return uploaded.get(ref)
        }
        const response = await fetch(asset.url)
        if (!response.ok) {
            log(`  ! stažení ${asset.url} selhalo (${response.status}) — přeskočeno`)
            return null
        }
        const buffer = Buffer.from(await response.arrayBuffer())
        const filename = (asset.originalFilename || `${ref}.jpg`).replace(/[\\/\0]/g, "-")
        /*
         * Jeden odmítnutý soubor nesmí zabít celý běh.
         *
         * Knihovna typ souboru neuhaduje z přípony — čte skutečné byty a
         * povoluje jen rastr a PDF. SVG je vědomě mimo (umí nést skript), a
         * v datech ze Sanity jedno je. Než aby migrace skončila po osmi
         * blocích a nechala obsah rozpůlený, přeskočí se ten obrázek a řekne
         * se to nahlas na konci: blok vznikne, jen bez něj.
         */
        try {
            const row = await media.upload(
                { buffer, filename, mime: asset.mimeType },
                { alt: asset.altText || asset.title || "" }
            )
            uploaded.set(ref, row)
            return row
        } catch (error) {
            skippedImages.push(`${filename} (${asset.mimeType || "neznámý typ"})`)
            log(`  ! ${filename}: ${error.message}`)
            uploaded.set(ref, null)
            return null
        }
    }

    /** Snímek média tak, jak ho dokument nese ve svých datech. */
    const imageValue = (row) =>
        row && {
            id: row.id,
            alt: row.alt ?? "",
            url: row.url,
            mime: row.mime,
            size: Number(row.sizeBytes ?? row.size_bytes ?? 0),
            width: row.width ?? null,
            height: row.height ?? null,
            filename: String(row.path ?? "").split("/").pop() ?? "",
            createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
        }

    const refOf = (value) =>
        value?.asset?._ref ?? (typeof value?._ref === "string" ? value._ref : null)

    /* -------------------------------------------------------------- */
    /* Bloky                                                           */
    /* -------------------------------------------------------------- */

    let created = 0
    let updated = 0
    let images = 0

    for (const doc of content) {
        const block = BLOCKS[doc._type]
        const map = FIELD_MAP[doc._type] ?? {}
        const consumed = new Set(["_id", "_type", "_rev", "_createdAt", "_updatedAt"])

        const join = (names) => {
            const parts = []
            for (const name of names ?? []) {
                consumed.add(name)
                const value = doc[name]
                if (typeof value === "string" && value.trim()) parts.push(value.trim())
            }
            return parts.join(" ")
        }

        const data = {
            key: block.key,
            page: block.page,
            title: join(map.title) || block.title,
        }
        const headline = join(map.headline)
        if (headline) data.headline = headline
        const body = join(map.body)
        if (body) data.body = toRichText(body)

        // Obrázky a galerie.
        for (const [name, value] of Object.entries(doc)) {
            if (consumed.has(name)) continue
            if (IMAGE_FIELDS.has(name)) {
                consumed.add(name)
                const row = await ingest(refOf(value))
                if (row) {
                    data.image = imageValue(row)
                    images += 1
                }
            } else if (GALLERY_FIELDS.has(name) && Array.isArray(value)) {
                consumed.add(name)
                const gallery = []
                for (const entry of value) {
                    const row = await ingest(refOf(entry))
                    if (row) {
                        gallery.push(imageValue(row))
                        images += 1
                    }
                }
                if (gallery.length) data.gallery = gallery
            }
        }

        // Co zbylo, ať se neztratí — kromě vnitřností Sanity. Klíče s
        // podtržítkem (`_rev`, `_system`, …) patří systému, ze kterého
        // odcházíme; přenést je do CMS by znamenalo mít v obsahu řádky, které
        // nikomu nic neříkají a nikdy se nezmění.
        const items = []
        for (const [name, value] of Object.entries(doc)) {
            if (consumed.has(name) || name.startsWith("_")) continue
            flatten(value, name, items)
        }
        if (items.length) data.items = items

        /*
         * Existuje ten blok už? Ptáme se i nasucho.
         *
         * Dřív se tahle otázka v suchém běhu přeskakovala a všechno se počítalo
         * jako nové — takže po dokončené migraci hlásil „14 nových", což vypadá
         * jako by druhý běh chtěl všechno zdvojit. Je to čtení, ne zápis, takže
         * v suchém režimu nic nestojí a počty konečně odpovídají tomu, co by
         * `--write` udělal.
         */
        const existing = await documents
            .getByLegacy({ source: "sanity", legacyId: doc._id })
            .catch(() => null)

        if (!WRITE) {
            log(
                `  [nasucho] ${existing ? "~" : "+"} ${block.key} — ${Object.keys(data).join(", ")}`
            )
            // `--verbose` vypíše, co by se doopravdy zapsalo. Bez toho je
            // nasucho jen seznam jmen polí a nikdo nepozná, že se třeba text
            // převedl na HTML špatně.
            if (VERBOSE) log(JSON.stringify(data, null, 2).replace(/^/gm, "      "))
            if (existing) updated += 1
            else created += 1
            continue
        }

        const found = existing
        const now = new Date().toISOString()
        if (found) {
            /*
             * Dva kroky, ne jeden.
             *
             * `update()` zapisuje jen KONCEPT — `status` ani `publishedAt`
             * nebere. Původně tu stálo `update({ …, status: "published" })`
             * a vypadalo to jako publikace; ve skutečnosti by přepsaný blok
             * zůstal v konceptu a na web se nedostal. Při první migraci to
             * nevadilo, protože všechny bloky se zakládaly větví níž přes
             * `importRow` a tahle se nespustila ani jednou — projevilo by se
             * to až při druhém běhu nad naplněnou databází.
             */
            await documents.update({ id: found.id, data })
            await documents.publish({ id: found.id })
            updated += 1
            log(`  ~ ${block.key}`)
        } else {
            await documents.importRow({
                id: crypto.randomUUID(),
                type: "siteCopy",
                status: "published",
                data,
                draft: null,
                created_at: doc._createdAt ?? now,
                updated_at: now,
                published_at: now,
                legacy_source: "sanity",
                legacy_id: doc._id,
            })
            created += 1
            log(`  + ${block.key}`)
        }
    }

    log(
        `\n${WRITE ? "Hotovo" : "Nasucho"}: ${created} nových, ${updated} aktualizovaných, ` +
        `${images} odkazů na obrázky (${uploaded.size} unikátních souborů).`
    )
    if (skippedImages.length) {
        // Nahlas a jmenovitě: blok bez obrázku vypadá jako hotový, dokud si ho
        // někdo neotevře. Tohle je jediné místo, kde se to dá zachytit.
        log(`\nObrázky, které úložiště odmítlo (${skippedImages.length}) — bloky vznikly bez nich:`)
        for (const name of skippedImages) log(`  · ${name}`)
    }
    if (!WRITE) log("Nic se nezapsalo. Spusťte znovu s --write.")
}

main().catch((error) => {
    console.error(`\nMigrace selhala: ${error.message}`)
    process.exit(1)
})
