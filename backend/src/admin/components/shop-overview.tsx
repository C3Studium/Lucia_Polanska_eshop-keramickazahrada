import { Heading, Skeleton, Text, clx } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useUrlState } from "../lib/url-state";
import { sdk } from "../lib/sdk";

/**
 * „Jak se obchodu daří" — srdce Přehledu (17. 11. 2026, přání majitelky:
 * „skutečný přehled — statistiky, prodeje, jak se dařilo a kolik lidí obchod
 * použilo").
 *
 * Čtyři čísla se srovnáním s předchozím stejně dlouhým obdobím, graf tržeb,
 * nejprodávanější výrobky a kolik lidí začalo a dokončilo nákup. Všechno
 * počítá server z objednávek a košíků (`/admin/operations/statistics`).
 */

type Period = "7d" | "30d" | "3m" | "1y";

const PERIODS: { key: Period; label: string; previous: string }[] = [
  { key: "7d", label: "7 dní", previous: "předchozí týden" },
  { key: "30d", label: "30 dní", previous: "předchozích 30 dní" },
  { key: "3m", label: "3 měsíce", previous: "předchozí 3 měsíce" },
  { key: "1y", label: "Rok", previous: "předchozí rok" },
];

type Statistics = {
  period: string;
  truncated: boolean;
  orders: {
    count: number;
    paid_count: number;
    revenue: number;
    currency_code: string;
    average_order_value: number;
    buyers?: number;
  };
  carts: { started: number; completed: number; abandoned: number; abandonment_rate: number };
  previous?: {
    count: number;
    paid_count: number;
    revenue: number;
    average_order_value: number;
    buyers: number;
    carts_started: number;
  } | null;
  series?: { key: string; label: string; start: string; revenue: number; orders: number }[];
  top_products: {
    product_id: string;
    title: string;
    thumbnail: string | null;
    quantity: number;
    revenue: number;
  }[];
};

const kc = (value: number, currency = "CZK") =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(value));

const cislo = (value: number) => new Intl.NumberFormat("cs-CZ").format(value);

/** „↑ 12 %" proti předchozímu období; bez předchozích dat nic. */
const Change = ({ now, before }: { now: number; before?: number | null }) => {
  if (before === undefined || before === null) return null;
  // Předtím nula = není s čím srovnávat („nově" u všeho by byl jen šum).
  if (before === 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) {
    return (
      <Text size="xsmall" className="text-ui-fg-muted">
        stejně jako předtím
      </Text>
    );
  }
  return (
    <Text
      size="xsmall"
      weight="plus"
      className={pct > 0 ? "text-ui-tag-green-text" : "text-ui-tag-orange-text"}
    >
      {pct > 0 ? "↑" : "↓"} {Math.abs(pct)} %
    </Text>
  );
};

const Metric = ({
  label,
  value,
  hint,
  now,
  before,
}: {
  label: string;
  value: string;
  hint?: string;
  now: number;
  before?: number | null;
}) => (
  <div className="bg-ui-bg-base flex flex-col gap-y-1 px-6 py-5">
    <Text size="small" className="text-ui-fg-subtle">
      {label}
    </Text>
    <span className="text-ui-fg-base text-[28px] font-semibold leading-tight tabular-nums">
      {value}
    </span>
    <div className="flex min-h-5 flex-wrap items-baseline gap-x-2">
      <Change now={now} before={before} />
      {hint && (
        <Text size="xsmall" className="text-ui-fg-muted">
          {hint}
        </Text>
      )}
    </div>
  </div>
);

