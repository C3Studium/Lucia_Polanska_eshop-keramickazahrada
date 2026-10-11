import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  MultiLine,
  Note,
  P,
  Signature,
} from "../components/email-ui"
import { storeLink } from "../../../lib/storefront-url"

interface OrderEditedEmailProps {
  customerName?: string;
  orderNumber?: string;
  orderLink?: string;
  /** Nový obsah objednávky, řádek na položku („2× Hrnek · modrý"). */
  items?: string;
  totalBefore?: string;
  totalAfter?: string;
  /** Co se stane s penězi — stejná věta, jakou zákazník viděl v souhrnu. */
  moneySentence?: string;
}

/**
 * „Objednávka upravena" (docs/uprava-objednavky-plan.md §3d.11) — po každé
 * uložené zákaznické úpravě: hned, nebo po zaplacení rozdílu. Písemné
 * potvrzení, co si zákazník změnil a co to udělalo s cenou; zároveň pojistka,
 * kdyby úpravu neudělal on (odkaz z e-mailu může otevřít i někdo jiný).
 */
function OrderEditedEmailComponent({
  customerName,
  orderNumber = "",
  orderLink = "",
  items,
  totalBefore,
  totalAfter,
  moneySentence,
}: OrderEditedEmailProps) {
  const orderUrl = orderLink || storeLink()
  return (
    <EmailLayout preview={`Úpravu objednávky ${orderNumber} jsme uložili.`}>
      <Eyebrow>Úprava objednávky</Eyebrow>
      <EmailH1 accent="upravena.">Objednávka</EmailH1>

      <Greeting name={customerName} />
      <P>
        vaši úpravu objednávky {orderNumber} jsme uložili. Takhle teď
        objednávka vypadá.
      </P>

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {items ? <LedgerRow label="Obsah" value={<MultiLine value={items} />} /> : null}
      {totalBefore && totalBefore !== totalAfter ? (
        <LedgerRow label="Původně" value={totalBefore} />
      ) : null}
      {totalAfter ? <LedgerRow label="Celkem" value={totalAfter} strong /> : null}
      <LedgerEnd />

      {moneySentence ? <Note tone="olive">{moneySentence}</Note> : null}

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}

      <P>
        Pokud jste úpravu nedělali vy, odpovězte nám prosím na tento e-mail —
        dáme to do pořádku.
      </P>

      <Signature />
    </EmailLayout>
  )
}

export const OrderEditedEmail = (props: OrderEditedEmailProps) => (
  <OrderEditedEmailComponent {...props} />
)

// Mock data for preview/development
const mockOrderEdited: OrderEditedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  items: "3× Dekorativní tyčky a zápichy\n1× Keramické pítko pro ptáčky",
  totalBefore: "1 130 Kč",
  totalAfter: "1 160 Kč",
  moneySentence: "Rozdíl 30 Kč jste zaplatili kartou.",
}

export default () => <OrderEditedEmailComponent {...mockOrderEdited} />
