// Přestěhování médií CMS z MinIO na Railway do Supabase Storage.
//
// Přístupy si načte sám ze `storefront/.env.local` (Supabase) a `.env.test`
// (databáze). Nic se nemusí exportovat:
//
//   node scripts/migrace-media-na-supabase.mjs preflight   # jen se rozhlédne
//   node scripts/migrace-media-na-supabase.mjs vse         # bucket → kopie → adresy → ověření
//
// ## Co se přenáší a co ne
//
// Soubory samotné a pole `url` v `cms_media`. `path` a `bucket` zůstávají —
// cesta je v obou úložištích stejná, takže se nic nepřepočítává a staré adresy
// se dají kdykoli zrekonstruovat jako `<stará doména>/<bucket>/<path>`. Proto
// se nikam neukládá záloha původní adresy: je odvoditelná.
//
// ## Proč se soubory stahují přes veřejnou adresu, a ne po S3
//
// MinIO na Railway servíruje bucket veřejně (ověřeno: `GET …/cms-media/<path>`
// vrací 200 bez podpisu), takže podepisování požadavků SigV4 by byla práce bez
// užitku. Navíc by to znamenalo tahat do skriptu S3 klíče, které tady nejsou
// potřeba.
//
// ## Na co si dát pozor
//
// Supabase Storage odmítne nahrát soubor do bucketu, který neexistuje, a
// bucket se **nezaloží sám**. Krok `bucket` ho vytváří jako **veřejný** —
// adresy v `cms_media.url` jsou veřejné a web je vkládá přímo do `<img>`.
// Kdyby byl bucket privátní, obrázky by se tiše nezobrazily.

