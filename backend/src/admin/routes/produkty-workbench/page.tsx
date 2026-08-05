import { defineRouteConfig } from "@medusajs/admin-sdk";
import { TagSolid } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
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
import { BundleEditor } from "../../components/bundle-editor";
import { EmptyState } from "../../components/empty-state";
import { ProductionProfileEditor } from "../../components/production-profile-editor";
import { formatCzk, stageLabels } from "../../lib/workbench";
import { sdk } from "../../lib/sdk";

/**
 * Produkty+ — the catalog workbench, one tab per kind of thing she sells
 * (Matěj's brief, 2026-08-06).
 *
 * The flat list treated a mug, a commission, a bundle and a damaged piece
 * as the same kind of row, which meant the controls each kind needs were
 * either missing or shown where they made no sense — the deposit editor on
 * ordinary products being the reported example. Each kind now has its tab,
 * its own columns, and only its own actions:
 *
 * - **Produkty** — plain catalog; no commission controls.
 * - **Zakázky** — the deposit floor (the slider minimum) and lead times,
 *   editable here and only here.
 * - **Balíčky** — what is inside, and how the price relates to components.
 * - **Poškozené** — clearance pieces with their one-off sale price and the
 *   sold-out-auto-hide state; marking and unmarking happens here.
 * - **Oblíbené** — the catalog ranked by wishlist demand.
 * - **Statistiky** — the whole domain measured, from the same sources the
 *   tabs read, so a number can never disagree with the rows it summarises.
 */

type WorkbenchVariant = {
  id: string;
  title: string | null;
  sku: string | null;
  price_czk: number | null;
  available: number | null;
  stock_state: "low" | "out" | "ok" | null;
  wishlist_count: number;
};

type WorkbenchProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
  kind: "bezne" | "zakazka" | "balicek" | "poskozene";
  bundle: { id: string; title: string } | null;
  clearance: boolean;
  thumbnail: string | null;
  collection: string | null;
  categories: string[];
  variants: WorkbenchVariant[];
  sold_30d: number;
  wishlist_count: number;
  review_count: number;
  review_average: number | null;
  production: {
    enabled: boolean;
    deposit_floor_percentage: number;
    allow_full_prepayment: boolean;
    production_time_min_days: number;
    production_time_max_days: number;
    specification_required: boolean;
  } | null;
};

type WorkbenchProductsResponse = {
  products: WorkbenchProduct[];
  count: number;
  kinds: { bezne: number; zakazka: number; balicek: number; poskozene: number };
};

type ProductDetail = {
  variants: {
    id: string;
    title: string | null;
    sku: string | null;
    price_czk: number | null;
    available: number | null;
    reserved: number | null;
    stock_state: "low" | "out" | "ok" | null;
    threshold: number | null;
    waiting_customers: number;
    wishlist_count: number;
  }[];
  sales_by_month: { month: string; sold: number }[];
  reviews: {
    count: number;
    average: number | null;
    latest: { rating: number; title: string | null; content: string; created_at: string }[];
  };
  memberships: {
    bundles: { id: string; title: string }[];
    seasonal_selections: { id: string; title: string; status: string }[];
  };
};

const stockBadge: Record<
  string,
  { label: string; color: "green" | "orange" | "red" }
> = {
  ok: { label: "skladem", color: "green" },
  low: { label: "dochází", color: "orange" },
  out: { label: "vyprodáno", color: "red" },
};