/** Sloupcový graf tržeb — jedna barva, popisky jen tam, kde se vejdou. */
const RevenueChart = ({
  series,
  currency,
}: {
  series: NonNullable<Statistics["series"]>;
  currency: string;
}) => {
  const max = Math.max(1, ...series.map((point) => point.revenue));
  const every = Math.max(1, Math.ceil(series.length / 12));
  return (
    <div>
      <div className="flex h-40 items-end gap-[2px]" role="img" aria-label="Tržby v čase">
        {series.map((point) => {
          const height = point.revenue > 0 ? Math.max(3, (point.revenue / max) * 100) : 0;
          return (
            <div
              key={point.key}
              className="group relative flex h-full min-w-0 flex-1 items-end"
              title={`${point.label}: ${kc(point.revenue, currency)} · ${point.orders} ${
                point.orders === 1 ? "objednávka" : point.orders >= 2 && point.orders <= 4 ? "objednávky" : "objednávek"
              }`}
            >
              <div
                className={clx(
                  "w-full rounded-t-[3px] transition-colors",
                  point.revenue > 0
                    ? "bg-ui-fg-interactive opacity-75 group-hover:opacity-100"
                    : "bg-ui-border-base h-px"
                )}
                style={point.revenue > 0 ? { height: `${height}%` } : undefined}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-[2px]">
        {series.map((point, index) => (
          <div key={point.key} className="min-w-0 flex-1 text-center">
            {index % every === 0 && (
              <Text size="xsmall" className="text-ui-fg-muted whitespace-nowrap">
                {point.label}
              </Text>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ShopOverview = () => {
  const [period, setPeriod] = useUrlState<Period>("obdobi", "30d");
  const meta = PERIODS.find((item) => item.key === period) ?? PERIODS[1];

  const { data, isLoading, isError } = useQuery<Statistics>({
    queryKey: ["operations-statistics", period],
    queryFn: () =>
      sdk.client.fetch("/admin/operations/statistics", { query: { period } }),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });

  const currency = data?.orders.currency_code ?? "CZK";
  const previous = data?.previous ?? null;
  const conversion =
    data && data.carts.started > 0
      ? Math.round((data.carts.completed / data.carts.started) * 100)
      : null;

  return (
    <section className="divide-y">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading level="h2">Jak se obchodu daří</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Za posledních {meta.label.toLowerCase()} · šipky ukazují srovnání s{" "}
            {meta.previous.replace("předchozí", "předchozím").replace("předchozích", "předchozími")}
          </Text>
        </div>
        <div
          role="radiogroup"
          aria-label="Období"
          className="bg-ui-bg-subtle flex rounded-lg p-0.5"
        >
          {PERIODS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="radio"
              aria-checked={period === item.key}
              onClick={() => setPeriod(item.key)}
              className={clx(
                "txt-compact-small min-h-[36px] rounded-md px-3 font-medium transition-colors",
                period === item.key
                  ? "bg-ui-bg-base text-ui-fg-base shadow-elevation-card-rest"
                  : "text-ui-fg-subtle hover:text-ui-fg-base"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {isError ? (
        <Text size="small" className="text-ui-fg-subtle px-6 py-6">
          Statistiky se teď nepodařilo načíst.
        </Text>
      ) : isLoading || !data ? (
        <div className="grid gap-px bg-ui-border-base sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="bg-ui-bg-base px-6 py-5">
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-px bg-ui-border-base sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Tržby"
              value={kc(data.orders.revenue, currency)}
              hint="jen zaplacené"
              now={data.orders.revenue}
              before={previous?.revenue}
            />
            <Metric
              label="Objednávky"
              value={cislo(data.orders.paid_count)}
              hint={
                data.orders.count > data.orders.paid_count
                  ? `+ ${cislo(data.orders.count - data.orders.paid_count)} nezaplacené`
                  : undefined
              }
              now={data.orders.paid_count}
              before={previous?.paid_count}
            />
            <Metric
              label="Nakoupilo lidí"
              value={cislo(data.orders.buyers ?? 0)}
              hint={`nákup začalo ${cislo(data.carts.started)}`}
              now={data.orders.buyers ?? 0}
              before={previous?.buyers}
            />
            <Metric
              label="Průměrná objednávka"
              value={kc(data.orders.average_order_value, currency)}
              now={data.orders.average_order_value}
              before={previous?.average_order_value}
            />
          </div>

          {data.series && data.series.length > 1 && (
            <div className="px-6 py-6">
              <Text size="small" weight="plus" className="mb-4">
                Tržby {period === "7d" || period === "30d" ? "po dnech" : period === "3m" ? "po týdnech" : "po měsících"}
              </Text>
              <RevenueChart series={data.series} currency={currency} />
            </div>
          )}

          <div className="grid gap-px bg-ui-border-base lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="bg-ui-bg-base px-6 py-5">
              <Text size="small" weight="plus">
                Nejprodávanější
              </Text>
              {data.top_products.length === 0 ? (
                <Text size="small" className="text-ui-fg-subtle mt-3">
                  V tomhle období se zatím nic neprodalo.
                </Text>
              ) : (
                <ol className="mt-3 flex flex-col">
                  {data.top_products.slice(0, 5).map((product, index) => (
                    <li key={product.product_id}>
                      <Link
                        to={`/produkt/${product.product_id}`}
                        className="hover:bg-ui-bg-base-hover -mx-2 flex items-center gap-x-3 rounded-lg px-2 py-2 transition-colors"
                      >
                        <Text size="small" className="text-ui-fg-muted w-4 tabular-nums">
                          {index + 1}
                        </Text>
                        {product.thumbnail ? (
                          <img
                            src={product.thumbnail}
                            alt=""
                            className="size-9 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <span className="bg-ui-bg-subtle size-9 shrink-0 rounded-md" />
                        )}
                        <Text size="small" weight="plus" className="min-w-0 flex-1 truncate">
                          {product.title}
                        </Text>
                        <Text size="small" className="text-ui-fg-subtle tabular-nums">
                          {cislo(product.quantity)} ks
                        </Text>
                        <Text size="small" weight="plus" className="w-24 text-right tabular-nums">
                          {kc(product.revenue, currency)}
                        </Text>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="bg-ui-bg-base px-6 py-5">
              <Text size="small" weight="plus">
                Nákupy v obchodě
              </Text>
              <div className="mt-3 flex flex-col gap-y-3">
                {[
                  { label: "Začali nakupovat", value: data.carts.started, tone: "bg-ui-fg-interactive opacity-30" },
                  { label: "Dokončili objednávku", value: data.carts.completed, tone: "bg-ui-fg-interactive" },
                  { label: "Nechali košík", value: data.carts.abandoned, tone: "bg-ui-tag-orange-icon" },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-baseline justify-between">
                      <Text size="small" className="text-ui-fg-subtle">
                        {row.label}
                      </Text>
                      <Text size="small" weight="plus" className="tabular-nums">
                        {cislo(row.value)}
                      </Text>
                    </div>
                    <div className="bg-ui-bg-subtle mt-1 h-2 overflow-hidden rounded-full">
                      <div
                        className={clx("h-full rounded-full", row.tone)}
                        style={{
                          width: `${data.carts.started ? (row.value / data.carts.started) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
                {conversion !== null && (
                  <Text size="small" className="text-ui-fg-subtle">
                    Objednávku dokončí <strong className="text-ui-fg-base">{conversion} %</strong>{" "}
                    lidí, kteří si něco dají do košíku.
                  </Text>
                )}
              </div>
            </div>
          </div>

          {data.truncated && (
            <Text size="xsmall" className="text-ui-fg-muted px-6 py-3">
              Čísla jsou z prvních 5 000 objednávek období.
            </Text>
          )}
        </>
      )}
    </section>
  );
};

export default ShopOverview;
