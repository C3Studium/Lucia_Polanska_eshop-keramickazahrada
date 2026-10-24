import { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Skeleton,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SettleBalanceOffline } from "../components/production-order-actions";
import {
  AgreedPriceBlock,
  agreedPriceConfirmBlock,
  agreedPriceStartBlock,
} from "../components/agreed-price";
import { formatAmount } from "../lib/format";
import { sdk } from "../lib/sdk";
import { adminQueryClient } from "../lib/query-client"
import { ceskaChyba } from "../lib/ceska-chyba";
import {
  productionStageMeta as stageMeta,
  productionStep as actionForStage,
  type ProductionStage,
} from "../lib/production-stage";

type ProductionPayment = {
  id: string;
  type: "deposit" | "balance";
  status: "draft" | "pending" | "sent" | "paid" | "failed" | "expired" | "cancelled";
  amount: number | string;
  currency_code: string;
  payment_url?: string | null;
  sent_at?: string | null;
  paid_at?: string | null;
};

type ProductionOrder = {
  id: string;
  order_id: string;
  stage: ProductionStage;
  deposit_percentage: number;
  agreed_total?: number | string | null;
  surcharge?: number | string | null;
  original_total: number | string;
  final_total?: number | string;
  currency_code: string;
  estimated_completion_at?: string | null;
  payment_requests?: ProductionPayment[];
  paid_amount?: number | string;
  outstanding_amount?: number | string;
  can_fulfill?: boolean;
  /** Jen zakázky, žádné běžné zboží — postup výroby pak ovládá Denní práce. */
  pure_commission?: boolean;
  /** Osobní odběr v ateliéru — jen tady má smysl „Zaplaceno na místě". */
  personal_pickup?: boolean;
  /** Smluvní záloha v penězích (LEGAL_AUDIT § 0, Z2/Z5) — nevratná část po zahájení výroby. */
  deposit_amount?: number | string | null;
  /** Z3: kdy odešel e-mail „Zakázka je ve výrobě"; null = výroba (prokazatelně) nezačala. */
  production_start_notified_at?: string | null;
  production_started_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: "customer" | "seller" | string | null;
  cancellation_phase?: "before_production" | "after_production" | string | null;
  cancellation_refund_amount?: number | string | null;
  /** Z11: PDF „Potvrzení zakázky" — plní subscriber PDF; tady se jen čte. */
  confirmation_pdf_url?: string | null;
  confirmation_sent_at?: string | null;
  /** Cena po domluvě: položka objednaná za 0 Kč, cenu Lucie pošle odsud. */
  price_on_request?: boolean;
  agreed_price_sent_at?: string | null;
  /** Položka zakázky (§ 0c) — objednávka může mít zakázek víc. */
  line_title?: string | null;
  line_variant_title?: string | null;
  line_thumbnail?: string | null;
};

const formatDateTime = (value: string | null | undefined): string =>
  value
    ? new Intl.DateTimeFormat("cs-CZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Prague",
      }).format(new Date(value))
    : "";

type ProductionResponse = {
  production_order?: ProductionOrder | null;
  /** Všechny zakázky objednávky — jedna na zakázkovou položku (§ 0c). */
  production_orders?: ProductionOrder[];
};

type ProductionAction =
  | "confirm_specification"
  | "adjust_surcharge"
  | "notify_surcharge"
  | "start_production"
  | "complete_production"
  | "request_balance"
  | "remind_balance"
  | "cancel";

const queryClient = adminQueryClient;

const toNum = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    return Number(v.value ?? v.numeric_ ?? v.raw_ ?? 0) || 0;
  }
  return 0;
};

