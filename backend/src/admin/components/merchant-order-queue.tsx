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
import { useState } from "react";
import { Link } from "react-router-dom";
import { formatAmount, formatDateTime } from "../lib/format";
import { sdk } from "../lib/sdk";

export type MerchantOrderStage =
  | "received"
  | "working"
  | "shipping"
  | "shipped"
  | "payment_problem"
  | "cancelled";

/** Mirrors `MerchantOrderRow` in `api/admin/merchant-orders/projection.ts`. */
export type MerchantOrder = {
  id?: string;
  order_id: string;
  stage: MerchantOrderStage;
  requires_attention: boolean;
  attention_reason: string | null;
  internal_note: string | null;
  stage_changed_at: string | null;

  display_id: number | string | null;
  created_at: string | null;
  email: string | null;
  customer_name: string | null;
  currency_code: string;
  total: number | string | null;
  item_count: number;
  shipping_method: string | null;

  payment_status: string | null;
  fulfillment_status: string | null;
  has_fulfillment: boolean;

  is_made_to_order: boolean;
  production_stage: string | null;
};

export type MerchantOrdersResponse = {
  /**
   * Rows arrive flat and fully resolved. The browser never recomputes a total or a
   * status — see `api/admin/merchant-orders/projection.ts`.
   */
  orders: MerchantOrder[];
  count?: number;
  summary?: Partial<Record<MerchantOrderStage, number>>;
};

export const stageMeta: Record<
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

/** Sidebar order and route slug for every queue that has its own page. */
export const stageRoutes: Array<{
  stage: MerchantOrderStage;
  slug: string;
  description: string;
}> = [
  {
    stage: "received",
    slug: "nove",
    description: "Zaplacené objednávky, které ještě nikdo nevzal do ruky.",
  },
  {
    stage: "working",
    slug: "pripravujeme",
    description: "Objednávky, na kterých se právě pracuje.",
  },
  {
    stage: "shipping",
    slug: "k-odeslani",
    description: "Zabalené objednávky čekající na předání dopravci.",
  },
  {
    stage: "shipped",
    slug: "odeslano",
    description: "Odeslané objednávky. Nic dalšího po vás nechtějí.",
  },
  {
    stage: "payment_problem",
    slug: "problem-s-platbou",
    description: "Objednávky, u kterých platba neproběhla nebo vyžaduje kontrolu.",
  },
];

/**
 * The single next step for each stage. Exported so the order-detail widget offers the
 * exact same action as the queue — one order, one obvious next action, wherever the
 * merchant happens to be looking.
 */
export const nextStage: Partial<
  Record<MerchantOrderStage, MerchantOrderStage>
> = {
  received: "working",
  working: "shipping",
  shipping: "shipped",
};

export const nextStageLabel: Partial<Record<MerchantOrderStage, string>> = {
  received: "Začít připravovat",
  working: "Připraveno k odeslání",
  shipping: "Vytvořit zásilku a odeslat",
};

/**
 * Medusa's native payment statuses, in Czech. The value is always computed server-side by
 * `getLastPaymentStatus()`; this map only translates it for display.
 */
export const paymentStatusMeta: Record<
  string,
  { label: string; color: "green" | "orange" | "red" | "grey" }
> = {
  captured: { label: "Zaplaceno", color: "green" },
  partially_captured: { label: "Zaplaceno částečně", color: "orange" },
  authorized: { label: "Autorizováno", color: "orange" },
  partially_authorized: { label: "Autorizováno částečně", color: "orange" },
  awaiting: { label: "Čeká na platbu", color: "orange" },
  requires_action: { label: "Vyžaduje zásah", color: "red" },
  not_paid: { label: "Nezaplaceno", color: "red" },
  canceled: { label: "Platba zrušena", color: "grey" },
  refunded: { label: "Vráceno", color: "grey" },
  partially_refunded: { label: "Vráceno částečně", color: "orange" },
};

/** One page of a queue. 50 keeps a page scannable without endless scrolling. */
export const QUEUE_PAGE_SIZE = 50;

export const queueQueryKey = (stage: MerchantOrderStage, page = 0) => [
  "merchant-orders",
  stage,
  page,
];

export const fetchQueue = (stage: MerchantOrderStage, page = 0) =>
  sdk.client.fetch<MerchantOrdersResponse>("/admin/merchant-orders", {
    query: {
      stage,
      limit: QUEUE_PAGE_SIZE,
      offset: page * QUEUE_PAGE_SIZE,
    },
  });

type BackfillStatus = { scanned: number; missing: number; truncated: boolean };

/**
 * „Some older orders are not in the queues" — with the button that fixes it.
 *
 * Orders placed before the merchant-order module existed have no stage row, so
 * they are silently absent from every queue. That is safe but indistinguishable
 * from having no work, which is exactly the ambiguity the queues exist to
 * remove. The banner only appears when something is actually missing.
 */
