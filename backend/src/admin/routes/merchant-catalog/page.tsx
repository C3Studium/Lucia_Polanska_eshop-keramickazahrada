import { ListTree } from "@medusajs/icons";
import {
  Badge,
  Button,
  Checkbox,
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
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { sdk } from "../../lib/sdk";

type CatalogCategory = {
  id: string;
  name: string;
  handle?: string | null;
  product_count?: number;
  display_order?: number;
  products?: Array<{ id: string }>;
};

type CatalogCollection = {
  id: string;
  title: string;
  handle?: string | null;
  product_count?: number;
  products?: Array<{ id: string }>;
  profile?: {
    description?: string | null;
    cover_image_url?: string | null;
    mobile_image_url?: string | null;
    storefront_visible?: boolean;
    display_order?: number;
    seo_title?: string | null;
    seo_description?: string | null;
  } | null;
  categories?: CatalogCategory[];
};

type CatalogResponse = {
  collections: CatalogCollection[];
  count?: number;
};

type CategoriesResponse = {
  categories: CatalogCategory[];
};

type CollectionDraft = {
  title: string;
  handle: string;
  description: string;
  cover_image_url: string;
  mobile_image_url: string;
  storefront_visible: boolean;
  display_order: number;
  seo_title: string;
  seo_description: string;
  category_ids: string[];
};

/**
 * Published products nobody can browse to (§9, P8-4).
 *
 * Only shown when there are some — a permanent "0 unclassified" row is
 * furniture. Links nowhere clever: the native product list with a filter is
 * where this gets fixed, and duplicating that here would be a second way to do
 * one job.
 */
const UnclassifiedBanner = () => {
  const { data } = useQuery<{ unclassified_count: number }>({
    queryKey: ["catalog-health"],
    queryFn: () => sdk.client.fetch("/admin/operations/catalog-health"),
    staleTime: 5 * 60_000,
  });

  if (!data?.unclassified_count) {
    return null;
  }

  return (
    <div className="bg-ui-bg-subtle flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <div>
        <Text size="small" weight="plus">
          {data.unclassified_count === 1
            ? "1 produkt není nikde zařazený"
            : `${data.unclassified_count} produktů není nikde zařazených`}
        </Text>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Zákazníci je najdou jen přes vyhledávání. Přiřaďte je ke kolekci nebo
          kategorii, ať jsou k nalezení i při procházení.
        </Text>
      </div>
    </div>
  );
};

const queryClient = new QueryClient();

const getInitialDraft = (collection: CatalogCollection): CollectionDraft => ({
  title: collection.title || "",
  handle: collection.handle || "",
  description: collection.profile?.description || "",
  cover_image_url: collection.profile?.cover_image_url || "",
  mobile_image_url: collection.profile?.mobile_image_url || "",
  storefront_visible: collection.profile?.storefront_visible !== false,
  display_order: collection.profile?.display_order ?? 0,
  seo_title: collection.profile?.seo_title || "",
  seo_description: collection.profile?.seo_description || "",
  category_ids: (collection.categories || []).map((category) => category.id),
});

const CollectionEditor = ({
  collection,
  categories,
}: {
  collection: CatalogCollection;
  categories: CatalogCategory[];
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CollectionDraft>(() =>
    getInitialDraft(collection)
  );
  const [uploadingField, setUploadingField] = useState<
    "cover_image_url" | "mobile_image_url" | null
  >(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) setDraft(getInitialDraft(collection));
  }, [collection, open]);

  const updateCollection = useMutation({
    mutationFn: (payload: CollectionDraft) =>
      sdk.client.fetch(`/admin/merchant-catalog/collections/${collection.id}`, {
        method: "PATCH",
        body: {
          title: payload.title,
          handle: payload.handle,
          category_ids: payload.category_ids,
          profile: {
            description: payload.description || null,
            cover_image_url: payload.cover_image_url || null,
            mobile_image_url: payload.mobile_image_url || null,
            storefront_visible: payload.storefront_visible,
            display_order: payload.display_order,
            seo_title: payload.seo_title || null,
            seo_description: payload.seo_description || null,
          },
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["merchant-catalog"] });
      toast.success("Kolekce byla aktualizována");
      setOpen(false);
    },
    onError: () => toast.error("Kolekci se nepodařilo uložit"),
  });

  const uploadImage = async (
    event: ChangeEvent<HTMLInputElement>,
    field: "cover_image_url" | "mobile_image_url"
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingField(field);
    try {
      const result = await sdk.admin.upload.create({ files: [file] });
      const url = result.files[0]?.url;
      if (!url) throw new Error("Upload nevrátil URL");
      setDraft((current) => ({ ...current, [field]: url }));
      toast.success("Obrázek byl nahrán");
    } catch {
      toast.error("Obrázek se nepodařilo nahrát");
    } finally {
      setUploadingField(null);
    }
  };

  const toggleCategory = (categoryId: string, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      category_ids: checked
        ? [...new Set([...current.category_ids, categoryId])]
        : current.category_ids.filter((id) => id !== categoryId),
    }));
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button variant="secondary" size="small">
          Upravit kolekci
        </Button>
      </Drawer.Trigger>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Drawer.Title>{collection.title}</Drawer.Title>
          <Drawer.Description>
            Obsah kolekce a kategorie, které se zobrazí v obchodě.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-y-8">
            <section className="flex flex-col gap-y-4">
              <Heading level="h2">Základní údaje</Heading>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor={`collection-title-${collection.id}`}>
                    Název
                  </Label>
                  <Input
                    id={`collection-title-${collection.id}`}
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor={`collection-handle-${collection.id}`}>
                    URL identifikátor
                  </Label>
                  <Input
                    id={`collection-handle-${collection.id}`}
                    value={draft.handle}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        handle: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor={`collection-description-${collection.id}`}>
                  Popis kolekce
                </Label>
                <Textarea
                  id={`collection-description-${collection.id}`}
                  rows={4}
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-y-2">
                  <Label>Hlavní obrázek</Label>
                  {draft.cover_image_url && (
                    <img
                      src={draft.cover_image_url}
                      alt=""
                      className="bg-ui-bg-subtle h-28 w-full rounded-lg object-cover"
                    />
                  )}
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => uploadImage(event, "cover_image_url")}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    isLoading={uploadingField === "cover_image_url"}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {draft.cover_image_url ? "Změnit obrázek" : "Nahrát obrázek"}
                  </Button>
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label>Obrázek pro mobil</Label>
                  {draft.mobile_image_url && (
                    <img
                      src={draft.mobile_image_url}
                      alt=""
                      className="bg-ui-bg-subtle h-28 w-full rounded-lg object-cover"
                    />
                  )}
                  <input
                    ref={mobileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => uploadImage(event, "mobile_image_url")}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    isLoading={uploadingField === "mobile_image_url"}
                    onClick={() => mobileInputRef.current?.click()}
                  >
                    {draft.mobile_image_url
                      ? "Změnit obrázek"
                      : "Nahrát obrázek"}
                  </Button>
                </div>
              </div>
              <div className="bg-ui-bg-subtle shadow-borders-base flex items-center justify-between gap-4 rounded-lg p-4">
                <div>
                  <Label htmlFor={`collection-visible-${collection.id}`}>
                    Zobrazit v obchodě
                  </Label>
                  <Text size="xsmall" className="text-ui-fg-muted mt-1">
                    Kolekci lze připravit předem a zveřejnit později.
                  </Text>
                </div>
                <Switch
                  id={`collection-visible-${collection.id}`}
                  checked={draft.storefront_visible}
                  onCheckedChange={(storefrontVisible) =>
                    setDraft((current) => ({
                      ...current,
                      storefront_visible: storefrontVisible,
                    }))
                  }
                />
              </div>
            </section>

            <section className="flex flex-col gap-y-3">
              <div>
                <Heading level="h2">Kategorie v kolekci</Heading>
                <Text size="small" className="text-ui-fg-subtle mt-1">
                  Produkt nejdříve patří do kolekce; zde vyberete její podkategorie.
                </Text>
              </div>
              <div className="shadow-borders-base divide-y overflow-hidden rounded-lg">
                {categories.length ? (
                  categories.map((category) => {
                    const checked = draft.category_ids.includes(category.id);
                    return (
                      <label
                        key={category.id}
                        className="bg-ui-bg-base hover:bg-ui-bg-base-hover flex cursor-pointer items-center gap-x-3 px-4 py-3"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleCategory(category.id, value === true)
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <Text size="small" weight="plus">
                            {category.name}
                          </Text>
                          <Text size="xsmall" className="text-ui-fg-muted">
                            {category.product_count ?? category.products?.length ?? 0} produktů
                          </Text>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <Text size="small" className="text-ui-fg-muted px-4 py-6">
                    Nejdříve vytvořte alespoň jednu kategorii v sekci Produkty.
                  </Text>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-y-4">
              <Heading level="h2">Vyhledávání</Heading>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor={`collection-seo-title-${collection.id}`}>
                  Titulek pro vyhledávače
                </Label>
                <Input
                  id={`collection-seo-title-${collection.id}`}
                  value={draft.seo_title}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      seo_title: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor={`collection-seo-description-${collection.id}`}>
                  Popis pro vyhledávače
                </Label>
                <Textarea
                  id={`collection-seo-description-${collection.id}`}
                  rows={3}
                  value={draft.seo_description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      seo_description: event.target.value,
                    }))
                  }
                />
              </div>
            </section>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Zrušit
          </Button>
          <Button
            variant="primary"
            isLoading={updateCollection.isPending}
            disabled={!draft.title.trim() || !draft.handle.trim()}
            onClick={() => updateCollection.mutate(draft)}
          >
            Uložit změny
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

const CatalogPageInner = () => {
  const [search, setSearch] = useState("");
  const catalogQuery = useQuery<CatalogResponse>({
    queryKey: ["merchant-catalog"],
    queryFn: () =>
      sdk.client.fetch("/admin/merchant-catalog/collections", {
        query: { limit: 100 },
      }),
  });
  const categoriesQuery = useQuery<CategoriesResponse>({
    queryKey: ["merchant-catalog-categories"],
    queryFn: () =>
      sdk.client.fetch("/admin/merchant-catalog/categories", {
        query: { limit: 200 },
      }),
  });

  const collections = useMemo(() => {
    const value = Array.isArray(catalogQuery.data?.collections)
      ? catalogQuery.data.collections
      : [];
    const query = search.trim().toLocaleLowerCase("cs");
    if (!query) return value;
    return value.filter((collection) =>
      `${collection.title} ${collection.handle || ""}`
        .toLocaleLowerCase("cs")
        .includes(query)
    );
  }, [catalogQuery.data, search]);

  const categories = Array.isArray(categoriesQuery.data?.categories)
    ? categoriesQuery.data.categories
    : [];

  return (
    <Container className="divide-y p-0">
      <UnclassifiedBanner />
      <header className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-end md:justify-between">
        <div>
          <Heading>Kolekce a kategorie</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
            Kolekce jsou hlavní prostředí obchodu. Každá z nich obsahuje vlastní
            kategorie a produkty.
          </Text>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Najít kolekci…"
          aria-label="Najít kolekci"
          className="w-full md:w-64"
        />
      </header>

      <div className="px-6 py-6">
        {(catalogQuery.isLoading || categoriesQuery.isLoading) && (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-56 rounded-lg" />
            ))}
          </div>
        )}

        {(catalogQuery.isError || categoriesQuery.isError) && (
          <div className="border-ui-border-error bg-ui-bg-base flex min-h-40 flex-col items-center justify-center rounded-lg border px-6 text-center">
            <Heading level="h2">Katalog se nepodařilo načíst</Heading>
            <Text size="small" className="text-ui-fg-error mt-1">
              Obnovte stránku. Pokud problém přetrvá, zkontrolujte připojení k backendu.
            </Text>
          </div>
        )}

        {!catalogQuery.isLoading &&
          !categoriesQuery.isLoading &&
          !catalogQuery.isError &&
          !categoriesQuery.isError &&
          !collections.length && (
            <div className="border-ui-border-strong flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
              <Heading level="h2">
                {search ? "Žádná odpovídající kolekce" : "Zatím bez kolekcí"}
              </Heading>
              <Text size="small" className="text-ui-fg-muted mt-1 max-w-md">
                {search
                  ? "Zkuste jiný název nebo hledání vymažte."
                  : "První kolekci vytvořte v základní správě produktů; potom ji zde doplňte o obraz a kategorie."}
              </Text>
            </div>
          )}

        {!catalogQuery.isLoading &&
          !categoriesQuery.isLoading &&
          !catalogQuery.isError &&
          !categoriesQuery.isError &&
          collections.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {collections.map((collection) => (
                <article
                  key={collection.id}
                  className="bg-ui-bg-component shadow-elevation-card-rest overflow-hidden rounded-xl"
                >
                  {collection.profile?.cover_image_url ? (
                    <img
                      src={collection.profile.cover_image_url}
                      alt=""
                      className="bg-ui-bg-subtle h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="bg-ui-bg-subtle flex h-24 items-center justify-center">
                      <Text size="small" className="text-ui-fg-muted">
                        Bez hlavního obrázku
                      </Text>
                    </div>
                  )}
                  <div className="flex flex-col gap-y-4 p-5">
                    <div className="flex items-start justify-between gap-x-4">
                      <div className="min-w-0">
                        <Heading level="h2" className="truncate">
                          {collection.title}
                        </Heading>
                        <Text size="xsmall" className="text-ui-fg-muted mt-1 font-mono">
                          /{collection.handle || collection.id}
                        </Text>
                      </div>
                      <Badge
                        color={
                          collection.profile?.storefront_visible === false
                            ? "grey"
                            : "green"
                        }
                      >
                        {collection.profile?.storefront_visible === false
                          ? "Skrytá"
                          : "V obchodě"}
                      </Badge>
                    </div>

                    <Text size="small" className="text-ui-fg-subtle line-clamp-2 min-h-10">
                      {collection.profile?.description ||
                        "Kolekce zatím nemá zákaznický popis."}
                    </Text>

                    <div className="flex flex-wrap gap-2">
                      {(collection.categories || []).length ? (
                        (collection.categories || []).map((category) => (
                          <Badge key={category.id} color="grey">
                            {category.name}
                          </Badge>
                        ))
                      ) : (
                        <Badge color="orange">Bez kategorií</Badge>
                      )}
                    </div>

                    <div className="border-ui-border-base flex items-center justify-between border-t pt-4">
                      <Text size="small" className="text-ui-fg-subtle">
                        {collection.product_count ?? collection.products?.length ?? 0} produktů ·{" "}
                        {(collection.categories || []).length} kategorií
                      </Text>
                      <CollectionEditor
                        collection={collection}
                        categories={categories}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
      </div>
    </Container>
  );
};

const CatalogPage = () => (
  <QueryClientProvider client={queryClient}>
    <CatalogPageInner />
  </QueryClientProvider>
);

/**
 * **No sidebar entry.** Reached from Přehled → Produkty. The sidebar is down
 * to the five places she navigates *to*; everything she works *in* lives
 * under Přehled.
 */

export default CatalogPage;
