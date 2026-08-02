import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ListCheckbox } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  Skeleton,
  Text,
  toast,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { sdk } from "../../lib/sdk";

type MerchantOrderStage =
  | "received"
  | "working"
  | "shipping"
  | "shipped"
  | "payment_problem"
  | "cancelled";

type MerchantOrder = {
  id?: string;
  order_id: string;
  display_id?: number | string;
  stage: MerchantOrderStage;
  requires_attention?: boolean;
  attention_reason?: string | null;
  internal_note?: string | null;
  created_at?: string;
  customer_name?: string | null;
  email?: string | null;
  total?: number | string;
  currency_code?: string;
  item_count?: number;
  shipping_method?: string | null;
  payment_status?: string | null;
  is_made_to_order?: boolean;
  production_stage?: string | null;
  next_action?: string | null;
};

type MerchantOrdersResponse = {
  orders: Array<
    MerchantOrder & {
      order?: {
        id: string;
        display_id?: number | string;
        created_at?: string;
        email?: string | null;
        currency_code?: string;
        total?: number | string;
        payment_status?: string | null;
        items?: Array<{ quantity?: number | string; metadata?: unknown }>;
        shipping_methods?: Array<{ name?: string | null; title?: string | null }>;
        production_order?: { stage?: string | null } | null;
      } | null;
    }
  >;
  count?: number;
  counts?: Partial<Record<MerchantOrderStage, number>>;
  summary?: Partial<Record<MerchantOrderStage, number>>;
};

const queryClient = new QueryClient();

const stageMeta: Record<
  MerchantOrderStage,
  { label: string; color: "blue" | "orange" | "green" | "red" | "grey" }
> = {
  received: { label: "Nové", color: "blue" },
  working: { label: "Připravujeme", color: "orange" },
  shipping: { label: "K odeslání", color: "orange" },
  shipped: { label: "Odesláno", color: "green" },
  payment_problem: { label: "Problém s platbou", color: "red" },
  cancelled: { label: "Zrušeno", color: "grey" },
};

const activeStages: MerchantOrderStage[] = [
  "received",
  "working",
  "shipping",
  "shipped",
  "payment_problem",
];

const nextStage: Partial<Record<MerchantOrderStage, MerchantOrderStage>> = {
  received: "working",
  working: "shipping",
  shipping: "shipped",
};

const nextStageLabel: Partial<Record<MerchantOrderStage, string>> = {
  received: "Začít připravovat",
  working: "Připraveno k odeslání",
  shipping: "Označit jako odeslané",
};

