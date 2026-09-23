/**
 * Podpis nAPI České pošty — pevné vektory.
 *
 * Tyhle testy nejsou o tom, jestli kód dělá, co je v něm napsané. Jsou o tom,
 * že `buildAuthHeaders` produkuje **tentýž řetězec jako Postman kolekce od ČP**,
 * protože právě ten server přijal (HTTP 200) a jiný odmítl (HTTP 401).
 *
 * Očekávané hodnoty jsou spočítané nezávisle a zapsané natvrdo. Kdyby se
 * počítaly stejným kódem, který testují, neověřily by nic.
 */

import { buildAuthHeaders, jeTestovaciProstredi, korenRestservices } from "../client"

/* Vymyšlený klíč, který *vypadá* jako base64 — přesně to je ta past. */
const SECRET = "dGVzdC1zZWNyZXQtMTIzNA=="
const TOKEN = "b79b16c2-2f77-450f-91a5-868c3c698a82"
const NONCE = "00000000-0000-4000-8000-000000000000"
const TS = "1758578400"
const BODY = JSON.stringify({ a: 1 })

describe("podpis požadavku pro nAPI", () => {
  it("bere tajný klíč jako UTF-8 řetězec, ne jako base64", () => {
    const hlavicky = buildAuthHeaders(BODY, SECRET, TOKEN, NONCE, TS)

    /* Hodnota, kterou server přijal. */
    expect(hlavicky.Authorization).toBe(
      `CP-HMAC-SHA256 nonce="${NONCE}" signature="WGecQYfbkQOsK+PmN9IiIruc23rARmswO9YJx7Amm8Y="`
    )

    /*
     * A hodnota, kterou server odmítl s „Signature of Authorization header does
     * not match". Je tu schválně: kdyby někdo klíč „opravil" na
     * Buffer.from(secret, "base64"), vyrobil by přesně tohle — a bez tohohle
     * řádku by mu první test řekl jen „nesedí", ne „udělal jsi tu známou chybu".
     */
    expect(hlavicky.Authorization).not.toContain("pLPXiFggRzj31ovi3TCny8gnk47GK5771gLs9ItMXPc=")
  })

  it("posílá hash těla v hexu, a u prázdného těla hash prázdného řetězce", () => {
    expect(buildAuthHeaders(BODY, SECRET, TOKEN, NONCE, TS)["Authorization-Content-SHA256"]).toBe(
      "015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862"
    )

    /* GET nemá tělo — ČP i tak čeká hash, ne vynechanou hlavičku. */
    expect(buildAuthHeaders("", SECRET, TOKEN, NONCE, TS)["Authorization-Content-SHA256"]).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
  })

  it("podepisuje trojici hash;čas;nonce — na pořadí záleží", () => {
    /*
     * Prohození času a nonce dá jiný podpis. Test existuje proto, že obě pole
     * jsou neprůhledné řetězce a záměna by se jinak projevila až jako 401.
     */
    const spravne = buildAuthHeaders(BODY, SECRET, TOKEN, NONCE, TS).Authorization
    const prohozene = buildAuthHeaders(BODY, SECRET, TOKEN, TS, NONCE).Authorization
    expect(spravne).not.toBe(prohozene)
  })

  it("mění podpis s tělem, časem i nonce", () => {
    const zaklad = buildAuthHeaders(BODY, SECRET, TOKEN, NONCE, TS).Authorization
    expect(buildAuthHeaders('{"a":2}', SECRET, TOKEN, NONCE, TS).Authorization).not.toBe(zaklad)
    expect(buildAuthHeaders(BODY, SECRET, TOKEN, NONCE, "1758578401").Authorization).not.toBe(zaklad)
    expect(
      buildAuthHeaders(BODY, SECRET, TOKEN, "11111111-1111-4111-8111-111111111111", TS)
        .Authorization
    ).not.toBe(zaklad)
  })

  it("přikládá token a typ obsahu s kódováním", () => {
    const hlavicky = buildAuthHeaders(BODY, SECRET, TOKEN, NONCE, TS)
    expect(hlavicky["Api-Token"]).toBe(TOKEN)
    /* Bez charsetu chodí diakritika ve jménech příjemců rozbitá. */
    expect(hlavicky["Content-Type"]).toBe("application/json;charset=UTF-8")
  })
})

describe("kořen /restservices z konfigurované adresy", () => {
  /*
   * Tohle není hypotetické. Na Railway je URL nastavená až po `/ZSKService/v1/`
   * a prosté připojení cesty vyrobilo `…/ZSKService/v1/ZSKService/v1/…`, na což
   * ČP odpoví HTTP 400 „No API path found" — tedy hlášením, které vypadá jako
   * problém s oprávněním, ne s adresou.
   */
  it("utne službu a verzi, když už jsou v konfiguraci", () => {
    expect(
      korenRestservices("https://b2b-test.postaonline.cz:444/restservices/ZSKService/v1/").pathname
    ).toBe("/restservices")
    expect(
      korenRestservices("https://b2b-test.postaonline.cz:444/restservices/CISService/v1").pathname
    ).toBe("/restservices")
  })

  it("nechá holý kořen být", () => {
    expect(
      korenRestservices("https://b2b-test.postaonline.cz:444/restservices").pathname
    ).toBe("/restservices")
    expect(
      korenRestservices("https://b2b-test.postaonline.cz:444/restservices/").pathname
    ).toBe("/restservices")
  })

  it("zachová host a port", () => {
    const u = korenRestservices("https://b2b-test.postaonline.cz:444/restservices/ZSKService/v1/")
    expect(u.hostname).toBe("b2b-test.postaonline.cz")
    expect(u.port).toBe("444")
  })
})

describe("rozpoznání testovacího prostředí", () => {
  it("pozná testovací host", () => {
    expect(jeTestovaciProstredi("https://b2b-test.postaonline.cz:444/restservices")).toBe(true)
  })

  it("produkční host testovací NENÍ — tam se certifikát ověřuje", () => {
    expect(jeTestovaciProstredi("https://b2b.postaonline.cz:444/restservices")).toBe(false)
  })

  it("nesmyslná adresa se bere jako produkční, ne jako testovací", () => {
    /* Bezpečnější směr chyby: raději spadnout na certifikátu než ho ignorovat. */
    expect(jeTestovaciProstredi("tohle není url")).toBe(false)
    expect(jeTestovaciProstredi("")).toBe(false)
  })
})
