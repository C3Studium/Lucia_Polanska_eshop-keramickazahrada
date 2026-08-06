import { defineRouteConfig } from "@medusajs/admin-sdk";
import { DocumentText } from "@medusajs/icons";
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Select,
  Skeleton,
  Text,
  Toaster,
  toast,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { CopyId, ExpertToggle, RawData, useExpertMode } from "../../lib/expert-mode";
import { ProductionDiary } from "../../components/production-diary";
import { SubTabs } from "../../components/work-tabs";
import {
  formatCzk,
  stageColors,
  stageLabels,
} from "../../lib/workbench";
import { formatDateTime } from "../../lib/format";
import { sdk } from "../../lib/sdk";

/**
 * Objednávky — the advanced order worklist (admin-advanced-plan.md).
 *
 * Přehled → Denní práce is the standard speed: the orders inside the
 * merchant workflow, one stage at a time, with one next action each. This
 * page is the escalation: *every* order, with the three systems that each
 * hold a third of the truth joined into one row — Medusa's order (money
 * asked), payments (money received, captured-minus-refunded, the same
 * quantity the ship gate checks), and the production module (stage, balance
 * owed).
 *
 * It links out rather than duplicating actions: the native order detail for
 * edits and refunds, Denní práce for the stage workflow. Two places that can
 * move an order is one too many.
 */

type WorkbenchOrder = {
  raw?: unknown;
  id: string;
  display_id: number | string;
  created_at: string;
  email: string | null;
  customer_name: string | null;
  currency_code: string;
  total: number;
  captured: number;
  refunded: number;
  paid: number;
  items_count: number;
  stage: string | null;
  stage_changed_at: string | null;
  made_to_order: boolean;
  production_stage: string | null;
  outstanding: number;
  is_personal_pickup: boolean;
  shipped: boolean;
  delivered: boolean;
};

type WorkbenchOrdersResponse = {
  orders: WorkbenchOrder[];
  count: number;
};

const filterTabs = [
  { key: "vse", label: "Vše" },
  { key: "received", label: "Nové" },
  { key: "working", label: "Připravujeme" },
  { key: "shipping", label: "K odeslání" },
  { key: "payment_problem", label: "Problém s platbou" },
  { key: "dluzi", label: "Čeká na doplatek" },
  { key: "statistiky", label: "Statistiky" },
];

/** Objednávky+ → Statistiky: 12 months, AOV, providers, lead time, refunds. */
const OrderStats = () => {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["workbench-order-statistics"],
    queryFn: () => sdk.client.fetch("/admin/workbench/orders/statistics"),
    refetchOnWindowFocus: true,
  });
  if (isLoading || !data) {
    return (
      <div className="px-6 py-5">
        <Skeleton className="h-24 rounded-lg" />
      </div>
    );
  }
  const maxRevenue = Math.max(1, ...data.months.map((m: any) => m.revenue));
  return (
    <div className="flex flex-col gap-y-5 px-6 py-5">
      <div>
        <Text size="small" weight="plus">
          Posledních 12 měsíců: {data.orders_365d} objednávek ·{" "}
          {formatCzk(data.revenue_365d)}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
          Průměrná objednávka {formatCzk(data.average_order ?? 0)}
          {data.pickup_share !== null
            ? ` · osobní odběr ${data.pickup_share} %`
            : ""}
          {data.lead_time_days_median !== null
            ? ` · od přijetí k odeslání obvykle ${data.lead_time_days_median} dní (z ${data.lead_times_measured} měřených)`
            : ""}
          {data.refunded_365d > 0
            ? ` · vráceno ${formatCzk(data.refunded_365d)}`
            : ""}
        </Text>
      </div>
      <div className="flex items-end gap-1.5" aria-hidden="true">
        {data.months.map((entry: any) => (
          <div key={entry.month} className="flex flex-col items-center gap-1">
            <div
              className="bg-ui-fg-interactive w-6 rounded-sm"
              style={{
                height: `${8 + (entry.revenue / maxRevenue) * 56}px`,
                opacity: entry.revenue ? 1 : 0.25,
              }}
              title={`${entry.month}: ${entry.orders} obj., ${entry.revenue}`}
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              {entry.orders}
            </Text>
          </div>
        ))}
      </div>
      <div>
        <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
          Jak zákazníci platí
        </Text>
        {data.payment_providers.map((provider: any) => (
          <Text key={provider.provider} size="small" className="mt-1">
            {provider.count}× {provider.provider}
          </Text>
        ))}
      </div>
    </div>
  );
};

