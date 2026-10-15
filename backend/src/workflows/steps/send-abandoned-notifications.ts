import { 
  createStep,
  StepResponse 
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { CartDTO, CustomerDTO } from "@medusajs/framework/types"
import { EmailTemplates } from "../../modules/resend/service"
import {
  emailOptOutStore,
  isInOptOutSet,
  optedOutEmails,
} from "../../lib/email-optout"
import { emailOptOutUrl } from "../../lib/email-optout-link"

type SendAbandonedNotificationsStepInput = {
  carts: (CartDTO & {
    customer?: CustomerDTO
  })[]
}

export type SendAbandonedNotificationsStepOutput = {
  /** Košíky, které už se znovu upomínat nemají — odeslané i trvale odmítnuté. */
  vyrizeneKosiky: string[]
  /** Košíky, kde selhalo něco přechodného. Zítra se zkusí znovu. */
  kZopakovaniKosiky: string[]
}

/*
 * Kolik e-mailů pustit naráz a jak dlouho počkat mezi vlnami.
 *
 * Resend má strop 10 požadavků za sekundu ("Too many requests. You can only
 * make 10 requests per second."). Notifikační modul Medusy posílá celé pole
 * jedním `promiseAll` bez jakéhokoli škrcení, takže dosavadní dávka 100 košíků
 * znamenala 100 souběžných požadavků — naměřeno na produkčním klíči: z 100
 * naráz projde 10 a 90 se vrátí s HTTP 429.
 *
 * Osm s vteřinovou pauzou drží rezervu i pro e-maily, které v tu chvíli
 * odchází odjinud (objednávka, reset hesla).
 */
export const VLNA = 8
const PAUZA_MS = 1_100

const pockej = (ms: number) => new Promise((hotovo) => setTimeout(hotovo, ms))

/** Přechodné = má smysl zkusit zítra znovu. Cokoli jiného je vada adresy nebo dat. */
export const jePrechodna = (chyba: string) =>
  /rate_limit_exceeded|429|ETIMEDOUT|ECONNRESET|ENOTFOUND|socket hang up|fetch failed/i.test(
    chyba
  )

/**
 * Košíky, jejichž adresa připomenutí odmítla odkazem z dřívějšího e-mailu
 * (§ 7 odst. 3 zák. 480/2004 Sb.), se neposílají — a počítají se mezi
 * vyřízené, takže je razítko `abandoned_notification` vyřadí i z dalších nocí.
 */
export const rozdelPodleOdmitnuti = <T extends { email?: string | null }>(
  kosiky: T[],
  odmitnuteAdresy: Set<string>
): { kOdeslani: T[]; odmitnute: T[] } => {
  const kOdeslani: T[] = []
  const odmitnute: T[] = []
  for (const kosik of kosiky) {
    ;(isInOptOutSet(odmitnuteAdresy, kosik.email) ? odmitnute : kOdeslani).push(kosik)
  }
  return { kOdeslani, odmitnute }
}

export const sendAbandonedNotificationsStep = createStep(
  "send-abandoned-notifications",
  async (input: SendAbandonedNotificationsStepInput, { container }) => {
    const notificationModuleService = container.resolve(
      Modules.NOTIFICATION
    )
    const logger = container.resolve("logger")

    // One nudge per cart, ever. The cart's own `abandoned_notification` metadata
    // flag is only set after this step succeeds, so a failed send leaves the
    // cart eligible again tomorrow — the key makes that a retry of the same
    // e-mail instead of a second one.
    const zprava = (cart: SendAbandonedNotificationsStepInput["carts"][number]) => ({
      to: cart.email!,
      channel: "email",
      template: EmailTemplates.ABANDONED_CART || "",
      idempotency_key: `abandoned-cart:${cart.id}`,
      data: {
        customer: {
          first_name: cart.customer?.first_name || cart.shipping_address?.first_name,
          last_name: cart.customer?.last_name || cart.shipping_address?.last_name,
        },
        cart_id: cart.id,
        // The template formats prices itself; without the currency it would
        // have to guess. Cart prices are major units (no cents conversion).
        currency_code: cart.currency_code,
        items: cart.items?.map((item) => ({
          product_title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          thumbnail: item.thumbnail,
        })),
        // Odmítnutí dalších připomenutí jedním kliknutím (Zásady, § 7 odst. 3
        // zák. 480/2004 Sb.). Bez adresy backendu `null` → šablona řádek vynechá.
        unsubscribe_url: emailOptOutUrl(cart.email, "abandoned_cart"),
      }
    })

    const vyrizeneKosiky: string[] = []
    const kZopakovaniKosiky: string[] = []

    const { kOdeslani, odmitnute } = rozdelPodleOdmitnuti(
      input.carts,
      await optedOutEmails(
        emailOptOutStore(container),
        input.carts.map((cart) => cart.email),
        "abandoned_cart"
      )
    )
    for (const cart of odmitnute) {
      vyrizeneKosiky.push(cart.id)
    }
    if (odmitnute.length) {
      logger.info(
        `[abandoned-cart] ${odmitnute.length} košíků přeskočeno — adresa připomenutí odmítla.`
      )
    }

    /*
     * Po jednom košíku, ne celé pole naráz.
     *
     * `createNotifications` bere pole, jenže při chybě kteréhokoli z nich
     * vyhodí souhrnnou výjimku (`aggregateErrors: true`) — a z té se nedá
     * poznat, které košíky prošly. Celý krok proto padal a `updateCartsStep`
     * za ním se nikdy nespustil: v produkci nemá příznak `abandoned_notification`
     * ani jeden z 318 košíků, takže se každou noc rozesílalo všem znovu.
     *
     * Jeden košík = jedno volání = jasný výsledek.
     */
    for (let i = 0; i < kOdeslani.length; i += VLNA) {
      const vlna = kOdeslani.slice(i, i + VLNA)

      await Promise.all(
        vlna.map(async (cart) => {
          try {
            await notificationModuleService.createNotifications([zprava(cart)])
            vyrizeneKosiky.push(cart.id)
          } catch (chyba) {
            const detail = chyba instanceof Error ? chyba.message : String(chyba)

            if (jePrechodna(detail)) {
              kZopakovaniKosiky.push(cart.id)
              logger.warn(
                `[abandoned-cart] ${cart.email}: přechodná chyba, zkusí se zítra znovu — ${detail}`
              )
              return
            }

            /*
             * Trvalá chyba (neplatná adresa, odmítnutá doména) se počítá jako
             * vyřízená. Jinak by se ta samá adresa zkoušela každou noc až do
             * konce světa — v produkci to dělalo 85 z 193 nezdařených e-mailů
             * (seedovaná data na `example.com`, které Resend odmítá rovnou).
             */
            vyrizeneKosiky.push(cart.id)
            logger.error(
              `[abandoned-cart] ${cart.email}: trvale se nepodařilo odeslat, košík se už upomínat nebude — ${detail}`
            )
          }
        })
      )

      if (i + VLNA < kOdeslani.length) {
        await pockej(PAUZA_MS)
      }
    }

    logger.info(
      `[abandoned-cart] hotovo: ${vyrizeneKosiky.length} vyřízeno, ` +
        `${kZopakovaniKosiky.length} k zopakování zítra.`
    )

    return new StepResponse({
      vyrizeneKosiky,
      kZopakovaniKosiky,
    } satisfies SendAbandonedNotificationsStepOutput)
  }
)
