import {
  campaignContentProblems,
  MAX_BLOCKS,
  MAX_PARAGRAPH_RUNS,
  sanitizeBlocks,
  sanitizeDraftBlocks,
  type NewsletterBlock,
} from "../newsletter-blocks"

/**
 * The block list is what the admin sends over the wire and what the e-mail
 * renderer trusts. Sanitisation is the contract between the two: whatever
 * arrives, what comes out is renderable — and what is not renderable is
 * dropped rather than failing a whole campaign over one malformed leftover.
 */
describe("sanitizeBlocks", () => {
  it("keeps valid blocks in their original order", () => {
    const blocks = sanitizeBlocks([
      { type: "heading", text: "Nové objekty" },
      { type: "paragraph", text: "Z pece vyjely nové kousky." },
      { type: "divider" },
      { type: "button", label: "Prohlédnout", url: "https://example.com/store" },
      {
        type: "product",
        product_id: "prod_1",
        title: "Strážce",
        handle: "strazce",
        thumbnail: "https://example.com/img.jpg",
        price_text: "od 2 450 Kč",
      },
    ])

    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "divider",
      "button",
      "product",
    ])
  })

  it("returns an empty list for anything that is not an array", () => {
    expect(sanitizeBlocks(undefined)).toEqual([])
    expect(sanitizeBlocks(null)).toEqual([])
    expect(sanitizeBlocks("blocks")).toEqual([])
    expect(sanitizeBlocks({ type: "heading", text: "x" })).toEqual([])
  })

  it("drops malformed blocks without failing the rest", () => {
    const blocks = sanitizeBlocks([
      { type: "heading", text: "Platný" },
      { type: "unknown", text: "?" },
      { type: "button", label: "Bez adresy" },
      { type: "product", product_id: "p", title: "Bez handle" },
      42,
      { type: "paragraph", text: "Taky platný" },
    ])

    expect(blocks).toEqual([
      { type: "heading", text: "Platný", level: 2 },
      {
        type: "paragraph",
        text: "Taky platný",
        runs: [{ text: "Taky platný" }],
      },
    ])
  })

  it("trims text and drops blocks that trimmed to nothing", () => {
    const blocks = sanitizeBlocks([
      { type: "heading", text: "  Nadpis  " },
      { type: "paragraph", text: "   " },
      { type: "button", label: " ", url: "https://example.com" },
    ])

    expect(blocks).toEqual([{ type: "heading", text: "Nadpis", level: 2 }])
  })

  it("rejects button URLs that are not real URLs", () => {
    const blocks = sanitizeBlocks([
      { type: "button", label: "Klik", url: "javascript:alert(1)" },
      { type: "button", label: "Klik", url: "nejaka-stranka" },
      { type: "button", label: "Klik", url: "https://example.com/ok" },
    ])

    // zod's `.url()` accepts any scheme-qualified URL; the editor only emits
    // https?://, and the renderer prints whatever survived — so the parser
    // must at least throw out non-URLs.
    expect(
      blocks.filter(
        (block) => block.type === "button" && block.url.includes("example.com")
      )
    ).toHaveLength(1)
    expect(
      blocks.some((block) => block.type === "button" && block.url === "nejaka-stranka")
    ).toBe(false)
  })

  it("keeps dividers away from the edges and never doubles them", () => {
    const blocks = sanitizeBlocks([
      { type: "divider" },
      { type: "paragraph", text: "A" },
      { type: "divider" },
      { type: "divider" },
      { type: "paragraph", text: "B" },
      { type: "divider" },
    ])

    expect(blocks.map((block) => block.type)).toEqual([
      "paragraph",
      "divider",
      "paragraph",
    ])
  })

  it("caps the list at MAX_BLOCKS", () => {
    const many = Array.from({ length: MAX_BLOCKS + 20 }, (_, index) => ({
      type: "paragraph",
      text: `Odstavec ${index}`,
    }))

    expect(sanitizeBlocks(many)).toHaveLength(MAX_BLOCKS)
  })

  it("drops product thumbnails that do not point at the web", () => {
    const blocks = sanitizeBlocks([
      {
        type: "product",
        product_id: "prod_1",
        title: "Strážce",
        handle: "strazce",
        thumbnail: "javascript:alert(1)",
      },
      {
        type: "product",
        product_id: "prod_2",
        title: "Poutník",
        handle: "poutnik",
        thumbnail: "https://example.com/poutnik.jpg",
      },
    ])

    expect(
      blocks.map((block) => (block.type === "product" ? block.thumbnail : "?"))
    ).toEqual([null, "https://example.com/poutnik.jpg"])
  })

  it("normalises heading levels: missing and garbage become 2, 1 and 3 stay", () => {
    const blocks = sanitizeBlocks([
      { type: "heading", text: "Bez úrovně" },
      { type: "heading", text: "Velký", level: 1 },
      { type: "heading", text: "Drobný", level: 3 },
      { type: "heading", text: "Nesmysl", level: 7 },
    ])

    expect(
      blocks.map((block) => (block.type === "heading" ? block.level : "?"))
    ).toEqual([2, 1, 3, 2])
  })

  it("keeps plain-text paragraphs as one plain run (backward compat)", () => {
    const [block] = sanitizeBlocks([
      { type: "paragraph", text: "  Starý odstavec.  " },
    ])

    expect(block).toEqual({
      type: "paragraph",
      text: "Starý odstavec.",
      runs: [{ text: "Starý odstavec." }],
    })
  })

  it("round-trips paragraph runs and keeps the joined plain text alongside", () => {
    const [block] = sanitizeBlocks([
      {
        type: "paragraph",
        runs: [
          { text: "Nové " },
          { text: "kousky", bold: true },
          { text: " z " },
          { text: "pece", url: "https://example.com/pec" },
          { text: "." },
        ],
      },
    ])

    expect(block).toEqual({
      type: "paragraph",
      text: "Nové kousky z pece.",
      runs: [
        { text: "Nové " },
        { text: "kousky", bold: true },
        { text: " z " },
        { text: "pece", url: "https://example.com/pec" },
        { text: "." },
      ],
    })
  })

  it("strips non-web run URLs but keeps the text", () => {
    const [block] = sanitizeBlocks([
      {
        type: "paragraph",
        runs: [
          { text: "klik", url: "javascript:alert(1)" },
          { text: " a ", url: "data:text/html,x" },
          { text: "dobrý odkaz", url: "https://example.com" },
        ],
      },
    ])

    expect(block).toEqual({
      type: "paragraph",
      text: "klik a dobrý odkaz",
      runs: [
        // The two de-linked runs merged into one plain run.
        { text: "klik a " },
        { text: "dobrý odkaz", url: "https://example.com" },
      ],
    })
  })

  it("drops empty runs, trims run edges and merges identical neighbours", () => {
    const [block] = sanitizeBlocks([
      {
        type: "paragraph",
        runs: [
          { text: "  " },
          { text: " Ahoj" },
          { text: "" },
          { text: " svě" },
          { text: "te ", bold: false },
          { text: "  " },
        ],
      },
    ])

    expect(block).toEqual({
      type: "paragraph",
      text: "Ahoj světe",
      runs: [{ text: "Ahoj světe" }],
    })
  })

  it("drops a paragraph whose runs hold only whitespace", () => {
    expect(
      sanitizeBlocks([{ type: "paragraph", runs: [{ text: "  \n " }] }])
    ).toEqual([])
  })

  it("caps runs at MAX_PARAGRAPH_RUNS", () => {
    const many = Array.from({ length: MAX_PARAGRAPH_RUNS + 10 }, (_, index) =>
      // Alternating formatting so the merge step cannot collapse them.
      index % 2 ? { text: `b${index}`, bold: true } : { text: `a${index}` }
    )
    const [block] = sanitizeBlocks([{ type: "paragraph", runs: many }])

    expect(block.type).toBe("paragraph")
    if (block.type === "paragraph") {
      expect(block.runs!.length).toBeLessThanOrEqual(MAX_PARAGRAPH_RUNS)
      expect(block.text).not.toContain(`a${MAX_PARAGRAPH_RUNS}`)
    }
  })

  it("keeps image blocks with a web src, trimmed alt and a guarded link", () => {
    const blocks = sanitizeBlocks([
      {
        type: "image",
        src: " https://cdn.example.com/foto.jpg ",
        alt: " Objekty na polici ",
        link: "https://example.com/store",
      },
      {
        type: "image",
        src: "https://cdn.example.com/druha.jpg",
        alt: "Bez odkazu",
      },
    ])

    expect(blocks).toEqual([
      {
        type: "image",
        src: "https://cdn.example.com/foto.jpg",
        alt: "Objekty na polici",
        link: "https://example.com/store",
      },
      {
        type: "image",
        src: "https://cdn.example.com/druha.jpg",
        alt: "Bez odkazu",
        link: null,
      },
    ])
  })

  it("drops images without a web src and nulls non-web click-through links", () => {
    const blocks = sanitizeBlocks([
      { type: "image", src: "javascript:alert(1)", alt: "zlá" },
      { type: "image", src: "/relativni/cesta.jpg", alt: "relativní" },
      {
        type: "image",
        src: "https://cdn.example.com/ok.jpg",
        alt: "dobrá",
        link: "javascript:alert(2)",
      },
    ])

    expect(blocks).toEqual([
      {
        type: "image",
        src: "https://cdn.example.com/ok.jpg",
        alt: "dobrá",
        link: null,
      },
    ])
  })

  it("normalises product snapshots (empty thumbnail/price become null)", () => {
    const [block] = sanitizeBlocks([
      {
        type: "product",
        product_id: "prod_1",
        title: " Strážce ",
        handle: " strazce ",
        thumbnail: "  ",
        price_text: "",
      },
    ])

    expect(block).toEqual({
      type: "product",
      product_id: "prod_1",
      title: "Strážce",
      handle: "strazce",
      thumbnail: null,
      price_text: null,
    })
  })
})

