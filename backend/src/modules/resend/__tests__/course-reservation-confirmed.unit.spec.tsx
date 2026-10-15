import { renderToStaticMarkup } from "react-dom/server"
import { CourseReservationConfirmedEmail } from "../emails/course-reservation-confirmed"
import {
  COURSE_CANCELLATION_TERMS,
  COURSE_NO_WITHDRAWAL_NOTICE,
  hasCourseCancellationTerms,
} from "../../course/legal"

/**
 * Potvrzení rezervace kurzu je potvrzení smlouvy v textové podobě
 * (§ 1827 odst. 2 OZ): musí nést poučení o výjimce z odstoupení
 * (§ 1837 písm. j) OZ), storno podmínky (nebo, dokud nejsou doplněné, odkaz
 * na ně v OP čl. X — nikdy zástupný text) a obchodní podmínky. Renderer jako
 * v course-lifecycle-emails.unit.spec.tsx.
 */

const TERMS_LINK = "https://keramickazahrada.cz/cz/smluvni-podminky#kurzy"
const READY_TERMS =
  "Rezervaci můžete zrušit zdarma nejpozději 7 dní před kurzem; později vracíme polovinu ceny."

describe("course-reservation-confirmed", () => {
  it("the shipped constant is still a placeholder — the e-mail must not quote it", () => {
    // Až Lucie storno podmínky doplní, tenhle test spadne schválně: ověřit,
    // že text v e-mailu odpovídá `facts.ts` storefrontu, a test upravit.
    expect(COURSE_CANCELLATION_TERMS).toContain("[[DOPLNIT")
    expect(hasCourseCancellationTerms()).toBe(false)
    expect(hasCourseCancellationTerms("")).toBe(false)
    expect(hasCourseCancellationTerms(READY_TERMS)).toBe(true)
  })

  it.each(["paid", "on_site"] as const)(
    "placeholder terms: § 1837 j) notice + pointer to OP čl. X, never [[DOPLNIT (%s)",
    (variant) => {
      const html = renderToStaticMarkup(
        CourseReservationConfirmedEmail({
          customerName: "Jana Nováková",
          variant,
          // Co posílá `sendCourseReservationConfirmedEmail` s nedoplněnými podmínkami.
          cancellationTerms: "",
          termsLink: TERMS_LINK,
        })
      )
      expect(html).toContain("§ 1837 písm. j)")
      expect(html).not.toContain("[[DOPLNIT")
      expect(html).toContain("čl. X Keramické kurzy")
      expect(html).toContain(TERMS_LINK)
    }
  )

  it("an old stored notification (constant as default) still hides the placeholder", () => {
    const html = renderToStaticMarkup(
      CourseReservationConfirmedEmail({ customerName: "Jana Nováková" })
    )
    expect(html).toContain(COURSE_NO_WITHDRAWAL_NOTICE.slice(0, 40))
    expect(html).not.toContain("[[DOPLNIT")
    expect(html).toContain("čl. X Keramické kurzy")
    // Bez storefrontu žádný mrtvý odkaz.
    expect(html).not.toContain("zobrazit na webu")
  })

  it("quotes the cancellation terms once they are filled in", () => {
    const html = renderToStaticMarkup(
      CourseReservationConfirmedEmail({
        variant: "paid",
        cancellationTerms: READY_TERMS,
        termsLink: TERMS_LINK,
      })
    )
    expect(html).toContain(READY_TERMS)
    expect(html).toContain("kapitola Kurzy")
    expect(html).not.toContain("čl. X Keramické kurzy")
  })

  it("says the terms PDF is attached only when it really went", () => {
    const attached = renderToStaticMarkup(
      CourseReservationConfirmedEmail({
        termsVersionLabel: "15. 10. 2026",
        termsPdfUrl: "https://img.example.cz/legal/obchodni-podminky-2026-10-15.pdf",
        termsAttached: true,
      })
    )
    expect(attached).toContain("v příloze tohoto e-mailu")
    expect(attached).toContain("znění od 15. 10. 2026")

    // Resend přílohu odmítl → odešlo bez ní: odkaz, ne „v příloze".
    const failed = renderToStaticMarkup(
      CourseReservationConfirmedEmail({
        termsVersionLabel: "15. 10. 2026",
        termsPdfUrl: "https://img.example.cz/legal/obchodni-podminky-2026-10-15.pdf",
        termsAttached: true,
        attachments_failed: true,
      })
    )
    expect(failed).not.toContain("v příloze")
    expect(failed).toContain("https://img.example.cz/legal/obchodni-podminky-2026-10-15.pdf")

    // Nezveřejněné PDF: ani příloha, ani odkaz na PDF.
    const none = renderToStaticMarkup(CourseReservationConfirmedEmail({}))
    expect(none).not.toContain("v příloze")
    expect(none).not.toContain("stáhnout jako PDF")
  })
})
