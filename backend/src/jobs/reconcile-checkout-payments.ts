import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { paymentStatusFromProvider } from "../lib/payment-provider-status"
import {
  duvodCesky,
  emailFailedCheckoutPayment,
  failedPaymentEmailDue,
} from "../lib/payment-failure"

/**
 * Doptá se ComGate, co se stalo s platbami z pokladny, o kterých se obchod
 * nedozvěděl.
 *
 * ## Proč to musí existovat
 *
 * Celý řetěz po zaplacení kartou visí na **oznámení od ComGate**: to zavolá
 * `/hooks/payment/pp_comgate_comgate`, ten pustí `processPaymentWorkflow`,
 * a teprve ten dokončí košík a vydá `payment.captured` — událost, na které
 * stojí faktura v iDokladu i e-mail „Platba přijata".
 *
 * Adresu pro to oznámení si ale ComGate drží ve **svém portálu**, ne v našem
 * kódu. Změřeno na produkci 11. 9. 2026: ComGate hlásil u transakce
 * `status=PAID`, ale v logu backendu nebylo ani jedno zavolání té routy —
 * a Medusa měla relaci pořád `pending`. Peníze reálné, objednávka žádná.
 *
 * Zachránilo to jen to, že se zákazník z brány vrátí do obchodu: návratová
 * stránka zavolá `/complete`, autorizace se doptá ComGate sama a objednávka
 * vznikne. Kdo zavře záložku, zaplatil a objednávku nemá.
 *
 * ## Proč poller, a ne jen nastavit tu adresu
 *
 * Nastavit ji je potřeba tak jako tak. Ale oznámení od poskytovatele je věc,
 * která umí tiše přestat chodit — přepíše se adresa, vyprší certifikát,
 * někdo sáhne do portálu. Když na tom visí to, jestli zákazník dostane
 * zboží, nesmí to být jediná cesta. Tenhle job je druhá.
 *
 * Sesterský `reconcile-balance-payments` dělá totéž pro doplatky u zakázkové
 * výroby; tenhle pokrývá běžnou pokladnu, na kterou tam nedosáhne.
 *
 * Zrušené platby (zákazník zrušil, nedostatek peněz, vypršelo) hlásí
 * zákazníkovi e-mailem „neprošla" s odkazem na opakování — viz
 * `lib/payment-failure`.
 *
 * ## Bezpečnost
 *
 * Jen **odráží**, co říká ComGate — nikdy nerozhoduje. Platí se přes
 * `processPaymentWorkflow`, tedy přesně to, co pouští ověřené oznámení:
 * stejná cesta, stejné události, žádná druhá pravda o tom, co je zaplacené.
 * Relace, které už nejsou `pending`, se přeskakují, takže opakovaný běh
 * nemůže nic zaúčtovat podruhé.
 */

/** Jak daleko zpátky se ptát. Starší košík už stejně nikdo nedokončí. */
const DNU_ZPET = 3

/* Přesunuto do lib/payment-failure (sdílí ho i dohled doplatků). */
export { duvodCesky }

export default async function reconcileCheckoutPayments(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const od = new Date(Date.now() - DNU_ZPET * 24 * 60 * 60 * 1000)

  const { data: relace } = await query.graph({
    entity: "payment_session",
    fields: [
      "id",
      "status",
      "provider_id",
      "amount",
      "data",
      "created_at",
      "payment_collection_id",
    ],
    filters: {
      status: "pending",
      created_at: { $gte: od },
    } as never,
  })

  const kComgate = (relace as any[]).filter((r) =>
    String(r?.provider_id ?? "").includes("comgate")
  )

  if (!kComgate.length) {
    return
  }

  let dokonceno = 0
  let selhalo = 0
  const ted = new Date()

  for (const session of kComgate) {
    try {
      /* Ptá se poskytovatel, nehádá se z věku relace. */
      const vysledek = await paymentStatusFromProvider(container, session)
      const stav = String(vysledek?.status ?? "").toLowerCase()

      if (stav === "captured") {
        /*
         * Táž cesta jako u ověřeného oznámení — dokončí košík, zachytí platbu
         * a vydá `payment.captured`, na kterém visí faktura i e-mail.
         */
        await processPaymentWorkflow(container).run({
          input: {
            action: "captured",
            data: { session_id: session.id, amount: session.amount },
          } as never,
        })

        dokonceno++
        logger.info(
          `[comgate-dohled] Relace ${session.id} byla u brány zaplacená, ale obchod o tom nevěděl — dokončeno.`
        )
        continue
      }

      /*
       * Zrušená platba (tlačítko „Zrušit", nedostatek peněz, zamítnutí,
       * vypršení) → e-mail „neprošla" s odkazem na opakování, s odstupem
       * (lib/payment-failure). Relace, kterou zákazník mezitím nahradil novým
       * pokusem, tu už není — Medusa ji při novém pokusu smaže.
       *
       * Důvod od brány jde rovnou do e-mailu. Dřív se ukládal k relaci přes
       * `updatePaymentSession`, jenže to bez částky volá ComGate `updatePayment`
       * a ten vyhodí — důvod se tak nikdy neuložil (a nikdo ho nečetl).
       */
      if (stav === "canceled" && failedPaymentEmailDue(session.created_at, ted)) {
        const duvod = duvodCesky(
          (vysledek?.data as any)?.paymentErrorReason ??
            (session.data as any)?.paymentErrorReason
        )
        if (await emailFailedCheckoutPayment(container, session, duvod)) {
          selhalo++
        }
      }
    } catch (chyba) {
      /* Jedna rozbitá relace nesmí zastavit zbytek — příště se zkusí znovu. */
      logger.warn(
        `[comgate-dohled] Relaci ${session.id} se nepodařilo ověřit: ${
          chyba instanceof Error ? chyba.message : String(chyba)
        }`
      )
    }
  }

  if (dokonceno || selhalo) {
    logger.info(
      `[comgate-dohled] Prošlo ${kComgate.length} nevyřízených relací: ${dokonceno} dodatečně dokončeno, u ${selhalo} zrušených zařazen e-mail „neprošla" (už odeslaný notifikace přeskočí).`
    )
  }
}

export const config = {
  name: "reconcile-checkout-payments",
  /* Po deseti minutách: dost často, aby zákazník nečekal na potvrzení dlouho,
     a dost zřídka, aby se brána nepředržela dotazy. */
  schedule: "*/10 * * * *",
}
