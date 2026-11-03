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
import { useCopy } from "../components/email-i18n"
import type { Localized } from "../../../lib/email-locale"

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
  /** Potvrzení zakázky s domluvenou cenou jde s e-mailem jako příloha. */
  contractAttached?: boolean
  /** Resend přílohu odmítl a e-mail odešel bez ní (doplní provider). */
  attachments_failed?: boolean
}

/**
 * Texty po jazycích (lib/email-locale) — čeština je původní znění. Věta
 * o záloze (povinná, po zahájení výroby nevratná, zbytek vratný) se
 * překládá přesně.
 */
const COPY: Localized<{
  preview: (productTitle: string | undefined, price: string) => string
  eyebrow: (orderNumber: string) => string
  title: string
  accent: string
  intro: (productTitle: string | undefined) => string
  product: string
  productPrice: string
  agreedPrice: string
  shipping: string
  packaging: string
  total: string
  deposit: string
  balance: string
  payDeposit: (amount: string) => string
  payFull: (amount: string) => string
  note: string
  contract: string
  questions: (email: string, hasOrderLink: boolean) => string
  closing: string
}> = {
  cs: {
    preview: (title, price) => `Domluvená cena za ${title ?? "vaši zakázku"}: ${price}.`,
    eyebrow: (n) => `Zakázka ${n}`,
    title: "Tady je",
    accent: "domluvená cena.",
    intro: (title) =>
      `děkuji za domluvu. Posílám cenu, na které jsme se shodli${title ? ` za ${title}` : ""}. Abych se mohla pustit do práce, potřebuji od vás zálohu — můžete ale rovnou zaplatit i celou částku, ať už pak nic neřešíte.`,
    product: "Výrobek",
    productPrice: "Cena výrobku",
    agreedPrice: "Domluvená cena",
    shipping: "Poštovné",
    packaging: "Balné",
    total: "Celkem",
    deposit: "Záloha",
    balance: "Doplatek po dokončení",
    payDeposit: (amount) => `Zaplatit zálohu ${amount}`,
    payFull: (amount) => `Zaplatit celé ${amount}`,
    note:
      "Záloha je povinná — výrobu začnu, až dorazí. Když zaplatíte jen zálohu, o doplatek vás požádám, až bude kousek hotový. Až výrobu začnu, napíšu vám; od té chvíle se záloha při zrušení zakázky nevrací (ostatní ano).",
    contract:
      "V příloze posílám potvrzení zakázky s domluvenou cenou (PDF) — uschovejte si ho, prosím.",
    questions: (email, link) =>
      `Kdyby vám cena nebo cokoli jiného nesedělo, napište mi na ${email}${link ? " — objednávku najdete i ve svém účtu." : "."}`,
    closing: "Děkuji a těším se,",
  },
  sk: {
    preview: (title, price) => `Dohodnutá cena za ${title ?? "vašu zákazku"}: ${price}.`,
    eyebrow: (n) => `Zákazka ${n}`,
    title: "Tu je",
    accent: "dohodnutá cena.",
    intro: (title) =>
      `ďakujem za dohodu. Posielam cenu, na ktorej sme sa zhodli${title ? ` za ${title}` : ""}. Aby som sa mohla pustiť do práce, potrebujem od vás zálohu — môžete však rovno zaplatiť aj celú sumu, aby ste už potom nič neriešili.`,
    product: "Výrobok",
    productPrice: "Cena výrobku",
    agreedPrice: "Dohodnutá cena",
    shipping: "Poštovné",
    packaging: "Balné",
    total: "Spolu",
    deposit: "Záloha",
    balance: "Doplatok po dokončení",
    payDeposit: (amount) => `Zaplatiť zálohu ${amount}`,
    payFull: (amount) => `Zaplatiť celé ${amount}`,
    note:
      "Záloha je povinná — výrobu začnem, keď dorazí. Ak zaplatíte len zálohu, o doplatok vás požiadam, keď bude kúsok hotový. Keď začnem s výrobou, napíšem vám; od tej chvíle sa záloha pri zrušení zákazky nevracia (ostatné áno).",
    contract:
      "V prílohe posielam potvrdenie zákazky s dohodnutou cenou (PDF) — uschovajte si ho, prosím.",
    questions: (email, link) =>
      `Keby vám cena alebo čokoľvek iné nesedelo, napíšte mi na ${email}${link ? " — objednávku nájdete aj vo svojom účte." : "."}`,
    closing: "Ďakujem a teším sa,",
  },
  pl: {
    preview: (title, price) =>
      `Uzgodniona cena${title ? ` za ${title}` : " zamówienia indywidualnego"}: ${price}.`,
    eyebrow: (n) => `Zamówienie indywidualne ${n}`,
    title: "Oto",
    accent: "uzgodniona cena.",
    intro: (title) =>
      `Dziękuję za ustalenia. Przesyłam cenę, na którą się umówiliśmy${title ? ` za ${title}` : ""}. Żebym mogła zacząć pracę, potrzebuję od Państwa zaliczki — można jednak od razu zapłacić całą kwotę i mieć sprawę z głowy.`,
    product: "Wyrób",
    productPrice: "Cena wyrobu",
    agreedPrice: "Uzgodniona cena",
    shipping: "Wysyłka",
    packaging: "Opakowanie",
    total: "Razem",
    deposit: "Zaliczka",
    balance: "Dopłata po wykonaniu",
    payDeposit: (amount) => `Zapłać zaliczkę ${amount}`,
    payFull: (amount) => `Zapłać całość ${amount}`,
    note:
      "Zaliczka jest obowiązkowa — zacznę pracę, gdy tylko dotrze. Jeśli zapłacą Państwo tylko zaliczkę, o pozostałą kwotę poproszę, gdy wyrób będzie gotowy. Gdy rozpocznę produkcję, napiszę do Państwa; od tej chwili w razie anulowania zamówienia zaliczka nie podlega zwrotowi (pozostałe kwoty tak).",
    contract:
      "W załączniku przesyłam potwierdzenie zamówienia indywidualnego z uzgodnioną ceną (PDF) — proszę je zachować.",
    questions: (email, link) =>
      `Gdyby cena lub cokolwiek innego Państwu nie odpowiadało, proszę napisać na ${email}${link ? " — zamówienie znajdą Państwo także na swoim koncie." : "."}`,
    closing: "Dziękuję i serdecznie pozdrawiam",
  },
  de: {
    preview: (title, price) =>
      `Der vereinbarte Preis für ${title ?? "Ihre Auftragsarbeit"}: ${price}.`,
    eyebrow: (n) => `Auftragsarbeit ${n}`,
    title: "Hier ist",
    accent: "der vereinbarte Preis.",
    intro: (title) =>
      `vielen Dank für die Absprache. Hier ist der Preis, auf den wir uns geeinigt haben${title ? ` – für ${title}` : ""}. Damit ich mit der Arbeit beginnen kann, brauche ich von Ihnen eine Anzahlung – Sie können aber auch gleich den ganzen Betrag bezahlen, dann ist alles erledigt.`,
    product: "Produkt",
    productPrice: "Preis des Produkts",
    agreedPrice: "Vereinbarter Preis",
    shipping: "Versand",
    packaging: "Verpackung",
    total: "Gesamt",
    deposit: "Anzahlung",
    balance: "Restzahlung nach Fertigstellung",
    payDeposit: (amount) => `Anzahlung ${amount} bezahlen`,
    payFull: (amount) => `Alles bezahlen (${amount})`,
    note:
      "Die Anzahlung ist verpflichtend – ich beginne mit der Herstellung, sobald sie eingegangen ist. Wenn Sie nur die Anzahlung bezahlen, bitte ich Sie um die Restzahlung, sobald das Stück fertig ist. Wenn ich mit der Herstellung beginne, schreibe ich Ihnen; ab diesem Moment wird die Anzahlung bei einer Stornierung der Auftragsarbeit nicht erstattet (alles Übrige schon).",
    contract:
      "Im Anhang sende ich Ihnen die Auftragsbestätigung mit dem vereinbarten Preis (PDF) – bitte bewahren Sie sie auf.",
    questions: (email, link) =>
      `Wenn Ihnen der Preis oder sonst etwas nicht passt, schreiben Sie mir an ${email}${link ? " – Ihre Bestellung finden Sie auch in Ihrem Kundenkonto." : "."}`,
    closing: "Vielen Dank und herzliche Grüße",
  },
  en: {
    preview: (title, price) => `The agreed price for ${title ?? "your commission"}: ${price}.`,
    eyebrow: (n) => `Commission ${n}`,
    title: "Here is",
    accent: "the agreed price.",
    intro: (title) =>
      `Thank you for talking it through with me. Here is the price we agreed on${title ? ` for ${title}` : ""}. Before I can start work, I need a deposit from you — but you're welcome to pay the full amount straight away, so there's nothing left to sort out later.`,
    product: "Piece",
    productPrice: "Price of the piece",
    agreedPrice: "Agreed price",
    shipping: "Postage",
    packaging: "Packaging fee",
    total: "Total",
    deposit: "Deposit",
    balance: "Balance due on completion",
    payDeposit: (amount) => `Pay the deposit of ${amount}`,
    payFull: (amount) => `Pay in full (${amount})`,
    note:
      "The deposit is required — I'll start making your piece once it arrives. If you pay only the deposit, I'll ask you for the remaining balance when the piece is finished. I'll write to you when I start production; from that moment on, the deposit is non-refundable if the commission is cancelled (everything else is refundable).",
    contract:
      "Attached you'll find the commission confirmation with the agreed price (PDF) — please keep it for your records.",
    questions: (email, link) =>
      `If the price or anything else doesn't suit you, just write to me at ${email}${link ? " — you'll also find the order in your account." : "."}`,
    closing: "Thank you — I'm looking forward to it,",
  },
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
  contractAttached = true,
  attachments_failed = false,
}: CommissionPriceAgreedEmailProps) {
  const t = useCopy(COPY)
  return (
    <EmailLayout preview={t.preview(productTitle, agreedPrice)}>
      <Eyebrow>{t.eyebrow(orderNumber)}</Eyebrow>
      <EmailH1 accent={t.accent}>{t.title}</EmailH1>

      <Greeting name={customerName} />
      <P>{t.intro(productTitle)}</P>

      {productTitle ? <LedgerRow label={t.product} value={productTitle} /> : null}
      <LedgerRow
        label={shippingAmount || packagingAmount ? t.productPrice : t.agreedPrice}
        value={agreedPrice}
        strong={!shippingAmount && !packagingAmount}
      />
      {/* Poštovné a balné jen u zásilky — u osobního odběru by řádky s nulou
          jen mátly a zákazník by hledal, co platí navíc. */}
      {shippingAmount ? <LedgerRow label={t.shipping} value={shippingAmount} /> : null}
      {packagingAmount ? <LedgerRow label={t.packaging} value={packagingAmount} /> : null}
      {shippingAmount || packagingAmount ? (
        <LedgerRow label={t.total} value={totalAmount} strong />
      ) : null}
      <LedgerRow label={t.deposit} value={depositAmount} tone="clay" />
      {balanceAmount ? (
        <LedgerRow label={t.balance} value={balanceAmount} />
      ) : null}
      <LedgerEnd />

      <ButtonRow>
        {payDepositUrl ? <EmailButton href={payDepositUrl}>{t.payDeposit(depositAmount)}</EmailButton> : null}
        {payFullUrl ? (
          <>
            <span style={{ display: "inline-block", width: "12px" }} />
            <EmailButton href={payFullUrl} variant="ghost">
              {t.payFull(totalAmount)}
            </EmailButton>
          </>
        ) : null}
      </ButtonRow>

      <Note>{t.note}</Note>

      {/* O příloze mluvit jen tehdy, když opravdu odešla (service.ts posílá
          `attachments_failed`, když ji Resend odmítl a e-mail šel bez ní). */}
      {contractAttached && !attachments_failed ? <P small>{t.contract}</P> : null}

      <P small>{t.questions(CONTACT_EMAIL, Boolean(orderLink))}</P>
      <Signature closing={t.closing} />
    </EmailLayout>
  )
}

export const CommissionPriceAgreedEmail = (props: CommissionPriceAgreedEmailProps) => (
  <CommissionPriceAgreedEmailComponent {...props} />
)

export default () => <CommissionPriceAgreedEmailComponent />