/**
 * The legal batch moves. `cancelled` is deliberately not offered in bulk —
 * cancelling is a decision about one order, not a firing-day sweep.
 */
const batchTargets = [
  { value: "working", label: "Připravujeme" },
  { value: "shipping", label: "K odeslání" },
  { value: "shipped", label: "Odesláno" },
] as const;

type OrderDetail = {
  customer: {
    id: string | null;
    email: string | null;
    previous_orders: number;
    history: {
      id: string;
      display_id: number | string;
      created_at: string;
      total: number;
      stage: string | null;
    }[];
  };
  shipping: {
    name: string | null;
    address: string | null;
    method: string | null;
  };
  items: {
    id: string;
    title: string;
    variant_title: string | null;
    thumbnail: string | null;
    quantity: number;
    unit_price: number;
    total: number;
    specification: string | null;
  }[];
  ledger: {
    id: string;
    provider_id: string;
    amount: number;
    created_at: string;
    captured_at: string | null;
    refunded: number;
  }[];
  timeline: {
    from: string | null;
    to: string;
    at: string;
    by: string | null;
    note: string | null;
    reconciled: boolean;
  }[];
  emails: { template: string; status: string; created_at: string }[];
  internal_note: string | null;
};

/**
 * Podací lístek — one click per parcel. A mixed order offers the split:
 * stock items ship now, the zakázka ships when the kiln says so. Without ČP
 * credentials the route answers with the honest reason; the buttons exist
 * today so the day the account arrives nothing changes but the outcome.
 */
const LabelButtons = ({ orderId, madeToOrder }: { orderId: string; madeToOrder: boolean }) => {
  const request = useMutation({
    mutationFn: (parcel: "all" | "stock" | "zakazka") =>
      sdk.client.fetch(
        `/admin/merchant-orders/${orderId}/label${parcel === "all" ? "" : `?parcel=${parcel}`}`
      ) as Promise<{ available: boolean; reason?: string; labels: { url: string }[] }>,
    onSuccess: (result) => {
      if (!result.available || !result.labels?.length) {
        toast.info(result.reason ?? "Lístek zatím není k dispozici.");
        return;
      }
      for (const label of result.labels) {
        window.open(label.url, "_blank", "noreferrer");
      }
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Lístek se nepodařilo vytvořit."),
  });

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        size="small"
        variant="secondary"
        isLoading={request.isPending}
        onClick={() => request.mutate("all")}
      >
        Podací lístek
      </Button>
      {madeToOrder && (
        <>
          <Button size="small" variant="secondary" onClick={() => request.mutate("stock")}>
            Jen skladové zboží
          </Button>
          <Button size="small" variant="secondary" onClick={() => request.mutate("zakazka")}>
            Jen zakázku
          </Button>
        </>
      )}
    </div>
  );
};

