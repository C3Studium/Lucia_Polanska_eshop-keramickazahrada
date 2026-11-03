import "server-only"

import { draftMode } from "next/headers"
import { readerFor, stringValue } from "@c3studium/valecms/server/site"

import {
  CONFORMITY_DECLARATIONS,
  GLAZE_CERTIFICATES,
  type ConformityDeclaration,
  type GlazeCertificate,
} from "@lib/certificates"

/**
 * Doklady na /certifikaty — ze Studia (typ `certifikat`) a záloha z kódu.
 *
 * Lucie protokoly glazur nahrává ve Studiu („Certifikáty a protokoly"), takže
 * nový protokol nepotřebuje nasazení. Seznamy v `lib/certificates.ts` zůstávají
 * pro výpadek CMS (dnes v nich je jen prohlášení o shodě zvonku BZ8-113);
 * doklad ze Studia se stejným druhem a názvem zálohu přebije.
 *
 * Nikdy nevyhodí: bez CMS se ukáže záloha z kódu.
 */
export type Certificates = {
  glazes: GlazeCertificate[]
  declarations: ConformityDeclaration[]
}

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("cs") === b.trim().toLocaleLowerCase("cs")

export const getCertificates = async (): Promise<Certificates> => {
  // `draftMode()` MIMO try/catch — viz `getPageCopy` v `site-copy.ts`.
  const preview = (await draftMode()).isEnabled

  let glazes: (GlazeCertificate & { order: number })[] = []
  let declarations: (ConformityDeclaration & { order: number })[] = []

  try {
    const read = readerFor({ draft: preview }) as (options: {
      type: string
      perPage?: number
    }) => Promise<Record<string, unknown>[]>
    const rows = await read({ type: "certifikat", perPage: 100 })

    for (const row of rows) {
      // Pole `file` drží snímek z knihovny médií; holé id adresu nenese.
      const file = row.soubor as Record<string, unknown> | string | null
      const url = stringValue(typeof file === "object" && file ? file.url : "")
      const name = stringValue(row.nazev).trim()
      const issuedAt = stringValue(row.datum)
      if (!url || !name || !issuedAt) continue
      const order = typeof row.poradi === "number" ? row.poradi : Number.MAX_SAFE_INTEGER
      const scope = stringValue(row.rozsah).trim()

      if (stringValue(row.druh) === "shoda") {
        declarations.push({
          product: name,
          productPath: stringValue(row.produkt).trim(),
          manufacturer: stringValue(row.vydal).trim(),
          scope,
          issuedAt,
          url,
          order,
        })
      } else {
        glazes.push({
          glaze: name,
          laboratory: stringValue(row.vydal).trim(),
          issuedAt,
          number: stringValue(row.cislo).trim() || undefined,
          url,
          scope: scope || undefined,
          order,
        })
      }
    }
  } catch (error) {
    console.error("[cms] Certifikáty se nepodařilo načíst, beru zálohu z kódu.", error)
    glazes = []
    declarations = []
  }

  const byOrder = <T extends { order: number }>(name: (item: T) => string) =>
    (a: T, b: T) => a.order - b.order || name(a).localeCompare(name(b), "cs")

  const strip = <T extends { order: number }>({ order: _order, ...rest }: T) => rest

  return {
    glazes: [
      ...glazes.sort(byOrder((item) => item.glaze)).map(strip),
      ...GLAZE_CERTIFICATES.filter(
        (fallback) => !glazes.some((item) => sameName(item.glaze, fallback.glaze))
      ),
    ],
    declarations: [
      ...declarations.sort(byOrder((item) => item.product)).map(strip),
      ...CONFORMITY_DECLARATIONS.filter(
        (fallback) => !declarations.some((item) => sameName(item.product, fallback.product))
      ),
    ],
  }
}
