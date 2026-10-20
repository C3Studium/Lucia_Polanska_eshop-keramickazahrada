import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  ArrowUpRightOnBox,
  ChevronDown,
  FlyingBox,
  Photo,
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
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BundleEditor } from "../../components/bundle-editor";
import { VariantsEditor } from "../../components/variants-editor";
import { ProductLightbox, Thumb } from "../../components/product-thumb";
import { ProductSortingGuide } from "../../components/product-sorting-guide";
import { VisibilityEye } from "../../components/visibility-eye";
import { EmptyState } from "../../components/empty-state";
import {
  BulkAction,
  BulkBar,
  BulkNumber,
  BulkSwitch,
  sharedNumberOf,
  triStateOf,
} from "../../components/bulk-bar";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { CopyId, ExpertToggle, RawData, useExpertMode } from "../../lib/expert-mode";
import {
  toastWithUndo,
  useLastUndo,
  useUndoHotkey,
  undoById,
} from "../../lib/undo";
import { ViewSwitcher, gridClassName, useViewMode } from "../../lib/view-mode";
import {
  CatalogFilterBar,
  EMPTY_CATALOG_FILTER,
  applyCatalogFilter,
  type CatalogFilter,
} from "../../components/catalog-filter";
import { ProductionProfileEditor } from "../../components/production-profile-editor";
import { formatCzk, productionStageLabels } from "../../lib/workbench";
import { sdk } from "../../lib/sdk";
import { ShippingProfileEditor } from "../../components/shipping-profile-editor";
import { SelectCheckbox } from "../../components/select-checkbox";
import { ArchiveToggle } from "../../components/archive-toggle";
import { adminQueryClient } from "../../lib/query-client"
import { ceskaChyba } from "../../lib/ceska-chyba";

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
  /** Ručně vyloučený ze slevových kódů (přepínač „Bez slev. kódů"). */
  no_promo: boolean;
  thumbnail: string | null;
  collection: string | null;
  /** Všechny kolekce — vlastní + kolekce kategorií (filtr ho ukáže pod každou). */
  collections?: string[];
  /** Kategorie → kolekce, ke které patří. */
  category_collections?: Record<string, string | null>;
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
/*
 * Seznam jako TABULKA (Matěj 12. 10. 2026: „mít 2 řádky je o ničem, když to
 * má být list"). Od 1400 px jeden řádek na produkt se sloupci a hlavičkou —
 * přepínače bez popisků, popisek nese hlavička. Užší displej: nastavení pod
 * údaji; telefon: nastavení pod „…".
 */
const ROW_GRID =
  "min-[1400px]:grid-cols-[minmax(0,1fr)_96px_88px_92px_56px_56px_84px_64px_60px_150px]";

const RowHeader = () => (
  <div
    className={`bg-ui-bg-subtle text-ui-fg-subtle hidden gap-x-3 px-6 py-2 min-[1400px]:grid ${ROW_GRID}`}
  >
    {[
      ["Produkt", "", "pl-[92px]"],
      ["Stav", "", ""],
      ["Cena", "", ""],
      ["Prodeje 30 dní", "", ""],
      ["Dobírka", "Zákazník smí platit při převzetí (jen ČR, Česká pošta na adresu).", "text-center"],
      ["Křehké", "Zásilka s tímto kusem pojede v křehkém režimu.", "text-center"],
      ["Balení", "Cena balení za kus v Kč — zákazník ji uvidí jako „Balné“.", "text-center"],
      ["Poškozené", "Poškozený / poslední kus ve výprodeji.", "text-center"],
      ["Bez slev", "Slevové kódy se na produkt nevztahují.", "text-center"],
      ["", "", ""],
    ].map(([label, title, className], index) => (
      <Text key={index} size="xsmall" weight="plus" className={className} title={title || undefined}>
        {label}
      </Text>
    ))}
  </div>
);

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
  <label
    className={`flex cursor-pointer items-center gap-1.5 min-[1400px]:justify-center ${dirty ? `min-[1400px]:rounded-md min-[1400px]:bg-ui-tag-orange-bg min-[1400px]:px-1` : ""}`}
    title={title}
  >
    <Switch size="small" checked={checked} onCheckedChange={onFlip} />
    {/* Na širokém displeji nese popisek hlavička sloupce. */}
    <Text
      size="xsmall"
      className={`${dirty ? "text-ui-fg-base font-medium" : "text-ui-fg-subtle"} min-[1400px]:sr-only`}
    >
      {label}
    </Text>
  </label>
);

/**
 * Balení [cena] v řádku (Matěj 12. 10. 2026: neschovávat do okna). Píše se
 * jako přepínače do rozpracovaných změn — uloží se Potvrdit / Potvrdit vše.
 * Prázdné = bez ceny balení (zákazník uvidí „Balné 0,-").
 */
