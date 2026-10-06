// Přestěhování databáze CMS z Railway na Supabase — i se schématem.
//
// Přístupy si načte sám ze `storefront/.env.test`, nic se nemusí exportovat:
//
//   node scripts/migrace-cms-na-supabase.mjs preflight   # jen se rozhlédne
//   node scripts/migrace-cms-na-supabase.mjs vse         # schéma → data → ověření
//
// ## Proč se schéma nekopíruje z Railway, ale zakládá z migrations-postgres.sql
//
// Kopie schématu by s sebou přitáhla i to, kde na Railway sedí rozšíření.
// `pgcrypto` a spol. jsou tam ve `public`, kdežto Supabase si je drží ve
// `extensions` a některá má předinstalovaná. Dump by tedy nesl
// `CREATE EXTENSION … WITH SCHEMA public`, což na Supabase kvůli
// `IF NOT EXISTS` tiše neudělá nic — a typy jako `citext` by pak ukazovaly do
// schématu, kde nejsou. Rozbilo by se to až při prvním zápisu.
//
// `migrations/migrations-postgres.sql` zakládá rozšíření **bez** `with schema`,
// takže respektuje, kam si je Supabase dává. Je to zároveň přesně to, co dělá
// `pnpm exec valecms migrate` — proto ho po tomhle skriptu není potřeba pouštět.
//
// Přenáší se tedy jen data (`pg_dump --data-only`).
//
// ## Pořadí tabulek
//
// Data jdou bez vypnutých triggerů, takže na pořadí záleží. Vazby CMS tvoří
// strom bez cyklů — `cms_user` je kořen, `cms_media_archive` visí na
// `cms_media` — a `pg_dump --data-only` ho umí seřadit sám. Kdyby cyklus
// vznikl, obnova spadne celá (jede v jedné transakci), ne napůl.
//
// ## Přihlašovací údaje
//
// Berou se z prostředí a nikam se nevypisují — ani do chybových hlášek, ani do
// argumentů procesů, kde by je viděl `ps`. Viz `prostrediProKlienta`
// a `maskovat`.

import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Načtení `.env` — už nastavená proměnná má přednost.
 *
 * Proti ostatním skriptům tady umí navíc dvě věci, a obě proto, že bez nich to
 * rozbilo první skutečný běh:
 *
 * **Komentář za hodnotou.** `CMS_SOURCE_DATABASE_URL=postgresql://…/railway
 * # stará databáze` končilo s názvem databáze `"railway "` — a Postgres
 * odpověděl `database "railway " does not exist`, což na komentář ani mezeru
 * nijak neukazuje. Odstraňuje se jen `#`, před kterým je mezera, protože heslo
 * `#` obsahovat může.
 *
 * **Mezery okolo.** Zkopírovaná adresa je občas donese a v názvu databáze nebo
 * hesla se neprojeví jinak než odmítnutým přihlášením.
 */
