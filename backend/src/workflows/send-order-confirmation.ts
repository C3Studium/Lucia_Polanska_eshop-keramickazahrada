import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";
import { balancePaymentUrl } from "../lib/balance-payment-link";
import {
  checkAttachmentUrls,
  markAttached,
  orderLegalInfo,
} from "../lib/legal/order-legal";
import {
  orderEditUrl,
  orderRefundUrl,
  orderWithdrawalUrl,
} from "../lib/order-access-link";
import { resolveBalanceStep } from "./steps/resolve-balance";
import { sendNotificationStep } from "./steps/send-notification";

type WorkflowInput = {
  id: string
}

/**
 * Smlouva v textové podobě (§ 1827 odst. 2 OZ): PDF obchodních podmínek ve
 * verzi, podle které se objednávka uzavřela, a poučení o odstoupení
 * s formulářem. Přikládá se jen PDF, které je opravdu ke stažení — jinak
 * e-mail odejde s odkazy a do logu jde varování (potvrzení objednávky se
 * kvůli chybějícímu PDF nesmí zdržet ani ztratit).
 */
const resolveOrderLegalStep = createStep(
  "resolve-order-legal-documents",
  async ({ orders }: { orders: any[] }, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const order = orders?.[0]
    const { legal, attachments } = orderLegalInfo(order)
    const { reachable, failed } = await checkAttachmentUrls(attachments)

    for (const miss of failed) {
      logger.warn(
        `[order-placed] PDF ${miss.filename} (${miss.url}) není ke stažení (${miss.reason}) — ` +
          `potvrzení objednávky #${order?.display_id ?? "?"} půjde s odkazem místo přílohy.`
      )
    }
    for (const doc of [legal.terms, legal.withdrawal]) {
      if (doc && !doc.pdf_url) {
        logger.warn(
          `[order-placed] „${doc.title}" verze ${doc.version} ` +
            (doc.pdf_draft
              ? "má jen pracovní PDF s nedoplněnými údaji [[DOPLNIT]] — zákazníkovi ho neposílám"
              : "nemá PDF s veřejnou adresou (pnpm legal:build + legal:upload)") +
            ` — potvrzení objednávky #${order?.display_id ?? "?"} jde jen s odkazem na stránku.`
        )
      }
    }
    if (!legal.terms) {
      logger.warn(
        `[order-placed] Manifest právních dokumentů nezná žádnou verzi obchodních podmínek — ` +
          `potvrzení objednávky #${order?.display_id ?? "?"} je bez nich (spusťte pnpm legal:build).`
      )
    }

    return new StepResponse({
      legal: markAttached(legal, reachable),
      attachments: reachable,
    })
  }
)

export const sendOrderConfirmationWorkflow = createWorkflow(
  "send-order-confirmation",
  ({ id }: WorkflowInput) => {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "created_at",
        "currency_code",
        "total",
        "items.*",
        // Zakázka na míru (výjimka z odstoupení, § 1837 písm. d) — stejná
        // detekce jako modul reklamací (lib/claims/made-to-order).
        "items.product.metadata",
        "items.product.categories.handle",
        // Výdejna (Balíkovna) žije v metadatech — e-mail ji čte odsud, ať
        // „Doručovací adresa" neukazuje domácí adresu u zásilky na výdejnu.
        "metadata",
        "shipping_address.*",
        "billing_address.*",
        "shipping_methods.*",
        "customer.*",
        "total",
        "subtotal",
        "discount_total",
        "shipping_total",
        "tax_total",
        "item_subtotal",
        "item_total",
        "item_tax_total",
        // How the order is being paid — the confirmation's „Platba" row.
        // Dobírka in particular must say „zaplatíte při převzetí", or the
        // customer stands at the door not knowing they owe money.
        "payment_collections.payment_sessions.provider_id",
        "payment_collections.payment_sessions.status",
      ],
      filters: {
        id
      }
    }).config({ name: "get-order-confirmation-details" })
    
    // Keyed per order so at-least-once event delivery cannot send a second
    // confirmation. This matters more now that a failed send is recorded as a
    // failure and therefore retried: without the key, every retry would be a
    // brand-new e-mail rather than another attempt at the same one.
    //
    // The payload is built inside `transform` because `id` and `orders` are
    // not values here — they are placeholders for values the workflow will
    // have when it *runs*. Interpolating one into a template literal at
    // composition time coerces the placeholder to a primitive and throws
    // "object is not a function" while the module is still being imported,
    // which takes the whole server down at boot. Property access
    // (`orders[0].email`) is fine; string building is not.
    // Whether this order still owes money, and how much. A commission paid
    // only as a deposit does; one paid in full does not, and must not be shown
    // a "pay the rest" button for zero.
    const balance = resolveBalanceStep({ order_id: id })

    const legalDocuments = resolveOrderLegalStep({ orders })

    const notificationData = transform(
      { id, orders, balance, legalDocuments },
      ({ id, orders, balance, legalDocuments }) => {
        // The payment sessions carry the provider id; the e-mail needs the
        // customer's words for it. Cancelled sessions are leftovers of a
        // switched payment method and say nothing about how this order pays.
        const sessions = ((orders[0] as any).payment_collections ?? []).flatMap(
          (collection: any) => collection?.payment_sessions ?? []
        )
        const providerIds = sessions
          .filter((session: any) => session?.status !== "canceled")
          .map((session: any) => String(session?.provider_id ?? ""))

        const payment_method = providerIds.some((providerId: string) =>
          providerId.startsWith("pp_dobirka")
        )
          ? "Dobírka — zaplatíte při převzetí"
          : providerIds.some((providerId: string) =>
                providerId.startsWith("pp_comgate")
              )
            ? "Online platba kartou"
            : undefined

        return [
          {
            to: orders[0].email,
            channel: "email",
            template: "order-placed",
            idempotency_key: `order-placed:${id}`,
            // Vazba na objednávku, ať je potvrzení vidět v „E-maily" u objednávky
            // (chybělo — ostatní e-maily ji nesou přes lib/customer-email).
            resource_id: id,
            resource_type: "order",
            data: {
              order: orders[0],
              balance_due: balance.outstanding,
              balance_currency: balance.currency_code,
              ...(payment_method ? { payment_method } : {}),
              // Správa objednávky z e-mailu přes PODEPSANÝ TOKEN — funguje i
              // hostovi bez přihlášení: úprava (`/order/:id/edit`) a reklamace/
              // vrácení/odstoupení (`/order/:id/refund`, kde si vybere druh).
              edit_order_url: orderEditUrl(id),
              refund_url: orderRefundUrl(id),
              // Odstoupit lze od uzavření smlouvy (§ 1829 odst. 1 OZ), ne až
              // po odeslání — tlačítko proto i v potvrzení (§ 1830a OZ). Čistá
              // zakázka ho nedostane, odstoupit od ní nejde (§ 1837 písm. d)).
              withdrawal_url: legalDocuments.legal?.all_made_to_order
                ? null
                : orderWithdrawalUrl(id),
              balance_payment_url: balance.outstanding > 0
                ? balancePaymentUrl(id)
                : null,
              // Sekce „Smlouva a poučení" + PDF v příloze. `__attachments`
              // je přepravní údaj (Resend provider ho z dat šablony vyjme) —
              // v `data`, protože opakované odeslání skládá e-mail jen z nich.
              legal: legalDocuments.legal,
              ...(legalDocuments.attachments.length
                ? { __attachments: legalDocuments.attachments }
                : {}),
            },
          },
        ]
      }
    )

    const notification = sendNotificationStep(notificationData)

    return new WorkflowResponse(notification)
  }
)