const PackagingInput = ({
  value,
  dirty,
  onChange,
}: {
  value: number | null;
  dirty: boolean;
  onChange: (value: number | null) => void;
}) => {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") return onChange(null);
    const parsed = Number(trimmed.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) onChange(Math.round(parsed * 100) / 100);
    else setDraft(value === null ? "" : String(value));
  };
  return (
    <label
      className={`flex items-center gap-1.5 min-[1400px]:justify-center`}
      title="Cena balení za kus — zákazník ji uvidí jako „Balné“ pod výrobkem."
    >
      <Text
        size="xsmall"
        className={`${dirty ? "text-ui-fg-base font-medium" : "text-ui-fg-subtle"} min-[1400px]:sr-only`}
      >
        Balení
      </Text>
      <input
        type="number"
        min={0}
        inputMode="decimal"
        placeholder="0"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        className={`border-ui-border-base bg-ui-bg-field txt-compact-xsmall w-16 rounded-md border px-2 py-1 text-right ${dirty ? "border-ui-tag-orange-border" : ""}`}
      />
      <Text size="xsmall" className={`text-ui-fg-subtle min-[1400px]:sr-only`}>Kč</Text>
    </label>
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
  | "trideni"
  | "zakazky"
  | "balicky"
  | "poskozene"
  | "oblibene"
  | "archivovane"
  | "statistiky";

const tabs: { key: TabKey; label: string }[] = [
  { key: "produkty", label: "Produkty" },
  { key: "trideni", label: "Třídění" },
  { key: "zakazky", label: "Zakázky" },
  { key: "balicky", label: "Balíčky" },
  { key: "poskozene", label: "Poškozené" },
  { key: "oblibene", label: "Oblíbené" },
  { key: "archivovane", label: "Archivované" },
  { key: "statistiky", label: "Statistiky" },
];

const ProductsInner = () => {
  const [active, setActive] = useState<TabKey>("produkty");
  /* Input je okamžitý, DOTAZ letí až 350 ms po dopsání — katalogový endpoint
     je nejtěžší v adminu a pálit ho na každé písmeno bolí hlavně na mobilu. */
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const [expanded, setExpanded] = useState<string | null>(null);
  /* Tři styly seznamu — sdílený přepínač, volba se pamatuje per stránka. */
  const [view, changeView] = useViewMode("kz-view-produkty");
  /* Sekundární filtr podle zařazení — kolekce a kategorie z řádků záložky. */
  const [catalog, setCatalog] = useState<CatalogFilter>(EMPTY_CATALOG_FILTER);
  /* Klik na miniaturu otevře fotky v plné velikosti (sdílený ProductLightbox). */
  const [lightbox, setLightbox] = useState<{ id: string; title: string } | null>(null);
  /* Klik na kartu v mřížce vede na detail produktu (fotky mají vlastní ikonu). */
  const navigate = useNavigate();
  /* Rozpracované přepínače (Rozdělení pattern): flip nezapisuje, jen se drží
     tady. Uloží se až Potvrdit (řádek) / Potvrdit vše (lišta), nebo zahodí.
     Když je označeno víc produktů checkboxem, flip na označeném řádku
     rozpracuje tutéž hodnotu pro všechny označené. */
  const [pendingFlags, setPendingFlags] = useState<
    Record<
      string,
      {
        cod_allowed?: boolean;
        clearance?: boolean;
        no_promo?: boolean;
        fragile?: boolean;
        /** Cena balení v Kč; null = smazat (= „Balné 0,-"). */
        packaging_price?: number | null;
      }
    >
  >({});
  /* Telefon: akce řádku schované pod „…" (na PC jsou vidět vždy). */
  const [openActions, setOpenActions] = useState<string | null>(null);

  /* Deep link z Rozdělení: ?produkt=<id>&druh=<kind> přepne na správnou
     záložku a rovnou řádek rozbalí — rychlé akce bez hledání. Parametry se
     hned smažou, aby další klikání po stránce nic nehijacklo. */
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollTarget = useRef<string | null>(null);
  useEffect(() => {
    const targetId = searchParams.get("produkt");
    if (!targetId) return;
    const kind = searchParams.get("druh");
    setActive(
      kind === "zakazka"
        ? "zakazky"
        : kind === "balicek"
          ? "balicky"
          : kind === "poskozene"
            ? "poskozene"
            : "produkty"
    );
    setExpanded(targetId);
    scrollTarget.current = targetId;
    const next = new URLSearchParams(searchParams);
    next.delete("produkt");
    next.delete("druh");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const expert = useExpertMode();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /* Hromadné akce a jejich vrácení žijí níž, pod `rows` — potřebují vědět,
     jaká hodnota u kusu platila před zápisem, aby šla vrátit. */
  useUndoHotkey();
  const lastUndo = useLastUndo();


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

  /* Scroll na deep-linknutý řádek až ve chvíli, kdy je vykreslený. Ruční
     Rozbalit neskroluje — jen příchod z Rozdělení. */
  useEffect(() => {
    if (!scrollTarget.current || isLoading) return;
    const el = document.getElementById(`workbench-row-${scrollTarget.current}`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      scrollTarget.current = null;
    }
  }, [isLoading, data]);

  const all = data?.products ?? [];
  const byKind = (kind: WorkbenchProduct["kind"]) =>
    all.filter((product) => product.kind === kind);
  // The route already returned only archived rows for this tab; kind is irrelevant here
  // because an archived piece keeps whatever kind it had.
  const archivedRows = all;

  const tabRows =
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
  const rows = applyCatalogFilter(tabRows, catalog);

  type FlagKey = "cod_allowed" | "clearance" | "no_promo" | "fragile";
  const savedFlag = (product: WorkbenchProduct, key: FlagKey) =>
    key === "cod_allowed"
      ? product.cod_allowed
      : key === "no_promo"
        ? product.no_promo
        : key === "fragile"
          ? product.fragile
          : product.clearance;
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

  /* Balení: zadaná cena se rozpracuje pro řádek — na označeném řádku pro celý
     výběr (stejně jako přepínače). Prázdné pole = null (balné 0,-). */
  const savedPackaging = (product: WorkbenchProduct) => product.packaging_price ?? null;
  const effectivePackaging = (product: WorkbenchProduct): number | null =>
    pendingFlags[product.id] && "packaging_price" in pendingFlags[product.id]
      ? (pendingFlags[product.id].packaging_price ?? null)
      : savedPackaging(product);
  const stagePackaging = (product: WorkbenchProduct, value: number | null) => {
    const targets =
      selected.size > 0 && selected.has(product.id) ? [...selected] : [product.id];
    setPendingFlags((prev) => {
      const next = { ...prev };
      for (const id of targets) {
        const target = rows.find((row) => row.id === id);
        if (!target) continue;
        const entry = { ...(next[id] ?? {}) };
        if (savedPackaging(target) === value) delete entry.packaging_price;
        else entry.packaging_price = value;
        if (Object.keys(entry).length === 0) delete next[id];
        else next[id] = entry;
      }
      return next;
    });
  };

  /*
   * Lišta výběru (components/bulk-bar.tsx).
   *
   * Dřív tu byl druhý způsob ukládání: dvojice tlačítek „zapnout"/„vypnout"
   * na každou vlastnost, které zapisovaly okamžitě — vedle rozpracovaných
   * změn v řádku, které se potvrzují. Dva modely v jednom okně. Lišta teď
   * zapisuje do týchž rozpracovaných změn jako řádek, takže potvrzení je
   * jedno a vede přes `applyFlags`.
   */
  const selectedRows = rows.filter((row) => selected.has(row.id));

  /** Nastaví vlastnost celému výběru na konkrétní hodnotu (ne přepnutí). */
  const stageFlagForSelection = (key: FlagKey, value: boolean) => {
    setPendingFlags((prev) => {
      const next = { ...prev };
      for (const row of selectedRows) {
        const entry = { ...(next[row.id] ?? {}) };
        if (savedFlag(row, key) === value) delete entry[key];
        else entry[key] = value;
        if (Object.keys(entry).length === 0) delete next[row.id];
        else next[row.id] = entry;
      }
      return next;
    });
  };

  const stagePackagingForSelection = (value: number | null) => {
    setPendingFlags((prev) => {
      const next = { ...prev };
      for (const row of selectedRows) {
        const entry = { ...(next[row.id] ?? {}) };
        if (savedPackaging(row) === value) delete entry.packaging_price;
        else entry.packaging_price = value;
        if (Object.keys(entry).length === 0) delete next[row.id];
        else next[row.id] = entry;
      }
      return next;
    });
  };

  /* Stav přepínače v liště čteme z rozpracovaných hodnot, ne z uložených —
     lišta má ukazovat to, co je vidět v řádcích. */
  const bulkState = (key: FlagKey) =>
    triStateOf(selectedRows, (row) => effectiveFlag(row, key));
  const bulkDirty = (key: FlagKey) =>
    selectedRows.some((row) => pendingFlags[row.id]?.[key] !== undefined);
  const bulkPackaging = sharedNumberOf(selectedRows, effectivePackaging);
  const bulkPackagingDirty = selectedRows.some(
    (row) => pendingFlags[row.id]?.packaging_price !== undefined
  );

  /** Vybrané kusy s rozpracovanou změnou — to je to, co Potvrdit odešle. */
  const selectedPendingIds = selectedRows
    .filter((row) => pendingFlags[row.id])
    .map((row) => row.id);

  const discardSelectedPending = () => {
    setPendingFlags((prev) => {
      const next = { ...prev };
      for (const id of selectedPendingIds) delete next[id];
      return next;
    });
  };

  /*
   * Archivace a skrytí zapisují rovnou — rozpracovat „archivovat" nedává
   * smysl, kus buď v obchodě je, nebo není. Vratné ale být musí, a proto se
   * před zápisem schová předchozí stav každého kusu.
   *
   * Cyklus po jednom kuse zůstává (dávkový endpoint pro produkty teprve
   * vznikne, viz spec §12), takže se počítá s tím, že část projde a část
   * ne: hotové se vrátit dají, neúspěšné zůstanou vybrané k opakování.
   */
  const zapisPoJednom = async <T,>(
    ids: string[],
    zapis: (id: string) => Promise<unknown>,
    pamet: (id: string) => T | null
  ) => {
    const hotove: T[] = [];
    const neuspesne: string[] = [];
    for (const id of ids) {
      const predchozi = pamet(id);
      try {
        await zapis(id);
        if (predchozi !== null) hotove.push(predchozi);
      } catch {
        neuspesne.push(id);
      }
    }
    return { hotove, neuspesne };
  };

  const poHromadneAkci = async (
    neuspesne: string[],
    hotovychPocet: number,
    hlaska: string,
    popisUndo: string,
    vratit: () => Promise<unknown>
  ) => {
    await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
    await queryClient.invalidateQueries({ queryKey: ["operations-products"] });
    setSelected(new Set(neuspesne));
    if (hotovychPocet > 0) {
      toastWithUndo(hlaska, popisUndo, vratit);
    }
    if (neuspesne.length > 0) {
      toast.error(
        `U ${neuspesne.length} kusů se to nepodařilo — zůstaly vybrané, zkuste to znovu.`
      );
    }
  };

  const bulkArchive = useMutation({
    mutationFn: () =>
      zapisPoJednom(
        [...selected],
        (id) =>
          sdk.client.fetch(`/admin/workbench/products/${id}/flags`, {
            method: "POST",
            body: { archived: true },
          }),
        (id) => id
      ),
    onSuccess: ({ hotove, neuspesne }) =>
      poHromadneAkci(
        neuspesne,
        hotove.length,
        `Archivováno ${hotove.length} — z obchodu pryč, historie zůstává.`,
        `Archivace ${hotove.length} kusů`,
        async () => {
          for (const id of hotove) {
            await sdk.client.fetch(`/admin/workbench/products/${id}/flags`, {
              method: "POST",
              body: { archived: false },
            });
          }
          await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
          await queryClient.invalidateQueries({ queryKey: ["operations-products"] });
        }
      ),
    onError: (e) => toast.error(ceskaChyba(e, "Archivace se nepodařila.")),
  });

  const bulkHide = useMutation({
    mutationFn: () =>
      zapisPoJednom(
        [...selected],
        (id) =>
          sdk.client.fetch(`/admin/products/${id}`, {
            method: "POST",
            body: { status: "draft" },
          }),
        (id) => {
          const row = rows.find((item) => item.id === id);
          return row ? { id, status: row.status } : null;
        }
      ),
    onSuccess: ({ hotove, neuspesne }) =>
      poHromadneAkci(
        neuspesne,
        hotove.length,
        `Skryto ${hotove.length} produktů — v obchodě nejsou, tady zůstávají.`,
        `Skrytí ${hotove.length} kusů`,
        async () => {
          for (const item of hotove) {
            await sdk.client.fetch(`/admin/products/${item.id}`, {
              method: "POST",
              body: { status: item.status },
            });
          }
          await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
          await queryClient.invalidateQueries({ queryKey: ["operations-products"] });
        }
      ),
    onError: (e) => toast.error(ceskaChyba(e, "Skrytí se nepodařilo.")),
  });

  const applyFlags = useMutation({
    mutationFn: async (ids: string[]) => {
      /* Co u kusu platilo před zápisem — jen u klíčů, kterých se změna
         doopravdy týká. Vrácení pak nepřepíše nic, na co se nesáhlo. */
      const pamet: { id: string; body: Record<string, unknown> }[] = [];
      for (const id of ids) {
        const draft = pendingFlags[id];
        if (!draft || Object.keys(draft).length === 0) continue;
        const row = rows.find((item) => item.id === id);
        if (row) {
          const predchozi: Record<string, unknown> = {};
          for (const key of Object.keys(draft)) {
            predchozi[key] =
              key === "packaging_price"
                ? savedPackaging(row)
                : savedFlag(row, key as FlagKey);
          }
          pamet.push({ id, body: predchozi });
        }
        await sdk.client.fetch(`/admin/workbench/products/${id}/flags`, {
          method: "POST",
          body: draft,
        });
      }
      return pamet;
    },
    onSuccess: async (pamet, ids) => {
      setPendingFlags((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      toastWithUndo(
        ids.length === 1 ? "Změna uložena." : `Uloženo změn: ${ids.length}.`,
        ids.length === 1 ? "Změna nastavení" : `Nastavení u ${ids.length} kusů`,
        async () => {
          for (const item of pamet) {
            await sdk.client.fetch(`/admin/workbench/products/${item.id}/flags`, {
              method: "POST",
              body: item.body,
            });
          }
          await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
        }
      );
    },
    onError: (e) =>
      toast.error(ceskaChyba(e, "Uložení se nepodařilo.")),
  });
  const pendingCount = Object.keys(pendingFlags).length;

  // Best variant wins — „can I sell it at all?" Skladem beats Dochází
  // beats Vyprodáno; a product is only Vyprodáno when EVERY variant is.
  const worstStockOf = (product: WorkbenchProduct) =>
    product.variants.reduce<"ok" | "low" | "out" | null>((best, variant) => {
      if (variant.stock_state === "ok" || best === "ok") return "ok";
      if (variant.stock_state === "low" || best === "low") return "low";
      return variant.stock_state ?? best;
    }, null);

  const toggleSelected = (productId: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(productId);
    else next.delete(productId);
    setSelected(next);
  };

  /* Mřížka — fotky vedle sebe, 2 sloupce na telefonu. Rychlé akce a rozbalení
     patří řádkům; tady je vizuální kontrola, výběr a cesta na detail. */
  const renderGridCard = (product: WorkbenchProduct) => {
    const worstStock = worstStockOf(product);
    /* Celá karta vede na detail; fotky mají vlastní ikonu (viz níž) — majitelka
       klikala na kartu a čekala detail, místo toho jí vyskakoval lightbox. */
    const openDetail = () => navigate(`/produkt/${product.id}`);
    return (
      <figure
        key={product.id}
        role="link"
        tabIndex={0}
        title="Otevřít detail produktu"
        onClick={openDetail}
        onKeyDown={(e) => {
          // Jen když je zaměřená samotná karta — ne checkbox/tlačítko uvnitř
          // (jejich keydown sem bublá a mezerník by jinak navigoval).
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDetail();
          }
        }}
        className="border-ui-border-base hover:border-ui-border-strong focus-visible:shadow-borders-focus group block cursor-pointer overflow-hidden rounded-lg border outline-none transition-colors"
      >
        <div className="relative">
          <div className="bg-ui-bg-subtle block aspect-square w-full">
            {product.thumbnail ? (
              <img
                src={product.thumbnail}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-ui-fg-muted flex h-full w-full items-center justify-center">
                <Text size="xsmall">—</Text>
              </div>
            )}
          </div>
          {/* Výběr pro hromadné akce — nesmí spustit přechod na detail. */}
          <span className="bg-ui-bg-base/80 absolute left-2 top-2 rounded-md">
            <SelectCheckbox
              className="m-0"
              checked={selected.has(product.id)}
              label={`Vybrat ${product.title}`}
              onChange={(checked) => toggleSelected(product.id, checked)}
            />
          </span>
        </div>
        <figcaption className="flex flex-col gap-1 p-2">
          <Text
            size="small"
            weight="plus"
            className="truncate group-hover:underline"
          >
            {product.title}
          </Text>
          <div className="flex items-center justify-between gap-1">
            <div className="flex flex-wrap items-center gap-1">
              {product.status !== "published" && (
                <Badge size="2xsmall" color="grey">
                  koncept
                </Badge>
              )}
              {worstStock && (
                <Badge size="2xsmall" color={stockBadge[worstStock].color}>
                  {stockBadge[worstStock].label}
                </Badge>
              )}
            </div>
            {/* Vlastní ovládání — klik nesmí propadnout do přechodu na detail. */}
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                title="Zobrazit fotky"
                aria-label="Zobrazit fotky"
                className="text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-base-hover flex size-6 items-center justify-center rounded-md transition-colors"
                onClick={() =>
                  setLightbox({ id: product.id, title: product.title })
                }
              >
                <Photo />
              </button>
              <PublishToggle product={product} />
            </div>
          </div>
        </figcaption>
      </figure>
    );
  };

  /* Kompaktní — hustý seznam pro dlouhé záložky a telefon. */
  const renderCompactRow = (product: WorkbenchProduct) => {
    const worstStock = worstStockOf(product);
    return (
      <div key={product.id} className="flex items-center gap-2 px-6 py-1.5">
        <SelectCheckbox
          checked={selected.has(product.id)}
          label={`Vybrat ${product.title}`}
          onChange={(checked) => toggleSelected(product.id, checked)}
        />
        <Thumb
          src={product.thumbnail}
          title={product.title}
          sizeClassName="size-6"
          onZoom={() => setLightbox({ id: product.id, title: product.title })}
        />
        <Link
          to={`/produkt/${product.id}`}
          className="min-w-0 flex-1 hover:underline"
        >
          <Text size="small" className="truncate">
            {product.title}
          </Text>
        </Link>
        {product.status !== "published" && (
          <Badge size="2xsmall" color="grey">
            koncept
          </Badge>
        )}
        {worstStock && (
          <Badge size="2xsmall" color={stockBadge[worstStock].color}>
            {stockBadge[worstStock].label}
          </Badge>
        )}
      </div>
    );
  };

  const renderRow = (product: WorkbenchProduct) => {
    const worstStock = worstStockOf(product);
    const priced = product.variants.filter(
      (variant) => variant.price_czk !== null
    );
    const priceMin = priced.length
      ? Math.min(...priced.map((variant) => variant.price_czk!))
      : null;
    const priceMax = priced.length
      ? Math.max(...priced.map((variant) => variant.price_czk!))
      : null;

    const settingsOn = active !== "oblibene" && active !== "archivovane";
    const placeholder = <span className={`hidden min-[1400px]:block`} />;
    const pending = pendingFlags[product.id];

    return (
      <Fragment key={product.id}>
        <article
          id={`workbench-row-${product.id}`}
          className={`grid gap-x-3 gap-y-2 px-6 py-3 min-[1400px]:items-center ${ROW_GRID}`}>
          {/* 1) Produkt: výběr, fotka, název, zařazení, odkazy */}
          <div className="flex min-w-0 items-center gap-3">
            <SelectCheckbox
              checked={selected.has(product.id)}
              label={`Vybrat ${product.title}`}
              onChange={(checked) => toggleSelected(product.id, checked)}
            />
            <Thumb
              src={product.thumbnail}
              title={product.title}
              sizeClassName="size-10"
              onZoom={() => setLightbox({ id: product.id, title: product.title })}
            />
            <div className="min-w-0">
              <Link
                to={`/produkt/${product.id}`}
                className="block w-fit max-w-full hover:underline"
                title="Otevřít detail produktu"
              >
                <Text size="small" weight="plus" className="truncate">
                  {product.title}
                </Text>
              </Link>
              <Text size="xsmall" className="text-ui-fg-subtle truncate">
                {[product.collection, ...product.categories].filter(Boolean).join(" · ") ||
                  "bez zařazení"}
                {product.kind === "zakazka" && product.production
                  ? ` · záloha min. ${product.production.deposit_floor_percentage} %, ${product.production.production_time_min_days}–${product.production.production_time_max_days} dní`
                  : product.kind === "balicek" && product.bundle
                    ? ` · balíček ${product.bundle.title}`
                    : product.kind === "poskozene"
                      ? " · jednorázový kus"
                      : ""}
              </Text>
              {/* Odkazy, které mění podstatu kusu — malé, pod názvem. */}
              <div className="txt-compact-xsmall mt-0.5 flex flex-wrap items-center gap-x-2">
                <VariantsEditor
                  productId={product.id}
                  productTitle={product.title}
                  trigger={
                    <button type="button" className="text-ui-fg-interactive hover:underline">
                      Varianty
                    </button>
                  }
                />
                {active === "produkty" && (
                  <ProductionProfileEditor
                    productId={product.id}
                    productTitle={product.title}
                    trigger={
                      <button type="button" className="text-ui-fg-subtle hover:underline">
                        Nastavit jako zakázku
                      </button>
                    }
                  />
                )}
                {active === "zakazky" && (
                  <ProductionProfileEditor
                    productId={product.id}
                    productTitle={product.title}
                    trigger={
                      <button type="button" className="text-ui-fg-interactive hover:underline">
                        Podmínky
                      </button>
                    }
                  />
                )}
                {active === "balicky" && product.bundle && (
                  <BundleEditor
                    bundleId={product.bundle.id}
                    trigger={
                      <button type="button" className="text-ui-fg-interactive hover:underline">
                        Složení
                      </button>
                    }
                  />
                )}
                {expert && <CopyId value={product.id} />}
              </div>
            </div>
            {/* Telefon: nastavení a akce řádku pod „…" — stejné jako na PC. */}
            <button
              type="button"
              className="text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-base-hover ml-auto shrink-0 rounded-md px-3 py-1.5 text-lg leading-none lg:hidden"
              aria-expanded={openActions === product.id}
              aria-label="Další nastavení a akce"
              onClick={() => setOpenActions(openActions === product.id ? null : product.id)}
            >
              …
            </button>
          </div>

          {/* 2–4) Stav, cena, prodeje — na užším displeji jedna řádka pod názvem */}
          <div className={`flex flex-wrap items-center gap-x-5 gap-y-1 pl-[92px] min-[1400px]:contents`}>
            <div className="flex flex-wrap gap-1">
              {product.status !== "published" && (
                <Badge size="2xsmall" color="grey">koncept</Badge>
              )}
              {worstStock && (
                <Badge size="2xsmall" color={stockBadge[worstStock].color}>
                  {stockBadge[worstStock].label}
                </Badge>
              )}
              {product.archived && (
                <Badge size="2xsmall" color="grey">archiv</Badge>
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
              <Text size="xsmall" className="text-ui-fg-subtle">
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
              <Text size="small">{product.sold_30d}× prodáno</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {product.wishlist_count > 0 ? `${product.wishlist_count}× oblíbené` : "bez oblíbení"}
                {product.review_average !== null ? ` · ${product.review_average} ★` : ""}
              </Text>
            </div>
          </div>

          {/* 5–10) Nastavení (každé ve svém sloupci) a akce */}
          <div
            className={`${openActions === product.id ? "flex" : "hidden"} flex-wrap items-center gap-x-4 gap-y-2 lg:flex lg:pl-[92px] min-[1400px]:contents`}
          >
            {settingsOn ? (
              <FlagSwitch
                label="Dobírka"
                title="Zákazník smí platit při převzetí — jen ČR a Česká pošta na adresu."
                checked={effectiveFlag(product, "cod_allowed")}
                dirty={pending?.cod_allowed !== undefined}
                onFlip={() => stageFlag(product, "cod_allowed")}
              />
            ) : placeholder}
            {settingsOn ? (
              <FlagSwitch
                label="Křehké"
                title="Celá zásilka s tímto kouskem pojede v křehkém režimu (Česká pošta – křehké nebo osobní odběr)."
                checked={effectiveFlag(product, "fragile")}
                dirty={pending?.fragile !== undefined}
                onFlip={() => stageFlag(product, "fragile")}
              />
            ) : placeholder}
            {settingsOn ? (
              <PackagingInput
                value={effectivePackaging(product)}
                dirty={pending?.packaging_price !== undefined}
                onChange={(value) => stagePackaging(product, value)}
              />
            ) : placeholder}
            {active === "produkty" || active === "poskozene" ? (
              <FlagSwitch
                label="Poškozené"
                title="Poškozený / poslední kus ve výprodeji — po prodeji se sám schová."
                checked={effectiveFlag(product, "clearance")}
                dirty={pending?.clearance !== undefined}
                onFlip={() => stageFlag(product, "clearance")}
              />
            ) : placeholder}
            {settingsOn ? (
              <FlagSwitch
                label="Bez slev. kódů"
                title="Slevové kódy se na tento produkt nevztahují (ani do budoucna). Vyber víc kusů a přepni je naráz."
                checked={effectiveFlag(product, "no_promo")}
                dirty={pending?.no_promo !== undefined}
                onFlip={() => stageFlag(product, "no_promo")}
              />
            ) : placeholder}

            <div className={`flex items-center gap-3 min-[1400px]:justify-end`}>
              <button
                type="button"
                title={expanded === product.id ? "Sbalit" : "Rozbalit"}
                className="text-ui-fg-subtle hover:text-ui-fg-base"
                onClick={() => setExpanded(expanded === product.id ? null : product.id)}
              >
                <ChevronDown
                  className={`transition-transform ${expanded === product.id ? "rotate-180" : ""}`}
                />
              </button>
              {active !== "oblibene" && (
                <ShippingProfileEditor
                  productId={product.id}
                  productTitle={product.title}
                  fragile={product.fragile}
                  packagingPrice={product.packaging_price}
                  trigger={
                    <button
                      type="button"
                      title="Profil dopravy (doprava a balení)"
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
                to={`/produkt/${product.id}`}
                className="text-ui-fg-interactive txt-small hover:underline"
              >
                Upravit
              </Link>
            </div>
          </div>

          {/* Rozpracované změny řádku — potvrzení na celou šířku, jen když jsou. */}
          {pending && (
            <div className="bg-ui-bg-subtle flex flex-wrap items-center justify-end gap-2 rounded-md px-2 py-1 lg:pl-[92px] col-span-full">
              <Text size="xsmall" className="text-ui-fg-subtle mr-auto">
                Neuložené změny v tomto řádku
              </Text>
              <Button
                size="small"
                isLoading={applyFlags.isPending && (applyFlags.variables ?? []).includes(product.id)}
                onClick={() => applyFlags.mutate([product.id])}
              >
                Potvrdit
              </Button>
              <Button
                size="small"
                variant="transparent"
                disabled={applyFlags.isPending}
                onClick={() =>
                  setPendingFlags((prev) => {
                    const next = { ...prev };
                    delete next[product.id];
                    return next;
                  })
                }
              >
                Zrušit
              </Button>
            </div>
          )}
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
        <div className="min-w-0">
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
          {/* Vrácení posledního hromadného úkonu. Totéž umí Ctrl+Z, ale
              zkratku nikdo nehledá — tlačítko je tu pro ruku na myši. */}
          {lastUndo && (
            <Button
              size="small"
              variant="secondary"
              title={`${lastUndo.label} — vrátit zpět (Ctrl+Z)`}
              onClick={() => void undoById(lastUndo.id)}
            >
              Vrátit zpět
            </Button>
          )}
          <ViewSwitcher value={view} onChange={changeView} />
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
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-56"
          />
        </div>
      </header>

      {/* Lišta výběru sedí dole u hrany okna, viz konec této komponenty. */}
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
      ) : active === "trideni" ? (
        /* Guided pass over the imported catalogue — one piece at a time,
           pre-filled from what the old shop knew. */
        <ProductSortingGuide />
      ) : (
        <>
          <CatalogFilterBar
            products={tabRows}
            value={catalog}
            onChange={setCatalog}
          />
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
            view === "mrizka" ? (
              <div className={gridClassName}>{rows.map(renderGridCard)}</div>
            ) : (
              <div className="divide-y">
                {view !== "kompakt" && <RowHeader />}
                {rows.map(view === "kompakt" ? renderCompactRow : renderRow)}
              </div>
            )
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

      {/*
        Lišta vybraných kusů (spec §2). Je až tady, protože se drží u dolní
        hrany okna — `sticky bottom` funguje jen tehdy, když je prvek na konci
        obsahu, který roluje. Jeden ovladač na vlastnost místo dvojice
        „zapnout"/„vypnout", a nic se neodešle bez Potvrdit.
      */}
      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          pendingCount={selectedPendingIds.length}
          onConfirm={() => applyFlags.mutate(selectedPendingIds)}
          onDiscard={discardSelectedPending}
          isSaving={applyFlags.isPending}
        >
          {active !== "oblibene" && active !== "archivovane" && (
            <>
              <BulkSwitch
                label="Dobírka"
                title="Zákazník smí platit při převzetí — jen ČR a Česká pošta na adresu."
                state={bulkState("cod_allowed")}
                dirty={bulkDirty("cod_allowed")}
                onSet={(next) => stageFlagForSelection("cod_allowed", next)}
              />
              <BulkSwitch
                label="Křehké"
                title="Celá zásilka s tímto kouskem pojede v křehkém režimu."
                state={bulkState("fragile")}
                dirty={bulkDirty("fragile")}
                onSet={(next) => stageFlagForSelection("fragile", next)}
              />
              <BulkSwitch
                label="Bez slev. kódů"
                title="Slevové kódy se na vybrané kusy nevztahují."
                state={bulkState("no_promo")}
                dirty={bulkDirty("no_promo")}
                onSet={(next) => stageFlagForSelection("no_promo", next)}
              />
              <BulkNumber
                label="Balení"
                unit="Kč"
                value={bulkPackaging.kind === "same" ? bulkPackaging.value : null}
                mixed={bulkPackaging.kind === "mixed"}
                dirty={bulkPackagingDirty}
                onSet={stagePackagingForSelection}
              />
            </>
          )}
          {/*
            Skrytí je vratné a vrácení se nabídne hned po něm — dialog by tu
            jen překážel. Archivace vratná taky je, ale sáhne na celý výběr
            a kus pak zmizí ze všech seznamů; na to se ptáme jmény (§12).
          */}
          <BulkAction
            onClick={() => bulkHide.mutate()}
            isLoading={bulkHide.isPending}
          >
            Skrýt z obchodu
          </BulkAction>
          <ConfirmDialog
            trigger={
              <Button size="small" variant="danger" className="shrink-0">
                Archivovat
              </Button>
            }
            title={
              selected.size === 1
                ? "Archivovat tenhle kus?"
                : `Archivovat ${selected.size < 5 ? `tyhle ${selected.size} kusy` : `těchhle ${selected.size} kusů`}?`
            }
            description="Z obchodu i ze seznamů zmizí; historie objednávek zůstává. Najdete je v záložce Archivované."
            items={selectedRows.map((row) => row.title)}
            consequence="Vrátit zpět to půjde deset minut (Ctrl+Z), potom už jen ručně v Archivovaných."
            confirmLabel={
              selected.size === 1
                ? "Archivovat kus"
                : `Archivovat ${selected.size} kusů`
            }
            isPending={bulkArchive.isPending}
            onConfirm={() => bulkArchive.mutate()}
          />
        </BulkBar>
      )}
    </Container>
  );
};

const queryClient = adminQueryClient;

const ProductsWorkbenchPage = () => (
  <QueryClientProvider client={queryClient}>
    <ProductsInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Produkty+",
  icon: TagSolid,
  rank: 20,
});

export default ProductsWorkbenchPage;
