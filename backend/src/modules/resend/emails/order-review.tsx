import { Column, Img, Row, Section, Text } from "@react-email/components"
import {
  brand,
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  OptOutLine,
  P,
  Signature,
} from "../components/email-ui"
import { googleReviewUrl } from "../../../lib/google-review-url"
import { storeLink } from "../../../lib/storefront-url"
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: string
  eyebrow: string
  title: string
  accent: string
  intro: string
  yourPiece: string
  order: (n: string) => string
  googleWhy: string
  reviewGoogle: string
  review: string
  rateOnSite: string
  viewProduct: string
  problem: string
  closing: string
}> = {
  cs: {
    preview: "Kousek z mé dílny je u vás už týden — jak se vám s ním žije?",
    eyebrow: "Vaše dojmy",
    title: "Jak se vám",
    accent: "s ním žije?",
    intro:
      "kousek z mé dílny je u vás už týden. Ráda bych věděla, jak se vám s ním žije — vaše dojmy pomůžou mně i lidem, kteří si keramiku teprve vybírají.",
    yourPiece: "váš kousek",
    order: (n) => `Objednávka ${n}`,
    googleWhy:
      "Pár slov na Googlu mi pomůže nejvíc — podle nich mě najdou další lidé, kterým by keramika z dílny udělala radost.",
    reviewGoogle: "Napsat recenzi na Google",
    review: "Napsat recenzi",
    rateOnSite: "Ohodnotit na webu",
    viewProduct: "Zobrazit výrobek",
    problem: "Pokud něco nesedí, napište mi rovnou na info@keramickazahrada.cz a společně to vyřešíme.",
    closing: "Mějte se krásně,",
  },
  sk: {
    preview: "Kúsok z mojej dielne je u vás už týždeň — ako sa vám s ním žije?",
    eyebrow: "Vaše dojmy",
    title: "Ako sa vám",
    accent: "s ním žije?",
    intro:
      "kúsok z mojej dielne je u vás už týždeň. Rada by som vedela, ako sa vám s ním žije — vaše dojmy pomôžu mne aj ľuďom, ktorí si keramiku ešte len vyberajú.",
    yourPiece: "váš kúsok",
    order: (n) => `Objednávka ${n}`,
    googleWhy:
      "Pár slov na Googli mi pomôže najviac — podľa nich ma nájdu ďalší ľudia, ktorým by keramika z dielne urobila radosť.",
    reviewGoogle: "Napísať recenziu na Google",
    review: "Napísať recenziu",
    rateOnSite: "Ohodnotiť na webe",
    viewProduct: "Zobraziť výrobok",
    problem: "Ak niečo nesedí, napíšte mi rovno na info@keramickazahrada.cz a spoločne to vyriešime.",
    closing: "Majte sa krásne,",
  },
  pl: {
    preview: "Ceramika z mojej pracowni jest u Państwa już od tygodnia — jak się sprawdza?",
    eyebrow: "Państwa wrażenia",
    title: "Jak się",
    accent: "sprawdza?",
    intro:
      "Egzemplarz z mojej pracowni jest u Państwa już od tygodnia. Chętnie dowiem się, jak się sprawdza — Państwa wrażenia pomogą mnie i osobom, które dopiero wybierają ceramikę.",
    yourPiece: "Państwa egzemplarz",
    order: (n) => `Zamówienie ${n}`,
    googleWhy:
      "Kilka słów w Google pomoże mi najbardziej — dzięki nim trafią do mnie kolejne osoby, którym ceramika z pracowni sprawi radość.",
    reviewGoogle: "Napisz opinię w Google",
    review: "Napisz opinię",
    rateOnSite: "Oceń na stronie",
    viewProduct: "Zobacz produkt",
    problem: "Jeśli coś jest nie tak, proszę napisać bezpośrednio na info@keramickazahrada.cz — razem to rozwiążemy.",
    closing: "Wszystkiego dobrego",
  },
  de: {
    preview: "Ein Stück aus meiner Werkstatt ist seit einer Woche bei Ihnen – wie gefällt es Ihnen?",
    eyebrow: "Ihre Eindrücke",
    title: "Wie gefällt",
    accent: "es Ihnen?",
    intro:
      "ein Stück aus meiner Werkstatt ist seit einer Woche bei Ihnen. Ich würde gern wissen, wie es Ihnen gefällt – Ihre Eindrücke helfen mir und allen, die sich gerade erst für Keramik entscheiden.",
    yourPiece: "Ihr Stück",
    order: (n) => `Bestellung ${n}`,
    googleWhy:
      "Ein paar Worte bei Google helfen mir am meisten – so finden mich weitere Menschen, denen Keramik aus der Werkstatt Freude machen würde.",
    reviewGoogle: "Bewertung bei Google schreiben",
    review: "Bewertung schreiben",
    rateOnSite: "Auf der Website bewerten",
    viewProduct: "Zum Produkt",
    problem: "Wenn etwas nicht passt, schreiben Sie mir direkt an info@keramickazahrada.cz – wir finden gemeinsam eine Lösung.",
    closing: "Alles Gute",
  },
  en: {
    preview: "A piece from my studio has been with you for a week now — how are you getting on with it?",
    eyebrow: "Your thoughts",
    title: "How are you",
    accent: "getting on with it?",
    intro:
      "A piece from my studio has been with you for a week now. I'd love to know how you're getting on with it — your impressions help me, and they help people who are still choosing their ceramics.",
    yourPiece: "your piece",
    order: (n) => `Order ${n}`,
    googleWhy:
      "A few words on Google help me most — that's how other people find me who would enjoy ceramics from the studio.",
    reviewGoogle: "Write a Google review",
    review: "Write a review",
    rateOnSite: "Rate it on the website",
    viewProduct: "View product",
    problem: "If anything isn't right, write to me directly at info@keramickazahrada.cz and we'll sort it out together.",
    closing: "All the very best,",
  },
}

