import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components"
import * as React from "react"
import {
  LEGAL_MANIFEST,
  legalPageUrl,
  sellerFacts,
  sellerIdentityLine,
  type LiveLegalFacts,
  type SellerFacts,
} from "../../../lib/legal"
import type { EmailLineItem } from "../../../lib/email-items"

/* Položky výpisu „za co platíte" skládá `lib/email-items` (jedno místo pro
   objednávku i košík); šablony si typ berou odsud, spolu s `PaidFor`. */
export type { EmailLineItem }

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

/**
 * Záložní kontakt pro texty šablon. Patička (`EmailLayout`) bere e-mail
 * a telefon z živých právních údajů a na tyhle konstanty sahá jen bez nich.
 */
export const CONTACT_EMAIL = "info@keramickazahrada.cz"
export const CONTACT_PHONE = "+420 775 211 578"

/**
 * Živé právní údaje (administrace → Právní údaje) pro patičku a identitu
 * odesílatele.
 *
 * Kontext, ne props: e-mailů je přes padesát a všechny sdílí `EmailLayout`
 * — údaje by jinak musely projít každou šablonou. Resend provider je
 * přečte při odeslání a obalí jimi vykreslený e-mail (`withEmailLegalFacts`);
 * vykreslení zůstává synchronní. Bez kontextu (náhledy, testy, nastavení
 * nejde přečíst) platí identita z manifestu právních dokumentů.
 */
export const EmailLegalFactsContext = React.createContext<LiveLegalFacts | null>(null)

/** Obalí e-mail živými údaji; bez nich ho vrátí, jak je. */
export const withEmailLegalFacts = (
  email: React.ReactNode,
  facts: LiveLegalFacts | null | undefined
): React.ReactNode =>
  facts ? (
    <EmailLegalFactsContext.Provider value={facts}>{email}</EmailLegalFactsContext.Provider>
  ) : (
    email
  )

/** Živé údaje z kontextu (nebo `null`) — pro šablony, které skládají vlastní řádek. */
export const useEmailLegalFacts = (): LiveLegalFacts | null =>
  React.useContext(EmailLegalFactsContext)

/** Prodávající pro tento e-mail — živé údaje, jinak manifest. */
export const useSellerFacts = (): SellerFacts =>
  sellerFacts(LEGAL_MANIFEST, useEmailLegalFacts())

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

/**
 * Víceřádková hodnota do `LedgerRow` (adresa, seznam položek „název · varianta
 * · N ks · částka"): `\n` → `<br/>`. E-mailové klienty `white-space: pre-line`
 * v tabulkách nectí spolehlivě, proto skutečné zalomení.
 */