import { readFileSync, existsSync } from "node:fs"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/** Načtení `.env` — komentář za hodnotou i mezery okolo, viz migrace databáze. */
const nactiEnv = (soubor) => {
    if (!existsSync(soubor)) return
    for (const radek of readFileSync(soubor, "utf8").split(/\r?\n/)) {
        const shoda = /^([A-Z0-9_]+)=(.*)$/.exec(radek.trim())
        if (!shoda) continue
        if (process.env[shoda[1]]) continue
        let hodnota = shoda[2].trim()
        const uvozovky = /^(['"])([\s\S]*)\1$/.exec(hodnota)
        hodnota = uvozovky ? uvozovky[2] : hodnota.replace(/\s+#.*$/, "").trim()
        process.env[shoda[1]] = hodnota
    }
}
nactiEnv(path.join(ROOT, ".env.test"))
nactiEnv(path.join(ROOT, ".env.local"))

const DB = process.env.CMS_TARGET_DATABASE_URL
const SUPABASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "")
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = process.env.CMS_MEDIA_BUCKET || process.env.CMS_S3_BUCKET || "cms-media"

/**
 * Odkud se soubory berou — veřejná adresa starého úložiště.
 *
 * **Nesmí se brát jen z `CMS_MEDIA_HOST`.** Ta proměnná se po dokončení
 * migrace přepíná na Supabase, takže by se z „staré úložiště" stalo „nové" a
 * ověření by pak hlásilo, že v obsahu jsou staré adresy — přitom by počítalo
 * ty nové. Stalo se; hlásilo 22 problémů u bezvadně přenesených dat.
 *
 * Proto má vlastní proměnnou a z `CMS_MEDIA_HOST` se bere jen tehdy, když na
 * Supabase ještě neukazuje.
 */
const CMS_MEDIA_HOST = (process.env.CMS_MEDIA_HOST || "").replace(/\/+$/, "")
const STARY_HOST = (
    process.env.CMS_STARE_ULOZISTE ||
    (CMS_MEDIA_HOST && !CMS_MEDIA_HOST.includes("supabase.co") ? CMS_MEDIA_HOST : "") ||
    process.env.CMS_S3_ENDPOINT ||
    ""
).replace(/\/+$/, "")

/** Je migrace už hotová? Pak se nekontroluje odkud, ale jestli je všechno na Supabase. */
const jeHotovo = () => !STARY_HOST || STARY_HOST.includes("supabase.co")

/* ── Pomůcky ────────────────────────────────────────────────────────────── */

const maskovat = (text) => {
    let v = String(text ?? "")
    for (const tajne of [SERVICE_KEY, DB]) {
        if (tajne && tajne.length > 8) v = v.split(tajne).join("***")
    }
    return v.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "***")
}

const rozeberDb = (url) => {
    const rest = url.slice(url.indexOf("://") + 3)
    const at = rest.lastIndexOf("@")
    const creds = rest.slice(0, at)
    const hp = rest.slice(at + 1)
    const c = creds.indexOf(":")
    const k = hp.search(/[/?#]/)
    const host = k >= 0 ? hp.slice(0, k) : hp
    const p = host.lastIndexOf(":")
    return {
        PGHOST: p > 0 ? host.slice(0, p) : host,
        PGPORT: p > 0 ? host.slice(p + 1) : "5432",
        PGUSER: creds.slice(0, c),
        PGPASSWORD: creds.slice(c + 1),
        PGDATABASE: (k >= 0 ? hp.slice(k + 1) : "postgres").split(/[?#]/)[0] || "postgres",
        PGSSLMODE: "require",
    }
}

const ODDELOVAC = "@@@R@@@"

const dotaz = (sql) =>
    new Promise((ok, ne) => {
        const proces = spawn("psql", ["-X", "-w", "-A", "-t", "-R", ODDELOVAC, "-c", sql], {
            env: { ...process.env, ...rozeberDb(DB) },
        })
        let o = ""
        let e = ""
        proces.stdout.on("data", (d) => (o += d))
        proces.stderr.on("data", (d) => (e += d))
        proces.on("error", (chyba) => ne(new Error(maskovat(chyba.message))))
        proces.on("close", (k) => (k === 0 ? ok(o) : ne(new Error(maskovat(e.slice(0, 400))))))
    })

const radky = (v) =>
    v
        .split(ODDELOVAC)
        .map((r) => r.trim())
        .filter(Boolean)

const hlavicky = () => ({
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
})

/** Veřejná adresa souboru v Supabase Storage. */
export const verejnaAdresa = (cesta) =>
    `${SUPABASE}/storage/v1/object/public/${BUCKET}/${cesta.split("/").map(encodeURIComponent).join("/")}`

/** Adresa téhož souboru ve starém MinIO. */
const staraAdresa = (cesta) => `${STARY_HOST}/${BUCKET}/${cesta}`

/* ── Seznam médií ───────────────────────────────────────────────────────── */

const seznamMedii = async () => {
    const vystup = await dotaz(
        `SELECT id || '|' || path || '|' || COALESCE(mime,'') || '|' || COALESCE(size_bytes,0)
         FROM cms_media ORDER BY created_at`,
    )
    return radky(vystup).map((r) => {
        const [id, cesta, mime, velikost] = r.split("|")
        return { id, cesta, mime: mime || "application/octet-stream", velikost: Number(velikost) }
    })
}

/* ── Rozhlédnutí ────────────────────────────────────────────────────────── */

const preflight = async () => {
    console.log("── Rozhlédnutí ──────────────────────────────────────────────\n")

    for (const [jmeno, hodnota] of [
        ["CMS_TARGET_DATABASE_URL (.env.test)", DB],
        ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE],
        ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY],
    ]) {
        if (!hodnota) throw new Error(`Chybí ${jmeno}.`)
    }
    if (jeHotovo()) {
        console.log("  (staré úložiště není nastavené — beru to jako už přestěhované)\n")
    }

    const media = await seznamMedii()
    const celkem = media.reduce((s, m) => s + m.velikost, 0)
    console.log(`zdroj   ${STARY_HOST}/${BUCKET}`)
    console.log(`cíl     ${SUPABASE}/storage/v1 → bucket „${BUCKET}"`)
    console.log(`         ${media.length} souborů, ${(celkem / 1024 / 1024).toFixed(1)} MB\n`)

    /* Vzorek: má smysl pokračovat jen když se ze starého úložiště vůbec čte. */
    if (media.length) {
        const odpoved = await fetch(staraAdresa(media[0].cesta), { method: "HEAD" })
        console.log(`  čtení ze starého úložiště: HTTP ${odpoved.status}`)
        if (!odpoved.ok) {
            throw new Error(
                `Ze starého úložiště se nedá číst (HTTP ${odpoved.status}). Bez toho není co kopírovat.`,
            )
        }
    }

    const buckety = await fetch(`${SUPABASE}/storage/v1/bucket`, { headers: hlavicky() })
    const seznam = buckety.ok ? await buckety.json() : []
    const nas = seznam.find?.((b) => b.name === BUCKET)
    const stavBucketu = nas
        ? `existuje, veřejný=${nas.public}`
        : "NEEXISTUJE — vytvoří ho krok bucket"
    console.log(`  bucket v Supabase:         ${stavBucketu}\n`)

    console.log("✓ Můžeme stěhovat.\n")
    return media
}

/* ── Bucket ─────────────────────────────────────────────────────────────── */

/**
 * Vytvoří bucket, a to **veřejný**.
 *
 * Adresy v `cms_media.url` jdou přímo do `<img src>`, takže privátní bucket by
 * znamenal web bez obrázků — a to bez jediné chyby v logu, protože prohlížeč
 * jen dostane 400 na obrázek.
 */
const bucket = async () => {
    console.log("── Bucket ───────────────────────────────────────────────────\n")

    const buckety = await fetch(`${SUPABASE}/storage/v1/bucket`, { headers: hlavicky() })
    const seznam = buckety.ok ? await buckety.json() : []
    if (seznam.find?.((b) => b.name === BUCKET)) {
        console.log(`✓ Bucket „${BUCKET}" už existuje.\n`)
        return
    }

    const odpoved = await fetch(`${SUPABASE}/storage/v1/bucket`, {
        method: "POST",
        headers: { ...hlavicky(), "Content-Type": "application/json" },
        body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    })
    if (!odpoved.ok) {
        throw new Error(`Bucket se nepodařilo vytvořit: HTTP ${odpoved.status} ${await odpoved.text()}`)
    }
    console.log(`✓ Bucket „${BUCKET}" vytvořen jako veřejný.\n`)
}

/* ── Kopie souborů ──────────────────────────────────────────────────────── */

const kopie = async () => {
    console.log("── Kopie souborů ────────────────────────────────────────────\n")

    const media = await seznamMedii()
    let hotovo = 0
    let preskoceno = 0
    const chyby = []

    for (const m of media) {
        /* Už nahraný soubor se znovu netahá — krok se dá pustit opakovaně. */
        const uz = await fetch(verejnaAdresa(m.cesta), { method: "HEAD" })
        if (uz.ok && Number(uz.headers.get("content-length")) === m.velikost) {
            preskoceno++
            continue
        }

        const zdroj = await fetch(staraAdresa(m.cesta))
        if (!zdroj.ok) {
            chyby.push(`${m.cesta}: ze starého úložiště HTTP ${zdroj.status}`)
            continue
        }
        const data = Buffer.from(await zdroj.arrayBuffer())

        const cil = await fetch(`${SUPABASE}/storage/v1/object/${BUCKET}/${m.cesta}`, {
            method: "POST",
            headers: {
                ...hlavicky(),
                "Content-Type": m.mime,
                /* Aby opakovaný běh přepsal nedokončený soubor a nespadl na konfliktu. */
                "x-upsert": "true",
            },
            body: data,
        })
        if (!cil.ok) {
            chyby.push(`${m.cesta}: nahrání HTTP ${cil.status} ${(await cil.text()).slice(0, 120)}`)
            continue
        }

        hotovo++
        if (hotovo % 10 === 0) console.log(`  … ${hotovo} nahráno`)
    }

    console.log(`\n  nahráno: ${hotovo}, přeskočeno (už tam bylo): ${preskoceno}, chyb: ${chyby.length}`)
    for (const chyba of chyby.slice(0, 15)) console.log(`   ✗ ${chyba}`)
    if (chyby.length) throw new Error(`${chyby.length} souborů se nepřeneslo.`)
    console.log("")
}

/* ── Adresy v databázi ──────────────────────────────────────────────────── */

/**
 * Přepíše `cms_media.url` na adresy v Supabase Storage.
 *
 * Až po úspěšné kopii — dokud soubory nejsou nahoře, je stará adresa ta
 * funkční. `path` ani `bucket` se nemění, takže původní adresa zůstává
 * odvoditelná a krok je vratný.
 */
const adresy = async () => {
    console.log("── Adresy v databázi ────────────────────────────────────────\n")

    const media = await seznamMedii()
    const zapisy = media
        .map((m) => `(${escapeLiteral(m.id)}, ${escapeLiteral(verejnaAdresa(m.cesta))})`)
        .join(", ")

    await dotaz(
        `UPDATE cms_media AS m SET url = v.url, updated_at = now()
         FROM (VALUES ${zapisy}) AS v(id, url)
         WHERE m.id::text = v.id AND m.url IS DISTINCT FROM v.url`,
    )

    const zbyva = await dotaz(
        `SELECT count(*) FROM cms_media WHERE url NOT LIKE ${escapeLiteral(SUPABASE + "%")}`,
    )
    console.log(`  záznamů mimo Supabase: ${radky(zbyva)[0]} (má být 0)\n`)
    if (Number(radky(zbyva)[0]) > 0) throw new Error("Některé adresy se nepřepsaly.")
    console.log("✓ Adresy přepsané.\n")
}

/** Uvozování pro SQL — data jdou z databáze, ale skládat řetězce naslepo se nemá. */
const escapeLiteral = (hodnota) => `'${String(hodnota).replace(/'/g, "''")}'`

/* ── Odkazy vložené v obsahu ────────────────────────────────────────────── */

/**
 * Přepíše adresy médií **vložené přímo v dokumentech CMS**.
 *
 * Tohle je krok, na který se dá nejsnáz zapomenout, a jeho vynechání vypadá
 * jako nepovedená migrace: soubory jsou nahoře, `cms_media.url` ukazuje správně,
 * a web přesto tahá obrázky ze starého úložiště. Změřeno — 13 dokumentů
 * a 77 výskytů.
 *
 * Důvod: bloky typu `siteCopy` si absolutní adresu obrázku nesou ve svém
 * vlastním JSONu, ne odkazem do `cms_media`. Knihovna médií je tedy evidence,
 * ne jediné místo pravdy.
 *
 * Přepisují se i **revize**, byť je to historie: kdyby se revize obnovila,
 * vrátila by staré adresy zpátky.
 *
 * Nahrazuje se jen předpona `<staré úložiště>/<bucket>/`, takže odkazy na
 * Instagram, Facebook a mapy zůstávají nedotčené (ověřeno, že jiné domény
 * v obsahu jsou právě tyhle).
 */
const odkazy = async () => {
    console.log("── Odkazy v obsahu ──────────────────────────────────────────\n")

    const stara = `${STARY_HOST}/${BUCKET}/`
    const nova = `${SUPABASE}/storage/v1/object/public/${BUCKET}/`

    console.log(`  ${stara}`)
    console.log(`  → ${nova}\n`)

    for (const [tabulka, sloupec] of [
        ["cms_document", "data"],
        ["cms_document", "draft"],
        ["cms_document_revision", "body"],
    ]) {
        const pred = radky(
            await dotaz(
                `SELECT count(*) FROM ${tabulka}
                 WHERE ${sloupec}::text LIKE ${escapeLiteral("%" + STARY_HOST + "%")}`,
            ),
        )[0]

        if (Number(pred) > 0) {
            await dotaz(
                `UPDATE ${tabulka}
                 SET ${sloupec} = replace(${sloupec}::text, ${escapeLiteral(stara)}, ${escapeLiteral(nova)})::jsonb
                 WHERE ${sloupec}::text LIKE ${escapeLiteral("%" + STARY_HOST + "%")}`,
            )
        }

        const po = radky(
            await dotaz(
                `SELECT count(*) FROM ${tabulka}
                 WHERE ${sloupec}::text LIKE ${escapeLiteral("%" + STARY_HOST + "%")}`,
            ),
        )[0]

        console.log(`  ${tabulka}.${sloupec}: ${pred} → ${po}`)
        if (Number(po) > 0) {
            throw new Error(`${tabulka}.${sloupec} má pořád ${po} záznamů se starou adresou.`)
        }
    }

    console.log("\n✓ Vložené adresy přepsané.\n")
}

/* ── Ověření ────────────────────────────────────────────────────────────── */

const overit = async () => {
    console.log("── Ověření ──────────────────────────────────────────────────\n")

    const media = await seznamMedii()
    const problemy = []
    let sedi = 0

    for (const m of media) {
        const odpoved = await fetch(verejnaAdresa(m.cesta), { method: "HEAD" })
        if (!odpoved.ok) {
            problemy.push(`${m.cesta}: HTTP ${odpoved.status}`)
            continue
        }
        const velikost = Number(odpoved.headers.get("content-length"))
        if (m.velikost && velikost !== m.velikost) {
            problemy.push(`${m.cesta}: velikost ${velikost} ≠ ${m.velikost} v databázi`)
            continue
        }
        sedi++
    }

    /* Adresa v databázi musí ukazovat tam, odkud se to opravdu načte. */
    const spatneUrl = radky(
        await dotaz(
            `SELECT count(*) FROM cms_media WHERE url IS NULL OR url NOT LIKE ${escapeLiteral(SUPABASE + "%")}`,
        ),
    )[0]

    /*
     * Vložené adresy v obsahu — bez nich web tahá obrázky ze starého úložiště.
     * Hledá se stará doména; když ji neznáme (migrace hotová), hledá se místo
     * toho cokoli, co NENÍ na Supabase — odpověď na tutéž otázku z druhé strany.
     */
    const podminka = jeHotovo()
        ? `data::text ~ 'https?://(?!${SUPABASE.replace(/^https?:\/\//, "").replace(/\./g, "\\.")})[^"]*/cms-media/'`
        : `data::text LIKE ${escapeLiteral("%" + STARY_HOST + "%")}`

    const vlozene = jeHotovo()
        ? radky(
              await dotaz(
                  `SELECT count(*) FROM cms_document
                   WHERE data::text LIKE '%/cms-media/%'
                     AND data::text NOT LIKE ${escapeLiteral("%" + SUPABASE + "%")}`,
              ),
          )[0]
        : radky(
              await dotaz(
                  `SELECT (SELECT count(*) FROM cms_document WHERE data::text LIKE ${escapeLiteral("%" + STARY_HOST + "%")})
                        + (SELECT count(*) FROM cms_document WHERE draft::text LIKE ${escapeLiteral("%" + STARY_HOST + "%")})
                        + (SELECT count(*) FROM cms_document_revision WHERE body::text LIKE ${escapeLiteral("%" + STARY_HOST + "%")})`,
              ),
          )[0]

    console.log(`  souborů dostupných a ve správné velikosti: ${sedi} z ${media.length}`)
    console.log(`  adres mimo Supabase v cms_media:           ${spatneUrl} (má být 0)`)
    console.log(`  záznamů se starou adresou v obsahu:        ${vlozene} (má být 0)\n`)
    for (const problem of problemy.slice(0, 15)) console.log(`   ✗ ${problem}`)

    if (problemy.length || Number(spatneUrl) > 0 || Number(vlozene) > 0) {
        throw new Error(
            `Ověření našlo ${problemy.length + Number(spatneUrl) + Number(vlozene)} problémů.`,
        )
    }
    console.log("✓ Všechna média jsou v Supabase Storage a databáze na ně ukazuje.\n")
}

/* ── Běh ────────────────────────────────────────────────────────────────── */

const kroky = {
    preflight,
    bucket: async () => {
        await preflight()
        await bucket()
    },
    kopie,
    adresy,
    odkazy,
    overit,
    vse: async () => {
        await preflight()
        await bucket()
        await kopie()
        await adresy()
        await odkazy()
        await overit()
        console.log(
            "Hotovo. Přepni CMS_MEDIA_HOST na " +
                `${SUPABASE} a CMS_STORAGE_DRIVER nech na „supabase".\n`,
        )
    },
}

const krok = process.argv[2] || "preflight"
if (!kroky[krok]) {
    console.error(`Neznámý krok „${krok}". Použij: ${Object.keys(kroky).join(", ")}`)
    process.exit(2)
}
kroky[krok]().catch((chyba) => {
    console.error(`\n✗ ${maskovat(chyba.message)}\n`)
    process.exit(1)
})
