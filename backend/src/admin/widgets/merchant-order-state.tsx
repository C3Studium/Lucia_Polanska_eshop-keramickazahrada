import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { Badge, Button, Container, Heading, Skeleton, Text, toast } from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  nextStage,
  nextStageLabel,
  stageMeta,
  type MerchantOrder,
  type MerchantOrderStage,
} from "../components/merchant-order-queue";
import { sdk } from "../lib/sdk";
import { adminQueryClient } from "../lib/query-client"
import { ceskaChyba } from "../lib/ceska-chyba";
import {
  agreedPriceConfirmBlock,
  agreedPriceStartBlock,
  type AgreedPriceCommission,
} from "../components/agreed-price";
import {
  isProductionPhase,
  productionStageMeta,
  productionStep,
  type ProductionStage,
  type ProductionStepAction,
} from "../lib/production-stage";

const queryClient = adminQueryClient;

type MerchantOrderDetailResponse = {
  merchant_order: MerchantOrder | null;
};

/** Sdílený dotaz s widgetem „Výroba na zakázku" (stejný klíč = jedna odpověď). */
type ProductionResponse = {
  production_order?: (AgreedPriceCommission & {
    stage: ProductionStage;
    pure_commission?: boolean;
    outstanding_amount?: number | string;
  }) | null;
};

const stepSuccess: Record<ProductionStepAction, string> = {
  confirm_specification: "Zadání potvrzeno",
  start_production: "Výroba začala",
  complete_production: "Výroba označena jako dokončená",
};

/**
 * Shows the Denní práce state on the native order page, with the *same* single action the
 * queue offers.
 *
 * This is the answer to the two views disagreeing. Rather than duplicating the native
 * order screen inside Denní práce, the merchant-specific bit is injected into the native
 * screen — so there is one order page, and the next step is visible wherever the merchant
 * arrives from. The button posts to the same endpoint and therefore runs the same
 * workflows, including the full native fulfilment flow for "Odesláno".
 */
const MerchantOrderStateWidgetInner = ({ order }: { order: AdminOrder }) => {
  const cache = useQueryClient();
  const stateQuery = useQuery<MerchantOrderDetailResponse>({
    queryKey: ["merchant-order-state", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}`, { method: "GET" }),
    retry: false,
  });

  const merchantOrder = stateQuery.data?.merchant_order ?? null;

  const productionQuery = useQuery<ProductionResponse>({
    queryKey: ["made-to-order-order", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${order.id}`, { method: "GET" }),
    retry: false,
    enabled: Boolean(merchantOrder?.is_made_to_order),
  });
  const production = productionQuery.data?.production_order ?? null;

  /*
   * Čistá zakázka ve výrobě: Denní práce ovládá výrobu (Potvrdit zadání →
   * Začít výrobu → Výroba dokončena). Smíšená objednávka nebo zakázka už
   * hotová a zaplacená jede běžným postupem balení a odeslání.
   */
  const productionMode = Boolean(
    production?.pure_commission && isProductionPhase(production.stage)
  );

  const step = useMutation({
    mutationFn: (action: ProductionStepAction) =>
      sdk.client.fetch(`/admin/made-to-order/orders/${order.id}/actions`, {
        method: "POST",
        body: { action },
      }),
    onSuccess: async (_data, action) => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["made-to-order-order", order.id] }),
        cache.invalidateQueries({ queryKey: ["merchant-order-state", order.id] }),
        cache.invalidateQueries({ queryKey: ["merchant-orders"] }),
        cache.invalidateQueries({ queryKey: ["production-orders"] }),
      ]);
      toast.success(stepSuccess[action]);
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Krok výroby se nepodařilo uložit")),
  });

  const transition = useMutation({
    mutationFn: (target: MerchantOrderStage) =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}`, {
        method: "PATCH",
        body: { stage: target },
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({
        queryKey: ["merchant-order-state", order.id],
      });
      await cache.invalidateQueries({ queryKey: ["merchant-orders"] });
      toast.success("Stav objednávky byl změněn");
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Stav se nepodařilo změnit")
      ),
  });

  if (stateQuery.isLoading) {
    return (
      <Container>
        <Skeleton className="h-24 rounded-lg" />
      </Container>
    );
  }

  // Orders placed before the module existed have no state row. Rendering nothing is
  // correct here — the native page stays untouched.
  if (stateQuery.isError || !merchantOrder) {
    return null;
  }

  const target = nextStage[merchantOrder.stage];

  if (productionMode && production) {
    const next = productionStep[production.stage];
    const meta = productionStageMeta[production.stage];
    // Cena po domluvě: potvrzení až po poslané ceně, výroba až po záloze
    // (cenu Lucie posílá ve „Výrobě na zakázku" u položky).
    const blocked =
      next?.action === "start_production"
        ? agreedPriceStartBlock(production)
        : next?.action === "confirm_specification"
          ? agreedPriceConfirmBlock(production)
          : null;
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between gap-x-2 px-6 py-4">
          <Heading level="h2">Denní práce</Heading>
          <Badge color={meta.color}>{meta.label}</Badge>
        </div>

        <div className="flex flex-col gap-y-3 px-6 py-4">
          {merchantOrder.attention_reason && (
            <Text size="small" className="text-ui-fg-error">
              {merchantOrder.attention_reason}
            </Text>
          )}

          <Text size="small" className="text-ui-fg-subtle">
            {next
              ? `Zakázka na míru — další krok: ${next.label}`
              : "Zakázka je hotová a čeká na doplatek. Výzvu k doplacení pošlete ve Výrobě na zakázku; po zaplacení tu bude Připraveno k odeslání."}
          </Text>

          {next && (
            <Button
              variant="primary"
              size="small"
              isLoading={step.isPending}
              disabled={Boolean(blocked)}
              onClick={() => step.mutate(next.action)}
            >
              {next.label}
            </Button>
          )}
          {next && blocked && (
            <Text size="xsmall" className="text-ui-fg-muted">
              {blocked} Domluvená cena a platby jsou ve „Výrobě na zakázku“.
            </Text>
          )}
        </div>
      </Container>
    );
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-2 px-6 py-4">
        <Heading level="h2">Denní práce</Heading>
        <Badge color={stageMeta[merchantOrder.stage].color}>
          {stageMeta[merchantOrder.stage].label}
        </Badge>
      </div>

      <div className="flex flex-col gap-y-3 px-6 py-4">
        {merchantOrder.attention_reason && (
          <Text size="small" className="text-ui-fg-error">
            {merchantOrder.attention_reason}
          </Text>
        )}

        <Text size="small" className="text-ui-fg-subtle">
          {target
            ? `Další krok: ${nextStageLabel[merchantOrder.stage]}`
            : "Tato objednávka už po vás nic nechce."}
        </Text>

        {target && merchantOrder.stage !== "payment_problem" && (
          <Button
            variant="primary"
            size="small"
            isLoading={transition.isPending}
            onClick={() => transition.mutate(target)}
          >
            {nextStageLabel[merchantOrder.stage]}
          </Button>
        )}
      </div>
    </Container>
  );
};

const MerchantOrderStateWidget = ({ data }: DetailWidgetProps<AdminOrder>) => (
  <QueryClientProvider client={queryClient}>
    <MerchantOrderStateWidgetInner order={data} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
  id: "keramicka-zahrada:merchant-order-state",
});

export default MerchantOrderStateWidget;
