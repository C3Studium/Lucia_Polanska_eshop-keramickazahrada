/**
 * Testy rozhodování o souhlasu a Google Analytics — bez prohlížeče a bez sestavení.
 *
 *   cd storefront
 *   node --experimental-strip-types --test src/modules/analytics/consent-mode.test.mjs
 *
 * (Node 22.6+; od 23.6 jde i bez přepínače.) Soubor je `.mjs`, aby ho nekontroloval `tsc`
 * a dal se importovat `.ts` s příponou.
 */

import assert from "node:assert/strict"
import test from "node:test"

import {
  analyticsCookieNames,
  analyticsPlan,
  consentDefaultScript,
  consentModeState,
  cookieDeletionStrings,
  cookieDomainCandidates,
  gaMeasurementId,
  gtagScriptUrl,
} from "./consent-mode.ts"
import {
  ACCEPT_ALL,
  CONSENT_VERSION,
  DENY_ALL,
  parseConsent,
  serializeConsent,
} from "../../lib/util/cookie-consent.ts"

const ANALYTICS_ONLY = { preferences: false, analytics: true, marketing: false }

test("měřicí ID: bez proměnné nic, jen platný tvar G-…", () => {
  assert.equal(gaMeasurementId(undefined), null)
  assert.equal(gaMeasurementId(""), null)
  assert.equal(gaMeasurementId("   "), null)
  assert.equal(gaMeasurementId("UA-12345-1"), null)
  assert.equal(gaMeasurementId("G-ABC\"};alert(1)//"), null)
  assert.equal(gaMeasurementId(" g-ab12cd34ef "), "G-AB12CD34EF")
})

test("bez ID se nenačte nic — ani výchozí stav souhlasu", () => {
  assert.equal(consentDefaultScript(null), "")

  const plan = analyticsPlan(null, ACCEPT_ALL, false)
  assert.equal(plan.kind, "off")
  // Se souhlasem se nic nemaže, bez něj se uklidí staré _ga* (nic se přitom nestahuje).
  assert.equal(plan.clearCookies, false)
  assert.deepEqual(analyticsPlan(null, DENY_ALL, false), { kind: "off", clearCookies: true })
})

test("výchozí skript: dataLayer, gtag a vše denied s wait_for_update", () => {
  const script = consentDefaultScript("G-TEST1234")

  assert.match(script, /window\.dataLayer=window\.dataLayer\|\|\[\]/)
  assert.match(script, /push\(arguments\)/)
  assert.match(script, /"consent","default"/)
  for (const key of ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"]) {
    assert.match(script, new RegExp(`"${key}":"denied"`))
  }
  assert.match(script, /"wait_for_update":500/)
  // Výchozí skript nesmí nic stahovat.
  assert.doesNotMatch(script, /googletagmanager/)
})

test("bez rozhodnutí / odmítnutí: gtag.js se nestáhne", () => {
  const plan = analyticsPlan("G-TEST1234", DENY_ALL, false)

  assert.equal(plan.kind, "deny")
  assert.equal(plan.state.analytics_storage, "denied")
  assert.equal(plan.state.ad_storage, "denied")
})

test("jen preferenční / jen marketingový souhlas GA nespustí", () => {
  assert.equal(
    analyticsPlan("G-TEST1234", { preferences: true, analytics: false, marketing: false }, false).kind,
    "deny"
  )
  assert.equal(
    analyticsPlan("G-TEST1234", { preferences: false, analytics: false, marketing: true }, false).kind,
    "deny"
  )
})

test("analytický souhlas: načíst gtag.js jednou, reklamní signály zůstávají denied", () => {
  const first = analyticsPlan("G-TEST1234", ANALYTICS_ONLY, false)

  assert.equal(first.kind, "grant")
  assert.equal(first.load, true)
  assert.deepEqual(first.state, {
    ad_storage: "denied",
    analytics_storage: "granted",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })

  const again = analyticsPlan("G-TEST1234", ANALYTICS_ONLY, true)
  assert.equal(again.kind, "grant")
  assert.equal(again.load, false)
})

test("přijmout vše: i reklamní signály granted", () => {
  assert.deepEqual(consentModeState(ACCEPT_ALL), {
    ad_storage: "granted",
    analytics_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  })
})

test("Studio se neměří ani se souhlasem", () => {
  assert.equal(analyticsPlan("G-TEST1234", ACCEPT_ALL, false, true).kind, "off")
})

test("adresa gtag.js", () => {
  assert.equal(
    gtagScriptUrl("G-TEST1234"),
    "https://www.googletagmanager.com/gtag/js?id=G-TEST1234"
  )
})

test("cookies GA v document.cookie", () => {
  assert.deepEqual(
    analyticsCookieNames(
      "_medusa_cache_id=abc; _ga=GA1.1.1.1; _ga_TEST1234=GS1.1; kz-cookie-consent=x; _gid=1; _gat_UA=1"
    ),
    ["_ga", "_ga_TEST1234", "_gid", "_gat_UA"]
  )
  assert.deepEqual(analyticsCookieNames(""), [])
  assert.deepEqual(analyticsCookieNames("kz-cookie-consent=x"), [])
})

test("domény pro smazání _ga", () => {
  assert.deepEqual(cookieDomainCandidates("www.keramickazahrada.cz"), [
    "",
    "www.keramickazahrada.cz",
    "keramickazahrada.cz",
  ])
  assert.deepEqual(cookieDomainCandidates("dev.matejforejt.com"), [
    "",
    "dev.matejforejt.com",
    "matejforejt.com",
  ])
  assert.deepEqual(cookieDomainCandidates("localhost"), [""])
  assert.deepEqual(cookieDomainCandidates("127.0.0.1"), [""])

  const strings = cookieDeletionStrings(["_ga"], "keramickazahrada.cz")
  assert.deepEqual(strings, [
    "_ga=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/",
    "_ga=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; Domain=keramickazahrada.cz",
  ])
})

test("cookie souhlasu: tam a zpět, starší verze = zeptat se znovu", () => {
  const stored = { ...ANALYTICS_ONLY, version: CONSENT_VERSION, decidedAt: "2026-10-14T10:00:00.000Z" }

  assert.deepEqual(parseConsent(serializeConsent(stored)), stored)

  const older = encodeURIComponent(JSON.stringify({ ...stored, version: CONSENT_VERSION - 1 }))
  assert.equal(parseConsent(older), null)

  assert.equal(parseConsent(null), null)
  assert.equal(parseConsent(""), null)
  assert.equal(parseConsent("%7Bnot-json"), null)
  assert.equal(parseConsent(encodeURIComponent("null")), null)

  // Souhlas se nedomýšlí: cokoli jiného než true je „ne".
  const sloppy = encodeURIComponent(
    JSON.stringify({ version: CONSENT_VERSION, analytics: "true", marketing: 1, preferences: true })
  )
  assert.deepEqual(
    { ...parseConsent(sloppy), decidedAt: undefined },
    { preferences: true, analytics: false, marketing: false, version: CONSENT_VERSION, decidedAt: undefined }
  )
})
