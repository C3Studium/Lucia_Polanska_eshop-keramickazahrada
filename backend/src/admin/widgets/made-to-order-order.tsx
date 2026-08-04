import { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Skeleton,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { formatAmount } from "../lib/format";
import { sdk } from "../lib/sdk";

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
  original_total: number | string;
  currency_code: string;
  customer_note?: string | null;
  internal_note?: string | null;
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
  | "start_production"
  | "complete_production"
  | "request_balance"
  | "cancel";

const queryClient = new QueryClient();

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
    label: "Potvrdit zadání a cenu",
  },
  confirmed: { action: "start_production", label: "Začít výrobu" },
  in_production: { action: "complete_production", label: "Výroba dokončena" },
  awaiting_balance: { action: "request_balance", label: "Požádat o doplatek" },
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
  const [agreedTotal, setAgreedTotal] = useState("");
  const [internalNote, setInternalNote] = useState("");

  useEffect(() => {
    if (!productionOrder) return;
    setAgreedTotal(
      productionOrder.agreed_total !== null &&
        productionOrder.agreed_total !== undefined
        ? String(productionOrder.agreed_total)
        : String(productionOrder.original_total)
    );
    setInternalNote(productionOrder.internal_note || "");
  }, [productionOrder]);

  const runAction = useMutation({
    mutationFn: (action: ProductionAction) =>
      sdk.client.fetch(
        `/admin/made-to-order/orders/${order.id}/actions`,
        {
          method: "POST",
          body: {
            action,
            ...(action === "confirm_specification"
              ? { agreed_total: Number(agreedTotal), internal_note: internalNote }
              : {}),
          },
        }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["made-to-order-order", order.id],
      });
      toast.success("Zakázka byla posunuta do dalšího kroku");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Akci se nepodařilo dokončit"
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
  const confirmedAmount =
    productionOrder.agreed_total ?? productionOrder.original_total;

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
            Záloha {productionOrder.deposit_percentage} % · plná cena{" "}
            {formatAmount(confirmedAmount, productionOrder.currency_code)}
          </Text>
        </div>
        {nextAction && (
          <Button
            variant="primary"
            isLoading={runAction.isPending}
            disabled={
              nextAction.action === "confirm_specification" &&
              (!Number.isFinite(Number(agreedTotal)) || Number(agreedTotal) <= 0)
            }
            onClick={() => runAction.mutate(nextAction.action)}
          >
            {nextAction.label}
          </Button>
        )}
      </div>

      <div className="grid gap-px bg-ui-border-base sm:grid-cols-3">
        <div className="bg-ui-bg-base px-6 py-4">
          <Text size="xsmall" className="text-ui-fg-muted uppercase">
            Zaplaceno
          </Text>
          <Text size="large" weight="plus" className="mt-1">
            {formatAmount(
              productionOrder.paid_amount ??
                payments
                  .filter((payment) => payment.status === "paid")
                  .reduce((sum, payment) => sum + Number(payment.amount), 0),
              productionOrder.currency_code
            )}
          </Text>
        </div>
        <div className="bg-ui-bg-base px-6 py-4">
          <Text size="xsmall" className="text-ui-fg-muted uppercase">
            Zbývá doplatit
          </Text>
          <Text size="large" weight="plus" className="mt-1">
            {formatAmount(
              productionOrder.outstanding_amount,
              productionOrder.currency_code
            )}
          </Text>
        </div>
        <div className="bg-ui-bg-base px-6 py-4">
          <Text size="xsmall" className="text-ui-fg-muted uppercase">
            Odeslání
          </Text>
          <Text size="small" weight="plus" className="mt-1">
            {productionOrder.can_fulfill
              ? "Povoleno – objednávka je plně zaplacena"
              : "Uzamčeno do úplného zaplacení"}
          </Text>
        </div>
      </div>

      {productionOrder.stage === "specification_pending" && (
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor={`mto-agreed-total-${order.id}`}>
              Domluvená celková cena
            </Label>
            <Input
              id={`mto-agreed-total-${order.id}`}
              type="number"
              min={1}
              value={agreedTotal}
              onChange={(event) => setAgreedTotal(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor={`mto-internal-note-${order.id}`}>
              Interní poznámka
            </Label>
            <Textarea
              id={`mto-internal-note-${order.id}`}
              rows={3}
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              placeholder="Co bylo se zákazníkem domluveno…"
            />
          </div>
        </div>
      )}

      <div className="grid gap-5 px-6 py-5 lg:grid-cols-2">
        <div>
          <Text size="xsmall" className="text-ui-fg-muted uppercase">
            Přání zákazníka
          </Text>
          <Text size="small" className="mt-2 whitespace-pre-wrap">
            {productionOrder.customer_note || "Zákazník nepřidal poznámku."}
          </Text>
        </div>
        <div>
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
