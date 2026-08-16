import { ArrowUpRightOnBox, Photo, Plus, Trash } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Prompt,
  Select,
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
import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, pieces } from "../../../components/empty-state";
import {
  InlineNumber,
  InlineText,
  InlineTextarea,
} from "../../../components/inline-field";
import { ProductLightbox } from "../../../components/product-thumb";
import { ProductionProfileEditor } from "../../../components/production-profile-editor";
import { CopyId, ExpertToggle, RawData, useExpertMode } from "../../../lib/expert-mode";
import { formatDate } from "../../../lib/format";
import { sdk } from "../../../lib/sdk";

/**
 * Detail produktu — jedna stránka místo nativní editace (Matěj, 2026-08-16).
 *
 * The native product page hides every edit behind a three-dot menu and a
 * modal; this one follows the workbench rule instead: what you see is the
 * field, leaving the field saves it. Everything the shop actually uses —
 * photos, price, stock, zařazení, the workbench flags, zakázka terms — lives
 * here in one column, and the side column answers "can a customer buy this
 * and how is it doing".
 *
 * Writes go where they always go: native product endpoints for native
 * fields, the flags route for the shop's own switches (it merges), the
 * additive add-stock route for the kiln unload. The native page stays
 * reachable from Expertní režim for the rare corner this page does not cover.
 */

type NativeVariant = {
  id: string;
  title: string | null;
  sku: string | null;
  prices?: { id?: string; currency_code: string; amount: number }[];
};

type NativeProduct = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  handle: string | null;
  status: string;
  thumbnail: string | null;
  weight: number | null;
  length: number | null;
  height: number | null;
  width: number | null;
  material: string | null;
  collection_id: string | null;
  metadata: Record<string, unknown> | null;
  images?: { id?: string; url: string }[];
  categories?: { id: string; name: string }[];
  options?: { id: string; title: string }[];
  variants?: NativeVariant[];
};

type StockVariant = {
  id: string;
  available: number | null;
  reserved: number | null;
  stock_state: "low" | "out" | "ok" | null;
  inventory_item_id: string | null;
  waiting_customers: number;
  wishlist_count: number;
};

type WorkbenchDetail = {
  id: string;
  variants: StockVariant[];
  sales_by_month: { month: string; sold: number }[];
  reviews: {
    count: number;
    average: number | null;
    latest: { rating: number; title: string | null; content: string; created_at: string }[];
  };
  production: {
    enabled: boolean;
    deposit_floor_percentage: number;
    allow_full_prepayment: boolean;
  } | null;
  memberships: {
    bundles: { id: string; title: string }[];
    seasonal_selections: { id: string; title: string; status: string }[];
  };
};

const stockMeta: Record<string, { label: string; color: "green" | "orange" | "red" }> = {
  ok: { label: "skladem", color: "green" },
  low: { label: "dochází", color: "orange" },
  out: { label: "vyprodáno", color: "red" },
};

const flagOf = (product: NativeProduct | undefined, key: string): boolean =>
  Boolean(product?.metadata?.[key]);

const czkPrice = (variant: NativeVariant): number | null => {
  const czk = (variant.prices ?? []).find(
    (price) => String(price.currency_code).toLowerCase() === "czk"
  );
  return czk ? Number(czk.amount) : null;
};

const monthLabel = (month: string): string => {
  const [year, index] = month.split("-").map(Number);
  if (!year || !index) return month;
  return new Intl.DateTimeFormat("cs-CZ", { month: "long" }).format(
    new Date(year, index - 1, 1)
  );
};

const PRODUCT_FIELDS = [
  "id", "title", "subtitle", "description", "handle", "status", "thumbnail",
  "weight", "length", "height", "width", "material", "collection_id", "metadata",
  "*images", "*categories", "*options", "*variants", "*variants.prices",
].join(",");

