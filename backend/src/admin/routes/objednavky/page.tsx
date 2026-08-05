import { defineRouteConfig } from "@medusajs/admin-sdk";
import { DocumentText } from "@medusajs/icons";
import {
  Badge,
  Container,
  Heading,
  Input,
  Skeleton,
  Text,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
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
];

const OrdersInner = () => {
  const [active, setActive] = useState("vse");
  const [search, setSearch] = useState("");

  const params = new URLSearchParams();
  if (active === "dluzi") {
    params.set("owing", "true");
  } else if (active !== "vse") {
    params.set("stage", active);
  }
  if (search.trim()) {
    params.set("q", search.trim());
  }

  const { data, isLoading, isError } = useQuery<WorkbenchOrdersResponse>({
    queryKey: ["workbench-orders", active, search],
    queryFn: () =>
      sdk.client.fetch(`/admin/workbench/orders?${params.toString()}`),
    refetchOnWindowFocus: true,
  });

  const rows = data?.orders ?? [];

  return (
    <Container className="divide-y p-0">
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Objednávky — pracovní přehled</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Každá objednávka s penězi, stavem výroby i dopravou vedle sebe.
            Běžný den zvládnete v Přehledu → Denní práce; sem se chodí, když
            je potřeba vidět všechno najednou.
          </Text>
        </div>
        <Input
          size="small"
          type="search"
          placeholder="Hledat e-mail, jméno nebo číslo…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-64"
        />
      </header>

      <SubTabs tabs={filterTabs} active={active} onSelect={setActive} />

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {isError && (
        <EmptyState
          title="Objednávky se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title="Nic tu není"
          description="Žádná objednávka neodpovídá zvolenému filtru."
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="divide-y">
          {rows.map((order) => {
            const unpaid = order.total - order.paid > 0.009;

            return (
              <article
                key={order.id}
                className="grid gap-3 px-6 py-4 lg:grid-cols-[110px_minmax(0,1.3fr)_170px_190px_minmax(0,1fr)_auto] lg:items-center"
              >
                <div>
                  <Text size="small" weight="plus">
                    #{order.display_id}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                    {formatDateTime(order.created_at)}
                  </Text>
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
                  <Link
                    to={`/orders/${order.id}`}
                    className="text-ui-fg-interactive txt-small hover:underline"
                  >
                    Detail
                  </Link>
                  {order.stage && (
                    <Link
                      to="/prehled/prace"
                      className="text-ui-fg-interactive txt-small hover:underline"
                    >
                      Zpracovat
                    </Link>
                  )}
                </div>
              </article>
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
