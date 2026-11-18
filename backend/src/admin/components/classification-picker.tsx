import { Label, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";

/**
 * Kolekce → kategorie při ZAKLÁDÁNÍ výrobku (18. 11. 2026). Dřív se
 * zařazení vybíralo až na detailu, takže nové výrobky vznikaly „bez
 * zařazení" a v obchodě ani v adminu nebyly v žádné kategorii. Stejná
 * kaskáda jako na detailu: kategorie patří kolekci přes
 * `metadata.collection_id` (Kolekce a kategorie; čte ji i menu obchodu).
 *
 * Řízená komponenta — hodnoty drží volající a pošle je do založení.
 */
export const ClassificationPicker = ({
  collectionId,
  categoryIds,
  onChange,
}: {
  collectionId: string;
  categoryIds: string[];
  onChange: (next: { collectionId: string; categoryIds: string[] }) => void;
}) => {
  const collectionsQuery = useQuery<{ collections: { id: string; title: string }[] }>({
    queryKey: ["produkt-collections"],
    queryFn: () => sdk.client.fetch(`/admin/collections?limit=100&fields=id,title`),
    staleTime: 5 * 60_000,
  });
  const categoriesQuery = useQuery<{
    product_categories: { id: string; name: string; metadata?: Record<string, unknown> | null }[];
  }>({
    queryKey: ["produkt-categories"],
    queryFn: () =>
      sdk.client.fetch(`/admin/product-categories?limit=100&fields=id,name,is_active,metadata`),
    staleTime: 5 * 60_000,
  });
  const collections = collectionsQuery.data?.collections ?? [];
  const inCollection = (categoriesQuery.data?.product_categories ?? []).filter(
    (category) => collectionId && (category.metadata ?? {})["collection_id"] === collectionId
  );

  const chip = (on: boolean) =>
    `min-h-[36px] rounded-full border px-3.5 py-1.5 ${
      on
        ? "border-ui-border-interactive bg-ui-bg-base-pressed text-ui-fg-base"
        : "border-ui-border-base bg-ui-bg-base text-ui-fg-subtle hover:bg-ui-bg-base-hover"
    }`;

  return (
    <div className="flex w-full flex-col gap-3">
      <div>
        <Label>Kolekce</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          {collections.map((collection) => {
            const on = collectionId === collection.id;
            return (
              <button
                key={collection.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ collectionId: collection.id, categoryIds: [] })}
                className={chip(on)}
              >
                <Text size="small" weight={on ? "plus" : "regular"}>
                  {on ? "✓ " : ""}
                  {collection.title}
                </Text>
              </button>
            );
          })}
        </div>
      </div>
      {collectionId && (
        <div>
          <Label>Kategorie</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {inCollection.length === 0 && (
              <Text size="small" className="text-ui-fg-muted">
                Tahle kolekce zatím nemá kategorie — přidejte je v Kolekce a kategorie.
              </Text>
            )}
            {inCollection.map((category) => {
              const on = categoryIds.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onChange({
                      collectionId,
                      categoryIds: on
                        ? categoryIds.filter((id) => id !== category.id)
                        : [...categoryIds, category.id],
                    })
                  }
                  className={chip(on)}
                >
                  <Text size="small" weight={on ? "plus" : "regular"}>
                    {on ? "✓ " : ""}
                    {category.name}
                  </Text>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/** Data pro založení výrobku z výběru (prázdné hodnoty se vynechají). */
export const classificationPayload = (collectionId: string, categoryIds: string[]) => ({
  ...(collectionId ? { collection_id: collectionId } : {}),
  ...(categoryIds.length ? { categories: categoryIds.map((id) => ({ id })) } : {}),
});
