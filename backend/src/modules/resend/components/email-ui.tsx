import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"

/**
 * Sdílený vizuální systém e-mailů — převod designu storefrontu do řeči,
 * které rozumí e-mailoví klienti.
 *
 * Zdrojem je skutečný design storefrontu (SCSS, ne Tailwind config):
 * inkoust `#20211c` + krémová `#ffe8d6` nesou vše, oliva/šalvěj jsou akcent,
 * struktura je vlasová linka (ledger), ne boxy; serif nadpisy váhy 400
 * s kurzívním akcentem; verzálkové mikropopisky s prostrkáním.
 *
 * E-mailová omezení, která tu platí všude: žádný flex/grid, žádné gradienty,
 * žádné rgba (barvy jsou předem složené do plných hexů), žádné web fonty —
 * Sentient → Georgia, Sansation → Helvetica.
 */
export const brand = {
  ink: "#20211c",
  /** Text odstavců — inkoust v 80 % kryvosti, složený nad krémovou. */
  body: "#4d4941",
  /** Sekundární text — inkoust v 66 % nad krémovou. */
  muted: "#6b6459",
  /** Popisky a ornament — inkoust v 50 % nad krémovou. */
  faint: "#8f8479",
  cream: "#ffe8d6",
  paper: "#f2eee5",
  sage: "#bbb788",
  olive: "#7b8467",
  clay: "#9a6f65",
  danger: "#ae0202",
  /** Vlasová linka — inkoust ve 20 % nad krémovou. */
  line: "#d2c0b1",
  /** Kamenná podkladová pro chybějící fotografie objektů. */
  stone: "#ded9cb",
  serif: "Georgia, 'Times New Roman', serif",
  sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
} as const

export const CONTACT_EMAIL = "info@keramickazahrada.cz"
export const CONTACT_PHONE = "+420 775 211 578"

const eyebrowStyle: React.CSSProperties = {
  fontFamily: brand.sans,
  fontSize: "11px",
  lineHeight: "16px",
  fontWeight: 700,
  letterSpacing: "2.2px",
  textTransform: "uppercase",
  color: brand.olive,
  margin: "0 0 14px",
}

/** Verzálkový mikropopisek — „štítek na zdi galerie“. `index` dá „01 · “. */
export const Eyebrow = ({
  children,
  index,
  style,
}: {
  children: React.ReactNode
  index?: string
  style?: React.CSSProperties
}) => (
  <Text style={{ ...eyebrowStyle, ...style }}>
    {index ? `${index} · ` : null}
    {children}
  </Text>
)

/**
 * Hlavní nadpis — serif, váha 400, nikdy tučně. Druhý řádek (`accent`)
 * je podpisový vzor storefrontu: kurzíva zabarvená do olivy.
 */
export const EmailH1 = ({
  children,
  accent,
}: {
  children: React.ReactNode
  accent?: React.ReactNode
}) => (
  <Heading
    as="h1"
    style={{
      fontFamily: brand.serif,
      fontSize: "34px",
      lineHeight: "38px",
      fontWeight: 400,
      letterSpacing: "-0.5px",
      color: brand.ink,
      margin: "0 0 20px",
    }}
  >
    {children}
    {accent ? (
      <>
        <br />
        <em style={{ color: brand.olive, fontWeight: 400 }}>{accent}</em>
      </>
    ) : null}
  </Heading>
)

/** Odstavec běžného textu. */
export const P = ({
  children,
  small,
  style,
}: {
  children: React.ReactNode
  small?: boolean
  style?: React.CSSProperties
}) => (
  <Text
    style={{
      fontFamily: brand.sans,
      fontSize: small ? "13px" : "15px",
      lineHeight: small ? "20px" : "24px",
      color: small ? brand.muted : brand.body,
      margin: "0 0 16px",
      ...style,
    }}
  >
    {children}
  </Text>
)

/**
 * Oslovení. `customerName()` v `lib/customer-email.ts` vrací celé jméno
 * v 1. pádě, nebo náhradu „Vážený zákazníku“ — „Dobrý den, Vážený
 * zákazníku,“ je dvojité oslovení, proto náhrada i prázdné jméno
 * shodně končí u prostého „Dobrý den,“.
 */
