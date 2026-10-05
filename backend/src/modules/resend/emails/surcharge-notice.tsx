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

interface SurchargeNoticeEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** Příplatek (naformátovaný) — částka navíc nad původní cenu. */
  surchargeAmount?: string;
  /** Kolik po připočtení příplatku zbývá doplatit (naformátované). */
  newBalance?: string;
  /** Důvod příplatku, který majitelka napsala — volitelný. */
  reason?: string;
  orderLink?: string;
}

/**
 * „K zakázce přibyl příplatek" — posílá se jen z ručního tlačítka
 * („Informovat o příplatku"), nikdy samo. Příplatek je navýšení nad cenu, na
 * kterou zákazník kývnul u objednávky, takže se o něm dozví dřív, než mu přijde
 * výzva k doplacení. Platí se pak běžnou výzvou k doplacení, ne odtud.
 */
function SurchargeNoticeEmailComponent({
  customerName,
  orderNumber = "",
  surchargeAmount,
  newBalance,
  reason,
  orderLink = "",
}: SurchargeNoticeEmailProps) {
  return (
    <EmailLayout preview={`Úprava ceny k objednávce ${orderNumber}.`}>
      <Eyebrow>Úprava ceny</Eyebrow>
      <EmailH1 accent="k vaší zakázce.">Příplatek</EmailH1>

      <Greeting name={customerName} />
      <P>
        při výrobě vašeho kousku na míru vznikly práce navíc, a tak k ceně
        přibyl příplatek. Chceme, abyste o tom věděli dřív, než vám pošleme
        doplatek k zaplacení.
      </P>

      {reason ? <Note tone="clay">{reason}</Note> : null}

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {surchargeAmount ? (
        <LedgerRow label="Příplatek" value={surchargeAmount} />
      ) : null}
      {newBalance ? (
        <LedgerRow label="Zbývá doplatit" value={newBalance} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      <P>
        Doplatek vám pošleme k zaplacení zvlášť. Kdyby vám cokoli nehrálo,
        stačí odpovědět na tento e-mail.
      </P>

      {orderLink ? (
        <ButtonRow>
          <EmailButton href={orderLink}>Zobrazit objednávku</EmailButton>
        </ButtonRow>
      ) : null}
      <Signature />
    </EmailLayout>
  )
}

export const SurchargeNoticeEmail = (props: SurchargeNoticeEmailProps) => (
  <SurchargeNoticeEmailComponent {...props} />
)

// Mock data for preview/development
const mockSurchargeNotice: SurchargeNoticeEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  surchargeAmount: "250 Kč",
  newBalance: "3 475 Kč",
  reason: "Přidali jsme ruční zdobení navíc podle vašeho přání.",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
}

export default () => <SurchargeNoticeEmailComponent {...mockSurchargeNotice} />
