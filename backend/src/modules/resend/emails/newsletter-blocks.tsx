import { Column, Img, Link, Row, Section, Text } from "@react-email/components"
import * as React from "react"
import { productLink, storeLink } from "../../../lib/storefront-url"
import {
  brand,
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  P,
  Signature,
} from "../components/email-ui"

/**
 * Renders a block-composed newsletter inside the brand e-mail system.
 *
 * The blocks come from the admin's „Napsat" editor via
 * `lib/newsletter-blocks.ts` (which sanitises them before they get here) and
 * ride in `notification.data` on the registered `promotional` template —
 * `promotional.tsx` delegates to this component whenever `blocks` is present,
 * so no new template registration is needed in the Resend provider.
 *
 * ## The legal footer is not optional
 *
 * Czech/EU e-mail marketing (zák. č. 480/2004 Sb., GDPR) requires every
 * campaign e-mail to carry: a working per-recipient unsubscribe link, the
 * sender's identification (name, sídlo, IČO), and the reason the recipient
 * is getting it. All three render unconditionally below the content — a
 * composition cannot opt out of them. The identity values mirror
 * `storefront/src/lib/data/merchant.ts`: same env variables, same registered
 * fallbacks, so the e-mail and the storefront never disagree about who is
 * writing.
 */

export const NEWSLETTER_SENDER = {
  name: "Lucie Polanská",
  address: process.env.SIDLO_ADRESA || "Putim 229, 397 01 Písek",
  registrationNumber: process.env.IDENTIFIKACNI_CISLO || "03441482",
} as const

/** One formatted stretch of paragraph text — mirrors `NewsletterRun`. */
export type EmailNewsletterRun = {
  text?: string
  bold?: boolean
  url?: string
}

/** Mirrors `NewsletterBlock` in `lib/newsletter-blocks.ts` — loose on
 * purpose, because props arrive as plain notification JSON. */
export type EmailNewsletterBlock = {
  type:
    | "heading"
    | "paragraph"
    | "button"
    | "product"
    | "image"
    | "catalog"
    | "promo"
    | "divider"
  text?: string
  /** Heading size: 1 velký titulek · 2 mezititulek · 3 drobný nadpis. */
  level?: number
  /** Rich paragraph runs; a block from before runs existed has `text` only. */
  runs?: EmailNewsletterRun[]
  label?: string
  url?: string
  product_id?: string
  title?: string
  handle?: string
  thumbnail?: string | null
  price_text?: string | null
  /** Image block. */
  src?: string
  alt?: string
  link?: string | null
  /** Catalog block — a grid of product tiles. */
  products?: {
    product_id?: string
    title?: string
    handle?: string
    thumbnail?: string | null
    price_text?: string | null
  }[]
  /** Promo block — akce/sleva announcement. */
  code?: string | null
  note?: string | null
}

export interface NewsletterBlocksEmailProps {
  subject?: string
  preheader?: string
  blocks?: EmailNewsletterBlock[]
  unsubscribeLink?: string
}

/**
 * Render-time twin of the sanitiser's URL rule (`lib/newsletter-blocks.ts`):
 * blocks normally arrive pre-sanitised, but this component renders whatever
 * `notification.data` carries, so it re-checks the scheme itself — a
 * `javascript:` href must be impossible here even if a payload reached the
 * template without passing through `sanitizeBlocks`.
 */
const webUrlOrNull = (url: string | null | undefined): string | null =>
  url && /^https?:\/\//i.test(url) ? url : null

/**
 * Serif headings in three sizes — the H1 voice, stepped down. Level 2 is the
 * pre-levels 24px heading's successor (22px per the brand scale); a stored
 * block without `level` renders as 2, so every already-sent campaign keeps
 * its look.
 */
const HEADING_STYLES: Record<1 | 2 | 3, React.CSSProperties> = {
  1: { fontSize: "28px", lineHeight: "34px", letterSpacing: "-0.4px" },
  2: { fontSize: "22px", lineHeight: "28px", letterSpacing: "-0.3px" },
  3: { fontSize: "17px", lineHeight: "23px", letterSpacing: "-0.2px" },
}

