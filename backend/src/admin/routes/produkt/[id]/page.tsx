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
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState, pieces } from "../../../components/empty-state";
import {
  InlineNumber,
  InlineText,
  InlineTextarea,
} from "../../../components/inline-field";
import { ProductLightbox } from "../../../components/product-thumb";
import { ProductionProfileEditor } from "../../../components/production-profile-editor";
import { CopyId, ExpertToggle, RawData, useExpertMode } from "../../../lib/expert-mode";
import { formatDate, formatDateTime } from "../../../lib/format";
import { sdk } from "../../../lib/sdk";
import { formatCzk } from "../../../lib/workbench";

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
  allow_backorder?: boolean;
  /** Carries the variant's own photos (`images`) and customer note (`note`). */
  metadata?: Record<string, unknown> | null;
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
  created_at?: string;
  updated_at?: string;
  collection?: { id: string; title: string } | null;
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
  store_url?: string | null;
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
  "created_at", "updated_at",
  "*collection", "*images", "*categories", "*options", "*variants",
  "*variants.prices", "variants.metadata",
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

  /*
   * A variant is a mini-product: its own photos and note live on its metadata.
   * The storefront shows them the moment the customer picks this provedení —
   * a blue glaze sold by a photo of the green one is a return waiting to happen.
   */
  const photoInput = useRef<HTMLInputElement>(null);
  const photos = Array.isArray(variant.metadata?.images)
    ? (variant.metadata.images as unknown[]).filter(
        (url): url is string => typeof url === "string"
      )
    : [];
  const note =
    typeof variant.metadata?.note === "string" ? variant.metadata.note : "";
  const saveMeta = (patch: Record<string, unknown>) =>
    save.mutateAsync({ metadata: { ...(variant.metadata ?? {}), ...patch } });

  const uploadPhotos = useMutation({
    mutationFn: async (files: File[]) => {
      const result = await sdk.admin.upload.create({ files });
      const urls = (result.files ?? [])
        .map((file: { url?: string }) => file.url)
        .filter(Boolean) as string[];
      if (!urls.length) throw new Error("Fotky se nepodařilo nahrát.");
      return saveMeta({ images: [...photos, ...urls] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Nahrání se nepodařilo."),
  });

  const state = stock?.stock_state ? stockMeta[stock.stock_state] : null;

  return (
    <div className="px-6 py-3">
    <div className="grid items-center gap-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_150px_170px_auto]">
      <div>
        <InlineText
          value={variant.title ?? ""}
          required
          placeholder="Název varianty"
          onSave={(next) => save.mutateAsync({ title: next })}
        />
        {expert && <CopyId value={variant.id} />}
      </div>
      <div>
        <div className="mb-1 lg:hidden">
          <FieldLabel>Kód</FieldLabel>
        </div>
        <InlineText
          value={variant.sku ?? ""}
          placeholder="kód (nepovinný)"
          onSave={(next) => save.mutateAsync({ sku: next || null })}
        />
      </div>
      <div>
        <div className="mb-1 lg:hidden">
          <FieldLabel>Cena</FieldLabel>
        </div>
        <InlineNumber
          value={czkPrice(variant)}
          unit="Kč"
          allowEmpty={false}
          placeholder="cena"
          inputClassName="w-24"
          onSave={(next) =>
            save.mutateAsync({
              // The price list replaces wholesale — foreign currencies are
              // derived by the daily ČNB job and must ride along, or a CZK
              // edit would wipe them until the next fixing.
              prices: [
                { currency_code: "czk", amount: Number(next) },
                ...(variant.prices ?? [])
                  .filter(
                    (price) =>
                      String(price.currency_code).toLowerCase() !== "czk"
                  )
                  .map((price) => ({
                    currency_code: price.currency_code,
                    amount: price.amount,
                  })),
              ],
            })
          }
        />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="lg:hidden">
            <FieldLabel>Skladem</FieldLabel>
          </span>
          <Text size="small" className="tabular-nums">
            {stock?.available ?? "—"}
          </Text>
          {state && (
            <Badge size="2xsmall" color={state.color}>
              {state.label}
            </Badge>
          )}
        </div>
        {(Number(stock?.reserved) > 0 ||
          Number(stock?.waiting_customers) > 0 ||
          Number(stock?.wishlist_count) > 0) && (
          <Text size="xsmall" className="text-ui-fg-muted mt-0.5">
            {[
              Number(stock?.reserved) > 0 && `${stock?.reserved} rezervováno`,
              Number(stock?.waiting_customers) > 0 &&
                `${stock?.waiting_customers} čeká`,
              Number(stock?.wishlist_count) > 0 &&
                `${stock?.wishlist_count}× v oblíbených`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        )}
      </div>
      <div>
        <div className="mb-1 lg:hidden">
          <FieldLabel>Naskladnit</FieldLabel>
        </div>
        <RestockCell
          inventoryItemId={stock?.inventory_item_id ?? null}
          onDone={invalidate}
        />
      </div>
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

    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((url, index) => (
          <figure key={url} className="group relative m-0">
            <button
              type="button"
              title={index === 0 ? "Hlavní fotka varianty" : "Nastavit jako hlavní"}
              onClick={() => {
                if (index === 0) return;
                void saveMeta({
                  images: [url, ...photos.filter((entry) => entry !== url)],
                });
              }}
              className={`block size-12 overflow-hidden rounded-md ${
                index === 0 ? "shadow-borders-interactive-with-active" : "shadow-borders-base"
              }`}
            >
              <img src={url} alt="" className="size-full object-cover" />
            </button>
            <button
              type="button"
              title="Odebrat fotku"
              onClick={() =>
                void saveMeta({
                  images: photos.filter((entry) => entry !== url),
                })
              }
              className="bg-ui-bg-base text-ui-fg-muted hover:text-ui-fg-base shadow-borders-base absolute -right-1.5 -top-1.5 hidden size-4 items-center justify-center rounded-full text-[10px] leading-none group-hover:flex"
            >
              ×
            </button>
          </figure>
        ))}
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length) uploadPhotos.mutate(files);
            event.target.value = "";
          }}
        />
        <Button
          size="small"
          variant="secondary"
          isLoading={uploadPhotos.isPending}
          onClick={() => photoInput.current?.click()}
        >
          <Plus /> Fotka varianty
        </Button>
        <Text size="xsmall" className="text-ui-fg-muted">
          {photos.length
            ? "Zákazník je uvidí po zvolení tohohle provedení."
            : "Bez vlastních fotek platí fotky produktu."}
        </Text>
      </div>
      <div className="flex items-center gap-2">
        <FieldLabel>Poznámka</FieldLabel>
        <div className="min-w-0 flex-1">
          <InlineText
            value={note}
            placeholder="např. glazura kobalt, každý kus se liší — uvidí zákazník"
            onSave={(next) => saveMeta({ note: next || null })}
          />
        </div>
      </div>
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
          // The shop default: a sold-out piece keeps selling (stock goes
          // negative); the page's „Objednání bez skladu" switch turns it off.
          allow_backorder: true,
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
  const anyBackorder = variants.some((variant) => variant.allow_backorder);
  const allOut =
    detail !== undefined &&
    detail.variants.length > 0 &&
    detail.variants.every((variant) => (variant.available ?? 0) <= 0) &&
    !detail.production?.enabled &&
    !anyBackorder;

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
      label: "Kusy skladem",
      ok: !allOut,
      why: "Všechno je vyprodané, kus se nevyrábí na zakázku a objednání bez skladu je vypnuté — zákazník nemá co koupit.",
    },
    {
      label: "Hmotnost",
      ok: Boolean(product.weight),
      why: "Bez hmotnosti se cena dopravy počítá z výchozího odhadu.",
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
  const navigate = useNavigate();
  const expert = useExpertMode();
  const [lightbox, setLightbox] = useState<{ id: string; title: string } | null>(null);
  const [discountPercent, setDiscountPercent] = useState("20");
  const [discountClearance, setDiscountClearance] = useState(true);
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

  // The material offer = every material the catalogue already uses; adding a
  // new one on any product teaches it to the whole admin.
  const materialsQuery = useQuery<{ materials: string[] }>({
    queryKey: ["produkt-materials"],
    queryFn: () => sdk.client.fetch(`/admin/workbench/materials`),
    staleTime: 5 * 60_000,
  });
  const [addingMaterial, setAddingMaterial] = useState(false);

  const product = productQuery.data?.product;
  const detail = detailQuery.data;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["produkt", productId] });
    await queryClient.invalidateQueries({ queryKey: ["produkt-workbench", productId] });
    await queryClient.invalidateQueries({ queryKey: ["produkt-materials"] });
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

  // One switch for the whole piece: backorder is a per-variant fact in the
  // catalog, but the merchant thinks per product — so the toggle writes every
  // variant at once through the native batch endpoint.
  const toggleBackorder = useMutation({
    mutationFn: (next: boolean) =>
      sdk.client.fetch(`/admin/products/${productId}/variants/batch`, {
        method: "POST",
        body: {
          update: (product?.variants ?? []).map((variant) => ({
            id: variant.id,
            allow_backorder: next,
          })),
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Změna uložena.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Uložení se nepodařilo."),
  });

  /*
   * A quick price cut for a damaged or clearance piece: every variant's CZK
   * price drops by the given percentage (foreign currencies re-derive from the
   * daily ČNB job), the pre-discount prices are remembered in metadata, and by
   * default the piece is flagged Výprodej — the same switch the workbenches use.
   */
  const applyDiscount = useMutation({
    mutationFn: async (input: { percent: number; markClearance: boolean }) => {
      const before: Record<string, number> = {};
      for (const variant of product?.variants ?? []) {
        const price = czkPrice(variant);
        if (price === null) continue;
        before[variant.id] = price;
        const next = Math.max(1, Math.round((price * (100 - input.percent)) / 100));
        await sdk.client.fetch(`/admin/products/${productId}/variants/${variant.id}`, {
          method: "POST",
          body: {
            prices: [
              { currency_code: "czk", amount: next },
              ...(variant.prices ?? [])
                .filter((entry) => String(entry.currency_code).toLowerCase() !== "czk")
                .map((entry) => ({
                  currency_code: entry.currency_code,
                  amount: entry.amount,
                })),
            ],
          },
        });
      }
      await sdk.client.fetch(`/admin/products/${productId}`, {
        method: "POST",
        body: { metadata: { price_before_discount: before } },
      });
      if (input.markClearance) {
        await sdk.client.fetch(`/admin/workbench/products/${productId}/flags`, {
          method: "POST",
          body: { clearance: true },
        });
      }
    },
    onSuccess: async (_, input) => {
      await invalidate();
      toast.success(`Cena snížena o ${input.percent} %.`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Slevu se nepodařilo nastavit."),
  });

  /*
   * She throws series — six mugs from one glaze test. „Duplikovat" copies
   * everything describable (texts, zařazení, flags, photos, variants with
   * prices) into a DRAFT with no SKUs and no stock, and jumps straight to it.
   */
  const duplicateProduct = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Produkt se ještě načítá.")
      const metadata = (product.metadata ?? {}) as Record<string, unknown>
      const copiedFlags: Record<string, unknown> = {}
      for (const key of [
        "cod_allowed",
        "fragile",
        "frost_resistant",
        "is_personalized",
        "packaging_price",
        "dimensions",
        "backorder_note",
      ]) {
        if (metadata[key] !== undefined) copiedFlags[key] = metadata[key]
      }
      const optionTitle = product.options?.[0]?.title ?? "Provedení"
      const created = await sdk.client.fetch<{ product: { id: string } }>(
        `/admin/products`,
        {
          method: "POST",
          body: {
            title: `${product.title} (kopie)`,
            subtitle: product.subtitle ?? undefined,
            description: product.description ?? undefined,
            material: product.material ?? undefined,
            weight: product.weight ?? undefined,
            length: product.length ?? undefined,
            height: product.height ?? undefined,
            width: product.width ?? undefined,
            status: "draft",
            collection_id: product.collection_id ?? undefined,
            categories: (product.categories ?? []).map((category) => ({
              id: category.id,
            })),
            ...(product.thumbnail ? { thumbnail: product.thumbnail } : {}),
            images: (product.images ?? []).map((image) => ({ url: image.url })),
            options: [
              {
                title: optionTitle,
                values: (product.variants ?? []).map(
                  (variant) => variant.title ?? "Standardní"
                ),
              },
            ],
            variants: (product.variants ?? []).map((variant) => ({
              title: variant.title ?? "Standardní",
              options: { [optionTitle]: variant.title ?? "Standardní" },
              manage_inventory: true,
              prices: (variant.prices ?? []).map((price) => ({
                currency_code: price.currency_code,
                amount: price.amount,
              })),
              ...(variant.metadata ? { metadata: variant.metadata } : {}),
            })),
            ...(Object.keys(copiedFlags).length
              ? { metadata: copiedFlags }
              : {}),
          },
        }
      )
      return created.product.id
    },
    onSuccess: (newId) => {
      toast.success("Kopie založena jako koncept — jste na ní.")
      navigate(`/produkt/${newId}`)
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Kopii se nepodařilo založit."
      ),
  })

  // Deleting is forever — orders keep their snapshots, but the piece is gone
  // from the catalogue. Archiv is the reversible sibling next door.
  const removeProduct = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/products/${productId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Produkt smazán.");
      navigate("/produkty-workbench");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Smazání se nepodařilo."),
  });

  // Same two-step contract as the shared ArchiveToggle: the flag hides the
  // piece from the working lists, draft status takes it off the shop — and
  // restoring brings back a *draft* on purpose, so nothing returns to sale
  // because somebody clicked twice.
  const archive = useMutation({
    mutationFn: async (next: boolean) => {
      await sdk.client.fetch(`/admin/workbench/products/${productId}/flags`, {
        method: "POST",
        body: { archived: next },
      });
      if (next) {
        await sdk.client.fetch(`/admin/products/${productId}`, {
          method: "POST",
          body: { status: "draft" },
        });
      }
    },
    onSuccess: async (_, next) => {
      await invalidate();
      toast.success(
        next
          ? "Archivováno — zmizelo z obchodu i ze seznamů."
          : "Obnoveno jako koncept. Do obchodu ho vrátíte zveřejněním."
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Změna se nepodařila."),
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
  const backorderNote =
    typeof product.metadata?.backorder_note === "string"
      ? (product.metadata.backorder_note as string)
      : null;
  const dimensions =
    typeof product.metadata?.dimensions === "string"
      ? (product.metadata.dimensions as string)
      : null;
  const backorderAll =
    (product.variants ?? []).length > 0 &&
    (product.variants ?? []).every((variant) => variant.allow_backorder);
  const pricedCzk = (product.variants ?? [])
    .map(czkPrice)
    .filter((price): price is number => price !== null);
  const priceMin = pricedCzk.length ? Math.min(...pricedCzk) : null;
  const priceMax = pricedCzk.length ? Math.max(...pricedCzk) : null;
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
      <header className="px-6 pb-4 pt-4">
        <Link
          to="/produkty-workbench"
          className="text-ui-fg-muted txt-small hover:text-ui-fg-subtle"
        >
          ← Produkty+
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
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
            {/* Where the piece lives and what it costs — the two facts she
                checks first, without scrolling. */}
            <Text size="xsmall" className="text-ui-fg-subtle mt-1 truncate">
              {[
                product.collection?.title,
                ...(product.categories ?? []).map((category) => category.name),
              ]
                .filter(Boolean)
                .join(" · ") || "Bez zařazení"}
              {priceMin !== null && (
                <>
                  {" · "}
                  <span className="text-ui-fg-base font-medium">
                    {priceMin === priceMax
                      ? formatCzk(priceMin)
                      : `${formatCzk(priceMin)} – ${formatCzk(priceMax!)}`}
                  </span>
                </>
              )}
            </Text>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {detail?.store_url && (
            <Button size="small" variant="transparent" asChild>
              <a href={detail.store_url} target="_blank" rel="noreferrer">
                Zobrazit v obchodě <ArrowUpRightOnBox />
              </a>
            </Button>
          )}
          {isPublished ? (
            // Hiding a live product is the misclick that must not happen
            // silently — the same confirmation the eye uses in the lists.
            <Prompt>
              <Prompt.Trigger asChild>
                <Button
                  size="small"
                  variant="secondary"
                  isLoading={saveProduct.isPending}
                >
                  Skrýt z obchodu
                </Button>
              </Prompt.Trigger>
              <Prompt.Content>
                <Prompt.Header>
                  <Prompt.Title>
                    Skrýt „{product.title}" z obchodu?
                  </Prompt.Title>
                  <Prompt.Description>
                    Zákazníci ho v obchodě neuvidí a nekoupí, dokud ho zase
                    nezveřejníte.
                  </Prompt.Description>
                </Prompt.Header>
                <Prompt.Footer>
                  <Prompt.Cancel>Zrušit</Prompt.Cancel>
                  <Prompt.Action
                    onClick={() => saveProduct.mutate({ status: "draft" })}
                  >
                    Skrýt
                  </Prompt.Action>
                </Prompt.Footer>
              </Prompt.Content>
            </Prompt>
          ) : (
            <Button
              size="small"
              variant="primary"
              isLoading={saveProduct.isPending}
              onClick={() => saveProduct.mutate({ status: "published" })}
            >
              Publikovat
            </Button>
          )}
          <Button
            size="small"
            variant="transparent"
            isLoading={archive.isPending}
            onClick={() => archive.mutate(!archived)}
          >
            {archived ? "Obnovit z archivu" : "Archivovat"}
          </Button>
          <Button
            size="small"
            variant="secondary"
            isLoading={duplicateProduct.isPending}
            onClick={() => duplicateProduct.mutate()}
          >
            Duplikovat
          </Button>
          {/* Rychlá sleva — na poškozené a výprodejové kusy, přímo z lišty. */}
          <Prompt>
            <Prompt.Trigger asChild>
              <Button
                size="small"
                variant="secondary"
                isLoading={applyDiscount.isPending}
                disabled={priceMin === null}
              >
                Zlevnit
              </Button>
            </Prompt.Trigger>
            <Prompt.Content>
              <Prompt.Header>
                <Prompt.Title>Zlevnit „{product.title}"</Prompt.Title>
                <Prompt.Description>
                  Sníží cenu všech variant o zadaná procenta.
                  {priceMin !== null && (
                    <>
                      {" "}Teď:{" "}
                      {priceMin === priceMax
                        ? formatCzk(priceMin)
                        : `${formatCzk(priceMin)} – ${formatCzk(priceMax!)}`}
                      .
                    </>
                  )}{" "}
                  Původní ceny se zapamatují.
                </Prompt.Description>
              </Prompt.Header>
              <div className="flex flex-col gap-3 px-6 py-2">
                <div className="flex items-center gap-2">
                  <Input
                    size="small"
                    type="number"
                    min={1}
                    max={99}
                    className="w-20"
                    value={discountPercent}
                    onChange={(event) => setDiscountPercent(event.target.value)}
                  />
                  <Text size="small">% sleva</Text>
                </div>
                <label className="flex items-center gap-2">
                  <Switch
                    checked={discountClearance}
                    onCheckedChange={setDiscountClearance}
                  />
                  <Text size="small">
                    Zároveň označit jako výprodej (poškozený/jedinečný kus)
                  </Text>
                </label>
              </div>
              <Prompt.Footer>
                <Prompt.Cancel>Zrušit</Prompt.Cancel>
                <Prompt.Action
                  disabled={
                    !Number.isFinite(Number(discountPercent)) ||
                    Number(discountPercent) < 1 ||
                    Number(discountPercent) > 99
                  }
                  onClick={() =>
                    applyDiscount.mutate({
                      percent: Math.round(Number(discountPercent)),
                      markClearance: discountClearance,
                    })
                  }
                >
                  Zlevnit
                </Prompt.Action>
              </Prompt.Footer>
            </Prompt.Content>
          </Prompt>
          <Prompt variant="danger">
            <Prompt.Trigger asChild>
              <Button
                size="small"
                variant="transparent"
                className="text-ui-fg-error"
                isLoading={removeProduct.isPending}
              >
                <Trash /> Smazat
              </Button>
            </Prompt.Trigger>
            <Prompt.Content>
              <Prompt.Header>
                <Prompt.Title>Smazat „{product.title}" nadobro?</Prompt.Title>
                <Prompt.Description>
                  Tohle nejde vrátit. Objednávky si svoje údaje nechají, ale kus
                  z katalogu zmizí. Když si nejste jistí, použijte radši
                  Archivovat.
                </Prompt.Description>
              </Prompt.Header>
              <Prompt.Footer>
                <Prompt.Cancel>Zrušit</Prompt.Cancel>
                <Prompt.Action onClick={() => removeProduct.mutate()}>
                  Smazat
                </Prompt.Action>
              </Prompt.Footer>
            </Prompt.Content>
          </Prompt>
          <ExpertToggle />
          {expert && (
            <Button size="small" variant="transparent" asChild>
              <Link to={`/products/${product.id}`}>
                Původní editace <ArrowUpRightOnBox />
              </Link>
            </Button>
          )}
        </div>
        </div>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* ————— Levý sloupec: editace ————— */}
        <div className="divide-y">
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

          <section className="py-5">
            <div className="px-6">
              <Heading level="h2">Varianty a ceny</Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">
                Název, kód, cena i naskladnění — všechno rovnou tady, ukládá se
                při opuštění pole.
              </Text>
            </div>
            <div className="mt-4 hidden gap-2 px-6 pb-1 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_150px_170px_auto]">
              <FieldLabel>Název</FieldLabel>
              <FieldLabel>Kód</FieldLabel>
              <FieldLabel>Cena</FieldLabel>
              <FieldLabel>Skladem</FieldLabel>
              <FieldLabel>Naskladnit</FieldLabel>
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
                      Zatím žádné kategorie — založíte je v{" "}
                      <Link
                        to="/rozdeleni"
                        className="text-ui-fg-interactive hover:underline"
                      >
                        Rozdělení
                      </Link>
                      .
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
                onSaved={() => void invalidate()}
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

        {/* ————— Pravý sloupec: nastavení kusu a jak se mu daří ————— */}
        <div className="divide-y border-t xl:border-l xl:border-t-0">
          <ReadinessCard product={product} detail={detail} />

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
                description={'Dopravce smí vybrat peníze při předání. Zákazník na stránce produktu uvidí „Lze/Nelze doručit na dobírku".'}
                checked={flagOf(product, "cod_allowed")}
                disabled={saveFlags.isPending}
                onChange={(next) => saveFlags.mutate({ cod_allowed: next })}
              />
              <FlagRow
                label="Mrazuvzdorný"
                description="Kus vydrží mráz — důležité u květináčů a zahradních kousků."
                checked={flagOf(product, "frost_resistant")}
                disabled={saveFlags.isPending}
                onChange={(next) => saveFlags.mutate({ frost_resistant: next })}
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
            title="Materiál a rozměry"
            hint="Popisné údaje pro zákazníka; hmotnost počítá cenu dopravy."
          >
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel>Materiál</FieldLabel>
                <div className="mt-1">
                  {addingMaterial ? (
                    <InlineText
                      value=""
                      placeholder="nový materiál — Enter uloží"
                      onSave={async (next) => {
                        setAddingMaterial(false);
                        if (next) {
                          await saveProduct.mutateAsync({ material: next });
                        }
                      }}
                    />
                  ) : (
                    <Select
                      value={product.material ?? "none"}
                      onValueChange={(next) => {
                        if (next === "__add") {
                          setAddingMaterial(true);
                          return;
                        }
                        saveProduct.mutate({
                          material: next === "none" ? null : next,
                        });
                      }}
                    >
                      <Select.Trigger>
                        <Select.Value placeholder="Bez materiálu" />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="none">Bez materiálu</Select.Item>
                        {[
                          ...new Set(
                            [
                              ...(materialsQuery.data?.materials ?? []),
                              ...(product.material ? [product.material] : []),
                            ].filter(Boolean)
                          ),
                        ].map((material) => (
                          <Select.Item key={material} value={material}>
                            {material}
                          </Select.Item>
                        ))}
                        <Select.Item value="__add">+ Přidat nový…</Select.Item>
                      </Select.Content>
                    </Select>
                  )}
                </div>
              </div>
              <div>
                <FieldLabel>Rozměry</FieldLabel>
                <div className="mt-1">
                  <InlineText
                    value={dimensions}
                    placeholder="např. výška 12 cm, ø 9 cm"
                    onSave={(next) =>
                      saveFlags.mutateAsync({ dimensions: next || null })
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
                    onSave={(next) =>
                      saveProduct.mutateAsync({
                        weight: next === null ? null : Math.round(Number(next)),
                      })
                    }
                  />
                </div>
                <Text size="xsmall" className="text-ui-fg-muted mt-1">
                  Z hmotnosti se počítá cena dopravy u počítaných možností.
                </Text>
              </div>
            </div>
          </Section>

          <Section
            title="Objednání bez skladu"
            hint="Výchozí chování obchodu: po vyprodání se prodává dál a sklad jde do mínusu — vidíte, kolik kusů dlužíte."
          >
            <div className="divide-y">
              <FlagRow
                label="Objednat i bez kusů skladem"
                description={'Zákazník koupí i vyprodaný kus; u něj se místo „Prodáno“ ukáže „Na objednávku“.'}
                checked={backorderAll}
                disabled={toggleBackorder.isPending || variants.length === 0}
                onChange={(next) => toggleBackorder.mutate(next)}
              />
              <div className="flex flex-col gap-2 py-3">
                <div>
                  <Text size="small" weight="plus">
                    Co uvidí zákazník
                  </Text>
                  <Text size="small" className="text-ui-fg-subtle mt-0.5">
                    Vaše věta o čekání — ukáže se u vyprodaného kusu vedle „Na
                    objednávku".
                  </Text>
                </div>
                <InlineText
                  value={backorderNote}
                  placeholder="např. Vyrobíme pro vás do 3 týdnů."
                  onSave={(next) =>
                    saveFlags.mutateAsync({ backorder_note: next || null })
                  }
                />
              </div>
              {backorderAll && clearance && (
                <Text size="small" className="text-ui-fg-error py-3">
                  Pozor: kus je ve výprodeji — po vyprodání se sám skryje
                  z obchodu, takže objednání bez skladu se neuplatní. Vypněte
                  jedno z toho.
                </Text>
              )}
            </div>
          </Section>

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
            <Text size="xsmall" className="text-ui-fg-muted mb-2">
              Vytvořeno {formatDate(product.created_at)} · naposledy upraveno{" "}
              {formatDateTime(product.updated_at)}
            </Text>
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
