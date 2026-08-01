import { HttpTypes } from "@medusajs/framework/types";
import {
  ArrowDownMini,
  ArrowUpMini,
  MagnifyingGlass,
  MinusMini,
  PlusMini,
  Trash,
} from "@medusajs/icons";
import {
  Badge,
  Heading,
  IconButton,
  Input,
  Label,
  Skeleton,
  Text,
} from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { sdk } from "../lib/sdk";

type BundleProductSummary = {
  id: string;
  title: string;
  thumbnail?: string | null;
  handle?: string | null;
  status?: HttpTypes.AdminProduct["status"];
};

export type BundleEditorItem = {
  product_id: string;
  quantity: number;
  product?: BundleProductSummary;
};

type BundleComposerProps = {
  title: string;
  onTitleChange: (value: string) => void;
  items: BundleEditorItem[];
  onItemsChange: (items: BundleEditorItem[]) => void;
  excludedProductIds?: string[];
};

const normalizeQuantity = (value: number) =>
  Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;

const ProductThumb = ({
  product,
  size = "large",
}: {
  product?: BundleProductSummary;
  size?: "small" | "large";
}) => (
  <div
    className={`bg-ui-bg-subtle shadow-borders-base flex shrink-0 items-center justify-center overflow-hidden rounded-lg ${
      size === "large" ? "size-14" : "size-10"
    }`}
  >
    {product?.thumbnail ? (
      <img src={product.thumbnail} alt="" className="size-full object-cover" />
    ) : (
      <span className="text-ui-fg-muted text-xs font-medium">
        {product?.title?.slice(0, 1).toLocaleUpperCase("cs") || "–"}
      </span>
    )}
  </div>
);

