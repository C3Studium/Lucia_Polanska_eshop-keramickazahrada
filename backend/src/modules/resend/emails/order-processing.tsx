import {
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

interface OrderProcessingEmailProps {
  customerName?: string;
  orderNumber?: string;
  estimatedProcessingTime?: string;
  orderLink?: string;
  /** Předpokládané dokončení („5. 11. 2026"), když ho ateliér zadal. */
  estimatedCompletion?: string | null;
}

/**
 * „Výroba začíná" — posílá se při „Začít výrobu" (`start_production`).
 *
 * Do 14. 10. 2026 odcházel už při potvrzení zadání, i když výroba ještě
 * neběžela, a při skutečném začátku výroby pak nepřišlo nic. Potvrzení zadání
 * má teď vlastní e-mail (`commission-confirmed`).
 */
function OrderProcessingEmailComponent({
  customerName,
  orderNumber = "",
  estimatedProcessingTime = "Jakmile bude hotovo, napíšu vám a domluvíme se na odeslání nebo předání.",
  orderLink = "",
  estimatedCompletion,
}: OrderProcessingEmailProps) {
  const orderUrl = orderLink || storeLink()
  return (
    <EmailLayout
      preview={`Zakázka ${orderNumber} je ve výrobě — právě jsem se pustila do práce.`}
    >
      <Eyebrow>Zakázka</Eyebrow>
      <EmailH1 accent="začíná.">Výroba</EmailH1>

      <Greeting name={customerName} />
      <P>
        právě se pouštím do výroby vaší zakázky {orderNumber}. Každý kousek
        u mě vzniká rukama — modelování, sušení, výpal i glazura si žádají svůj
        čas, tak prosím o trpělivost.
      </P>

      {orderNumber ? (
        <>
          <LedgerRow label="Objednávka" value={orderNumber} strong />
          {estimatedCompletion ? (
            <LedgerRow label="Předpokládané dokončení" value={estimatedCompletion} />
          ) : null}
          <LedgerEnd />
        </>
      ) : null}

      <Note tone="olive">
        Výroba právě začala — od této chvíle běží i lhůta dokončení.
      </Note>

      <P>
        Od odeslání tohoto e-mailu platí, že při zrušení zakázky se záloha
        nevrací; všechno, co jste zaplatili nad zálohu, vám vrátím do 14 dnů.
        Tak to stojí v obchodních podmínkách (článek Výroba na zakázku), se
        kterými jste při objednávce souhlasili: záloha kryje materiál, návrh a
        čas, který už jsem do vašeho kousku vložila.
      </P>

      <P>{estimatedProcessingTime}</P>

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}

      <Signature closing="Děkuji a těším se," />
    </EmailLayout>
  )
}

export const OrderProcessingEmail = (props: OrderProcessingEmailProps) => (
  <OrderProcessingEmailComponent {...props} />
);

// Mock data for preview/development
const mockOrderProcessing: OrderProcessingEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  estimatedProcessingTime: "Jakmile bude hotovo, dáme vám vědět a domluvíme se na odeslání.",
  orderLink: "https://keramickazahrada.cz/orders/12345",
};

export default () => <OrderProcessingEmailComponent {...mockOrderProcessing} />;
