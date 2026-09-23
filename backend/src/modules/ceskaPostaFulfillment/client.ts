/**
 * Klient nAPI České pošty (B2B-ZSK).
 *
 * ## Podpis, a proč je na něm test
 *
 * Schéma je opsané z Postman kolekce od ČP a **ověřené voláním** 22. 9. 2026:
 *
 * ```
 * sha256payload = SHA256(telo).hex()
 * signature     = Base64( HmacSHA256( `${sha256payload};${unixTs};${nonce}`, secret ) )
 * ```
 *
 * Jedna past v tom je, a je tichá: **tajný klíč se NEDEKÓDUJE z base64**, i když
 * tak vypadá. Postman ho předává CryptoJS jako řetězec a ten si ho vezme jako
 * UTF-8 bajty. Změřeno na `CISService/v1/statusesOverview`:
 *
 * | výklad klíče              | odpověď                                        |
 * | ------------------------- | ---------------------------------------------- |
 * | UTF-8 řetězec             | HTTP 200                                        |
 * | dekódovaný z base64       | HTTP 401 „Signature … does not match"           |
 *
 * Proto na to existuje jednotkový test s pevným očekávaným podpisem. Až to
 * někdo bude za rok „opravovat", chytí ho.
 *
 * ## Proč se u testovacího prostředí vypíná ověření certifikátu
 *
 * `b2b-test.postaonline.cz` má v řetězu self-signed certifikát — spojení spadne
 * dřív, než dojde na podpis. Kolekce od ČP to řeší `strictSSL: false`. Vypíná se
 * to **jen pro testovací host**, nikdy pro produkční: certifikát je jediné, co
 * u ostrého provozu brání tomu, aby zásilky odcházely někomu jinému.
 */

import crypto from "node:crypto"
import https from "node:https"

/** Host testovacího prostředí. Jediný, u kterého se toleruje self-signed řetěz. */
const TEST_HOST = "b2b-test.postaonline.cz"

/**
 * Kořen `/restservices` z nakonfigurované adresy.
 *
 * `BALIKOVNA_API_URL` je na Railway nastavená až po `/ZSKService/v1/`, protože
 * tak ji ČP v e-mailu uvedla. Jenže stavová volání žijí pod `/CISService/v1/`,
 * takže kdyby se cesty jen připojovaly, vznikl by
 * `…/ZSKService/v1/CISService/v1/…` — ČP na to odpoví
 * „No API path found that matches request", což je hlášení, u kterého člověk
 * hledá chybu v podpisu a ne v adrese (ověřeno, stálo to jedno kolo).
 *
 * Cesty se proto uvnitř uvádějí celé (`/ZSKService/v1/parcelService`) a tahle
 * funkce z konfigurace utne, co už tam je. Obě podoby URL fungují.
 */
export const korenRestservices = (apiUrl: string): URL => {
  const base = new URL(apiUrl)
  base.pathname = base.pathname.replace(/\/(?:ZSKService|CISService)\/v\d+\/*$/, "").replace(/\/+$/, "")
  return base
}

export type CeskaPostaCredentials = {
  apiUrl: string
  apiToken: string
  apiSecret: string
}

/**
 * Hlavičky pro jeden požadavek.
 *
 * Vyvezené zvlášť kvůli testu — je to jediné místo, kde se dá udělat chyba,
 * kterou server ohlásí až jako 401 bez dalšího vysvětlení. `nonce` a `ts` jdou
 * dovnitř jako parametry, aby se dal podpis ověřit proti pevné hodnotě.
 */
export const buildAuthHeaders = (
  body: string,
  secret: string,
  token: string,
  nonce: string,
  timestamp: string
): Record<string, string> => {
  const contentHash = crypto.createHash("sha256").update(body, "utf8").digest("hex")

  /* `secret` jako UTF-8 řetězec, NE Buffer.from(secret, "base64") — viz hlavička. */
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${contentHash};${timestamp};${nonce}`, "utf8")
    .digest("base64")

  return {
    Authorization: `CP-HMAC-SHA256 nonce="${nonce}" signature="${signature}"`,
    "Api-Token": token,
    "Authorization-Content-SHA256": contentHash,
    "Authorization-Timestamp": timestamp,
    "Content-Type": "application/json;charset=UTF-8",
  }
}

export type CeskaPostaResponse = {
  status: number
  body: unknown
  raw: string
}

/**
 * Jedno volání. Používá `https` a ne `fetch` kvůli té výjimce na certifikát —
 * `fetch` ji v Node nabídnout neumí bez sahání do globálního agenta, a globální
 * vypnutí ověření by se týkalo i ComGate a iDokladu.
 */
export const callCeskaPosta = (
  creds: CeskaPostaCredentials,
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: unknown,
  timeoutMs = 30_000
): Promise<CeskaPostaResponse> => {
  const telo = body === undefined ? "" : JSON.stringify(body)
  const base = korenRestservices(creds.apiUrl)
  const cesta = base.pathname + (path.startsWith("/") ? path : `/${path}`)

  const nonce = crypto.randomUUID()
  const timestamp = String(Math.floor(Date.now() / 1000))

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: base.hostname,
        port: base.port || 443,
        path: cesta,
        method,
        headers: buildAuthHeaders(telo, creds.apiSecret, creds.apiToken, nonce, timestamp),
        /* Jen testovací host — viz hlavička souboru. */
        rejectUnauthorized: base.hostname !== TEST_HOST,
        timeout: timeoutMs,
      },
      (res) => {
        let raw = ""
        res.on("data", (chunk) => (raw += chunk))
        res.on("end", () => {
          let parsed: unknown = null
          try {
            parsed = JSON.parse(raw)
          } catch {
            /* ČP vrací JSON i u chyb; když ne, zůstane `raw`. */
          }
          resolve({ status: res.statusCode ?? 0, body: parsed, raw })
        })
      }
    )

    req.on("timeout", () => {
      req.destroy(new Error(`Česká pošta neodpověděla do ${timeoutMs} ms`))
    })
    req.on("error", reject)

    if (telo) {
      req.write(telo)
    }
    req.end()
  })
}

/** Běží klient proti testovacímu prostředí? Řídí se tím, kam se volá. */
export const jeTestovaciProstredi = (apiUrl: string): boolean => {
  try {
    return new URL(apiUrl).hostname === TEST_HOST
  } catch {
    return false
  }
}
