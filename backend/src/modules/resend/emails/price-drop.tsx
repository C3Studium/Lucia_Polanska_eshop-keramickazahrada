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
  Note,
  OptOutLine,
  P,
  Signature,
} from "../components/email-ui"
import { storeLink } from "../../../lib/storefront-url"
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: (product: string, price: string) => string
  eyebrow: string
  title: string
  accent: string
  intro: string
  piece: string
  lowest30: string
  validUntil: (date: string) => string
  view: string
  why: string
}> = {
  cs: {
    preview: (product, price) => `${product} je teď za ${price}.`,
    eyebrow: "Změna ceny",
    title: "Oblíbený kousek má",
    accent: "nižší cenu.",
    intro:
      "kousek, který máte mezi oblíbenými, jsem zlevnila. Nikam nespěchám — jen jsem si řekla, že byste to rádi věděli.",
    piece: "Kousek z dílny",
    lowest30: "nejnižší cena za 30 dní před snížením",
    validUntil: (date) => `Tato cena platí do ${date}.`,
    view: "Zobrazit výrobek",
    why: "Tuto zprávu vám posílám, protože máte výrobek uložený mezi oblíbenými.",
  },
  sk: {
    preview: (product, price) => `${product} je teraz za ${price}.`,
    eyebrow: "Zmena ceny",
    title: "Obľúbený kúsok má",
    accent: "nižšiu cenu.",
    intro:
      "kúsok, ktorý máte medzi obľúbenými, som zlacnila. Nikam neponáhľam — len som si povedala, že by ste to radi vedeli.",
    piece: "Kúsok z dielne",
    lowest30: "najnižšia cena za 30 dní pred znížením",
    validUntil: (date) => `Táto cena platí do ${date}.`,
    view: "Zobraziť výrobok",
    why: "Túto správu vám posielam, pretože máte výrobok uložený medzi obľúbenými.",
  },
  pl: {
    preview: (product, price) => `${product} kosztuje teraz ${price}.`,
    eyebrow: "Zmiana ceny",
    title: "Ulubiony egzemplarz",
    accent: "jest tańszy.",
    intro:
      "Obniżyłam cenę egzemplarza, który mają Państwo w ulubionych. Nie ma pośpiechu — pomyślałam po prostu, że chcieliby Państwo o tym wiedzieć.",
    piece: "Z mojej pracowni",
    lowest30: "najniższa cena z 30 dni przed obniżką",
    validUntil: (date) => `Ta cena obowiązuje do ${date}.`,
    view: "Zobacz produkt",
    why: "Wysyłam tę wiadomość, ponieważ mają Państwo ten produkt w ulubionych.",
  },
  de: {
    preview: (product, price) => `${product} gibt es jetzt für ${price}.`,
    eyebrow: "Neuer Preis",
    title: "Ihr Lieblingsstück ist",
    accent: "jetzt günstiger.",
    intro:
      "das Stück, das Sie unter Ihren Favoriten haben, habe ich im Preis gesenkt. Kein Grund zur Eile – ich dachte nur, Sie möchten es wissen.",
    piece: "Aus meiner Werkstatt",
    lowest30: "niedrigster Preis der letzten 30 Tage vor der Senkung",
    validUntil: (date) => `Dieser Preis gilt bis ${date}.`,
    view: "Zum Produkt",
    why: "Sie erhalten diese Nachricht, weil Sie das Produkt unter Ihren Favoriten gespeichert haben.",
  },
  en: {
    preview: (product, price) => `${product} is now ${price}.`,
    eyebrow: "New price",
    title: "Your favourite piece",
    accent: "now costs less.",
    intro:
      "I've lowered the price of the piece you have in your favourites. There's no rush — I just thought you'd like to know.",
    piece: "From my studio",
    lowest30: "lowest price in the 30 days before the reduction",
    validUntil: (date) => `This price is valid until ${date}.`,
    view: "View the piece",
    why: "You're receiving this message because you saved this product to your favourites.",
  },
}

interface PriceDropEmailProps {
  customerName?: string;
  productName?: string;
  productImage?: string;
  originalPrice?: string;
  newPrice?: string;
  discountPercentage?: string;
  productLink?: string;
  timeLimited?: boolean;
  expiryDate?: string;
  /**
   * Odmítnutí dalších upozornění jedním kliknutím (`lib/email-optout-link.ts`,
   * § 7 odst. 3 zák. 480/2004 Sb.). Bez něj se řádek nevykreslí.
   */
  unsubscribe_url?: string | null;
}

/**
 * `timeLimited` je výchoze vypnuté: sleva bez known konce nesmí slibovat
 * datum z mock dat. Poznámka o platnosti se ukáže jen s reálným datem.
 */
function PriceDropEmailComponent({
  customerName,
  productName,
  productImage,
  originalPrice = "",
  newPrice = "",
  productLink = "",
  timeLimited = false,
  expiryDate = "",
  unsubscribe_url = null
}: PriceDropEmailProps) {
  const t = useCopy(COPY)
  const name = productName || t.piece
  const productUrl = productLink || storeLink()
  return (
    <EmailLayout preview={t.preview(name, newPrice)}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro}</P>

      <Section style={{ margin: "28px 0 0" }}>
        <Row style={{ borderTop: `1px solid ${brand.line}` }}>
          <Column
            style={{ width: "68px", padding: "14px 14px 14px 0", verticalAlign: "top" }}
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
              {t.piece}
            </Text>
          </Column>
          <Column
            align="right"
            style={{ padding: "14px 0", verticalAlign: "top", width: "110px" }}
          >
            <Text
              style={{
                fontFamily: brand.sans,
                fontSize: "13px",
                lineHeight: "18px",
                color: brand.clay,
                textDecoration: "line-through",
                margin: "0 0 2px",
              }}
            >
              {originalPrice}
            </Text>
            {/* § 12a ZOS: přeškrtnutá cena je nejnižší cena za 30 dní před
                snížením (počítá ji úloha watch-price-drops z historie cen). */}
            <Text
              style={{
                fontFamily: brand.sans,
                fontSize: "11px",
                lineHeight: "14px",
                color: brand.muted,
                margin: "0 0 4px",
              }}
            >
              {t.lowest30}
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
              {newPrice}
            </Text>
          </Column>
        </Row>
        <LedgerEnd />
      </Section>

      {timeLimited && expiryDate ? (
        <Note tone="olive">{t.validUntil(expiryDate)}</Note>
      ) : null}

      {productUrl ? (
        <ButtonRow>
          <EmailButton href={productUrl}>{t.view}</EmailButton>
        </ButtonRow>
      ) : null}

      {/* Dřív tu stálo „lze kdykoli vypnout v nastavení účtu" — takové
          nastavení účet nemá. Odmítnutí je odkaz pod podpisem. */}
      <P small>{t.why}</P>
      <Signature />
      <OptOutLine url={unsubscribe_url} />
    </EmailLayout>
  )
}

export const PriceDropEmail = (props: PriceDropEmailProps) => (
  <PriceDropEmailComponent {...props} />
)

// Mock data for preview/development
const mockPriceDrop: PriceDropEmailProps = {
  customerName: "Jan Novák",
  productName: "Keramický hrnek - modrý",
  productImage: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
  originalPrice: "450 Kč",
  newPrice: "360 Kč",
  discountPercentage: "20%",
  productLink: "https://keramickazahrada.cz/products/hrnek-modry",
  timeLimited: true,
  expiryDate: "31. 10. 2025"
}

export default () => <PriceDropEmailComponent {...mockPriceDrop} />
