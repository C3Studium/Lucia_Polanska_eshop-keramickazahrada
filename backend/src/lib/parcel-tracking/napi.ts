/**
 * Sledování přes nAPI České pošty (B2B) — primární zdroj, když máme přístupy.
 *
 * `GET /ZSKService/v1/parcelStatuses/current/idParcel/{code}` vrací AKTUÁLNÍ
 * stav zásilky v oficiálním číselníku CIS (`statusID` + `reasonID` + název,
 * datum, čas, pošta). Ověřeno živě 9. 10. 2026 na testovacím prostředí
 * (`NB1249245895U` → `13/00 PŘEDANÁ DATA`, Depo Praha 701) — testovací
 * zásilky z podání tam existují, zatímco veřejné sledování je nezná.
 *
 * Číselník (`/CISService/v1/statusesOverview`, 598 položek) má dvě pasti:
 *  - totéž `statusID` znamená podle `reasonID` něco jiného (51 = V PŘEPRAVĚ
 *    i ULOŽENO, 88 = VRÁCENO ODESILATELI i DORUČENO), proto se klasifikuje
 *    podle NÁZVU stavu, ne podle čísla;
 *  - id událostí tu proto nese obojí (`cis:51/20`), ať dedupe pozná změnu
 *    důvodu a tabulka veřejných id (`21`, `91`…) se na ně omylem nechytí.
 *
 * Podpis požadavku je týž jako u podání (`callCeskaPosta`), včetně výjimky
 * na certifikát testovacího hostu.
 */

import {
  callCeskaPosta,
  type CeskaPostaCredentials,
} from "../../modules/ceskaPostaFulfillment/client"
import { CP_TIMEOUT_MS, ParcelHistoryError, type ParcelEventInput } from "./client"

/** Přístupy z env — stejné proměnné, které dostává fulfillment provider. */
export const napiCredentials = (
  env: Record<string, string | undefined> = process.env
): CeskaPostaCredentials | null => {
  const apiUrl = (env.BALIKOVNA_API_URL ?? "").trim()
  const apiToken = (env.BALIKOVNA_API_TOKEN ?? "").trim()
  const apiSecret = (env.BALIKOVNA_API_SECRET ?? "").trim()
  return apiUrl && apiToken && apiSecret ? { apiUrl, apiToken, apiSecret } : null
}

const str = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value)

/** Syntetická událost „ČP zásilku nezná" — plánovač ji počítá, neukládá. */
const NOT_FOUND: ParcelEventInput = {
  id: "-3",
  text: "Zásilka tohoto podacího čísla není v evidenci.",
  date: "",
}

/** Čistý parser odpovědi `parcelStatuses/current` — testovatelný bez sítě. */
export const parseNapiCurrentStatus = (payload: unknown): ParcelEventInput[] => {
  const status = (payload as any)?.parcelStatus
  if (!status || typeof status !== "object") {
    return [NOT_FOUND]
  }
  const statusID = str(status.statusID).trim()
  const reasonID = str(status.reasonID).trim() || "00"
  const name = str(status.statusDescription).trim()
  if (!statusID && !name) {
    return [NOT_FOUND]
  }
  const date = str(status.date).slice(0, 10) || str(status.datetime).slice(0, 10)
  const postcode = str(status.postOffice).trim()
  const office = [postcode, str(status.postOfficeName).trim()].filter(Boolean).join(" ")
  return [
    {
      id: `cis:${statusID}/${reasonID}`,
      text: name || `Stav ${statusID}/${reasonID}`,
      date,
      postoffice: office || null,
      postcode: postcode || null,
    },
  ]
}

/**
 * Aktuální stav jedné zásilky. Chyba sítě / podpisu → `ParcelHistoryError`
 * (job ji loguje a zkusí příště); neznámá zásilka → událost „není v evidenci".
 */
export const fetchParcelStatusNapi = async (
  creds: CeskaPostaCredentials,
  parcelCode: string
): Promise<ParcelEventInput[]> => {
  const code = parcelCode.trim()
  if (!code) {
    throw new ParcelHistoryError("Chybí číslo zásilky.")
  }

  let response
  try {
    response = await callCeskaPosta(
      creds,
      `/ZSKService/v1/parcelStatuses/current/idParcel/${encodeURIComponent(code)}`,
      "GET",
      undefined,
      CP_TIMEOUT_MS
    )
  } catch (error) {
    throw new ParcelHistoryError(
      `ČP nAPI: ${(error as Error)?.message ?? String(error)}`
    )
  }

  if (response.status === 404) {
    return [NOT_FOUND]
  }
  if (response.status < 200 || response.status >= 300) {
    throw new ParcelHistoryError(
      `ČP nAPI odpovědělo HTTP ${response.status}: ${response.raw.slice(0, 160)}`,
      response.status
    )
  }
  return parseNapiCurrentStatus(response.body)
}