const nactiEnv = (soubor) => {
    if (!existsSync(soubor)) return
    for (const radek of readFileSync(soubor, "utf8").split(/\r?\n/)) {
        const shoda = /^([A-Z0-9_]+)=(.*)$/.exec(radek.trim())
        if (!shoda) continue
        if (process.env[shoda[1]]) continue

        let hodnota = shoda[2].trim()

        const uvozovky = /^(['"])([\s\S]*)\1$/.exec(hodnota)
        if (uvozovky) {
            /* V uvozovkách je hodnota doslovná — komentář se tam neřeší. */
            hodnota = uvozovky[2]
        } else {
            hodnota = hodnota.replace(/\s+#.*$/, "").trim()
        }

        process.env[shoda[1]] = hodnota
    }
}
nactiEnv(path.join(ROOT, ".env.test"))

const ZDROJ = process.env.CMS_SOURCE_DATABASE_URL
const CIL = process.env.CMS_TARGET_DATABASE_URL

const SCHEMA_SQL =
    process.env.CMS_MIGRATIONS || path.join(ROOT, "migrations", "migrations-postgres.sql")

/** Záloha dat. Mimo repozitář, ať se omylem nezacommituje. */
const SOUBOR =
    process.env.MIGRACE_DUMP || path.join(mkdtempSync(path.join(tmpdir(), "cms-")), "data.sql")

/** Dovolí přepsat cílovou databázi, i když v ní data jsou. Musí se napsat ručně. */
const PREPSAT = process.env.MIGRACE_PREPSAT === "1"

/* ── Rozbor adresy ──────────────────────────────────────────────────────── */

/**
 * Rozebere připojovací řetězec — i s nezakódovaným heslem.
 *
 * `new URL()` tu nestačí. Hesla, která Supabase generuje, běžně obsahují `@`,
 * `:` nebo `/`, a `new URL()` je pak rozdělí špatně: heslo `Ta@jne` udělá
 * z `postgres:Ta` uživatele a ze `jne` heslo. Host se přitom trefí, takže se
 * to neprojeví jako chybná adresa, ale jako „password authentication failed" —
 * hodinu hledání na nesprávném místě.
 *
 * Rozdělit se to přesto dá jednoznačně, protože **host nikdy `@` neobsahuje**:
 * poslední `@` v řetězci je tedy vždycky ten oddělovač. Totéž u hesla
 * s dvojtečkou — uživatelské jméno končí u **první** dvojtečky.
 *
 * Dřív tady byla kontrola, která víc zavináčů odmítla a poslala uživatele
 * heslo procentově zakódovat. Fungovala, ale řešila práci, kterou umí udělat
 * tenhle kód.
 */
const rozeberAdresu = (url, popis = "adresa") => {
    const text = String(url ?? "").trim()

    const oddelovac = text.indexOf("://")
    if (oddelovac < 0) {
        throw new Error(`${popis} není připojovací řetězec — čekám „postgresql://…".`)
    }

    const schema = text.slice(0, oddelovac).toLowerCase()
    const zbytek = text.slice(oddelovac + 3)

    /* Poslední zavináč dělí přihlašovací údaje od hostitele. */
    const zaviná = zbytek.lastIndexOf("@")
    const udaje = zaviná >= 0 ? zbytek.slice(0, zaviná) : ""
    const adresa = zaviná >= 0 ? zbytek.slice(zaviná + 1) : zbytek

    /* První dvojtečka dělí jméno od hesla; heslo jich může mít víc. */
    const dvojtecka = udaje.indexOf(":")
    const jmeno = dvojtecka >= 0 ? udaje.slice(0, dvojtecka) : udaje
    const heslo = dvojtecka >= 0 ? udaje.slice(dvojtecka + 1) : ""

    /* Za hostitelem končí adresa první lomítkem, otazníkem nebo mřížkou. */
    const konec = adresa.search(/[/?#]/)
    const hostPort = konec >= 0 ? adresa.slice(0, konec) : adresa
    const cesta = konec >= 0 ? adresa.slice(konec) : ""

    /* IPv6 se píše v hranatých závorkách — port je teprve za nimi. */
    const zavorka = hostPort.lastIndexOf("]")
    const portOd = hostPort.lastIndexOf(":")
    const maPort = portOd > zavorka
    const host = maPort ? hostPort.slice(0, portOd) : hostPort
    const port = maPort ? hostPort.slice(portOd + 1) : ""

    const databaze = cesta.replace(/^\//, "").split(/[?#]/)[0]
    const parametry = new URLSearchParams(cesta.includes("?") ? cesta.slice(cesta.indexOf("?") + 1) : "")

    /*
     * Procentové kódování se rozbaluje jen když je platné. Heslo, které
     * obsahuje `%` jako znak (a ne jako kódování), by `decodeURIComponent`
     * shodil výjimkou — tam se bere, jak je.
     */
    const rozbal = (hodnota) => {
        try {
            return decodeURIComponent(hodnota)
        } catch {
            return hodnota
        }
    }

    return {
        schema,
        host: host.replace(/^\[|\]$/g, ""),
        port: port || "5432",
        jmeno: rozbal(jmeno),
        heslo: rozbal(heslo),
        databaze: rozbal(databaze) || "postgres",
        sslmode: parametry.get("sslmode") || "require",
    }
}

/* ── Zacházení s údaji ──────────────────────────────────────────────────── */

/**
 * Cokoli, co by mohlo prozradit heslo, nahradí hvězdičkami.
 *
 * Volá se na **každý** výstup, i na hlášky z libpq — ty umí připojovací řetězec
 * vypsat celý, a chyba je přesně ta chvíle, kdy člověk výpis kopíruje někomu
 * dalšímu do zprávy.
 */
const maskovat = (text) => {
    let vysledek = String(text ?? "")
    for (const url of [ZDROJ, CIL]) {
        if (!url) continue
        vysledek = vysledek.split(url).join("***")
        try {
            const { heslo } = rozeberAdresu(url)
            if (heslo.length > 3) vysledek = vysledek.split(heslo).join("***")
        } catch {
            /* Nepoužitelná adresa se hlásí jinde. */
        }
    }
    return vysledek.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "***")
}

/** Host a databáze — tolik se ukázat smí, podle toho se pozná, kam to jde. */
const kam = (url) => {
    try {
        const { host, port, databaze } = rozeberAdresu(url)
        return `${host}:${port}/${databaze}`
    } catch {
        return "(neplatná adresa)"
    }
}

/**
 * Připojení přes proměnné prostředí, ne přes argumenty.
 *
 * `psql "postgresql://uživatel:heslo@…"` je pohodlné, jenže celý řetězec se pak
 * objeví v seznamu procesů. libpq totéž přečte z prostředí, takže
 * v argumentech nezbude nic.
 */
const prostrediProKlienta = (url) => {
    const { host, port, jmeno, heslo, databaze, sslmode } = rozeberAdresu(url)
    return {
        ...process.env,
        PGHOST: host,
        PGPORT: port,
        PGUSER: jmeno,
        PGPASSWORD: heslo,
        PGDATABASE: databaze,
        /* Railway i Supabase chtějí TLS; ověřovat řetěz certifikátů nepotřebujeme. */
        PGSSLMODE: sslmode,
    }
}

/* ── Spouštění nástrojů ─────────────────────────────────────────────────── */

/**
 * Spustí nástroj a nikdy se nezeptá na heslo.
 *
 * Všechna volání dostávají `-w` (`--no-password`). Bez něj `psql` i `pg_dump`
 * při chybném nebo chybějícím hesle **vypíšou výzvu a čekají** — v neinteraktivním
 * běhu tedy navždy, místo aby se ozvaly. Naměřeno při zkoušce nanečisto: skript
 * místo chyby vyplodil sto tisíc řádků „Password:".
 */
const spustit = (prikaz, argumenty, moznosti = {}) =>
    new Promise((splnit, odmitnout) => {
        const proces = spawn(prikaz, argumenty, { env: moznosti.env ?? process.env })
        let vystup = ""
        let chyby = ""
        proces.stdout.on("data", (kus) => (vystup += kus))
        proces.stderr.on("data", (kus) => (chyby += kus))
        proces.on("error", (chyba) =>
            odmitnout(new Error(`${prikaz} se nepodařilo spustit: ${maskovat(chyba.message)}`)),
        )
        proces.on("close", (kod) =>
            kod === 0
                ? splnit({ vystup, chyby })
                : odmitnout(
                      new Error(`${prikaz} skončilo s kódem ${kod}\n${maskovat(chyby || vystup)}`),
                  ),
        )
    })

/** Jeden dotaz, výsledek bez hlaviček a rámečků. */
const dotaz = async (url, sql) => {
    const { vystup } = await spustit("psql", ["-X", "-w", "-A", "-t", "-q", "-c", sql], {
        env: prostrediProKlienta(url),
    })
    return vystup.trim()
}

const radky = (vystup) =>
    vystup
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean)

const tabulkyV = async (url) =>
    radky(
        await dotaz(
            url,
            `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
        ),
    )

/** Počty řádků po tabulkách — jedním dotazem místo jednoho na tabulku. */
const spoctiRadky = async (url, tabulky) => {
    if (!tabulky.length) return new Map()
    const sjednoceni = tabulky
        .map((t) => `SELECT '${t}' AS t, count(*) AS n FROM "public"."${t}"`)
        .join(" UNION ALL ")
    return new Map(
        radky(await dotaz(url, `${sjednoceni} ORDER BY 1`)).map((radek) => {
            const [t, n] = radek.split("|")
            return [t, Number(n)]
        }),
    )
}

/* ── Rozhlédnutí ────────────────────────────────────────────────────────── */

/**
 * Odmítne transaction pooler.
 *
 * Supabase dává tři připojovací řetězce, liší se hostitelem a portem:
 *
 * | co to je           | port | na přenos |
 * | ------------------ | ---- | --------- |
 * | direct connection  | 5432 | ano, ale často jen přes IPv6 |
 * | session pooler     | 5432 | **tenhle** |
 * | transaction pooler | 6543 | ne |
 *
 * Transaction pooler nedrží stav relace mezi dotazy, takže obnova v jedné
 * transakci selže někde uprostřed — a vypadá to jako poškozená data.
 */
const zkontrolujPripojeni = (url, popis) => {
    /*
     * Nejčastější záměna: Supabase ukazuje na první obrazovce „Project URL"
     * (`https://<ref>.supabase.co`). To je adresa REST API, která patří k anon
     * a service-role klíči — po Postgresu se přes ni nemluví. Bez tohohle
     * řádku by se chyba projevila jako nesrozumitelné „could not translate
     * host name".
     */
    if (/^https?:/i.test(url)) {
        throw new Error(
            `${popis} je Project URL (${url.replace(/\/\/([^.]+)/, "//***")}), ne připojovací řetězec.\n` +
                `   Potřebuju ten, co začíná „postgresql://" — Supabase → Project Settings →\n` +
                `   Database → Connection string → Session pooler (port 5432).`,
        )
    }

    const u = rozeberAdresu(url, popis)

    if (!/^postgres(ql)?$/.test(u.schema)) {
        throw new Error(`${popis} má protokol „${u.schema}" — čekám „postgresql://".`)
    }
    if (!u.host) {
        throw new Error(`${popis} neobsahuje hostitele.`)
    }
    if (!u.heslo) {
        throw new Error(`${popis} neobsahuje heslo — bez něj se skript nepřipojí (běží bez výzvy).`)
    }

    /*
     * Hranaté závorky ze šablony. Supabase v připojovacím řetězci ukazuje
     * `[YOUR-PASSWORD]` a při vkládání hesla je snadné přepsat jen text
     * a závorky nechat. Postgres pak odpoví `password authentication failed`,
     * tedy hláškou, která míří na heslo — ne na dva znaky okolo.
     *
     * Neodstraňuje se to samo: v cizím hesle nemám co přepisovat, a heslo,
     * které závorky opravdu obsahuje, by se tím poškodilo.
     */
    if (/^\[.*\]$/.test(u.heslo)) {
        throw new Error(
            `${popis} má heslo v hranatých závorkách — zůstaly tam ze šablony Supabase.\n` +
                `   Smaž „[" a „]" okolo hesla, samotné heslo nech být.`,
        )
    }

    if (u.port === "6543") {
        throw new Error(
            `${popis} míří na transaction pooler (port 6543), přes který přenos neprojde.\n` +
                `   V Supabase → Project Settings → Database vezmi „Session pooler" (port 5432).`,
        )
    }
}

const hlavniVerze = (verze) => Number(String(verze).split(".")[0])

/**
 * Sedí migrační SQL ve storefrontu s tím, co přinesla nainstalovaná ValeCMS?
 *
 * `migrations/migrations-postgres.sql` je vygenerovaná kopie souboru z balíčku.
 * Po povýšení ValeCMS se kopie sama neobnoví — a protože tenhle skript z ní
 * staví schéma, postavil by na Supabase **schéma staré verze**, do kterého by
 * novější CMS začala zapisovat sloupce, co tam nejsou.
 *
 * Projevilo by se to až za běhu a vypadalo by to jako chyba CMS, ne jako
 * zapomenutá kopie. Proto se to kontroluje tady, ne až potom.
 */
const zkontrolujMigrace = () => {
    const vBalicku = path.join(
        ROOT,
        "node_modules",
        "@c3studium",
        "valecms",
        "src",
        "server",
        "migrations-postgres.sql",
    )
    if (!existsSync(vBalicku)) return null

    const otisk = (soubor) =>
        createHash("sha256").update(readFileSync(soubor)).digest("hex").slice(0, 12)

    const nas = otisk(SCHEMA_SQL)
    const jejich = otisk(vBalicku)
    if (nas === jejich) return { shoda: true, otisk: nas }

    throw new Error(
        `migrations/migrations-postgres.sql neodpovídá nainstalované ValeCMS.\n` +
            `   storefront: ${nas}\n` +
            `   balíček:    ${jejich}\n` +
            `   Vygeneruj kopii znovu (nebo ji zkopíruj z balíčku), jinak by na Supabase\n` +
            `   vzniklo schéma staré verze.`,
    )
}

const preflight = async () => {
    console.log("── Rozhlédnutí ──────────────────────────────────────────────\n")

    if (!ZDROJ || !CIL) {
        throw new Error(
            "Chybí CMS_SOURCE_DATABASE_URL nebo CMS_TARGET_DATABASE_URL.\n" +
                `   Zapiš je do ${path.join(ROOT, ".env.test")} a spusť znovu.`,
        )
    }
    if (!existsSync(SCHEMA_SQL)) {
        throw new Error(`Nenašel jsem migrační SQL: ${SCHEMA_SQL}`)
    }

    const migrace = zkontrolujMigrace()

    zkontrolujPripojeni(ZDROJ, "CMS_SOURCE_DATABASE_URL")
    zkontrolujPripojeni(CIL, "CMS_TARGET_DATABASE_URL")

    const zdrojVerze = await dotaz(ZDROJ, "SHOW server_version")
    const cilVerze = await dotaz(CIL, "SHOW server_version")
    const velikost = await dotaz(ZDROJ, "SELECT pg_size_pretty(pg_database_size(current_database()))")

    const zdrojTabulky = await tabulkyV(ZDROJ)
    const cilTabulky = await tabulkyV(CIL)
    const pocty = await spoctiRadky(ZDROJ, zdrojTabulky)
    const celkem = [...pocty.values()].reduce((a, b) => a + b, 0)

    console.log(`zdroj   ${kam(ZDROJ)}`)
    console.log(
        `        PostgreSQL ${zdrojVerze}, ${velikost}, ${zdrojTabulky.length} tabulek, ${celkem} řádků\n`,
    )
    console.log(`cíl     ${kam(CIL)}`)
    console.log(`        PostgreSQL ${cilVerze}, ${cilTabulky.length} tabulek\n`)

    const { vystup: verzeNastroje } = await spustit("pg_dump", ["--version"])
    const nastroj = hlavniVerze(verzeNastroje.match(/(\d+\.\d+)/)?.[1] ?? "0")
    if (nastroj < hlavniVerze(zdrojVerze)) {
        throw new Error(
            `pg_dump je verze ${nastroj}, zdroj běží na ${hlavniVerze(zdrojVerze)} — zálohu by odmítl udělat.\n` +
                `   brew install postgresql@${hlavniVerze(zdrojVerze)}`,
        )
    }

    /* Starší cíl je tichá past: většina projde a rozbije se až novější syntaxe. */
    if (hlavniVerze(cilVerze) < hlavniVerze(zdrojVerze)) {
        throw new Error(
            `Cíl je PostgreSQL ${hlavniVerze(cilVerze)}, zdroj ${hlavniVerze(zdrojVerze)}. ` +
                `Založ projekt Supabase na verzi ${hlavniVerze(zdrojVerze)}.`,
        )
    }

    /* Prázdno se měří na řádcích, ne na tabulkách — schéma si založíme sami. */
    if (cilTabulky.length) {
        const cilPocty = await spoctiRadky(CIL, cilTabulky)
        const cilCelkem = [...cilPocty.values()].reduce((a, b) => a + b, 0)
        if (cilCelkem > 0 && !PREPSAT) {
            throw new Error(
                `V cílové databázi už leží ${cilCelkem} řádků — nechávám ji být.\n` +
                    `   Buď ji vyprázdni, nebo spusť s MIGRACE_PREPSAT=1 (tabulky se ZAHODÍ).`,
            )
        }
    }

    if (migrace) console.log(`schéma  migrations-postgres.sql ${migrace.otisk} — souhlasí s ValeCMS\n`)

    console.log("✓ Obě databáze odpovídají, můžeme stěhovat.\n")
    return { zdrojTabulky }
}

/* ── Schéma ─────────────────────────────────────────────────────────────── */

/**
 * Založí schéma CMS v Supabase. Tohle nahrazuje `pnpm exec valecms migrate`.
 *
 * SQL je psané jako znovupustitelné (`if not exists` u každého objektu), takže
 * opakovaný běh nic nerozbije — ale jede stejně v jedné transakci, ať po
 * nepovedeném pokusu nezůstane půlka.
 */
const schema = async () => {
    console.log("── Schéma ───────────────────────────────────────────────────\n")

    if (PREPSAT) {
        console.log("  MIGRACE_PREPSAT=1 — zahazuji schéma public v cíli…")
        await dotaz(CIL, 'DROP SCHEMA IF EXISTS "public" CASCADE; CREATE SCHEMA "public";')
    }

    await spustit(
        "psql",
        ["-X", "-w", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "--file=" + SCHEMA_SQL],
        { env: prostrediProKlienta(CIL) },
    )

    const tabulky = await tabulkyV(CIL)
    console.log(`✓ Schéma založeno — ${tabulky.length} tabulek.\n`)
    return tabulky
}

/* ── Zabezpečení ────────────────────────────────────────────────────────── */

/**
 * Odebere veřejným rolím Supabase přístup ke CMS tabulkám.
 *
 * ## Proč to tu vůbec musí být
 *
 * `migrations-postgres.sql` je **postgresová** varianta schématu: žádná RLS,
 * žádné politiky, žádné `revoke`. Na Railway je to správně — tam žádné
 * PostgREST neběží a role `anon` neexistuje.
 *
 * Na Supabase je to díra, a otevře ji Supabase sám. Projekt má ve schématu
 * `public` nastavené `ALTER DEFAULT PRIVILEGES`, takže každá tabulka, kterou
 * tam `postgres` založí, automaticky dostane plná práva pro `anon`,
 * `authenticated` i `service_role`. A `anon` je ta role, na kterou se dosáhne
 * **veřejným** klíčem z prohlížeče (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
 *
 * Změřeno na tomto projektu hned po migraci — `GET /rest/v1/cms_user` s anon
 * klíčem vrátil `HTTP 200` a data. Tedy hashe hesel redaktorů a obsah
 * `cms_session`, k tomu právo zapisovat. Nic z toho nevyžadovalo heslo.
 *
 * ## Proč ne celá supabase varianta migrací
 *
 * ValeCMS ji má (`src/server/migrations/*.sql`, 11× RLS a 20 `revoke`), jenže
 * počítá s `storage.objects`, `auth.jwt()` a `citext` ve schématu
 * `extensions` — tedy s věcmi, které tenhle web nepoužívá, protože média leží
 * na S3 a přihlašování běží v aplikaci. Pustit ji na schéma založené
 * postgresovou variantou by dalo polovičatý stav.
 *
 * Zavírá se proto přesně to, co je otevřené.
 *
 * ## Proč to nerozbije CMS
 *
 * ValeCMS se připojuje jako `postgres`, tedy vlastník tabulek, a **vlastník RLS
 * obchází** (dokud mu ji nevynutí `FORCE ROW LEVEL SECURITY`). Odebírá se jen
 * `anon` a `authenticated`; `service_role` zůstává, protože jeho klíč nikdy
 * neopouští server a je to dokumentovaná serverová identita.
 */
const zabezpecit = async () => {
    console.log("── Zabezpečení ──────────────────────────────────────────────\n")

    const tabulky = (await tabulkyV(CIL)).filter((t) => t.startsWith("cms_"))

    const prikazy = [
        /* Práva, která Supabase rozdal sám. */
        `REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM anon, authenticated`,
        `REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM anon, authenticated`,
        `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "public" FROM anon, authenticated`,
        `REVOKE USAGE ON SCHEMA "public" FROM anon, authenticated`,
        /* Aby je příští založená tabulka nedostala znovu. */
        `ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON TABLES FROM anon, authenticated`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM anon, authenticated`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM anon, authenticated`,
        /* Druhá pojistka: bez politik RLS zamítne všechno, co není vlastník. */
        ...tabulky.map((t) => `ALTER TABLE "public"."${t}" ENABLE ROW LEVEL SECURITY`),
    ]

    await dotaz(CIL, prikazy.join("; ") + ";")

    /* Ověření, ne jen provedení — jinak se to dozvíme až od někoho cizího. */
    const zbyla = await dotaz(
        CIL,
        `SELECT count(*) FROM information_schema.role_table_grants
         WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')`,
    )
    const bezRls = await dotaz(
        CIL,
        `SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
           AND c.relname LIKE 'cms_%' AND NOT c.relrowsecurity`,
    )

    console.log(`  práva pro anon/authenticated: ${zbyla} (má být 0)`)
    console.log(`  tabulky bez RLS:              ${bezRls} (má být 0)`)

    if (Number(zbyla) > 0 || Number(bezRls) > 0) {
        throw new Error(
            `Zabezpečení neprošlo: ${zbyla} zbylých práv, ${bezRls} tabulek bez RLS. ` +
                `Data by byla čitelná veřejným anon klíčem.`,
        )
    }

    console.log(`\n✓ Veřejné role k CMS tabulkám nemají přístup (${tabulky.length} tabulek).\n`)
}

/* ── Data ───────────────────────────────────────────────────────────────── */

const data = async () => {
    console.log("── Data ─────────────────────────────────────────────────────\n")

    const zdrojTabulky = await tabulkyV(ZDROJ)
    const cilTabulky = await tabulkyV(CIL)

    /*
     * Tabulka, kterou má zdroj a cíl ne, by se při obnově neohlásila jako
     * chyba — data by prostě nikam nedošla. Proto se to kontroluje předem.
     */
    const chybejici = zdrojTabulky.filter((t) => !cilTabulky.includes(t))
    if (chybejici.length) {
        throw new Error(
            `Zdroj má tabulky, které migrační SQL nezakládá: ${chybejici.join(", ")}.\n` +
                `   Jejich data by se ztratila. Buď je přenes ručně, nebo ověř, že jsou k zahození.`,
        )
    }

    await spustit(
        "pg_dump",
        [
            "-w",
            "--data-only",
            "--schema=public",
            "--no-owner",
            "--no-privileges",
            "--quote-all-identifiers",
            "--file=" + SOUBOR,
        ],
        { env: prostrediProKlienta(ZDROJ) },
    )

    /*
     * `pg_dump --data-only` nechává v souboru i `SET session_replication_role`
     * u některých verzí — na Supabase nejsme superuživatel a příkaz by celou
     * transakci shodil. Ven s ním; pořadí tabulek drží vazby samo.
     */
    const puvodni = readFileSync(SOUBOR, "utf8")
    const upravene = puvodni
        .split("\n")
        .filter((radek) => !/^SET\s+session_replication_role/i.test(radek))
        .join("\n")
    if (upravene !== puvodni) writeFileSync(SOUBOR, upravene)

    const mb = (statSync(SOUBOR).size / 1024 / 1024).toFixed(1)
    console.log(`  záloha dat: ${SOUBOR}  (${mb} MB)`)

    await spustit(
        "psql",
        ["-X", "-w", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "--file=" + SOUBOR],
        { env: prostrediProKlienta(CIL) },
    )

    console.log("✓ Data přenesena.\n")
}

/* ── Ověření ────────────────────────────────────────────────────────────── */

/** Sloupce tabulky v pořadí, jak jsou v databázi. */
const sloupceTabulky = async (url, tabulka) =>
    (
        await dotaz(
            url,
            `SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = '${tabulka}'`,
        )
    )
        .split(",")
        .filter(Boolean)

/**
 * Otisk obsahu tabulky — tolik, kolik počty řádků neřeknou.
 *
 * Stejný počet řádků ještě neznamená stejná data: poškozené kódování nebo
 * přehozený jsonb by prošly. Tohle složí každý řádek do textu a zahašuje.
 *
 * ## Dvě věci, bez kterých to lže
 *
 * **Řadit se musí podle klíče s `COLLATE "C"`, ne podle obsahu.** Zdrojová
 * databáze má collation `en_US.utf8`, Supabase `en_US.UTF-8`, a `ORDER BY`
 * podle textu proto na každé straně vyjde jinak — otisky se rozejdou při
 * naprosto identických datech. Naměřeno; hodinu to vypadalo jako poškozený
 * `body` u revizí.
 *
 * **Počítá se jen přes sloupce, které mají obě strany.** Novější schéma přidává
 * sloupce (`lang` u revizí) a ty ve zdroji nejsou — celý řádek by se lišil
 * o prázdné místo.
 */
const otiskObsahu = async (tabulka, sloupce) => {
    const vypis = sloupce.map((s) => `"${s}"`).join(", ")
    const klic = sloupce.includes("id") ? "id" : sloupce[0]
    const sql =
        `SET TimeZone='UTC'; ` +
        `SELECT md5(string_agg(ROW(${vypis})::text, '|' ORDER BY "${klic}"::text COLLATE "C")) ` +
        `FROM "public"."${tabulka}"`

    const [zdroj, cil] = await Promise.all([dotaz(ZDROJ, sql), dotaz(CIL, sql)])
    return { zdroj, cil, shoda: zdroj === cil }
}

/**
 * Porovná cílovou databázi se zdrojovou.
 *
 * **Má smysl jen hned po přenosu dat.** Jakmile se na Supabase začne
 * pracovat — a přepis adres médií na Supabase Storage je taková práce —
 * databáze se rozejdou záměrně a rozdíl v obsahu je pak správná odpověď, ne
 * chyba. Proto se u rozcházejícího se obsahu píše, čím to nejspíš je, místo
 * varování „nepřepínej".
 */
const overit = async () => {
    console.log("── Ověření ──────────────────────────────────────────────────\n")

    const zdrojTabulky = await tabulkyV(ZDROJ)
    const [zdrojPocty, cilPocty] = await Promise.all([
        spoctiRadky(ZDROJ, zdrojTabulky),
        spoctiRadky(CIL, zdrojTabulky),
    ])

    const problemy = []
    for (const [tabulka, pocet] of zdrojPocty) {
        const cilovy = cilPocty.get(tabulka)
        if (cilovy === undefined) problemy.push(`${tabulka}: v cíli chybí`)
        else if (cilovy !== pocet) problemy.push(`${tabulka}: zdroj ${pocet}, cíl ${cilovy}`)
    }

    /* Obsah, ne jen počty — viz `otiskObsahu`. */
    const otisky = new Map()
    for (const tabulka of zdrojTabulky) {
        if (!cilPocty.has(tabulka)) continue
        const [sz, sc] = await Promise.all([
            sloupceTabulky(ZDROJ, tabulka),
            sloupceTabulky(CIL, tabulka),
        ])
        const spolecne = sz.filter((s) => sc.includes(s))
        if (!spolecne.length) continue

        const vysledek = await otiskObsahu(tabulka, spolecne)
        otisky.set(tabulka, vysledek)
        if (!vysledek.shoda) {
            problemy.push(
                `${tabulka}: obsah se liší (zdroj ${vysledek.zdroj.slice(0, 12)}, cíl ${vysledek.cil.slice(0, 12)})`,
            )
        }
        const navic = sc.filter((s) => !sz.includes(s))
        if (navic.length) {
            console.log(`   · ${tabulka}: v cíli navíc ${navic.join(", ")} (novější schéma)`)
        }
    }

    /* Sekvence: kdyby zůstaly vzadu, nová čísla by narazila do existujících. */
    const sekvence = async (url) =>
        new Map(
            radky(
                await dotaz(
                    url,
                    `SELECT sequencename, COALESCE(last_value, 0) FROM pg_sequences
                     WHERE schemaname = 'public' ORDER BY sequencename`,
                ),
            ).map((r) => {
                const [s, v] = r.split("|")
                return [s, Number(v)]
            }),
        )
    const [zdrojSek, cilSek] = await Promise.all([sekvence(ZDROJ), sekvence(CIL)])
    for (const [jmeno, hodnota] of zdrojSek) {
        const cilova = cilSek.get(jmeno)
        if (cilova === undefined) problemy.push(`sekvence ${jmeno}: v cíli chybí`)
        else if (cilova < hodnota) problemy.push(`sekvence ${jmeno}: zdroj ${hodnota}, cíl ${cilova}`)
    }

    const celkem = [...zdrojPocty.values()].reduce((a, b) => a + b, 0)
    console.log(`tabulky   ${zdrojPocty.size}`)
    console.log(`řádky     ${celkem}`)
    console.log(`sekvence  ${zdrojSek.size}\n`)

    /* Vypíše i to, co sedí — u CMS je pár tabulek a je fajn je vidět. */
    for (const [tabulka, pocet] of zdrojPocty) {
        if (pocet === 0 && cilPocty.get(tabulka) === 0) continue
        const sedi = cilPocty.get(tabulka) === pocet && otisky.get(tabulka)?.shoda !== false
        const otisk = otisky.get(tabulka)?.zdroj?.slice(0, 10) ?? "—"
        console.log(`   ${sedi ? "✓" : "✗"} ${tabulka.padEnd(26)} ${String(pocet).padStart(6)}  ${otisk}`)
    }
    console.log("")

    if (problemy.length) {
        console.log("✗ Nesedí:\n")
        for (const problem of problemy.slice(0, 40)) console.log(`   ${problem}`)
        console.log("")
        const jenObsah = problemy.every((p) => p.includes("obsah se liší"))
        throw new Error(
            jenObsah
                ? `Ověření našlo ${problemy.length} rozdílů v OBSAHU (počty řádků sedí).\n` +
                      `   Pokud už na Supabase proběhla nějaká úprava — třeba přepis adres médií —\n` +
                      `   je to čekané a tenhle krok už není měřítko. Jinak data zkontroluj.`
                : `Ověření našlo ${problemy.length} rozdílů — NEPŘEPÍNEJ CMS na Supabase.`,
        )
    }

    console.log("✓ Obě databáze sedí do posledního řádku.\n")
}

/* ── Běh ────────────────────────────────────────────────────────────────── */

const kroky = {
    preflight,
    schema: async () => {
        await preflight()
        await schema()
        await zabezpecit()
    },
    zabezpecit,
    data: async () => {
        await data()
        await overit()
    },
    overit,
    vse: async () => {
        await preflight()
        await schema()
        /* Hned za schématem, ne až nakonec — mezi tím už v tabulkách leží data. */
        await zabezpecit()
        await data()
        await overit()
        console.log("Hotovo. Přepni DATABASE_URL CMS na Supabase — `valecms migrate` už netřeba.\n")
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
