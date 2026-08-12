import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  ArrowUpRightOnBox,
  ChevronDown,
  FlyingBox,
  TagSolid,
} from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Skeleton,
  Switch,
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
import { VariantsEditor } from "../../components/variants-editor";
import { ProductLightbox, Thumb } from "../../components/product-thumb";
import { VisibilityEye } from "../../components/visibility-eye";
import { EmptyState } from "../../components/empty-state";
import { CopyId, ExpertToggle, RawData, useExpertMode } from "../../lib/expert-mode";
import { ProductionProfileEditor } from "../../components/production-profile-editor";
import { formatCzk, productionStageLabels } from "../../lib/workbench";
import { sdk } from "../../lib/sdk";
import { ShippingProfileEditor } from "../../components/shipping-profile-editor";
import { ArchiveToggle } from "../../components/archive-toggle";

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
  raw?: unknown;
  store_url?: string | null;
  id: string;
  title: string;
  handle: string;
  status: string;
  kind: "bezne" | "zakazka" | "balicek" | "poskozene";
  /** Whether the carrier may collect cash for this piece. Opt-in, per product. */
  cod_allowed: boolean;
  /** Declared by her; forces the whole basket onto the fragile carriage. */
  fragile: boolean;
  /** Retired: kept for its order history, gone from the shop and these lists. */
  archived: boolean;
  /** What wrapping this piece costs. Null = shop default. */
  packaging_price: number | null;
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
  /** Set when the server returned fewer rows than matched — never silently. */
  truncated?: boolean;
  kinds: { bezne: number; zakazka: number; balicek: number; poskozene: number };
  archived_count?: number;
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
      <RawData data={data} />
    </div>
  );
};

/** Row-level show/hide on the storefront — the shared eye with its warning. */
const PublishToggle = ({ product }: { product: WorkbenchProduct }) => {
  const queryClient = useQueryClient();
  return (
    <VisibilityEye
      visible={product.status === "published"}
      label={`produkt ${product.title}`}
      hideText="Zákazníci ho v obchodě neuvidí a nekoupí, dokud ho zase nezveřejníte."
      showText="Produkt se vrátí do obchodu a půjde koupit."
      onToggle={() =>
        sdk.client.fetch(`/admin/products/${product.id}`, {
          method: "POST",
          body: {
            status: product.status === "published" ? "draft" : "published",
          },
        })
      }
      onDone={() =>
        queryClient.invalidateQueries({ queryKey: ["workbench-products"] })
      }
    />
  );
};

/**
 * One flag of the piece as a small switch — Dobírka or Poškozené.
 *
 * Presentational only: flipping STAGES the change (Rozdělení pattern), it
 * does not save. Saving happens through the row's Potvrdit or the toolbar's
 * Potvrdit vše, both of which go through the workbench flags route — the one
 * safe metadata writer (native product update REPLACES metadata).
 *
 * Dobírka stays per product because the risk is per product: a refused parcel
 * costs her the carriage both ways — survivable on a mug, not on a commission.
 * Checkout still refuses dobírka outside Czechia and off Česká pošta.
 */
const FlagSwitch = ({
  label,
  title,
  checked,
  dirty,
  onFlip,
}: {
  label: string;
  title: string;
  checked: boolean;
  dirty: boolean;
  onFlip: () => void;
}) => (
  <label className="flex cursor-pointer items-center gap-1.5" title={title}>
    <Switch size="small" checked={checked} onCheckedChange={onFlip} />
    <Text
      size="xsmall"
      className={dirty ? "text-ui-fg-base font-medium" : "text-ui-fg-subtle"}
    >
      {label}
    </Text>
  </label>
);

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
                ` · ${productionStageLabels[stage] ?? stage}: ${count}`
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

/** Narrowed so the create button can be keyed off the tab without a cast. */
type TabKey =
  | "produkty"
  | "zakazky"
  | "balicky"
  | "poskozene"
  | "oblibene"
  | "archivovane"
  | "statistiky";

const tabs: { key: TabKey; label: string }[] = [
  { key: "produkty", label: "Produkty" },
  { key: "zakazky", label: "Zakázky" },
  { key: "balicky", label: "Balíčky" },
  { key: "poskozene", label: "Poškozené" },
  { key: "oblibene", label: "Oblíbené" },
  { key: "archivovane", label: "Archivované" },
  { key: "statistiky", label: "Statistiky" },
];

