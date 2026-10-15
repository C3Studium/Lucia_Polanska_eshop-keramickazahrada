/**
 * Zámek právních dokumentů ve Studiu (`src/lib/legal/cms-guard.ts`) —
 * rozhodnutí bez CMS a bez sítě.
 *
 *   node --import ./scripts/lib/ts-register.mjs --test scripts/legal-cms-guard.test.mjs
 */
import assert from "node:assert/strict"
import { test } from "node:test"

const guardModule = await import("../src/lib/legal/cms-guard.ts")
const { legalGuardDecision, guardOperationOf, LOCKED_MESSAGE } = guardModule

const TODAY = "2026-10-20"
const LOCKED = new Set(["reklamacni-rad@2026-10-15"])

const body = (dokument, platnost, extra = {}) => ({ dokument, platnost, nazev: "X", kapitoly: [], ...extra })

const published = (id, dokument, platnost, extra = {}) => ({
  id,
  type: "pravniDokument",
  status: "published",
  data: body(dokument, platnost),
  draft: null,
  archivedAt: null,
  ...extra,
})

const draftOnly = (id, dokument, platnost) => ({
  id,
  type: "pravniDokument",
  status: "draft",
  data: {},
  draft: body(dokument, platnost),
  archivedAt: null,
})

const lockedDoc = published("locked", "reklamacni-rad", "2026-10-15")
const inForce = published("inforce", "obchodni-podminky", "2026-10-15")
const future = published("future", "obchodni-podminky", "2026-12-01")
const working = draftOnly("draft", "cookies", "2026-11-01")
const SIBLINGS = [lockedDoc, inForce, future, working]

const ctx = (stored, siblings = SIBLINGS) => ({
  stored,
  siblings,
  today: TODAY,
  isLocked: (slug, version) => LOCKED.has(`${slug}@${version}`),
  titleOf: (slug) => slug,
})

const decide = (method, segments, reqBody, stored, siblings) => {
  const parsed = guardOperationOf(method, segments, reqBody)
  assert.ok(parsed, `${method} /${segments.join("/")} má být operace`)
  return legalGuardDecision(parsed.op, ctx(stored, siblings))
}

const refused = (verdict, status) => {
  assert.equal(verdict.allow, false, "mělo se odmítnout")
  if (status) assert.equal(verdict.status, status)
  assert.notEqual(verdict.code, "conflict", "kód conflict otevře ve Studiu dialog souběhu")
}

test("čtení a cizí cesty zámek neřeší", () => {
  assert.equal(guardOperationOf("GET", ["documents", "x"], null), null)
  assert.equal(guardOperationOf("GET", ["documents"], null), null)
  assert.equal(guardOperationOf("POST", ["media"], null), null)
  assert.equal(guardOperationOf("POST", ["auth", "sign-in"], null), null)
})

test("vydané znění: úprava, publikace, stažení, archivace i smazání se odmítne (423)", () => {
  const verdicts = [
    decide("PUT", ["documents", "locked"], { data: body("reklamacni-rad", "2026-10-15", { nazev: "Y" }) }, lockedDoc),
    decide("PATCH", ["documents", "locked", "field"], { field: "kapitoly.0.nadpis", value: "Y" }, lockedDoc),
    decide("POST", ["documents", "locked", "publish"], {}, lockedDoc),
    decide("POST", ["documents", "locked", "unpublish"], null, lockedDoc),
    decide("POST", ["documents", "locked", "archive"], null, lockedDoc),
    decide("DELETE", ["documents", "locked"], null, lockedDoc),
  ]
  for (const verdict of verdicts) {
    refused(verdict, 423)
    assert.equal(verdict.message, LOCKED_MESSAGE)
  }
})

test("vydané znění: zahodit koncept jde (web se nemění)", () => {
  assert.equal(decide("DELETE", ["documents", "locked", "draft"], null, lockedDoc).allow, true)
})

test("platné (nevydané) znění: text upravit jde, smazat/stáhnout/archivovat ne", () => {
  const next = body("obchodni-podminky", "2026-10-15", { nazev: "Opravený název" })
  assert.equal(decide("PUT", ["documents", "inforce"], { data: next }, inForce).allow, true)
  assert.equal(decide("PATCH", ["documents", "inforce", "field"], { field: "nazev", value: "Z" }, inForce).allow, true)
  refused(decide("DELETE", ["documents", "inforce"], null, inForce), 423)
  refused(decide("POST", ["documents", "inforce", "unpublish"], null, inForce), 423)
  refused(decide("POST", ["documents", "inforce", "archive"], null, inForce), 423)
  // Opětovná publikace téhož data (oprava pracovního znění) projde.
  const withDraft = { ...inForce, draft: next }
  assert.equal(decide("POST", ["documents", "inforce", "publish"], {}, withDraft).allow, true)
})

