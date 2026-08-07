import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ArchiveBox } from "@medusajs/icons";
import {
  Badge,
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
import { useEffect, useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { formatCzk } from "../../lib/workbench";
import { sdk } from "../../lib/sdk";

/**
 * Balení+ — every product's packaging cost, editable where you can see them all.
 *
 * ## Why this page exists
 *
 * The cost lives on the product, and editing it there means opening a product, opening a
 * drawer, typing one number, going back. For eighty-six pieces that is eighty-six round
 * trips, which is how a catalogue ends up half-priced and stays that way.
 *
 * ## Why there are no boxes here
 *
 * There was going to be a box catalogue, with dimensions and a packer working out which box
 * a basket needs. Decided against with the owner on 2026-08-07: **the box is folded into the
 * per-piece price instead.** Small flower wrapped for 5 Kč; if boxes and bubble wrap get
 * dearer, she raises it to 8 Kč. She is the one buying the materials, so she is the one who
 * knows — and a number she can adjust in a second beats a model that needs every product
 * measured and still argues with a stem-and-petal flower.
 *
 * So this page is deliberately a flat list of numbers. That is the whole feature.
 */

type PackagingProduct = {
  id: string;
  title: string;
  thumbnail: string | null;
  kind: "bezne" | "zakazka" | "balicek" | "poskozene";
  fragile: boolean;
  packaging_price: number | null;
};

type Response = {
  products: PackagingProduct[];
  count?: number;
  /** Set when the server returned fewer rows than matched — never silently. */
  truncated?: boolean;
  kinds: { bezne: number; zakazka: number; balicek: number; poskozene: number };
};

const tabs = [
  { key: "bezne", label: "Produkty" },
  { key: "zakazka", label: "Zakázky" },
  { key: "balicek", label: "Balíčky" },
  { key: "poskozene", label: "Poškozené" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

/** One row: the piece, whether it is fragile, and what wrapping it costs. */
const Row = ({ product }: { product: PackagingProduct }) => {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(
    product.packaging_price === null ? "" : String(product.packaging_price)
  );

  // The list refetches after every save; without this a row would keep showing
  // whatever was typed into it rather than what was stored.
  useEffect(() => {
    setValue(product.packaging_price === null ? "" : String(product.packaging_price));
  }, [product.packaging_price]);

  const save = useMutation({
    mutationFn: () => {
      const trimmed = value.trim();
      const parsed = trimmed === "" ? null : Number(trimmed);
      if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
        throw new Error("Cena musí být kladné číslo, nebo prázdná.");
      }
      return sdk.client.fetch(`/admin/workbench/products/${product.id}/flags`, {
        method: "POST",
        body: { packaging_price: parsed },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["packaging-products"] });
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      toast.success(`${product.title} — balení uloženo.`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Uložení se nepodařilo."
      ),
  });

  const unchanged =
    value.trim() ===
    (product.packaging_price === null ? "" : String(product.packaging_price));

  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3">
      {/* The picture, because she prices packaging by looking at the piece — the
          wrapping a flat tile needs and the wrapping a tall flower needs are not
          the same, and a list of names alone makes her open each product to
          remember which is which. */}
      <div className="bg-ui-bg-subtle h-12 w-12 shrink-0 overflow-hidden rounded-md">
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
      <div className="min-w-48 flex-1">
        <Text size="small">{product.title}</Text>
        {product.fragile && (
          <Badge size="2xsmall" color="orange" className="mt-1">
            křehké
          </Badge>
        )}
      </div>
      <Input
        size="small"
        type="number"
        min={0}
        className="w-28"
        placeholder="výchozí"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        // Saved on blur and on Enter — she is going down a list, so leaving a
        // field is the natural "done with this one".
        onBlur={() => !unchanged && save.mutate()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        disabled={save.isPending}
      />
      <Text size="xsmall" className="text-ui-fg-muted w-10">
        Kč
      </Text>
    </div>
  );
};

const BaleniInner = () => {
  const [active, setActive] = useState<TabKey>("bezne");
  const [search, setSearch] = useState("");

  /* Filtered server-side, for the reason spelled out in Produkty+: the route slices to
     `limit` after filtering, so asking for everything and narrowing here silently loses
     whichever kind sorts last. `kinds` is still counted across the whole catalogue, so the
     tab badges stay right. */
  const { data, isLoading, isError } = useQuery<Response>({
    queryKey: ["packaging-products", active],
    queryFn: () =>
      // No `archived` param, so the route excludes archived by default — there is no
      // point pricing the wrapping for a piece she has retired.
      sdk.client.fetch(
        `/admin/workbench/products?limit=200&kind=${encodeURIComponent(active)}`
      ),
  });

  const all = data?.products ?? [];
  const rows = all
    .filter((product) =>
      search.trim()
        ? product.title.toLowerCase().includes(search.trim().toLowerCase())
        : true
    );

  const priced = rows.filter((product) => product.packaging_price !== null);
  const total = priced.reduce(
    (sum, product) => sum + (product.packaging_price ?? 0),
    0
  );

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Balení — ceny za kus</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Co vás stojí zabalit každý kus — bublinková fólie, papír, páska
            i krabice. Připočítá se k dopravě. Prázdné pole znamená výchozí cenu
            obchodu. Zdraží-li materiál, stačí čísla tady zvednout.
          </Text>
        </div>
        <Input
          size="small"
          type="search"
          placeholder="Hledat název…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-56"
        />
      </header>

      <div className="flex flex-wrap items-center gap-2 px-6 py-4">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          const count = data?.kinds?.[tab.key];
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

      {isLoading && (
        <div className="flex flex-col gap-y-2 px-6 py-5">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
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
          title="Nic tu není"
          description="V téhle záložce zatím žádné produkty nejsou."
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          <div className="divide-y">
            {rows.map((product) => (
              <Row key={product.id} product={product} />
            ))}
          </div>
          {/* How far through she is, so a half-priced catalogue is visible rather
              than something she discovers from a wrong shipping total. */}
          <div className="px-6 py-4">
            <Text size="xsmall" className="text-ui-fg-subtle">
              {data?.truncated
                ? `Zobrazeno ${rows.length} z ${data.count} — zbytek se sem nevešel. Zkuste hledání. · `
                : ""}
              Naceněno {priced.length} z {rows.length}
              {priced.length > 0
                ? ` · dohromady ${formatCzk(total)} za kus napříč záložkou`
                : ""}
            </Text>
          </div>
        </>
      )}
    </Container>
  );
};

const queryClient = new QueryClient();

const BaleniWorkbenchPage = () => (
  <QueryClientProvider client={queryClient}>
    <BaleniInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Balení+",
  icon: ArchiveBox,
});

export default BaleniWorkbenchPage;
