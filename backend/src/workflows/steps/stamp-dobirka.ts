import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DOBIRKA_PROVIDER_ID } from "../../lib/ship-gate"

/**
 * Zapíše na objednávku, kolik má dopravce vybrat na dobírku — než vznikne
 * vyskladnění.
 *
 * ## Proč to musí udělat workflow, a ne provider
 *
 * `ceskaPostaFulfillment` běží v kontejneru fulfillment modulu. Tam
 * `payment_collections` nejsou a dotáhnout je nelze: modulové kontejnery
 * nedostávají aplikační `query`. Objednávka, kterou provider v
 * `createFulfillment` dostane, nese pevný seznam polí a platby v něm nejsou.
 *
 * `order.metadata` v tom seznamu **je**. Je to tedy jediný kanál, kterým se
 * fakt o dobírce dostane až k podání zásilky — a tohle workflow platby stejně
 * už načítá kvůli kontrole před odesláním.
 *
 * ## Proč se zapisuje i nula
 *
 * Aby „klíč chybí" znamenalo něco jiného než „bez dobírky". Provider
 * kontroluje `cp_dobirka_zjistena` a když ho nenajde, **nahlásí to** místo aby
 * tiše podal zásilku bez dobírky. Zásilka bez dobírky u objednávky na dobírku
 * znamená, že zboží odejde a peníze nepřijdou — a pozná se to až podle toho,
 * že nikdy nedorazí.
 */
export const stampDobirkaStep = createStep(
  "stamp-dobirka-on-order",
  async (
    input: { order_id: string; payment_collections: any[]; total: unknown },
    { container }
  ) => {
    const orderModule = container.resolve(Modules.ORDER)
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    const jeDobirka = (input.payment_collections ?? []).some((sbirka: any) =>
      (sbirka?.payments ?? []).some((platba: any) => platba?.provider_id === DOBIRKA_PROVIDER_ID)
    )

    /*
     * Vybírá se celá částka objednávky. Je to totéž, co ukazuje admin na kartě
     * objednávky („DOBÍRKA — vybrat …"), takže se ty dvě čísla nemůžou rozejít.
     */
    const castka = jeDobirka ? Math.round(Number(input.total ?? 0)) : 0

    const [objednavka] = await orderModule.listOrders(
      { id: input.order_id },
      { select: ["id", "metadata"] }
    )
    const puvodni = (objednavka?.metadata ?? {}) as Record<string, unknown>

    await orderModule.updateOrders([
      {
        id: input.order_id,
        metadata: { ...puvodni, cp_dobirka_zjistena: true, cp_dobirka_czk: castka },
      },
    ])

    if (jeDobirka) {
      logger.info(
        `[ceska-posta] Objednávka ${input.order_id}: zásilka půjde na dobírku ${castka} Kč.`
      )
    }

    /*
     * Kompenzace vrací metadata do původního stavu. Bez ní by po neúspěšném
     * odeslání zůstal na objednávce údaj o dobírce z pokusu, který se nekonal.
     */
    return new StepResponse({ jeDobirka, castka }, { order_id: input.order_id, puvodni })
  },
  async (vraceni, { container }) => {
    if (!vraceni) return
    const orderModule = container.resolve(Modules.ORDER)
    await orderModule.updateOrders([{ id: vraceni.order_id, metadata: vraceni.puvodni }])
  }
)
