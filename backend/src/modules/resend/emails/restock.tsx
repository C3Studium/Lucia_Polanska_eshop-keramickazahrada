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
  P,
  Signature,
} from "../components/email-ui"
import { storeLink } from "../../../lib/storefront-url"
import { useCopy, useEmailLocale } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: string
  eyebrow: string
  title: string
  accent: string
  intro: string
  note: string
  view: string
  why: string
}> = {
  cs: {
    preview: "Kousek, který jste sledovali, mám zase skladem.",
    eyebrow: "Znovu skladem",
    title: "Je zpátky",
    accent: "skladem.",
    intro: "kousek, který jste si uložili mezi oblíbené, mám zase skladem. Tak vám dávám vědět.",
    note: "Můžete si ho rovnou objednat — u zboží skladem předám balíček dopravci do 3 pracovních dnů.",
    view: "Zobrazit výrobek",
    why: "Tento e-mail vám posílám, protože jste si výrobek uložili mezi oblíbené.",
  },
  sk: {
    preview: "Kúsok, ktorý ste sledovali, mám znova na sklade.",
    eyebrow: "Znova na sklade",
    title: "Je späť",
    accent: "na sklade.",
    intro: "kúsok, ktorý ste si uložili medzi obľúbené, mám znova na sklade. Tak vám dávam vedieť.",
    note: "Môžete si ho rovno objednať — tovar na sklade odovzdám prepravcovi do 3 pracovných dní.",
    view: "Zobraziť výrobok",
    why: "Tento e-mail vám posielam, pretože ste si výrobok uložili medzi obľúbené.",
  },
  pl: {
    preview: "Egzemplarz, który Państwo obserwowali, znów jest dostępny.",
    eyebrow: "Znów dostępne",
    title: "Wrócił",
    accent: "do sprzedaży.",
    intro: "Egzemplarz, który dodali Państwo do ulubionych, znów jest dostępny — daję znać.",
    note: "Można go od razu zamówić — towar dostępny od ręki przekazuję przewoźnikowi w ciągu 3 dni roboczych.",
    view: "Zobacz produkt",
    why: "Wysyłam tę wiadomość, ponieważ dodali Państwo ten produkt do ulubionych.",
  },
  de: {
    preview: "Das Stück, das Sie sich gemerkt haben, ist wieder vorrätig.",
    eyebrow: "Wieder vorrätig",
    title: "Wieder",
    accent: "da.",
    intro: "das Stück, das Sie unter Ihren Favoriten gespeichert haben, ist wieder vorrätig. Ich wollte Ihnen Bescheid geben.",
    note: "Sie können es gleich bestellen – vorrätige Ware übergebe ich innerhalb von 3 Werktagen an den Versanddienst.",
    view: "Zum Produkt",
    why: "Sie erhalten diese E-Mail, weil Sie das Produkt unter Ihren Favoriten gespeichert haben.",
  },
  en: {
    preview: "The piece you saved is back in stock.",
    eyebrow: "Back in stock",
    title: "It's",
    accent: "back.",
    intro: "The piece you saved to your favourites is back in stock. I wanted to let you know.",
    note: "You can order it straight away — I hand items in stock over to the courier within 3 working days.",
    view: "View the piece",
    why: "You're receiving this e-mail because you saved this product to your favourites.",
  },
}

/**
 * Ploché props naplněné v send-restock-notification stepu. Dříve šablona
 * hledala `variant.product_variant.images` — nic z toho na variantě
 * neexistuje, takže e-mail odcházel beze jména, bez fotky a s odkazem
 * na /products/{variant_id}, který storefront neumí (routuje handle).
 */
interface RestockEmailProps {
  product_title?: string;
  variant_title?: string;
  description?: string;
  thumbnail?: string;
  product_url?: string;
}

function RestockEmailComponent({
  product_title,
  variant_title,
  description,
  thumbnail,
  product_url,
}: RestockEmailProps) {
  const t = useCopy(COPY)
  // Popis produktu je jen česky (popisy se nepřekládají — web je přeloží
  // prohlížeč); v cizojazyčném e-mailu by byl jediný český odstavec.
  const showDescription = useEmailLocale() === "cs" && Boolean(description)

  return (
    <EmailLayout preview={t.preview}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting />
      <P>{t.intro}</P>

      {/* Výrobek — řádek podle vzoru objednávky */}
      <Section style={{ margin: "28px 0 0" }}>
        <Row style={{ borderTop: `1px solid ${brand.line}` }}>
          <Column
            style={{ width: "68px", padding: "14px 14px 14px 0", verticalAlign: "top" }}
          >
            {thumbnail ? (
              <Img
                src={thumbnail}
                alt={product_title ?? ""}
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
              {product_title}
              {variant_title ? ` — ${variant_title}` : ""}
            </Text>
            {showDescription ? (
              <Text
                style={{
                  fontFamily: brand.sans,
                  fontSize: "12px",
                  lineHeight: "18px",
                  color: brand.muted,
                  margin: "2px 0 0",
                }}
              >
                {description}
              </Text>
            ) : null}
          </Column>
        </Row>
        <LedgerEnd />
      </Section>

      <Note tone="olive">{t.note}</Note>

      <ButtonRow>
        <EmailButton href={product_url || storeLink()}>{t.view}</EmailButton>
      </ButtonRow>

      <P small>{t.why}</P>
      <Signature />
    </EmailLayout>
  )
}

export const variantRestockEmail = (props: RestockEmailProps) => (
  <RestockEmailComponent {...props} />
)

// Mock data for preview/development
const mockRestock: RestockEmailProps = {
  product_title: "Keramický hrnek",
  variant_title: "modrý",
  description:
    "Ručně malovaný keramický hrnek v krásné modré barvě. Ideální pro ranní kávu nebo čaj.",
  thumbnail:
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
  product_url: "https://keramickazahrada.cz/products/keramicky-hrnek",
}

export default () => <RestockEmailComponent {...mockRestock} />
