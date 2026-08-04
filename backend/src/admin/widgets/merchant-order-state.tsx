import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { Badge, Button, Container, Heading, Skeleton, Text, toast } from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  nextStage,
  nextStageLabel,
  stageMeta,
  stageRoutes,
  type MerchantOrder,
  type MerchantOrderStage,
} from "../components/merchant-order-queue";
import { sdk } from "../lib/sdk";

const queryClient = new QueryClient();

type MerchantOrderDetailResponse = {
  merchant_order: MerchantOrder | null;
};

const slugForStage = (stage: MerchantOrderStage) =>
  stageRoutes.find((entry) => entry.stage === stage)?.slug;

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
        error instanceof Error ? error.message : "Stav se nepodařilo změnit"
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
  const slug = slugForStage(merchantOrder.stage);

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

        {slug && (
          <Button variant="transparent" size="small" asChild>
            <Link to={`/prehled/prace?krok=${slug}`}>
              Zpět do fronty „{stageMeta[merchantOrder.stage].label}"
            </Link>
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