/** Row expansion: the ledger, the timeline, the e-mails — the phone-call view. */
const OrderExpansion = ({ orderId, madeToOrder }: { orderId: string; madeToOrder: boolean }) => {
  const { data, isLoading } = useQuery<OrderDetail>({
    queryKey: ["workbench-order", orderId],
    queryFn: () => sdk.client.fetch(`/admin/workbench/orders/${orderId}`),
  });

  if (isLoading) {
    return (
      <div className="px-6 pb-4">
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="bg-ui-bg-subtle px-6 py-4">
      {/* Level 2a — what was ordered and where it goes */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
            Položky
          </Text>
          {data.items.map((item) => (
            <div key={item.id} className="mt-1.5 flex items-start gap-2">
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt=""
                  className="mt-0.5 h-7 w-7 rounded object-cover"
                />
              ) : (
                <div className="bg-ui-bg-component mt-0.5 h-7 w-7 rounded" />
              )}
              <div className="min-w-0">
                <Text size="xsmall">
                  {item.quantity}× {item.title}
                  {item.variant_title ? ` — ${item.variant_title}` : ""}{" "}
                  <span className="text-ui-fg-muted">
                    {formatCzk(item.total)}
                  </span>
                </Text>
                {item.specification && (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Zadání: {item.specification}
                  </Text>
                )}
              </div>
            </div>
          ))}
        </div>

        <div>
          <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
            Zákazník
          </Text>
          <Text size="xsmall" className="mt-1.5">
            {data.customer.previous_orders === 0
              ? "První objednávka u vás."
              : data.customer.previous_orders === 1
                ? "Už u vás jednou nakoupili."
                : `Nakoupili u vás už ${data.customer.previous_orders}×.`}
          </Text>
          {data.customer.history.map((previous) => (
            <Text key={previous.id} size="xsmall" className="text-ui-fg-subtle mt-1">
              #{previous.display_id} · {formatCzk(previous.total)} ·{" "}
              {formatDateTime(previous.created_at)}
              {previous.stage
                ? ` · ${stageLabels[previous.stage] ?? previous.stage}`
                : ""}
            </Text>
          ))}
          {data.shipping.address && (
            <Text size="xsmall" className="text-ui-fg-subtle mt-2">
              Doručení: {data.shipping.name} — {data.shipping.address}
              {data.shipping.method ? ` (${data.shipping.method})` : ""}
            </Text>
          )}
        </div>
      </div>

      {/* Level 2b — money, movement, mail */}
      <div className="border-ui-border-base mt-4 grid gap-4 border-t pt-4 lg:grid-cols-3">
      <div>
        <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
          Platby
        </Text>
        {data.ledger.length === 0 && (
          <Text size="xsmall" className="text-ui-fg-subtle mt-1">
            Zatím žádná platba.
          </Text>
        )}
        {data.ledger.map((payment) => (
          <Text key={payment.id} size="xsmall" className="mt-1">
            {formatCzk(payment.amount)} ·{" "}
            {payment.captured_at
              ? "přijato"
              : "přislíbeno"}
            {payment.refunded > 0
              ? ` · vráceno ${formatCzk(payment.refunded)}`
              : ""}{" "}
            <span className="text-ui-fg-muted">
              {formatDateTime(payment.captured_at ?? payment.created_at)}
            </span>
          </Text>
        ))}
      </div>

      <div>
        <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
          Průběh
        </Text>
        {data.timeline.length === 0 && (
          <Text size="xsmall" className="text-ui-fg-subtle mt-1">
            Zatím beze změn stavu.
          </Text>
        )}
        {data.timeline.map((entry, index) => (
          <Text key={index} size="xsmall" className="mt-1">
            {stageLabels[entry.to] ?? entry.to}
            {entry.reconciled ? " (automaticky)" : ""}{" "}
            <span className="text-ui-fg-muted">{formatDateTime(entry.at)}</span>
            {entry.note ? ` — ${entry.note}` : ""}
          </Text>
        ))}
        {data.internal_note && (
          <Text size="xsmall" className="text-ui-fg-subtle mt-2">
            Poznámka: {data.internal_note}
          </Text>
        )}
      </div>

      <div>
        <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
          E-maily zákazníkovi
        </Text>
        {data.emails.length === 0 && (
          <Text size="xsmall" className="text-ui-fg-subtle mt-1">
            Nic neodešlo.
          </Text>
        )}
        {data.emails.slice(0, 6).map((email, index) => (
          <Text key={index} size="xsmall" className="mt-1">
            {email.template}
            {email.status === "failure" ? " · NEDORUČENO" : ""}{" "}
            <span className="text-ui-fg-muted">
              {formatDateTime(email.created_at)}
            </span>
          </Text>
        ))}
      </div>
      </div>
      <LabelButtons orderId={orderId} madeToOrder={madeToOrder} />
      <RawData data={data} />
    </div>
  );
};

