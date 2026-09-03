// Fotky z `public/` do knihovny médií.
//
// Spuštění:
//   node --import @c3studium/valecms/register.mjs scripts/migrate-public-to-cms.mjs
//   node --import @c3studium/valecms/register.mjs scripts/migrate-public-to-cms.mjs --write
//
// Bez `--write` je to nasucho: přečte soubory, řekne, co by nahrálo, a nesáhne
// na nic. Registrační zavaděč je potřeba proto, že knihovna se dováží ze
// zdrojů (`.jsx`, `.scss`) a Node je sám neumí.
//
// ---------------------------------------------------------------------------
// Co se stěhuje a co ne
//
// Jen OBSAH — fotky, které má klient měnit bez nasazení. `public/` je jinak
// plné věcí, které do CMS nepatří a jejichž přesun by byl regrese:
//
//   fonty      `@font-face` je adresuje relativní cestou z vlastního CSS;
//              z bucketu by přibylo DNS, TLS a problém s CORS za nic
//   ikony      rozhraní webu, ne obsah — klient je needituje a jejich načtení
//              přes síť by zdrželo vykreslení chromu
//   favicon    prohlížeč ho čeká na `/favicon.ico`
//   zástupné   `*_prop.png`, `mask.png` — technické podklady šablon
//   balikovna  logo dopravce, mění se s dopravcem, ne s obsahem
//
// Roller (30 fotek) v knihovně UŽ JE — přišel tam s migrací ze Sanity. Nahrání
// je idempotentní přes otisk obsahu, takže se sem klidně smí zahrnout: stejné
// byty podruhé vrátí existující řádek místo duplikátu. Je to zároveň pojistka
// pro případ, že by se knihovna někdy stavěla znovu od nuly.
//
// ---------------------------------------------------------------------------
// Proč se soubory přejmenovávají
//
// `upload()` bere jméno, ne cestu — složka v knihovně se odvozuje z klíče
// v úložišti, ne z toho, odkud soubor přišel. Bez prefixu by se `vyroba/1.png`
// a `ome/1.png` v knihovně obě jmenovaly „1.png" a editor by je od sebe
// nerozeznal. Prefix původu je proto součástí jména, ne dekorace.

import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PUBLIC = path.join(ROOT, "public")

/*
 * Prostředí si skript musí načíst sám — neběží uvnitř Nextu.
 *
 * Bez tohohle se `getAdminClient()` nemá čím připojit a knihovna MLČKY spadne
 * na vývojové souborové úložiště v `.cms-dev/store.json`. Běh doběhne, vypíše
 * šedesát dva nových identifikátorů a bude vypadat úspěšně — jenom to všechno
 * skončí na disku vedle projektu místo v databázi a v bucketu. Stalo se to;
 * proto tenhle blok stojí nahoře a ne dole.
 */