export const Greeting = ({ name }: { name?: string | null }) => {
  const trimmed = (name ?? "").trim()
  const usable = trimmed && !/^vážen/i.test(trimmed)
  return <P>{usable ? `Dobrý den, ${trimmed},` : "Dobrý den,"}</P>
}

/**
 * Řádek účetní knihy — popisek vlevo (verzálky, prostrkání), hodnota vpravo.
 * `strong` přepne hodnotu do serifu pro součty; `tone` přebarví hodnotu.
 */
export const LedgerRow = ({
  label,
  value,
  strong,
  tone,
}: {
  label: React.ReactNode
  value: React.ReactNode
  strong?: boolean
  tone?: "ink" | "olive" | "clay" | "danger"
}) => {
  const valueColor =
    tone === "olive"
      ? brand.olive
      : tone === "clay"
        ? brand.clay
        : tone === "danger"
          ? brand.danger
          : brand.ink
  return (
    <Row style={{ borderTop: `1px solid ${brand.line}` }}>
      <Column style={{ padding: "11px 0", verticalAlign: "top" }}>
        <Text
          style={{
            fontFamily: brand.sans,
            fontSize: "11px",
            lineHeight: "18px",
            fontWeight: 700,
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            color: brand.faint,
            margin: 0,
          }}
        >
          {label}
        </Text>
      </Column>
      <Column
        align="right"
        style={{ padding: "11px 0", verticalAlign: "top" }}
      >
        <Text
          style={
            strong
              ? {
                  fontFamily: brand.serif,
                  fontSize: "19px",
                  lineHeight: "24px",
                  fontWeight: 400,
                  color: valueColor,
                  margin: 0,
                }
              : {
                  fontFamily: brand.sans,
                  fontSize: "15px",
                  lineHeight: "22px",
                  color: valueColor,
                  margin: 0,
                }
          }
        >
          {value}
        </Text>
      </Column>
    </Row>
  )
}

/** Uzavírací vlasová linka pod blokem LedgerRow. */
export const LedgerEnd = () => (
  <Section style={{ borderTop: `1px solid ${brand.line}`, height: "1px" }} />
)

/**
 * Pilulkové tlačítko podle storefrontu: plný inkoust s krémovým textem
 * (primary), nebo jen vlasový rám (ghost). Šipka „↗“ patří k labelu.
 * Outlook zahodí kulaté rohy — tlačítko zůstane hranaté, ale funkční.
 */
export const EmailButton = ({
  href,
  children,
  variant = "primary",
}: {
  href: string
  children: React.ReactNode
  variant?: "primary" | "ghost"
}) => (
  <Link
    href={href}
    style={{
      display: "inline-block",
      backgroundColor: variant === "primary" ? brand.ink : brand.cream,
      color: variant === "primary" ? brand.cream : brand.ink,
      border: `1px solid ${brand.ink}`,
      borderRadius: "999px",
      padding: "13px 26px",
      fontFamily: brand.sans,
      fontSize: "14px",
      lineHeight: "14px",
      letterSpacing: "0.3px",
      textDecoration: "none",
    }}
  >
    {children}
    <span style={{ paddingLeft: "10px" }}>↗</span>
  </Link>
)

/** Blok pro jedno či dvě tlačítka s korektními rozestupy. */
export const ButtonRow = ({ children }: { children: React.ReactNode }) => (
  <Section style={{ margin: "28px 0" }}>{children}</Section>
)

/**
 * Akcentová poznámka — nahrazuje barevné „alert boxy“: krátká věta
 * v kurzívním serifu za svislou linkou, přesně jako druhý hlas titulků.
 */
export const Note = ({
  children,
  tone = "olive",
}: {
  children: React.ReactNode
  tone?: "olive" | "clay" | "danger"
}) => {
  const color =
    tone === "clay" ? brand.clay : tone === "danger" ? brand.danger : brand.olive
  return (
    <Section
      style={{
        borderLeft: `2px solid ${color}`,
        margin: "24px 0",
      }}
    >
      <Text
        style={{
          fontFamily: brand.serif,
          fontStyle: "italic",
          fontSize: "17px",
          lineHeight: "26px",
          color,
          margin: 0,
          paddingLeft: "16px",
        }}
      >
        {children}
      </Text>
    </Section>
  )
}

