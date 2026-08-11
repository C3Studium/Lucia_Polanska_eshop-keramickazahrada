import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ListTree, Plus } from "@medusajs/icons";
import {
  Badge, Button, Container, FocusModal, Heading, Input, Prompt, Text, Toaster, toast,
} from "@medusajs/ui";
import {
  QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { sdk } from "../../lib/sdk";

/**
 * Rozdělení — kolekce → kategorie → produkty as three columns
 * (Matěj, 2026-08-06: the native Produkty pages, but as one simple room).
 *
 * Column 1: every collection, creatable/renamable/deletable. Column 2: the
 * categories that actually occur among the selected collection's products
 * (plus „Bez kategorie") — a collection holding uncategorised products
 * simply shows them without the middle noise. Column 3: the products, every
 * kind with its label, movable to another collection or category on the
 * spot. All writes go through the native admin APIs.
 */

const kindBadge: Record<string, { label: string; color: "green" | "orange" | "blue" | "red" }> = {
  bezne: { label: "Produkt", color: "green" },
  zakazka: { label: "Zakázka", color: "orange" },
  balicek: { label: "Balíček", color: "blue" },
  poskozene: { label: "Poškozené", color: "red" },
};

/* Picking by name alone is guesswork in a catalogue where half the pieces are
   „Kytka …" — the photo is how she recognises them. Falls back to the first
   letter, the same shape the Balíčky list uses. With a photo and `onZoom` the
   thumb becomes a button (hover shows „+") that opens the full-size photos —
   32 px is enough to recognise a piece, not to check its details. */
const Thumb = ({
  src,
  title,
  onZoom,
}: {
  src?: string | null;
  title: string;
  onZoom?: () => void;
}) => {
  if (src && onZoom) {
    return (
      <button
        type="button"
        title="Zvětšit fotku"
        onClick={(e) => {
          /* The picker renders thumbs inside a <label> — without this, the
             click would also toggle the row's checkbox. */
          e.preventDefault();
          e.stopPropagation();
          onZoom();
        }}
        className="group bg-ui-bg-subtle shadow-borders-base relative flex size-8 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-md"
      >
        <img src={src} alt="" className="size-full object-cover" />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Plus />
        </span>
      </button>
    );
  }
  return (
    <div className="bg-ui-bg-subtle shadow-borders-base flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md">
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span className="text-ui-fg-muted text-[10px] font-medium">
          {title?.slice(0, 1).toLocaleUpperCase("cs") || "–"}
        </span>
      )}
    </div>
  );
};

