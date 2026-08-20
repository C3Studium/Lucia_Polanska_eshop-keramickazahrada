import {
  ButtonRow,
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

/**
 * The three-days-before reminder — one per reservation, ever. Everything the
 * participant needs at the door: kde, kdy, kolik jich přijde, co s sebou
 * (the term's note, when the owner filled one) and, for pay-on-site
 * bookings, how much to bring. The button is the signed reservation link.
 */

interface CourseReminderEmailProps {
  customerName?: string
  courseTitle?: string
  /** Already formatted in Europe/Prague — templates do no timezone math. */
  courseDate?: string
  courseLocation?: string
  /** "3 hodiny" or "" when the term has no duration. */
  courseDuration?: string
  partySize?: number
  /** The term's note — „co s sebou" and similar. Empty when not filled. */
  courseNote?: string
  /** Formatted amount to bring for pay-on-site bookings, "" when paid. */
  payOnSiteAmount?: string
  /** Signed link to the reservation page. */
  reservationLink?: string
}

function CourseReminderEmailComponent({
  customerName = "Vážený zákazníku",
  courseTitle = "Kurz točení pro dospělé",
  courseDate = "sobota 12. 9. 2026 10:00",
  courseLocation = "Ateliér u Písku",
  courseDuration = "",
  partySize = 1,
  courseNote = "",
  payOnSiteAmount = "",
  reservationLink = "",
}: CourseReminderEmailProps) {
  return (
    <EmailLayout preview={`Už za pár dní: ${courseTitle} — ${courseDate}.`}>
      <Eyebrow>Kurzy</Eyebrow>
      <EmailH1 accent="těšíme se na vás.">Kurz už se blíží,</EmailH1>

      <Greeting name={customerName} />
      <P>
        jen připomínáme, že už za pár dní se potkáme u hlíny. Tady je vše
        důležité na jednom místě:
      </P>

      <LedgerRow label="Kurz" value={courseTitle} />
      <LedgerRow label="Kdy" value={courseDate} />
      <LedgerRow label="Kde" value={courseLocation} />
      {courseDuration ? (
        <LedgerRow label="Délka" value={courseDuration} />
      ) : null}
      <LedgerRow
        label="Počet osob"
        value={`${partySize} ${partySize === 1 ? "osoba" : partySize < 5 ? "osoby" : "osob"}`}
      />
      {payOnSiteAmount ? (
        <LedgerRow
          label="Na místě zaplatíte"
          value={payOnSiteAmount}
          strong
          tone="olive"
        />
      ) : null}
      <LedgerEnd />

      {courseNote ? <Note>{courseNote}</Note> : null}

      <P>
        Vezměte si pohodlné oblečení, kterému nevadí hlína — všechno ostatní
        bude v ateliéru připravené.
        {payOnSiteAmount
          ? " Platit můžete na místě hotově nebo kartou."
          : ""}
      </P>

      <P>
        Kdyby vám do termínu cokoliv vstoupilo, dejte nám prosím vědět co
        nejdříve — stačí odpovědět na tento e-mail nebo zavolat na{" "}
        {CONTACT_PHONE}.
      </P>

      {reservationLink ? (
        <ButtonRow>
          <EmailButton href={reservationLink}>Detail rezervace</EmailButton>
        </ButtonRow>
      ) : null}

      <Signature />
    </EmailLayout>
  )
}

export const CourseReminderEmail = (props: CourseReminderEmailProps) => (
  <CourseReminderEmailComponent {...props} />
)

// Mock data for preview/development
const mockCourseReminder: CourseReminderEmailProps = {
  customerName: "Jana Nováková",
  courseTitle: "Kurz točení pro dospělé",
  courseDate: "sobota 12. 9. 2026 10:00",
  courseLocation: "Ateliér u Písku",
  courseDuration: "3 hodiny",
  partySize: 2,
  courseNote:
    "Vezměte si prosím ručník a přezůvky — zástěry a všechno ostatní máme v ateliéru.",
  payOnSiteAmount: "2 600 Kč",
  reservationLink:
    "https://keramickazahrada.cz/cz/kurzy/rezervace/res_123?token=abc",
}

export default () => <CourseReminderEmailComponent {...mockCourseReminder} />
