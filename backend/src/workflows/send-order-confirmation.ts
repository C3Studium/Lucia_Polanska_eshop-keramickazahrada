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
import { LEGAL_MANIFEST } from "../lib/legal";
import {
  checkAttachmentUrls,
  markAttached,
  orderLegalInfo,
  withCommissionConfirmations,
  type EmailAttachmentRef,
} from "../lib/legal/order-legal";
import { getLegalFacts } from "../lib/merchant-settings";
import {
  orderEditUrl,
  orderRefundUrl,
  orderWithdrawalUrl,
} from "../lib/order-access-link";
import { resolveBalanceStep } from "./steps/resolve-balance";
import { sendNotificationStep } from "./steps/send-notification";

type WorkflowInput = {
  id: string
  /**
   * PDF „Potvrzení zakázky" (Z11) k objednávce se zakázkou — přidá se k OP
   * a poučení do přílohy; posílá ho subscriber `commission-confirmation`.
   * Chybí/null u běžné objednávky i když PDF selhalo (potvrzení jde bez něj).
   * Starý tvar (jedna zakázka na objednávku); nové volání posílá seznam níž.
   */
  commission_confirmation?: EmailAttachmentRef | null
  /** Od 20. 10. 2026 (zakázka = položka): jedno PDF na každou zakázku objednávky. */
  commission_confirmations?: EmailAttachmentRef[] | null
}

/**
 * Smlouva v textové podobě (§ 1827 odst. 2 OZ): PDF obchodních podmínek ve
 * verzi, podle které se objednávka uzavřela, a poučení o odstoupení
 * s formulářem. Přikládá se jen PDF, které je opravdu ke stažení — jinak
 * e-mail odejde s odkazy a do logu jde varování (potvrzení objednávky se
 * kvůli chybějícímu PDF nesmí zdržet ani ztratit).
 *
 * Prodávající v sekci „Smlouva a poučení" je z právních údajů v administraci
 * v okamžiku objednávky (uloží se s notifikací, takže opakované odeslání
 * ukáže totéž); když nastavení nejde přečíst, z manifestu.
 */
const resolveOrderLegalStep = createStep(
  "resolve-order-legal-documents",
  async (
    { orders, commissions }: { orders: any[]; commissions: EmailAttachmentRef[] },
    { container }
  ) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const order = orders?.[0]
    const live = await getLegalFacts(container)
    const { legal, attachments: legalAttachments } = orderLegalInfo(
      order,
      LEGAL_MANIFEST,
      live.source === "settings" ? live.facts : null
    )
    // Potvrzení zakázky první (jedno na každou zakázku objednávky) — je to
    // smlouva k téhle objednávce; OP a poučení za nimi.
    const commissionAttachments = (commissions ?? []).filter((item) => Boolean(item?.url))
    const attachments = [...commissionAttachments, ...legalAttachments]
    const { reachable, failed } = await checkAttachmentUrls(attachments)

    for (const miss of failed) {
      logger.warn(
        `[order-placed] PDF ${miss.filename} (${miss.url}) není ke stažení (${miss.reason}) — ` +
          `potvrzení objednávky #${order?.display_id ?? "?"} půjde s odkazem místo přílohy.`
      )
    }
    for (const doc of [legal.terms, legal.withdrawal]) {
      if (doc && !doc.in_manifest) {
        // Zákazník souhlasil s verzí, kterou manifest nezná (vydaná ve Studiu
        // po posledním legal:build). E-mail ji jmenuje datem a odkazem — jiné
        // znění místo ní se posílat nesmí.
        logger.warn(
          `[order-placed] „${doc.title}" verze ${doc.version} (uložená u objednávky) v manifestu ` +
            `backendu není — potvrzení objednávky #${order?.display_id ?? "?"} ji uvádí bez PDF, ` +
            `jen s odkazem na web. Spusťte pnpm legal:build (a legal:upload) a nasaďte backend.`
        )
      } else if (doc && !doc.pdf_url) {
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

    const withCommission = withCommissionConfirmations(
      markAttached(legal, reachable),
      commissionAttachments,
      reachable
    )
    return new StepResponse({
      legal: withCommission,
      attachments: reachable,
      commission_attached: Boolean(withCommission.commission_confirmation?.attached),
      // Které PDF Potvrzení zakázky opravdu šly v příloze — podle toho
      // subscriber zapíše `confirmation_sent_at` jen těm zakázkám.
      commission_attached_urls: (withCommission.commission_confirmations ?? [])
        .filter((item) => item.attached)
        .map((item) => item.url),
    })
  }
)

export const sendOrderConfirmationWorkflow = createWorkflow(
  "send-order-confirmation",
  ({ id, commission_confirmation, commission_confirmations }: WorkflowInput) => {
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
        // Doplatek zakázky ještě před tím, než `initialize-merchant-order`
        // založí produkční objednávku (resolveBalanceStep) — kolekce z
        // pokladny nese celou cenu i účtovanou zálohu.
        "payment_collections.amount",
        "payment_collections.metadata",
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
    // a "pay the rest" button for zero. The production order may not exist
    // yet (same event, parallel subscriber) — the step then reads the balance
    // from the checkout's payment collection in `orders`.
    const balance = resolveBalanceStep({ order_id: id, orders })

    // Starý jednotlivý tvar i nový seznam → jeden seznam příloh (uvnitř
    // `transform`, protože vstupy jsou tu jen placeholdery, ne hodnoty).
    const commissions = transform(
      { commission_confirmation, commission_confirmations },
      ({ commission_confirmation, commission_confirmations }) =>
        [
          ...(commission_confirmations ?? []),
          ...(commission_confirmation ? [commission_confirmation] : []),
        ] as EmailAttachmentRef[]
    )

    const legalDocuments = resolveOrderLegalStep({
      orders,
      commissions,
    })

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
            ? // Brána bere i převod, Apple Pay a Google Pay — ne „kartou".
              "Online platba přes platební bránu ComGate"
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

    // `commission_attached`: šlo Potvrzení zakázky opravdu v příloze? Podle
    // toho subscriber zapíše `confirmation_sent_at`.
    const result = transform(
      { notification, legalDocuments },
      ({ notification, legalDocuments }) => ({
        notification,
        commission_attached: Boolean(legalDocuments.commission_attached),
        commission_attached_urls: legalDocuments.commission_attached_urls ?? [],
      })
    )

    return new WorkflowResponse(result)
  }
)