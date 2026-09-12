import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Dorovná „platba zachycena" u objednávek, které vznikly dokončením košíku.
 *
 * ## Co se dělo
 *
 * K zaplacené kartou se obchod může dostat třemi cestami a každá vypadá
 * navenek stejně — objednávka je zaplacená. Jenže následky se lišily:
 *
 * - **Oznámení od ComGate** (`/hooks/payment/pp_comgate_comgate`) pustí
 *   `processPaymentWorkflow`, a ten dokončí košík **a** vydá
 *   `payment.captured`.
 * - **Návrat zákazníka z brány** zavolá `/store/carts/:id/complete`. Ten jde
 *   přes `authorizePaymentSessionStep`: ComGate vrátí `PAID`, poskytovatel to
 *   mapuje na `captured` a Medusa založí platbu rovnou se zaplaceným
 *   `captured_at` — ale `payment.captured` **nevydá**. Tu událost vydává jedině
 *   `capturePaymentWorkflow` (`core-flows/payment/workflows/capture-payment.js`),
 *   který dokončení košíku nevolá.
 *
 * A na té události visí faktura v iDokladu a e-mail „Platba přijata".
 *
 * Naměřeno na produkci 11. 9. 2026: objednávka #11 měla `captured_at`
 * vyplněné, worker zpracoval jen `order.placed`, v oznámeních žádný
 * `payment-received` a v metadatech `idoklad_invoice_id: null`. Zaplaceno,
 * a přitom bez dokladu.
 *
 * ## Proč se to řeší tady, a ne u každého spotřebitele zvlášť
 *
 * Ty události poslouchají čtyři odběratelé (faktura, zákaznické e-maily,
 * srovnání stavu objednávky, potvrzení čekající změny). Dopsat každému z nich
 * druhý vstup by znamenalo čtyři místa, která se můžou rozejít. Levnější je
 * vrátit jim to, s čím byly napsané: chybějící událost.
 *
 * ## Proč je bezpečné ji vydat i podruhé
 *
 * Když objednávku dokončilo oznámení od brány, `payment.captured` už jednou
 * padla a tohle přidá druhou. Doručení událostí je v Meduse „aspoň jednou"
 * a všichni čtyři odběratelé s tím počítají: faktura je hlídaná metadaty
 * a zámkem, e-maily jsou klíčované na id platby, srovnání stavu nedělá nic,
 * pokud objednávka není v „problém s platbou", a potvrzení změny se ptá na
 * čekající požadavek. Opakování tedy nic nezdvojí.
 *
 * Vydává se jen za platby, které **opravdu mají `captured_at`** — nikdy se
 * tím nic nezaúčtuje, jen se řekne nahlas, co už v databázi stojí.
 */
export default async function emitCaptureOnOrderPlaced({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (!data?.id) {
    return
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "payment_collections.payments.id",
        "payment_collections.payments.captured_at",
      ],
      filters: { id: data.id },
    })

    const platby = ((orders[0] as any)?.payment_collections ?? [])
      .flatMap((collection: any) => collection?.payments ?? [])
      .filter((payment: any) => payment?.id && payment?.captured_at)

    if (!platby.length) {
      /* Osobní odběr sem patří schválně: ten se zachytí až u pultu tlačítkem
         „Vyzvednuto a zaplaceno", a to jde přes `capturePaymentWorkflow`,
         takže událost vydá samo. */
      return
    }

    const eventBus = container.resolve(Modules.EVENT_BUS)

    for (const platba of platby) {
      await eventBus.emit({
        name: "payment.captured",
        data: { id: platba.id },
      })
    }

    logger.info(
      `[platby] Objednávka ${data.id} vznikla už zaplacená — dohlášeno ${platby.length}× „platba zachycena", aby se vystavila faktura a odešel e-mail.`
    )
  } catch (chyba) {
    /* Objednávka už existuje a je zaplacená. Když se dohlášení nepovede,
       nesmí to shodit nic dalšího — fakturu pak doplní ruční tlačítko
       v administraci. */
    logger.warn(
      `[platby] Dohlášení zachycené platby u objednávky ${data.id} selhalo: ${
        chyba instanceof Error ? chyba.message : String(chyba)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: { subscriberId: "emit-capture-on-order-placed" },
}
