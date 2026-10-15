import {
  legalPageUrl,
  legalPdfFor,
  sellerFacts,
  sellerIdentityLine,
  termsVersionUrl,
  versionValidAt,
  type LegalManifest,
} from "../legal"
import {
  checkAttachmentUrls,
  madeToOrderTitles,
  markAttached,
  orderDocumentVersion,
  orderLegalInfo,
} from "../legal/order-legal"
import realManifest from "../legal/legal-manifest.json"

/**
 * Právní dokumenty v backendu (§ 1827 odst. 2 OZ): která verze OP patří
 * k objednávce, které PDF jde do přílohy potvrzení a co je v patičce.
 */

const pdf = (file: string, url: string) => ({ file, url, sha256: "a".repeat(64), bytes: 1234 })

const manifest: LegalManifest = {
  schema: 1,
  seller: {
    name: "Lucie Polanská",
    address: "Putim 229, 397 01 Písek",
    ico: "03441482",
    email: "info@keramickazahrada.cz",
    phone: "+420 775 211 578",
    web: "keramickazahrada.cz",
    webUrl: "https://keramickazahrada.cz",
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
          pdf: pdf(
            "obchodni-podminky-2015-01-01.pdf",
            "https://img.example.cz/legal/obchodni-podminky-2015-01-01.pdf"
          ),
        },
        {
          version: "2026-10-15",
          effectiveFrom: "2026-10-15",
          title: "Obchodní podmínky",
          archived: false,
          pdf: pdf(
            "obchodni-podminky-2026-10-15.pdf",
            "https://img.example.cz/legal/obchodni-podminky-2026-10-15.pdf"
          ),
        },
      ],
    },
    "odstoupeni-od-smlouvy": {
      title: "Odstoupení od smlouvy",
      path: "/odstoupeni-od-smlouvy",
      versions: [
        {
          version: "2026-10-15",
          effectiveFrom: "2026-10-15",
          title: "Odstoupení od smlouvy",
          archived: false,
          // Ještě nenahrané: cesta na storefrontu.
          pdf: pdf("odstoupeni-od-smlouvy-2026-10-15.pdf", "/legal/odstoupeni-od-smlouvy-2026-10-15.pdf"),
        },
      ],
    },
    "reklamacni-rad": { title: "Reklamační řád", path: "/reklamacni-rad", versions: [] },
    "ochrana-osobnich-udaju": {
      title: "Zásady ochrany osobních údajů",
      path: "/ochrana-osobnich-udaju",
      versions: [],
    },
  },
}

