import { HttpTypes } from "@medusajs/framework/types";
import { Tools } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Skeleton,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { sdk } from "../../../lib/sdk";

type VariantProfile = {
  id?: string;
  variant_id: string;
  title: string;
  sku?: string | null;
  deposit_percentage_override?: number | null;
  production_time_min_days_override?: number | null;
  production_time_max_days_override?: number | null;
};

type MadeToOrderProduct = {
  product_id: string;
  title: string;
  thumbnail?: string | null;
  status?: string;
  enabled: boolean;
  specification_required: boolean;
  specification_prompt?: string | null;
  production_time_min_days: number;
  production_time_max_days: number;
  default_deposit_percentage: number;
  contact_customer_after_order: boolean;
  allow_final_price_adjustment: boolean;
  allow_full_prepayment: boolean;
  variants?: VariantProfile[];
};

type MadeToOrderResponse = {
  products: Array<
    Omit<MadeToOrderProduct, "title"> & {
      title?: string;
      product?: {
        id: string;
        title: string;
        thumbnail?: string | null;
        status?: string;
        variants?: Array<{
          id: string;
          title?: string | null;
          sku?: string | null;
        }>;
      } | null;
    }
  >;
  count?: number;
};

type ProductDetailsResponse = {
  product?: {
    profile?: Omit<MadeToOrderProduct, "title" | "thumbnail" | "status" | "variants"> | null;
    variants?: Array<
      Omit<VariantProfile, "title" | "sku"> & {
        title?: string;
        sku?: string | null;
      }
    >;
    product?: {
      id: string;
      title: string;
      variants?: Array<{
        id: string;
        title?: string | null;
        sku?: string | null;
      }>;
    } | null;
  };
};

type ProductDraft = Omit<MadeToOrderProduct, "product_id" | "title" | "thumbnail" | "status">;

const queryClient = new QueryClient();

const toDraft = (product: MadeToOrderProduct): ProductDraft => ({
  enabled: product.enabled !== false,
  specification_required: product.specification_required !== false,
  specification_prompt: product.specification_prompt || "",
  production_time_min_days: product.production_time_min_days ?? 14,
  production_time_max_days: product.production_time_max_days ?? 42,
  default_deposit_percentage: product.default_deposit_percentage ?? 25,
  contact_customer_after_order: product.contact_customer_after_order !== false,
  allow_final_price_adjustment:
    product.allow_final_price_adjustment !== false,
  allow_full_prepayment: product.allow_full_prepayment !== false,
  variants: (product.variants || []).map((variant) => ({ ...variant })),
});

const normalizePercentage = (value: number) =>
  Math.max(1, Math.min(100, Number.isFinite(value) ? value : 25));

