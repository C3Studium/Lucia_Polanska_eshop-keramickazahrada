import { renderToStaticMarkup } from "react-dom/server"
import { bundlePublishedEmail } from "../emails/bundle-published"
import { PromotionalEmail } from "../emails/promotional"
import type { EmailNewsletterBlock } from "../emails/newsletter-blocks"

/**
 * The composed newsletter's legal anatomy, asserted on the real rendered
 * HTML — the same component and renderer the Resend provider uses.
 *
 * Czech/EU e-mail marketing (zák. č. 480/2004 Sb., GDPR) requires every
 * campaign e-mail to carry three things, and each is asserted here because
 * each is invisible from the sending side when missing:
 *
 * 1. a working per-recipient unsubscribe link,
 * 2. the sender's identification (name, sídlo, IČO),
 * 3. the reason the recipient is getting the e-mail.
 *
 * Plus the delegation contract: `blocks` present → block rendering; absent →
 * the legacy discount layout, so the old campaigns route keeps working.
 *
 * Rendered with react-dom's `renderToStaticMarkup` rather than
 * `@react-email/render`: the latter dynamic-imports react-dom/server, which
 * jest's CJS sandbox refuses (`--experimental-vm-modules`). The markup is
 * the same React tree either way — @react-email only adds the doctype and
 * plaintext variant on top — and the assertions here are about content.
 */

const blocks: EmailNewsletterBlock[] = [
  { type: "heading", text: "Nové objekty z pece" },
  { type: "paragraph", text: "První řádek.\nDruhý řádek." },
  {
    type: "product",
    product_id: "prod_1",
    title: "Zahradní plastika — Strážce",
    handle: "zahradni-plastika-strazce",
    thumbnail: "https://cdn.example.com/strazce.jpg",
    price_text: "od 2 450 Kč",
  },
  { type: "divider" },
  { type: "button", label: "Prohlédnout objekty", url: "https://shop.example.com/cz/store" },
]

const UNSUBSCRIBE =
  "https://api.example.com/newsletter/unsubscribe?email=jana%40example.com&token=abc"

describe("block-composed newsletter e-mail", () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    process.env.STOREFRONT_PUBLIC_URL = "https://keramickazahrada.cz"
    delete process.env.MEDUSA_STOREFRONT_URL
    delete process.env.STOREFRONT_COUNTRY
  })

  afterAll(() => {
    process.env = env
  })

  const renderBlocksEmail = () =>
    renderToStaticMarkup(
      PromotionalEmail({
        subject: "Nové objekty z pece",
        preheader: "Každý kus trochu jiný.",
        blocks,
        unsubscribeLink: UNSUBSCRIBE,
      }) as React.ReactElement
    )

  it("contains the per-recipient unsubscribe link", () => {
    const html = renderBlocksEmail()
    expect(html).toContain(
      "https://api.example.com/newsletter/unsubscribe?email=jana%40example.com&amp;token=abc"
    )
  })

  it("says why the recipient is getting it", () => {
    const html = renderBlocksEmail()
    expect(html).toContain(
      "Tento e-mail dostáváte, protože jste se přihlásili k odběru novinek"
    )
    expect(html).toContain("keramickazahrada.cz")
  })

  it("identifies the sender with name, sídlo and IČO", () => {
    const html = renderBlocksEmail()
    expect(html).toContain("Lucie Polanská")
    expect(html).toContain("Putim 229, 397 01 Písek")
    expect(html).toContain("IČO 03441482")
  })

  it("renders every block type, in order", () => {
    const html = renderBlocksEmail()

    const heading = html.indexOf("Nové objekty z pece")
    const paragraph = html.indexOf("První řádek.")
    const product = html.indexOf("Zahradní plastika — Strážce")
    const button = html.indexOf("Prohlédnout objekty")

    expect(heading).toBeGreaterThan(-1)
    expect(paragraph).toBeGreaterThan(heading)
    expect(product).toBeGreaterThan(paragraph)
    expect(button).toBeGreaterThan(product)

    // Paragraph line breaks survive.
    expect(html).toContain("Druhý řádek.")
    // The button links where she pointed it.
    expect(html).toContain("https://shop.example.com/cz/store")
    // Product photo and price snapshot.
    expect(html).toContain("https://cdn.example.com/strazce.jpg")
    expect(html).toContain("od 2 450 Kč")
  })

  it("links the product by handle through the storefront URL module", () => {
    const html = renderBlocksEmail()
    expect(html).toContain(
      "https://keramickazahrada.cz/cz/products/zahradni-plastika-strazce"
    )
  })

  it("never renders a button or thumbnail with a non-web URL, even unsanitised", () => {
    // Simulates a payload that reached the template without passing through
    // `sanitizeBlocks` — the render-time guard must hold on its own.
    const html = renderToStaticMarkup(
      PromotionalEmail({
        subject: "Test",
        blocks: [
          { type: "paragraph", text: "Ahoj" },
          { type: "button", label: "Klik", url: "javascript:alert(1)" },
          {
            type: "product",
            product_id: "prod_x",
            title: "Objekt",
            handle: "objekt",
            thumbnail: "javascript:alert(2)",
          },
        ],
        unsubscribeLink: UNSUBSCRIBE,
      }) as React.ReactElement
    )

    expect(html).not.toContain("javascript:")
    // The invalid button vanished entirely rather than pointing nowhere.
    expect(html).not.toContain(">Klik<")
  })

  it("keeps the legacy discount rendering when no blocks are given", () => {
    const html = renderToStaticMarkup(
      PromotionalEmail({
        discountCode: "JARO10",
        discountPercentage: "10%",
        expiryDate: "30. 9. 2026",
        productLink: "https://keramickazahrada.cz/cz/store",
        unsubscribeLink: UNSUBSCRIBE,
      }) as React.ReactElement
    )

    expect(html).toContain("JARO10")
    expect(html).toContain("Kód")
    expect(html).not.toContain("Tento e-mail dostáváte, protože jste se přihlásili")
  })

  it("identifies the sender in the legacy discount layout too", () => {
    const html = renderToStaticMarkup(
      PromotionalEmail({
        discountCode: "JARO10",
        discountPercentage: "10%",
        expiryDate: "30. 9. 2026",
        productLink: "https://keramickazahrada.cz/cz/store",
        unsubscribeLink: UNSUBSCRIBE,
      }) as React.ReactElement
    )

    expect(html).toContain(UNSUBSCRIBE.replace("&", "&amp;"))
    expect(html).toContain("Lucie Polanská")
    expect(html).toContain("Putim 229, 397 01 Písek")
    expect(html).toContain("IČO 03441482")
  })
})

