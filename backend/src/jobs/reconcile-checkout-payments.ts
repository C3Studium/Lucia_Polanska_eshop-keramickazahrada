import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"

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

/** Co ComGate vrací v `paymentErrorReason`, česky. */
const DUVODY: Record<string, string> = {
  NO_FUNDS: "na účtu nebyl dostatek prostředků",
  LIMIT_EXCEEDED: "byl překročen limit karty",
  REJECTED_BY_BANK: "platbu zamítla banka",
  INVALID_CARDNO_EXPIRY: "chybně zadané číslo karty nebo platnost",
  INVALID_CVC: "chybně zadaný CVC kód",
  CUSTOMER_TIMEOUT: "vypršel časový limit platby",
  ACS_TIMEOUT: "vypršel časový limit ověření",
}

export const duvodCesky = (kod: unknown): string | null => {
  const klic = String(kod ?? "").trim().toUpperCase()
  if (!klic || klic === "NOT_SPECIFIED") {
    return null
  }
  return DUVODY[klic] ?? null
}

export default async function reconcileCheckoutPayments(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const paymentModule = container.resolve(Modules.PAYMENT)

  const od = new Date(Date.now() - DNU_ZPET * 24 * 60 * 60 * 1000)

  const { data: relace } = await query.graph({
    entity: "payment_session",
    fields: ["id", "status", "provider_id", "amount", "data", "created_at"],
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

  for (const session of kComgate) {
    try {
      const provider = container.resolve(
        `pp_${String(session.provider_id ?? "")}`.replace(/^pp_pp_/, "pp_")
      ) as any

      /* Ptá se poskytovatel, nehádá se z věku relace. */
      const vysledek = await provider.getPaymentStatus({
        data: session.data ?? {},
      })
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
       * Neúspěch se nezahazuje: důvod od brány je jediné, z čeho se dá
       * zákazníkovi říct něco lepšího než „platba neproběhla". Ukládá se
       * k relaci, aby ho měl obchod i administrace odkud vzít.
       */
      const duvod = duvodCesky(
        (vysledek?.data as any)?.paymentErrorReason ??
          (session.data as any)?.paymentErrorReason
      )

      if (duvod) {
        await paymentModule.updatePaymentSession({
          id: session.id,
          data: { ...(session.data ?? {}), duvod_selhani: duvod },
        } as never)
        selhalo++
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
      `[comgate-dohled] Prošlo ${kComgate.length} nevyřízených relací: ${dokonceno} dodatečně dokončeno, u ${selhalo} zaznamenán důvod selhání.`
    )
  }
}

export const config = {
  name: "reconcile-checkout-payments",
  /* Po deseti minutách: dost často, aby zákazník nečekal na potvrzení dlouho,
     a dost zřídka, aby se brána nepředržela dotazy. */
  schedule: "*/10 * * * *",
}
