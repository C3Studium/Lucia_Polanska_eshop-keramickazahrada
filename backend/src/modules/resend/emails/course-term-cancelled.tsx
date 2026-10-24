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
import { storefrontBase } from "../../../lib/storefront-url"

interface CourseTermCancelledEmailProps {
  customerName?: string
  courseTitle?: string
  /** Already formatted in Europe/Prague. */
  courseDate?: string
  courseLocation?: string
  partySize?: number
  totalAmount?: string
  /** True when this booking was paid by card. */
  paidOnline?: boolean
  /**
   * True when the booking was paid in cash at the studio. Nothing to refund
   * automatically — but the money is just as real, and until this existed the
   * e-mail said nothing about it at all.
   */
  paidOnSite?: boolean
  /**
   * True when the ComGate refund already went through — the money is on its
   * way back on its own. False (with `paidOnline`) means the automatic
   * refund did not succeed and the owner returns it by hand.
   */
  refundedAutomatically?: boolean
}

function CourseTermCancelledEmailComponent({
  customerName = "Vážený zákazníku",
  courseTitle = "Kurz točení pro dospělé",
  courseDate = "sobota 12. 9. 2026 10:00",
  courseLocation = "Ateliér u Písku",
  partySize = 1,
  totalAmount = "1 200 Kč",
  paidOnline = false,
  paidOnSite = false,
  refundedAutomatically = false,
}: CourseTermCancelledEmailProps) {
  const base = storefrontBase()
  const coursesUrl = base ? `${base}/kurzy` : ""
  return (
    <EmailLayout preview={`Termín kurzu ${courseTitle} musím zrušit — omlouvám se.`}>
      <Eyebrow>Kurz</Eyebrow>
      <EmailH1 accent="omlouvám se.">Termín se ruší,</EmailH1>

      <Greeting name={customerName} />
      <P>
        moc se omlouvám — termín kurzu, na který jste měli rezervaci, musím
        zrušit. Mrzí mě to, a tady je, co to pro vás znamená.
      </P>

      <LedgerRow label="Kurz" value={courseTitle} />
      <LedgerRow label="Původní termín" value={courseDate} />
      <LedgerRow label="Kde" value={courseLocation} />
      <LedgerRow
        label="Počet osob"
        value={`${partySize} ${partySize === 1 ? "osoba" : partySize < 5 ? "osoby" : "osob"}`}
      />
      {paidOnline || paidOnSite ? (
        <LedgerRow label="Zaplaceno" value={totalAmount} strong tone="clay" />
      ) : null}
      <LedgerEnd />

      {/*
        Peníze musí být zmíněné u KAŽDÉHO, kdo zaplatil — nejen u karty.
        Kdo platil hotově na místě, nemá kam vracet automaticky, ale jeho
        peníze u nás leží úplně stejně; dřív o nich tenhle e-mail mlčel.
      */}
      {paidOnline ? (
        refundedAutomatically ? (
          <Note tone="clay">
            Částku {totalAmount} vám vracím zpět na účet, ze kterého jste
            platili — obvykle dorazí do několika dní. Nemusíte nic dělat.
          </Note>
        ) : (
          <Note tone="clay">
            Zaplacenou částku vám vrátím v plné výši. Ozvu se vám co nejdřív
            kvůli vrácení peněz — nemusíte nic dělat.
          </Note>
        )
      ) : paidOnSite ? (
        <Note tone="clay">
          Částku {totalAmount} jste platili u mě na místě, takže vám ji vrátím
          stejnou cestou — ozvu se vám co nejdřív a domluvíme se, jak vám ji
          předat. Nemusíte nic dělat.
        </Note>
      ) : null}

      <P>
        Jakmile vypíšu nové termíny, najdete je na webu v sekci Kurzy — budu
        ráda, když si některý vyberete. A s čímkoli mi napište na info@keramickazahrada.cz, odpovídám sama.
      </P>

      {coursesUrl ? (
        <ButtonRow>
          <EmailButton href={coursesUrl} variant="ghost">
            Vybrat nový termín
          </EmailButton>
        </ButtonRow>
      ) : null}

      <Signature closing="Omlouvám se a děkuji za pochopení," />
    </EmailLayout>
  )
}

export const CourseTermCancelledEmail = (
  props: CourseTermCancelledEmailProps
) => <CourseTermCancelledEmailComponent {...props} />

// Mock data for preview/development
const mockCourseTermCancelled: CourseTermCancelledEmailProps = {
  customerName: "Jana Nováková",
  courseTitle: "Kurz točení pro dospělé",
  courseDate: "sobota 12. 9. 2026 10:00",
  courseLocation: "Ateliér u Písku",
  partySize: 2,
  totalAmount: "2 200 Kč",
  paidOnline: true,
  refundedAutomatically: true,
}

export default () => (
  <CourseTermCancelledEmailComponent {...mockCourseTermCancelled} />
)
