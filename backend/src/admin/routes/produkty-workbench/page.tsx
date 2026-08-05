import { defineRouteConfig } from "@medusajs/admin-sdk";
import { TagSolid } from "@medusajs/icons";
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
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { ProductionProfileEditor } from "../../components/production-profile-editor";
import { formatCzk } from "../../lib/workbench";
import { sdk } from "../../lib/sdk";

/**
 * Produkty — the advanced catalog workbench (admin-advanced-plan.md).
 *
 * One row per product with the five things that otherwise live on five
 * pages: stock, demand (wishlisty), reputation (recenze), sales (30 dní) and
 * the commission terms. The commission block shows the **deposit floor** —
 * the number the customer-facing slider cannot go under — because the
 * owner's protection should be visible where she reviews her catalog, not
 * buried where nobody looks.
 *
 * Editing links out: product detail for price/publish, the made-to-order
 * routes for the profile. One place changes a number; this page refuses to
 * become a second one.
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

/**
 * „Rozbalit" — the level under the row: which variant is the problem, who
 * waits on it, what the last reviews said, the shape of the last six
 * months, and where the product is committed (bundles, seasonal sales) —
 * the last one because repricing something that sits in a running sale is
 * how two systems end up disagreeing about a price.
 */
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

const stockBadge: Record<
  string,
  { label: string; color: "green" | "orange" | "red" }
> = {
  ok: { label: "skladem", color: "green" },
  low: { label: "dochází", color: "orange" },
  out: { label: "vyprodáno", color: "red" },
};

const ProductsInner = () => {
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

  const rows = data?.products ?? [];

  return (
    <Container className="divide-y p-0">
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Produkty — pracovní přehled</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Sklad, zájem zákazníků, hodnocení, prodeje a podmínky zakázek u
            každého produktu vedle sebe. Úpravy se dělají v detailu produktu —
            tady se rozhoduje, co si úpravu zaslouží.
          </Text>
        </div>
        <Input
          size="small"
          type="search"
          placeholder="Hledat název…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-64"
        />
      </header>

      {isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-14 rounded-lg" />
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
          title="Nic nenalezeno"
          description="Žádný produkt neodpovídá hledání."
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="divide-y">
          {rows.map((product) => {
            const worstStock = product.variants.reduce<"ok" | "low" | "out" | null>(
              (worst, variant) => {
                if (variant.stock_state === "out") return "out";
                if (variant.stock_state === "low" && worst !== "out")
                  return "low";
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
              <article
                className="grid gap-3 px-6 py-4 lg:grid-cols-[minmax(0,1.4fr)_150px_150px_170px_minmax(0,1fr)_auto] lg:items-center"
              >
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
                    {product.variants.length}{" "}
                    {product.variants.length === 1
                      ? "varianta"
                      : product.variants.length <= 4
                        ? "varianty"
                        : "variant"}
                  </Text>
                </div>

                <div>
                  <Text size="small">
                    {product.sold_30d}× za 30 dní
                  </Text>
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
                  {product.production?.enabled ? (
                    <>
                      <Text size="xsmall" weight="plus">
                        Zakázka · záloha min. {product.production.deposit_floor_percentage} %
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
                        {product.production.production_time_min_days}–
                        {product.production.production_time_max_days} dní
                        {product.production.allow_full_prepayment
                          ? ""
                          : " · bez platby předem v plné výši"}
                      </Text>
                    </>
                  ) : (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      běžný produkt
                    </Text>
                  )}
                </div>

                <div className="flex justify-start gap-3 lg:justify-end">
                  <button
                    type="button"
                    className="text-ui-fg-interactive txt-small hover:underline"
                    onClick={() =>
                      setExpanded(expanded === product.id ? null : product.id)
                    }
                  >
                    {expanded === product.id ? "Skrýt" : "Rozbalit"}
                  </button>
                  <ProductionProfileEditor
                    productId={product.id}
                    productTitle={product.title}
                    trigger={
                      <button
                        type="button"
                        className="text-ui-fg-interactive txt-small hover:underline"
                      >
                        Zakázka
                      </button>
                    }
                  />
                  <Link
                    to={`/products/${product.id}`}
                    className="text-ui-fg-interactive txt-small hover:underline"
                  >
                    Upravit
                  </Link>
                </div>
              </article>
              {expanded === product.id && (
                <ProductExpansion productId={product.id} />
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