describe("sanitizeDraftBlocks — the lenient twin for autosave", () => {
  it("keeps incomplete blocks a strict sanitise would drop", () => {
    const blocks = sanitizeDraftBlocks([
      { type: "heading", text: "", level: 3 },
      { type: "button", label: "Rozepsané tlačítko", url: "" },
      { type: "product" },
      { type: "image", src: "", alt: "", link: "" },
      { type: "paragraph", runs: [] },
    ])

    expect(blocks).toEqual([
      { type: "heading", text: "", level: 3 },
      { type: "button", label: "Rozepsané tlačítko", url: "" },
      { type: "product" },
      { type: "image", src: "", alt: "", link: "" },
      { type: "paragraph", runs: [] },
    ])
  })

  it("still refuses dangerous URL schemes — a draft gets previewed too", () => {
    const blocks = sanitizeDraftBlocks([
      { type: "button", label: "Klik", url: "javascript:alert(1)" },
      {
        type: "image",
        src: "javascript:alert(2)",
        alt: "foto",
        link: "data:text/html,x",
      },
      {
        type: "paragraph",
        runs: [{ text: "odkaz", url: "javascript:alert(3)" }],
      },
    ])

    expect(blocks).toEqual([
      { type: "button", label: "Klik", url: "" },
      { type: "image", src: "", alt: "foto", link: "" },
      { type: "paragraph", runs: [{ text: "odkaz" }] },
    ])
  })

  it("converts legacy plain-text paragraphs to runs", () => {
    expect(
      sanitizeDraftBlocks([{ type: "paragraph", text: "Starý text" }])
    ).toEqual([{ type: "paragraph", runs: [{ text: "Starý text" }] }])
  })

  it("drops unknown block types and anything that is not an object", () => {
    expect(
      sanitizeDraftBlocks([
        { type: "script", src: "https://zle.example.com" },
        42,
        null,
        { type: "divider" },
      ])
    ).toEqual([{ type: "divider" }])
  })

  it("caps the list at MAX_BLOCKS", () => {
    const many = Array.from({ length: MAX_BLOCKS + 5 }, () => ({
      type: "divider",
    }))
    expect(sanitizeDraftBlocks(many)).toHaveLength(MAX_BLOCKS)
  })

  it("returns an empty list for anything that is not an array", () => {
    expect(sanitizeDraftBlocks(undefined)).toEqual([])
    expect(sanitizeDraftBlocks({})).toEqual([])
  })
})

