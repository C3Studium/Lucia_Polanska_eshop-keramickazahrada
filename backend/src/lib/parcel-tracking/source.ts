/**
 * Odkud se sledování ptá: nAPI (B2B, s přístupy) má přednost, veřejný JSON
 * je záloha bez přístupů. Job i „Zkontrolovat teď" jdou tudy, ať se zdroj
 * nerozejde.
 */

import { fetchParcelHistory, type ParcelEventInput } from "./client"
import { fetchParcelStatusNapi, napiCredentials } from "./napi"

export type TrackingSource = "napi" | "public"

export const trackingSource = (): TrackingSource =>
  napiCredentials() ? "napi" : "public"

export const fetchParcelEvents = async (
  parcelCode: string
): Promise<ParcelEventInput[]> => {
  const creds = napiCredentials()
  return creds
    ? fetchParcelStatusNapi(creds, parcelCode)
    : fetchParcelHistory(parcelCode)
}