/** Section shell — heading + hint on the left rhythm of the page. */
const Section = ({
  title,
  hint,
  children,
  action,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <section className="px-6 py-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Heading level="h2">{title}</Heading>
      {action}
    </div>
    {hint && (
      <Text size="small" className="text-ui-fg-subtle mt-1">
        {hint}
      </Text>
    )}
    <div className="mt-4">{children}</div>
  </section>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
    {children}
  </Text>
);

/** One flag row: switch, name, consequence. */
const FlagRow = ({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) => (
  <label className="flex items-start justify-between gap-4 py-3">
    <div>
      <Text size="small" weight="plus">
        {label}
      </Text>
      <Text size="small" className="text-ui-fg-subtle mt-0.5">
        {description}
      </Text>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
  </label>
);

/** Inline restock — kolik kusů přišlo z pece, nic víc. */
const RestockCell = ({
  inventoryItemId,
  onDone,
}: {
  inventoryItemId: string | null;
  onDone: () => Promise<unknown>;
}) => {
  const [amount, setAmount] = useState("");
  const add = useMutation({
    mutationFn: () => {
      const parsed = Number(amount);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("Napište prosím, kolik kusů přibylo.");
      }
      return sdk.client.fetch(`/admin/workbench/inventory/add-stock`, {
        method: "POST",
        body: { inventory_item_id: inventoryItemId, quantity: parsed },
      });
    },
    onSuccess: async () => {
      const added = Number(amount);
      setAmount("");
      await onDone();
      toast.success(`Přidáno ${pieces(added)}.`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Naskladnění se nepodařilo."),
  });

  if (!inventoryItemId) {
    return (
      <Text size="xsmall" className="text-ui-fg-muted">
        bez skladové karty
      </Text>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        size="small"
        type="number"
        min={1}
        className="w-16"
        placeholder="+ ks"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && amount) add.mutate();
        }}
        disabled={add.isPending}
      />
      <Button
        size="small"
        variant="secondary"
        isLoading={add.isPending}
        disabled={!amount}
        onClick={() => add.mutate()}
      >
        Přidat
      </Button>
    </div>
  );
};

const VariantRow = ({
  productId,
  variant,
  stock,
  canDelete,
  expert,
  invalidate,
}: {
  productId: string;
  variant: NativeVariant;
  stock: StockVariant | undefined;
  canDelete: boolean;
  expert: boolean;
  invalidate: () => Promise<unknown>;
}) => {
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch(`/admin/products/${productId}/variants/${variant.id}`, {
        method: "POST",
        body,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Varianta uložena.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Uložení se nepodařilo."),
  });

  const remove = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/products/${productId}/variants/${variant.id}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Varianta odstraněna.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Odstranění se nepodařilo."),
  });

  const state = stock?.stock_state ? stockMeta[stock.stock_state] : null;

  return (
    <div className="grid items-center gap-2 px-6 py-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_150px_170px_auto]">
      <div>
        <InlineText
          value={variant.title ?? ""}
          required
          placeholder="Název varianty"
          onSave={(next) => save.mutateAsync({ title: next })}
        />
        {expert && <CopyId value={variant.id} />}
      </div>
      <InlineText
        value={variant.sku ?? ""}
        placeholder="kód (nepovinný)"
        onSave={(next) => save.mutateAsync({ sku: next || null })}
      />
      <InlineNumber
        value={czkPrice(variant)}
        unit="Kč"
        allowEmpty={false}
        placeholder="cena"
        inputClassName="w-24"
        onSave={(next) =>
          save.mutateAsync({
            prices: [{ currency_code: "czk", amount: Number(next) }],
          })
        }
      />
      <div className="flex items-center gap-2">
        <Text size="small" className="tabular-nums">
          {stock?.available ?? "—"}
        </Text>
        {state && (
          <Badge size="2xsmall" color={state.color}>
            {state.label}
          </Badge>
        )}
      </div>
      <RestockCell
        inventoryItemId={stock?.inventory_item_id ?? null}
        onDone={invalidate}
      />
      <div className="flex justify-end">
        {canDelete && (
          <Prompt>
            <Prompt.Trigger asChild>
              <button
                type="button"
                title="Odebrat variantu"
                className="text-ui-fg-muted hover:text-ui-fg-base"
              >
                <Trash />
              </button>
            </Prompt.Trigger>
            <Prompt.Content>
              <Prompt.Header>
                <Prompt.Title>Odebrat variantu „{variant.title}"?</Prompt.Title>
                <Prompt.Description>
                  Varianta zmizí z obchodu i ze skladu. Historie objednávek zůstává.
                </Prompt.Description>
              </Prompt.Header>
              <Prompt.Footer>
                <Prompt.Cancel>Zrušit</Prompt.Cancel>
                <Prompt.Action
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  Odebrat
                </Prompt.Action>
              </Prompt.Footer>
            </Prompt.Content>
          </Prompt>
        )}
      </div>
    </div>
  );
};

