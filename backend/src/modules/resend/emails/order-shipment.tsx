import { Link } from "@react-email/components"
import {
  brand,
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  Note,
  P,
  Signature,
} from "../components/email-ui"
import { storeLink } from "../../../lib/storefront-url"
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

/** Texty po jazycích (lib/email-locale) — čeština je původní znění. */
const COPY: Localized<{
  preview: (orderNumber: string) => string
  eyebrow: string
  title: string
  accent: string
  intro: (orderNumber: string) => string
  order: string
  carrier: string
  tracking: string
  estimate: string
  track: string
  viewOrder: string
  fragile: string
  inspect: string
  carrierNotice: string
  withdrawalBefore: string
  withdrawalLink: string
}> = {
  cs: {
    preview: (n) => `Objednávku ${n} jsem předala dopravci — je na cestě k vám.`,
    eyebrow: "Zásilka",
    title: "Vaše objednávka",
    accent: "je na cestě k vám.",
    intro: (n) =>
      `objednávku ${n} jsem předala dopravci. Každý kousek jsem zabalila ručně, aby k vám dorazil tak, jak odešel z dílny.`,
    order: "Objednávka",
    carrier: "Dopravce",
    tracking: "Číslo zásilky",
    estimate: "Odhad doručení",
    track: "Sledovat zásilku",
    viewOrder: "Zobrazit objednávku",
    fragile: "Keramika je křehká, proto cestuje v pořádném balení.",
    inspect:
      "Až zásilka dorazí, prohlédněte si prosím obal ještě při převzetí. Je-li promáčklý, protržený nebo prosakuje, rozbalte balík rovnou před doručovatelem a poškození s ním sepište — se záznamem vyřídí pošta reklamaci nejsnáz. Poškozený obal totiž hlásíte na kterékoli poště, nejlépe do dvou pracovních dnů od převzetí; náhradu vyplácí Česká pošta adresátovi, tedy vám. Je-li obal v pořádku a rozbitý jen kousek, napište mi a přiložte fotky — vyměním ho nebo vám vrátím peníze. Obal si prosím v obou případech schovejte.",
    carrierNotice:
      "O doručení vám dá dopravce vědět SMS nebo e-mailem. Když vás nezastihne, zásilku uloží k vyzvednutí.",
    withdrawalBefore:
      "Kdybyste si to rozmysleli: od kupní smlouvy můžete odstoupit bez udání důvodu do 14 dnů od převzetí zboží, online přes tlačítko",
    withdrawalLink: "Odstoupit od smlouvy",
  },
  sk: {
    preview: (n) => `Objednávku ${n} som odovzdala prepravcovi — je na ceste k vám.`,
    eyebrow: "Zásielka",
    title: "Vaša objednávka",
    accent: "je na ceste k vám.",
    intro: (n) =>
      `objednávku ${n} som odovzdala prepravcovi. Každý kúsok som zabalila ručne, aby k vám dorazil taký, aký odišiel z dielne.`,
    order: "Objednávka",
    carrier: "Prepravca",
    tracking: "Číslo zásielky",
    estimate: "Predpokladané doručenie",
    track: "Sledovať zásielku",
    viewOrder: "Zobraziť objednávku",
    fragile: "Keramika je krehká, preto cestuje v poriadnom balení.",
    inspect:
      "Keď zásielka dorazí, prezrite si, prosím, obal ešte pri prevzatí. Ak je pomačkaný, roztrhnutý alebo presakuje, rozbaľte balík priamo pred doručovateľom a poškodenie s ním spíšte — so záznamom vybaví pošta reklamáciu najľahšie. Poškodený obal totiž hlásite na ktorejkoľvek pošte, najlepšie do dvoch pracovných dní od prevzatia; náhradu vypláca Česká pošta adresátovi, teda vám. Ak je obal v poriadku a rozbitý len kúsok, napíšte mi a priložte fotky — vymením ho alebo vám vrátim peniaze. Obal si, prosím, v oboch prípadoch odložte.",
    carrierNotice:
      "O doručení vám dá prepravca vedieť SMS alebo e-mailom. Ak vás nezastihne, zásielku uloží na vyzdvihnutie.",
    withdrawalBefore:
      "Keby ste si to rozmysleli: od kúpnej zmluvy môžete odstúpiť bez uvedenia dôvodu do 14 dní od prevzatia tovaru, online cez tlačidlo",
    withdrawalLink: "Odstúpiť od zmluvy",
  },
  pl: {
    preview: (n) => `Zamówienie ${n} przekazałam przewoźnikowi — jest już w drodze.`,
    eyebrow: "Przesyłka",
    title: "Państwa zamówienie",
    accent: "jest już w drodze.",
    intro: (n) =>
      `Zamówienie ${n} przekazałam przewoźnikowi. Każdy egzemplarz zapakowałam ręcznie, żeby dotarł do Państwa w takim stanie, w jakim opuścił pracownię.`,
    order: "Zamówienie",
    carrier: "Przewoźnik",
    tracking: "Numer przesyłki",
    estimate: "Przewidywana dostawa",
    track: "Śledź przesyłkę",
    viewOrder: "Zobacz zamówienie",
    fragile: "Ceramika jest delikatna, dlatego podróżuje w solidnym opakowaniu.",
    inspect:
      "Gdy przesyłka dotrze, proszę obejrzeć opakowanie jeszcze przy odbiorze. Jeśli jest zgniecione, rozdarte albo przecieka, proszę otworzyć paczkę przy doręczycielu i spisać z nim protokół szkody — z protokołem poczta rozpatrzy reklamację najszybciej. Uszkodzone opakowanie zgłasza się bowiem na dowolnej poczcie, najlepiej w ciągu dwóch dni roboczych od odbioru; odszkodowanie Poczta Czeska wypłaca adresatowi, czyli Państwu. Jeśli opakowanie jest całe, a uszkodzony tylko egzemplarz, proszę do mnie napisać i dołączyć zdjęcia — wymienię go albo zwrócę pieniądze. W obu przypadkach proszę zachować opakowanie.",
    carrierNotice:
      "O doręczeniu poinformuje Państwa przewoźnik SMS-em lub e-mailem. Jeśli nie zastanie Państwa w domu, zostawi przesyłkę do odbioru.",
    withdrawalBefore:
      "Gdyby zmienili Państwo zdanie: od umowy sprzedaży można odstąpić bez podania przyczyny w ciągu 14 dni od otrzymania towaru, online przyciskiem",
    withdrawalLink: "Odstąpienie od umowy",
  },
  de: {
    preview: (n) => `Ihre Bestellung ${n} habe ich dem Versanddienst übergeben – sie ist unterwegs.`,
    eyebrow: "Versand",
    title: "Ihre Bestellung",
    accent: "ist unterwegs zu Ihnen.",
    intro: (n) =>
      `Ihre Bestellung ${n} habe ich dem Versanddienst übergeben. Jedes Stück habe ich von Hand verpackt, damit es so bei Ihnen ankommt, wie es meine Werkstatt verlassen hat.`,
    order: "Bestellung",
    carrier: "Versanddienst",
    tracking: "Sendungsnummer",
    estimate: "Voraussichtliche Zustellung",
    track: "Sendung verfolgen",
    viewOrder: "Bestellung ansehen",
    fragile: "Keramik ist zerbrechlich – deshalb reist sie gut verpackt.",
    inspect:
      "Wenn das Paket ankommt, sehen Sie sich die Verpackung bitte schon bei der Übergabe an. Ist sie eingedrückt, eingerissen oder feucht, öffnen Sie das Paket direkt vor dem Zusteller und halten Sie den Schaden mit ihm fest – mit einem Protokoll bearbeitet die Post die Reklamation am einfachsten. Eine beschädigte Verpackung melden Sie nämlich in einer beliebigen Postfiliale, am besten innerhalb von zwei Werktagen nach der Übernahme; die Entschädigung zahlt die Tschechische Post an den Empfänger, also an Sie. Ist die Verpackung in Ordnung und nur das Stück zerbrochen, schreiben Sie mir mit Fotos – ich tausche es aus oder erstatte Ihnen den Betrag. Heben Sie die Verpackung bitte in beiden Fällen auf.",
    carrierNotice:
      "Der Versanddienst informiert Sie per SMS oder E-Mail über die Zustellung. Wenn er Sie nicht antrifft, hinterlegt er das Paket zur Abholung.",
    withdrawalBefore:
      "Falls Sie es sich anders überlegen: Sie können innerhalb von 14 Tagen nach Erhalt der Ware ohne Angabe von Gründen vom Kaufvertrag zurücktreten – online über die Schaltfläche",
    withdrawalLink: "Vom Vertrag zurücktreten",
  },
  en: {
    preview: (n) => `I've handed order ${n} over to the courier — it's on its way to you.`,
    eyebrow: "Shipment",
    title: "Your order",
    accent: "is on its way to you.",
    intro: (n) =>
      `I've handed your order ${n} over to the courier. I wrapped every piece by hand so that it reaches you just as it left my studio.`,
    order: "Order",
    carrier: "Courier",
    tracking: "Tracking number",
    estimate: "Estimated delivery",
    track: "Track parcel",
    viewOrder: "View order",
    fragile: "Ceramics are fragile, so they travel in sturdy packaging.",
    inspect:
      "When the parcel arrives, please take a look at the packaging while the courier is still there. If it's dented, torn or wet, open the parcel in front of the courier and have the damage recorded — with a record, the post office handles the claim most easily. Damaged packaging is reported at any post office, ideally within two working days of receipt; Česká pošta pays the compensation to the addressee, that is to you. If the box is fine and only the piece is broken, write to me with photos — I'll replace it or refund you. Either way, please keep the packaging.",
    carrierNotice:
      "The courier will let you know about the delivery by text message or e-mail. If you're not in, they'll leave the parcel for you to collect.",
    withdrawalBefore:
      "If you change your mind: you can withdraw from the purchase contract without giving any reason within 14 days of receiving the goods, online using the button",
    withdrawalLink: "Withdraw from the contract",
  },
}