describe("lib/legal", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    process.env.STOREFRONT_PUBLIC_URL = "https://store.example.cz"
    delete process.env.MEDUSA_STOREFRONT_URL
    delete process.env.STOREFRONT_COUNTRY
  })

  afterAll(() => {
    process.env = env
  })

  it("ships a manifest in the shape the helpers read", () => {
    const real = realManifest as unknown as LegalManifest
    expect(real.schema).toBe(1)
    expect(real.seller).toBeDefined()
    expect(real.documents["obchodni-podminky"]?.path).toBe("/smluvni-podminky")
  })

  describe("versionValidAt", () => {
    it("picks the newest version already in force on the Prague date", () => {
      expect(versionValidAt("obchodni-podminky", "2026-10-14T12:00:00Z", manifest)).toBe(
        "2015-01-01"
      )
      // 22:30 UTC = 00:30 v Praze → už 15. 10.
      expect(versionValidAt("obchodni-podminky", "2026-10-14T22:30:00Z", manifest)).toBe(
        "2026-10-15"
      )
    })

    it("falls back to the oldest version when none is in force yet (like the storefront)", () => {
      expect(versionValidAt("odstoupeni-od-smlouvy", "2026-01-01T10:00:00Z", manifest)).toBe(
        "2026-10-15"
      )
      expect(versionValidAt("reklamacni-rad", new Date(), manifest)).toBeNull()
    })
  })

  describe("orderDocumentVersion", () => {
    it("keeps the version stored on the order when the manifest knows it", () => {
      expect(
        orderDocumentVersion("obchodni-podminky", "2026-10-15", "2026-10-14T08:00:00Z", manifest)
      ).toBe("2026-10-15")
    })

    it("ignores the pre-registry value 2026-08 and uses the version valid at order time", () => {
      expect(
        orderDocumentVersion("obchodni-podminky", "2026-08", "2026-09-01T08:00:00Z", manifest)
      ).toBe("2015-01-01")
      expect(
        orderDocumentVersion("obchodni-podminky", undefined, "2026-11-01T08:00:00Z", manifest)
      ).toBe("2026-10-15")
    })
  })

  describe("legalPdfFor", () => {
    it("returns the R2 URL as is", () => {
      expect(legalPdfFor("obchodni-podminky", "2026-10-15", manifest)).toMatchObject({
        filename: "obchodni-podminky-2026-10-15.pdf",
        url: "https://img.example.cz/legal/obchodni-podminky-2026-10-15.pdf",
      })
    })

    it("resolves a not-yet-uploaded storefront path against the storefront origin", () => {
      expect(legalPdfFor("odstoupeni-od-smlouvy", "2026-10-15", manifest)?.url).toBe(
        "https://store.example.cz/legal/odstoupeni-od-smlouvy-2026-10-15.pdf"
      )
    })

    it("has nothing for an unknown version or a missing storefront", () => {
      expect(legalPdfFor("obchodni-podminky", "2026-08", manifest)).toBeNull()
      delete process.env.STOREFRONT_PUBLIC_URL
      expect(legalPdfFor("odstoupeni-od-smlouvy", "2026-10-15", manifest)).toBeNull()
    })
  })

  it("builds page links with the country segment, or none without a storefront", () => {
    expect(legalPageUrl("reklamacni-rad", manifest)).toBe("https://store.example.cz/cz/reklamacni-rad")
    expect(termsVersionUrl("2015-01-01", manifest)).toBe(
      "https://store.example.cz/cz/smluvni-podminky/2015-01-01"
    )
    delete process.env.STOREFRONT_PUBLIC_URL
    expect(legalPageUrl("reklamacni-rad", manifest)).toBe("")
  })

  it("omits missing seller facts instead of printing placeholders", () => {
    expect(sellerIdentityLine(manifest)).toBe(
      "Lucie Polanská · Putim 229, 397 01 Písek · IČO 03441482"
    )
    expect(
      sellerIdentityLine({ ...manifest, seller: { ...manifest.seller, ico: null, address: null } })
    ).toBe("Lucie Polanská")
  })

  it("prefers the live legal facts from the admin, manifest only as fallback", () => {
    // Majitelka změnila adresu a smazala IČO; telefon nezná → z manifestu.
    const live = { "seller.address": "Nová 1, 397 01 Písek", "seller.ico": null }
    expect(sellerIdentityLine(manifest, live)).toBe("Lucie Polanská · Nová 1, 397 01 Písek")
    expect(sellerFacts(manifest, live)).toEqual({
      ...manifest.seller,
      address: "Nová 1, 397 01 Písek",
      ico: null,
    })
    expect(sellerFacts(manifest, null)).toEqual(manifest.seller)
  })
})