const MadeToOrderOrderWidgetInner = ({
  order,
}: {
  order: AdminOrder;
}) => {
  const queryClient = useQueryClient();
  const productionQuery = useQuery<ProductionResponse>({
    queryKey: ["made-to-order-order", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${order.id}`, {
        method: "GET",
      }),
    retry: false,
  });
  const productionOrder = productionQuery.data?.production_order;
  const commissions = productionQuery.data?.production_orders ??
    (productionOrder ? [productionOrder] : []);

  const [editingSurcharge, setEditingSurcharge] = useState(false);
  const [surchargeDraft, setSurchargeDraft] = useState("");
  const [notifyingSurcharge, setNotifyingSurcharge] = useState(false);
  const [surchargeReason, setSurchargeReason] = useState("");

  const runAction = useMutation({
    mutationFn: (payload: {
      action: ProductionAction;
      surcharge?: number;
      reason?: string;
    }) =>
      sdk.client.fetch(`/admin/made-to-order/orders/${order.id}/actions`, {
        method: "POST",
        // Widget ukazuje (a ovládá) první zakázku objednávky; bez id by server
        // u objednávky s víc zakázkami akci odmítl (§ 0c).
        body: { ...payload, production_order_id: productionOrder?.id },
      }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["made-to-order-order", order.id],
      });
      // Denní práce u čisté zakázky ukazuje fázi výroby — ať nezůstane pozadu.
      await queryClient.invalidateQueries({
        queryKey: ["merchant-order-state", order.id],
      });
      setEditingSurcharge(false);
      if (variables.action === "notify_surcharge") {
        setNotifyingSurcharge(false);
        setSurchargeReason("");
      }
      const message =
        variables.action === "request_balance"
          ? "Výzva k doplacení odeslána zákazníkovi e-mailem"
          : variables.action === "remind_balance"
            ? "Připomínka doplatku odeslána e-mailem"
            : variables.action === "notify_surcharge"
              ? "Potvrzení příplatku odesláno zákazníkovi e-mailem"
              : "Zakázka byla aktualizována";
      toast.success(message);

      // Výzva k doplacení zakládá NATIVNÍ platební kolekci objednávky
      // (createOrderPaymentCollectionWorkflow). Tenhle widget se obnoví sám,
      // ale nativní části detailu — Aktivita, Souhrn plateb, stav v záhlaví —
      // běží na vlastním query klientu Medusy, který náš invalidate nevidí,
      // takže by zůstaly viset na staré částce. Po zobrazení hlášky proto
      // stránku načteme znovu, ať objednávka sedí celá.
      if (variables.action === "request_balance") {
        setTimeout(() => window.location.reload(), 1200);
      }
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Akci se nepodařilo dokončit")
      ),
  });

  const payments = useMemo(
    () =>
      Array.isArray(productionOrder?.payment_requests)
        ? productionOrder.payment_requests
        : [],
    [productionOrder]
  );

  if (productionQuery.isLoading) {
    return (
      <Container>
        <Skeleton className="h-36 rounded-lg" />
      </Container>
    );
  }

  if (productionQuery.isError || !productionOrder) return null;

  // U čisté zakázky je „další krok výroby" tlačítkem v Denní práci — tady by
  // byl druhý, stejný. Smíšená objednávka ho má dál tady.
  const pureCommission = Boolean(productionOrder.pure_commission);
  const nextAction = pureCommission ? undefined : actionForStage[productionOrder.stage];
  // Cena po domluvě: potvrzení zadání až po poslané ceně, výroba až po záloze.
  const nextActionBlocked =
    nextAction?.action === "start_production"
      ? agreedPriceStartBlock(productionOrder)
      : nextAction?.action === "confirm_specification"
        ? agreedPriceConfirmBlock(productionOrder)
        : null;
  const agreedPriceCommissions = commissions.filter(
    (commission) => commission.price_on_request
  );
  const priceNotSentYet =
    Boolean(productionOrder.price_on_request) &&
    toNum(productionOrder.agreed_total) <= 0.005;
  const stepInDailyWork = pureCommission && Boolean(actionForStage[productionOrder.stage]);
  const basePrice = toNum(
    productionOrder.agreed_total ?? productionOrder.original_total
  );
  const surcharge = toNum(productionOrder.surcharge);
  const currency = productionOrder.currency_code;

  // Doplatek: tlačítko „Poslat výzvu k doplacení" se ukáže vždy, když něco
  // zbývá doplatit a zakázka ještě běží. Když už výzva běží (pending/sent),
  // nabídne se připomínka + odkaz, který zákazník dostal.
  const outstanding = toNum(productionOrder.outstanding_amount);
  const settled =
    outstanding <= 0.005 &&
    ["ready_to_ship", "completed", "cancelled"].includes(productionOrder.stage);
  const openBalance = payments.find(
    (payment) =>
      payment.type === "balance" &&
      (payment.status === "pending" || payment.status === "sent")
  );
  // Cena po domluvě před výrobou: platební odkazy (záloha / celé) nese e-mail
  // „Domluvená cena" — druhá výzva k doplacení celé částky by zákazníka mátla.
  const canRequestBalance =
    outstanding > 0.005 &&
    !(
      productionOrder.price_on_request &&
      ["specification_pending", "confirmed"].includes(productionOrder.stage)
    ) &&
    !["ready_to_ship", "completed", "cancelled"].includes(
      productionOrder.stage
    );

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-x-2">
            <Heading level="h2">Výroba na zakázku</Heading>
            <Badge color={stageMeta[productionOrder.stage].color}>
              {stageMeta[productionOrder.stage].label}
            </Badge>
            {productionOrder.price_on_request && (
              <Badge color="purple">Cena po domluvě</Badge>
            )}
          </div>
          {commissions.length > 1 && productionOrder.line_title && (
            <Text size="small" weight="plus" className="mt-1">
              {productionOrder.line_title} (zakázka 1 z {commissions.length})
            </Text>
          )}
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Smluvní záloha{" "}
            {productionOrder.deposit_amount !== null &&
            productionOrder.deposit_amount !== undefined
              ? `${formatAmount(toNum(productionOrder.deposit_amount), currency)} (${
                  productionOrder.deposit_percentage
                } %)`
              : `${productionOrder.deposit_percentage} %`}{" "}
            · cena{" "}
            {priceNotSentYet
              ? "po domluvě (zatím neodeslaná)"
              : formatAmount(basePrice, currency)}
            {surcharge > 0
              ? ` + příplatek ${formatAmount(surcharge, currency)}`
              : ""}
          </Text>
          {/* Z3 (LEGAL_AUDIT § 0): zahájení výroby platí od odeslaného e-mailu.
              „Ve výrobě" bez e-mailu je stav, který podle OP nenastal — červeně. */}
          {productionOrder.production_start_notified_at ? (
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              E-mail o zahájení výroby odeslán:{" "}
              {formatDateTime(productionOrder.production_start_notified_at)}
            </Text>
          ) : productionOrder.stage === "in_production" ? (
            <Text size="xsmall" className="text-ui-fg-error mt-1">
              E-mail o zahájení výroby neodeslán — podle obchodních podmínek výroba
              nezačala (záloha je zatím vratná). Klikněte znovu na „Začít výrobu“.
            </Text>
          ) : null}
          {productionOrder.stage === "cancelled" && productionOrder.cancelled_by ? (
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              Zrušení:{" "}
              {productionOrder.cancelled_by === "customer"
                ? "zrušil zákazník"
                : "zrušila prodávající"}
              {productionOrder.cancellation_phase === "after_production"
                ? ", po zahájení výroby"
                : productionOrder.cancellation_phase === "before_production"
                  ? ", před zahájením výroby"
                  : ""}
              {productionOrder.cancellation_refund_amount !== null &&
              productionOrder.cancellation_refund_amount !== undefined
                ? `, vráceno ${formatAmount(
                    toNum(productionOrder.cancellation_refund_amount),
                    currency
                  )}`
                : ""}
              {productionOrder.cancelled_at
                ? ` (${formatDateTime(productionOrder.cancelled_at)})`
                : ""}
            </Text>
          ) : null}
          {/* Z11: PDF „Potvrzení zakázky" — sloupce plní subscriber PDF. */}
          {productionOrder.confirmation_pdf_url ? (
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              <a
                href={productionOrder.confirmation_pdf_url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Potvrzení zakázky (PDF)
              </a>
              {productionOrder.confirmation_sent_at
                ? ` · odesláno ${formatDateTime(productionOrder.confirmation_sent_at)}`
                : " · zatím neodesláno"}
            </Text>
          ) : (
            <Text size="xsmall" className="text-ui-fg-muted mt-1">
              Potvrzení zakázky (PDF): zatím nevygenerováno.
            </Text>
          )}
          {stepInDailyWork && (
            <Text size="xsmall" className="text-ui-fg-muted mt-1">
              Další krok výroby ({actionForStage[productionOrder.stage]?.label})
              je v Denní práci.
            </Text>
          )}
        </div>

        {/* Příplatek (vpravo nahoře) + další krok. Příplatek je vlastní částka
            navíc nad cenu — navýší doplatek, cenu samotnou nemění. */}
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {/* Zaplacená a hotová zakázka — příplatek je zaplacený, není co
              upravovat ani potvrzovat (14. 10. 2026). */}
          {settled ? null : editingSurcharge ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                autoFocus
                className="w-28"
                placeholder="0"
                value={surchargeDraft}
                onChange={(e) => setSurchargeDraft(e.target.value)}
              />
              <Text size="small" className="text-ui-fg-muted">
                Kč
              </Text>
              <Button
                size="small"
                isLoading={runAction.isPending}
                onClick={() =>
                  runAction.mutate({
                    action: "adjust_surcharge",
                    surcharge: Math.max(0, Number(surchargeDraft) || 0),
                  })
                }
              >
                Uložit
              </Button>
              <Button
                size="small"
                variant="secondary"
                onClick={() => setEditingSurcharge(false)}
              >
                Zrušit
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button
                size="small"
                variant="secondary"
                onClick={() => {
                  setSurchargeDraft(surcharge > 0 ? String(surcharge) : "");
                  setEditingSurcharge(true);
                }}
              >
                {surcharge > 0
                  ? `Příplatek ${formatAmount(surcharge, currency)} · upravit`
                  : "+ Přidat příplatek"}
              </Button>

              {/* Potvrdit příplatek zákazníkovi — ruční e-mail s písemným
                  potvrzením příplatku dohodnutého jinou cestou (telefon/e-mail)
                  a novou částkou k doplacení. Ukáže se, jen když příplatek je. */}
              {surcharge > 0 && !notifyingSurcharge && (
                <Button
                  size="small"
                  variant="transparent"
                  onClick={() => setNotifyingSurcharge(true)}
                >
                  Potvrdit příplatek zákazníkovi
                </Button>
              )}

              {surcharge > 0 && notifyingSurcharge && (
                <div className="flex w-64 max-w-full flex-col gap-2">
                  <Textarea
                    rows={2}
                    autoFocus
                    placeholder="Na čem jste se domluvili (telefon/e-mail) — uvidí zákazník (nepovinné)"
                    value={surchargeReason}
                    onChange={(e) => setSurchargeReason(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="small"
                      isLoading={runAction.isPending}
                      onClick={() =>
                        runAction.mutate({
                          action: "notify_surcharge",
                          reason: surchargeReason.trim() || undefined,
                        })
                      }
                    >
                      Potvrdit a odeslat
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => {
                        setNotifyingSurcharge(false);
                        setSurchargeReason("");
                      }}
                    >
                      Zrušit
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {nextAction && (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button
                variant="primary"
                isLoading={runAction.isPending}
                disabled={Boolean(nextActionBlocked)}
                onClick={() => runAction.mutate({ action: nextAction.action })}
              >
                {nextAction.label}
              </Button>
              {nextActionBlocked && (
                <Text size="xsmall" className="text-ui-fg-muted max-w-xs sm:text-right">
                  {nextActionBlocked}
                </Text>
              )}
            </div>
          )}

          {/* Doplatek — pošle zákazníkovi e-mail s platebním odkazem. Vidět
              vždy, když něco zbývá doplatit, ne jen ve fázi „čeká na doplatek". */}
          {canRequestBalance && (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button
                variant={nextAction ? "secondary" : "primary"}
                isLoading={runAction.isPending}
                onClick={() =>
                  runAction.mutate({
                    action: openBalance ? "remind_balance" : "request_balance",
                  })
                }
              >
                {openBalance
                  ? "Poslat připomínku doplatku"
                  : "Poslat výzvu k doplacení"}
              </Button>
              {openBalance?.payment_url && (
                <a
                  href={openBalance.payment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ui-fg-muted text-xs underline"
                >
                  Platební odkaz zákazníka
                </a>
              )}
            </div>
          )}

          {/* Doplatek zaplacený mimo bránu — u pultu při vyzvednutí, převodem.
              Vidět vždy, když něco zbývá (i u ready_to_ship/completed s
              příplatkem a u už vydané objednávky), jen ne u zrušené zakázky.
              Po zápisu se mění nativní stav platby, který náš query klient
              nevidí → reload jako u výzvy k doplacení výš. */}
          {/* Jen u osobního odběru — u zásilky zákazník do ateliéru nepřijde
              (14. 10. 2026). */}
          {productionOrder.personal_pickup &&
            outstanding > 0.005 &&
            productionOrder.stage !== "cancelled" && (
            <SettleBalanceOffline
              orderId={order.id}
              displayId={order.display_id}
              outstanding={outstanding}
              currencyCode={currency}
              variant={canRequestBalance ? "secondary" : "primary"}
              onSettled={() => {
                setTimeout(() => window.location.reload(), 1200);
              }}
            />
          )}
        </div>
      </div>

      {/* Cena po domluvě — blok u KAŽDÉ takové zakázky (položky) zvlášť. */}
      {agreedPriceCommissions.map((commission) => (
        <div key={commission.id} className="px-6 py-5">
          <AgreedPriceBlock
            orderId={order.id}
            commission={commission}
            showItem
            // Odeslání srovná nativní „Nesplacenou částku" objednávky, kterou
            // náš query klient nevidí → jako u výzvy k doplacení stránku obnovíme.
            onSent={() => {
              setTimeout(() => window.location.reload(), 1500);
            }}
          />
        </div>
      ))}

      <div className="grid gap-px bg-ui-border-base sm:grid-cols-4">
        <div className="bg-ui-bg-base px-6 py-4">
          <Text size="xsmall" className="text-ui-fg-muted uppercase">
            Zaplaceno
          </Text>
          <Text size="large" weight="plus" className="mt-1">
            {formatAmount(
              productionOrder.paid_amount ??
                payments
                  .filter((payment) => payment.status === "paid")
                  .reduce((sum, payment) => sum + toNum(payment.amount), 0),
              currency
            )}
          </Text>
        </div>
        <div className="bg-ui-bg-base px-6 py-4">
          <Text size="xsmall" className="text-ui-fg-muted uppercase">
            Zbývá doplatit
          </Text>
          <Text size="large" weight="plus" className="mt-1">
            {formatAmount(productionOrder.outstanding_amount, currency)}
          </Text>
        </div>
        <div className="bg-ui-bg-base px-6 py-4">
          <Text size="xsmall" className="text-ui-fg-muted uppercase">
            Příplatek
          </Text>
          <Text size="large" weight="plus" className="mt-1">
            {formatAmount(surcharge, currency)}
          </Text>
        </div>
        <div className="bg-ui-bg-base px-6 py-4">
          <Text size="xsmall" className="text-ui-fg-muted uppercase">
            Odeslání
          </Text>
          <Text size="small" weight="plus" className="mt-1">
            {productionOrder.can_fulfill
              ? "Povoleno – plně zaplaceno"
              : "Uzamčeno do úplného zaplacení"}
          </Text>
        </div>
      </div>

      <div className="px-6 py-5">
        <Text size="xsmall" className="text-ui-fg-muted uppercase">
          Platby zakázky
        </Text>
        <div className="mt-2 flex flex-col gap-y-2">
          {payments.length ? (
            payments.map((payment) => (
              <div
                key={payment.id}
                className="bg-ui-bg-subtle shadow-borders-base flex items-center justify-between gap-3 rounded-lg px-3 py-2"
              >
                <div>
                  <Text size="small" weight="plus">
                    {payment.type === "deposit" ? "Záloha" : "Doplatek"}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {formatAmount(payment.amount, payment.currency_code)}
                  </Text>
                </div>
                <Badge color={payment.status === "paid" ? "green" : "grey"}>
                  {payment.status === "paid" ? "Zaplaceno" : payment.status}
                </Badge>
              </div>
            ))
          ) : (
            <Text size="small" className="text-ui-fg-muted">
              Zatím nebyla vytvořena žádná platební žádost.
            </Text>
          )}
        </div>
      </div>
    </Container>
  );
};

const MadeToOrderOrderWidget = ({
  data,
}: DetailWidgetProps<AdminOrder>) => (
  <QueryClientProvider client={queryClient}>
    <MadeToOrderOrderWidgetInner order={data} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  zone: "order.details.before",
  id: "keramicka-zahrada:made-to-order",
});

export default MadeToOrderOrderWidget;
