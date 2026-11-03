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
import { cartRecoverLink } from "../../../lib/storefront-url"
import { useCopy, useEmailLocale, useIntlLocale } from "../components/email-i18n"
import { piecesLabel, type Localized } from "../../../lib/email-locale"

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: string
  eyebrow: string
  title: string
  accent: string
  intro: string
  inCart: string
  finish: string
  handmade: string
  help: string
}> = {
  cs: {
    preview: "Zapomněli jste na něco? Košík mám pro vás schovaný — dokončit ho můžete jedním kliknutím.",
    eyebrow: "Váš košík",
    title: "Zapomněli jste",
    accent: "na něco?",
    intro:
      "při poslední návštěvě vám v košíku zůstalo pár kousků z mé dílny. Nechala jsem vám ho tak, jak jste ho opustili — stačí objednávku dokončit a já se o zabalení postarám.",
    inCart: "V košíku",
    finish: "Dokončit objednávku",
    handmade:
      "Každý kousek vzniká u mě v dílně ručně, a tak žádný není úplně stejný jako ten na fotce — to je na ruční práci to hezké. Nikam vás netlačím; jen vám chci říct, že u zboží skladem předám balíček dopravci do 3 pracovních dnů od objednání.",
    help:
      "Kdyby vás cokoli zarazilo, třeba u dopravy nebo platby, napište mi na info@keramickazahrada.cz — odpovídám sama.",
  },
  sk: {
    preview: "Nezabudli ste na niečo? Košík mám pre vás odložený — dokončiť ho môžete jedným kliknutím.",
    eyebrow: "Váš košík",
    title: "Nezabudli ste",
    accent: "na niečo?",
    intro:
      "pri poslednej návšteve vám v košíku zostalo pár kúskov z mojej dielne. Nechala som vám ho tak, ako ste ho opustili — stačí objednávku dokončiť a ja sa postarám o zabalenie.",
    inCart: "V košíku",
    finish: "Dokončiť objednávku",
    handmade:
      "Každý kúsok vzniká v mojej dielni ručne, a tak žiadny nie je úplne rovnaký ako ten na fotke — to je na ručnej práci to pekné. Nikam vás netlačím; chcem vám len povedať, že tovar na sklade odovzdám prepravcovi do 3 pracovných dní od objednania.",
    help:
      "Keby vás čokoľvek zarazilo, napríklad pri doprave alebo platbe, napíšte mi na info@keramickazahrada.cz — odpovedám sama.",
  },
  pl: {
    preview: "Czy czegoś Państwo nie zapomnieli? Koszyk czeka — zamówienie można dokończyć jednym kliknięciem.",
    eyebrow: "Państwa koszyk",
    title: "Czy czegoś Państwo",
    accent: "nie zapomnieli?",
    intro:
      "Podczas ostatniej wizyty w koszyku zostało kilka prac z mojej pracowni. Zostawiłam go tak, jak go Państwo zostawili — wystarczy dokończyć zamówienie, a ja zajmę się zapakowaniem.",
    inCart: "W koszyku",
    finish: "Dokończ zamówienie",
    handmade:
      "Każdy egzemplarz powstaje ręcznie w mojej pracowni, więc żaden nie jest identyczny jak ten na zdjęciu — i właśnie to jest piękne w ręcznej pracy. Niczego nie narzucam; chcę tylko dać znać, że towar dostępny od ręki przekazuję przewoźnikowi w ciągu 3 dni roboczych od zamówienia.",
    help:
      "Gdyby coś budziło wątpliwości, na przykład dostawa albo płatność, proszę napisać na info@keramickazahrada.cz — odpowiadam osobiście.",
  },
  de: {
    preview: "Haben Sie etwas vergessen? Ich habe Ihren Warenkorb aufgehoben – Sie können die Bestellung mit einem Klick abschließen.",
    eyebrow: "Ihr Warenkorb",
    title: "Haben Sie",
    accent: "etwas vergessen?",
    intro:
      "bei Ihrem letzten Besuch sind ein paar Stücke aus meiner Werkstatt im Warenkorb geblieben. Ich habe ihn so gelassen, wie Sie ihn verlassen haben – Sie müssen die Bestellung nur noch abschließen, um das Verpacken kümmere ich mich.",
    inCart: "Im Warenkorb",
    finish: "Bestellung abschließen",
    handmade:
      "Jedes Stück entsteht bei mir in der Werkstatt von Hand, deshalb gleicht keines genau dem auf dem Foto – das ist das Schöne an Handarbeit. Ich will Sie zu nichts drängen; nur so viel: Vorrätige Ware übergebe ich innerhalb von 3 Werktagen nach der Bestellung an den Versanddienst.",
    help:
      "Falls Sie etwas zögern lässt, etwa beim Versand oder bei der Zahlung, schreiben Sie mir an info@keramickazahrada.cz – ich antworte selbst.",
  },
  en: {
    preview: "Did you forget something? I've kept your basket for you — you can finish your order in one click.",
    eyebrow: "Your basket",
    title: "Did you forget",
    accent: "something?",
    intro:
      "On your last visit, a few pieces from my studio were left in your basket. I've kept it just as you left it — all you need to do is finish your order, and I'll take care of the packing.",
    inCart: "In your basket",
    finish: "Finish my order",
    handmade:
      "Every piece is made by hand in my studio, so none is quite the same as the one in the photo — that's the lovely thing about handmade work. I don't want to rush you; I just wanted to let you know that I hand items in stock over to the courier within 3 working days of your order.",
    help:
      "If anything is holding you back, such as delivery or payment, just write to me at info@keramickazahrada.cz — I answer every message myself.",
  },
}

