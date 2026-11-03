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
  P,
  Signature,
} from "../components/email-ui"

/**
 * Zpráva majitelky všem účastníkům termínu („zpozdím se o 30 minut",
 * „přineste si zástěru"). Rozesílá `api/admin/courses/terms/[id]/message`.
 *
 * Text píše majitelka vlastními slovy — šablona ho jen obalí oslovením,
 * shrnutím termínu (ať je jasné, kterého kurzu se zpráva týká) a podpisem.
 * Jen česky, jako všechny kurzové e-maily (kurzy se prodávají jen na /cz).
 */

interface CourseMessageEmailProps {
  customerName?: string
  courseTitle?: string
  /** Už naformátované (Europe/Prague). */
  courseDate?: string
  courseLocation?: string
  /** Text majitelky; konce řádků se zachovají. */
  message?: string
  /** Podepsaný odkaz na rezervaci. */
  reservationLink?: string
  /** E-mail má Reply-To na dílnu — „stačí odpovědět" je pravda. */
  canReply?: boolean
}

function CourseMessageEmailComponent({
  customerName = "Vážený zákazníku",
  courseTitle = "Kurz točení pro dospělé",
  courseDate = "sobota 12. 9. 2026 10:00",
  courseLocation = "Ateliér u Písku",
  message = "",
  reservationLink = "",
  canReply = false,
}: CourseMessageEmailProps) {
  return (
    <EmailLayout preview={`Zpráva ke kurzu ${courseTitle} — ${courseDate}.`}>
      <Eyebrow>Kurz · zpráva z dílny</Eyebrow>
      <EmailH1 accent={courseDate}>{courseTitle}</EmailH1>

      <Greeting name={customerName} />
      <P style={{ whiteSpace: "pre-line" }}>{message}</P>

      <LedgerRow label="Kurz" value={courseTitle} />
      <LedgerRow label="Kdy" value={courseDate} />
      <LedgerRow label="Kde" value={courseLocation} />
      <LedgerEnd />

      <P small>
        Píšu vám, protože máte rezervaci na tenhle termín.
        {canReply
          ? " Kdybyste se potřebovali ozvat, stačí na tento e-mail odpovědět."
          : ` Kdybyste se potřebovali ozvat, napište mi na ${CONTACT_EMAIL} nebo zavolejte na ${CONTACT_PHONE}.`}
      </P>

      {reservationLink ? (
        <ButtonRow>
          <EmailButton href={reservationLink}>Zobrazit rezervaci</EmailButton>
        </ButtonRow>
      ) : null}

      <Signature closing="Těším se na vás," />
    </EmailLayout>
  )
}

export const CourseMessageEmail = (props: CourseMessageEmailProps) => (
  <CourseMessageEmailComponent {...props} />
)

// Mock data for preview/development
const mockCourseMessage: CourseMessageEmailProps = {
  customerName: "Jana Nováková",
  courseTitle: "Kurz točení pro dospělé",
  courseDate: "sobota 12. 9. 2026 10:00",
  courseLocation: "Ateliér u Písku",
  message:
    "Omlouvám se — zdržím se asi o 30 minut. Začneme tedy v 10:30.\nPokud můžete, přineste si prosím vlastní zástěru.",
  reservationLink:
    "https://keramickazahrada.cz/cz/kurzy/rezervace/res_123?token=abc",
  canReply: true,
}

export default () => <CourseMessageEmailComponent {...mockCourseMessage} />
