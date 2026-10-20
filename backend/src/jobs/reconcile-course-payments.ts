import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { COURSE_MODULE } from "../modules/course"
import type CourseModuleService from "../modules/course/service"
import { toAmount } from "../modules/course/pricing"
import { paymentStatusFromProvider } from "../lib/payment-provider-status"

/**
 * Doptá se ComGate, co se stalo s platbami za kurzy.
 *
 * ## Proč to musí existovat
 *
 * Celý řetěz po zaplacení kurzu visí na **oznámení od ComGate**: to zavolá
 * `/hooks/payment/pp_comgate_comgate`, ten pustí `processPaymentWorkflow`,
 * a ten teprve vydá `payment.captured` — událost, na které stojí úplně
 * všechno ostatní (`subscribers/course-payment.ts`): označení rezervace jako
 * zaplacené, faktura v iDokladu, potvrzení zákazníkovi i zpráva majitelce.
 *
 * Adresu pro to oznámení si ale ComGate drží ve **svém portálu**, ne v našem
 * kódu — `modules/comgate/service.ts` posílá při založení platby jen
 * `url_paid`, `url_cancelled` a `url_pending`, žádnou notifikační adresu.
 * Když je v portálu prázdná, nepřijde nic: peníze odejdou, rezervace zůstane
 * „nezaplaceno", faktura se nevystaví a zákazníkovi nepřijde ani řádka.
 *
 * Objednávky i doplatky zakázek tuhle druhou cestu dávno mají
 * (`reconcile-checkout-payments`, `reconcile-balance-payments`). Kurzy ji
 * neměly — a byly přitom nejzranitelnější, protože u nich neexistuje ani ta
 * záchrana, kterou má pokladna (návrat z brány tam dokončí košík sám).
 *
 * ## Proč poller, a ne jen nastavit tu adresu
 *
 * Nastavit ji je potřeba tak jako tak a je to lepší cesta — je okamžitá,
 * kdežto tahle má zpoždění až deset minut. Ale oznámení od poskytovatele umí
 * tiše přestat chodit: přepíše se adresa, vyprší certifikát, někdo sáhne do
 * portálu. Když na tom visí, jestli zákazník ví, že má místo, nesmí to být
 * jediná cesta.
 *
 * ## Co tenhle job NEdělá
 *
 * Nerozhoduje a nic nerozesílá. Jen pustí tutéž `processPaymentWorkflow`,
 * kterou pouští ověřené oznámení — zbytek (zaplaceno / faktura / e-maily)
 * obstará `subscribers/course-payment.ts`, který je idempotentní, takže
 * opožděné oznámení po tomhle jobu (nebo naopak) nic nezdvojí.
 *
 * Neúspěšné platby tu taky neřeší: rezervaci, kterou nikdo nezaplatil,
 * uvolní po 24 hodinách `expire-course-payments` a ten o tom zákazníkovi
 * napíše. Dvě úlohy psát o téže věci by znamenalo dva e-maily.
 */

/** Terminální stavy brány — tam už není co hlídat. */
const HOTOVO = ["captured", "authorized"]

export default async function reconcileCoursePayments(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const courseService = container.resolve<CourseModuleService>(COURSE_MODULE)
  const paymentModule = container.resolve(Modules.PAYMENT)

  const reservations = (await courseService.listCourseReservations(
    {} as never
  )) as any[]

  /*
   * Hlídáme jen to, co ještě může dopadnout: online platba, která u nás není
   * zaplacená, u živé rezervace, a má relaci (bez ní se brány není na co
   * ptát). Zrušené rezervace sem nepatří — platba, která k nim dorazí, je
   * peníze bez místa a tu hlasitou cestu zařídí subscriber.
   */
  const otevrene = reservations.filter(
    (reservation) =>
      reservation.payment_method === "online" &&
      reservation.payment_status !== "paid" &&
      reservation.status !== "cancelled" &&
      reservation.payment_session_id
  )

  if (!otevrene.length) {
    return
  }

  let srovnano = 0

  for (const reservation of otevrene) {
    try {
      const [session] = await paymentModule.listPaymentSessions({
        id: reservation.payment_session_id,
      } as never)

      if (!session) {
        continue
      }

      // Ptá se poskytovatele, neodhaduje ze stáří záznamu.
      const result = await paymentStatusFromProvider(container, session as any)
      const status = String(result?.status ?? "").toLowerCase()

      if (!HOTOVO.includes(status)) {
        continue
      }

      /*
       * Relace byla jen vytvořená, ne autorizovaná, takže v kolekci není
       * žádná `Payment` k zachycení — `processPaymentWorkflow` s `captured`
       * ji autorizuje A zachytí, což je přesně to, co dělá ověřené
       * oznámení. Teprve to vydá `payment.captured`.
       */
      await processPaymentWorkflow(container).run({
        input: {
          action: "captured",
          data: {
            session_id: reservation.payment_session_id,
            amount: toAmount(reservation.total_price),
          },
        } as never,
      })

      srovnano += 1
      logger.info(
        `[kurzy] Dohled srovnal platbu rezervace ${reservation.id} (${reservation.name}) — ComGate hlásí ${status}.`
      )
    } catch (error) {
      // Jedna rezervace nesmí shodit dohled nad ostatními.
      logger.warn(
        `[kurzy] Platbu rezervace ${reservation.id} se nepodařilo ověřit: ${
          error instanceof Error ? error.message : "neznámá chyba"
        }`
      )
    }
  }

  if (srovnano) {
    logger.info(
      `[kurzy] Dohled nad platbami: srovnáno ${srovnano} z ${otevrene.length} otevřených.`
    )
  }
}

export const config = {
  name: "reconcile-course-payments",
  schedule: "*/10 * * * *",
}
