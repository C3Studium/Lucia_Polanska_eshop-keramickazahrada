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
 * Sent to a waitlist entry the moment enough seats free up for their whole
 * party. Honest about the one thing that matters: seats are free NOW but not
 * held — the reservation form is first come, first served. One send per
 * entry, ever (`notified_at` + the notification dedupe key).
 */

interface CourseWaitlistSpotEmailProps {
  customerName?: string
  courseTitle?: string
  /** Already formatted in Europe/Prague. */
  courseDate?: string
  courseLocation?: string
  partySize?: number
}

function CourseWaitlistSpotEmailComponent({
  customerName = "Vážený zákazníku",
  courseTitle = "Kurz točení pro dospělé",
  courseDate = "sobota 12. 9. 2026 10:00",
  courseLocation = "Ateliér u Písku",
  partySize = 1,
}: CourseWaitlistSpotEmailProps) {
  const base = storefrontBase()
  const coursesUrl = base ? `${base}/kurzy#rezervace` : ""
  return (
    <EmailLayout
      preview={`Na kurzu ${courseTitle} se uvolnilo místo — můžete si ho rezervovat.`}
    >
      <Eyebrow>Kurz</Eyebrow>
      <EmailH1 accent="můžete si ho rezervovat.">Uvolnilo se místo,</EmailH1>

      <Greeting name={customerName} />
      <P>
        napsali jste si o zprávu, až se na obsazeném termínu uvolní místo — a
        právě se to stalo.
        {partySize > 1
          ? ` Volných míst je teď dost pro ${partySize === 2 ? "oba" : `všech ${partySize}`}.`
          : ""}
      </P>

      <LedgerRow label="Kurz" value={courseTitle} />
      <LedgerRow label="Kdy" value={courseDate} />
      <LedgerRow label="Kde" value={courseLocation} />
      <LedgerEnd />

      <Note tone="clay">
        Místo držím tomu, kdo dřív dokončí rezervaci — tak prosím neotálejte.
      </Note>

      {coursesUrl ? (
        <ButtonRow>
          <EmailButton href={coursesUrl}>Rezervovat místo</EmailButton>
        </ButtonRow>
      ) : null}

      <P>
        Kdyby vás termín mezitím přestal lákat, nemusíte dělat vůbec nic —
        tohle je jediná zpráva, kterou vám k němu pošlu.
      </P>

      <Signature />
    </EmailLayout>
  )
}

export const CourseWaitlistSpotEmail = (
  props: CourseWaitlistSpotEmailProps
) => <CourseWaitlistSpotEmailComponent {...props} />

// Mock data for preview/development
const mockCourseWaitlistSpot: CourseWaitlistSpotEmailProps = {
  customerName: "Jana Nováková",
  courseTitle: "Kurz točení pro dospělé",
  courseDate: "sobota 12. 9. 2026 10:00",
  courseLocation: "Ateliér u Písku",
  partySize: 2,
}

export default () => (
  <CourseWaitlistSpotEmailComponent {...mockCourseWaitlistSpot} />
)