export const BackfillBanner = () => {
  const queryClient = useQueryClient();

  const status = useQuery<BackfillStatus>({
    queryKey: ["merchant-orders", "backfill-status"],
    queryFn: () => sdk.client.fetch("/admin/merchant-orders/backfill"),
    // The scan walks the order history, and the answer only changes when
    // someone runs the backfill — no reason to repeat it on every visit.
    staleTime: 5 * 60_000,
  });

  const run = useMutation<{ created: number }>({
    mutationFn: () =>
      sdk.client.fetch("/admin/merchant-orders/backfill", { method: "POST" }),
    onSuccess: async (result) => {
      toast.success(
        result.created === 1
          ? "1 objednávka byla doplněna do front"
          : `${result.created} objednávek bylo doplněno do front`
      );
      await queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Objednávky se nepodařilo doplnit"
      );
    },
  });

  if (!status.data?.missing) {
    return null;
  }

  return (
    <div className="bg-ui-bg-subtle flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <div>
        <Text size="small" weight="plus">
          {status.data.missing === 1
            ? "1 starší objednávka není ve frontách"
            : `${status.data.missing} starších objednávek není ve frontách`}
        </Text>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Jsou to objednávky z doby před zavedením Denní práce. Načtením je
          zařadíme do správného kroku.
        </Text>
      </div>
      <Button
        size="small"
        variant="secondary"
        isLoading={run.isPending}
        onClick={() => run.mutate()}
      >
        Načíst
      </Button>
    </div>
  );
};

/**
 * The one order card. Přehled's „Na řadě" list renders the same component, so a
 * card cannot start looking or behaving differently depending on which page it
 * is on — including which action it offers.
 */
export const OrderRow = ({
  order,
  stage,
}: {
  order: MerchantOrder;
  stage: MerchantOrderStage;
}) => {
  const queryClient = useQueryClient();
  const transition = useMutation({
    mutationFn: (target: MerchantOrderStage) =>
      sdk.client.fetch(`/admin/merchant-orders/${order.order_id}`, {
        method: "PATCH",
        body: { stage: target },
      }),
    onSuccess: async () => {
      // Every queue's count changes when an order moves, so refresh them all.
      await queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
      toast.success(
        stage === "shipping"
          ? "Zásilka byla vytvořena a objednávka označena jako odeslaná"
          : "Stav objednávky byl změněn"
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Stav se nepodařilo změnit"
      );
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
          {formatDateTime(order.created_at)}
        </Text>
      </div>

      <div className="min-w-0">
        <Text size="small" weight="plus" className="truncate">
          {order.customer_name || order.email || "Zákazník bez jména"}
        </Text>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          {order.item_count} položek ·{" "}
          {order.shipping_method || "Doprava není zvolena"}
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
          {targetStage
            ? `Další krok: ${nextStageLabel[order.stage]}`
            : "Bez dalšího kroku"}
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
        <div className="mt-1">
          {order.payment_status ? (
            <Badge
              size="2xsmall"
              color={paymentStatusMeta[order.payment_status]?.color ?? "grey"}
            >
              {paymentStatusMeta[order.payment_status]?.label ??
                order.payment_status}
            </Badge>
          ) : (
            <Text size="xsmall" className="text-ui-fg-muted">
              Stav platby neznámý
            </Text>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
        {/*
          `Link` keeps this inside the dashboard's router, so opening an order is an
          instant client-side transition rather than a full page reload.
        */}
        <Button variant="secondary" size="small" asChild>
          <Link to={`/orders/${order.order_id}`}>Otevřít objednávku</Link>
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

const QueueInner = ({
  stage,
  description,
}: {
  stage: MerchantOrderStage;
  description: string;
}) => {
  const [page, setPage] = useState(0);

  const ordersQuery = useQuery<MerchantOrdersResponse>({
    queryKey: queueQueryKey(stage, page),
    queryFn: () => fetchQueue(stage, page),
    // Two people can work the same shop, and an order also moves on its own
    // (a payment lands, a fulfilment is created on the native page). A stale
    // queue would send her to pack something that is already packed.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    // Keeping the previous page mounted stops the list collapsing to skeletons
    // every time she pages.
    placeholderData: (previous) => previous,
  });
  const orders = ordersQuery.data?.orders ?? [];
  const total = ordersQuery.data?.count ?? orders.length;
  const pageCount = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE));
  const firstOnPage = total === 0 ? 0 : page * QUEUE_PAGE_SIZE + 1;
  const lastOnPage = Math.min(total, page * QUEUE_PAGE_SIZE + orders.length);

  return (
    <Container className="divide-y p-0">
      <header className="px-6 py-5">
        <Heading>
          {stageMeta[stage].label}
          {total > 0 ? ` (${total})` : ""}
        </Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
          {description}
        </Text>
      </header>

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
          orders.map((order) => (
            <OrderRow key={order.order_id} order={order} stage={stage} />
          ))}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            {firstOnPage}–{lastOnPage} z {total}
          </Text>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={page === 0 || ordersQuery.isFetching}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Předchozí
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={page >= pageCount - 1 || ordersQuery.isFetching}
              onClick={() =>
                setPage((current) => Math.min(pageCount - 1, current + 1))
              }
            >
              Další
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
};

/**
 * Each stage is its own admin route, so this component is mounted once per page with a
 * fixed stage. The stage is never a client-side filter over a shared list — the queue a
 * merchant is looking at is addressable, bookmarkable and refresh-safe.
 *
 * Its own `QueryClientProvider` is required: admin extensions are mounted outside the
 * dashboard's provider tree, and `@tanstack/react-query` is an external in the build so
 * there is exactly one copy of the library.
 */
const queryClient = new QueryClient();

export const MerchantOrderQueue = ({
  stage,
  description,
}: {
  stage: MerchantOrderStage;
  description: string;
}) => (
  <QueryClientProvider client={queryClient}>
    <QueueInner stage={stage} description={description} />
  </QueryClientProvider>
);

export { queryClient as merchantOrderQueryClient };