describe("campaignContentProblems", () => {
  const paragraph: NewsletterBlock = { type: "paragraph", text: "Ahoj" }

  it("accepts a subject plus at least one content block", () => {
    expect(
      campaignContentProblems({ subject: "Novinky", blocks: [paragraph] })
    ).toEqual([])
  })

  it("flags a missing subject", () => {
    expect(
      campaignContentProblems({ subject: "  ", blocks: [paragraph] })
    ).toEqual(["Chybí předmět e-mailu."])
  })

  it("does not count dividers as content", () => {
    const problems = campaignContentProblems({
      subject: "Novinky",
      blocks: [{ type: "divider" }],
    })

    expect(problems).toEqual([
      "E-mail nemá žádný obsah — přidejte alespoň jeden blok.",
    ])
  })

  it("flags an image without its description", () => {
    const problems = campaignContentProblems({
      subject: "Novinky",
      blocks: [
        {
          type: "image",
          src: "https://cdn.example.com/foto.jpg",
          alt: "  ",
          link: null,
        },
      ],
    })

    expect(problems).toEqual([
      "U obrázku zbývá doplnit popis — přečte ho hlasová čtečka a zobrazí se, když se obrázek nenačte.",
    ])
  })

  it("accepts an image with a description as content", () => {
    expect(
      campaignContentProblems({
        subject: "Novinky",
        blocks: [
          {
            type: "image",
            src: "https://cdn.example.com/foto.jpg",
            alt: "Objekty na polici",
            link: null,
          },
        ],
      })
    ).toEqual([])
  })
})

