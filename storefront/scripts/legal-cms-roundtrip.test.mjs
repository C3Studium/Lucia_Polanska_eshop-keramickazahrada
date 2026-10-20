/**
 * Převod právních dokumentů registr ⇄ Studio (`src/lib/legal/cms.ts`) a
 * slučování registru (`src/lib/legal/registry.ts`).
 *
 *   node --import ./scripts/lib/ts-register.mjs --test scripts/legal-cms-roundtrip.test.mjs
 *
 * Hlídá:
 * - každá verze v repu projde `toCmsBody` → JSON (jako uložení v CMS) →
 *   `fromCmsBody` BEZE ZTRÁTY: stejné JSON kapitol (i pořadí klíčů), stejný
 *   otisk zdroje PDF (`printSourceHash`);
 * - tělo projde validací typu `pravniDokument` ve ValeCMS (délky, povinná pole,
 *   unikátní kotvy) a vejde se do limitu 256 kB na jedno uložení;
 * - výběr dokumentů a seznam `{{údajů}}` v nápovědě Studia sedí s kódem;
 * - neplatné tělo dostane `null` s důvodem;
 * - registr: CMS přebíjí repo, vydané znění jen z repa a s fakty z otisku,
 *   verze jen v CMS se přidá, kapitola cookies `seznam` zůstává z kódu.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

const { MODULE_VERSIONS, ALL_VERSIONS } = await import("../src/lib/legal/documents/index.ts")
const { fromCmsBody, toCmsBody, sameLegalText } = await import("../src/lib/legal/cms.ts")
const { createLegalRegistry, LEGAL_PATHS, PDF_ENTRIES } = await import("../src/lib/legal/registry.ts")
const { FALLBACK_FACTS, LEGAL_FACT_KEYS } = await import("../src/lib/legal/facts.ts")
const { printSourceHash } = await import("../src/modules/legal-print/source-hash.ts")
await import("../src/lib/valecms.types.ts")
const { findType } = await import("@c3studium/valecms/core")
const { validateDocument } = await import("@c3studium/valecms/core")

const JSON_LIMIT = 256 * 1024
const stored = (body) => JSON.parse(JSON.stringify(body))
const label = (doc) => `${doc.slug}@${doc.version}`

for (const doc of [...MODULE_VERSIONS, ...ALL_VERSIONS.filter((v) => !MODULE_VERSIONS.includes(v))]) {
  test(`round trip ${label(doc)}`, () => {
    const body = toCmsBody(doc)

    const request = JSON.stringify({ data: body, baseVersion: "2026-10-15T12:00:00.000Z" })
    const bytes = Buffer.byteLength(request, "utf8")
    assert.ok(bytes < JSON_LIMIT, `${label(doc)}: uložení má ${bytes} B, limit ValeCMS je ${JSON_LIMIT}`)

    const schema = validateDocument("pravniDokument", stored(body))
    assert.deepEqual(schema.errors, [], `${label(doc)} neprošel validací typu pravniDokument`)

    const { doc: back, reason } = fromCmsBody(stored(body))
    assert.equal(reason, null)
    assert.ok(back)
    assert.equal(JSON.stringify(back.sections), JSON.stringify(doc.sections), "kapitoly se liší (i pořadím klíčů)")
    assert.equal(back.title, doc.title)
    assert.equal(back.version, doc.version)
    assert.equal(back.slug, doc.slug)
    assert.equal(back.summary, doc.summary)
    assert.equal(back.pdf, doc.pdf)
    assert.equal(Boolean(back.archived), Boolean(doc.archived))
    assert.equal(printSourceHash(back, FALLBACK_FACTS), printSourceHash(doc, FALLBACK_FACTS))
    assert.ok(sameLegalText(back, doc))
    console.log(`  ${label(doc)}: ${(bytes / 1024).toFixed(1)} kB, ${doc.sections.length} kapitol`)
  })
}

test("výběr dokumentů ve Studiu = LEGAL_PATHS", () => {
  const type = findType("pravniDokument")
  const values = type.fieldsByName.dokument.options.list.map((item) => item.value).sort()
  assert.deepEqual(values, Object.keys(LEGAL_PATHS).sort())
})

test("nápověda Studia vyjmenuje všechny {{údaje}}", () => {
  const type = findType("pravniDokument")
  const help = type.fieldsByName.kapitoly.description
  for (const key of LEGAL_FACT_KEYS) assert.ok(help.includes(`{{${key}}}`), `chybí {{${key}}}`)
})

test("soubor: volby stránky pokrývají všechny právní stránky a patičku", () => {
  const values = findType("soubor").fieldsByName.stranka.options.list.map((item) => item.value)
  for (const path of Object.values(LEGAL_PATHS)) assert.ok(values.includes(path.slice(1)), path)
  assert.ok(values.includes("paticka"))
})

const base = () => stored(toCmsBody(MODULE_VERSIONS.find((doc) => doc.slug === "reklamacni-rad")))

test("neplatné tělo → null s důvodem", () => {
  const dupe = base()
  dupe.kapitoly[1].kotva = dupe.kapitoly[0].kotva
  assert.match(fromCmsBody(dupe).reason ?? "", /dvakrát/)

  const unknownBlock = base()
  unknownBlock.kapitoly[0].bloky.push({ _type: "obrazek", src: "x" })
  assert.match(fromCmsBody(unknownBlock).reason ?? "", /neznámý druh bloku/)

  const tableInBox = base()
  tableInBox.kapitoly[0].bloky.push({
    _type: "ramecek",
    nadpis: "",
    bloky: [{ _type: "tabulka", popisek: "", hlavicka: ["a"], radky: [{ bunky: ["b"] }] }],
  })
  assert.match(fromCmsBody(tableInBox).reason ?? "", /rámečku/)

  const badFact = base()
  badFact.kapitoly[0].bloky[0].text = "Napište na {{seller.mail}}."
  assert.match(fromCmsBody(badFact).reason ?? "", /neznámý údaj \{\{seller\.mail\}\}/)

  const badSlug = base()
  badSlug.dokument = "smlouva"
  assert.match(fromCmsBody(badSlug).reason ?? "", /neznámý dokument/)

  assert.equal(fromCmsBody(null).doc, null)
  assert.equal(fromCmsBody({ dokument: "cookies" }).doc, null)
})

test("Studio: duplicitní kotva neprojde validací typu", () => {
  const dupe = base()
  dupe.kapitoly[1].kotva = dupe.kapitoly[0].kotva
  const result = validateDocument("pravniDokument", dupe)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => /dvakrát/.test(error.message)))
})

/* --------------------------------------------------------------- registr -- */

