import type { AdminOrder } from "@medusajs/framework/types";
import { Badge, Button, Container, Heading, Skeleton, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  nextStage,
  nextStageLabel,
  stageMeta,
  stageRoutes,
  type MerchantOrder,
  type MerchantOrderStage,
} from "./merchant-order-queue";
import { sdk } from "../lib/sdk";

type MerchantOrderDetailResponse = {
  merchant_order: MerchantOrder | null;
};

const slugForStage = (stage: MerchantOrderStage) =>
  stageRoutes.find((entry) => entry.stage === stage)?.slug;

/**
 * „Denní práce" na detailu objednávky — stav + jediná akce (stejná jako fronta).
 *
 * Vytaženo z widgetu do komponenty, aby šlo vykreslit vedle Faktury v jednom
 * widgetu (`order-production-topbar`). QueryClientProvider dodává ten widget.
 */
export const MerchantStatePanel = ({ order }: { order: AdminOrder }) => {
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

export default MerchantStatePanel;
