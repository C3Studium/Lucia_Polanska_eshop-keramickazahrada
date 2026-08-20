import { Badge, Button, Heading, Switch, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sdk } from "../lib/sdk";
import { ProductLightbox, Thumb } from "./product-thumb";

/**
 * Guided sorting for the imported catalogue: one product at a time, front and
 * centre, with everything the decision needs on one screen — the photo, the
 * description, and what the OLD shop said about it (its category ride along in
 * `metadata.import_categories`, „NA ZAKÁZKU" lives in titles, damage reasons in
 * descriptions). The guide pre-selects from those hints, so her work is
 * confirming, not researching: Enter, next piece.
 *
 * The queue is simply „products with no category yet" — leaving and coming
 * back later resumes exactly where the catalogue actually is, with no state
 * of its own to lose.
 */

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("cs");

const COMMISSION_HANDLE = "zakazkova-vyroba";

type GuideProduct = {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  metadata: Record<string, unknown> | null;
  categories: { id: string }[] | null;
};

export const ProductSortingGuide = () => {
  const queryClient = useQueryClient();
  const [lightbox, setLightbox] = useState<{ id: string; title: string } | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [isCommission, setIsCommission] = useState(false);
  const [isDamaged, setIsDamaged] = useState(false);

  const productsQuery = useQuery({
    queryKey: ["sorting-guide-products"],
    queryFn: async () => {
      const gathered: GuideProduct[] = [];
      for (let offset = 0; ; offset += 200) {
        const page = await sdk.client.fetch<{ products: GuideProduct[]; count: number }>(
          `/admin/products?limit=200&offset=${offset}&fields=id,title,description,thumbnail,metadata,*categories`
        );
        gathered.push(...page.products);
        if (gathered.length >= page.count) break;
      }
      return gathered;
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["sorting-guide-categories"],
    queryFn: () =>
      sdk.client.fetch<{ product_categories: { id: string; name: string; handle: string }[] }>(
        `/admin/product-categories?limit=100&fields=id,name,handle`
      ),
  });

  const categories = useMemo(
    () => categoriesQuery.data?.product_categories ?? [],
    [categoriesQuery.data]
  );
  const commissionCategory = categories.find(
    (category) => category.handle === COMMISSION_HANDLE
  );

  const allProducts = productsQuery.data ?? [];
  const unsorted = useMemo(
    () =>
      allProducts
        .filter((product) => !(product.categories?.length ?? 0))
        .sort((first, second) => first.title.localeCompare(second.title, "cs")),
    [allProducts]
  );
  const queue = unsorted.filter((product) => !skipped.has(product.id));
  const current = queue[0] ?? null;
  const doneCount = allProducts.length - unsorted.length;

  /* The old shop's opinion about the current piece — shown, and pre-selected. */
  const suggestion = useMemo(() => {
    if (!current) return { catIds: [] as string[], oldNames: "", commission: false, damaged: false };
    const oldNames = String(current.metadata?.import_categories ?? "");
    const catIds = oldNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => categories.find((category) => fold(category.name) === fold(name))?.id)
      .filter((id): id is string => Boolean(id));
    const text = `${current.title} ${current.description ?? ""}`;
    return {
      catIds,
      oldNames,
      commission: /na zakázku/i.test(current.title),
      damaged: /důvod slevy/i.test(text),
    };
  }, [current, categories]);

  // A new piece on screen starts from the old shop's suggestion.
  useEffect(() => {
    setSelectedCats(new Set(suggestion.catIds));
    setIsCommission(suggestion.commission);
    setIsDamaged(suggestion.damaged);
  }, [current?.id, suggestion.catIds.join("|"), suggestion.commission, suggestion.damaged]);

  const save = useMutation({
    mutationFn: async () => {
      if (!current) return;
      const catIds = new Set(selectedCats);
      if (isCommission && commissionCategory) catIds.add(commissionCategory.id);
      await sdk.client.fetch(`/admin/products/${current.id}`, {
        method: "POST",
        body: { categories: [...catIds].map((id) => ({ id })) },
      });
      if (isDamaged) {
        await sdk.client.fetch(`/admin/workbench/products/${current.id}/flags`, {
          method: "POST",
          body: { clearance: true },
        });
      }
    },
    onSuccess: async () => {
      toast.success(`Zařazeno: ${current?.title ?? ""}`);
      /* Update the cached queue in place instead of re-downloading the whole
         catalogue — the guide is „Enter, další kus", and a full refetch after
         every piece made the pause between pieces self-inflicted. */
      const sortedId = current?.id;
      const savedIds = new Set(selectedCats);
      if (isCommission && commissionCategory) savedIds.add(commissionCategory.id);
      const sortedCats = [...savedIds].map((id) => ({ id }));
      queryClient.setQueryData<GuideProduct[]>(
        ["sorting-guide-products"],
        (previous) =>
          (previous ?? []).map((item) =>
            item.id === sortedId ? { ...item, categories: sortedCats } : item
          )
      );
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Uložení se nepodařilo."),
  });

  const saveCurrent = useCallback(() => {
    if (!current || save.isPending) return;
    if (!selectedCats.size && !(isCommission && commissionCategory)) {
      toast.warning("Vyberte aspoň jednu kategorii — jinak kus zůstane nezařazený.");
      return;
    }
    save.mutate();
  }, [current, save, selectedCats, isCommission, commissionCategory]);

  // Enter = save & next. The guide has no text inputs, so Enter is free.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea")) return;
      event.preventDefault();
      saveCurrent();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveCurrent]);

  if (productsQuery.isLoading || categoriesQuery.isLoading) {
    return <Text className="text-ui-fg-subtle p-6">Načítám frontu…</Text>;
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-2 p-10 text-center">
        <Heading level="h2">
          {unsorted.length
            ? "Zbytek jste přeskočili — vraťte se k nim obnovením stránky."
            : "Všechno je roztříděné."}
        </Heading>
        <Text className="text-ui-fg-subtle">
          {doneCount} z {allProducts.length} produktů má kategorii.
        </Text>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Text size="small" className="text-ui-fg-subtle">
          Roztříděno {doneCount} z {allProducts.length} · ve frontě {queue.length}
        </Text>
        <div className="bg-ui-bg-subtle h-1.5 w-40 overflow-hidden rounded-full">
          <div
            className="bg-ui-fg-interactive h-full rounded-full transition-all"
            style={{ width: `${allProducts.length ? Math.round((doneCount / allProducts.length) * 100) : 0}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="shrink-0">
          <Thumb
            src={current.thumbnail}
            title={current.title}
            sizeClassName="size-56"
            onZoom={() => setLightbox({ id: current.id, title: current.title })}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Heading level="h2">{current.title}</Heading>
          {suggestion.oldNames && (
            <div className="flex flex-wrap items-center gap-2">
              <Text size="small" className="text-ui-fg-subtle">
                Ve starém obchodě:
              </Text>
              <Badge size="2xsmall" color="orange">{suggestion.oldNames}</Badge>
            </div>
          )}
          <Text size="small" className="text-ui-fg-subtle line-clamp-4 whitespace-pre-line">
            {current.description || "Bez popisu."}
          </Text>

          <div className="mt-1">
            <Text size="small" weight="plus" className="mb-1.5">
              Kategorie
            </Text>
            <div className="flex flex-wrap gap-1.5">
              {categories
                .filter((category) => category.handle !== COMMISSION_HANDLE)
                .map((category) => {
                  const selected = selectedCats.has(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() =>
                        setSelectedCats((previous) => {
                          const next = new Set(previous);
                          if (next.has(category.id)) next.delete(category.id);
                          else next.add(category.id);
                          return next;
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        selected
                          ? "border-ui-border-interactive bg-ui-bg-interactive text-ui-fg-on-color"
                          : "border-ui-border-base text-ui-fg-subtle hover:border-ui-border-strong"
                      }`}
                    >
                      {category.name}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2">
              <Switch checked={isCommission} onCheckedChange={setIsCommission} />
              <Text size="small">Zakázková výroba</Text>
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={isDamaged} onCheckedChange={setIsDamaged} />
              <Text size="small">Poškozený kus / výprodej</Text>
            </label>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Button size="small" onClick={saveCurrent} isLoading={save.isPending}>
              Uložit a další (Enter)
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() =>
                setSkipped((previous) => new Set(previous).add(current.id))
              }
              disabled={save.isPending}
            >
              Přeskočit
            </Button>
          </div>
        </div>
      </div>

      {lightbox && (
        <ProductLightbox product={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
};