const loadEnv = (file) => {
    if (!fs.existsSync(file)) return
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
        if (!match) continue
        const [, key, raw] = match
        // Skutečné prostředí má přednost před souborem.
        if (process.env[key]) continue
        process.env[key] = raw.replace(/^["']|["']$/g, "")
    }
}

loadEnv(path.join(ROOT, ".env.local"))
loadEnv(path.join(ROOT, ".env"))

const WRITE = process.argv.includes("--write")
const FORCE = process.argv.includes("--force")

const log = (message) => console.log(message)

/**
 * Co se stěhuje. Klíč je složka pod `public/assets/`, hodnota prefix jména
 * v knihovně.
 *
 * Vyjmenované schválně, ne `find` přes celé `public/`. Seznam, který se plní
 * sám, by při příštím přírůstku do `public/` tiše nahrál i to, co tam patřit
 * nemá — a odebrat soubor z knihovny, na který už někdo odkázal blok, je
 * dražší než ho tam nedat.
 */
const GROUPS = [
    { dir: "img/img", prefix: "galerie", label: "Plovoucí galerie" },
    { dir: "img/faq", prefix: "dotazy", label: "Časté dotazy" },
    { dir: "img/vyroba", prefix: "vyroba", label: "Výroba" },
    { dir: "img/ome", prefix: "o-mne", label: "O mně" },
    /*
     * `img/roller` tu SCHVÁLNĚ NENÍ.
     *
     * Těch třicet fotek v knihovně už je — přišly s migrací ze Sanity a bloky
     * (`index.ecom-cta` a další) je odkazují podle identifikátoru.
     *
     * Doufal jsem, že je otisk obsahu pozná a nahrání je jen vrátí. Nepozná:
     * Sanity je při nahrání překódovala, takže bajty se liší a knihovna je
     * právem považuje za jiné soubory. Běh je založil znovu a v knihovně byla
     * každá fotka rolleru dvakrát — jednou používaná, jednou ne. Smazáno.
     *
     * Kdyby se knihovna někdy stavěla od nuly, tenhle řádek se sem vrátí:
     *     { dir: "img/roller", prefix: "roller", label: "Roller" },
     */
    { dir: "links", prefix: "odkaz", label: "Náhledy odkazů" },
    /*
     * Volné fotky přímo v `img/`.
     *
     * Vyjmenované, protože ta složka není jen fotky: leží v ní i logo dopravce
     * (`balikovna.svg`), zástupné podklady šablon (`*_prop.png`) a obrázky
     * ukázkových produktů (`image12`–`image21.png`), které patří Meduse.
     * Přečíst celou složku by do knihovny nasypalo právě tohle.
     *
     * `bearphoto` a `kittenphoto` dnes nikde nevisí — jdou tam na výslovné
     * přání, ať je klient má po ruce. Nepoužitá fotka v knihovně nikomu
     * nevadí; filtr „Jen nepoužité" ji najde, až bude potřeba uklidit.
     */
    {
        dir: "img",
        prefix: "foto",
        label: "Volné fotky",
        only: ["bearphoto.png", "kittenphoto.png", "flowerphoto.png"],
    },
]

/** Rastr a nic jiného — knihovna čte skutečné byty a SVG vědomě nebere. */
const RASTER = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"])

const MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".gif": "image/gif",
}

/** Soubory jedné skupiny, seřazené přirozeně — `2.jpg` před `10.jpg`. */
const filesOf = (group) => {
    const dir = path.join(PUBLIC, "assets", group.dir)
    let names = []
    try {
        names = fs.readdirSync(dir)
    } catch {
        return []
    }
    return names
        .filter((name) => (group.only ? group.only.includes(name) : true))
        .filter((name) => RASTER.has(path.extname(name).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, "cs", { numeric: true }))
        .map((name) => ({
            source: path.join(dir, name),
            // `galerie-1.jpg`, `vyroba-main.png` — původ je součástí jména,
            // protože v knihovně už žádný jiný údaj o něm nezbude.
            filename: `${group.prefix}-${name}`,
            mime: MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream",
        }))
}