const BundleProductSearch = ({
  items,
  onItemsChange,
  excludedProductIds = [],
}: Pick<
  BundleComposerProps,
  "items" | "onItemsChange" | "excludedProductIds"
>) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const canSearch = debouncedSearch.length >= 2;
  const selectedIds = useMemo(
    () => new Set(items.map((item) => item.product_id)),
    [items]
  );
  const excludedIds = useMemo(
    () => new Set(excludedProductIds),
    [excludedProductIds]
  );

  const { data, isFetching, isError } = useQuery({
    queryKey: ["bundle-product-search", debouncedSearch],
    queryFn: () =>
      sdk.admin.product.list({
        q: debouncedSearch,
        limit: 12,
        fields: "id,title,thumbnail,handle,status",
      }),
    enabled: canSearch,
    staleTime: 30_000,
  });

  const products = (data?.products || []).filter(
    (product) => !excludedIds.has(product.id)
  );

  const addProduct = (product: HttpTypes.AdminProduct) => {
    if (selectedIds.has(product.id)) return;

    onItemsChange([
      ...items,
      {
        product_id: product.id,
        quantity: 1,
        product: {
          id: product.id,
          title: product.title,
          thumbnail: product.thumbnail,
          handle: product.handle,
          status: product.status,
        },
      },
    ]);
  };

  return (
    <section className="flex flex-col gap-y-3">
      <div className="flex items-end justify-between gap-x-4">
        <div>
          <Heading level="h2">Najít objekt</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Vyhledejte produkt podle názvu a přidejte jej do sestavy.
          </Text>
        </div>
        <Badge color="grey" size="2xsmall">
          Vyhledávání
        </Badge>
      </div>

      <div className="relative">
        <MagnifyingGlass className="text-ui-fg-muted pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Začněte psát název produktu…"
          autoComplete="off"
          className="pl-9"
          aria-label="Vyhledat produkt do balíčku"
        />
      </div>

      <div className="bg-ui-bg-subtle shadow-borders-base min-h-20 overflow-hidden rounded-lg">
        {!canSearch && (
          <div className="flex min-h-20 items-center justify-center px-4 text-center">
            <Text size="small" className="text-ui-fg-muted">
              Zadejte alespoň dva znaky. Zobrazíme jen odpovídající produkty.
            </Text>
          </div>
        )}

        {canSearch && isFetching && (
          <div className="grid gap-px p-1.5 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[58px] rounded-md" />
            ))}
          </div>
        )}

        {canSearch && !isFetching && isError && (
          <div className="flex min-h-20 items-center justify-center px-4 text-center">
            <Text size="small" className="text-ui-fg-error">
              Produkty se nepodařilo načíst. Zkuste hledání zopakovat.
            </Text>
          </div>
        )}

        {canSearch && !isFetching && !isError && !products.length && (
          <div className="flex min-h-20 items-center justify-center px-4 text-center">
            <Text size="small" className="text-ui-fg-muted">
              Pro „{debouncedSearch}“ jsme žádný produkt nenašli.
            </Text>
          </div>
        )}

        {canSearch && !isFetching && !isError && products.length > 0 && (
          <div className="grid gap-px p-1.5 md:grid-cols-2">
            {products.map((product) => {
              const selected = selectedIds.has(product.id);

              return (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => addProduct(product)}
                  disabled={selected}
                  className="bg-ui-bg-base hover:bg-ui-bg-base-hover focus-visible:shadow-borders-focus disabled:bg-ui-bg-disabled group flex min-w-0 items-center gap-x-3 rounded-md p-2 text-left outline-none transition-colors"
                >
                  <ProductThumb product={product} size="small" />
                  <span className="min-w-0 flex-1">
                    <Text size="small" weight="plus" className="truncate">
                      {product.title}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted truncate">
                      {product.handle || product.id}
                    </Text>
                  </span>
                  <span className="text-ui-fg-interactive shrink-0 text-xs font-medium">
                    {selected ? "Přidáno" : "Přidat"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

const BundleComposition = ({
  items,
  onItemsChange,
}: Pick<BundleComposerProps, "items" | "onItemsChange">) => {
  const updateItem = (index: number, patch: Partial<BundleEditorItem>) => {
    onItemsChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    );
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;

    const nextItems = [...items];
    [nextItems[index], nextItems[nextIndex]] = [
      nextItems[nextIndex],
      nextItems[index],
    ];
    onItemsChange(nextItems);
  };

  return (
    <section className="flex flex-col gap-y-3">
      <div className="flex items-end justify-between gap-x-4">
        <div>
          <Heading level="h2">Složení balíčku</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Každá položka má vlastní množství a pevné pořadí.
          </Text>
        </div>
        <Badge color={items.length ? "green" : "grey"} size="2xsmall">
          {items.length} {items.length === 1 ? "položka" : "položky"}
        </Badge>
      </div>

      {!items.length && (
        <div className="border-ui-border-strong flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
          <Heading level="h3">Balíček je zatím prázdný</Heading>
          <Text size="small" className="text-ui-fg-muted mt-1 max-w-md">
            Vyhledejte první produkt výše. Po přidání se zde objeví jeho úplné
            nastavení.
          </Text>
        </div>
      )}

      <div className="flex flex-col gap-y-2">
        {items.map((item, index) => (
          <article
            key={item.product_id}
            className="bg-ui-bg-component shadow-elevation-card-rest grid grid-cols-[40px_56px_minmax(0,1fr)] gap-3 rounded-xl p-3 md:grid-cols-[40px_56px_minmax(0,1fr)_150px_auto] md:items-center"
          >
            <div className="bg-ui-bg-subtle shadow-borders-base text-ui-fg-subtle flex size-10 items-center justify-center rounded-lg font-mono text-xs font-medium">
              {String(index + 1).padStart(2, "0")}
            </div>
            <ProductThumb product={item.product} />
            <div className="min-w-0">
              <Text weight="plus" className="truncate">
                {item.product?.title || "Vybraný produkt"}
              </Text>
              <Text size="xsmall" className="text-ui-fg-muted truncate">
                {item.product?.handle || item.product_id}
              </Text>
            </div>

            <div className="col-span-3 flex items-center justify-between gap-x-2 md:col-span-1 md:justify-start">
              <Label size="small" className="md:sr-only">
                Množství
              </Label>
              <div className="bg-ui-bg-field shadow-borders-base flex items-center rounded-md p-0.5">
                <IconButton
                  type="button"
                  variant="transparent"
                  size="small"
                  aria-label={`Snížit množství položky ${index + 1}`}
                  disabled={item.quantity <= 1}
                  onClick={() =>
                    updateItem(index, {
                      quantity: normalizeQuantity(item.quantity - 1),
                    })
                  }
                >
                  <MinusMini />
                </IconButton>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(index, {
                      quantity: normalizeQuantity(Number(event.target.value)),
                    })
                  }
                  aria-label={`Množství položky ${index + 1}`}
                  className="w-12 border-0 bg-transparent px-1 text-center shadow-none"
                />
                <IconButton
                  type="button"
                  variant="transparent"
                  size="small"
                  aria-label={`Zvýšit množství položky ${index + 1}`}
                  onClick={() =>
                    updateItem(index, {
                      quantity: normalizeQuantity(item.quantity + 1),
                    })
                  }
                >
                  <PlusMini />
                </IconButton>
              </div>
            </div>

            <div className="col-span-3 flex items-center justify-end gap-x-1 md:col-span-1">
              <IconButton
                type="button"
                variant="transparent"
                size="small"
                aria-label={`Posunout položku ${index + 1} nahoru`}
                disabled={index === 0}
                onClick={() => moveItem(index, -1)}
              >
                <ArrowUpMini />
              </IconButton>
              <IconButton
                type="button"
                variant="transparent"
                size="small"
                aria-label={`Posunout položku ${index + 1} dolů`}
                disabled={index === items.length - 1}
                onClick={() => moveItem(index, 1)}
              >
                <ArrowDownMini />
              </IconButton>
              <IconButton
                type="button"
                variant="transparent"
                size="small"
                aria-label={`Odebrat položku ${index + 1}`}
                onClick={() =>
                  onItemsChange(
                    items.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
              >
                <Trash className="text-ui-fg-error" />
              </IconButton>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export const BundleComposer = ({
  title,
  onTitleChange,
  items,
  onItemsChange,
  excludedProductIds,
}: BundleComposerProps) => (
  <div className="flex flex-col gap-y-10">
    <section className="flex flex-col gap-y-3">
      <div>
        <Heading level="h2">Název a identita</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Použijte krátký název, pod kterým zákazník sestavu pozná v obchodě.
        </Text>
      </div>
      <div className="flex flex-col gap-y-2">
        <Label htmlFor="bundle-title" size="small" weight="plus">
          Název balíčku
        </Label>
        <Input
          id="bundle-title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Například Letní výběr zahrady"
          autoComplete="off"
        />
      </div>
    </section>

    <BundleProductSearch
      items={items}
      onItemsChange={onItemsChange}
      excludedProductIds={excludedProductIds}
    />
    <BundleComposition items={items} onItemsChange={onItemsChange} />
  </div>
);