export const MultiLine = ({ value }: { value: string }) => {
  const lines = String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length)
  return (
    <>
      {lines.map((line, index) => (
        <span key={index}>
          {line}
          {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  )
}

/** Uzavírací vlasová linka pod blokem LedgerRow. */
export const LedgerEnd = () => (
  <Section style={{ borderTop: `1px solid ${brand.line}`, height: "1px" }} />
)

/**
 * „Za co platíte" — položky, kterých se platba týká.
 *
 * ## Proč to existuje
 *
 * E-mail o platbě uváděl jen číslo objednávky, způsob platby a částku. Kdo
 * u nás koupil dvakrát za týden, z něj nepoznal, které z těch dvou
 * objednávek se peníze týkají — a u „platba neprošla" nebo „vracíme peníze"
 * je to horší: zákazník má řešit peníze a neví za co. Faktura to říká, ale
 * ta je příloha, kterou si nikdo neotvírá, aby se podíval, co koupil.
 *
 * U výrobků se vypíší řádky s fotkou (e-mail pak vypadá jako to, co si
 * zákazník koupil); u kurzů a poukazů stačí text — fotku položky nemají a
 * „název · termín · počet míst" řekne vše. Služby (balné, doběrečné) jdou
 * drobným řádkem bez fotky, stejně jako v potvrzení objednávky, aby součet
 * dával smysl a přitom nepřebily výrobky.
 *
 * Bez položek nevykreslí nic — prázdná sekce „za co platíte" je horší než
 * žádná.
 */
export const PaidFor = ({
  items,
  heading = "Za co platíte",
  photos = true,
}: {
  items?: EmailLineItem[] | null
  heading?: string
  /** Vypnuté u kurzů a poukazů. */
  photos?: boolean
}) => {
  const lines = (items ?? []).filter((item) => item?.title)
  if (!lines.length) {
    return null
  }
  /* Pořadové číslo jen u zboží — balné pod ním není druhá položka. */
  const poradi = new Map<EmailLineItem, string>()
  let pocet = 0
  for (const item of lines) {
    if (!item.service) {
      pocet += 1
      poradi.set(item, String(pocet).padStart(2, "0"))
    }
  }

  return (
    <Section style={{ margin: "32px 0 0" }}>
      <Eyebrow>{heading}</Eyebrow>
      {lines.map((item, index) =>
        item.service ? (
          <Row key={index}>
            {photos ? <Column style={{ width: "68px" }} /> : null}
            <Column style={{ padding: "0 0 12px", verticalAlign: "top" }}>
              <Text
                style={{
                  fontFamily: brand.sans,
                  fontSize: "12px",
                  lineHeight: "18px",
                  color: brand.muted,
                  margin: 0,
                }}
              >
                {item.title}
                {Number(item.quantity) > 1 ? ` · ${item.quantity} ks` : ""}
              </Text>
            </Column>
            <Column
              align="right"
              style={{ padding: "0 0 12px", verticalAlign: "top", width: "110px" }}
            >
              <Text
                style={{
                  fontFamily: brand.sans,
                  fontSize: "12px",
                  lineHeight: "18px",
                  color: brand.muted,
                  margin: 0,
                }}
              >
                {item.amount ?? ""}
              </Text>
            </Column>
          </Row>
        ) : (
          <Row key={index} style={{ borderTop: `1px solid ${brand.line}` }}>
            {photos ? (
              <Column
                style={{ width: "68px", padding: "14px 14px 14px 0", verticalAlign: "top" }}
              >
                {item.thumbnail ? (
                  <Img
                    src={item.thumbnail}
                    alt={item.title}
                    width="56"
                    height="66"
                    style={{
                      borderRadius: "10px",
                      objectFit: "cover",
                      backgroundColor: brand.stone,
                    }}
                  />
                ) : (
                  /* Kamenná plocha místo fotky — prázdné místo by řádek
                     rozhodilo a „chybí obrázek" v klientech vypadá jako chyba. */
                  <div
                    style={{
                      width: "56px",
                      height: "66px",
                      borderRadius: "10px",
                      backgroundColor: brand.stone,
                    }}
                  />
                )}
              </Column>
            ) : null}
            <Column style={{ padding: "14px 0", verticalAlign: "top" }}>
              <Text
                style={{
                  fontFamily: brand.sans,
                  fontSize: "10px",
                  lineHeight: "14px",
                  letterSpacing: "1.8px",
                  color: brand.faint,
                  margin: "0 0 4px",
                }}
              >
                {poradi.get(item)}
              </Text>
              <Text
                style={{
                  fontFamily: brand.serif,
                  fontSize: "17px",
                  lineHeight: "22px",
                  color: brand.ink,
                  margin: 0,
                }}
              >
                {item.title}
              </Text>
              {item.subtitle || Number(item.quantity) > 1 ? (
                <Text
                  style={{
                    fontFamily: brand.sans,
                    fontSize: "12px",
                    lineHeight: "18px",
                    color: brand.muted,
                    margin: "2px 0 0",
                  }}
                >
                  {[
                    item.subtitle || "",
                    Number(item.quantity) > 1 ? `${item.quantity} ks` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              ) : null}
            </Column>
            <Column
              align="right"
              style={{ padding: "14px 0", verticalAlign: "top", width: "110px" }}
            >
              <Text
                style={{
                  fontFamily: brand.serif,
                  fontSize: "16px",
                  lineHeight: "22px",
                  color: brand.ink,
                  margin: 0,
                }}
              >
                {item.amount ?? ""}
              </Text>
            </Column>
          </Row>
        )
      )}
      <LedgerEnd />
    </Section>
  )
}

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

/**
 * Podpis Lucie. `closing` je rozloučení nad jménem — výchozí je její
 * vlastní („Přeji hezký den“), e-mail ho může přepsat podle situace
 * („Děkuji a těším se,“ u poptávky, „Mějte se krásně,“ u doručení).
 */
export const Signature = ({ closing = "Přeji hezký den," }: { closing?: string }) => (
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
      {closing}
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
 * „Nechcete tyto e-maily? Odhlásit je jedním kliknutím" — povinný řádek
 * e-mailů z oprávněného zájmu (prosba o recenzi, pokles ceny, košík;
 * § 7 odst. 3 zákona č. 480/2004 Sb.). Odkaz staví `lib/email-optout-link.ts`;
 * bez něj (nenastavená adresa backendu) zůstane možnost odmítnout e-mailem —
 * zákon ji chce v KAŽDÉ zprávě, mrtvý odkaz ale ne.
 */
export const OptOutLine = ({ url }: { url?: string | null }) => (
  <Text
    style={{
      fontFamily: brand.sans,
      fontSize: "12px",
      lineHeight: "18px",
      color: brand.faint,
      margin: "20px 0 0",
    }}
  >
    Nechcete tyto e-maily?{" "}
    {url ? (
      <Link href={url} style={{ color: brand.muted, textDecoration: "underline" }}>
        Odhlásit je jedním kliknutím
      </Link>
    ) : (
      <>
        Napište nám na{" "}
        <Link
          href={`mailto:${CONTACT_EMAIL}`}
          style={{ color: brand.muted, textDecoration: "underline" }}
        >
          {CONTACT_EMAIL}
        </Link>{" "}
        a už je posílat nebudeme.
      </>
    )}
  </Text>
)

/**
 * Identita prodávající a odkazy na právní dokumenty v patičce každého
 * e-mailu. Údaje jdou z právních údajů v administraci (kontext, viz
 * `EmailLegalFactsContext`) — týchž, které web dosazuje do obchodních
 * podmínek; bez nich z manifestu právních dokumentů (`lib/legal`). Chybějící
 * údaj se vynechá — do e-mailu nikdy nejde zástupný text; bez nastaveného
 * storefrontu nejsou ani odkazy (neodkazuje se naslepo).
 */
export const LegalFooter = () => {
  const identity = sellerIdentityLine(LEGAL_MANIFEST, useEmailLegalFacts())
  const links = [
    { label: "Obchodní podmínky", href: legalPageUrl("obchodni-podminky") },
    { label: "Reklamační řád", href: legalPageUrl("reklamacni-rad") },
    { label: "Ochrana osobních údajů", href: legalPageUrl("ochrana-osobnich-udaju") },
  ].filter((link) => link.href)

  if (!identity && !links.length) {
    return null
  }

  return (
    <Text
      style={{
        fontFamily: brand.sans,
        fontSize: "11px",
        lineHeight: "18px",
        color: brand.faint,
        margin: "10px 0 0",
      }}
    >
      {identity ? <>Prodávající: {identity}</> : null}
      {identity && links.length ? <br /> : null}
      {links.map((link, index) => (
        <span key={link.href}>
          {index ? " · " : ""}
          <Link href={link.href} style={{ color: brand.muted, textDecoration: "underline" }}>
            {link.label}
          </Link>
        </span>
      ))}
    </Text>
  )
}

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
}) => {
  const seller = useSellerFacts()
  // Kontakt musí v patičce být vždy — nevyplněný e-mail spadne na záložní
  // adresu; telefon se bez údaje vynechá.
  const contactEmail = seller.email || CONTACT_EMAIL
  const contactPhone = seller.phone
  return (
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
              Dílna Lucie Polanské · Písek
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
              Keramika pro zahradu i domov. Každý kousek modeluji, glazuji
              a pálím sama ve své dílně v Písku.
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
                href={`mailto:${contactEmail}`}
                style={{ color: brand.ink, textDecoration: "underline" }}
              >
                {contactEmail}
              </Link>
              {contactPhone ? <> · {contactPhone}</> : null}
            </Text>
            <LegalFooter />
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
}