/**
 * Adversarial URL payloads — the paste/serialise path of the editor talks to
 * these sanitisers, and the one rule that must hold everywhere is: a URL is
 * http(s) from its very first character or it does not exist. Each vector
 * here is a real smuggling shape (case games, whitespace, control chars,
 * alternate schemes, protocol-relative), pinned so a future "small refactor"
 * of `isWebUrl` cannot quietly re-open one.
 */
describe("scheme smuggling — adversarial URL payloads", () => {
  const hostileUrls = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "\tjavascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "\u0000https://evil.example.com",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "//evil.example.com/protocol-relative",
    "https:evil.example.com",
    "https:/evil.example.com",
    "httpss://evil.example.com",
    "mailto:evil@example.com",
  ]

  it("strict: drops every hostile run URL but keeps the text", () => {
    for (const url of hostileUrls) {
      const blocks = sanitizeBlocks([
        { type: "paragraph", runs: [{ text: "odkaz", url }] },
      ])
      expect(blocks).toEqual([
        { type: "paragraph", text: "odkaz", runs: [{ text: "odkaz" }] },
      ])
    }
  })

  it("strict: drops buttons and images whose URLs are hostile", () => {
    for (const url of hostileUrls) {
      expect(
        sanitizeBlocks([{ type: "button", label: "Klik", url }])
      ).toEqual([])
      expect(
        sanitizeBlocks([{ type: "image", src: url, alt: "foto" }])
      ).toEqual([])
    }
  })

  it("strict: nulls hostile image click-through links and product thumbnails", () => {
    for (const url of hostileUrls) {
      expect(
        sanitizeBlocks([
          {
            type: "image",
            src: "https://cdn.example.com/foto.jpg",
            alt: "foto",
            link: url,
          },
        ])
      ).toEqual([
        {
          type: "image",
          src: "https://cdn.example.com/foto.jpg",
          alt: "foto",
          link: null,
        },
      ])
      expect(
        sanitizeBlocks([
          {
            type: "product",
            product_id: "p_1",
            title: "Strážce",
            handle: "strazce",
            thumbnail: url,
          },
        ])
      ).toEqual([
        {
          type: "product",
          product_id: "p_1",
          title: "Strážce",
          handle: "strazce",
          thumbnail: null,
          price_text: null,
        },
      ])
    }
  })

  it("lenient: empties every hostile URL field on drafts too", () => {
    for (const url of hostileUrls) {
      expect(
        sanitizeDraftBlocks([
          { type: "button", label: "Klik", url },
          { type: "image", src: url, alt: "", link: url },
          { type: "paragraph", runs: [{ text: "odkaz", url }] },
        ])
      ).toEqual([
        { type: "button", label: "Klik", url: "" },
        { type: "image", src: "", alt: "", link: "" },
        { type: "paragraph", runs: [{ text: "odkaz" }] },
      ])
    }
  })

  it("keeps a web URL with hostile suffix characters — escaping is the renderer's job, and it is pinned there", () => {
    // `https://…" onmouseover="…` IS a web URL; the attribute-breakout
    // attempt only matters if a renderer interpolates it unescaped. The
    // e-mail renderer (React) and the editor (escapeHtml) both escape the
    // quote — asserted in newsletter-blocks-email.unit.spec.tsx.
    const url = 'https://evil.example.com/" onmouseover="alert(1)'
    const blocks = sanitizeBlocks([
      { type: "paragraph", runs: [{ text: "odkaz", url }] },
    ])
    expect(blocks).toEqual([
      { type: "paragraph", text: "odkaz", runs: [{ text: "odkaz", url }] },
    ])
  })

  it("markup in text fields stays inert text for the sanitiser", () => {
    const blocks = sanitizeBlocks([
      { type: "heading", text: '<script>alert(1)</script>' },
      {
        type: "paragraph",
        runs: [{ text: '<img src=x onerror=alert(1)>', bold: true }],
      },
      {
        type: "image",
        src: "https://cdn.example.com/foto.jpg",
        alt: '"><script>alert(1)</script>',
      },
    ])
    // Nothing is stripped or parsed — text is text; neutralising it is the
    // renderer's job (React escapes), pinned in the e-mail spec.
    expect(blocks[0]).toEqual({
      type: "heading",
      text: "<script>alert(1)</script>",
      level: 2,
    })
    expect(blocks[1]).toEqual({
      type: "paragraph",
      text: "<img src=x onerror=alert(1)>",
      runs: [{ text: "<img src=x onerror=alert(1)>", bold: true }],
    })
    expect(blocks[2]).toEqual({
      type: "image",
      src: "https://cdn.example.com/foto.jpg",
      alt: '"><script>alert(1)</script>',
      link: null,
    })
  })
})

