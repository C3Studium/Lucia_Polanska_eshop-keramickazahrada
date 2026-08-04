import { Container, Heading, Skeleton, Text, clx } from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../../../components/empty-state";
import { WorkTabs } from "../../../components/work-tabs";
import { formatAmount } from "../../../lib/format";
import { sdk } from "../../../lib/sdk";

type Statistics = {
  period: string;
  truncated: boolean;
  orders: {
    count: number;
    paid_count: number;
    revenue: number;
    currency_code: string;
    average_order_value: number;
  };
  carts: {
    started: number;
    completed: number;
    abandoned: number;
    abandonment_rate: number;
  };
  top_products: Array<{
    product_id: string;
    title: string;
    thumbnail: string | null;
    quantity: number;
    revenue: number;
  }>;
};

const periods = [
  { key: "30d", label: "30 dní" },
  { key: "3m", label: "3 měsíce" },
  { key: "6m", label: "6 měsíců" },
  { key: "1y", label: "Rok" },
  { key: "all", label: "Vše" },
] as const;

const Stat = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="bg-ui-bg-base flex flex-col px-6 py-6">
    <Text size="small" className="text-ui-fg-subtle">
      {label}
    </Text>
    <Heading level="h2" className="mt-2 text-2xl leading-tight">
      {value}
    </Heading>
    {hint && (
      <Text size="small" className="text-ui-fg-subtle mt-1.5">
        {hint}
      </Text>
    )}
  </div>
);

const StatistikyInner = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const period =
    periods.find((entry) => entry.key === searchParams.get("obdobi"))?.key ??
    "30d";

  const { data, isLoading, isError } = useQuery<Statistics>({
    queryKey: ["operations-statistics", period],
    queryFn: () =>
      sdk.client.fetch("/admin/operations/statistics", { query: { period } }),
  });

  const currency = data?.orders.currency_code ?? "CZK";

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <WorkTabs active="statistiky" />

        <header className="px-6 pb-2 pt-6">
          <Heading>Statistiky</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Jak se obchodu daří. Nic z toho není potřeba dnes řešit — je to na
            rozmyšlenou, ne na práci.
          </Text>
        </header>

        <div className="flex flex-wrap items-center gap-2 px-6 py-4">
          {periods.map((entry) => {
            const isActive = entry.key === period;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() =>
                  setSearchParams(
                    entry.key === "30d" ? {} : { obdobi: entry.key },
                    { replace: true }
                  )
                }
                aria-current={isActive ? "page" : undefined}
                className={clx(
                  "transition-fg rounded-lg border px-3 py-2 outline-none focus-visible:shadow-borders-focus",
                  isActive
                    ? "border-ui-border-interactive bg-ui-bg-base-pressed"
                    : "border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-base-hover"
                )}
              >
                <Text size="small" weight={isActive ? "plus" : "regular"}>
                  {entry.label}
                </Text>
              </button>
            );
          })}
        </div>

        {isLoading && (
          <div className="grid gap-px bg-ui-border-base sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="bg-ui-bg-base px-6 py-6">
                <Skeleton className="h-16 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <EmptyState
            title="Statistiky se nepodařilo načíst"
            description="Zkuste stránku obnovit."
          />
        )}

        {data && (
          <div className="grid gap-px bg-ui-border-base sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Tržby"
              value={formatAmount(data.orders.revenue, currency)}
              hint={`${data.orders.paid_count} zaplacených objednávek`}
            />
            <Stat
              label="Objednávky"
              value={String(data.orders.count)}
              hint={
                data.orders.count - data.orders.paid_count > 0
                  ? `${data.orders.count - data.orders.paid_count} nezaplacených`
                  : "všechny zaplacené"
              }
            />
            <Stat
              label="Průměrná objednávka"
              value={formatAmount(data.orders.average_order_value, currency)}
            />
            <Stat
              label="Nedokončené košíky"
              value={String(data.carts.abandoned)}
              hint={
                data.carts.started > 0
                  ? `z ${data.carts.started} rozdělaných (${Math.round(
                      data.carts.abandonment_rate * 100
                    )} %)`
                  : "zatím žádné"
              }
            />
          </div>
        )}
      </Container>

      <Container className="divide-y p-0">
        <header className="px-6 pb-4 pt-6">
          <Heading level="h2">Nejprodávanější</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Počítáno jen ze zaplacených objednávek — co nikdo nezaplatil, se
            neprodalo.
          </Text>
        </header>

        {data && data.top_products.length === 0 && (
          <EmptyState
            title="Za toto období se nic neprodalo"
            description="Zkuste delší období."
          />
        )}

        {data && data.top_products.length > 0 && (
          <div className="divide-y">
            {data.top_products.map((product, index) => (
              <article
                key={product.product_id}
                className="flex items-center gap-4 px-6 py-4"
              >
                <Text
                  size="small"
                  className="text-ui-fg-muted w-6 shrink-0 text-right"
                >
                  {index + 1}.
                </Text>
                {product.thumbnail ? (
                  <img
                    src={product.thumbnail}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="bg-ui-bg-subtle h-10 w-10 shrink-0 rounded-md" />
                )}
                <Text size="small" weight="plus" className="min-w-0 flex-1 truncate">
                  {product.title}
                </Text>
                <Text size="small" className="text-ui-fg-subtle shrink-0">
                  {product.quantity} ks
                </Text>
                <Text size="small" weight="plus" className="shrink-0">
                  {formatAmount(product.revenue, currency)}
                </Text>
              </article>
            ))}
          </div>
        )}

        {data?.truncated && (
          <div className="px-6 py-4">
            <Text size="small" className="text-ui-fg-subtle">
              Období je tak dlouhé, že se nevešlo celé — čísla jsou z posledních
              5 000 objednávek.
            </Text>
          </div>
        )}
      </Container>
    </div>
  );
};

const queryClient = new QueryClient();

/**
 * Statistiky (§4 deviation, requested by Matěj).
 *
 * The plan deliberately kept trends off Přehled: „nothing here needs a trend to
 * act". That still holds for the *dashboard* — which is why this is its own
 * tab. Looking at a year of best sellers is a deliberate act, not something
 * that should share a screen with „3 objednávky k zabalení".
 */
const StatistikyPage = () => (
  <QueryClientProvider client={queryClient}>
    <StatistikyInner />
  </QueryClientProvider>
);

export default StatistikyPage;