test("platné znění: změna dokumentu ani data nejde", () => {
  refused(decide("PUT", ["documents", "inforce"], { data: body("obchodni-podminky", "2026-11-15") }, inForce), 423)
  refused(decide("PATCH", ["documents", "inforce", "field"], { field: "platnost", value: "2026-11-15" }, inForce), 423)
  refused(decide("PATCH", ["documents", "inforce", "field"], { field: "dokument", value: "cookies" }, inForce), 423)
  const movedDraft = { ...inForce, draft: body("obchodni-podminky", "2026-11-15") }
  refused(decide("POST", ["documents", "inforce", "publish"], {}, movedDraft), 423)
})

test("připravované znění: smazat, stáhnout i přesunout jde", () => {
  assert.equal(decide("DELETE", ["documents", "future"], null, future).allow, true)
  assert.equal(decide("POST", ["documents", "future", "unpublish"], null, future).allow, true)
  assert.equal(decide("POST", ["documents", "future", "archive"], null, future).allow, true)
  assert.equal(
    decide("PUT", ["documents", "future"], { data: body("obchodni-podminky", "2027-01-01") }, future).allow,
    true
  )
})

test("duplicita dokument@platnost: založení i změna data se odmítne (409, ne conflict)", () => {
  const create = decide("POST", ["documents"], { type: "pravniDokument", data: body("obchodni-podminky", "2026-12-01") }, null)
  refused(create, 409)
  assert.equal(create.code, "invalid")
  // Duplicita i s rozepsaným konceptem jiného dokumentu.
  refused(decide("POST", ["documents"], { type: "pravniDokument", data: body("cookies", "2026-11-01") }, null), 409)
  refused(decide("PUT", ["documents", "future"], { data: body("obchodni-podminky", "2026-10-15") }, future), 409)
  const opDraft = draftOnly("opdraft", "obchodni-podminky", "2026-11-01")
  refused(
    decide("PATCH", ["documents", "opdraft", "field"], { field: "platnost", value: "2026-12-01" }, opDraft, [...SIBLINGS, opDraft]),
    409
  )
  // Jiný dokument se stejným datem duplicita není.
  assert.equal(
    decide("PATCH", ["documents", "draft", "field"], { field: "platnost", value: "2026-12-01" }, working).allow,
    true
  )
  // Archivovaný dokument klíč neblokuje — obnovení ho ale znovu ohlídá.
  const archivedTwin = published("twin", "obchodni-podminky", "2026-12-01", { archivedAt: "2026-10-19T10:00:00Z" })
  assert.equal(
    decide("POST", ["documents"], { type: "pravniDokument", data: body("doprava-a-platba", "2026-12-24") }, null, [...SIBLINGS, archivedTwin]).allow,
    true
  )
  refused(decide("POST", ["documents", "twin", "restore"], null, archivedTwin, [...SIBLINGS, archivedTwin]), 409)
})

test("vydaný klíč nejde založit znovu ani na něj přesunout datum", () => {
  refused(decide("POST", ["documents"], { type: "pravniDokument", data: body("reklamacni-rad", "2026-10-15") }, null, []), 423)
  refused(decide("PATCH", ["documents", "draft", "field"], { field: "dokument", value: "reklamacni-rad" }, draftOnly("draft", "cookies", "2026-10-15"), []), 423)
})

test("zpětná platnost: první publikace s minulým datem se odmítne (422)", () => {
  const retro = draftOnly("retro", "doprava-a-platba", "2026-10-01")
  const verdict = decide("POST", ["documents", "retro", "publish"], {}, retro, [retro])
  refused(verdict, 422)
  assert.match(verdict.message, /zpětně/)
  // Dnešní datum projde, koncept s minulým datem uložit jde (opraví se před publikací).
  const todayDoc = draftOnly("today", "doprava-a-platba", TODAY)
  assert.equal(decide("POST", ["documents", "today", "publish"], {}, todayDoc, [todayDoc]).allow, true)
  assert.equal(
    decide("POST", ["documents"], { type: "pravniDokument", data: body("doprava-a-platba", "2026-10-01") }, null, []).allow,
    true
  )
  // Publikované budoucí znění, jehož koncept datum posune do minulosti — taky zpětně.
  const moved = { ...future, draft: body("obchodni-podminky", "2026-10-18") }
  refused(decide("POST", ["documents", "future", "publish"], {}, moved), 422)
})

test("jiné typy dokumentů projdou beze změny", () => {
  const other = { id: "o", type: "siteCopy", status: "published", data: { key: "x" }, draft: null }
  assert.equal(decide("DELETE", ["documents", "o"], null, other).allow, true)
  assert.equal(decide("POST", ["documents"], { type: "siteCopy", data: {} }, null).allow, true)
  // Neznámé id → rozhodne obsluha CMS (404).
  assert.equal(decide("DELETE", ["documents", "nic"], null, null).allow, true)
})

/* ---------------------------- znění, které by web nepřijal (pravidlo 5) -- */

const { fromCmsBody, toCmsBody } = await import("../src/lib/legal/cms.ts")
const { MODULE_VERSIONS } = await import("../src/lib/legal/documents/index.ts")