const ProductsInner = () => {
  const [active, setActive] = useState<TabKey>("produkty");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  /* Klik na miniaturu otevře fotky v plné velikosti (sdílený ProductLightbox). */
  const [lightbox, setLightbox] = useState<{ id: string; title: string } | null>(null);
  /* Rozpracované přepínače (Rozdělení pattern): flip nezapisuje, jen se drží
     tady. Uloží se až Potvrdit (řádek) / Potvrdit vše (lišta), nebo zahodí.
     Když je označeno víc produktů checkboxem, flip na označeném řádku
     rozpracuje tutéž hodnotu pro všechny označené. */
  const [pendingFlags, setPendingFlags] = useState<
    Record<string, { cod_allowed?: boolean; clearance?: boolean }>
  >({});
  const expert = useExpertMode();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const bulkArchive = useMutation({
    mutationFn: async () => {
      for (const id of selected) {
        await sdk.client.fetch(`/admin/workbench/products/${id}/flags`, {
          method: "POST", body: { archived: true },
        });
      }
    },
    onSuccess: async () => {
      const count = selected.size; setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      await queryClient.invalidateQueries({ queryKey: ["operations-products"] });
      toast.success(`Archivováno ${count} — z obchodu pryč, historie zůstává.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Archivace se nepodařila."),
  });
  const bulkHide = useMutation({
    mutationFn: async () => {
      for (const id of selected) {
        await sdk.client.fetch(`/admin/products/${id}`, {
          method: "POST", body: { status: "draft" },
        });
      }
    },
    onSuccess: async () => {
      const count = selected.size; setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      await queryClient.invalidateQueries({ queryKey: ["operations-products"] });
      toast.success(`Skryto ${count} produktů — v obchodě nejsou, tady zůstávají.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Skrytí se nepodařilo."),
  });


  /*
   * The kind goes to the server, and this is load-bearing rather than an optimisation.
   *
   * The route counts `kinds` across the whole catalogue but returns only `limit` rows —
   * default 50. Asking without a kind therefore got the first 50 products of 86 and left
   * this page to filter them locally, so a tab whose products sort late came back empty
   * while its badge confidently showed the real number. Bundles are created after the
   * pieces they contain, so Balíčky was the tab that emptied first.
   *
   * Filtering server-side means the slice applies to the kind being looked at. `oblibene`
   * ranks the whole catalogue by wishlist demand, so it deliberately sends no kind — and
   * the raised limit is what keeps that one honest.
   */
  const kindForTab: Partial<Record<TabKey, WorkbenchProduct["kind"]>> = {
    produkty: "bezne",
    zakazky: "zakazka",
    balicky: "balicek",
    poskozene: "poskozene",
  };

  const { data, isLoading, isError } = useQuery<WorkbenchProductsResponse>({
    queryKey: ["workbench-products", search, expert, active],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/workbench/products?${new URLSearchParams({
          limit: "200",
          ...(active === "archivovane" ? { archived: "1" } : {}),
          ...(kindForTab[active] ? { kind: kindForTab[active] as string } : {}),
          ...(search.trim() ? { q: search.trim() } : {}),
          ...(expert ? { expert: "1" } : {}),
        }).toString()}`
      ),
    refetchOnWindowFocus: true,
  });

  const all = data?.products ?? [];
  const byKind = (kind: WorkbenchProduct["kind"]) =>
    all.filter((product) => product.kind === kind);
  // The route already returned only archived rows for this tab; kind is irrelevant here
  // because an archived piece keeps whatever kind it had.
  const archivedRows = all;

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
              : active === "archivovane"
                ? archivedRows
                : [];

  type FlagKey = "cod_allowed" | "clearance";
  const savedFlag = (product: WorkbenchProduct, key: FlagKey) =>
    key === "cod_allowed" ? product.cod_allowed : product.clearance;
  const effectiveFlag = (product: WorkbenchProduct, key: FlagKey) =>
    pendingFlags[product.id]?.[key] ?? savedFlag(product, key);

  const stageFlag = (product: WorkbenchProduct, key: FlagKey) => {
    const newValue = !effectiveFlag(product, key);
    /* Flip on a checked row = the whole selection gets the same VALUE (not a
       per-row toggle — mixed states flipping in opposite directions would be
       chaos). An unchecked row stages only itself. */
    const targets =
      selected.size > 0 && selected.has(product.id)
        ? [...selected]
        : [product.id];
    setPendingFlags((prev) => {
      const next = { ...prev };
      for (const id of targets) {
        const target = rows.find((row) => row.id === id);
        if (!target) continue;
        const entry = { ...(next[id] ?? {}) };
        if (savedFlag(target, key) === newValue) {
          // Back at the saved state — nothing pending for this flag.
          delete entry[key];
        } else {
          entry[key] = newValue;
        }
        if (Object.keys(entry).length === 0) delete next[id];
        else next[id] = entry;
      }
      return next;
    });
  };

  const applyFlags = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const draft = pendingFlags[id];
        if (!draft || Object.keys(draft).length === 0) continue;
        await sdk.client.fetch(`/admin/workbench/products/${id}/flags`, {
          method: "POST",
          body: draft,
        });
      }
    },
    onSuccess: async (_, ids) => {
      setPendingFlags((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      toast.success(
        ids.length === 1 ? "Změna uložena." : `Uloženo změn: ${ids.length}.`
      );
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Uložení se nepodařilo."),
  });
  const pendingCount = Object.keys(pendingFlags).length;

  const renderRow = (product: WorkbenchProduct) => {
    // Best variant wins — „can I sell it at all?" Skladem beats Dochází
    // beats Vyprodáno; a product is only Vyprodáno when EVERY variant is.
    const worstStock = product.variants.reduce<"ok" | "low" | "out" | null>(
      (best, variant) => {
        if (variant.stock_state === "ok" || best === "ok") return "ok";
        if (variant.stock_state === "low" || best === "low") return "low";
        return variant.stock_state ?? best;
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
            <input type="checkbox" className="mt-1"
              checked={selected.has(product.id)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(product.id); else next.delete(product.id);
                setSelected(next);
              }} />

            <Thumb
              src={product.thumbnail}
              title={product.title}
              sizeClassName="size-10"
              onZoom={() =>
                setLightbox({ id: product.id, title: product.title })
              }
            />
            <div className="min-w-0">
              <Text size="small" weight="plus" className="truncate">
                {product.title}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle mt-0.5 truncate">
                {[product.collection, ...product.categories]
                  .filter(Boolean)
                  .join(" · ") || "bez zařazení"}
              </Text>
              {expert && <CopyId value={product.id} />}
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
            {/* Off is the norm, so only „on" is worth a badge — otherwise every row
                carries a label that says nothing. She sets these one by one and needs
                to see at a glance which ones she has already done. */}
            {product.archived && (
              <Badge
                size="2xsmall"
                color="grey"
                className={
                  product.status !== "published" || worstStock ? "ml-1" : ""
                }
              >
                archiv
              </Badge>
            )}
            {product.fragile && (
              <Badge
                size="2xsmall"
                color="orange"
                className={
                  product.status !== "published" || worstStock ? "ml-1" : ""
                }
              >
                křehké
              </Badge>
            )}
            {product.cod_allowed && (
              <Badge size="2xsmall" color="blue" className="ml-1">
                dobírka
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

          {/* Text is kept for what changes the piece's identity; the mechanical,
              every-row actions are icons and the two per-piece flags are small
              switches — state visible at a glance, still one click to flip. */}
          <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-end">
            <button
              type="button"
              title={expanded === product.id ? "Sbalit" : "Rozbalit"}
              className="text-ui-fg-subtle hover:text-ui-fg-base"
              onClick={() =>
                setExpanded(expanded === product.id ? null : product.id)
              }
            >
              <ChevronDown
                className={`transition-transform ${
                  expanded === product.id ? "rotate-180" : ""
                }`}
              />
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

            <VariantsEditor
              productId={product.id}
              productTitle={product.title}
              trigger={
                <button type="button" className="text-ui-fg-interactive txt-small hover:underline">
                  Varianty
                </button>
              }
            />

            {active !== "oblibene" && active !== "archivovane" && (
              <FlagSwitch
                label="Dobírka"
                title="Zákazník smí platit při převzetí — jen ČR a Česká pošta."
                checked={effectiveFlag(product, "cod_allowed")}
                dirty={pendingFlags[product.id]?.cod_allowed !== undefined}
                onFlip={() => stageFlag(product, "cod_allowed")}
              />
            )}
            {(active === "produkty" || active === "poskozene") && (
              <FlagSwitch
                label="Poškozené"
                title="Poškozený / poslední kus ve výprodeji — po prodeji se sám schová."
                checked={effectiveFlag(product, "clearance")}
                dirty={pendingFlags[product.id]?.clearance !== undefined}
                onFlip={() => stageFlag(product, "clearance")}
              />
            )}
            {pendingFlags[product.id] && (
              <>
                <Button size="small"
                  isLoading={
                    applyFlags.isPending &&
                    (applyFlags.variables ?? []).includes(product.id)
                  }
                  onClick={() => applyFlags.mutate([product.id])}>
                  Potvrdit
                </Button>
                <Button size="small" variant="transparent"
                  disabled={applyFlags.isPending}
                  onClick={() =>
                    setPendingFlags((prev) => {
                      const next = { ...prev };
                      delete next[product.id];
                      return next;
                    })
                  }>
                  Zrušit
                </Button>
              </>
            )}

            {active !== "oblibene" && (
              <ShippingProfileEditor
                productId={product.id}
                productTitle={product.title}
                fragile={product.fragile}
                packagingPrice={product.packaging_price}
                trigger={
                  <button
                    type="button"
                    title="Doprava a balení"
                    className="text-ui-fg-subtle hover:text-ui-fg-base"
                  >
                    <FlyingBox />
                  </button>
                }
              />
            )}

            {active !== "oblibene" && <ArchiveToggle product={product} />}
            <PublishToggle product={product} />
            {product.store_url && (
              <a
                href={product.store_url}
                target="_blank"
                rel="noreferrer"
                title="Otevřít v obchodě"
                className="text-ui-fg-subtle hover:text-ui-fg-base"
              >
                <ArrowUpRightOnBox />
              </a>
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
      <ProductLightbox product={lightbox} onClose={() => setLightbox(null)} />
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Produkty — pracovní přehled</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Každý druh zboží má svou záložku a své ovládání: běžné produkty,
            zakázky se zálohou, balíčky, poškozené kusy — a statistiky přes
            všechno dohromady.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {pendingCount > 0 && (
            <>
              <Button size="small"
                isLoading={applyFlags.isPending}
                onClick={() => applyFlags.mutate(Object.keys(pendingFlags))}>
                Potvrdit vše ({pendingCount})
              </Button>
              <Button size="small" variant="secondary"
                disabled={applyFlags.isPending}
                onClick={() => setPendingFlags({})}>
                Zrušit vše
              </Button>
            </>
          )}
          <ExpertToggle />
          {/* Every kind starts in the one Nový produkt panel — the button just
              carries the tab's kind so the right card is preselected. Oblíbené,
              Archivované and Statistiky are read-outs of what exists, so they
              get no button. */}
          {(active === "produkty" ||
            active === "zakazky" ||
            active === "balicky" ||
            active === "poskozene") && (
            <Button size="small" variant="secondary" asChild>
              <Link
                to={`/novy-produkt?druh=${
                  { produkty: "produkt", zakazky: "zakazka", balicky: "balicek", poskozene: "poskozeny" }[active]
                }`}
              >
                Přidat produkt
              </Link>
            </Button>
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

      {selected.size > 0 && (
        <div className="bg-ui-bg-subtle flex flex-wrap items-center gap-2 px-6 py-3">
          <Text size="small" weight="plus">Vybráno: {selected.size}</Text>
          <Button size="small" variant="secondary" isLoading={bulkArchive.isPending}
            onClick={() => bulkArchive.mutate()}>Archivovat</Button>
          <Button size="small" variant="secondary" isLoading={bulkHide.isPending}
            onClick={() => bulkHide.mutate()}>Skrýt z obchodu</Button>
          <Button size="small" variant="transparent"
            onClick={() => setSelected(new Set())}>Zrušit výběr</Button>
        </div>
      )}
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
                    : tab.key === "archivovane"
                      ? data?.archived_count
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
                        : active === "archivovane"
                          ? "Archiv je prázdný"
                          : "Nic nenalezeno"
              }
              description={
                active === "poskozene"
                  ? "Poškozený kus založíte tlačítkem Přidat produkt nahoře, nebo označíte existující v záložce Produkty."
                  : active === "balicky"
                    ? "Balíček sestavíte tlačítkem Přidat produkt nahoře."
                    : active === "zakazky"
                      ? "Zakázku založíte tlačítkem Přidat produkt nahoře, nebo tak označíte existující produkt akcí ‚Nastavit jako zakázku‘."
                      : active === "archivovane"
                        ? "Archivované kusy zmizí z obchodu i ze seznamů, ale zůstanou v historii objednávek."
                        : "Zkuste jiné hledání."
              }
            />
          )}

          {!isLoading && !isError && rows.length > 0 && (
            <div className="divide-y">{rows.map(renderRow)}</div>
          )}

          {data?.truncated && (
            <div className="px-6 py-3">
              <Text size="xsmall" className="text-ui-fg-muted">
                Zobrazeno {data.products.length} z {data.count} — zbytek se sem
                nevešel. Zkuste hledání.
              </Text>
            </div>
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
