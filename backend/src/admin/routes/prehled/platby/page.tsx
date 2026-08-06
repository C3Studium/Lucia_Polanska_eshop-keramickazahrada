import { Badge, Container, Heading, Skeleton, Tabs, Text } from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/empty-state";
import { paymentStatusMeta } from "../../../components/merchant-order-queue";
import { WorkTabs } from "../../../components/work-tabs";
import { formatAmount, formatDateTime } from "../../../lib/format";
import { sdk } from "../../../lib/sdk";

type PaymentRow = {
  order_id: string;
  display_id: number | string | null;
  created_at: string;
  customer_name: string | null;
  currency_code: string;
  total: number;
  captured: number;
  refunded: number;
  outstanding: number;
  payment_status: string | null;
  is_problem: boolean;
  provider_id: string | null;
};

type PaymentsResponse = {
  payments: PaymentRow[];
  count: number;
  problem_count: number;
};

/** Provider ids are technical (§17); these are what she should read instead. */
const providerLabels: Record<string, string> = {
  pp_comgate_comgate: "Platební karta / převod",
  pp_system_default: "Ručně označeno",
};

const filters = [
  { key: "problem", label: "Nedoplacené" },
  { key: "authorized", label: "Autorizované (nezaplacené)" },
  { key: "all", label: "Všechny" },
] as const;

type FilterKey = (typeof filters)[number]["key"];

const PlatbyInner = () => {
  const [filter, setFilter] = useState<FilterKey>("problem");

  const { data, isLoading, isError } = useQuery<PaymentsResponse>({
    queryKey: ["operations-payments", filter],
    queryFn: () =>
      sdk.client.fetch("/admin/operations/payments", {
        query: { filter, limit: 50 },
      }),
    refetchOnWindowFocus: true,
  });

  const rows = data?.payments ?? [];

  return (
    <Container className="divide-y p-0">
      <WorkTabs active="platby" />

      <header className="px-6 pb-2 pt-6">
        <Heading>Platby</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Kolik za objednávku dorazilo a kolik případně chybí. Peníze se nikdy
          nevracejí ani nestrhávají odsud — na to je detail objednávky.
        </Text>
      </header>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterKey)}>
        <Tabs.List className="px-6 py-4">
          {filters.map((entry) => (
            <Tabs.Trigger key={entry.key} value={entry.key}>
              {entry.label}
              {entry.key === "problem" && data?.problem_count
                ? ` (${data.problem_count})`
                : ""}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {isError && (
        <EmptyState
          title="Platby se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title={
            filter === "problem"
              ? "Všechno je zaplacené"
              : "Zatím žádné platby"
          }
          description={
            filter === "problem"
              ? "Kdyby u některé objednávky platba nedorazila, uvidíte ji tady."
              : "Jakmile někdo nakoupí, objeví se to tady."
          }
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="divide-y">
          {rows.map((row) => (
            <article
              key={row.order_id}
              className="grid gap-3 px-6 py-4 lg:grid-cols-[140px_minmax(0,1fr)_170px_150px_auto] lg:items-center"
            >
              <div>
                <Text size="small" weight="plus">
                  #{row.display_id}
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted mt-1">
                  {formatDateTime(row.created_at)}
                </Text>
              </div>

              <div className="min-w-0">
                <Text size="small" className="truncate">
                  {row.customer_name ?? "Zákazník"}
                </Text>
                {row.provider_id && (
                  <Text size="xsmall" className="text-ui-fg-muted mt-1">
                    {providerLabels[row.provider_id] ?? "Online platba"}
                  </Text>
                )}
              </div>

              <div>
                <Text size="small">
                  {formatAmount(row.captured, row.currency_code)} z{" "}
                  {formatAmount(row.total, row.currency_code)}
                </Text>
                {row.refunded > 0 && (
                  <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                    vráceno {formatAmount(row.refunded, row.currency_code)}
                  </Text>
                )}
                {row.outstanding > 0 && (
                  <Text size="xsmall" className="text-ui-fg-error mt-1">
                    chybí {formatAmount(row.outstanding, row.currency_code)}
                  </Text>
                )}
              </div>

              <div>
                {row.payment_status && (
                  <Badge
                    size="2xsmall"
                    color={paymentStatusMeta[row.payment_status]?.color ?? "grey"}
                  >
                    {paymentStatusMeta[row.payment_status]?.label ??
                      row.payment_status}
                  </Badge>
                )}
              </div>

              <div className="flex justify-start lg:justify-end">
                <Link
                  to={`/orders/${row.order_id}`}
                  className="text-ui-fg-interactive text-sm"
                >
                  Otevřít objednávku
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </Container>
  );
};

const queryClient = new QueryClient();

/**
 * Platby — money in, and money that did not arrive.
 *
 * Read-only on purpose. Refunds and captures stay on the native order page,
 * where Medusa's own guards and audit trail live; duplicating a „vrátit peníze"
 * button here would be a second way to move money, which §18 exists to prevent.
 */
const PlatbyPage = () => (
  <QueryClientProvider client={queryClient}>
    <PlatbyInner />
  </QueryClientProvider>
);

export default PlatbyPage;
