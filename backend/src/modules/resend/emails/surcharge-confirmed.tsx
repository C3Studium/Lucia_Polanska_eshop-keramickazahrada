import {
  ButtonRow,
  CONTACT_EMAIL,
  CONTACT_PHONE,
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

interface SurchargeConfirmedEmailProps {
  customerName?: string;
  orderNumber?: string;
  /** Příplatek (naformátovaný) — částka navíc nad původní cenu. */
  surchargeAmount?: string;
  /** Kolik po připočtení příplatku zbývá doplatit (naformátované). */
  newBalance?: string;
  /** Poznámka majitelky — na čem jste se domluvili (volitelná). */
  reason?: string;
  orderLink?: string;
}

/**
 * „Potvrzení příplatku" — posílá se z ručního tlačítka, až když se majitelka se
 * zákazníkem na příplatku DOMLUVÍ jinou cestou (telefon, e-mail, zpráva). Není
 * to tedy oznámení ceny z čista jasna, ale písemné potvrzení dohody: ať má
 * zákazník černé na bílém, co a za kolik přibylo, a kam se obrátit, kdyby přece
 * jen nesouhlasil. Platí se pak běžnou výzvou k doplacení, ne odtud.
 */
function SurchargeConfirmedEmailComponent({
  customerName,
  orderNumber = "",
  surchargeAmount,
  newBalance,
  reason,
  orderLink = "",
}: SurchargeConfirmedEmailProps) {
  return (
    <EmailLayout preview={`Potvrzení příplatku k objednávce ${orderNumber}.`}>
      <Eyebrow>Zakázková výroba</Eyebrow>
      <EmailH1 accent="k vaší zakázce.">Potvrzení příplatku</EmailH1>

      <Greeting name={customerName} />
      <P>
        potvrzujeme, že k vaší zakázce
        {orderNumber ? ` ${orderNumber}` : ""} přibyl příplatek, na kterém jsme
        se společně domluvili — telefonicky, e-mailem nebo zprávou. Tímto e-mailem
        vám ho jen písemně potvrzujeme, ať to máte černé na bílém.
      </P>

      {reason ? <Note tone="olive">{reason}</Note> : null}

      {orderNumber ? <LedgerRow label="Objednávka" value={orderNumber} /> : null}
      {surchargeAmount ? (
        <LedgerRow label="Příplatek" value={surchargeAmount} />
      ) : null}
      {newBalance ? (
        <LedgerRow label="Zbývá doplatit" value={newBalance} strong tone="olive" />
      ) : null}
      <LedgerEnd />

      <P>
        Příplatek je součástí doplatku, který vám pošleme k zaplacení zvlášť — na
        faktuře ho uvidíte jako samostatnou položku.
      </P>

      <P>
        Kdybyste s příplatkem nesouhlasili nebo si nebyli čímkoli jistí, ozvěte
        se prosím paní Lucii Polanské na{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> nebo{" "}
        <a href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}>{CONTACT_PHONE}</a>.
        Ráda to s vámi probere.
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

export const SurchargeConfirmedEmail = (props: SurchargeConfirmedEmailProps) => (
  <SurchargeConfirmedEmailComponent {...props} />
)

// Mock data for preview/development
const mockSurchargeConfirmed: SurchargeConfirmedEmailProps = {
  customerName: "Jana Nováková",
  orderNumber: "#12345",
  surchargeAmount: "250 Kč",
  newBalance: "3 475 Kč",
  reason: "Domluveno telefonicky 5. 10. — ruční zdobení navíc podle vašeho přání.",
  orderLink: "https://keramickazahrada.cz/cz/order/order_12345/confirmed",
}

export default () => (
  <SurchargeConfirmedEmailComponent {...mockSurchargeConfirmed} />
)