/** „Rozbalit" — the level under the row; shared by every kind's tab. */
const ProductExpansion = ({ productId }: { productId: string }) => {
  const { data, isLoading } = useQuery<ProductDetail>({
    queryKey: ["workbench-product", productId],
    queryFn: () =>
      sdk.client.fetch(`/admin/workbench/products/${productId}`),
  });

  if (isLoading) {
    return (
      <div className="px-6 pb-4">
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }
  if (!data) return null;

  const maxSold = Math.max(1, ...data.sales_by_month.map((entry) => entry.sold));

  return (
    <div className="bg-ui-bg-subtle px-6 py-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
            Varianty
          </Text>
          {data.variants.map((variant) => (
            <Text key={variant.id} size="xsmall" className="mt-1.5">
              {variant.title || variant.sku || "—"} ·{" "}
              {variant.price_czk !== null ? formatCzk(variant.price_czk) : "bez ceny"} ·{" "}
              {variant.available !== null
                ? `${variant.available} skladem`
                : "mimo sklad"}
              {variant.stock_state === "out" ? " · vyprodáno" : ""}
              {variant.stock_state === "low" ? " · dochází" : ""}
              {variant.waiting_customers > 0
                ? ` · ${variant.waiting_customers} čeká`
                : ""}
              {variant.wishlist_count > 0
                ? ` · ${variant.wishlist_count}× v oblíbených`
                : ""}
            </Text>
          ))}

          <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase mt-4">
            Prodeje po měsících
          </Text>
          <div className="mt-2 flex items-end gap-1.5" aria-hidden="true">
            {data.sales_by_month.map((entry) => (
              <div key={entry.month} className="flex flex-col items-center gap-1">
                <div
                  className="bg-ui-fg-interactive w-7 rounded-sm"
                  style={{ height: `${8 + (entry.sold / maxSold) * 40}px`, opacity: entry.sold ? 1 : 0.25 }}
                  title={`${entry.month}: ${entry.sold}`}
                />
                <Text size="xsmall" className="text-ui-fg-muted">
                  {entry.sold}
                </Text>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
            Poslední hodnocení
          </Text>
          {data.reviews.latest.length === 0 && (
            <Text size="xsmall" className="text-ui-fg-subtle mt-1.5">
              Zatím bez hodnocení.
            </Text>
          )}
          {data.reviews.latest.map((review, index) => (
            <Text key={index} size="xsmall" className="text-ui-fg-subtle mt-1.5">
              {"★".repeat(review.rating)} — {review.content.slice(0, 90)}
              {review.content.length > 90 ? "…" : ""}
            </Text>
          ))}

          {(data.memberships.bundles.length > 0 ||
            data.memberships.seasonal_selections.length > 0) && (
            <>
              <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase mt-4">
                Kde je zapojený
              </Text>
              {data.memberships.bundles.map((bundle) => (
                <Text key={bundle.id} size="xsmall" className="text-ui-fg-subtle mt-1">
                  Balíček: {bundle.title}
                </Text>
              ))}
              {data.memberships.seasonal_selections.map((selection) => (
                <Text key={selection.id} size="xsmall" className="text-ui-fg-subtle mt-1">
                  Sezónní akce: {selection.title}
                  {selection.status === "published" ? " (běží)" : ""}
                </Text>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/** Mark / unmark a piece as damaged clearance, through the native product. */
const ClearanceToggle = ({
  product,
  makeClearance,
}: {
  product: WorkbenchProduct;
  makeClearance: boolean;
}) => {
  const queryClient = useQueryClient();
  const mutate = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/products/${product.id}`, {
        method: "POST",
        body: { metadata: { clearance: makeClearance } },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      toast.success(
        makeClearance
          ? `${product.title} zařazen do výprodeje poškozených.`
          : `${product.title} vyřazen z výprodeje.`
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Změna se nepodařila."
      ),
  });

  return (
    <button
      type="button"
      className="text-ui-fg-interactive txt-small hover:underline"
      onClick={() => mutate.mutate()}
    >
      {makeClearance ? "Označit jako poškozené" : "Ukončit výprodej"}
    </button>
  );
};

const StatsView = () => {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["workbench-product-statistics"],
    queryFn: () =>
      sdk.client.fetch("/admin/workbench/products/statistics"),
    refetchOnWindowFocus: true,
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-y-3 px-6 py-5">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }

  const block = (title: string, children: React.ReactNode) => (
    <div className="border-ui-border-base rounded-lg border p-4">
      <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
        {title}
      </Text>
      <div className="mt-2">{children}</div>
    </div>
  );

  return (
    <div className="grid gap-4 px-6 py-5 lg:grid-cols-2">
      {block(
        "Katalog",
        <Text size="small">
          {data.kinds.bezne} běžných · {data.kinds.zakazka} zakázkových ·{" "}
          {data.kinds.balicek} balíčků · {data.kinds.poskozene} poškozených
          <br />
          <span className="text-ui-fg-subtle">
            Sklad: {data.stock.out} vyprodáno · {data.stock.low} dochází ·{" "}
            {data.stock.ok} v pořádku
          </span>
        </Text>
      )}

      {block(
        "Zakázky",
        <Text size="small">
          {data.zakazky.total} celkem
          {Object.entries(data.zakazky.by_stage as Record<string, number>)
            .map(
              ([stage, count]) =>
                ` · ${stageLabels[stage] ?? stage}: ${count}`
            )
            .join("")}
          <br />
          <span className="text-ui-fg-subtle">
            Zaplacené zálohy {formatCzk(data.zakazky.deposits_paid)} · čeká na
            doplacení {formatCzk(data.zakazky.outstanding_total)}
            {data.zakazky.average_floor_percentage !== null
              ? ` · průměrná min. záloha ${data.zakazky.average_floor_percentage} %`
              : ""}
          </span>
        </Text>
      )}

      {block(
        "Nejprodávanější — 30 dní",
        <>
          {data.top_sellers_30d.length === 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              Za posledních 30 dní se nic neprodalo.
            </Text>
          )}
          {data.top_sellers_30d.map((seller: any) => (
            <Text key={seller.product_id} size="small" className="mt-1">
              {seller.qty}× {seller.title}{" "}
              <span className="text-ui-fg-subtle">
                {formatCzk(seller.revenue)}
              </span>
            </Text>
          ))}
        </>
      )}

      {block(
        "Nejprodávanější — rok",
        <>
          {data.top_sellers_365d.length === 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              Zatím bez prodejů.
            </Text>
          )}
          {data.top_sellers_365d.map((seller: any) => (
            <Text key={seller.product_id} size="small" className="mt-1">
              {seller.qty}× {seller.title}{" "}
              <span className="text-ui-fg-subtle">
                {formatCzk(seller.revenue)}
              </span>
            </Text>
          ))}
        </>
      )}

      {block(
        "Balíčky",
        <>
          {data.bundles.length === 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              Žádný balíček se zatím neprodal.
            </Text>
          )}
          {data.bundles.map((bundle: any) => (
            <Text key={bundle.id} size="small" className="mt-1">
              {bundle.qty}× {bundle.title}{" "}
              <span className="text-ui-fg-subtle">
                {formatCzk(bundle.revenue)}
              </span>
            </Text>
          ))}
        </>
      )}

      {block(
        "Nejvíc v oblíbených",
        <>
          {data.wishlist_top.length === 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              Zákazníci si zatím nic neuložili.
            </Text>
          )}
          {data.wishlist_top.map((entry: any) => (
            <Text key={entry.product_id} size="small" className="mt-1">
              {entry.count}× {entry.title}
            </Text>
          ))}
        </>
      )}

      {block(
        "Poškozené a hodnocení",
        <Text size="small">
          Výprodej poškozených: {data.clearance.total}
          {data.clearance.sold_out_awaiting_removal > 0
            ? ` (${data.clearance.sold_out_awaiting_removal} vyprodáno — zmizí samy)`
            : ""}
          <br />
          <span className="text-ui-fg-subtle">
            Hodnocení: {data.reviews.approved} schválených z {data.reviews.total}
            {data.reviews.average !== null
              ? ` · průměr ${data.reviews.average} ★`
              : ""}
          </span>
        </Text>
      )}

      <Text size="xsmall" className="text-ui-fg-muted lg:col-span-2">
        Počítáno z posledních {data.orders_scanned} objednávek.
      </Text>
    </div>
  );
};

const tabs = [
  { key: "produkty", label: "Produkty" },
  { key: "zakazky", label: "Zakázky" },
  { key: "balicky", label: "Balíčky" },
  { key: "poskozene", label: "Poškozené" },
  { key: "oblibene", label: "Oblíbené" },
  { key: "statistiky", label: "Statistiky" },
];

const ProductsInner = () => {
  const [active, setActive] = useState("produkty");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<WorkbenchProductsResponse>({
    queryKey: ["workbench-products", search],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/workbench/products${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`
      ),
    refetchOnWindowFocus: true,
  });

  const all = data?.products ?? [];
  const byKind = (kind: WorkbenchProduct["kind"]) =>
    all.filter((product) => product.kind === kind);

  const rows =
    active === "produkty"
      ? byKind("bezne")
      : active === "zakazky"
        ? byKind("zakazka")
        : active === "balicky"
          ? byKind("balicek")
          : active === "poskozene"
            ? byKind("poskozene")
            : active === "oblibene"
              ? [...all]
                  .filter((product) => product.wishlist_count > 0)
                  .sort((a, b) => b.wishlist_count - a.wishlist_count)
              : [];

  const renderRow = (product: WorkbenchProduct) => {
    const worstStock = product.variants.reduce<"ok" | "low" | "out" | null>(
      (worst, variant) => {
        if (variant.stock_state === "out") return "out";
        if (variant.stock_state === "low" && worst !== "out") return "low";
        if (variant.stock_state === "ok" && !worst) return "ok";
        return worst;
      },
      null
    );
    const priced = product.variants.filter(
      (variant) => variant.price_czk !== null
    );
    const priceMin = priced.length
      ? Math.min(...priced.map((variant) => variant.price_czk!))
      : null;
    const priceMax = priced.length
      ? Math.max(...priced.map((variant) => variant.price_czk!))
      : null;

    return (
      <Fragment key={product.id}>
        <article className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1.4fr)_150px_150px_170px_minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            {product.thumbnail ? (
              <img
                src={product.thumbnail}
                alt=""
                className="h-10 w-10 rounded-md object-cover"
              />
            ) : (
              <div className="bg-ui-bg-component h-10 w-10 rounded-md" />
            )}
            <div className="min-w-0">
              <Text size="small" weight="plus" className="truncate">
                {product.title}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle mt-0.5 truncate">
                {[product.collection, ...product.categories]
                  .filter(Boolean)
                  .join(" · ") || "bez zařazení"}
              </Text>
            </div>
          </div>

          <div>
            {product.status !== "published" && (
              <Badge size="2xsmall" color="grey">
                koncept
              </Badge>
            )}
            {worstStock && (
              <Badge
                size="2xsmall"
                color={stockBadge[worstStock].color}
                className={product.status !== "published" ? "ml-1" : ""}
              >
                {stockBadge[worstStock].label}
              </Badge>
            )}
          </div>

          <div>
            <Text size="small">
              {priceMin === null
                ? "—"
                : priceMin === priceMax
                  ? formatCzk(priceMin)
                  : `${formatCzk(priceMin)} – ${formatCzk(priceMax)}`}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              {active === "poskozene"
                ? "výprodejová cena"
                : `${product.variants.length} ${
                    product.variants.length === 1
                      ? "varianta"
                      : product.variants.length <= 4
                        ? "varianty"
                        : "variant"
                  }`}
            </Text>
          </div>

          <div>
            <Text size="small">{product.sold_30d}× za 30 dní</Text>
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              {product.wishlist_count > 0
                ? `${product.wishlist_count}× v oblíbených`
                : "zatím bez oblíbení"}
              {product.review_average !== null
                ? ` · ${product.review_average} ★ (${product.review_count})`
                : ""}
            </Text>
          </div>

          <div className="min-w-0">
            {product.kind === "zakazka" && product.production && (
              <>
                <Text size="xsmall" weight="plus">
                  Min. záloha {product.production.deposit_floor_percentage} %
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
                  {product.production.production_time_min_days}–
                  {product.production.production_time_max_days} dní
                  {product.production.allow_full_prepayment
                    ? ""
                    : " · bez platby v plné výši"}
                </Text>
              </>
            )}
            {product.kind === "balicek" && product.bundle && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                Balíček: {product.bundle.title}
              </Text>
            )}
            {product.kind === "poskozene" && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                jednorázový kus — po vyprodání zmizí sám
              </Text>
            )}
          </div>

          <div className="flex flex-wrap justify-start gap-3 lg:justify-end">
            <button
              type="button"
              className="text-ui-fg-interactive txt-small hover:underline"
              onClick={() =>
                setExpanded(expanded === product.id ? null : product.id)
              }
            >
              {expanded === product.id ? "Skrýt" : "Rozbalit"}
            </button>

            {active === "zakazky" && (
              <ProductionProfileEditor
                productId={product.id}
                productTitle={product.title}
                trigger={
                  <button
                    type="button"
                    className="text-ui-fg-interactive txt-small hover:underline"
                  >
                    Podmínky
                  </button>
                }
              />
            )}

            {active === "produkty" && (
              <ProductionProfileEditor
                productId={product.id}
                productTitle={product.title}
                trigger={
                  <button
                    type="button"
                    className="text-ui-fg-subtle txt-small hover:underline"
                  >
                    Nastavit jako zakázku
                  </button>
                }
              />
            )}

            {active === "balicky" && product.bundle && (
              <BundleEditor
                bundleId={product.bundle.id}
                trigger={
                  <button
                    type="button"
                    className="text-ui-fg-interactive txt-small hover:underline"
                  >
                    Složení
                  </button>
                }
              />
            )}

            {active === "poskozene" && (
              <ClearanceToggle product={product} makeClearance={false} />
            )}
            {active === "produkty" && (
              <ClearanceToggle product={product} makeClearance={true} />
            )}

            <Link
              to={`/products/${product.id}`}
              className="text-ui-fg-interactive txt-small hover:underline"
            >
              Upravit
            </Link>
          </div>
        </article>
        {expanded === product.id && <ProductExpansion productId={product.id} />}
      </Fragment>
    );
  };

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Produkty — pracovní přehled</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Každý druh zboží má svou záložku a své ovládání: běžné produkty,
            zakázky se zálohou, balíčky, poškozené kusy — a statistiky přes
            všechno dohromady.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {active === "balicky" && (
            <BundleEditor
              trigger={
                <Button size="small" variant="secondary">
                  Nový balíček
                </Button>
              }
            />
          )}
          <Input
            size="small"
            type="search"
            placeholder="Hledat název…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-56"
          />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-6 py-4">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          const count =
            tab.key === "produkty"
              ? data?.kinds.bezne
              : tab.key === "zakazky"
                ? data?.kinds.zakazka
                : tab.key === "balicky"
                  ? data?.kinds.balicek
                  : tab.key === "poskozene"
                    ? data?.kinds.poskozene
                    : undefined;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "border-ui-border-interactive bg-ui-bg-base-pressed transition-fg flex items-center gap-x-2 rounded-lg border px-3 py-2 outline-none"
                  : "border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-base-hover transition-fg flex items-center gap-x-2 rounded-lg border px-3 py-2 outline-none"
              }
            >
              <Text size="small" weight={isActive ? "plus" : "regular"}>
                {tab.label}
              </Text>
              {typeof count === "number" && count > 0 && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  {count}
                </Text>
              )}
            </button>
          );
        })}
      </div>

      {active === "statistiky" ? (
        <StatsView />
      ) : (
        <>
          {isLoading && (
            <div className="flex flex-col gap-y-3 px-6 py-5">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          )}

          {isError && (
            <EmptyState
              title="Produkty se nepodařilo načíst"
              description="Zkuste stránku obnovit."
            />
          )}

          {!isLoading && !isError && rows.length === 0 && (
            <EmptyState
              title={
                active === "zakazky"
                  ? "Žádné zakázkové produkty"
                  : active === "balicky"
                    ? "Žádné balíčky"
                    : active === "poskozene"
                      ? "Žádné poškozené kusy"
                      : active === "oblibene"
                        ? "Zákazníci si zatím nic neuložili"
                        : "Nic nenalezeno"
              }
              description={
                active === "poskozene"
                  ? "Poškozený kus označíte v záložce Produkty akcí ‚Označit jako poškozené‘."
                  : active === "balicky"
                    ? "Nový balíček vytvoříte tlačítkem nahoře."
                    : active === "zakazky"
                      ? "Produkt zařadíte mezi zakázky v záložce Produkty akcí ‚Nastavit jako zakázku‘."
                      : "Zkuste jiné hledání."
              }
            />
          )}

          {!isLoading && !isError && rows.length > 0 && (
            <div className="divide-y">{rows.map(renderRow)}</div>
          )}
        </>
      )}
    </Container>
  );
};

const queryClient = new QueryClient();

const ProductsWorkbenchPage = () => (
  <QueryClientProvider client={queryClient}>
    <ProductsInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Produkty+",
  icon: TagSolid,
});

export default ProductsWorkbenchPage;