interface AbandonedCartEmailProps {
  customer?: {
    first_name?: string;
  };
  cart_id?: string;
  /** The cart's own currency — CZK when the caller predates the field. */
  currency_code?: string;
  items?: Array<{
    thumbnail?: string;
    product_title?: string;
    quantity?: number;
    unit_price?: number;
  }>;
  /**
   * Odmítnutí dalších připomenutí jedním kliknutím (`lib/email-optout-link.ts`,
   * § 7 odst. 3 zák. 480/2004 Sb.). Bez něj se řádek nevykreslí.
   */
  unsubscribe_url?: string | null;
}

function AbandonedCartEmailComponent({
  customer,
  cart_id = "sample-cart-id",
  currency_code = "CZK",
  items = [],
  unsubscribe_url = null
}: AbandonedCartEmailProps) {
  const t = useCopy(COPY)
  const ks = piecesLabel(useEmailLocale())

  // Zápis čísla podle jazyka e-mailu; měna je měna košíku.
  const formatter = new Intl.NumberFormat(useIntlLocale(), {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: (currency_code || "CZK").toUpperCase(),
  })

  return (
    <EmailLayout preview={t.preview}>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customer?.first_name} />
      <P>{t.intro}</P>

      {/* Co je v košíku */}
      <Section style={{ margin: "28px 0 0" }}>
        <Eyebrow>{t.inCart}</Eyebrow>
        {items?.map((item, idx) => (
          <Row key={idx} style={{ borderTop: `1px solid ${brand.line}` }}>
            <Column
              style={{ width: "68px", padding: "14px 14px 14px 0", verticalAlign: "top" }}
            >
              {item.thumbnail ? (
                <Img
                  src={item.thumbnail}
                  alt={item.product_title ?? ""}
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
                  fontFamily: brand.sans,
                  fontSize: "10px",
                  lineHeight: "14px",
                  letterSpacing: "1.8px",
                  color: brand.faint,
                  margin: "0 0 4px",
                }}
              >
                {String(idx + 1).padStart(2, "0")}
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
                {item.product_title}
              </Text>
              {(item.quantity ?? 0) > 1 ? (
                <Text
                  style={{
                    fontFamily: brand.sans,
                    fontSize: "12px",
                    lineHeight: "18px",
                    color: brand.muted,
                    margin: "2px 0 0",
                  }}
                >
                  {item.quantity} {ks}
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
                {/* Medusa v2 prices are major units — the old `/ 100` showed
                    a 450Kč plate as 4,50 Kč. */}
                {formatter.format(item.unit_price || 0)}
              </Text>
            </Column>
          </Row>
        ))}
        <LedgerEnd />
      </Section>

      <ButtonRow>
        <EmailButton href={cartRecoverLink(cart_id)}>{t.finish}</EmailButton>
      </ButtonRow>

      <P>{t.handmade}</P>

      <P small>{t.help}</P>
      <Signature />
      <OptOutLine url={unsubscribe_url} />
    </EmailLayout>
  );
}

export const abandonedCartEmail = (props: AbandonedCartEmailProps) => (
  <AbandonedCartEmailComponent {...props} />
);


// Mock data for preview/development
const mockCustomer = {
  first_name: "Jan"
};

const mockItems = [
  {
    thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
    product_title: "Keramický hrnek",
    quantity: 2,
    unit_price: 250 // 250 Kč — major units, like the real cart items
  },
  {
    thumbnail: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
    product_title: "Keramická mísa",
    quantity: 1,
    unit_price: 450 // 450 Kč
  }
];

export default () => (
  <AbandonedCartEmailComponent
    customer={mockCustomer}
    cart_id="sample-cart-123"
    items={mockItems}
  />
);