const main = async () => {
    const plan = GROUPS.map((group) => ({ group, files: filesOf(group) })).filter(
        (entry) => entry.files.length
    )
    const total = plan.reduce((sum, entry) => sum + entry.files.length, 0)

    log(`\nFotky z public/ → knihovna médií${WRITE ? "" : "  (nasucho)"}`)
    for (const { group, files } of plan) {
        log(`  ${group.label.padEnd(28)} ${String(files.length).padStart(3)} souborů`)
    }
    log(`  ${"celkem".padEnd(28)} ${String(total).padStart(3)} souborů\n`)

    if (!total) {
        log("Není co nahrávat.")
        return
    }

    /*
     * Píšeme do opravdové databáze a opravdového bucketu?
     *
     * Když chybí přístupy, knihovna se nezastaví — přepne se na vývojové
     * souborové úložiště a běh vypadá úspěšně. Nahlásit to až podle jedné
     * věty ve výpisu je málo, protože ta věta se snadno přehlédne mezi
     * šedesáti řádky. Chybějící proměnná musí běh zastavit dřív, než se
     * začne nahrávat.
     */
    const REQUIRED = [
        "DATABASE_URL",
        "CMS_S3_ENDPOINT",
        "CMS_S3_BUCKET",
        "CMS_S3_ACCESS_KEY_ID",
        "CMS_S3_SECRET_ACCESS_KEY",
    ]
    const missing = REQUIRED.filter((name) => !process.env[name])
    if (missing.length && WRITE) {
        throw new Error(
            `Chybí přístupy: ${missing.join(", ")}.\n` +
                `Bez nich by se zapisovalo do vývojového úložiště .cms-dev/ a ne do bucketu.\n` +
                `Zkontrolujte .env.local.`
        )
    }

    const { getAdminClient, createStorageFromEnv, createMediaRepository } = await import(
        "@c3studium/valecms/server"
    )

    const client = getAdminClient()
    const storage = createStorageFromEnv()
    const media = createMediaRepository({
        client,
        storage,
        // Fotky, které na webu roky jsou. Limit pro ruční nahrání (8 MB) by
        // některé odmítl a stránka by zůstala bez obrázku.
        maxBytes: 64 * 1024 * 1024,
    })

    let uploaded = 0
    let deduped = 0
    const skipped = []

    for (const { group, files } of plan) {
        log(`${group.label}`)
        for (const file of files) {
            const buffer = fs.readFileSync(file.source)
            const digest = createHash("sha256").update(buffer).digest("hex").slice(0, 12)

            if (!WRITE) {
                log(`  · ${file.filename.padEnd(22)} ${String(Math.round(buffer.length / 1024)).padStart(5)} kB  ${digest}`)
                continue
            }

            /*
             * Jeden odmítnutý soubor nesmí zabít celý běh.
             *
             * Stejné rozhodnutí jako v migraci ze Sanity, ze stejného důvodu:
             * skončit po osmi souborech a nechat knihovnu rozpůlenou je horší
             * než ji doplnit a říct nahlas, co se nevešlo.
             */
            try {
                const row = await media.upload(
                    { buffer, filename: file.filename, mime: file.mime },
                    // Popisek se nevymýšlí. Prázdný je pravdivý a Studio ho
                    // umí najít — filtr „Chybí popisek" je přesně na tohle.
                    // Vymyšlený („Fotka 3") by vypadal jako hotová práce
                    // a čtečka obrazovky by ho přečetla nahlas.
                    { alt: "" }
                )
                // Otisk obsahu vrátí u známých bytů existující řádek. Rozdíl
                // se pozná podle času vzniku: starší než tenhle běh = už tam byl.
                const created = new Date(row.createdAt ?? row.created_at ?? 0).getTime()
                const fresh = Date.now() - created < 60_000
                if (fresh) uploaded += 1
                else deduped += 1
                log(`  ${fresh ? "+" : "="} ${file.filename.padEnd(22)} ${row.id}`)
            } catch (error) {
                skipped.push(`${file.filename}: ${error.message}`)
                log(`  ! ${file.filename.padEnd(22)} ${error.message}`)
            }
        }
        log("")
    }

    if (!WRITE) {
        log(`Nasucho — nic se nezapsalo. Spusťte znovu s --write.\n`)
        return
    }

    log(`Nahráno ${uploaded}, už v knihovně ${deduped}, odmítnuto ${skipped.length}.`)
    if (skipped.length) {
        log(`\nOdmítnuté soubory:`)
        for (const line of skipped) log(`  ${line}`)
    }
    log("")
}

main().catch((error) => {
    console.error(`\nMigrace selhala: ${error.message}\n`)
    if (FORCE) console.error(error)
    process.exitCode = 1
})
