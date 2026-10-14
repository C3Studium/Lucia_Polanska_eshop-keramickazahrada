import { renderToStaticMarkup } from "react-dom/server"
import { CourseReservationConfirmedEmail } from "../emails/course-reservation-confirmed"
import {
  COURSE_CANCELLATION_TERMS,
  COURSE_NO_WITHDRAWAL_NOTICE,
} from "../../course/legal"

/**
 * Potvrzení rezervace kurzu je potvrzení smlouvy v textové podobě
 * (§ 1827 odst. 2 OZ): musí nést poučení o výjimce z odstoupení
 * (§ 1837 písm. j) OZ), storno podmínky a odkaz na OP — v obou variantách.
 * Renderer jako v course-lifecycle-emails.unit.spec.tsx.
 */

describe("course-reservation-confirmed", () => {
  it.each(["paid", "on_site"] as const)(
    "carries the § 1837 j) notice and the cancellation terms (%s)",
    (variant) => {
      const html = renderToStaticMarkup(
        CourseReservationConfirmedEmail({
          customerName: "Jana Nováková",
          variant,
          termsLink: "https://keramickazahrada.cz/cz/smluvni-podminky#kurzy",
        })
      )
      expect(html).toContain("§ 1837 písm. j)")
      expect(html).toContain(COURSE_CANCELLATION_TERMS)
      expect(html).toContain("https://keramickazahrada.cz/cz/smluvni-podminky#kurzy")
    }
  )

  it("falls back to the constants when the stored data predates them", () => {
    const html = renderToStaticMarkup(
      CourseReservationConfirmedEmail({ customerName: "Jana Nováková" })
    )
    expect(html).toContain(COURSE_NO_WITHDRAWAL_NOTICE.slice(0, 40))
    expect(html).not.toContain("kapitola Kurzy")
  })
})