const headingLevelOf = (level: unknown): 1 | 2 | 3 =>
  level === 1 || level === 2 || level === 3 ? level : 2

const BlockHeading = ({
  level,
  children,
}: {
  level?: number
  children: React.ReactNode
}) => (
  <Text
    style={{
      fontFamily: brand.serif,
      fontWeight: 400,
      color: brand.ink,
      margin: "28px 0 12px",
      ...HEADING_STYLES[headingLevelOf(level)],
    }}
  >
    {children}
  </Text>
)

/** Hairline divider — the ledger line, given room to breathe. */
const BlockDivider = () => (
  <Section
    style={{ borderTop: `1px solid ${brand.line}`, margin: "26px 0" }}
  />
)

/**
 * Product card: photo beside serif title, price and a link — the e-mail
 * translation of the storefront's product tile. The link is composed from
 * the handle at render time (`lib/storefront-url.ts`), never stored.
 */
const ProductCard = ({ block }: { block: EmailNewsletterBlock }) => {
  const href = productLink(block.handle) || storeLink()
  const thumbnail = webUrlOrNull(block.thumbnail)

  return (
    <Section
      style={{
        border: `1px solid ${brand.line}`,
        margin: "20px 0",
      }}
    >
      <Row>
        <Column style={{ width: "132px", padding: "12px", verticalAlign: "top" }}>
          {thumbnail ? (
            <Img
              src={thumbnail}
              alt={block.title ?? ""}
              width={120}
              height={120}
              style={{
                display: "block",
                width: "120px",
                height: "120px",
                objectFit: "cover",
                backgroundColor: brand.stone,
              }}
            />
          ) : (
            <div
              style={{
                width: "120px",
                height: "120px",
                backgroundColor: brand.stone,
              }}
            />
          )}
        </Column>
        <Column style={{ padding: "12px 16px 12px 4px", verticalAlign: "middle" }}>
          <Text
            style={{
              fontFamily: brand.serif,
              fontSize: "19px",
              lineHeight: "25px",
              fontWeight: 400,
              color: brand.ink,
              margin: 0,
            }}
          >
            {block.title}
          </Text>
          {block.price_text ? (
            <Text
              style={{
                fontFamily: brand.sans,
                fontSize: "14px",
                lineHeight: "20px",
                color: brand.muted,
                margin: "6px 0 0",
              }}
            >
              {block.price_text}
            </Text>
          ) : null}
          {href ? (
            <Text style={{ margin: "10px 0 0" }}>
              <Link
                href={href}
                style={{
                  fontFamily: brand.sans,
                  fontSize: "14px",
                  color: brand.ink,
                  textDecoration: "underline",
                }}
              >
                Prohlédnout objekt ↗
              </Link>
            </Text>
          ) : null}
        </Column>
      </Row>
    </Section>
  )
}

/**
 * Catalogue grid: product tiles two abreast — the e-mail translation of the
 * storefront's shop grid. Table-based, so every client that can show a
 * newsletter can show the grid; an odd last tile spans its row alone.
 */
