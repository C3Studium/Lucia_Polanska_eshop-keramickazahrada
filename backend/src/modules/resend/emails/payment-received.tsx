import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  LedgerEnd,
  LedgerRow,
  P,
  PaidFor,
  Signature,
  type EmailLineItem,
} from "../components/email-ui"
import { storeLink } from "../../../lib/storefront-url"
import type { CommissionPaymentsText } from "../../../lib/commission-breakdown"

interface PaymentReceivedEmailProps {
  customerName?: string;
  orderNumber?: string;
  paymentAmount?: string;
  paymentMethod?: string;
  orderLink?: string;
  /**
   * Za co platba byla — položky objednávky s fotkou (`lib/email-items`).
   * Bez nich e-mail ukáže jen čísla, jako dřív.
   */
  paidFor?: EmailLineItem[] | null;
  /**
   * Doplatek zakázky: rozpis záloha · doplatek · příplatek · celkem zaplaceno
   * (lib/commission-breakdown). Bez něj e-mail ukáže jen částku platby.
   */
  commissionPayments?: CommissionPaymentsText | null;
}

/**
 * Řádky se vykreslí jen s reálnými daty — vymyšlená výchozí částka by
 * v ostrém e-mailu potvrzovala jiné peníze, než dorazily.
 */
function PaymentReceivedEmailComponent({
  customerName,
  orderNumber = "",
  paymentAmount,
  paymentMethod,
  orderLink = "",
  paidFor,
  commissionPayments,
}: PaymentReceivedEmailProps) {
  const orderUrl = orderLink || storeLink()

  return (
    <EmailLayout preview={`Platba za objednávku ${orderNumber} dorazila, děkuji.`}>
      <Eyebrow>Platba</Eyebrow>
      <EmailH1 accent="dorazila.">Platba</EmailH1>

      <Greeting name={customerName} />
      {commissionPayments ? (
        <P>
          doplatek za vaši zakázku dorazil, děkuji — zakázka je teď zaplacená
          celá. Kousek pečlivě zabalím a jakmile zásilku předám dopravci,
          pošlu vám další zprávu.
        </P>
      ) : (
        <P>
          platba za vaši objednávku dorazila, děkuji. Teď je to na mně —
          kousky zabalím a jakmile zásilku předám dopravci, pošlu vám další
          zprávu.
        </P>
      )}

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {paymentMethod ? (
        <LedgerRow label="Způsob platby" value={paymentMethod} />
      ) : null}
      {commissionPayments ? (
        <>
          {commissionPayments.deposit ? (
            <LedgerRow
              label={
                commissionPayments.depositInvoiceNumber
                  ? `Záloha (faktura ${commissionPayments.depositInvoiceNumber})`
                  : "Záloha"
              }
              value={commissionPayments.deposit}
            />
          ) : null}
          {commissionPayments.balance ? (
            <LedgerRow label="Doplatek" value={commissionPayments.balance} />
          ) : null}
          {commissionPayments.surcharge ? (
            <LedgerRow label="Příplatek" value={commissionPayments.surcharge} />
          ) : null}
          <LedgerRow
            label="Celkem zaplaceno"
            value={commissionPayments.totalPaid}
            strong
            tone="olive"
          />
        </>
      ) : paymentAmount ? (
        <LedgerRow label="Částka" value={paymentAmount} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      {/* Za co ty peníze byly. Samotné „Částka 2 450 Kč" neřeklo, čeho se
          platba týká — kdo u nás koupil dvakrát za týden, nepoznal které
          objednávky. Faktura to říká, ale je to příloha, kterou si kvůli
          tomu nikdo neotvírá. */}
      <PaidFor
        items={paidFor}
        heading={commissionPayments ? "Za co je doplatek" : "Za co jste zaplatili"}
      />

      {orderUrl ? (
        <ButtonRow>
          <EmailButton href={orderUrl}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        Stav objednávky vidíte kdykoli ve svém účtu na webu. Kdyby cokoli,
        napište mi na info@keramickazahrada.cz — odpovídám sama.
      </P>
      <Signature closing="Děkuji a těším se," />
    </EmailLayout>
  )
}

export const PaymentReceivedEmail = (props: PaymentReceivedEmailProps) => (
  <PaymentReceivedEmailComponent {...props} />
)

// Mock data for preview/development
const mockPaymentReceived: PaymentReceivedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  paymentAmount: "2 450 Kč",
  paymentMethod: "Kreditní karta",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
  paidFor: [
    {
      title: "Keramické pítko pro ptáky",
      subtitle: "Modrá glazura",
      quantity: 1,
      amount: "1 950 Kč",
      thumbnail:
        "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
    },
    { title: "Balné — Keramické pítko pro ptáky", amount: "30 Kč", service: true },
    { title: "Miska na mýdlo", quantity: 2, amount: "470 Kč", thumbnail: null },
  ],
}

export default () => <PaymentReceivedEmailComponent {...mockPaymentReceived} />