const AddVariantRow = ({
  productId,
  optionTitle,
  invalidate,
}: {
  productId: string;
  optionTitle: string | undefined;
  invalidate: () => Promise<unknown>;
}) => {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");

  const add = useMutation({
    mutationFn: () => {
      if (!title.trim()) throw new Error("Varianta potřebuje název.");
      return sdk.client.fetch(`/admin/products/${productId}/variants`, {
        method: "POST",
        body: {
          title: title.trim(),
          ...(optionTitle ? { options: { [optionTitle]: title.trim() } } : {}),
          prices: price ? [{ currency_code: "czk", amount: Number(price) }] : [],
        },
      });
    },
    onSuccess: async () => {
      setTitle("");
      setPrice("");
      await invalidate();
      toast.success("Varianta přidána.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Přidání se nepodařilo."),
  });

  return (
    <div className="mx-6 my-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2">
      <Input
        size="small"
        className="min-w-40 flex-1"
        placeholder="Nová varianta (např. Modrá)"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Input
        size="small"
        className="w-28"
        type="number"
        placeholder="Kč"
        value={price}
        onChange={(event) => setPrice(event.target.value)}
      />
      <Button size="small" isLoading={add.isPending} onClick={() => add.mutate()}>
        Přidat
      </Button>
    </div>
  );
};

/** „Než publikujete" + kupitelnost — one merged checklist, warnings only. */
const ReadinessCard = ({
  product,
  detail,
}: {
  product: NativeProduct;
  detail: WorkbenchDetail | undefined;
}) => {
  const variants = product.variants ?? [];
  const hasPrice = variants.some((variant) => czkPrice(variant) !== null);
  const hasWeight = Boolean(product.weight);
  const allOut =
    detail !== undefined &&
    detail.variants.length > 0 &&
    detail.variants.every((variant) => (variant.available ?? 0) <= 0) &&
    !detail.production?.enabled;

  const checks = [
    {
      label: "Fotografie",
      ok: Boolean(product.thumbnail || (product.images ?? []).length),
      why: "Bez fotky si kousek nikdo nekoupí.",
    },
    {
      label: "Cena",
      ok: hasPrice,
      why: "Bez ceny produkt nepůjde publikovat.",
    },
    {
      label: "Popis",
      ok: Boolean(product.description?.trim()),
      why: "Pár vět o kousku pomáhá i ve vyhledávání.",
    },
    {
      label: "Kategorie nebo kolekce",
      ok: Boolean((product.categories ?? []).length || product.collection_id),
      why: "Jinak ho zákazníci najdou jen přes vyhledávání.",
    },
    {
      label: "Hmotnost",
      ok: hasWeight,
      why: "Podle hmotnosti se počítá doprava — bez ní může být špatně.",
    },
    {
      label: "Kusy skladem",
      ok: !allOut,
      why: "Všechno je vyprodané a kus se nevyrábí na zakázku — zákazník nemá co koupit.",
    },
  ];
  const missing = checks.filter((check) => !check.ok);

  return (
    <section className="px-6 py-5">
      <div className="flex items-center gap-x-2">
        <Heading level="h2">Než publikujete</Heading>
        {missing.length > 0 && (
          <Badge size="2xsmall" color="orange">
            {missing.length}
          </Badge>
        )}
      </div>
      <Text size="small" className="text-ui-fg-subtle mt-1">
        {missing.length
          ? "Tohle ještě chybí. Publikovat můžete i tak — je to jen upozornění."
          : "Všechno je vyplněné. Kus je připravený."}
      </Text>
      <div className="mt-3 flex flex-col">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex items-start justify-between gap-3 py-2"
          >
            <div>
              <Text size="small" weight="plus">
                {check.label}
              </Text>
              {!check.ok && (
                <Text size="small" className="text-ui-fg-subtle mt-0.5">
                  {check.why}
                </Text>
              )}
            </div>
            <Badge size="2xsmall" color={check.ok ? "green" : "orange"}>
              {check.ok ? "Hotovo" : "Chybí"}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  );
};

const ProduktDetailInner = ({ productId }: { productId: string }) => {
  const queryClient = useQueryClient();
  const expert = useExpertMode();
  const [lightbox, setLightbox] = useState<{ id: string; title: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const productQuery = useQuery<{ product: NativeProduct }>({
    queryKey: ["produkt", productId],
    queryFn: () =>
      sdk.client.fetch(`/admin/products/${productId}?fields=${PRODUCT_FIELDS}`),
    retry: false,
    refetchOnWindowFocus: true,
  });

  const detailQuery = useQuery<WorkbenchDetail>({
    queryKey: ["produkt-workbench", productId],
    queryFn: () => sdk.client.fetch(`/admin/workbench/products/${productId}`),
    refetchOnWindowFocus: true,
  });

  const collectionsQuery = useQuery<{ collections: { id: string; title: string }[] }>({
    queryKey: ["produkt-collections"],
    queryFn: () =>
      sdk.client.fetch(`/admin/collections?limit=100&fields=id,title`),
    staleTime: 5 * 60_000,
  });

  const categoriesQuery = useQuery<{
    product_categories: { id: string; name: string; is_active: boolean }[];
  }>({
    queryKey: ["produkt-categories"],
    queryFn: () =>
      sdk.client.fetch(`/admin/product-categories?limit=100&fields=id,name,is_active`),
    staleTime: 5 * 60_000,
  });

  const product = productQuery.data?.product;
  const detail = detailQuery.data;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["produkt", productId] });
    await queryClient.invalidateQueries({ queryKey: ["produkt-workbench", productId] });
  };

  // Native fields — title, description, zařazení, rozměry… One mutation, the
  // patch decides. Never carries the shop's own switches (those merge below).
  const saveProduct = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      sdk.client.fetch(`/admin/products/${productId}`, {
        method: "POST",
        body: patch,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Změna uložena.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Uložení se nepodařilo."),
  });

  const saveFlags = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      sdk.client.fetch(`/admin/workbench/products/${productId}/flags`, {
        method: "POST",
        body: patch,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Změna uložena.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Uložení se nepodařilo."),
  });

  const uploadImages = useMutation({
    mutationFn: async (files: File[]) => {
      const result = await sdk.admin.upload.create({ files });
      const urls = (result.files ?? [])
        .map((file: { url?: string }) => file.url)
        .filter(Boolean) as string[];
      if (!urls.length) throw new Error("Fotky se nepodařilo nahrát.");
      const existing = (product?.images ?? []).map((image) => ({
        id: image.id,
        url: image.url,
      }));
      return sdk.client.fetch(`/admin/products/${productId}`, {
        method: "POST",
        body: {
          images: [...existing, ...urls.map((url) => ({ url }))],
          ...(product?.thumbnail ? {} : { thumbnail: urls[0] }),
        },
      });
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Fotky nahrány.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Nahrání se nepodařilo."),
  });

  if (productQuery.isLoading) {
    return (
      <Container className="p-0">
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </Container>
    );
  }

  if (productQuery.isError || !product) {
    return (
      <Container className="p-0">
        <EmptyState
          title="Produkt nebyl nalezen"
          description="Možná byl smazán, nebo je odkaz starý."
          action={
            <Button size="small" variant="secondary" asChild>
              <Link to="/produkty-workbench">Zpět na Produkty+</Link>
            </Button>
          }
        />
      </Container>
    );
  }

  const isPublished = product.status === "published";
  const archived = flagOf(product, "archived");
  const clearance = flagOf(product, "clearance");
  const production = detail?.production ?? null;
  const isBundle = (detail?.memberships.bundles ?? []).length > 0;
  const packagingPrice =
    typeof product.metadata?.packaging_price === "number"
      ? (product.metadata.packaging_price as number)
      : null;
  const variants = product.variants ?? [];
  const stockByVariant = new Map(
    (detail?.variants ?? []).map((variant) => [variant.id, variant])
  );
  const soldTotal = (detail?.sales_by_month ?? []).reduce(
    (sum, month) => sum + month.sold,
    0
  );
  const wishlistTotal = (detail?.variants ?? []).reduce(
    (sum, variant) => sum + variant.wishlist_count,
    0
  );
  const waitingTotal = (detail?.variants ?? []).reduce(
    (sum, variant) => sum + variant.waiting_customers,
    0
  );
  const categories = categoriesQuery.data?.product_categories ?? [];
  const selectedCategories = new Set((product.categories ?? []).map((c) => c.id));

  const toggleCategory = (categoryId: string) => {
    const current = (product.categories ?? []).map((c) => ({ id: c.id }));
    const next = selectedCategories.has(categoryId)
      ? current.filter((c) => c.id !== categoryId)
      : [...current, { id: categoryId }];
    saveProduct.mutate({ categories: next });
  };

  const removeImage = (url: string) => {
    const remaining = (product.images ?? []).filter((image) => image.url !== url);
    saveProduct.mutate({
      images: remaining.map((image) => ({ id: image.id, url: image.url })),
      ...(product.thumbnail === url
        ? { thumbnail: remaining[0]?.url ?? null }
        : {}),
    });
  };

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <ProductLightbox product={lightbox} onClose={() => setLightbox(null)} />

      {/* ————— Hlavička ————— */}
      <header className="flex flex-wrap items-start justify-between gap-4 px-6 pb-4 pt-6">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <button
            type="button"
            title="Zvětšit fotku"
            className="bg-ui-bg-subtle size-14 shrink-0 overflow-hidden rounded-md"
            onClick={() =>
              setLightbox({ id: product.id, title: product.title })
            }
          >
            {product.thumbnail ? (
              <img
                src={product.thumbnail}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-ui-fg-muted flex h-full w-full items-center justify-center">
                <Photo />
              </div>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <InlineText
              value={product.title}
              required
              placeholder="Název produktu"
              inputClassName="txt-large font-medium"
              onSave={(next) => saveProduct.mutateAsync({ title: next })}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge size="2xsmall" color={isPublished ? "green" : "grey"}>
                {isPublished ? "publikováno" : "koncept"}
              </Badge>
              {production?.enabled && (
                <Badge size="2xsmall" color="purple">
                  zakázka
                </Badge>
              )}
              {isBundle && (
                <Badge size="2xsmall" color="blue">
                  balíček
                </Badge>
              )}
              {clearance && (
                <Badge size="2xsmall" color="orange">
                  výprodej
                </Badge>
              )}
              {archived && (
                <Badge size="2xsmall" color="red">
                  archiv
                </Badge>
              )}
              {expert && <CopyId value={product.id} />}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="small"
            variant={isPublished ? "secondary" : "primary"}
            isLoading={saveProduct.isPending}
            onClick={() =>
              saveProduct.mutate({ status: isPublished ? "draft" : "published" })
            }
          >
            {isPublished ? "Skrýt z obchodu" : "Publikovat"}
          </Button>
          <Button
            size="small"
            variant="transparent"
            isLoading={saveFlags.isPending}
            onClick={() => {
              if (archived) {
                saveFlags.mutate({ archived: false });
              } else {
                saveFlags.mutate({ archived: true });
                saveProduct.mutate({ status: "draft" });
              }
            }}
          >
            {archived ? "Obnovit z archivu" : "Archivovat"}
          </Button>
          <ExpertToggle />
          {expert && (
            <Button size="small" variant="transparent" asChild>
              <Link to={`/products/${product.id}`}>
                Původní editace <ArrowUpRightOnBox />
              </Link>
            </Button>
          )}
        </div>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* ————— Levý sloupec: editace ————— */}
        <div className="divide-y">
          <Section
            title="Základní údaje"
            hint="Píšete přímo do polí — opuštění pole uloží."
          >
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel>Popis</FieldLabel>
                <div className="mt-1">
                  <InlineTextarea
                    value={product.description}
                    placeholder="Pár vět o kousku — z čeho je, jak vznikl, jak o něj pečovat…"
                    rows={5}
                    onSave={(next) =>
                      saveProduct.mutateAsync({ description: next || null })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Podtitulek</FieldLabel>
                  <div className="mt-1">
                    <InlineText
                      value={product.subtitle}
                      placeholder="např. ručně točená kamenina"
                      onSave={(next) =>
                        saveProduct.mutateAsync({ subtitle: next || null })
                      }
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>Materiál</FieldLabel>
                  <div className="mt-1">
                    <InlineText
                      value={product.material}
                      placeholder="např. kamenina, glazura"
                      onSave={(next) =>
                        saveProduct.mutateAsync({ material: next || null })
                      }
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>Hmotnost</FieldLabel>
                  <div className="mt-1">
                    <InlineNumber
                      value={product.weight}
                      unit="g"
                      placeholder="—"
                      onSave={(next) => saveProduct.mutateAsync({ weight: next })}
                    />
                  </div>
                  <Text size="xsmall" className="text-ui-fg-muted mt-1">
                    Podle hmotnosti se počítá doprava.
                  </Text>
                </div>
                <div>
                  <FieldLabel>Rozměry (cm)</FieldLabel>
                  <div className="mt-1 flex items-center gap-2">
                    <InlineNumber
                      value={product.length}
                      placeholder="délka"
                      inputClassName="w-20"
                      onSave={(next) => saveProduct.mutateAsync({ length: next })}
                    />
                    <InlineNumber
                      value={product.width}
                      placeholder="šířka"
                      inputClassName="w-20"
                      onSave={(next) => saveProduct.mutateAsync({ width: next })}
                    />
                    <InlineNumber
                      value={product.height}
                      placeholder="výška"
                      inputClassName="w-20"
                      onSave={(next) => saveProduct.mutateAsync({ height: next })}
                    />
                  </div>
                </div>
                {expert && (
                  <div>
                    <FieldLabel>Adresa v obchodě</FieldLabel>
                    <div className="mt-1">
                      <InlineText
                        value={product.handle}
                        required
                        placeholder="adresa-produktu"
                        onSave={(next) =>
                          saveProduct.mutateAsync({
                            handle: next
                              .toLowerCase()
                              .replace(/[^a-z0-9-]+/g, "-")
                              .replace(/^-+|-+$/g, ""),
                          })
                        }
                      />
                    </div>
                    <Text size="xsmall" className="text-ui-fg-muted mt-1">
                      Změna rozbije staré odkazy na produkt.
                    </Text>
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section
            title="Fotky"
            hint="První dojem. Hlavní fotka se ukazuje v seznamech a na kartě."
            action={
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    if (files.length) uploadImages.mutate(files);
                    event.target.value = "";
                  }}
                />
                <Button
                  size="small"
                  variant="secondary"
                  isLoading={uploadImages.isPending}
                  onClick={() => fileInput.current?.click()}
                >
                  <Plus /> Nahrát fotky
                </Button>
              </>
            }
          >
            {(product.images ?? []).length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle">
                Zatím žádné fotky. Bez fotky si kousek nikdo nekoupí.
              </Text>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                {(product.images ?? []).map((image) => {
                  const isMain = product.thumbnail === image.url;
                  return (
                    <figure key={image.url} className="group relative">
                      <img
                        src={image.url}
                        alt=""
                        loading="lazy"
                        className={`aspect-square w-full rounded-md object-cover ${
                          isMain ? "ring-ui-border-interactive ring-2" : ""
                        }`}
                      />
                      <figcaption className="mt-1 flex items-center justify-between gap-1">
                        {isMain ? (
                          <Badge size="2xsmall" color="blue">
                            hlavní
                          </Badge>
                        ) : (
                          <button
                            type="button"
                            className="text-ui-fg-muted txt-xsmall hover:text-ui-fg-base"
                            onClick={() =>
                              saveProduct.mutate({ thumbnail: image.url })
                            }
                          >
                            Nastavit jako hlavní
                          </button>
                        )}
                        <button
                          type="button"
                          title="Smazat fotku"
                          className="text-ui-fg-muted hover:text-ui-fg-base"
                          onClick={() => removeImage(image.url)}
                        >
                          <Trash />
                        </button>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            )}
          </Section>

          <section className="py-5">
            <div className="px-6">
              <Heading level="h2">Varianty a ceny</Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">
                Název, kód, cena i naskladnění — všechno rovnou tady, ukládá se
                při opuštění pole.
              </Text>
            </div>
            <div className="text-ui-fg-muted mt-4 hidden gap-2 px-6 pb-1 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_150px_170px_auto]">
              <Text size="xsmall" weight="plus" className="uppercase">Název</Text>
              <Text size="xsmall" weight="plus" className="uppercase">Kód</Text>
              <Text size="xsmall" weight="plus" className="uppercase">Cena</Text>
              <Text size="xsmall" weight="plus" className="uppercase">Skladem</Text>
              <Text size="xsmall" weight="plus" className="uppercase">Naskladnit</Text>
              <span />
            </div>
            <div className="divide-y border-t">
              {variants.map((variant) => (
                <VariantRow
                  key={variant.id}
                  productId={product.id}
                  variant={variant}
                  stock={stockByVariant.get(variant.id)}
                  canDelete={variants.length > 1}
                  expert={expert}
                  invalidate={invalidate}
                />
              ))}
            </div>
            <AddVariantRow
              productId={product.id}
              optionTitle={product.options?.[0]?.title}
              invalidate={invalidate}
            />
          </section>

          <Section
            title="Zařazení"
            hint="Kolekce a kategorie určují, kde zákazníci kousek najdou."
          >
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel>Kolekce</FieldLabel>
                <div className="mt-1 max-w-72">
                  <Select
                    value={product.collection_id ?? "none"}
                    onValueChange={(next) =>
                      saveProduct.mutate({
                        collection_id: next === "none" ? null : next,
                      })
                    }
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Bez kolekce" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="none">Bez kolekce</Select.Item>
                      {(collectionsQuery.data?.collections ?? []).map(
                        (collection) => (
                          <Select.Item key={collection.id} value={collection.id}>
                            {collection.title}
                          </Select.Item>
                        )
                      )}
                    </Select.Content>
                  </Select>
                </div>
              </div>
              <div>
                <FieldLabel>Kategorie</FieldLabel>
                <div className="mt-2 flex flex-wrap gap-2">
                  {categories.length === 0 && (
                    <Text size="small" className="text-ui-fg-subtle">
                      Zatím žádné kategorie — založíte je v Rozdělení.
                    </Text>
                  )}
                  {categories.map((category) => {
                    const selected = selectedCategories.has(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        disabled={saveProduct.isPending}
                        onClick={() => toggleCategory(category.id)}
                        className={`transition-fg rounded-full border px-3 py-1 ${
                          selected
                            ? "border-ui-border-interactive bg-ui-bg-base-pressed text-ui-fg-base"
                            : "border-ui-border-base bg-ui-bg-base text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                        }`}
                      >
                        <Text size="xsmall" weight={selected ? "plus" : "regular"}>
                          {category.name}
                        </Text>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Vlastnosti prodeje"
            hint="Přepínače platí hned — žádné ukládání navíc."
          >
            <div className="divide-y">
              <FlagRow
                label="Výprodej"
                description="Poškozený nebo jedinečný kousek. Po vyprodání se sám skryje z obchodu."
                checked={clearance}
                disabled={saveFlags.isPending}
                onChange={(next) => saveFlags.mutate({ clearance: next })}
              />
              <FlagRow
                label="Dobírka"
                description="Dopravce smí vybrat peníze při předání."
                checked={flagOf(product, "cod_allowed")}
                disabled={saveFlags.isPending}
                onChange={(next) => saveFlags.mutate({ cod_allowed: next })}
              />
              <FlagRow
                label="Křehké"
                description="Celá zásilka s tímto kouskem pojede v křehkém režimu."
                checked={flagOf(product, "fragile")}
                disabled={saveFlags.isPending}
                onChange={(next) => saveFlags.mutate({ fragile: next })}
              />
              <FlagRow
                label="Personalizace"
                description="Cena se počítá podle rozměrů, které zákazník zadá v obchodě."
                checked={flagOf(product, "is_personalized")}
                disabled={saveFlags.isPending}
                onChange={(next) => saveFlags.mutate({ is_personalized: next })}
              />
              <div className="flex items-start justify-between gap-4 py-3">
                <div>
                  <Text size="small" weight="plus">
                    Cena balení
                  </Text>
                  <Text size="small" className="text-ui-fg-subtle mt-0.5">
                    Co stojí zabalit tento kus. Prázdné pole = výchozí cena obchodu.
                  </Text>
                </div>
                <InlineNumber
                  value={packagingPrice}
                  unit="Kč"
                  placeholder="výchozí"
                  onSave={(next) => saveFlags.mutateAsync({ packaging_price: next })}
                />
              </div>
            </div>
          </Section>

          <Section
            title="Zakázková výroba"
            hint={
              production?.enabled
                ? "Kus se vyrábí na objednávku — zákazník platí zálohu a čeká na výrobu."
                : "Běžný kus ze skladu. Zapnout zakázkovou výrobu můžete tady."
            }
            action={
              <ProductionProfileEditor
                productId={product.id}
                productTitle={product.title}
                trigger={
                  <Button size="small" variant="secondary">
                    {production?.enabled ? "Upravit podmínky" : "Nastavit zakázku"}
                  </Button>
                }
              />
            }
          >
            {production?.enabled ? (
              <div className="flex flex-wrap gap-6">
                <div>
                  <FieldLabel>Záloha minimálně</FieldLabel>
                  <Text size="small" className="mt-1">
                    {production.deposit_floor_percentage} %
                  </Text>
                </div>
                <div>
                  <FieldLabel>Platba předem celá</FieldLabel>
                  <Text size="small" className="mt-1">
                    {production.allow_full_prepayment ? "povolena" : "nepovolena"}
                  </Text>
                </div>
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-subtle">
                Zákazník kupuje jen to, co je skladem.
              </Text>
            )}
          </Section>
        </div>

        {/* ————— Pravý sloupec: jak se kusu daří ————— */}
        <div className="divide-y border-t xl:border-l xl:border-t-0">
          <ReadinessCard product={product} detail={detail} />

          <section className="px-6 py-5">
            <Heading level="h2">Prodeje za půl roku</Heading>
            <div className="mt-3 flex flex-col gap-1">
              {(detail?.sales_by_month ?? []).map((month) => (
                <div
                  key={month.month}
                  className="flex items-center justify-between gap-2"
                >
                  <Text size="small" className="text-ui-fg-subtle capitalize">
                    {monthLabel(month.month)}
                  </Text>
                  <Text size="small" className="tabular-nums">
                    {month.sold ? pieces(month.sold) : "—"}
                  </Text>
                </div>
              ))}
            </div>
            <div className="border-ui-border-base mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t pt-3">
              <Text size="small" className="text-ui-fg-subtle">
                Celkem prodáno: <strong>{pieces(soldTotal)}</strong>
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                V seznamech přání: <strong>{wishlistTotal}</strong>
              </Text>
              {waitingTotal > 0 && (
                <Text size="small" className="text-ui-fg-subtle">
                  Čeká na naskladnění: <strong>{waitingTotal}</strong>
                </Text>
              )}
            </div>
          </section>

          <section className="px-6 py-5">
            <div className="flex items-center gap-2">
              <Heading level="h2">Recenze</Heading>
              {detail?.reviews.average != null && (
                <Badge size="2xsmall" color="green">
                  ★ {detail.reviews.average}
                </Badge>
              )}
            </div>
            {detail?.reviews.count ? (
              <div className="mt-3 flex flex-col gap-3">
                {detail.reviews.latest.map((review, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between gap-2">
                      <Text size="small" weight="plus">
                        {"★".repeat(Math.max(1, Math.round(review.rating)))}
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-muted">
                        {formatDate(review.created_at)}
                      </Text>
                    </div>
                    <Text size="small" className="text-ui-fg-subtle mt-0.5">
                      {review.content.length > 160
                        ? `${review.content.slice(0, 160)}…`
                        : review.content}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-subtle mt-2">
                Zatím žádné recenze.
              </Text>
            )}
          </section>

          <section className="px-6 py-5">
            <Heading level="h2">Kde je zapojen</Heading>
            {isBundle || (detail?.memberships.seasonal_selections ?? []).length ? (
              <div className="mt-3 flex flex-col gap-2">
                {(detail?.memberships.bundles ?? []).map((bundle) => (
                  <Text size="small" key={bundle.id}>
                    Balíček{" "}
                    <Link
                      to="/bundled-products"
                      className="text-ui-fg-interactive hover:underline"
                    >
                      {bundle.title}
                    </Link>
                  </Text>
                ))}
                {(detail?.memberships.seasonal_selections ?? []).map(
                  (selection) => (
                    <Text size="small" key={selection.id}>
                      Sezónní akce{" "}
                      <Link
                        to="/sezonni-vybery"
                        className="text-ui-fg-interactive hover:underline"
                      >
                        {selection.title}
                      </Link>
                    </Text>
                  )
                )}
                <Text size="xsmall" className="text-ui-fg-muted mt-1">
                  Změna ceny se propíše i tam — počítejte s tím.
                </Text>
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-subtle mt-2">
                Nikde — kus není v žádném balíčku ani akci.
              </Text>
            )}
          </section>

          <section className="px-6 py-5">
            <RawData data={{ product, detail }} />
            {!expert && (
              <Text size="xsmall" className="text-ui-fg-muted">
                Expertní režim v hlavičce ukáže i surová data a původní editaci.
              </Text>
            )}
          </section>
        </div>
      </div>
    </Container>
  );
};

const queryClient = new QueryClient();

const ProduktDetailPage = () => {
  const { id } = useParams();
  if (!id) {
    return null;
  }
  return (
    <QueryClientProvider client={queryClient}>
      <ProduktDetailInner productId={id} />
    </QueryClientProvider>
  );
};

// Deliberately no `config` export — the page is reached from product lists,
// not from the sidebar (same convention as merchant-catalog and novy-produkt).
export default ProduktDetailPage;