const CatalogGrid = ({ block }: { block: EmailNewsletterBlock }) => {
  const tiles = (block.products ?? []).filter(
    (product) => product.title && product.handle
  )
  if (!tiles.length) {
    return null
  }

  const rows: (typeof tiles)[] = []
  for (let index = 0; index < tiles.length; index += 2) {
    rows.push(tiles.slice(index, index + 2))
  }

  return (
    <Section style={{ margin: "20px 0" }}>
      {rows.map((pair, rowIndex) => (
        <Row key={rowIndex}>
          {pair.map((product, columnIndex) => {
            const href = productLink(product.handle) || storeLink()
            const thumbnail = webUrlOrNull(product.thumbnail)
            return (
              <Column
                key={columnIndex}
                style={{
                  width: "50%",
                  padding:
                    columnIndex === 0 ? "6px 8px 6px 0" : "6px 0 6px 8px",
                  verticalAlign: "top",
                }}
              >
                <Section style={{ border: `1px solid ${brand.line}` }}>
                  {thumbnail ? (
                    <Img
                      src={thumbnail}
                      alt={product.title ?? ""}
                      width={260}
                      style={{
                        display: "block",
                        width: "100%",
                        height: "auto",
                        backgroundColor: brand.stone,
                      }}
                    />
                  ) : null}
                  <Section style={{ padding: "10px 12px 12px" }}>
                    <Text
                      style={{
                        fontFamily: brand.serif,
                        fontSize: "16px",
                        lineHeight: "22px",
                        color: brand.ink,
                        margin: 0,
                      }}
                    >
                      {product.title}
                    </Text>
                    {product.price_text ? (
                      <Text
                        style={{
                          fontFamily: brand.sans,
                          fontSize: "13px",
                          lineHeight: "18px",
                          color: brand.muted,
                          margin: "4px 0 0",
                        }}
                      >
                        {product.price_text}
                      </Text>
                    ) : null}
                    {href ? (
                      <Text style={{ margin: "8px 0 0" }}>
                        <Link
                          href={href}
                          style={{
                            fontFamily: brand.sans,
                            fontSize: "13px",
                            color: brand.ink,
                            textDecoration: "underline",
                          }}
                        >
                          Prohlédnout ↗
                        </Link>
                      </Text>
                    ) : null}
                  </Section>
                </Section>
              </Column>
            )
          })}
          {pair.length === 1 ? (
            <Column style={{ width: "50%", padding: "6px 0 6px 8px" }} />
          ) : null}
        </Row>
      ))}
    </Section>
  )
}

/**
 * Akce/sleva: a framed announcement. The code sits in its own dashed box —
 * the one thing the reader must carry to the checkout — and the button is
 * rendered only when a target exists (label alone falls back to „Do
 * obchodu" when a URL is present).
 */
const PromoBox = ({ block }: { block: EmailNewsletterBlock }) => {
  const url = webUrlOrNull(block.url)
  if (!block.title) {
    return null
  }
  return (
    <Section
      style={{
        border: `1px solid ${brand.ink}`,
        padding: "20px 22px",
        margin: "22px 0",
        textAlign: "center" as const,
      }}
    >
      <Text
        style={{
          fontFamily: brand.serif,
          fontSize: "21px",
          lineHeight: "27px",
          color: brand.ink,
          margin: 0,
        }}
      >
        {block.title}
      </Text>
      {block.code ? (
        <Section
          style={{
            border: `1px dashed ${brand.ink}`,
            display: "inline-block",
            padding: "8px 18px",
            margin: "14px 0 0",
          }}
        >
          <Text
            style={{
              fontFamily: "Menlo, Consolas, monospace",
              fontSize: "18px",
              letterSpacing: "0.12em",
              color: brand.ink,
              margin: 0,
            }}
          >
            {block.code}
          </Text>
        </Section>
      ) : null}
      {block.note ? (
        <Text
          style={{
            fontFamily: brand.sans,
            fontSize: "13px",
            lineHeight: "19px",
            color: brand.muted,
            margin: "12px 0 0",
          }}
        >
          {block.note}
        </Text>
      ) : null}
      {url ? (
        <ButtonRow>
          <EmailButton href={url}>{block.label || "Do obchodu"}</EmailButton>
        </ButtonRow>
      ) : null}
    </Section>
  )
}

/** Line breaks preserved — a swallowed newline changes what she said. */
const TextWithBreaks = ({ text }: { text: string }) => (
  <>
    {text.split("\n").map((line, index) => (
      <React.Fragment key={index}>
        {index > 0 ? <br /> : null}
        {line}
      </React.Fragment>
    ))}
  </>
)

