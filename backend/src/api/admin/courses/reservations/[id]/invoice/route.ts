import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COURSE_MODULE } from "../../../../../../modules/course"
import type CourseModuleService from "../../../../../../modules/course/service"
import { ensureInvoiceForCourseReservation } from "../../../../../../lib/course-invoice"
import { sendCourseReservationConfirmedEmail } from "../../../../../../lib/course-emails"
import { serializeAdminReservation } from "../../../helpers"

/**
 * „Vystavit fakturu" — ruční doklad k zaplacené rezervaci kurzu.
 *
 * ## Proč ruční tlačítko, když to dělá i automatika
 *
 * Automatika vystaví fakturu v jediném okamžiku: když dorazí ověřené
 * oznámení od ComGate a vydá `payment.captured`
 * (`subscribers/course-payment.ts`). Dvě skupiny rezervací se tam nikdy
 * nedostanou:
 *
 * 1. **Platba na místě.** Peníze přijdou u dveří, žádná platební relace
 *    neexistuje, a tedy ani událost, na kterou by se dalo navěsit. Doklad
 *    k nim může vystavit jen člověk, který ví, že zaplaceno bylo.
 * 2. **Online platba, u které automatika selhala.** iDoklad byl chvíli
 *    nedostupný, chyběl údaj, oznámení se ztratilo. Rezervace je zaplacená,
 *    doklad chybí.
 *
 * ## Co to dělá
 *
 * Totéž co automatika a ve stejném pořadí: doklad, pak potvrzení s odkazem
 * na PDF. `ensureInvoiceForCourseReservation` je idempotentní přes
 * `idoklad_invoice_id`, takže druhý stisk fakturu nezdvojí — vrátí tu
 * stávající a e-mail pošle znovu (jiný dedupe klíč, aby ho ten původní
 * nespolkl).
 *
 * Nezaplacená rezervace fakturu nedostane. Doklad na nezaplacenou službu by
 * byl účetně špatně a zákazníkovi by tvrdil, že zaplatil.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const courseService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)
  const reservations = (await courseService.listCourseReservations(
    { id: req.params.id } as never,
    { relations: ["term"] } as never
  )) as any[]
  const reservation = reservations[0]

  if (!reservation || !reservation.term) {
    res.status(404).json({ message: "Rezervace nebyla nalezena." })
    return
  }

  if (reservation.payment_status !== "paid") {
    res.status(400).json({
      message:
        "Fakturu vystavíme až k zaplacené rezervaci. U platby na místě ji nejdřív označte jako zaplacenou.",
    })
    return
  }

  const term = reservation.term
  const invoice = await ensureInvoiceForCourseReservation(
    req.scope,
    reservation,
    term
  )

  if (invoice.status === "failed" || invoice.status === "skipped") {
    logger.warn(
      `[kurzy] Fakturu k rezervaci ${reservation.id} se nepodařilo vystavit: ${
        invoice.reason ?? "neznámý důvod"
      }`
    )
    res.status(502).json({
      message: invoice.reason
        ? `Fakturu se nepodařilo vystavit. ${invoice.reason}`
        : "Fakturu se nepodařilo vystavit.",
      status: invoice.status,
    })
    return
  }

  /*
   * Doklad doputuje k zákazníkovi tímtéž potvrzením, jaké posílá automatika
   * — jen s vlastním klíčem, protože ten původní už byl doručen a nový
   * e-mail by se na něm zastavil.
   */
  const sent = await sendCourseReservationConfirmedEmail(
    req.scope,
    reservation,
    term,
    {
      variant: "paid",
      invoicePdfUrl: invoice.pdf_url ?? reservation.idoklad_pdf_url ?? null,
      keyOverride: `course-invoice:${reservation.id}:${
        invoice.invoice_number ?? invoice.status
      }`,
    }
  ).catch((error) => {
    logger.error(
      `[kurzy] Fakturu k rezervaci ${reservation.id} se podařilo vystavit, ale e-mail neodešel: ${
        error instanceof Error ? error.message : "neznámá chyba"
      }`
    )
    return false
  })

  // Čerstvý řádek pro seznam — číslo faktury a odkaz na PDF už na něm jsou.
  const [updated] = (await courseService.listCourseReservations(
    { id: reservation.id } as never,
    { relations: ["term"] } as never
  )) as any[]

  res.json({
    reservation: serializeAdminReservation(updated ?? reservation),
    invoice: {
      status: invoice.status,
      invoice_number: invoice.invoice_number ?? null,
      pdf_url: invoice.pdf_url ?? null,
    },
    email_sent: sent,
  })
}