describe("heading levels", () => {
  const render = (blocks: EmailNewsletterBlock[]) =>
    renderToStaticMarkup(
      PromotionalEmail({
        subject: "Předmět e-mailu",
        blocks,
        unsubscribeLink: UNSUBSCRIBE,
      }) as React.ReactElement
    )

  it("maps levels 1/2/3 to their sizes for body headings", () => {
    const html = render([
      { type: "paragraph", text: "Úvod." },
      { type: "heading", text: "Velký titulek", level: 1 },
      { type: "heading", text: "Mezititulek", level: 2 },
      { type: "heading", text: "Drobný nadpis", level: 3 },
    ])

    const sizeAround = (text: string): string => {
      const at = html.indexOf(text)
      const before = html.slice(Math.max(0, at - 400), at)
      const match = before.match(/font-size:(\d+px)(?![\s\S]*font-size:)/)
      return match?.[1] ?? "?"
    }

    expect(sizeAround("Velký titulek")).toBe("28px")
    expect(sizeAround("Mezititulek")).toBe("22px")
    expect(sizeAround("Drobný nadpis")).toBe("17px")
  })

  it("renders a stored block without level exactly like level 2 (old campaigns)", () => {
    const legacy = render([
      { type: "paragraph", text: "Úvod." },
      { type: "heading", text: "Starý nadpis" },
    ])
    const leveled = render([
      { type: "paragraph", text: "Úvod." },
      { type: "heading", text: "Starý nadpis", level: 2 },
    ])

    expect(legacy).toBe(leveled)
  })

  it("still opens with a leading level-1/2 heading, but not with a deliberate small one", () => {
    const opens = render([
      { type: "heading", text: "Otvírák", level: 1 },
      { type: "paragraph", text: "Text." },
    ])
    // The opening line replaces the subject as the serif H1.
    expect(opens).toContain("Otvírák")
    const h1Zone = opens.slice(0, opens.indexOf("Text."))
    expect(h1Zone).toContain("Otvírák")

    const small = render([
      { type: "heading", text: "Jen drobnost", level: 3 },
      { type: "paragraph", text: "Text." },
    ])
    // The subject opens the e-mail; the small heading stays in the body.
    expect(small).toContain("Předmět e-mailu")
    expect(small).toContain("Jen drobnost")
  })
})

