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

/**
 * Sent when the owner cancels ONE reservation (not the whole term — that is
 * course-term-cancelled). With automatic refunds in play the money may
 * already be on its way back, and a refund without a word of explanation is
 * exactly the e-mail gap this template closes. Three money stories:
 *
 * - `refunded` — the ComGate refund already ran; the amount is coming back.
 * - `manual_refund` — paid, but the automatic refund did not succeed; the
 *   owner returns it by hand and the customer is promised a follow-up.
 * - `unpaid` — nothing was paid; just the cancellation itself.
 *
 * `cancelledByCustomer` switches the voice: the customer's own cancel is
 * confirmed as *their* action („na vaši žádost jsme zrušili"), while the
 * owner's cancel keeps announcing ours — and only the latter apologises for
 * a possible misunderstanding.
 */

interface CourseReservationCancelledEmailProps {
  customerName?: string
  courseTitle?: string
  /** Already formatted in Europe/Prague. */
  courseDate?: string
  courseLocation?: string
  partySize?: number
  totalAmount?: string
  variant?: "refunded" | "manual_refund" | "unpaid"
  /** True when the customer cancelled the reservation themselves. */
  cancelledByCustomer?: boolean
}

function CourseReservationCancelledEmailComponent({
  customerName = "Vážený zákazníku",
  courseTitle = "Kurz točení pro dospělé",
  courseDate = "sobota 12. 9. 2026 10:00",
  courseLocation = "Ateliér u Písku",
  partySize = 1,
  totalAmount = "1 200 Kč",
  variant = "unpaid",
  cancelledByCustomer = false,
}: CourseReservationCancelledEmailProps) {
  const base = storefrontBase()
  const coursesUrl = base ? `${base}/kurzy` : ""
  const paid = variant === "refunded" || variant === "manual_refund"
  return (
    <EmailLayout preview={`Rezervace kurzu ${courseTitle} byla zrušena.`}>
      <Eyebrow>Kurzy</Eyebrow>
      <EmailH1 accent="byla zrušena.">Vaše rezervace</EmailH1>

      <Greeting name={customerName} />
      <P>
        {cancelledByCustomer
          ? "vaši rezervaci kurzu jsme na vaši žádost zrušili. Tady je pro pořádek, čeho se týkala:"
          : "vaši rezervaci kurzu jsme zrušili. Tady je pro pořádek, čeho se týkala:"}
      </P>

      <LedgerRow label="Kurz" value={courseTitle} />
      <LedgerRow label="Termín" value={courseDate} />
      <LedgerRow label="Kde" value={courseLocation} />
      <LedgerRow
        label="Počet osob"
        value={`${partySize} ${partySize === 1 ? "osoba" : partySize < 5 ? "osoby" : "osob"}`}
      />
      {paid ? (
        <LedgerRow label="Zaplaceno" value={totalAmount} strong tone="clay" />
      ) : null}
      <LedgerEnd />

      {variant === "refunded" ? (
        <Note tone="clay">
          Částku {totalAmount} vám vracíme zpět na účet, ze kterého jste
          platili — obvykle dorazí do několika dní. Nemusíte nic dělat.
        </Note>
      ) : variant === "manual_refund" ? (
        <Note tone="clay">
          Zaplacenou částku {totalAmount} vám vrátíme v plné výši. Ozveme se
          vám co nejdříve kvůli vrácení peněz — nemusíte nic dělat.
        </Note>
      ) : null}

      <P>
        {cancelledByCustomer
          ? "Kdybyste si to rozmysleli, budeme rádi, když si vyberete z dalších termínů — a s jakýmkoli dotazem stačí odpovědět na tento e-mail."
          : "Kdyby šlo o nedorozumění, nebo jste měli jakýkoli dotaz, stačí odpovědět na tento e-mail. A budeme rádi, když si vyberete z dalších termínů."}
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

export const CourseReservationCancelledEmail = (
  props: CourseReservationCancelledEmailProps
) => <CourseReservationCancelledEmailComponent {...props} />

// Mock data for preview/development
const mockCourseReservationCancelled: CourseReservationCancelledEmailProps = {
  customerName: "Jana Nováková",
  courseTitle: "Kurz točení pro dospělé",
  courseDate: "sobota 12. 9. 2026 10:00",
  courseLocation: "Ateliér u Písku",
  partySize: 2,
  totalAmount: "2 200 Kč",
  variant: "refunded",
}

export default () => (
  <CourseReservationCancelledEmailComponent
    {...mockCourseReservationCancelled}
  />
)