/** Podpis ateliéru. */
export const Signature = () => (
  <Section style={{ margin: "30px 0 0" }}>
    <Text
      style={{
        fontFamily: brand.sans,
        fontSize: "13px",
        lineHeight: "20px",
        color: brand.muted,
        margin: 0,
      }}
    >
      S pozdravem,
    </Text>
    <Text
      style={{
        fontFamily: brand.serif,
        fontStyle: "italic",
        fontSize: "19px",
        lineHeight: "26px",
        color: brand.ink,
        margin: "2px 0 0",
      }}
    >
      Lucie Polanská
    </Text>
    <Text
      style={{
        fontFamily: brand.sans,
        fontSize: "10px",
        lineHeight: "16px",
        letterSpacing: "2px",
        textTransform: "uppercase",
        color: brand.faint,
        margin: "6px 0 0",
      }}
    >
      Keramická zahrada · Písek
    </Text>
  </Section>
)

/**
 * Kabát každého e-mailu: papírové pozadí, krémový list s vlasovým rámem,
 * hranaté rohy (velké plochy jsou ve storefrontu hranaté), textový wordmark
 * v hlavičce — ručně kreslené logo je SVG, které Gmail nevykreslí,
 * a serifový wordmark je tomu, jak značku sází patička webu, nejblíž.
 */
export const EmailLayout = ({
  preview,
  children,
}: {
  preview: string
  children: React.ReactNode
}) => (
  <Html lang="cs">
    <Head />
    <Preview>{preview}</Preview>
    <Body
      style={{
        backgroundColor: brand.paper,
        margin: 0,
        padding: "28px 12px",
        fontFamily: brand.sans,
      }}
    >
      <Container
        style={{
          width: "100%",
          maxWidth: "600px",
          backgroundColor: brand.cream,
          border: `1px solid ${brand.line}`,
        }}
      >
        {/* Hlavička */}
        <Section
          style={{
            padding: "32px 36px 24px",
            borderBottom: `1px solid ${brand.line}`,
          }}
        >
          <Text
            style={{
              fontFamily: brand.sans,
              fontSize: "10px",
              lineHeight: "16px",
              letterSpacing: "2.4px",
              textTransform: "uppercase",
              color: brand.faint,
              margin: 0,
            }}
          >
            Ateliér Lucie Polanské · Písek
          </Text>
          <Text
            style={{
              fontFamily: brand.serif,
              fontSize: "28px",
              lineHeight: "34px",
              fontWeight: 400,
              letterSpacing: "-0.5px",
              color: brand.ink,
              margin: "8px 0 0",
            }}
          >
            Keramická{" "}
            <em style={{ color: brand.olive }}>zahrada</em>
          </Text>
        </Section>

        {/* Obsah */}
        <Section style={{ padding: "36px 36px 40px" }}>{children}</Section>

        {/* Patička */}
        <Section
          style={{
            padding: "26px 36px 34px",
            borderTop: `1px solid ${brand.line}`,
          }}
        >
          <Text
            style={{
              fontFamily: brand.serif,
              fontStyle: "italic",
              fontSize: "15px",
              lineHeight: "23px",
              color: brand.olive,
              margin: "0 0 14px",
            }}
          >
            Objekty z hlíny pro zahradu i domov. Každý kus vzniká rukama
            v píseckém ateliéru.
          </Text>
          <Text
            style={{
              fontFamily: brand.sans,
              fontSize: "12px",
              lineHeight: "20px",
              color: brand.muted,
              margin: "0 0 4px",
            }}
          >
            Potřebujete poradit? Napište na{" "}
            <Link
              href={`mailto:${CONTACT_EMAIL}`}
              style={{ color: brand.ink, textDecoration: "underline" }}
            >
              {CONTACT_EMAIL}
            </Link>{" "}
            · {CONTACT_PHONE}
          </Text>
          <Text
            style={{
              fontFamily: brand.sans,
              fontSize: "11px",
              lineHeight: "18px",
              color: brand.faint,
              margin: "10px 0 0",
            }}
          >
            © {new Date().getFullYear()} Keramická zahrada · Lucie Polanská.
            Všechna práva vyhrazena.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)
