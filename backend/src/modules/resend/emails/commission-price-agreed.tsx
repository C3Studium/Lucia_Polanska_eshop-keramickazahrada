import {
  ButtonRow,
  CONTACT_EMAIL,
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

/**
 * „Domluvená cena" — zakázka s cenou po domluvě (lib/made-to-order/agreed-price.ts).
 *
 * Zákazník objednal výrobek za 0 Kč; Lucie mu teď posílá cenu, na které se
 * domluvili. Dvě tlačítka: zaplatit zálohu (povinná, bez ní výroba nezačne)
 * nebo rovnou celé. Obě vedou přes backend na ComGate a platba se zapíše
 * k objednávce. Věta o nevratnosti zálohy po zahájení výroby (Z5) je tu
 * schválně — zákazník se rozhoduje teď.
 */
export interface CommissionPriceAgreedEmailProps {
  customerName?: string
  orderNumber?: string
  orderLink?: string
  productTitle?: string
  agreedPrice?: string
  depositAmount?: string
  depositPercentage?: string
  /** Poštovné a balné — jen když si zákazník nechává kus poslat. */
  shippingAmount?: string | null
  packagingAmount?: string | null
  /** Cena + poštovné + balné. */
  totalAmount?: string
  /** Co zbude po zálohě; null = záloha pokrývá všechno. */
  balanceAmount?: string | null
  payDepositUrl?: string | null
  payFullUrl?: string | null
}

function CommissionPriceAgreedEmailComponent({
  customerName = "Marie Svobodová",
  orderNumber = "#1042",
  orderLink = "https://keramickazahrada.cz/cz/order/order_1/confirmed",
  productTitle = "Domovní znamení — liška s kopretinami",
  agreedPrice = "6 800 Kč",
  depositAmount = "1 700 Kč",
  depositPercentage = "25 %",
  shippingAmount = "150 Kč",
  packagingAmount = "100 Kč",
  totalAmount = "7 050 Kč",
  balanceAmount = "5 350 Kč",
  payDepositUrl = "https://dev.matejforejt.com/made-to-order/order_1/pay-balance?token=abc&castka=zaloha",
  payFullUrl = "https://dev.matejforejt.com/made-to-order/order_1/pay-balance?token=abc",
}: CommissionPriceAgreedEmailProps) {
  return (
    <EmailLayout preview={`Domluvená cena za ${productTitle ?? "vaši zakázku"}: ${agreedPrice}.`}>
      <Eyebrow>Zakázka {orderNumber}</Eyebrow>
      <EmailH1 accent="domluvená cena.">Tady je</EmailH1>

      <Greeting name={customerName} />
      <P>
        děkuji za domluvu. Posílám cenu, na které jsme se shodli
        {productTitle ? ` za ${productTitle}` : ""}. Abych se mohla pustit do
        práce, potřebuji od vás zálohu — můžete ale rovnou zaplatit i celou
        částku, ať už pak nic neřešíte.
      </P>

      {productTitle ? <LedgerRow label="Výrobek" value={productTitle} /> : null}
      <LedgerRow
        label={shippingAmount || packagingAmount ? "Cena výrobku" : "Domluvená cena"}
        value={agreedPrice}
        strong={!shippingAmount && !packagingAmount}
      />
      {/* Poštovné a balné jen u zásilky — u osobního odběru by řádky s nulou
          jen mátly a zákazník by hledal, co platí navíc. */}
      {shippingAmount ? <LedgerRow label="Poštovné" value={shippingAmount} /> : null}
      {packagingAmount ? <LedgerRow label="Balné" value={packagingAmount} /> : null}
      {shippingAmount || packagingAmount ? (
        <LedgerRow label="Celkem" value={totalAmount} strong />
      ) : null}
      <LedgerRow label="Záloha" value={depositAmount} tone="clay" />
      {balanceAmount ? (
        <LedgerRow label="Doplatek po dokončení" value={balanceAmount} />
      ) : null}
      <LedgerEnd />

      <ButtonRow>
        {payDepositUrl ? <EmailButton href={payDepositUrl}>Zaplatit zálohu {depositAmount}</EmailButton> : null}
        {payFullUrl ? (
          <>
            <span style={{ display: "inline-block", width: "12px" }} />
            <EmailButton href={payFullUrl} variant="ghost">
              Zaplatit celé {totalAmount}
            </EmailButton>
          </>
        ) : null}
      </ButtonRow>

      <Note>
        Záloha je povinná — výrobu začnu, až dorazí. Když zaplatíte jen zálohu,
        o doplatek vás požádám, až bude kousek hotový. Až výrobu začnu, napíšu
        vám; od té chvíle se záloha při zrušení zakázky nevrací (ostatní ano).
      </Note>

      <P small>
        Kdyby vám cena nebo cokoli jiného nesedělo, napište mi na {CONTACT_EMAIL}
        {orderLink ? " — objednávku najdete i ve svém účtu." : "."}
      </P>
      <Signature closing="Děkuji a těším se," />
    </EmailLayout>
  )
}

export const CommissionPriceAgreedEmail = (props: CommissionPriceAgreedEmailProps) => (
  <CommissionPriceAgreedEmailComponent {...props} />
)

export default () => <CommissionPriceAgreedEmailComponent />