describe("catalog + promo blocks", () => {
  it("keeps a catalog of clean tiles, drops unpresentable ones, caps at 6", () => {
    const tile = (n: number, extra: Record<string, unknown> = {}) => ({
      product_id: `prod_${n}`,
      title: `Kus ${n}`,
      handle: `kus-${n}`,
      thumbnail: "https://shop.example/foto.jpg",
      price_text: "390 Kč",
      ...extra,
    })
    const cleaned = sanitizeBlocks([
      {
        type: "catalog",
        products: [
          tile(1),
          tile(2, { title: "   " }), // nothing presentable → dropped
          tile(3, { thumbnail: "javascript:alert(1)" }), // photo stripped, tile kept
          tile(4),
          tile(5),
          tile(6),
          tile(7),
          tile(8),
        ],
      },
    ]) as any[]
    expect(cleaned).toHaveLength(1)
    const products = cleaned[0].products
    expect(products.map((p: any) => p.product_id)).toEqual([
      "prod_1",
      "prod_3",
      "prod_4",
      "prod_5",
      "prod_6",
      "prod_7",
    ])
    expect(products[1].thumbnail).toBeNull()
  })

  it("drops a catalog with nothing presentable left", () => {
    expect(
      sanitizeBlocks([
        {
          type: "catalog",
          products: [{ product_id: "p", title: " ", handle: "" }],
        },
      ])
    ).toEqual([])
  })

  it("promo keeps title, trims fields, guards the URL", () => {
    const cleaned = sanitizeBlocks([
      {
        type: "promo",
        title: "  Podzimní sleva  ",
        code: " PODZIM15 ",
        note: "Platí do konce října.",
        label: "Vybrat",
        url: "JaVaScRiPt:alert(1)",
      },
    ]) as any[]
    expect(cleaned).toEqual([
      {
        type: "promo",
        title: "Podzimní sleva",
        code: "PODZIM15",
        note: "Platí do konce října.",
        label: "Vybrat",
        url: null,
      },
    ])
  })

  it("promo without a title is dropped; empty optionals become null", () => {
    expect(sanitizeBlocks([{ type: "promo", title: "  " }])).toEqual([])
    const minimal = sanitizeBlocks([{ type: "promo", title: "Akce" }]) as any[]
    expect(minimal[0]).toEqual({
      type: "promo",
      title: "Akce",
      code: null,
      note: null,
      label: null,
      url: null,
    })
  })

  it("drafts keep half-built catalog and promo blocks", () => {
    const drafts = sanitizeDraftBlocks([
      { type: "catalog", products: [{ product_id: "p1" }, { bogus: true }] },
      { type: "promo", title: "Akc", url: "htt" },
    ]) as any[]
    expect(drafts[0]).toEqual({
      type: "catalog",
      products: [
        { product_id: "p1", title: "", handle: "", thumbnail: null, price_text: null },
      ],
    })
    expect(drafts[1]).toEqual({
      type: "promo",
      title: "Akc",
      code: "",
      note: "",
      label: "",
      url: "",
    })
  })
})