const formatAmount = (amount?: number | string, currencyCode = "CZK") => {
  if (amount === undefined || amount === null || amount === "") return "—";
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return String(amount);
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(numericAmount);
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getOrderHref = (orderId: string) => {
  if (typeof window === "undefined") return `/app/orders/${orderId}`;
  const marker = "/merchant-orders";
  const markerIndex = window.location.pathname.indexOf(marker);
  const adminBase =
    markerIndex >= 0 ? window.location.pathname.slice(0, markerIndex) : "/app";
  return `${adminBase}/orders/${orderId}`;
};

const OrderRow = ({ order }: { order: MerchantOrder }) => {
  const queryClient = useQueryClient();
  const transition = useMutation({
    mutationFn: (stage: MerchantOrderStage) =>
      sdk.client.fetch(`/admin/merchant-orders/${order.order_id}`, {
        method: "PATCH",
        body: { stage },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
      toast.success("Stav objednávky byl změněn");
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Stav se nepodařilo změnit";
      toast.error(message);
    },
  });
  const targetStage = nextStage[order.stage];

  return (
    <article className="bg-ui-bg-base grid gap-4 px-6 py-5 lg:grid-cols-[150px_minmax(0,1.3fr)_minmax(0,1fr)_160px_auto] lg:items-center">
      <div>
        <Text size="xsmall" className="text-ui-fg-muted uppercase">
          Objednávka
        </Text>
        <Heading level="h2" className="mt-1">
          #{order.display_id ?? order.order_id.slice(-6)}
        </Heading>
        <Text size="xsmall" className="text-ui-fg-muted mt-1">
          {formatDate(order.created_at)}
        </Text>
      </div>

      <div className="min-w-0">
        <Text size="small" weight="plus" className="truncate">
          {order.customer_name || order.email || "Zákazník bez jména"}
        </Text>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          {order.item_count ?? 0} položek · {order.shipping_method || "Doprava není zvolena"}
        </Text>
        {order.is_made_to_order && (
          <Badge color="purple" className="mt-2">
            Zakázková výroba
            {order.production_stage ? ` · ${order.production_stage}` : ""}
          </Badge>
        )}
      </div>

      <div>
        <Badge color={stageMeta[order.stage].color}>
          {stageMeta[order.stage].label}
        </Badge>
        <Text size="small" className="text-ui-fg-subtle mt-2">
          {order.next_action ||
            (targetStage
              ? `Další krok: ${nextStageLabel[order.stage]}`
              : "Bez dalšího kroku")}
        </Text>
        {(order.requires_attention || order.attention_reason) && (
          <Text size="small" className="text-ui-fg-error mt-1">
            {order.attention_reason || "Objednávka vyžaduje kontrolu"}
          </Text>
        )}
      </div>

      <div>
        <Text size="xsmall" className="text-ui-fg-muted uppercase">
          Celkem
        </Text>
        <Text size="large" weight="plus" className="mt-1">
          {formatAmount(order.total, order.currency_code)}
        </Text>
        <Text size="xsmall" className="text-ui-fg-muted mt-1">
          {order.payment_status || "Stav platby neznámý"}
        </Text>
      </div>

      <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
        <Button variant="secondary" size="small" asChild>
          <a href={getOrderHref(order.order_id)}>Otevřít objednávku</a>
        </Button>
        {targetStage && order.stage !== "payment_problem" && (
          <Button
            variant="primary"
            size="small"
            isLoading={transition.isPending}
            onClick={() => transition.mutate(targetStage)}
          >
            {nextStageLabel[order.stage]}
          </Button>
        )}
      </div>
    </article>
  );
};

const MerchantOrdersPageInner = () => {
  const [stage, setStage] = useState<MerchantOrderStage>("received");
  const ordersQuery = useQuery<MerchantOrdersResponse>({
    queryKey: ["merchant-orders", stage],
    queryFn: () =>
      sdk.client.fetch("/admin/merchant-orders", {
        query: { stage, limit: 100, order: "created_at" },
      }),
  });

  const orders = useMemo(
    () => {
      const records = Array.isArray(ordersQuery.data?.orders)
        ? ordersQuery.data.orders
        : [];
      return records.map((record): MerchantOrder => {
        const order = record.order;
        const itemCount = (order?.items || []).reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        );
        return {
          ...record,
          display_id: record.display_id ?? order?.display_id,
          created_at: record.created_at ?? order?.created_at,
          email: record.email ?? order?.email,
          total: record.total ?? order?.total,
          currency_code: record.currency_code ?? order?.currency_code,
          payment_status: record.payment_status ?? order?.payment_status,
          item_count: record.item_count ?? itemCount,
          shipping_method:
            record.shipping_method ||
            order?.shipping_methods?.[0]?.name ||
            order?.shipping_methods?.[0]?.title,
          is_made_to_order:
            record.is_made_to_order ?? Boolean(order?.production_order),
          production_stage:
            record.production_stage ?? order?.production_order?.stage,
        };
      });
    },
    [ordersQuery.data]
  );
  const counts = ordersQuery.data?.counts || ordersQuery.data?.summary;

  return (
    <Container className="divide-y p-0">
      <header className="px-6 py-5">
        <Heading>Denní práce</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
          Jedna objednávka, jeden zřetelný další krok. Technické detaily zůstávají
          v detailu objednávky.
        </Text>
      </header>

      <nav className="flex max-w-full gap-2 overflow-x-auto px-6 py-4" aria-label="Stavy objednávek">
        {activeStages.map((itemStage) => (
          <Button
            key={itemStage}
            variant={stage === itemStage ? "primary" : "secondary"}
            size="small"
            onClick={() => setStage(itemStage)}
            className="shrink-0"
          >
            {stageMeta[itemStage].label}
            {counts?.[itemStage] !== undefined && (
              <span className="ml-1 opacity-70">
                {counts[itemStage]}
              </span>
            )}
          </Button>
        ))}
      </nav>

      <div className="divide-y">
        {ordersQuery.isLoading && (
          <div className="flex flex-col gap-y-2 p-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-lg" />
            ))}
          </div>
        )}

        {ordersQuery.isError && (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
            <Heading level="h2">Objednávky se nepodařilo načíst</Heading>
            <Text size="small" className="text-ui-fg-error mt-1">
              Obnovte stránku a zkuste to znovu.
            </Text>
          </div>
        )}

        {!ordersQuery.isLoading && !ordersQuery.isError && !orders.length && (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
            <Heading level="h2">V tomto kroku nic nečeká</Heading>
            <Text size="small" className="text-ui-fg-muted mt-1">
              Jakmile objednávka vyžaduje akci, objeví se zde.
            </Text>
          </div>
        )}

        {!ordersQuery.isLoading &&
          !ordersQuery.isError &&
          orders.map((order) => <OrderRow key={order.order_id} order={order} />)}
      </div>
    </Container>
  );
};

const MerchantOrdersPage = () => (
  <QueryClientProvider client={queryClient}>
    <MerchantOrdersPageInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Denní práce",
  icon: ListCheckbox,
  nested: "/orders",
  rank: 10,
});

export default MerchantOrdersPage;