interface OrderShipmentEmailProps {
  customerName?: string;
  orderNumber?: string;
  trackingNumber?: string;
  carrierName?: string;
  /** Only when somebody actually promised one — no fabricated estimate. */
  estimatedDelivery?: string;
  trackingLink?: string;
  orderLink?: string;
  /**
   * Podepsaný odkaz na „Odstoupit od smlouvy" (`/order/:id/odstoupeni`,
   * § 1830a OZ). Prázdný u čisté zakázky (§ 1837 písm. d) — pak se odstavec
   * nevykreslí.
   */
  withdrawalUrl?: string;
}

/**
 * Sledování, dopravce i odhad doručení se vykreslí jen s reálnými daty —
 * dřívější výchozí hodnoty („CZ123456789", „2-3 pracovní dny") by v ostrém
 * e-mailu tvrdily číslo zásilky a termín, které nikdo neslíbil.
 *
 * ## Převzetí zásilky (14. 10. 2026, právní audit §4.1)
 *
 * Prohlédnout obal při převzetí je PROSBA, ne podmínka: za vadu při převzetí
 * odpovídá prodávající (§ 2161 OZ) a škodu s dopravcem řeší ona. Dřívější
 * blok `CarrierDamageWarning` („do dvou pracovních dnů — potom už reklamaci
 * Česká pošta nepřijme") přenášel lhůtu dopravce na zákazníka.
 */