const ProductSettingsDrawer = ({
  product,
}: {
  product: MadeToOrderProduct;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(() => toDraft(product));
  const queryClient = useQueryClient();

  const detailsQuery = useQuery<ProductDetailsResponse>({
    queryKey: ["made-to-order-product", product.product_id],
    queryFn: () =>
      sdk.client.fetch(`/admin/made-to-order/products/${product.product_id}`),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const response = detailsQuery.data?.product;
    if (!response?.profile) {
      setDraft(toDraft(product));
      return;
    }

    const overrideByVariant = new Map(
      (response.variants || []).map((variant) => [variant.variant_id, variant])
    );
    const variants = (response.product?.variants || []).map((variant) => {
      const override = overrideByVariant.get(variant.id);
      return {
        variant_id: variant.id,
        title: variant.title || "Výchozí provedení",
        sku: variant.sku,
        deposit_percentage_override:
          override?.deposit_percentage_override ?? null,
        production_time_min_days_override:
          override?.production_time_min_days_override ?? null,
        production_time_max_days_override:
          override?.production_time_max_days_override ?? null,
      };
    });

    setDraft({
      ...toDraft(product),
      ...response.profile,
      specification_prompt: response.profile.specification_prompt || "",
      variants,
    });
  }, [detailsQuery.data, open, product]);

  const updateProduct = useMutation({
    mutationFn: (payload: ProductDraft) =>
      sdk.client.fetch(`/admin/made-to-order/products/${product.product_id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["made-to-order-products"] });
      toast.success("Nastavení výroby bylo uloženo");
      setOpen(false);
    },
    onError: () => toast.error("Nastavení se nepodařilo uložit"),
  });

  const updateVariant = (variantId: string, patch: Partial<VariantProfile>) => {
    setDraft((current) => ({
      ...current,
      variants: (current.variants || []).map((variant) =>
        variant.variant_id === variantId ? { ...variant, ...patch } : variant
      ),
    }));
  };

  const isValid =
    draft.default_deposit_percentage >= 1 &&
    draft.default_deposit_percentage <= 100 &&
    draft.production_time_min_days >= 1 &&
    draft.production_time_max_days >= draft.production_time_min_days;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button variant="secondary" size="small">
          Nastavit výrobu
        </Button>
      </Drawer.Trigger>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Drawer.Title>{product.title}</Drawer.Title>
          <Drawer.Description>
            Záloha, výrobní čas a údaje, které zákazník vyplní v košíku.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-y-auto px-6 py-6">
          {detailsQuery.isLoading ? (
            <div className="flex flex-col gap-y-4">
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
            </div>
          ) : detailsQuery.isError ? (
            <div className="border-ui-border-error flex min-h-40 flex-col items-center justify-center rounded-lg border px-6 text-center">
              <Heading level="h2">Nastavení se nepodařilo načíst</Heading>
              <Text size="small" className="text-ui-fg-error mt-1">
                Zavřete editor a zkuste to znovu.
              </Text>
            </div>
          ) : (
          <div className="flex flex-col gap-y-8">
            <section className="flex flex-col gap-y-4">
              <div className="bg-ui-bg-subtle shadow-borders-base flex items-center justify-between gap-4 rounded-lg p-4">
                <div>
                  <Label htmlFor={`mto-enabled-${product.product_id}`}>
                    Výroba na zakázku aktivní
                  </Label>
                  <Text size="xsmall" className="text-ui-fg-muted mt-1">
                    Produkt vyžaduje specifikaci a samostatný platební postup.
                  </Text>
                </div>
                <Switch
                  id={`mto-enabled-${product.product_id}`}
                  checked={draft.enabled}
                  onCheckedChange={(enabled) =>
                    setDraft((current) => ({ ...current, enabled }))
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor={`mto-deposit-${product.product_id}`}>
                    Záloha v %
                  </Label>
                  <Input
                    id={`mto-deposit-${product.product_id}`}
                    type="number"
                    min={1}
                    max={100}
                    value={draft.default_deposit_percentage}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        default_deposit_percentage: normalizePercentage(
                          Number(event.target.value)
                        ),
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor={`mto-min-${product.product_id}`}>
                    Výroba od (dní)
                  </Label>
                  <Input
                    id={`mto-min-${product.product_id}`}
                    type="number"
                    min={1}
                    value={draft.production_time_min_days}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        production_time_min_days: Math.max(
                          1,
                          Number(event.target.value) || 1
                        ),
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor={`mto-max-${product.product_id}`}>
                    Výroba do (dní)
                  </Label>
                  <Input
                    id={`mto-max-${product.product_id}`}
                    type="number"
                    min={draft.production_time_min_days}
                    value={draft.production_time_max_days}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        production_time_max_days: Math.max(
                          current.production_time_min_days,
                          Number(event.target.value) ||
                            current.production_time_min_days
                        ),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-y-2">
                <Label htmlFor={`mto-prompt-${product.product_id}`}>
                  Otázka pro zákazníka
                </Label>
                <Textarea
                  id={`mto-prompt-${product.product_id}`}
                  rows={4}
                  value={draft.specification_prompt || ""}
                  placeholder="Například: Popište požadovaný text, barvy a umístění."
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      specification_prompt: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="bg-ui-bg-subtle shadow-borders-base flex cursor-pointer items-center justify-between gap-4 rounded-lg p-4">
                  <span>
                    <Text size="small" weight="plus">
                      Specifikace je povinná
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted mt-1">
                      Bez odpovědi nelze pokračovat v objednávce.
                    </Text>
                  </span>
                  <Switch
                    checked={draft.specification_required}
                    onCheckedChange={(specificationRequired) =>
                      setDraft((current) => ({
                        ...current,
                        specification_required: specificationRequired,
                      }))
                    }
                  />
                </label>
                <label className="bg-ui-bg-subtle shadow-borders-base flex cursor-pointer items-center justify-between gap-4 rounded-lg p-4">
                  <span>
                    <Text size="small" weight="plus">
                      Lze upravit konečnou cenu
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted mt-1">
                      Po domluvě lze zákazníkovi poslat doplatek.
                    </Text>
                  </span>
                  <Switch
                    checked={draft.allow_final_price_adjustment}
                    onCheckedChange={(allowFinalPriceAdjustment) =>
                      setDraft((current) => ({
                        ...current,
                        allow_final_price_adjustment: allowFinalPriceAdjustment,
                      }))
                    }
                  />
                </label>
                <label className="bg-ui-bg-subtle shadow-borders-base flex cursor-pointer items-center justify-between gap-4 rounded-lg p-4">
                  <span>
                    <Text size="small" weight="plus">
                      Nabídnout zaplacení celé částky
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted mt-1">
                      Zákazník si v košíku může vybrat, jestli zaplatí jen zálohu,
                      nebo rovnou všechno. Pak už doplatek neřešíte.
                    </Text>
                  </span>
                  <Switch
                    checked={draft.allow_full_prepayment}
                    onCheckedChange={(allowFullPrepayment) =>
                      setDraft((current) => ({
                        ...current,
                        allow_full_prepayment: allowFullPrepayment,
                      }))
                    }
                  />
                </label>
              </div>
            </section>

            {!!draft.variants?.length && (
              <section className="flex flex-col gap-y-3">
                <div>
                  <Heading level="h2">Výjimky podle provedení</Heading>
                  <Text size="small" className="text-ui-fg-subtle mt-1">
                    Prázdná hodnota použije společné nastavení produktu.
                  </Text>
                </div>
                <div className="shadow-borders-base divide-y overflow-hidden rounded-lg">
                  {draft.variants.map((variant) => (
                    <div
                      key={variant.variant_id}
                      className="bg-ui-bg-base grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_100px_100px_100px] sm:items-end"
                    >
                      <div className="min-w-0">
                        <Text size="small" weight="plus" className="truncate">
                          {variant.title}
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-muted truncate">
                          {variant.sku || variant.variant_id}
                        </Text>
                      </div>
                      <div className="flex flex-col gap-y-1">
                        <Label size="xsmall">Záloha %</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          placeholder={String(draft.default_deposit_percentage)}
                          value={variant.deposit_percentage_override ?? ""}
                          onChange={(event) =>
                            updateVariant(variant.variant_id, {
                              deposit_percentage_override: event.target.value
                                ? normalizePercentage(Number(event.target.value))
                                : null,
                            })
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-y-1">
                        <Label size="xsmall">Od dní</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder={String(draft.production_time_min_days)}
                          value={variant.production_time_min_days_override ?? ""}
                          onChange={(event) =>
                            updateVariant(variant.variant_id, {
                              production_time_min_days_override: event.target.value
                                ? Math.max(1, Number(event.target.value))
                                : null,
                            })
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-y-1">
                        <Label size="xsmall">Do dní</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder={String(draft.production_time_max_days)}
                          value={variant.production_time_max_days_override ?? ""}
                          onChange={(event) =>
                            updateVariant(variant.variant_id, {
                              production_time_max_days_override: event.target.value
                                ? Math.max(1, Number(event.target.value))
                                : null,
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Zrušit
          </Button>
          <Button
            variant="primary"
            isLoading={updateProduct.isPending}
            disabled={!isValid || detailsQuery.isLoading || detailsQuery.isError}
            onClick={() => updateProduct.mutate(draft)}
          >
            Uložit nastavení
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

const AddProductDrawer = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const productsQuery = useQuery({
    queryKey: ["made-to-order-product-search", debouncedSearch],
    queryFn: () =>
      sdk.admin.product.list({
        q: debouncedSearch,
        limit: 20,
        fields: "id,title,thumbnail,status",
      }),
    enabled: open && debouncedSearch.length >= 2,
  });

  const createProfile = useMutation({
    mutationFn: (productId: string) =>
      sdk.client.fetch(`/admin/made-to-order/products/${productId}`, {
        method: "PATCH",
        body: {
          product_id: productId,
          enabled: true,
          specification_required: true,
          default_deposit_percentage: 25,
          production_time_min_days: 14,
          production_time_max_days: 42,
          contact_customer_after_order: true,
          allow_final_price_adjustment: true,
          allow_full_prepayment: true,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["made-to-order-products"] });
      toast.success("Produkt byl přidán do výroby na zakázku");
      setOpen(false);
      setSearch("");
    },
    onError: () => toast.error("Produkt se nepodařilo přidat"),
  });

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        {/* Deliberately not „Přidat produkt" — that phrase means the Nový
            produkt panel everywhere else. This drawer marks an *existing*
            product as made to order. */}
        <Button variant="primary">Přidat existující produkt</Button>
      </Drawer.Trigger>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Drawer.Title>Přidat výrobu na zakázku</Drawer.Title>
          <Drawer.Description>
            Vyhledejte existující produkt. Podrobnosti výroby upravíte hned poté.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-y-auto px-6 py-6">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Začněte psát název produktu…"
            aria-label="Najít produkt"
            autoComplete="off"
          />
          <div className="mt-4 flex flex-col gap-y-2">
            {search.trim().length < 2 && (
              <Text size="small" className="text-ui-fg-muted py-8 text-center">
                Zadejte alespoň dva znaky.
              </Text>
            )}
            {productsQuery.isLoading &&
              Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-lg" />
              ))}
            {productsQuery.isError && (
              <Text size="small" className="text-ui-fg-error py-8 text-center">
                Produkty se nepodařilo načíst.
              </Text>
            )}
            {(productsQuery.data?.products || []).map(
              (product: HttpTypes.AdminProduct) => (
                <button
                  type="button"
                  key={product.id}
                  disabled={createProfile.isPending}
                  onClick={() => createProfile.mutate(product.id)}
                  className="bg-ui-bg-base hover:bg-ui-bg-base-hover focus-visible:shadow-borders-focus shadow-borders-base flex items-center gap-x-3 rounded-lg p-3 text-left outline-none"
                >
                  <div className="bg-ui-bg-subtle flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md">
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-ui-fg-muted text-xs">—</span>
                    )}
                  </div>
                  <span className="min-w-0 flex-1">
                    <Text size="small" weight="plus" className="truncate">
                      {product.title}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Přidat s výchozí zálohou 25 %
                    </Text>
                  </span>
                </button>
              )
            )}
          </div>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
};

const MadeToOrderPageInner = () => {
  const [search, setSearch] = useState("");
  const productsQuery = useQuery<MadeToOrderResponse>({
    queryKey: ["made-to-order-products"],
    queryFn: () =>
      sdk.client.fetch("/admin/made-to-order/products", {
        query: { limit: 100 },
      }),
  });

  const products = useMemo(() => {
    const value = Array.isArray(productsQuery.data?.products)
      ? productsQuery.data.products
      : [];
    const normalized: MadeToOrderProduct[] = value.flatMap((record) => {
      const baseProduct = record.product;
      const title = record.title || baseProduct?.title;
      if (!title) return [];
      return [
        {
          ...record,
          title,
          thumbnail: record.thumbnail || baseProduct?.thumbnail,
          status: record.status || baseProduct?.status,
          variants: (baseProduct?.variants || []).map((variant) => ({
            variant_id: variant.id,
            title: variant.title || "Výchozí provedení",
            sku: variant.sku,
          })),
        },
      ];
    });
    const query = search.trim().toLocaleLowerCase("cs");
    return query
      ? normalized.filter((product) =>
          product.title.toLocaleLowerCase("cs").includes(query)
        )
      : normalized;
  }, [productsQuery.data, search]);

  return (
    <Container className="divide-y p-0">
      <header className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-end md:justify-between">
        <div>
          <Heading>Výroba na zakázku</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
            Produkty se zálohou, zákaznickou specifikací a výrobním časem.
          </Text>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Najít produkt…"
            aria-label="Najít produkt ve výrobě"
            className="w-full sm:w-56"
          />
          <AddProductDrawer />
        </div>
      </header>

      <div className="px-6 py-6">
        {productsQuery.isLoading && (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-44 rounded-lg" />
            ))}
          </div>
        )}

        {productsQuery.isError && (
          <div className="border-ui-border-error flex min-h-40 flex-col items-center justify-center rounded-lg border px-6 text-center">
            <Heading level="h2">Nastavení se nepodařilo načíst</Heading>
            <Text size="small" className="text-ui-fg-error mt-1">
              Obnovte stránku a zkuste to znovu.
            </Text>
          </div>
        )}

        {!productsQuery.isLoading && !productsQuery.isError && !products.length && (
          <div className="border-ui-border-strong flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
            <Heading level="h2">
              {search ? "Žádný odpovídající produkt" : "Zatím bez zakázkové výroby"}
            </Heading>
            <Text size="small" className="text-ui-fg-muted mt-1 max-w-md">
              {search
                ? "Zkuste jiný název nebo hledání vymažte."
                : "Přidejte existující produkt a nastavte výši zálohy i výrobní čas."}
            </Text>
          </div>
        )}

        {!productsQuery.isLoading && !productsQuery.isError && products.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {products.map((product) => (
              <article
                key={product.product_id}
                className="bg-ui-bg-component shadow-elevation-card-rest flex flex-col gap-y-4 rounded-xl p-5"
              >
                <div className="flex items-start gap-x-4">
                  <div className="bg-ui-bg-subtle shadow-borders-base flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-ui-fg-muted text-xs">—</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-x-3">
                      <Heading level="h2" className="truncate">
                        {product.title}
                      </Heading>
                      <Badge color={product.enabled ? "green" : "grey"}>
                        {product.enabled ? "Aktivní" : "Pozastaveno"}
                      </Badge>
                    </div>
                    <Text size="small" className="text-ui-fg-subtle mt-1">
                      Záloha {product.default_deposit_percentage} % · výroba{" "}
                      {product.production_time_min_days}–
                      {product.production_time_max_days} dní
                    </Text>
                  </div>
                </div>
                <div className="bg-ui-bg-subtle rounded-lg px-4 py-3">
                  <Text size="xsmall" className="text-ui-fg-muted uppercase">
                    Otázka v košíku
                  </Text>
                  <Text size="small" className="mt-1">
                    {product.specification_prompt ||
                      "Zákazník popíše svou představu."}
                  </Text>
                </div>
                <div className="border-ui-border-base flex items-center justify-between border-t pt-4">
                  <Text size="small" className="text-ui-fg-subtle">
                    {(product.variants || []).length} provedení
                  </Text>
                  <ProductSettingsDrawer product={product} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Container>
  );
};

const MadeToOrderPage = () => (
  <QueryClientProvider client={queryClient}>
    <MadeToOrderPageInner />
  </QueryClientProvider>
);

/**
 * The made-to-order product manager.
 *
 * **No `config` export.** Once Zakázky moved into Přehled, this was the only
 * page left in the Zakázková výroba section, and a section wrapping a single
 * child is pure noise in a sidebar. `/zakazkova-vyroba` renders this same
 * component as a top-level item instead; this path stays valid so existing
 * links keep working.
 */
export default MadeToOrderPage;