describe("paragraph runs", () => {
  const render = (blocks: EmailNewsletterBlock[]) =>
    renderToStaticMarkup(
      PromotionalEmail({
        subject: "Test",
        blocks,
        unsubscribeLink: UNSUBSCRIBE,
      }) as React.ReactElement
    )

  it("renders bold and linked runs as <strong> and <a>", () => {
    const html = render([
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

    expect(html).toMatch(/<strong[^>]*>kousky<\/strong>/)
    expect(html).toMatch(/<a[^>]*href="https:\/\/example\.com\/pec"[^>]*>/)
    expect(html).toContain("pece")
  })

  it("escapes run text — markup in content stays text", () => {
    const html = render([
      {
        type: "paragraph",
        runs: [{ text: "<script>alert(1)</script> & spol." }],
      },
    ])

    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })

  it("never renders a run link with a non-web URL, even unsanitised", () => {
    const html = render([
      {
        type: "paragraph",
        runs: [{ text: "zlý odkaz", url: "javascript:alert(1)" }],
      },
    ])

    expect(html).not.toContain("javascript:")
    // The text survives, just without the link.
    expect(html).toContain("zlý odkaz")
  })

  it("keeps line breaks inside runs", () => {
    const html = render([
      { type: "paragraph", runs: [{ text: "První řádek\nDruhý řádek" }] },
    ])
    expect(html).toMatch(/První řádek<br\/?>Druhý řádek/)
  })

  it("renders a runs-era block and a plain-text block the same when unformatted", () => {
    const fromRuns = render([
      { type: "paragraph", runs: [{ text: "Stejný text." }] },
    ])
    const fromText = render([{ type: "paragraph", text: "Stejný text." }])
    expect(fromRuns).toBe(fromText)
  })

  it("a web URL smuggling an attribute breakout stays inside its href — quotes are escaped", () => {
    // `https://…" onmouseover="…` passes the http(s) rule (it IS a web URL);
    // the attack only works if a renderer interpolates the quote unescaped.
    // React must render it as one href value with &quot;, never as a second
    // attribute.
    const html = render([
      {
        type: "paragraph",
        runs: [
          {
            text: "odkaz",
            url: 'https://evil.example.com/" onmouseover="alert(1)',
          },
        ],
      },
    ])

    expect(html).not.toMatch(/onmouseover="alert/)
    expect(html).toContain(
      'href="https://evil.example.com/&quot; onmouseover=&quot;alert(1)"'
    )
  })

  it("escapes markup smuggled through an image alt attribute", () => {
    const html = render([
      {
        type: "image",
        src: "https://cdn.example.com/foto.jpg",
        alt: '"><script>alert(1)</script>',
      },
    ])

    expect(html).not.toContain("<script>")
    expect(html).toContain('alt="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"')
  })
})

describe("image block", () => {
  const render = (blocks: EmailNewsletterBlock[]) =>
    renderToStaticMarkup(
      PromotionalEmail({
        subject: "Test",
        blocks,
        unsubscribeLink: UNSUBSCRIBE,
      }) as React.ReactElement
    )

  it("renders the photo with its alt text", () => {
    const html = render([
      {
        type: "image",
        src: "https://cdn.example.com/atelier.jpg",
        alt: "Police s objekty v ateliéru",
      },
    ])

    expect(html).toContain('src="https://cdn.example.com/atelier.jpg"')
    expect(html).toContain('alt="Police s objekty v ateliéru"')
  })

  it("wraps the photo in a link only when one is present", () => {
    const withLink = render([
      {
        type: "image",
        src: "https://cdn.example.com/atelier.jpg",
        alt: "Ateliér",
        link: "https://example.com/store",
      },
    ])
    expect(withLink).toMatch(
      /<a[^>]*href="https:\/\/example\.com\/store"[^>]*>[\s\S]*?<img/
    )

    const withoutLink = render([
      {
        type: "image",
        src: "https://cdn.example.com/atelier.jpg",
        alt: "Ateliér",
      },
    ])
    expect(withoutLink).not.toMatch(/<a[^>]*>[\s\S]*?<img[^>]*atelier/)
  })

  it("refuses non-web src and link at render time, even unsanitised", () => {
    const html = render([
      { type: "paragraph", text: "Ahoj" },
      { type: "image", src: "javascript:alert(1)", alt: "zlá" },
      {
        type: "image",
        src: "https://cdn.example.com/ok.jpg",
        alt: "dobrá",
        link: "javascript:alert(2)",
      },
    ])

    expect(html).not.toContain("javascript:")
    // The bad-src image vanished; the good one lost only its link.
    expect(html).not.toContain('alt="zlá"')
    expect(html).toContain('src="https://cdn.example.com/ok.jpg"')
  })
})

describe("bundle announcement e-mail as a campaign", () => {
  const bundle = {
    id: "bundle_1",
    name: "Zahradní set",
    description: "Tři objekty, které se k sobě hodí.",
    items: [
      {
        id: "item_1",
        product_title: "Strážce",
        variant_title: "",
        unit_price: 2450,
        quantity: 1,
      },
    ],
    total_price: 2450,
    bundle_url: "https://keramickazahrada.cz/cz/products/zahradni-set",
  }

  it("carries the legal footer when sent with an unsubscribe link", () => {
    const html = renderToStaticMarkup(
      bundlePublishedEmail({
        bundle,
        unsubscribeLink: UNSUBSCRIBE,
      }) as unknown as React.ReactElement
    )

    expect(html).toContain(UNSUBSCRIBE.replace("&", "&amp;"))
    expect(html).toContain(
      "Tento e-mail dostáváte, protože jste se přihlásili k odběru novinek"
    )
    expect(html).toContain("Lucie Polanská")
    expect(html).toContain("Putim 229, 397 01 Písek")
    expect(html).toContain("IČO 03441482")
  })
})

describe("catalog + promo rendering", () => {
  const env = process.env
  beforeAll(() => {
    process.env = {
      ...env,
      STOREFRONT_PUBLIC_URL: "https://keramickazahrada.cz",
    }
  })
  afterAll(() => {
    process.env = env
  })

  it("catalog renders a grid of linked tiles with prices", () => {
    const html = renderToStaticMarkup(
      PromotionalEmail({
        subject: "Katalog",
        blocks: [
          {
            type: "catalog",
            products: [
              {
                product_id: "p1",
                title: "Miska se struhadlem",
                handle: "miska-se-struhadlem",
                thumbnail: "https://keramickazahrada.cz/foto/miska.jpg",
                price_text: "390 Kč",
              },
              {
                product_id: "p2",
                title: "Hrnek s ptáčkem",
                handle: "hrnek-s-ptackem",
                thumbnail: null,
                price_text: null,
              },
              {
                product_id: "p3",
                title: "Kytička na drátě",
                handle: "kyticka-na-drate",
                thumbnail: "javascript:alert(1)",
                price_text: "180 Kč",
              },
            ],
          },
        ],
        unsubscribeLink: "https://x.example/u",
      }) as React.ReactElement
    )
    expect(html).toContain("Miska se struhadlem")
    expect(html).toContain("390 Kč")
    expect(html).toContain("/products/miska-se-struhadlem")
    expect(html).toContain("/products/hrnek-s-ptackem")
    expect(html).toContain("foto/miska.jpg")
    // scheme-smuggled thumbnail never reaches an src
    expect(html).not.toContain("javascript:")
  })

  it("promo renders frame, code and button; button only with a URL", () => {
    const withUrl = renderToStaticMarkup(
      PromotionalEmail({
        subject: "Akce",
        blocks: [
          {
            type: "promo",
            title: "Podzimní sleva 15 %",
            code: "PODZIM15",
            note: "Platí do konce října.",
            label: "Vybrat hrnek",
            url: "https://keramickazahrada.cz/cz/store",
          },
        ],
        unsubscribeLink: "https://x.example/u",
      }) as React.ReactElement
    )
    expect(withUrl).toContain("Podzimní sleva 15 %")
    expect(withUrl).toContain("PODZIM15")
    expect(withUrl).toContain("Platí do konce října.")
    expect(withUrl).toContain("Vybrat hrnek")

    const noUrl = renderToStaticMarkup(
      PromotionalEmail({
        subject: "Akce",
        blocks: [
          {
            type: "promo",
            title: "Jen oznámení",
            code: null,
            note: null,
            label: "Tlačítko bez cíle",
            url: null,
          },
        ],
        unsubscribeLink: "https://x.example/u",
      }) as React.ReactElement
    )
    expect(noUrl).toContain("Jen oznámení")
    expect(noUrl).not.toContain("Tlačítko bez cíle")
  })
})