const op = MODULE_VERSIONS.find((doc) => doc.slug === "obchodni-podminky" && doc.version === "2026-10-15")
const rad = MODULE_VERSIONS.find((doc) => doc.slug === "reklamacni-rad")
const cookies = MODULE_VERSIONS.find((doc) => doc.slug === "cookies")
const edited = (doc, title) => ({ ...doc, title })

test("registr: CMS přebíjí pracovní znění z repa", () => {
  const registry = createLegalRegistry({ cms: [edited(op, "Obchodní podmínky (ze Studia)")] })
  assert.equal(registry.getVersion("obchodni-podminky", "2026-10-15").title, "Obchodní podmínky (ze Studia)")
  assert.equal(registry.sourceOf("obchodni-podminky", "2026-10-15"), "cms")
  assert.equal(registry.isLocked("obchodni-podminky", "2026-10-15"), false)
})

test("registr: vydané znění jen z repa, fakty z otisku v manifestu", () => {
  assert.ok(PDF_ENTRIES.some((entry) => entry.slug === "reklamacni-rad" && /^https:/.test(entry.url)))
  const entries = PDF_ENTRIES.map((entry) =>
    entry.slug === "reklamacni-rad" ? { ...entry, facts: { "seller.address": "Stará adresa 1" } } : entry
  )
  const registry = createLegalRegistry({ cms: [edited(rad, "Přepsaný řád")], entries })
  assert.equal(registry.isLocked("reklamacni-rad", rad.version), true)
  assert.equal(registry.getVersion("reklamacni-rad", rad.version).title, rad.title)
  assert.equal(registry.sourceOf("reklamacni-rad", rad.version), "repo")
  assert.equal(registry.cmsVersion("reklamacni-rad", rad.version).title, "Přepsaný řád")
  const live = { ...FALLBACK_FACTS, "seller.address": "Nová adresa 2" }
  assert.equal(registry.factsFor("reklamacni-rad", rad.version, live)["seller.address"], "Stará adresa 1")
  // Klíč, který otisk nemá, zůstane živý; nevydaná verze má živé fakty.
  assert.equal(registry.factsFor("reklamacni-rad", rad.version, live)["seller.name"], live["seller.name"])
  assert.equal(registry.factsFor("obchodni-podminky", "2026-10-15", live)["seller.address"], "Nová adresa 2")
})

