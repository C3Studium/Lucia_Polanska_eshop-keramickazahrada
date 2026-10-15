import { courseTermsInfo } from "../course-emails"
import type { LegalManifest } from "../legal"

/**
 * Obchodní podmínky k potvrzení rezervace kurzu (§ 1827 odst. 2 OZ): verze
 * ze souhlasu rezervace, PDF jen zveřejněné (absolutní https, ne pracovní
 * znění) — jinak žádná příloha, jen odkaz v textu e-mailu.
 */

const manifest = (pdf: { url: string; draft?: boolean } | null): LegalManifest => ({
  schema: 1,
  seller: {
    name: null,
    address: null,
    ico: null,
    email: null,
    phone: null,
    web: null,
    webUrl: null,
  },
  documents: {
    "obchodni-podminky": {
      title: "Obchodní podmínky",
      path: "/smluvni-podminky",
      versions: [
        {
          version: "2015-01-01",
          effectiveFrom: "2015-01-01",
          title: "Obchodní podmínky",
          archived: true,
          pdf: {
            file: "obchodni-podminky-2015-01-01.pdf",
            url: "https://img.example.cz/legal/obchodni-podminky-2015-01-01.pdf",
            sha256: "a",
            bytes: 1,
            draft: false,
          },
        },
        {
          version: "2026-10-15",
          effectiveFrom: "2026-10-15",
          title: "Obchodní podmínky",
          archived: false,
          pdf: pdf
            ? {
                file: "obchodni-podminky-2026-10-15.pdf",
                url: pdf.url,
                sha256: "b",
                bytes: 2,
                draft: Boolean(pdf.draft),
              }
            : null,
        },
      ],
    },
  },
})

const PUBLISHED = "https://img.example.cz/legal/obchodni-podminky-2026-10-15.pdf"

describe("courseTermsInfo", () => {
  it("attaches the published PDF of the version the customer agreed to", () => {
    const info = courseTermsInfo(
      { id: "res_1", consents: { terms_version: "2026-10-15", accepted_at: "2026-10-16T08:00:00Z" } },
      manifest({ url: PUBLISHED })
    )
    expect(info.version).toBe("2026-10-15")
    expect(info.version_label).toBe("15. 10. 2026")
    expect(info.pdf_url).toBe(PUBLISHED)
    expect(info.attachment).toEqual({
      filename: "obchodni-podminky-2026-10-15.pdf",
      url: PUBLISHED,
    })
  })

  it("keeps the agreed version even when a different one is current", () => {
    const info = courseTermsInfo(
      { consents: { terms_version: "2015-01-01", accepted_at: "2026-10-16T08:00:00Z" } },
      manifest({ url: PUBLISHED })
    )
    expect(info.version).toBe("2015-01-01")
    expect(info.attachment?.filename).toBe("obchodni-podminky-2015-01-01.pdf")
  })

  it("never attaches a draft (with [[DOPLNIT]]) or a relative storefront path", () => {
    const draft = courseTermsInfo(
      { consents: { terms_version: "2026-10-15" } },
      manifest({ url: PUBLISHED, draft: true })
    )
    expect(draft.version).toBe("2026-10-15")
    expect(draft.pdf_url).toBeNull()
    expect(draft.attachment).toBeNull()

    const relative = courseTermsInfo(
      { consents: { terms_version: "2026-10-15" } },
      manifest({ url: "/legal/obchodni-podminky-2026-10-15.pdf" })
    )
    expect(relative.attachment).toBeNull()

    const missing = courseTermsInfo({ consents: { terms_version: "2026-10-15" } }, manifest(null))
    expect(missing.attachment).toBeNull()
    expect(missing.version_label).toBe("15. 10. 2026")
  })

  it("falls back to the version valid on the reservation day without consents", () => {
    const old = courseTermsInfo(
      { created_at: "2025-03-01T10:00:00Z", consents: null },
      manifest({ url: PUBLISHED })
    )
    expect(old.version).toBe("2015-01-01")

    const recent = courseTermsInfo(
      { created_at: "2026-10-20T10:00:00Z" },
      manifest({ url: PUBLISHED })
    )
    expect(recent.version).toBe("2026-10-15")
    expect(recent.attachment?.url).toBe(PUBLISHED)
  })
})
