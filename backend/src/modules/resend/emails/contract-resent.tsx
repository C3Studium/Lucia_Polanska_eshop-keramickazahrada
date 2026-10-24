import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  Note,
  P,
  Signature,
} from "../components/email-ui"

/**
 * Doposlání potvrzení smlouvy.
 *
 * ## Proč samostatný e-mail
 *
 * Potvrzení objednávky nikdy nečeká na PDF: když se dokument nepodaří
 * vyrobit nebo nahrát, e-mail odejde bez přílohy a chyba jde do logu —
 * zákazník nesmí zůstat bez potvrzení kvůli souboru. Tím ale vznikne dluh:
 * potvrzení smlouvy v textové podobě (§ 1827 odst. 2 OZ) poslané nebylo.
 *
 * Tenhle e-mail ho splácí. Posílá se z administrace tlačítkem, tedy vědomě,
 * a neopakuje celé potvrzení objednávky — jen doručí dokument a řekne, proč
 * chodí zvlášť. Zahlcovat zákazníka druhou kopií všeho by bylo horší než
 * ten původní výpadek.
 */
interface ContractResentEmailProps {
  customerName?: string
  orderNumber?: string
  /** „Potvrzení objednávky" nebo „Potvrzení zakázky". */
  documentTitle?: string
  /** Odkaz na PDF; prázdné, když šlo jen v příloze. */
  documentUrl?: string
  /** Stránka objednávky v obchodě. */
  orderLink?: string
}

function ContractResentEmailComponent({
  customerName,
  orderNumber = "",
  documentTitle = "Potvrzení objednávky",
  documentUrl = "",
  orderLink = "",
}: ContractResentEmailProps) {
  const cislo = orderNumber ? ` č. ${orderNumber}` : ""
  return (
    <EmailLayout preview={`${documentTitle}${cislo} — dokument k vaší objednávce.`}>
      <Eyebrow>Dokumenty</Eyebrow>
      <EmailH1 accent="posíláme dodatečně.">{documentTitle}</EmailH1>

      <Greeting name={customerName} />
      <P>
        posíláme vám {documentTitle.toLowerCase()}
        {cislo} — potvrzení kupní smlouvy, kterou jste s námi uzavřel(a).
        Při odesílání potvrzení objednávky se dokument nepodařilo přiložit,
        tak ho doručujeme teď. Omlouváme se za zdržení.
      </P>

      <P>
        Objednávka ani její podmínky se tím nijak nemění — je to tentýž
        dokument, který měl dorazit s potvrzením.
      </P>

      {documentUrl || orderLink ? (
        <ButtonRow>
          {documentUrl ? (
            <EmailButton href={documentUrl}>Otevřít dokument</EmailButton>
          ) : null}
          {orderLink ? (
            <EmailButton href={orderLink} variant="ghost">
              Moje objednávka
            </EmailButton>
          ) : null}
        </ButtonRow>
      ) : null}

      <Note>
        Dokument si prosím uschovejte — spolu s obchodními podmínkami tvoří
        vaši smlouvu.
      </Note>

      <Signature />
    </EmailLayout>
  )
}

export const ContractResentEmail = (props: ContractResentEmailProps) => (
  <ContractResentEmailComponent {...props} />
)

const mock: ContractResentEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "1240",
  documentTitle: "Potvrzení objednávky",
  documentUrl: "https://img.matejforejt.com/orders/order_1/potvrzeni-objednavky.pdf",
  orderLink: "https://keramickazahrada.cz/cz/order/order_1/confirmed",
}

export default () => <ContractResentEmailComponent {...mock} />