test("registr: verze jen v CMS se přidá a začne platit svým dnem", () => {
  const future = { ...op, version: "2027-01-01", title: "Obchodní podmínky 2027" }
  const registry = createLegalRegistry({ cms: [future] })
  assert.equal(registry.listVersions("obchodni-podminky")[0].version, "2027-01-01")
  assert.equal(registry.currentTermsVersion(new Date("2026-12-31T12:00:00Z")), "2026-10-15")
  assert.equal(registry.currentTermsVersion(new Date("2027-01-01T12:00:00Z")), "2027-01-01")
  assert.equal(registry.upcomingVersion("obchodni-podminky", new Date("2026-12-01T12:00:00Z")).version, "2027-01-01")
})

test("registr: tabulky cookies (kapitola seznam) drží kód, ne CMS", () => {
  const stale = {
    ...cookies,
    sections: cookies.sections.map((section) =>
      section.id === "seznam" ? { ...section, blocks: [{ type: "p", text: "Zastaralý seznam." }] } : section
    ),
  }
  const registry = createLegalRegistry({ cms: [stale] })
  const seznam = registry.getVersion("cookies", cookies.version).sections.find((s) => s.id === "seznam")
  assert.equal(JSON.stringify(seznam.blocks), JSON.stringify(cookies.sections.find((s) => s.id === "seznam").blocks))
})

test("Studio: rychlá kontrola značky přímo u pole (překlep v údaji, **, [[)", () => {
  for (const [text, pattern] of [
    ["Pište na {{seller.emial}}.", /Neznámý údaj \{\{seller\.emial\}\}/],
    ["Text **tučně bez konce.", /Lichý počet „\*\*“/],
    ["Chybí [[DOPLNIT něco.", /„\[\[“/],
    ["Prázdné [[DOPLNIT: ]] tady.", /Prázdné \[\[DOPLNIT: \]\]/],
    ["Neuzavřený {{seller.name údaj.", /Neuzavřený údaj/],
  ]) {
    const body = base()
    body.kapitoly[0].bloky[0].text = text
    const result = validateDocument("pravniDokument", body)
    assert.equal(result.ok, false, text)
    assert.ok(result.errors.some((error) => pattern.test(error.message)), `${text}: ${JSON.stringify(result.errors)}`)
  }
  // Položka seznamu i buňka tabulky mají tutéž kontrolu.
  const list = base()
  const withList = list.kapitoly.find((k) => k.bloky.some((b) => b._type === "seznam"))
  withList.bloky.find((b) => b._type === "seznam").polozky[0] = "{{nic}}"
  assert.equal(validateDocument("pravniDokument", list).ok, false)
})

/* ------------------------------------------------- znění k objednávce -- */

const { orderTermsRefFrom } = await import("../src/lib/legal/order-terms-ref.ts")

test("objednávka: zapsaná verze platí, i když ji registr zrovna nezná (výpadek CMS)", () => {
  const registry = createLegalRegistry() // jen repo — verze 2026-12-01 je jen ve Studiu
  const ref = orderTermsRefFrom(registry, {
    created_at: "2026-12-05T10:00:00Z",
    metadata: { terms_version: "2026-12-01" },
  })
  assert.deepEqual(ref, {
    version: "2026-12-01",
    validFrom: "1. 12. 2026",
    href: "/smluvni-podminky/2026-12-01",
    pdfUrl: null,
  })
  // Známá verze: totéž + zveřejněné PDF.
  const old = orderTermsRefFrom(registry, { created_at: "2026-12-05T10:00:00Z", metadata: { terms_version: "2015-01-01" } })
  assert.equal(old.version, "2015-01-01")
  assert.match(old.pdfUrl ?? "", /^https:\/\//)
  // Nic / nečitelné zapsané → verze platná v den objednávky.
  assert.equal(orderTermsRefFrom(registry, { created_at: "2026-10-20T10:00:00Z", metadata: {} }).version, "2026-10-15")
  assert.equal(
    orderTermsRefFrom(registry, { created_at: "2026-10-20T10:00:00Z", metadata: { terms_version: "unknown" } }).version,
    "2026-10-15"
  )
  assert.equal(orderTermsRefFrom(registry, { created_at: "nesmysl", metadata: {} }), null)
})
