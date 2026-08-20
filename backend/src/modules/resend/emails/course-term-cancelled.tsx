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
  refundedAutomatically = false,
}: CourseTermCancelledEmailProps) {
  const base = storefrontBase()
  const coursesUrl = base ? `${base}/kurzy` : ""
  return (
    <EmailLayout preview={`Termín kurzu ${courseTitle} se ruší.`}>
      <Eyebrow>Kurzy</Eyebrow>
      <EmailH1 accent="omlouváme se.">Termín se ruší,</EmailH1>

      <Greeting name={customerName} />
      <P>
        musíme bohužel zrušit termín kurzu, na který jste měli rezervaci.
        Moc nás to mrzí.
      </P>

      <LedgerRow label="Kurz" value={courseTitle} />
      <LedgerRow label="Původní termín" value={courseDate} />
      <LedgerRow label="Kde" value={courseLocation} />
      <LedgerRow
        label="Počet osob"
        value={`${partySize} ${partySize === 1 ? "osoba" : partySize < 5 ? "osoby" : "osob"}`}
      />
      {paidOnline ? (
        <LedgerRow label="Zaplaceno" value={totalAmount} strong tone="clay" />
      ) : null}
      <LedgerEnd />

      {paidOnline ? (
        refundedAutomatically ? (
          <Note tone="clay">
            Částku {totalAmount} vám vracíme zpět na účet, ze kterého jste
            platili — obvykle dorazí do několika dní. Nemusíte nic dělat.
          </Note>
        ) : (
          <Note tone="clay">
            Zaplacenou částku vám vrátíme v plné výši. Ozveme se vám co
            nejdříve kvůli vrácení peněz — nemusíte nic dělat.
          </Note>
        )
      ) : null}

      <P>
        Jakmile vypíšeme nové termíny, najdete je na našem webu v sekci
        Kurzy. A pokud byste měli jakýkoli dotaz, stačí odpovědět na tento
        e-mail.
      </P>

      {coursesUrl ? (
        <ButtonRow>
          <EmailButton href={coursesUrl} variant="ghost">
            Podívat se na termíny kurzů
          </EmailButton>
        </ButtonRow>
      ) : null}

      <Signature />
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
