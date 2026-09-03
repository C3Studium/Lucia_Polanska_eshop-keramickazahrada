// Tlačítka webu do CMS.
//
// Spuštění:
//   node --import @c3studium/valecms/register.mjs scripts/seed-buttons.mjs
//   node --import @c3studium/valecms/register.mjs scripts/seed-buttons.mjs --write
//
// Založí typ `tlacitko` záznamy pro tlačítka, která na webu stojí, se
// současnými názvy a adresami. Od té chvíle je mění redaktor ve Studiu; kód
// drží jen zálohu pro případ, že by CMS nebylo dostupné.
//
// ---------------------------------------------------------------------------
// Opakované spuštění nic nerozbije
//
// Hledá se přes `getByLegacy({ source: 'kod', legacyId: klic })` — stejný
// mechanismus, jakým se poznávaly dokumenty ze Sanity. Existující záznam se
// NEPŘEPÍŠE: seed zakládá výchozí stav, ne pravdu. Kdyby přepisoval, druhé
// spuštění by tiše vrátilo všechny názvy zpátky na ty z kódu a redaktorka by
// přišla o práci, aniž by se čehokoli dotkla.
//
// ---------------------------------------------------------------------------
// Vnitřní × vnější
//
// `href` má smysl jen u tlačítek, která vedou mimo web. Uvnitř webu je cíl
// routa téhle aplikace (`/store`, `/kurzy`) — mění se s kódem, ne s obsahem,
// a v CMS by byla jen past: změnit ji na neexistující adresu jde jedním
// překlepem a projeví se to až návštěvníkovi.
//
// Co smí redaktor měnit, neurčuje schéma, ale anotace v komponentě:
// `editable(t, 'label')` otevře textové pole, `editableLink(t, …)` popup
// s názvem i adresou.

import { createHash } from "node:crypto"
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
 * Tlačítka, tak jak dnes na webu stojí.
 *
 * `kde` je jen pro člověka, který tenhle seznam čte — v datech nekončí.
 * Pořadí je pořadí na webu, ne abecední: hledá se podle stránky.
 */
const BUTTONS = [
    // ── Úvodní stránka
    { klic: "index.hero", label: "Prohlédnout výrobky", kde: "Hero → /store" },
    { klic: "index.kurzy", label: "Objevit kurzy", kde: "E-com/Courses → /kurzy" },
    { klic: "index.vyrobky", label: "Prohlédnout výrobky", kde: "E-com/Courses → /store" },
    { klic: "index.zakazka", label: "Zakázková tvorba", kde: "E-com/Carousel → /vyroba" },

    // ── O mně
    { klic: "o-mne.vyrobky", label: "Prohlédnout výrobky", kde: "O mně/cta → /store" },
    { klic: "o-mne.vyroba", label: "Výroba", kde: "O mně/about → /vyroba" },

    // ── Výroba
    { klic: "vyroba.vyrobky", label: "Prohlédnout výrobky", kde: "Výroba/cta → /store" },

    // ── Produkt
    { klic: "produkt.proces", label: "Objevit proces", kde: "Produkt/chapter → /vyroba" },

    // ── Mobilní menu (hamburger). Všechno vede dovnitř webu, takže jen názvy.
    //    „Kontakt" není routa — otevírá kontaktní dialog —, ale název se mění
    //    stejně jako u ostatních, takže patří do téhož seznamu.
    { klic: "menu.uvod", label: "Úvod", kde: "Mobilní menu → /" },
    { klic: "menu.vyroba", label: "Výroba", kde: "Mobilní menu → /vyroba" },
    { klic: "menu.kurzy", label: "Kurzy", kde: "Mobilní menu → /kurzy" },
    { klic: "menu.dotazy", label: "Dotazy", kde: "Mobilní menu → /dotazy" },
    { klic: "menu.o-mne", label: "O mně", kde: "Mobilní menu → /o-mne" },
    { klic: "menu.kontakt", label: "Kontakt", kde: "Mobilní menu → dialog" },

    // ── Patička — jediná dvě tlačítka, která vedou mimo web, a proto jediná
    //    dvě s adresou.
    {
        klic: "footer.facebook",
        label: "Facebook",
        href: "https://www.facebook.com/keramickazahrada",
        kde: "Patička → Facebook",
    },
    {
        klic: "footer.instagram",
        label: "Instagram",
        href: "https://www.instagram.com/luciepolanska/",
        kde: "Patička → Instagram",
    },
]

const main = async () => {
    log(`\nTlačítka do CMS${WRITE ? "" : "  (nasucho)"}\n`)

    const REQUIRED = ["DATABASE_URL"]
    const missing = REQUIRED.filter((name) => !process.env[name])
    if (missing.length && WRITE) {
        throw new Error(
            `Chybí přístupy: ${missing.join(", ")}.\n` +
                `Bez nich by se zapisovalo do vývojového úložiště .cms-dev/ a ne do databáze.`
        )
    }

    const { getAdminClient, createDocumentRepository } = await import("@c3studium/valecms/server")
    const documents = createDocumentRepository({ client: getAdminClient() })

    let created = 0
    let kept = 0
    const now = new Date().toISOString()

    for (const button of BUTTONS) {
        const found = await documents
            .getByLegacy({ source: "kod", legacyId: button.klic })
            .catch(() => null)

        const externi = Boolean(button.href)
        const mark = externi ? "↗" : "·"

        if (found) {
            kept += 1
            log(`  = ${mark} ${button.klic.padEnd(18)} už v CMS — nepřepisuji`)
            continue
        }

        if (!WRITE) {
            created += 1
            log(`  + ${mark} ${button.klic.padEnd(18)} „${button.label}"${externi ? `  → ${button.href}` : ""}`)
            continue
        }

        const data = { klic: button.klic, label: button.label }
        // Prázdné `href` se do dat nepíše. Prázdný řetězec a nepřítomné pole
        // vypadají v editoru stejně, ale ve výpisu dat je rozdíl mezi
        // „nemá adresu" a „adresa byla smazána" ten jediný, podle kterého se
        // pozná vnitřní tlačítko od pokaženého vnějšího.
        if (externi) data.href = button.href

        await documents.importRow({
            id: crypto.randomUUID(),
            type: "tlacitko",
            status: "published",
            data,
            draft: null,
            created_at: now,
            updated_at: now,
            published_at: now,
            // Ne „sanity" — tenhle obsah nikdy v Sanity nebyl, vzniká z kódu.
            legacy_source: "kod",
            legacy_id: button.klic,
        })
        created += 1
        log(`  + ${mark} ${button.klic.padEnd(18)} „${button.label}"${externi ? `  → ${button.href}` : ""}`)
    }

    log(
        `\n${WRITE ? "Hotovo" : "Nasucho"}: ${created} ${WRITE ? "založeno" : "k založení"}, ` +
            `${kept} ponecháno beze změny.`
    )
    if (!WRITE) log(`Spusťte znovu s --write.`)
    log(`\n↗ = vede mimo web (edituje se název i adresa)`)
    log(`· = vede uvnitř webu (edituje se jen název)\n`)
}

main().catch((error) => {
    console.error(`\nSeed selhal: ${error.message}\n`)
    process.exitCode = 1
})
