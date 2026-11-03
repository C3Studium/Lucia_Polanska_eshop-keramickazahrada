import { Badge, Container, Heading, Input, Skeleton, Tabs, Text } from "@medusajs/ui";
import {
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { isPaymentProblem } from "../../../../modules/merchant-order/payment-state";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/empty-state";
import { paymentStatusMeta } from "../../../components/merchant-order-queue";
import { WorkTabs } from "../../../components/work-tabs";
import { formatAmount, formatDateTime } from "../../../lib/format";
import { sdk } from "../../../lib/sdk";
import { adminQueryClient } from "../../../lib/query-client"

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
  /*
   * Osobní odběr. Missing here it fell through to „Online platba", which is the one thing it
   * is not — no gateway is involved, the customer pays in the workshop when they collect.
   * `pp_pickup_pickup` is the pre-rename registration the backend still lists; named too so
   * an older order does not read as a database key.
   */
  "pp_osobni-odber_pickup": "Zaplaceno při vyzvednutí",
  pp_pickup_pickup: "Zaplaceno při vyzvednutí",
};

const filters = [
  { key: "problem", label: "Nedoplacené" },
  { key: "authorized", label: "Autorizované (nezaplacené)" },
  { key: "all", label: "Všechny" },
] as const;

type FilterKey = (typeof filters)[number]["key"];

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    return toNumber(candidate.value ?? candidate.numeric_ ?? 0);
  }
  return 0;
};

/** Pole nativního seznamu objednávek, ze kterých se skládá řádek platby. */
const SEARCH_FIELDS = [
  "id",
  "display_id",
  "created_at",
  "email",
  "currency_code",
  "total",
  "payment_status",
  "customer.first_name",
  "customer.last_name",
  "payment_collections.captured_amount",
  "payment_collections.refunded_amount",
  "payment_collections.payments.provider_id",
].join(",");

/**
 * Řádek platby z nativní objednávky — stejné počty jako
 * `api/admin/operations/payments` (zaplaceno = součet `captured_amount`
 * kolekcí, vráceno = `refunded_amount`, stav = nativní `payment_status`).
 * Hledání jde přes nativní seznam objednávek, protože jen ten umí hledat
 * podle jména a e-mailu v databázi, ne na jedné stránce výsledků.
 */
const toPaymentRow = (order: any): PaymentRow & { is_authorized_unpaid: boolean } => {
  const collections = order.payment_collections ?? [];
  const captured = collections.reduce(
    (sum: number, collection: any) => sum + toNumber(collection?.captured_amount),
    0
  );
  const refunded = collections.reduce(
    (sum: number, collection: any) => sum + toNumber(collection?.refunded_amount),
    0
  );
  const provider = collections
    .flatMap((collection: any) => collection?.payments ?? [])
    .map((payment: any) => payment?.provider_id)
    .find(Boolean);
  const name = [order.customer?.first_name, order.customer?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const total = toNumber(order.total);
  return {
    order_id: order.id,
    display_id: order.display_id,
    created_at: order.created_at,
    customer_name: name || order.email || null,
    currency_code: order.currency_code,
    total,
    captured,
    refunded,
    outstanding: Math.max(0, total - (captured - refunded)),
    payment_status: order.payment_status ?? null,
    is_problem: isPaymentProblem(order.payment_status),
    is_authorized_unpaid:
      captured - refunded <= 0 && String(order.payment_status ?? "") === "authorized",
    provider_id: provider ?? null,
  };
};

const PlatbyInner = () => {
  const [filter, setFilter] = useState<FilterKey>("problem");
  /* Vstup se mění hned; hledá se 350 ms po poslední klávese (jako Objednávky). */
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const hledaCislo = /^#?\d+$/.test(search);
  const searching = hledaCislo || search.length >= 2;

  const { data, isLoading, isError } = useQuery<PaymentsResponse>({
    queryKey: ["operations-payments", filter],
    queryFn: () =>
      sdk.client.fetch("/admin/operations/payments", {
        query: { filter, limit: 50 },
      }),
    refetchOnWindowFocus: true,
    enabled: !searching,
  });

  const searchQuery = useQuery<{ orders: any[] }>({
    queryKey: ["operations-payments", "search", search],
    queryFn: () =>
      sdk.client.fetch("/admin/orders", {
        query: {
          q: search.replace(/^#/, ""),
          fields: SEARCH_FIELDS,
          limit: 100,
          order: "-created_at",
        },
      }),
    enabled: searching,
    placeholderData: (previous) => previous,
  });

  /*
   * Při hledání platí dál záložka (Nedoplacené / Autorizované / Všechny),
   * stejně jako v Objednávkách. Číslo objednávky se porovnává přesně —
   * nativní hledání by k „12" našlo i #112 a e-maily s dvanáctkou.
   */
  const searchRows = (searchQuery.data?.orders ?? [])
    .filter((order) =>
      hledaCislo ? String(order.display_id) === search.replace(/^#/, "") : true
    )
    .map(toPaymentRow)
    .filter((row) =>
      filter === "problem"
        ? row.is_problem
        : filter === "authorized"
          ? row.is_authorized_unpaid
          : true
    );

  const rows = searching ? searchRows : (data?.payments ?? []);
  const loading = searching ? searchQuery.isLoading : isLoading;
  const failed = searching ? searchQuery.isError : isError;

  return (
    <Container className="divide-y p-0">
      <WorkTabs active="platby" />

      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-2 pt-6">
        <div className="min-w-0">
          <Heading>Platby</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Kolik za objednávku dorazilo a kolik případně chybí. Peníze se nikdy
            nevracejí ani nestrhávají odsud — na to je detail objednávky.
          </Text>
        </div>
        <Input
          size="small"
          type="search"
          placeholder="Hledat číslo, jméno nebo e-mail…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-full sm:w-64"
        />
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

      {loading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {failed && (
        <EmptyState
          title="Platby se nepodařilo načíst"
          description="Zkuste stránku obnovit."
        />
      )}

      {!loading && !failed && rows.length === 0 && (
        <EmptyState
          title={
            searching
              ? "Nic nenalezeno"
              : filter === "problem"
                ? "Všechno je zaplacené"
                : "Zatím žádné platby"
          }
          description={
            searching
              ? filter === "all"
                ? "Žádná objednávka neodpovídá hledání. Zkuste číslo objednávky, příjmení nebo e-mail."
                : "V téhle záložce nic takového není — zkuste záložku Všechny."
              : filter === "problem"
                ? "Kdyby u některé objednávky platba nedorazila, uvidíte ji tady."
                : "Jakmile někdo nakoupí, objeví se to tady."
          }
        />
      )}

      {!loading && !failed && rows.length > 0 && (
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

const queryClient = adminQueryClient;

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