describe("orderLegalInfo", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    process.env.STOREFRONT_PUBLIC_URL = "https://store.example.cz"
  })

  afterAll(() => {
    process.env = env
  })

  const items = [
    { title: "Mísa", product_title: "Zahradní mísa", product_id: "prod_1", variant_id: "v_1", metadata: {} },
    {
      title: "Číslo",
      product_title: "Domovní číslo na zakázku",
      product_id: "prod_2",
      variant_id: "v_2",
      metadata: { made_to_order: true },
    },
    // Balné není zboží — nesmí ovlivnit „celá objednávka je zakázka".
    { title: "Balné", metadata: { packaging_fee: true }, product_id: null, variant_id: null },
  ]

  it("attaches the terms PDF of the stored version and the withdrawal form", () => {
    const { legal, attachments } = orderLegalInfo(
      { created_at: "2026-10-20T10:00:00Z", metadata: { terms_version: "2026-10-15" }, items },
      manifest
    )

    expect(legal.terms).toMatchObject({
      version: "2026-10-15",
      version_label: "15. 10. 2026",
      page_url: "https://store.example.cz/cz/smluvni-podminky/2026-10-15",
      attached: false,
    })
    expect(attachments).toEqual([
      {
        filename: "obchodni-podminky-2026-10-15.pdf",
        url: "https://img.example.cz/legal/obchodni-podminky-2026-10-15.pdf",
      },
      {
        filename: "odstoupeni-od-smlouvy-2026-10-15.pdf",
        url: "https://store.example.cz/legal/odstoupeni-od-smlouvy-2026-10-15.pdf",
      },
    ])
    expect(legal.complaints_url).toBe("https://store.example.cz/cz/reklamacni-rad")
    expect(legal.seller.ico).toBe("03441482")
  })

  it("names the seller from the live legal facts when the workflow has them", () => {
    const { legal } = orderLegalInfo({ created_at: "2026-10-20T10:00:00Z", items }, manifest, {
      "seller.email": "dilna@keramickazahrada.cz",
      "seller.phone": null,
    })
    expect(legal.seller.email).toBe("dilna@keramickazahrada.cz")
    expect(legal.seller.phone).toBeNull()
    expect(legal.seller.name).toBe("Lucie Polanská")
  })

  it("uses the archived terms for an old order with the pre-registry version", () => {
    const { legal, attachments } = orderLegalInfo(
      { created_at: "2026-09-01T10:00:00Z", metadata: { terms_version: "2026-08" }, items: [] },
      manifest
    )
    expect(legal.terms?.version).toBe("2015-01-01")
    expect(attachments[0].filename).toBe("obchodni-podminky-2015-01-01.pdf")
  })

  it("never attaches a plain-http URL", () => {
    process.env.STOREFRONT_PUBLIC_URL = "http://localhost:8000"
    const { attachments, legal } = orderLegalInfo(
      { created_at: "2026-10-20T10:00:00Z", metadata: {}, items: [] },
      manifest
    )
    expect(attachments.map((a) => a.filename)).toEqual(["obchodni-podminky-2026-10-15.pdf"])
    // Odkaz ale zůstane — místo přílohy.
    expect(legal.withdrawal?.pdf_url).toBe(
      "http://localhost:8000/legal/odstoupeni-od-smlouvy-2026-10-15.pdf"
    )
  })

  it("lists made-to-order lines and tells a pure commission apart from a mixed order", () => {
    expect(madeToOrderTitles(items)).toEqual(["Domovní číslo na zakázku"])

    const mixed = orderLegalInfo({ items }, manifest).legal
    expect(mixed.made_to_order_items).toEqual(["Domovní číslo na zakázku"])
    expect(mixed.all_made_to_order).toBe(false)

    const pure = orderLegalInfo({ items: items.slice(1) }, manifest).legal
    expect(pure.all_made_to_order).toBe(true)

    // Kategorie Zakázková výroba stačí i bez značky (detekce modulu reklamací).
    const byCategory = orderLegalInfo(
      {
        items: [
          {
            product_title: "Domovní znamení",
            product_id: "p",
            variant_id: "v",
            product: { categories: [{ handle: "zakazkova-vyroba" }] },
          },
        ],
      },
      manifest
    ).legal
    expect(byCategory.all_made_to_order).toBe(true)
  })

  it("never sends a draft PDF with [[DOPLNIT]] placeholders — not even as a link", () => {
    const draftManifest: LegalManifest = JSON.parse(JSON.stringify(manifest))
    draftManifest.documents["obchodni-podminky"]!.versions[1].pdf!.draft = true
    const { legal, attachments } = orderLegalInfo(
      { created_at: "2026-10-20T10:00:00Z", metadata: { terms_version: "2026-10-15" }, items: [] },
      draftManifest
    )
    expect(attachments.map((a) => a.filename)).toEqual(["odstoupeni-od-smlouvy-2026-10-15.pdf"])
    expect(legal.terms).toMatchObject({ pdf_url: null, pdf_draft: true })
    // Stránka té verze zůstává.
    expect(legal.terms?.page_url).toBe("https://store.example.cz/cz/smluvni-podminky/2026-10-15")
  })

  it("marks only the documents whose PDF really goes along", () => {
    const { legal, attachments } = orderLegalInfo(
      { created_at: "2026-10-20T10:00:00Z", metadata: {}, items: [] },
      manifest
    )
    const marked = markAttached(legal, attachments.slice(0, 1))
    expect(marked.terms?.attached).toBe(true)
    expect(marked.withdrawal?.attached).toBe(false)
  })
})

describe("checkAttachmentUrls", () => {
  const attachments = [
    { filename: "a.pdf", url: "https://img.example.cz/legal/a.pdf" },
    { filename: "b.pdf", url: "https://img.example.cz/legal/b.pdf" },
    { filename: "c.pdf", url: "https://img.example.cz/legal/c.pdf" },
  ]

  it("keeps reachable PDFs and reports the rest", async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      if (url.endsWith("a.pdf")) {
        return { ok: true, status: 200, headers: { get: () => "application/pdf" } }
      }
      if (url.endsWith("b.pdf")) {
        return { ok: false, status: 404, headers: { get: () => "text/plain" } }
      }
      throw new Error("connect ECONNREFUSED")
    })

    const { reachable, failed } = await checkAttachmentUrls(attachments, fetchImpl, 1000)

    expect(reachable.map((a) => a.filename)).toEqual(["a.pdf"])
    expect(failed.map((f) => [f.filename, f.reason])).toEqual([
      ["b.pdf", "HTTP 404"],
      ["c.pdf", "Error: connect ECONNREFUSED"],
    ])
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://img.example.cz/legal/a.pdf",
      expect.objectContaining({ method: "HEAD" })
    )
  })

  it("rejects an HTML page served instead of the PDF", async () => {
    const { reachable, failed } = await checkAttachmentUrls(
      attachments.slice(0, 1),
      async () => ({ ok: true, status: 200, headers: { get: () => "text/html; charset=utf-8" } }),
      1000
    )
    expect(reachable).toEqual([])
    expect(failed[0].reason).toContain("text/html")
  })
})