/**
 * Paragraph runs → `<strong>` and `<a>`, nothing else. The run model
 * (`lib/newsletter-blocks.ts`) is the only formatting a paragraph can carry;
 * React escapes every character of `text`, so no markup survives the trip.
 * A pre-runs block arrives with plain `text` and renders as one plain run.
 * Run URLs get the same render-time scheme guard as buttons.
 */
const ParagraphText = ({ block }: { block: EmailNewsletterBlock }) => {
  const runs: EmailNewsletterRun[] =
    Array.isArray(block.runs) && block.runs.length
      ? block.runs
      : [{ text: block.text ?? "" }]

  return (
    <P>
      {runs.map((run, index) => {
        let content: React.ReactNode = (
          <TextWithBreaks text={typeof run.text === "string" ? run.text : ""} />
        )
        if (run.bold === true) {
          content = <strong style={{ color: brand.ink }}>{content}</strong>
        }
        const url = webUrlOrNull(run.url)
        if (url) {
          content = (
            <Link
              href={url}
              style={{ color: brand.ink, textDecoration: "underline" }}
            >
              {content}
            </Link>
          )
        }
        return <React.Fragment key={index}>{content}</React.Fragment>
      })}
    </P>
  )
}

/**
 * Photo block: full content width, square corners like every large surface
 * in the brand, `alt` always present for the moment the photo does not load.
 * Wrapped in a link only when the author gave one — and only a web one, the
 * same render-time guard as buttons.
 */
const ImageBlock = ({ block }: { block: EmailNewsletterBlock }) => {
  const src = webUrlOrNull(block.src)
  if (!src) {
    return null
  }
  const link = webUrlOrNull(block.link)

  const image = (
    <Img
      src={src}
      alt={block.alt ?? ""}
      width="100%"
      style={{
        display: "block",
        width: "100%",
        maxWidth: "100%",
        height: "auto",
        margin: "0 auto",
        backgroundColor: brand.stone,
      }}
    />
  )

  return (
    <Section style={{ margin: "20px 0" }}>
      {link ? <Link href={link}>{image}</Link> : image}
    </Section>
  )
}

export function NewsletterBlocksEmail({
  subject = "Zpráva z ateliéru",
  preheader,
  blocks = [],
  // The campaigns route refuses to send without a signed link; if a payload
  // still arrives without one, the footer falls back to „odpovězte" rather
  // than a dead placeholder URL.
  unsubscribeLink = "",
}: NewsletterBlocksEmailProps) {
  // The opening heading gets the H1 voice; later headings step down. A
  // composition that starts with something else opens with the subject, so
  // the e-mail never lacks its serif opening line. A deliberate „drobný
  // nadpis" (level 3) as the first block is the one exception — that choice
  // is explicit, so the subject opens and the small heading stays small.
  // Blocks without a level (every campaign sent before levels existed)
  // normalise to 2 and open exactly as they always did.
  const opensWithHeading =
    blocks[0]?.type === "heading" && headingLevelOf(blocks[0]?.level) !== 3
  const body = opensWithHeading ? blocks.slice(1) : blocks
  const openingLine = opensWithHeading ? blocks[0]?.text ?? subject : subject

  return (
    <EmailLayout preview={preheader?.trim() || subject}>
      <Eyebrow>Z ateliéru</Eyebrow>
      <EmailH1>{openingLine}</EmailH1>

      {body.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <BlockHeading key={index} level={block.level}>
                {block.text}
              </BlockHeading>
            )
          case "paragraph":
            return <ParagraphText key={index} block={block} />
          case "image":
            return <ImageBlock key={index} block={block} />
          case "button": {
            // No web URL, no button — never a `javascript:` (or any other
            // scheme) href, and never a dead `#`.
            const buttonUrl = webUrlOrNull(block.url)
            if (!buttonUrl) {
              return null
            }
            return (
              <ButtonRow key={index}>
                <EmailButton href={buttonUrl}>
                  {block.label}
                </EmailButton>
              </ButtonRow>
            )
          }
          case "product":
            return <ProductCard key={index} block={block} />
          case "catalog":
            return <CatalogGrid key={index} block={block} />
          case "promo":
            return <PromoBox key={index} block={block} />
          case "divider":
            return <BlockDivider key={index} />
          default:
            return null
        }
      })}

      {/* Legal footer — unconditional, see the file comment. */}
      <Section
        style={{ borderTop: `1px solid ${brand.line}`, margin: "32px 0 0" }}
      >
        {unsubscribeLink ? (
          <P small style={{ margin: "16px 0 0" }}>
            Tento e-mail dostáváte, protože jste se přihlásili k odběru novinek
            na keramickazahrada.cz a odběr potvrdili. Odhlásit se můžete
            kdykoli{" "}
            <Link
              href={unsubscribeLink}
              style={{ color: brand.ink, textDecoration: "underline" }}
            >
              zde
            </Link>
            .
          </P>
        ) : (
          <P small style={{ margin: "16px 0 0" }}>
            Tento e-mail dostáváte, protože jste se přihlásili k odběru novinek
            na keramickazahrada.cz a odběr potvrdili. Odhlásit se můžete
            kdykoli — stačí odpovědět na tento e-mail.
          </P>
        )}
        <P small style={{ margin: "8px 0 0" }}>
          Odesílatel: {NEWSLETTER_SENDER.name}, se sídlem{" "}
          {NEWSLETTER_SENDER.address}, IČO {NEWSLETTER_SENDER.registrationNumber}.
        </P>
      </Section>
      <Signature />
    </EmailLayout>
  )
}