interface OrderReviewEmailProps {
  customerName?: string;
  orderNumber?: string;
  productName?: string;
  productImage?: string;
  productLink?: string;
  /** Hodnocení produktu na webu (`…/products/<handle>#hodnoceni`). */
  reviewLink?: string;
  /** Recenze na Google — job ji dodá z env; prázdná = bez Googlu. */
  googleReviewLink?: string;
  orderLink?: string;
  /**
   * Odmítnutí dalších proseb jedním kliknutím (`lib/email-optout-link.ts`,
   * § 7 odst. 3 zák. 480/2004 Sb.). Bez něj se řádek nevykreslí.
   */
  unsubscribe_url?: string | null;
}

/**
 * Prosba o recenzi týden po převzetí (docs/sledovani-zasilek.md §6).
 *
 * Hlavní tlačítko vede na Google (GOOGLE_REVIEW_URL / GOOGLE_PLACE_ID —
 * otevře rovnou dialog pro napsání recenze), vedlejší na hodnocení produktu
 * na našem webu. Bez Googlu je hlavní tlačítko web a vedlejší „Zobrazit
 * výrobek". Fotka i tlačítka se vykreslí jen s reálnými daty — job posílá
 * prázdné řetězce, když produkt nemá fotku či handle, a prázdný `src` se v
 * poště ukazuje jako rozbitý obrázek, prázdný `href` jako mrtvé tlačítko.
 */
function OrderReviewEmailComponent({
  customerName,
  orderNumber = "",
  productName,
  productImage = "",
  productLink = "",
  reviewLink = "",
  googleReviewLink,
  orderLink = "",
  unsubscribe_url = null
}: OrderReviewEmailProps) {
  // Job předává odkaz z env; když ho šablona dostane bez něj (náhled), zkusí
  // env sama — obojí přes jeden helper, ať existuje jen jedna pravda.
  const t = useCopy(COPY)
  const name = productName || t.yourPiece
  const googleUrl = googleReviewLink ?? googleReviewUrl() ?? ""
  const siteReviewUrl = reviewLink || productLink || ""
  const primaryUrl = googleUrl || siteReviewUrl || storeLink()
  const primaryLabel = googleUrl ? t.reviewGoogle : t.review

  const secondary = googleUrl
    ? siteReviewUrl && siteReviewUrl !== primaryUrl
      ? { href: siteReviewUrl, label: t.rateOnSite }
      : null
    : productLink && productLink !== primaryUrl
      ? { href: productLink, label: t.viewProduct }
      : null

  return (
    <EmailLayout preview={t.preview}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro}</P>

      <Section style={{ margin: "8px 0 0" }}>
        <Row style={{ borderTop: `1px solid ${brand.line}` }}>
          <Column
            style={{
              width: "68px",
              padding: "14px 14px 14px 0",
              verticalAlign: "top",
            }}
          >
            {productImage ? (
              <Img
                src={productImage}
                alt={name}
                width="56"
                height="66"
                style={{
                  borderRadius: "10px",
                  objectFit: "cover",
                  backgroundColor: brand.stone,
                }}
              />
            ) : (
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
          <Column style={{ padding: "14px 0", verticalAlign: "top" }}>
            <Text
              style={{
                fontFamily: brand.serif,
                fontSize: "17px",
                lineHeight: "22px",
                color: brand.ink,
                margin: 0,
              }}
            >
              {name}
            </Text>
            <Text
              style={{
                fontFamily: brand.sans,
                fontSize: "12px",
                lineHeight: "18px",
                color: brand.muted,
                margin: "2px 0 0",
              }}
            >
              {t.order(orderNumber)}
            </Text>
          </Column>
        </Row>
        <LedgerEnd />
      </Section>

      {googleUrl ? (
        <P small>{t.googleWhy}</P>
      ) : null}

      <ButtonRow>
        {primaryUrl ? (
          <EmailButton href={primaryUrl}>{primaryLabel}</EmailButton>
        ) : null}
        {secondary ? (
          <>
            <span style={{ display: "inline-block", width: "12px" }} />
            <EmailButton href={secondary.href} variant="ghost">
              {secondary.label}
            </EmailButton>
          </>
        ) : null}
      </ButtonRow>

      <P small>{t.problem}</P>
      <Signature closing={t.closing} />
      <OptOutLine url={unsubscribe_url} />
    </EmailLayout>
  )
}

export const OrderReviewEmail = (props: OrderReviewEmailProps) => (
  <OrderReviewEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderReview: OrderReviewEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  productName: "Keramický hrnek - modrý",
  productImage: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
  productLink: "https://keramickazahrada.cz/products/hrnek-modry",
  reviewLink: "https://keramickazahrada.cz/products/hrnek-modry#hodnoceni",
  googleReviewLink: "https://search.google.com/local/writereview?placeid=ChIJexample",
  orderLink: "https://keramickazahrada.cz/orders/12345"
}

export default () => <OrderReviewEmailComponent {...mockOrderReview} />