const realBody = () => JSON.parse(JSON.stringify(toCmsBody(MODULE_VERSIONS.find((doc) => doc.slug === "doprava-a-platba"))))
const withProblem = (mutate) => {
  const data = { ...realBody(), platnost: "2026-12-24" }
  mutate(data)
  return data
}
const ctxWithCheck = (stored, siblings = [stored]) => ({
  ...ctx(stored, siblings),
  problemOf: (body) => fromCmsBody(body).reason,
})

test("publikace znění, které by web zahodil, se odmítne (422) s místem chyby; koncept uložit jde", () => {
  for (const [label, mutate, pattern] of [
    ["překlep v údaji", (d) => (d.kapitoly[0].bloky[0].text += " Pište na {{seller.emial}}."), /neznámý údaj \{\{seller\.emial\}\}/],
    ["lichý počet **", (d) => (d.kapitoly[1].bloky[0].text += " **tučně"), /lichý počet „\*\*“/],
    ["neuzavřené [[", (d) => (d.kapitoly[0].bloky[0].text += " [[DOPLNIT chybí"), /„\[\[“/],
    ["prázdná kapitola", (d) => (d.kapitoly[2].bloky = []), /kapitola je prázdná/],
  ]) {
    const data = withProblem(mutate)
    const doc = draftOnly("bad", "doprava-a-platba", "2026-12-24")
    doc.draft = data
    const verdict = legalGuardDecision({ kind: "transition", action: "publish" }, ctxWithCheck(doc))
    refused(verdict, 422)
    assert.match(verdict.message, pattern, label)
    assert.match(verdict.message, /^Tohle znění by web nezobrazil/, label)
    // Uložení konceptu (PUT) projde — kontrola je až při publikaci.
    const save = legalGuardDecision({ kind: "update", data }, ctxWithCheck(doc))
    assert.equal(save.allow, true, `${label}: koncept`)
  }
  // Místo chyby v řeči Studia: kapitola s nadpisem, blok a jeho druh.
  const data = withProblem((d) => (d.kapitoly[0].bloky[0].text += " {{seller.emial}}"))
  const reason = fromCmsBody(data).reason
  assert.match(reason, /^Kapitola 1 „[^“]+“, blok 1 \(odstavec\): neznámý údaj \{\{seller\.emial\}\}/)
})

test("obnovení z archivu s tělem, které by web nepřijal, se odmítne; platné tělo projde", () => {
  const bad = { ...published("arch", "doprava-a-platba", "2026-12-24"), archivedAt: "2026-10-19T00:00:00Z" }
  bad.data = withProblem((d) => (d.kapitoly[0].bloky[0].text += " {{nic}}"))
  refused(legalGuardDecision({ kind: "transition", action: "restore" }, ctxWithCheck(bad)), 422)
  const good = { ...bad, data: withProblem(() => {}) }
  assert.equal(legalGuardDecision({ kind: "transition", action: "restore" }, ctxWithCheck(good)).allow, true)
  const okPublish = draftOnly("ok", "doprava-a-platba", "2026-12-24")
  okPublish.draft = withProblem(() => {})
  assert.equal(legalGuardDecision({ kind: "transition", action: "publish" }, ctxWithCheck(okPublish)).allow, true)
})

/* ------------------------------------------- cesta k poli jako ValeCMS -- */

test("PATCH: cesta k poli se normalizuje jako v ValeCMS (splitPath)", () => {
  const { fieldSegments } = guardModule
  assert.deepEqual(fieldSegments(" platnost "), ["platnost"])
  assert.deepEqual(fieldSegments("kapitoly.0.nadpis"), ["kapitoly", "0", "nadpis"])
  assert.equal(fieldSegments(""), null)
  assert.equal(fieldSegments("__proto__.x"), null)
  assert.equal(fieldSegments("kapitoly.01"), null)
  assert.equal(fieldSegments("a.b.c.d.e.f.g.h.i"), null)
  // Mezera kolem jména pole zámek neobejde.
  refused(decide("PATCH", ["documents", "inforce", "field"], { field: " platnost", value: "2026-11-15" }, inForce), 423)
  refused(decide("PATCH", ["documents", "inforce", "field"], { field: "platnost\t", value: "2026-11-15" }, inForce), 423)
  // Nečitelná cesta u právního dokumentu = odmítnout (fail closed).
  refused(decide("PATCH", ["documents", "inforce", "field"], { field: "plat nost", value: "x" }, inForce), 422)
  refused(decide("PATCH", ["documents", "inforce", "field"], { field: "platnost.0", value: "x" }, inForce), 422)
  refused(decide("PATCH", ["documents", "draft", "field"], { field: "", value: "x" }, working), 422)
  // U jiného typu rozhoduje ValeCMS.
  const other = { id: "o", type: "siteCopy", status: "published", data: { key: "x" }, draft: null }
  assert.equal(decide("PATCH", ["documents", "o", "field"], { field: "plat nost", value: "x" }, other).allow, true)
})