const Inner = () => {
  const queryClient = useQueryClient();
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | "none" | null>(null);
  const [newCollection, setNewCollection] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryCollection, setNewCategoryCollection] = useState("");
  const [kindTab, setKindTab] = useState<"vse" | "bezne" | "zakazka" | "balicek" | "poskozene">("vse");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignSearch, setAssignSearch] = useState("");
  const [renamingCategory, setRenamingCategory] = useState<{ id: string; name: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  /* Rozpracované přeřazení: řádkové selecty nezapisují hned, jen sem. Uloží
     se až Potvrdit (řádek) / Potvrdit vše (lišta) — takže může rozdělat
     změn kolik chce a pak je jedním klikem uložit, nebo zahodit. */
  const [pending, setPending] = useState<
    Record<string, { collection_id: string | null; category_id: string | null }>
  >({});
  /* Klik na miniaturu otevře fotky v plné velikosti — kontrola detailů kusu
     bez odchodu ze stránky. Seznam nese jen thumbnail, zbytek fotek se
     dotáhne až při otevření. */
  const [lightbox, setLightbox] = useState<{ id: string; title: string } | null>(
    null
  );
  const { data: lightboxData, isLoading: lightboxLoading } = useQuery<any>({
    queryKey: ["rozdeleni-lightbox", lightbox?.id],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/products/${lightbox!.id}?fields=title,thumbnail,*images`
      ),
    enabled: Boolean(lightbox),
  });
  const lightboxImages: string[] = (() => {
    const product = lightboxData?.product;
    const urls = (product?.images ?? [])
      .map((image: any) => image?.url)
      .filter(Boolean);
    if (urls.length) return urls;
    return product?.thumbnail ? [product.thumbnail] : [];
  })();
  const [renaming, setRenaming] = useState("");

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["rozdeleni-collections"] });
    await queryClient.invalidateQueries({ queryKey: ["workbench-products-all"] });
    await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
  };

  const { data: collectionsData } = useQuery<any>({
    queryKey: ["rozdeleni-collections"],
    queryFn: () => sdk.client.fetch("/admin/collections?limit=100&fields=id,title,handle,metadata"),
    refetchOnWindowFocus: true,
  });
  const { data: categoriesData } = useQuery<any>({
    queryKey: ["rozdeleni-categories"],
    queryFn: () => sdk.client.fetch("/admin/product-categories?limit=100&fields=id,name,metadata"),
  });
  const { data: productsData } = useQuery<any>({
    queryKey: ["workbench-products-all"],
    queryFn: () => sdk.client.fetch("/admin/workbench/products?limit=200"),
    refetchOnWindowFocus: true,
  });

  const collections: any[] = collectionsData?.collections ?? [];
  const allCategories: any[] = categoriesData?.product_categories ?? [];
  const products: any[] = productsData?.products ?? [];

  /* No collection selected = the whole shop, not „bez kolekce". The first
     view used to filter on collection_id === null, so assigning a collection
     made the product vanish from the very list she was working in. */
  const inCollection =
    collectionId === null
      ? products
      : products.filter((product) => product.collection_id === collectionId);
  // Kategorie „patří" kolekci přes metadata.collection_id — Medusa je má
  // globální, tohle je naše vazba, aby seděl model kolekce → podkategorie
  // i pro prázdné kategorie — plus kategorie, které se v kolekci reálně
  // vyskytují na produktech. Stejná unie jako storefront menu.
  const categoriesOf = (collId: string) => [
    ...new Map(
      [
        ...products
          .filter((product) => product.collection_id === collId)
          .flatMap((product) => product.category_refs ?? []),
        ...allCategories.filter(
          (category: any) =>
            (category.metadata as any)?.collection_id === collId
        ),
      ].map((category: any) => [category.id, category])
    ).values(),
  ];
  const categoriesHere = collectionId ? categoriesOf(collectionId) : [];

  /* The category a row shows for a collection: the product's first category
     that belongs to it. Products can hold more (bulk picker merges); the row
     editor manages „the" place, not the whole set. */
  const savedCategoryFor = (product: any, collId: string | null) => {
    if (!collId) return null;
    const allowed = new Set(categoriesOf(collId).map((c: any) => c.id));
    return (
      (product.category_refs ?? []).find((c: any) => allowed.has(c.id))?.id ??
      null
    );
  };

  const draftFor = (product: any) =>
    pending[product.id] ?? {
      collection_id: (product.collection_id ?? null) as string | null,
      category_id: savedCategoryFor(product, product.collection_id ?? null),
    };

  const setDraft = (
    product: any,
    patch: Partial<{ collection_id: string | null; category_id: string | null }>
  ) => {
    setPending((prev) => {
      const current = prev[product.id] ?? {
        collection_id: (product.collection_id ?? null) as string | null,
        category_id: savedCategoryFor(product, product.collection_id ?? null),
      };
      const next = { ...current, ...patch };
      if ("collection_id" in patch) {
        // Nová kolekce = nová nabídka kategorií; dosavadní volba přežije,
        // jen pokud do ní patří.
        const allowed = new Set(
          (next.collection_id ? categoriesOf(next.collection_id) : []).map(
            (c: any) => c.id
          )
        );
        next.category_id =
          next.category_id && allowed.has(next.category_id)
            ? next.category_id
            : null;
      }
      // Ruční návrat k uloženému stavu = žádná rozpracovaná změna.
      const savedCollection = (product.collection_id ?? null) as string | null;
      if (
        next.collection_id === savedCollection &&
        next.category_id === savedCategoryFor(product, savedCollection)
      ) {
        const { [product.id]: _dropped, ...rest } = prev;
        return rest;
      }
      return { ...prev, [product.id]: next };
    });
  };
  const uncategorised = inCollection.filter(
    (product) => !(product.category_refs ?? []).length
  );
  const visibleProducts =
    categoryId === null
      ? inCollection
      : categoryId === "none"
        ? uncategorised
        : inCollection.filter((product) =>
            (product.category_refs ?? []).some((c: any) => c.id === categoryId)
          );

  const createCollection = useMutation({
    mutationFn: () => {
      if (!newCollection.trim()) throw new Error("Kolekce potřebuje název.");
      return sdk.client.fetch("/admin/collections", {
        method: "POST",
        body: { title: newCollection.trim() },
      });
    },
    onSuccess: async () => { setNewCollection(""); await invalidate(); toast.success("Kolekce založena."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nepodařilo se."),
  });
  const renameCollection = useMutation({
    mutationFn: (payload: { id: string; title: string }) =>
      sdk.client.fetch(`/admin/collections/${payload.id}`, {
        method: "POST", body: { title: payload.title },
      }),
    onSuccess: async () => { await invalidate(); toast.success("Přejmenováno."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nepodařilo se."),
  });
  const deleteCollection = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/collections/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setCollectionId(null); await invalidate();
      toast.success("Kolekce smazána — produkty zůstaly, jen bez kolekce.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nepodařilo se."),
  });
  const setCollectionImage = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("files", file);
      const response = await fetch(`/admin/uploads`, {
        method: "POST", credentials: "include", body: formData,
      });
      if (!response.ok) throw new Error("Fotku se nepodařilo nahrát.");
      const payload = await response.json();
      const url: string | undefined = payload?.files?.[0]?.url;
      if (!url) throw new Error("Úložiště nevrátilo adresu fotky.");
      const current = collections.find((c) => c.id === collectionId);
      // metadata.image — stejný klíč, který už čte storefront navbar.
      return sdk.client.fetch(`/admin/collections/${collectionId}`, {
        method: "POST",
        body: { metadata: { ...(current?.metadata ?? {}), image: url } },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rozdeleni-collections"] });
      toast.success("Fotka kolekce nastavena — uvidí ji i menu obchodu.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nepodařilo se."),
  });

  const renameCategory = useMutation({
    mutationFn: (payload: { id: string; name: string }) =>
      sdk.client.fetch(`/admin/product-categories/${payload.id}`, {
        method: "POST", body: { name: payload.name },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rozdeleni-categories"] });
      await invalidate();
      toast.success("Kategorie přejmenována.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nepodařilo se."),
  });
  const deleteCategory = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/product-categories/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setCategoryId(null);
      await queryClient.invalidateQueries({ queryKey: ["rozdeleni-categories"] });
      await invalidate();
      toast.success("Kategorie smazána — produkty zůstaly.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nepodařilo se."),
  });

  const createCategory = useMutation({
    mutationFn: () => {
      if (!newCategory.trim()) throw new Error("Kategorie potřebuje název.");
      const parent = collectionId ?? newCategoryCollection;
      if (!parent) throw new Error("Vyberte, pod kterou kolekci kategorie patří.");
      return sdk.client.fetch("/admin/product-categories", {
        method: "POST",
        body: {
          name: newCategory.trim(),
          is_active: true,
          metadata: { collection_id: parent },
        },
      });
    },
    onSuccess: async () => {
      setNewCategory("");
      await queryClient.invalidateQueries({ queryKey: ["rozdeleni-categories"] });
      toast.success("Kategorie založena.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nepodařilo se."),
  });

  const bulkArchive = useMutation({
    mutationFn: async () => {
      for (const id of selected) {
        await sdk.client.fetch(`/admin/workbench/products/${id}/flags`, {
          method: "POST",
          body: { archived: true },
        });
      }
    },
    onSuccess: async () => {
      const count = selected.size;
      setSelected(new Set());
      await invalidate();
      toast.success(`Archivováno ${count} produktů — z obchodu zmizely, historie zůstává.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Archivace se nepodařila."),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      for (const id of selected) {
        await sdk.client.fetch(`/admin/products/${id}`, { method: "DELETE" });
      }
    },
    onSuccess: async () => {
      const count = selected.size;
      setSelected(new Set());
      await invalidate();
      toast.success(`Smazáno ${count} produktů.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Mazání se nepodařilo."),
  });

  const bulkAssign = useMutation({
    mutationFn: async () => {
      for (const id of pickerSelected) {
        const product = products.find((item) => item.id === id);
        const currentCategories = (product?.category_refs ?? []).map(
          (category: any) => ({ id: category.id })
        );
        const wantsCategory =
          categoryId && categoryId !== "none"
            ? currentCategories.some((c: any) => c.id === categoryId)
              ? currentCategories
              : [...currentCategories, { id: categoryId }]
            : currentCategories;
        await sdk.client.fetch(`/admin/products/${id}`, {
          method: "POST",
          body: {
            collection_id: collectionId,
            // Kategorie se SLUČUJÍ — produkt může být ve více kategoriích,
            // zařazení sem mu ostatní nesmí vzít.
            categories: wantsCategory,
          },
        });
      }
    },
    onSuccess: async () => {
      const count = pickerSelected.size;
      setPickerSelected(new Set());
      setPickerOpen(false);
      setPickerSearch("");
      await invalidate();
      toast.success(`Zařazeno ${count} produktů.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Zařazení se nepodařilo."),
  });

  const applyPending = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const draft = pending[id];
        if (!draft) continue;
        await sdk.client.fetch(`/admin/products/${id}`, {
          method: "POST",
          body: {
            collection_id: draft.collection_id,
            categories: draft.category_id ? [{ id: draft.category_id }] : [],
          },
        });
      }
    },
    onSuccess: async (_, ids) => {
      setPending((prev) => {
        const rest = { ...prev };
        for (const id of ids) delete rest[id];
        return rest;
      });
      await invalidate();
      toast.success(
        ids.length === 1 ? "Změna uložena." : `Uloženo změn: ${ids.length}.`
      );
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Uložení se nepodařilo."),
  });
  const pendingCount = Object.keys(pending).length;

  const selectedCollection = collections.find((c) => c.id === collectionId);

  return (
    <Container className="p-0">
      <Toaster />
      <header className="border-ui-border-base flex flex-wrap items-start justify-between gap-3 border-b px-6 pb-4 pt-6">
        <div>
          <Heading>Rozdělení</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
            Kolekce, jejich kategorie a produkty vedle sebe. Klik vlevo otevře
            prostředek, klik uprostřed pravý sloupec.
          </Text>
        </div>
        <Button
          size="small"
          variant="secondary"
          onClick={() => {
            // Back to the first-open view: no selection, every product listed.
            setCollectionId(null);
            setCategoryId(null);
            setKindTab("vse");
            setPickerOpen(false);
            setPickerSelected(new Set());
            setSelected(new Set());
            setRenaming("");
          }}
        >
          Zobrazit vše
        </Button>
      </header>

      <div className="grid min-h-[60vh] lg:grid-cols-[260px_240px_minmax(0,1fr)] divide-x divide-ui-border-base">
        {/* ── 1. kolekce ── */}
        <div className="flex flex-col gap-1 p-3">
          {collections.map((collection) => (
            <button key={collection.id} type="button"
              onClick={() => { setCollectionId(collection.id); setCategoryId(null); setRenaming(""); }}
              className={
                collection.id === collectionId
                  ? "bg-ui-bg-base-pressed rounded-md px-3 py-2 text-left"
                  : "hover:bg-ui-bg-base-hover rounded-md px-3 py-2 text-left"
              }>
              <Text size="small" weight={collection.id === collectionId ? "plus" : "regular"}>
                {collection.title}
              </Text>
              <Text size="xsmall" className="text-ui-fg-muted">
                {products.filter((p) => p.collection_id === collection.id).length} produktů
              </Text>
              {collection.id === collectionId && (
                <div className="mt-2 flex flex-wrap items-center gap-2"
                  onClick={(e) => e.stopPropagation()}>
                  {(collection.metadata as any)?.image && (
                    <img src={(collection.metadata as any).image} alt=""
                      className="h-8 w-8 rounded object-cover" />
                  )}
                  <label className="text-ui-fg-interactive txt-xsmall cursor-pointer hover:underline">
                    {(collection.metadata as any)?.image ? "Změnit fotku" : "Nastavit fotku"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setCollectionImage.mutate(file);
                        e.currentTarget.value = "";
                      }} />
                  </label>
                  {renaming === "" ? (
                    <>
                      <button type="button"
                        className="text-ui-fg-interactive txt-xsmall hover:underline"
                        onClick={() => setRenaming(collection.title)}>
                        Přejmenovat
                      </button>
                      <Prompt>
                        <Prompt.Trigger asChild>
                          <button type="button"
                            className="text-ui-fg-subtle txt-xsmall hover:underline">
                            Smazat
                          </button>
                        </Prompt.Trigger>
                        <Prompt.Content>
                          <Prompt.Header>
                            <Prompt.Title>Smazat kolekci?</Prompt.Title>
                            <Prompt.Description>
                              Produkty zůstanou v obchodě, jen přijdou o kolekci.
                            </Prompt.Description>
                          </Prompt.Header>
                          <Prompt.Footer>
                            <Prompt.Cancel>Zrušit</Prompt.Cancel>
                            <Prompt.Action onClick={() => deleteCollection.mutate(collection.id)}>
                              Smazat
                            </Prompt.Action>
                          </Prompt.Footer>
                        </Prompt.Content>
                      </Prompt>
                    </>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Input size="small" value={renaming}
                        onChange={(e) => setRenaming(e.target.value)} />
                      <Button size="small" variant="secondary"
                        onClick={() => {
                          renameCollection.mutate({ id: collection.id, title: renaming });
                          setRenaming("");
                        }}>OK</Button>
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
          <div className="mt-2 flex gap-2">
            <Input size="small" placeholder="Nová kolekce…" value={newCollection}
              onChange={(e) => setNewCollection(e.target.value)} />
            <Button size="small" variant="secondary"
              isLoading={createCollection.isPending}
              onClick={() => createCollection.mutate()}>+</Button>
          </div>
        </div>

        {/* ── 2. kategorie in this collection ── */}
        <div className="flex flex-col gap-1 p-3">
          {!selectedCollection && (
            <div className="flex flex-col gap-2 px-1 py-1">
              <Text size="xsmall" className="text-ui-fg-muted">
                Vyberte kolekci vlevo — nebo založte kategorii rovnou:
              </Text>
              <Input size="small" placeholder="Nová kategorie…" value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)} />
              <select
                className="bg-ui-bg-field border-ui-border-base txt-small rounded-md border px-2 py-1.5"
                value={newCategoryCollection}
                onChange={(e) => setNewCategoryCollection(e.target.value)}>
                <option value="">Pod kterou kolekci patří…</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <Button size="small" variant="secondary"
                isLoading={createCategory.isPending}
                onClick={() => createCategory.mutate()}>Založit kategorii</Button>
            </div>
          )}
          {selectedCollection && (
            <>
              <button type="button" onClick={() => setCategoryId(null)}
                className={categoryId === null ? "bg-ui-bg-base-pressed rounded-md px-3 py-2 text-left" : "hover:bg-ui-bg-base-hover rounded-md px-3 py-2 text-left"}>
                <Text size="small">Vše ({inCollection.length})</Text>
              </button>
              {categoriesHere.map((category: any) => (
                <div key={category.id}
                  className={categoryId === category.id ? "bg-ui-bg-base-pressed rounded-md px-3 py-2" : "hover:bg-ui-bg-base-hover rounded-md px-3 py-2"}>
                  {renamingCategory?.id === category.id ? (
                    <span className="flex items-center gap-1">
                      <Input size="small" value={renamingCategory.name}
                        onChange={(e) => setRenamingCategory({ id: category.id, name: e.target.value })} />
                      <Button size="small" variant="secondary"
                        onClick={() => {
                          renameCategory.mutate(renamingCategory);
                          setRenamingCategory(null);
                        }}>OK</Button>
                    </span>
                  ) : (
                    <>
                      <button type="button" className="w-full text-left"
                        onClick={() => setCategoryId(category.id)}>
                        <Text size="small">{category.name}</Text>
                      </button>
                      {categoryId === category.id && (
                        <span className="mt-1 flex gap-2">
                          <button type="button"
                            className="text-ui-fg-interactive txt-xsmall hover:underline"
                            onClick={() => setRenamingCategory({ id: category.id, name: category.name })}>
                            Přejmenovat
                          </button>
                          <Prompt>
                            <Prompt.Trigger asChild>
                              <button type="button"
                                className="text-ui-fg-subtle txt-xsmall hover:underline">
                                Smazat
                              </button>
                            </Prompt.Trigger>
                            <Prompt.Content>
                              <Prompt.Header>
                                <Prompt.Title>Smazat kategorii?</Prompt.Title>
                                <Prompt.Description>
                                  Produkty zůstanou, jen přijdou o tuhle kategorii.
                                </Prompt.Description>
                              </Prompt.Header>
                              <Prompt.Footer>
                                <Prompt.Cancel>Zrušit</Prompt.Cancel>
                                <Prompt.Action onClick={() => deleteCategory.mutate(category.id)}>
                                  Smazat
                                </Prompt.Action>
                              </Prompt.Footer>
                            </Prompt.Content>
                          </Prompt>
                        </span>
                      )}
                    </>
                  )}
                </div>
              ))}
              <div className="mt-2 flex gap-2">
                <Input size="small" placeholder="Nová kategorie…" value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)} />
                <Button size="small" variant="secondary"
                  isLoading={createCategory.isPending}
                  onClick={() => createCategory.mutate()}>+</Button>
              </div>
              {uncategorised.length > 0 && categoriesHere.length > 0 && (
                <button type="button" onClick={() => setCategoryId("none")}
                  className={categoryId === "none" ? "bg-ui-bg-base-pressed rounded-md px-3 py-2 text-left" : "hover:bg-ui-bg-base-hover rounded-md px-3 py-2 text-left"}>
                  <Text size="small">Bez kategorie ({uncategorised.length})</Text>
                </button>
              )}
            </>
          )}
        </div>

        {/* ── 3. produkty ── */}
        <div className="flex flex-col divide-y divide-ui-border-base">
          <div className="flex flex-col gap-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {([
                ["vse", "Vše"],
                ["bezne", "Produkty"],
                ["zakazka", "Zakázky"],
                ["balicek", "Balíčky"],
                ["poskozene", "Poškozené"],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setKindTab(key)}
                  className={
                    kindTab === key
                      ? "border-ui-border-interactive bg-ui-bg-base-pressed txt-small rounded-lg border px-3 py-1.5"
                      : "border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-base-hover txt-small rounded-lg border px-3 py-1.5"
                  }>
                  {label}
                </button>
              ))}
              <div className="flex-1" />
              {pendingCount > 0 && (
                <>
                  <Button size="small"
                    isLoading={applyPending.isPending}
                    onClick={() => applyPending.mutate(Object.keys(pending))}>
                    Potvrdit vše ({pendingCount})
                  </Button>
                  <Button size="small" variant="secondary"
                    disabled={applyPending.isPending}
                    onClick={() => setPending({})}>
                    Zrušit vše
                  </Button>
                </>
              )}
              {selectedCollection && (
                <Button size="small" variant="secondary"
                  onClick={() => setPickerOpen((open) => !open)}>
                  {pickerOpen
                    ? "Zavřít výběr"
                    : `Přidat produkty do ${
                        categoryId && categoryId !== "none"
                          ? "kategorie"
                          : "kolekce"
                      }`}
                </Button>
              )}
              <Button size="small" variant="secondary" asChild>
                <Link to="/novy-produkt">Přidat produkt</Link>
              </Button>
            </div>
            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Vybráno: {selected.size}
                </Text>
                <Button size="small" variant="secondary"
                  isLoading={bulkArchive.isPending}
                  onClick={() => bulkArchive.mutate()}>
                  Archivovat vybrané
                </Button>
                <Prompt>
                  <Prompt.Trigger asChild>
                    <Button size="small" variant="danger">Smazat vybrané</Button>
                  </Prompt.Trigger>
                  <Prompt.Content>
                    <Prompt.Header>
                      <Prompt.Title>Smazat {selected.size} produktů?</Prompt.Title>
                      <Prompt.Description>
                        Smazání je nevratné. Pokud chcete produkty jen stáhnout
                        z obchodu a nechat si historii, použijte Archivovat.
                      </Prompt.Description>
                    </Prompt.Header>
                    <Prompt.Footer>
                      <Prompt.Cancel>Zrušit</Prompt.Cancel>
                      <Prompt.Action onClick={() => bulkDelete.mutate()}>
                        Smazat
                      </Prompt.Action>
                    </Prompt.Footer>
                  </Prompt.Content>
                </Prompt>
                <Button size="small" variant="transparent"
                  onClick={() => setSelected(new Set())}>Zrušit výběr</Button>
              </div>
            )}
          </div>
          {pickerOpen && selectedCollection && (
            <div className="border-ui-border-base flex flex-col gap-2 border-b p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input size="small" type="search" className="min-w-56 flex-1"
                  placeholder="Filtrovat produkty…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)} />
                <Button size="small"
                  isLoading={bulkAssign.isPending}
                  disabled={pickerSelected.size === 0}
                  onClick={() => bulkAssign.mutate()}>
                  Zařadit vybrané ({pickerSelected.size})
                </Button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {products
                  .filter((product) => {
                    // Nenabízet, co už tady je.
                    const inThisCollection = product.collection_id === collectionId;
                    const inThisCategory =
                      categoryId && categoryId !== "none"
                        ? (product.category_refs ?? []).some(
                            (c: any) => c.id === categoryId
                          )
                        : true;
                    if (inThisCollection && inThisCategory) return false;
                    return (
                      !pickerSearch.trim() ||
                      product.title
                        .toLowerCase()
                        .includes(pickerSearch.trim().toLowerCase())
                    );
                  })
                  .map((product) => (
                    <label key={product.id}
                      className="hover:bg-ui-bg-base-hover flex cursor-pointer items-center gap-2 rounded px-2 py-1.5">
                      <input type="checkbox"
                        checked={pickerSelected.has(product.id)}
                        onChange={(e) => {
                          const next = new Set(pickerSelected);
                          if (e.target.checked) next.add(product.id);
                          else next.delete(product.id);
                          setPickerSelected(next);
                        }} />
                      <Thumb src={product.thumbnail} title={product.title}
                        onZoom={() => setLightbox({ id: product.id, title: product.title })} />
                      <Text size="small" className="min-w-0 flex-1 truncate">
                        {product.title}
                        <span className="text-ui-fg-muted">
                          {" "}· {product.collection ?? "bez kolekce"}
                          {(product.category_refs ?? []).length
                            ? ` · ${(product.category_refs ?? [])
                                .map((c: any) => c.name)
                                .join(", ")}`
                            : ""}
                        </span>
                      </Text>
                    </label>
                  ))}
              </div>
            </div>
          )}
          {selectedCollection &&
            visibleProducts.filter((p) => kindTab === "vse" || p.kind === kindTab)
              .length === 0 && (
            <div className="flex flex-col items-start gap-2 p-4">
              <Text size="small" className="text-ui-fg-muted">
                Zatím tu nic není.
              </Text>
              <Button size="small" variant="secondary"
                onClick={() => setPickerOpen(true)}>
                Přidat produkty do {categoryId && categoryId !== "none" ? "kategorie" : "kolekce"}
              </Button>
            </div>
          )}
          {visibleProducts
            .filter((product) => kindTab === "vse" || product.kind === kindTab)
            .map((product) => {
              const draft = draftFor(product);
              const dirty = Boolean(pending[product.id]);
              const applyingThis =
                applyPending.isPending &&
                (applyPending.variables ?? []).includes(product.id);
              return (
            <div key={product.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={selected.has(product.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(product.id);
                  else next.delete(product.id);
                  setSelected(next);
                }}
              />
              <Thumb src={product.thumbnail} title={product.title}
                onZoom={() => setLightbox({ id: product.id, title: product.title })} />
              <div className="min-w-0 flex-1">
                <Text size="small" weight="plus" className="truncate">{product.title}</Text>
                <Badge size="2xsmall" color={kindBadge[product.kind]?.color ?? "grey"}>
                  {kindBadge[product.kind]?.label ?? product.kind}
                </Badge>
              </div>
              <select
                className="bg-ui-bg-field border-ui-border-base txt-small rounded-md border px-2 py-1"
                value={draft.collection_id ?? ""}
                onChange={(e) =>
                  setDraft(product, { collection_id: e.target.value || null })
                }>
                <option value="">Bez kolekce</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              {/* Kategorie až po kolekci — a jen ty, které do ní patří. */}
              {draft.collection_id && (
                <select
                  className="bg-ui-bg-field border-ui-border-base txt-small rounded-md border px-2 py-1"
                  value={draft.category_id ?? ""}
                  onChange={(e) =>
                    setDraft(product, { category_id: e.target.value || null })
                  }>
                  <option value="">Bez kategorie</option>
                  {categoriesOf(draft.collection_id).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              {dirty && (
                <>
                  <Button size="small" isLoading={applyingThis}
                    onClick={() => applyPending.mutate([product.id])}>
                    Potvrdit
                  </Button>
                  <Button size="small" variant="transparent"
                    disabled={applyingThis}
                    onClick={() =>
                      setPending((prev) => {
                        const { [product.id]: _dropped, ...rest } = prev;
                        return rest;
                      })
                    }>
                    Zrušit
                  </Button>
                </>
              )}
              <Link to={`/products/${product.id}`} className="text-ui-fg-interactive txt-small hover:underline">
                Upravit
              </Link>
            </div>
              );
            })}
        </div>
      </div>

      {/* Lightbox — full-size photos of the clicked piece. */}
      <FocusModal
        open={Boolean(lightbox)}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
      >
        <FocusModal.Content>
          <FocusModal.Header>
            <FocusModal.Title asChild>
              <Heading>{lightbox?.title ?? ""}</Heading>
            </FocusModal.Title>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-col items-center gap-6 overflow-y-auto p-6">
            {lightboxLoading && (
              <Text size="small" className="text-ui-fg-subtle py-12">
                Načítám fotky…
              </Text>
            )}
            {!lightboxLoading && lightboxImages.length === 0 && (
              <Text size="small" className="text-ui-fg-subtle py-12">
                Produkt zatím nemá žádné fotky — přidáte je přes Upravit.
              </Text>
            )}
            {!lightboxLoading &&
              lightboxImages.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt={lightbox?.title ?? ""}
                  className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
                />
              ))}
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  );
};

const queryClient = new QueryClient();
const Page = () => (
  <QueryClientProvider client={queryClient}><Inner /></QueryClientProvider>
);
export const config = defineRouteConfig({ label: "Rozdělení", icon: ListTree });
export default Page;