const OrdersInner = () => {
  const [active, setActive] = useState("vse");
  const [search, setSearch] = useState("");
  const expert = useExpertMode();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [batchStage, setBatchStage] = useState<string>("");
  const queryClient = useQueryClient();

  const batchMove = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/workbench/orders/batch-stage`, {
        method: "POST",
        body: { order_ids: [...selected], stage: batchStage },
      }) as Promise<{
        moved: number;
        failed: number;
        results: { order_id: string; ok: boolean; error: string | null }[];
      }>,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["workbench-orders"] });
      setSelected(new Set());
      if (result.failed === 0) {
        toast.success(`Přesunuto ${result.moved} objednávek.`);
      } else {
        // The failures ARE the feature: name each one rather than a count.
        for (const failure of result.results.filter((r) => !r.ok)) {
          toast.error(`Objednávka se nepřesunula: ${failure.error}`);
        }
        if (result.moved > 0) {
          toast.success(`${result.moved} se přesunulo, ${result.failed} ne.`);
        }
      }
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Přesun se nepodařil."
      ),
  });

  const params = new URLSearchParams();
  if (active === "dluzi") {
    params.set("owing", "true");
  } else if (active !== "vse") {
    params.set("stage", active);
  }
  if (search.trim()) {
    params.set("q", search.trim());
  }
  if (expert) {
    params.set("expert", "1");
  }

  const { data, isLoading, isError } = useQuery<WorkbenchOrdersResponse>({
    queryKey: ["workbench-orders", active, search, expert],
    enabled: active !== "statistiky",
    queryFn: () =>
      sdk.client.fetch(`/admin/workbench/orders?${params.toString()}`),
    refetchOnWindowFocus: true,
  });

  const rows = data?.orders ?? [];

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Objednávky — pracovní přehled</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Každá objednávka s penězi, stavem výroby i dopravou vedle sebe.
            Běžný den zvládnete v Přehledu → Denní práce; sem se chodí, když
            je potřeba vidět všechno najednou.
          </Text>
        </div>
        <div className="flex items-center gap-4">
        <ExpertToggle />
        <Input
          size="small"
          type="search"
          placeholder="Hledat e-mail, jméno nebo číslo…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-64"
        />
        </div>
      </header>

      <SubTabs tabs={filterTabs} active={active} onSelect={setActive} />

      {active === "statistiky" && <OrderStats />}

      {active !== "statistiky" && isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {active !== "statistiky" && isError && (
        <EmptyState
          title="Objednávky se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {active !== "statistiky" && !isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title="Nic tu není"
          description="Žádná objednávka neodpovídá zvolenému filtru."
        />
      )}

      {selected.size > 0 && (
        <div className="bg-ui-bg-subtle flex flex-wrap items-center gap-3 px-6 py-3">
          <Text size="small" weight="plus">
            Vybráno: {selected.size}
          </Text>
          <Select
            size="small"
            value={batchStage}
            onValueChange={setBatchStage}
          >
            <Select.Trigger className="w-56">
              <Select.Value placeholder="Přesunout do stavu…" />
            </Select.Trigger>
            <Select.Content>
              {batchTargets.map((target) => (
                <Select.Item key={target.value} value={target.value}>
                  {target.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Button
            size="small"
            disabled={!batchStage}
            isLoading={batchMove.isPending}
            onClick={() => batchMove.mutate()}
          >
            Přesunout
          </Button>
          <Button
            size="small"
            variant="transparent"
            onClick={() => setSelected(new Set())}
          >
            Zrušit výběr
          </Button>
        </div>
      )}

      {active !== "statistiky" && !isLoading && !isError && rows.length > 0 && (
        <div className="divide-y">
          {rows.map((order) => {
            const unpaid = order.total - order.paid > 0.009;

            return (
              <Fragment key={order.id}>
              <article
                className="grid gap-3 px-6 py-4 lg:grid-cols-[110px_minmax(0,1.3fr)_170px_190px_minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selected.has(order.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked) {
                        next.add(order.id);
                      } else {
                        next.delete(order.id);
                      }
                      setSelected(next);
                    }}
                  />
                  <div>
                    <Text size="small" weight="plus">
                      #{order.display_id}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                      {formatDateTime(order.created_at)}
                    </Text>
                    {expert && <CopyId value={order.id} />}
                  </div>
                </div>

                <div className="min-w-0">
                  <Text size="small" className="truncate">
                    {order.customer_name || order.email || "—"}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                    {order.items_count}{" "}
                    {order.items_count === 1
                      ? "položka"
                      : order.items_count <= 4
                        ? "položky"
                        : "položek"}
                    {order.made_to_order ? " · zakázka" : ""}
                    {order.is_personal_pickup ? " · osobní odběr" : ""}
                  </Text>
                </div>

                <div>
                  {order.stage ? (
                    <Badge
                      size="2xsmall"
                      color={stageColors[order.stage] ?? "grey"}
                    >
                      {stageLabels[order.stage] ?? order.stage}
                    </Badge>
                  ) : (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      mimo dílnu
                    </Text>
                  )}
                  {order.shipped && !order.delivered && (
                    <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                      na cestě
                    </Text>
                  )}
                  {order.delivered && (
                    <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                      doručeno
                    </Text>
                  )}
                </div>

                <div>
                  <Text size="small" weight="plus">
                    {formatCzk(order.paid)}{" "}
                    <span className="text-ui-fg-muted font-normal">
                      z {formatCzk(order.total)}
                    </span>
                  </Text>
                  {order.outstanding > 0 && (
                    <Text size="xsmall" className="text-ui-fg-error mt-1">
                      doplatek {formatCzk(order.outstanding)}
                    </Text>
                  )}
                  {order.outstanding <= 0 && unpaid && (
                    <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                      {order.is_personal_pickup
                        ? "zaplatí při vyzvednutí"
                        : "nedoplaceno"}
                    </Text>
                  )}
                </div>

                <div className="min-w-0">
                  {order.refunded > 0 && (
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      vráceno {formatCzk(order.refunded)}
                    </Text>
                  )}
                </div>

                <div className="flex justify-start gap-2 lg:justify-end">
                  <button
                    type="button"
                    className="text-ui-fg-interactive txt-small hover:underline"
                    onClick={() =>
                      setExpanded(expanded === order.id ? null : order.id)
                    }
                  >
                    {expanded === order.id ? "Skrýt" : "Rozbalit"}
                  </button>
                  {order.made_to_order && (
                    <ProductionDiary
                      orderId={order.id}
                      label={`#${order.display_id}`}
                      trigger={
                        <button
                          type="button"
                          className="text-ui-fg-interactive txt-small hover:underline"
                        >
                          Deník
                        </button>
                      }
                    />
                  )}
                  <Link
                    to={`/orders/${order.id}`}
                    className="text-ui-fg-interactive txt-small hover:underline"
                  >
                    Detail
                  </Link>
                </div>
              </article>
              {expanded === order.id && (
                <OrderExpansion orderId={order.id} madeToOrder={order.made_to_order} />
              )}
              </Fragment>
            );
          })}
        </div>
      )}
    </Container>
  );
};

const queryClient = new QueryClient();

const OrdersWorkbenchPage = () => (
  <QueryClientProvider client={queryClient}>
    <OrdersInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Objednávky+",
  icon: DocumentText,
});

export default OrdersWorkbenchPage;