function OrderShipmentEmailComponent({
  customerName,
  orderNumber = "",
  trackingNumber,
  carrierName,
  estimatedDelivery,
  trackingLink = "",
  orderLink = "",
  withdrawalUrl = "",
}: OrderShipmentEmailProps) {
  // Subscriber may pass empty strings when the carrier runs in record-only
  // mode — then the e-mail goes without the tracking row and button.
  const t = useCopy(COPY)
  const hasTracking = Boolean(trackingLink)
  const orderUrl = orderLink || storeLink()

  return (
    <EmailLayout
      preview={t.preview(orderNumber)}
    >
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro(orderNumber)}</P>

      {orderNumber ? <LedgerRow label={t.order} value={orderNumber} /> : null}
      {carrierName ? <LedgerRow label={t.carrier} value={carrierName} /> : null}
      {trackingNumber ? (
        <LedgerRow label={t.tracking} value={trackingNumber} strong />
      ) : null}
      {estimatedDelivery ? (
        <LedgerRow label={t.estimate} value={estimatedDelivery} />
      ) : null}
      <LedgerEnd />

      <ButtonRow>
        {hasTracking ? (
          <>
            <EmailButton href={trackingLink}>{t.track}</EmailButton>
            {orderUrl ? (
              <>
                <span style={{ display: "inline-block", width: "12px" }} />
                <EmailButton href={orderUrl} variant="ghost">
                  {t.viewOrder}
                </EmailButton>
              </>
            ) : null}
          </>
        ) : orderUrl ? (
          <EmailButton href={orderUrl}>{t.viewOrder}</EmailButton>
        ) : null}
      </ButtonRow>

      <Note tone="olive">{t.fragile}</Note>

      {/* Prosba, ne podmínka — škodu s dopravcem řeší prodávající (§ 2161 OZ). */}
      <Note tone="clay">{t.inspect}</Note>

      <P small>{t.carrierNotice}</P>

      {/* § 1830a OZ — tlačítko pro odstoupení i pro hosta bez účtu. */}
      {withdrawalUrl ? (
        <P small>
          {t.withdrawalBefore}{" "}
          <Link href={withdrawalUrl} style={{ color: brand.clay }}>
            {t.withdrawalLink}
          </Link>
          .
        </P>
      ) : null}
      <Signature />
    </EmailLayout>
  )
}

export const OrderShipmentEmail = (props: OrderShipmentEmailProps) => (
  <OrderShipmentEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderShipment: OrderShipmentEmailProps = {
  customerName: "Jan Novák",
  orderNumber: "#12345",
  trackingNumber: "CZ123456789",
  carrierName: "Česká pošta",
  estimatedDelivery: "2-3 pracovní dny",
  trackingLink: "https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers=CZ123456789",
  orderLink: "https://keramickazahrada.cz/orders/12345",
  withdrawalUrl: "https://keramickazahrada.cz/cz/order/order_12345/odstoupeni?token=abc",
}

export default () => <OrderShipmentEmailComponent {...mockOrderShipment} />
