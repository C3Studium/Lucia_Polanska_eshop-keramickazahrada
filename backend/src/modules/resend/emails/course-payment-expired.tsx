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
 * Sent by the hourly expiry job when an online reservation stayed unpaid for
 * 24 hours and its seats were released. The tone is matter-of-fact, not
 * scolding — an interrupted payment is usually a closed tab, not a decision —
 * and the button leads back to the kurzy page, which itself says whether the
 * term still has room (no promises made here that the page can't keep).
 */

interface CoursePaymentExpiredEmailProps {
  customerName?: string
  courseTitle?: string
  /** Already formatted in Europe/Prague. */
  courseDate?: string
  courseLocation?: string
  partySize?: number
  totalAmount?: string
}

function CoursePaymentExpiredEmailComponent({
  customerName = "Vážený zákazníku",
  courseTitle = "Kurz točení pro dospělé",
  courseDate = "sobota 12. 9. 2026 10:00",
  courseLocation = "Ateliér u Písku",
  partySize = 1,
  totalAmount = "1 200 Kč",
}: CoursePaymentExpiredEmailProps) {
  const base = storefrontBase()
  const coursesUrl = base ? `${base}/kurzy#rezervace` : ""
  return (
    <EmailLayout
      preview={`Platba za rezervaci kurzu ${courseTitle} nedorazila — místo jsme uvolnili.`}
    >
      <Eyebrow>Kurzy</Eyebrow>
      <EmailH1 accent="rezervaci jsme uvolnili.">Platba nedorazila,</EmailH1>

      <Greeting name={customerName} />
      <P>
        u vaší rezervace kurzu jsme čekali na platbu kartou, ale do 24 hodin
        nedorazila. Rezervaci jsme proto uvolnili, aby místa nezůstala
        blokovaná — takhle to děláme u všech nedokončených plateb.
      </P>

      <LedgerRow label="Kurz" value={courseTitle} />
      <LedgerRow label="Termín" value={courseDate} />
      <LedgerRow label="Kde" value={courseLocation} />
      <LedgerRow
        label="Počet osob"
        value={`${partySize} ${partySize === 1 ? "osoba" : partySize < 5 ? "osoby" : "osob"}`}
      />
      <LedgerRow label="Cena (nezaplaceno)" value={totalAmount} />
      <LedgerEnd />

      <Note>
        Pokud máte o kurz stále zájem, stačí si místo rezervovat znovu —
        zabere to minutu.
      </Note>

      {coursesUrl ? (
        <ButtonRow>
          <EmailButton href={coursesUrl}>Rezervovat znovu</EmailButton>
        </ButtonRow>
      ) : null}

      <P>
        A kdybyste platbu mezitím odeslali a tahle zpráva vám nesedí,
        odpovězte prosím na tento e-mail — společně to dáme do pořádku.
      </P>

      <Signature />
    </EmailLayout>
  )
}

export const CoursePaymentExpiredEmail = (
  props: CoursePaymentExpiredEmailProps
) => <CoursePaymentExpiredEmailComponent {...props} />

// Mock data for preview/development
const mockCoursePaymentExpired: CoursePaymentExpiredEmailProps = {
  customerName: "Jana Nováková",
  courseTitle: "Kurz točení pro dospělé",
  courseDate: "sobota 12. 9. 2026 10:00",
  courseLocation: "Ateliér u Písku",
  partySize: 2,
  totalAmount: "2 600 Kč",
}

export default () => (
  <CoursePaymentExpiredEmailComponent {...mockCoursePaymentExpired} />
)
