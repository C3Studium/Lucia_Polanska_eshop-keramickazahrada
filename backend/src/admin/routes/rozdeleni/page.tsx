import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ListTree } from "@medusajs/icons";
import {
  Badge, Button, Container, Heading, Input, Prompt, Text, Toaster, toast,
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

const Inner = () => {
  const queryClient = useQueryClient();
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | "none" | null>(null);
  const [newCollection, setNewCollection] = useState("");
  const [renaming, setRenaming] = useState("");

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["rozdeleni-collections"] });
    await queryClient.invalidateQueries({ queryKey: ["workbench-products-all"] });
    await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
  };

  const { data: collectionsData } = useQuery<any>({
    queryKey: ["rozdeleni-collections"],
    queryFn: () => sdk.client.fetch("/admin/collections?limit=100"),
    refetchOnWindowFocus: true,
  });
  const { data: categoriesData } = useQuery<any>({
    queryKey: ["rozdeleni-categories"],
    queryFn: () => sdk.client.fetch("/admin/product-categories?limit=100"),
  });
  const { data: productsData } = useQuery<any>({
    queryKey: ["workbench-products-all"],
    queryFn: () => sdk.client.fetch("/admin/workbench/products?limit=200"),
    refetchOnWindowFocus: true,
  });

  const collections: any[] = collectionsData?.collections ?? [];
  const allCategories: any[] = categoriesData?.product_categories ?? [];
  const products: any[] = productsData?.products ?? [];

  const inCollection = products.filter(
    (product) => product.collection_id === collectionId
  );
  const categoriesHere = [
    ...new Map(
      inCollection
        .flatMap((product) => product.category_refs ?? [])
        .map((category: any) => [category.id, category])
    ).values(),
  ];
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
  const moveProduct = useMutation({
    mutationFn: (payload: { id: string; body: any }) =>
      sdk.client.fetch(`/admin/products/${payload.id}`, {
        method: "POST", body: payload.body,
      }),
    onSuccess: async () => { await invalidate(); toast.success("Přesunuto."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Přesun se nepodařil."),
  });

  const selectedCollection = collections.find((c) => c.id === collectionId);

  return (
    <Container className="p-0">
      <Toaster />
      <header className="border-ui-border-base border-b px-6 pb-4 pt-6">
        <Heading>Rozdělení</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1 max-w-2xl">
          Kolekce, jejich kategorie a produkty vedle sebe. Klik vlevo otevře
          prostředek, klik uprostřed pravý sloupec.
        </Text>
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
            <Text size="xsmall" className="text-ui-fg-muted px-2 py-1">
              Vyberte kolekci vlevo.
            </Text>
          )}
          {selectedCollection && (
            <>
              <div className="mb-1 flex items-center gap-1 px-1">
                {renaming === "" ? (
                  <>
                    <button type="button" className="text-ui-fg-interactive txt-xsmall hover:underline"
                      onClick={() => setRenaming(selectedCollection.title)}>Přejmenovat</button>
                    <Prompt>
                      <Prompt.Trigger asChild>
                        <button type="button" className="text-ui-fg-subtle txt-xsmall hover:underline">Smazat</button>
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
                          <Prompt.Action onClick={() => deleteCollection.mutate(selectedCollection.id)}>
                            Smazat
                          </Prompt.Action>
                        </Prompt.Footer>
                      </Prompt.Content>
                    </Prompt>
                  </>
                ) : (
                  <>
                    <Input size="small" value={renaming} onChange={(e) => setRenaming(e.target.value)} />
                    <Button size="small" variant="secondary"
                      onClick={() => { renameCollection.mutate({ id: selectedCollection.id, title: renaming }); setRenaming(""); }}>
                      OK
                    </Button>
                  </>
                )}
              </div>
              <button type="button" onClick={() => setCategoryId(null)}
                className={categoryId === null ? "bg-ui-bg-base-pressed rounded-md px-3 py-2 text-left" : "hover:bg-ui-bg-base-hover rounded-md px-3 py-2 text-left"}>
                <Text size="small">Vše ({inCollection.length})</Text>
              </button>
              {categoriesHere.map((category: any) => (
                <button key={category.id} type="button" onClick={() => setCategoryId(category.id)}
                  className={categoryId === category.id ? "bg-ui-bg-base-pressed rounded-md px-3 py-2 text-left" : "hover:bg-ui-bg-base-hover rounded-md px-3 py-2 text-left"}>
                  <Text size="small">{category.name}</Text>
                </button>
              ))}
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
          {selectedCollection && visibleProducts.length === 0 && (
            <Text size="small" className="text-ui-fg-muted p-4">
              Nic tu není.
            </Text>
          )}
          {visibleProducts.map((product) => (
            <div key={product.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Text size="small" weight="plus" className="truncate">{product.title}</Text>
                <Badge size="2xsmall" color={kindBadge[product.kind]?.color ?? "grey"}>
                  {kindBadge[product.kind]?.label ?? product.kind}
                </Badge>
              </div>
              <select
                className="bg-ui-bg-field border-ui-border-base txt-small rounded-md border px-2 py-1"
                value={product.collection_id ?? ""}
                onChange={(e) =>
                  moveProduct.mutate({ id: product.id, body: { collection_id: e.target.value || null } })
                }>
                <option value="">Bez kolekce</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <select
                className="bg-ui-bg-field border-ui-border-base txt-small rounded-md border px-2 py-1"
                value={(product.category_refs ?? [])[0]?.id ?? ""}
                onChange={(e) =>
                  moveProduct.mutate({
                    id: product.id,
                    body: { categories: e.target.value ? [{ id: e.target.value }] : [] },
                  })
                }>
                <option value="">Bez kategorie</option>
                {allCategories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Link to={`/products/${product.id}`} className="text-ui-fg-interactive txt-small hover:underline">
                Upravit
              </Link>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
};

const queryClient = new QueryClient();
const Page = () => (
  <QueryClientProvider client={queryClient}><Inner /></QueryClientProvider>
);
export const config = defineRouteConfig({ label: "Rozdělení", icon: ListTree });
export default Page;
