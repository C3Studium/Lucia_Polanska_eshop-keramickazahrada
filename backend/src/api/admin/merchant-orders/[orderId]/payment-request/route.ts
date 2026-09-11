import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  customerName,
  orderLink,
  orderNumber,
  sendCustomerEmail,
} from "../../../../../lib/customer-email"

/**
 * „Pošlete zákazníkovi výzvu k zaplacení."
 *
 * ## Proč to musí jít i ručně
 *
 * Platba se nepovede častěji, než by člověk čekal: vyprší relace u brány,
 * zákazník zavře záložku, banka transakci zamítne, objednávka se stornuje
 * a zákazník si ji rozmyslí zpátky. Objednávka v tu chvíli existuje, zboží je
 * odložené — a jediné, co chybí, jsou peníze.
 *
 * Automatika pro tenhle případ neexistuje a ani by neměla: rozhodnutí „tuhle
 * objednávku chci ještě zachránit" je obchodní, ne technické. U zrušené
 * objednávky obzvlášť — poslat výzvu k zaplacení něčeho, co bylo stornováno
 * schválně, by bylo horší než mlčet. Proto tlačítko, ne pravidlo.
 *
 * ## Co se posílá
 *
 * Šablona `payment-pending` („Odkaz k platbě"), tatáž, jakou dostává doplatek
 * u zakázkové výroby. Nese částku, způsob platby a odkaz.
 *
 * ## Proč odkaz vede na objednávku, a ne rovnou na bránu
 *
 * Znovu otevřít konkrétní platební relaci ComGate z e-mailu nejde — relace má
 * svou platnost a ta je v tu chvíli dávno pryč. Odkaz proto vede na stránku
 * objednávky v obchodě, odkud se platba spustí znovu a s čerstvou relací.
 * Odkaz, který vede na vypršenou bránu, je horší než žádný.
 *
 * ## Proč se nekontroluje, že objednávka není zaplacená
 *
 * Kontroluje — ale jen jako varování v odpovědi, ne jako zákaz. Stav plateb
 * umí být rozporuplný (částečná platba, vrácená částka, doplatek) a odmítnout
 * odeslání kvůli součtu by znamenalo, že v přesně těch spletitých případech,
 * kdy je člověk nejvíc potřeba, tlačítko nefunguje.
 */

const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "currency_code",
  "total",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "payment_collections.amount",
  "payment_collections.payments.amount",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
  "payment_collections.payments.refunds.amount",
]

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Kolik z objednávky opravdu dorazilo — zachycené mínus vrácené.
 *
 * Vyvezené kvůli testům: je to jediný výpočet v celém souboru.
 */
export const zaplacenoZObjednavky = (order: any): number => {
  const payments = (order?.payment_collections ?? []).flatMap(
    (collection: any) => collection?.payments ?? []
  )

  return payments.reduce((soucet: number, payment: any) => {
    if (!payment?.captured_at) {
      return soucet
    }
    const vraceno = (payment.refunds ?? []).reduce(
      (celkem: number, refund: any) => celkem + toNumber(refund?.amount),
      0
    )
    return soucet + toNumber(payment.amount) - vraceno
  }, 0)
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderId = req.params.orderId

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = orders[0] as any

  if (!order) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Objednávka nebyla nalezena."
    )
  }

  if (!order.email) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Objednávka nemá e-mailovou adresu, není kam výzvu poslat."
    )
  }

  const celkem = toNumber(order.total)
  const zaplaceno = zaplacenoZObjednavky(order)
  const zbyva = Math.max(celkem - zaplaceno, 0)

  const odeslano = await sendCustomerEmail(req.scope, {
    template: "payment-pending",
    to: order.email,
    /*
     * Klíč nese čas, takže druhé kliknutí opravdu pošle druhý e-mail.
     * Jinde se klíčem duplicity potlačují — tady je opakování smysl věci:
     * „ještě jednou připomenout" je přesně to, proč se na tlačítko sahá
     * podruhé.
     */
    key: `paylink:manual:${order.id}:${Date.now()}`,
    orderId: order.id,
    data: {
      customerName: customerName(order),
      orderNumber: orderNumber(order),
      orderLink: orderLink(order),
      paymentAmount: new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currency: (order.currency_code ?? "czk").toUpperCase(),
        maximumFractionDigits: 0,
      }).format(zbyva > 0 ? zbyva : celkem),
      paymentMethod: "Platební karta nebo převod",
      /* Na objednávku, ne na bránu — viz hlavička souboru. */
      paymentLink: orderLink(order),
      estimatedConfirmationTime:
        "Platba se obvykle potvrdí do několika minut. Jakmile dorazí, ozveme se s potvrzením.",
      makingPhotoUrl: null,
    },
  })

  res.json({
    sent: odeslano,
    to: order.email,
    amount: zbyva > 0 ? zbyva : celkem,
    currency_code: order.currency_code,
    /* Varování, ne zákaz — viz hlavička souboru. */
    warning:
      zbyva <= 0
        ? "Objednávka vypadá jako zaplacená — výzva se přesto odeslala."
        : null,
  })
}
