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
import { formatAmount } from "../lib/format";
import { sdk } from "../lib/sdk";
import { adminQueryClient } from "../lib/query-client"

type ProductionStage =
  | "specification_pending"
  | "confirmed"
  | "in_production"
  | "awaiting_balance"
  | "ready_to_ship"
  | "completed"
  | "cancelled";

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
};

type ProductionResponse = {
  production_order?: ProductionOrder | null;
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

const stageMeta: Record<
  ProductionStage,
  { label: string; color: "blue" | "orange" | "green" | "red" | "grey" }
> = {
  specification_pending: { label: "Čeká na upřesnění", color: "orange" },
  confirmed: { label: "Domluveno", color: "blue" },
  in_production: { label: "Ve výrobě", color: "orange" },
  awaiting_balance: { label: "Čeká na doplatek", color: "orange" },
  ready_to_ship: { label: "Plně zaplaceno", color: "green" },
  completed: { label: "Dokončeno", color: "green" },
  cancelled: { label: "Zrušeno", color: "grey" },
};

const actionForStage: Partial<
  Record<ProductionStage, { action: ProductionAction; label: string }>
> = {
  specification_pending: {
    action: "confirm_specification",
    label: "Potvrdit zadání",
  },
  confirmed: { action: "start_production", label: "Začít výrobu" },
  in_production: { action: "complete_production", label: "Výroba dokončena" },
  // Doplatek NEřeší „další krok" podle fáze — má vlastní tlačítko, které se
  // ukáže vždy, když něco zbývá doplatit (viz balanceAction níž).
};

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
        body: payload,
      }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["made-to-order-order", order.id],
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
        error instanceof Error ? error.message : "Akci se nepodařilo dokončit"
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

  const nextAction = actionForStage[productionOrder.stage];
  const basePrice = toNum(
    productionOrder.agreed_total ?? productionOrder.original_total
  );
  const surcharge = toNum(productionOrder.surcharge);
  const currency = productionOrder.currency_code;

  // Doplatek: tlačítko „Poslat výzvu k doplacení" se ukáže vždy, když něco
  // zbývá doplatit a zakázka ještě běží. Když už výzva běží (pending/sent),
  // nabídne se připomínka + odkaz, který zákazník dostal.
  const outstanding = toNum(productionOrder.outstanding_amount);
  const openBalance = payments.find(
    (payment) =>
      payment.type === "balance" &&
      (payment.status === "pending" || payment.status === "sent")
  );
  const canRequestBalance =
    outstanding > 0.005 &&
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
          </div>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Záloha {productionOrder.deposit_percentage} % · cena{" "}
            {formatAmount(basePrice, currency)}
            {surcharge > 0
              ? ` + příplatek ${formatAmount(surcharge, currency)}`
              : ""}
          </Text>
        </div>

        {/* Příplatek (vpravo nahoře) + další krok. Příplatek je vlastní částka
            navíc nad cenu — navýší doplatek, cenu samotnou nemění. */}
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {editingSurcharge ? (
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
            <Button
              variant="primary"
              isLoading={runAction.isPending}
              onClick={() => runAction.mutate({ action: nextAction.action })}
            >
              {nextAction.label}
            </Button>
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
        </div>
      </div>

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