// Mock data for preview/development (`pnpm dev:email`).
const mockBlocks: EmailNewsletterBlock[] = [
  { type: "heading", text: "Nové objekty z pece", level: 1 },
  {
    type: "paragraph",
    runs: [
      { text: "Tento týden vyjely z pece " },
      { text: "nové kousky", bold: true },
      { text: " — každý trochu jiný, jak už to u " },
      { text: "dřevem pálené keramiky", url: "https://keramickazahrada.cz/cz/o-mne" },
      { text: " bývá." },
    ],
  },
  {
    type: "image",
    src: "https://keramickazahrada.cz/images/atelier.jpg",
    alt: "Čerstvě vypálené objekty na polici ateliéru",
    link: "https://keramickazahrada.cz/cz/store",
  },
  { type: "heading", text: "Co se povedlo", level: 3 },
  {
    type: "product",
    product_id: "prod_mock",
    title: "Zahradní plastika — Strážce",
    handle: "zahradni-plastika-strazce",
    thumbnail: undefined,
    price_text: "od 2 450 Kč",
  },
  {
    type: "catalog",
    products: [
      {
        product_id: "prod_mock_a",
        title: "Miska se struhadlem",
        handle: "miska-se-struhadlem",
        thumbnail: null,
        price_text: "390 Kč",
      },
      {
        product_id: "prod_mock_b",
        title: "Hrnek s ptáčkem",
        handle: "hrnek-s-ptackem",
        thumbnail: null,
        price_text: "420 Kč",
      },
      {
        product_id: "prod_mock_c",
        title: "Kytička na drátě",
        handle: "kyticka-na-drate",
        thumbnail: null,
        price_text: "180 Kč",
      },
    ],
  },
  {
    type: "promo",
    title: "Podzimní sleva 15 % na všechny hrnky",
    code: "PODZIM15",
    note: "Platí do konce října, nebo do vyprodání zásob.",
    label: "Vybrat hrnek",
    url: "https://keramickazahrada.cz/cz/store",
  },
  { type: "divider" },
  { type: "button", label: "Prohlédnout všechny objekty", url: "https://keramickazahrada.cz/cz/store" },
]

export default () => (
  <NewsletterBlocksEmail
    subject="Nové objekty z pece"
    preheader="Každý kus trochu jiný — jak už to u dřevem pálené keramiky bývá."
    blocks={mockBlocks}
    unsubscribeLink="https://keramickazahrada.cz/unsubscribe?token=abc123"
  />
)
