import { XMark } from "@medusajs/icons";
import { Badge, Select, Text, toast } from "@medusajs/ui";
import { useState } from "react";
import { Link } from "react-router-dom";

/**
 * Zařazení výrobku — kolekce a kategorie (19. 11. 2026, Matěj: „přidat do
 * víc kolekcí nebo kategorií není jednoduché a blok je moc velký").
 *
 * Jako seznam v Nastavení na iPhonu: jeden řádek = jedna kolekce, ve které
 * výrobek je. Vlevo kolekce (u hlavní štítek), vpravo její kategorie jako
 * štítky s křížkem a „+ Kategorie" — nabízí jen kategorie TÉ kolekce, takže
 * se nic nehledá v mraku všech. Křížek na konci řádku výrobek z kolekce
 * vyndá. Dole „+ Přidat do kolekce".
 *
 * ## Jak to sedí na data
 *
 * Medusa má jedinou `collection_id` (= hlavní kolekce). Do dalších kolekcí
 * se výrobek dostane přes jejich kategorie (`category.metadata.collection_id`,
 * viz [[kolekce-z-kategorii]] — obchod, menu i Produkty+ to tak počítají).
 * Proto:
 * - první kolekce se stane hlavní,
 * - další kolekce s kategoriemi se přidá jako řádek, který se uloží výběrem
 *   kategorie (bez ní by se výrobek v té kolekci neukázal),
 * - kolekce bez kategorií může být jen hlavní („Nastavit jako hlavní").
 */

type Collection = { id: string; title: string };
type Category = { id: string; name: string; metadata?: Record<string, unknown> | null };

export type ClassificationChange = {
  collection_id?: string | null;
  categories?: { id: string }[];
};

const collectionOf = (category: Category): string | null => {
  const value = (category.metadata ?? {})["collection_id"];
  return typeof value === "string" && value ? value : null;
};

const NONE = "__none__";

export const ProductClassification = ({
  collectionId,
  categoryIds,
  collections,
  categories,
  pending,
  onSave,
}: {
  collectionId: string | null;
  categoryIds: string[];
  collections: Collection[];
  categories: Category[];
  pending: boolean;
  onSave: (change: ClassificationChange, message?: string) => void;
}) => {
  /* Kolekce přidané, ale zatím bez kategorie (uloží se výběrem kategorie). */
  const [draftRows, setDraftRows] = useState<string[]>([]);
  const [addKey, setAddKey] = useState(0);

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const titleOf = (id: string) => collections.find((item) => item.id === id)?.title ?? "Kolekce";
  const categoriesIn = (id: string | null) =>
    categories.filter((category) => collectionOf(category) === id);

  /* Řádky: hlavní, kolekce z vybraných kategorií, rozpracované, bez kolekce. */
  const rowIds: string[] = [];
  if (collectionId) rowIds.push(collectionId);
  for (const id of categoryIds) {
    const owner = categoryById.get(id) ? collectionOf(categoryById.get(id)!) : null;
    if (owner && !rowIds.includes(owner)) rowIds.push(owner);
  }
  for (const id of draftRows) if (!rowIds.includes(id)) rowIds.push(id);
  const orphanIds = categoryIds.filter((id) => {
    const category = categoryById.get(id);
    return !category || !collectionOf(category);
  });

  const save = (categoriesNext: string[], collectionNext: string | null, message?: string) =>
    onSave(
      {
        ...(collectionNext !== collectionId ? { collection_id: collectionNext } : {}),
        categories: categoriesNext.map((id) => ({ id })),
      },
      message
    );

  const addCategory = (rowId: string, categoryId: string) => {
    setDraftRows((rows) => rows.filter((id) => id !== rowId));
    save([...categoryIds, categoryId], collectionId ?? rowId);
  };

  const removeCategory = (categoryId: string) =>
    save(
      categoryIds.filter((id) => id !== categoryId),
      collectionId
    );

  const removeRow = (rowId: string) => {
    if (draftRows.includes(rowId) && rowId !== collectionId) {
      setDraftRows((rows) => rows.filter((id) => id !== rowId));
      return;
    }
    const rest = categoryIds.filter((id) => {
      const category = categoryById.get(id);
      return !category || collectionOf(category) !== rowId;
    });
    let main = collectionId;
    if (rowId === collectionId) {
      /* Hlavní pryč → hlavní je další kolekce v pořadí, jinak žádná. */
      main = rowIds.find((id) => id !== rowId && !draftRows.includes(id)) ?? null;
    }
    save(rest, main, `Vyndáno z kolekce „${titleOf(rowId)}“.`);
  };

  const makeMain = (rowId: string) => save(categoryIds, rowId, `„${titleOf(rowId)}“ je teď hlavní kolekce.`);

  const addCollection = (id: string) => {
    setAddKey((key) => key + 1);
    if (!collectionId) {
      save(categoryIds, id, `Zařazeno do kolekce „${titleOf(id)}“.`);
      return;
    }
    if (categoriesIn(id).length === 0) {
      /* Bez kategorií se dá být jen v hlavní kolekci. */
      const oldMainKept = categoryIds.some((categoryId) => {
        const category = categoryById.get(categoryId);
        return category && collectionOf(category) === collectionId;
      });
      save(
        categoryIds,
        id,
        oldMainKept
          ? `„${titleOf(id)}“ je teď hlavní kolekce.`
          : `„${titleOf(id)}“ je teď hlavní kolekce — z „${titleOf(collectionId)}“ výrobek zmizel (neměl tam kategorii).`
      );
      return;
    }
    setDraftRows((rows) => [...rows, id]);
  };

  const available = collections.filter((collection) => !rowIds.includes(collection.id));

  if (!collections.length) {
    return (
      <div className="px-3 py-2.5">
        <Text size="small" className="text-ui-fg-subtle">
          Zatím žádné kolekce — založíte je v{" "}
          <Link to="/rozdeleni" className="text-ui-fg-interactive hover:underline">
            Kolekce a kategorie
          </Link>
          .
        </Text>
      </div>
    );
  }

  return (
    <>
      {rowIds.length === 0 && orphanIds.length === 0 && (
        <div className="px-3 py-2.5">
          <Text size="small" className="text-ui-fg-subtle">
            Výrobek zatím není v žádné kolekci — v obchodě ho zákazník v nabídce nenajde.
          </Text>
        </div>
      )}

      {rowIds.map((rowId) => {
        const own = categoriesIn(rowId);
        const chosen = categoryIds.filter((id) => categoryById.get(id) && collectionOf(categoryById.get(id)!) === rowId);
        const offer = own.filter((category) => !chosen.includes(category.id));
        const isMain = rowId === collectionId;
        const isDraft = !isMain && chosen.length === 0;
        return (
          <div
            key={rowId}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)_auto]"
          >
            <div className="flex min-h-[32px] flex-wrap items-center gap-x-2 gap-y-1">
              <Text size="small" weight="plus">
                {titleOf(rowId)}
              </Text>
              {isMain ? (
                <Badge size="2xsmall" color="blue">
                  hlavní
                </Badge>
              ) : !isDraft ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => makeMain(rowId)}
                  className="text-ui-fg-muted hover:text-ui-fg-subtle txt-compact-xsmall"
                >
                  nastavit jako hlavní
                </button>
              ) : null}
            </div>

            <button
              type="button"
              aria-label={`Vyndat z kolekce ${titleOf(rowId)}`}
              title={`Vyndat z kolekce ${titleOf(rowId)}`}
              disabled={pending}
              onClick={() => removeRow(rowId)}
              className="text-ui-fg-muted hover:text-ui-fg-base hover:bg-ui-bg-base-hover col-start-2 row-start-1 flex size-8 items-center justify-center rounded-md sm:col-start-3"
            >
              <XMark />
            </button>

            <div className="col-span-2 flex flex-wrap items-center gap-1.5 sm:col-span-1 sm:col-start-2 sm:row-start-1">
              {chosen.map((id) => (
                <span
                  key={id}
                  className="bg-ui-bg-base-pressed text-ui-fg-base inline-flex min-h-[32px] items-center gap-1 rounded-full pl-3 pr-1"
                >
                  <Text size="small">{categoryById.get(id)?.name}</Text>
                  <button
                    type="button"
                    aria-label={`Odebrat kategorii ${categoryById.get(id)?.name}`}
                    disabled={pending}
                    onClick={() => removeCategory(id)}
                    className="text-ui-fg-muted hover:text-ui-fg-base flex size-6 items-center justify-center rounded-full"
                  >
                    <XMark className="size-3.5" />
                  </button>
                </span>
              ))}
              {own.length === 0 ? (
                <Text size="xsmall" className="text-ui-fg-muted">
                  Kolekce nemá kategorie — stačí být v ní.
                </Text>
              ) : offer.length > 0 ? (
                <div className="w-44">
                  <Select
                    key={`${rowId}:${chosen.join(",")}`}
                    size="small"
                    disabled={pending}
                    onValueChange={(value) => addCategory(rowId, value)}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="+ Kategorie" />
                    </Select.Trigger>
                    <Select.Content className="z-50">
                      {offer.map((category) => (
                        <Select.Item key={category.id} value={category.id}>
                          {category.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              ) : null}
              {isDraft && (
                <Text size="xsmall" className="text-ui-fg-error w-full">
                  Vyberte kategorii — bez ní se tu výrobek neukáže.
                </Text>
              )}
            </div>
          </div>
        );
      })}

      {orphanIds.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 px-3 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <Text size="small" weight="plus" className="text-ui-fg-subtle">
            Bez kolekce
          </Text>
          <div className="flex flex-wrap gap-1.5">
            {orphanIds.map((id) => (
              <span
                key={id}
                className="bg-ui-bg-base-pressed inline-flex min-h-[32px] items-center gap-1 rounded-full pl-3 pr-1"
              >
                <Text size="small">{categoryById.get(id)?.name ?? "Kategorie"}</Text>
                <button
                  type="button"
                  aria-label="Odebrat kategorii"
                  disabled={pending}
                  onClick={() => removeCategory(id)}
                  className="text-ui-fg-muted hover:text-ui-fg-base flex size-6 items-center justify-center rounded-full"
                >
                  <XMark className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div className="px-3 py-2.5">
          <div className="w-56">
            <Select key={addKey} size="small" disabled={pending} onValueChange={(value) => value !== NONE && addCollection(value)}>
              <Select.Trigger>
                <Select.Value placeholder="+ Přidat do kolekce" />
              </Select.Trigger>
              <Select.Content className="z-50">
                {available.map((collection) => (
                  <Select.Item key={collection.id} value={collection.id}>
                    {collection.title}
                    {collectionId && categoriesIn(collection.id).length === 0 ? " (jako hlavní)" : ""}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </div>
      )}
    </>
  );
};

/* ———————————————— Hromadně (pravý panel Produkty+) ———————————————— */

export type BulkClassificationDraft = {
  /** Kategorie přidat všem vybraným. */
  add: string[];
  /** Kategorie odebrat všem vybraným. */
  remove: string[];
  /** Hlavní kolekce všem vybraným; `undefined` = beze změny. */
  collection?: string | null;
  /** Kolekce přidané, ale zatím bez kategorie (jen zobrazení). */
  draftRows?: string[];
};

export const emptyBulkClassification = (): BulkClassificationDraft => ({ add: [], remove: [] });

export const bulkClassificationDirty = (draft: BulkClassificationDraft) =>
  draft.add.length > 0 || draft.remove.length > 0 || draft.collection !== undefined;

/** Výsledek pro jeden výrobek po použití hromadné změny. */
export const applyBulkClassification = (
  product: { collection_id: string | null; category_ids: string[] },
  draft: BulkClassificationDraft,
  categories: Category[]
): { collection_id: string | null; category_ids: string[] } => {
  const ids = [...new Set([...product.category_ids, ...draft.add])].filter(
    (id) => !draft.remove.includes(id)
  );
  let collection = draft.collection !== undefined ? draft.collection : product.collection_id;
  if (!collection) {
    /* Bez hlavní kolekce → první kolekce z přidaných kategorií. */
    const first = draft.add.map((id) => categories.find((c) => c.id === id)).find(Boolean);
    collection = first ? collectionOf(first) : null;
  }
  return { collection_id: collection ?? null, category_ids: ids };
};

/**
 * Zařazení pro víc výrobků najednou — stejné řádky jako na detailu výrobku
 * (kolekce vlevo, její kategorie vpravo), jen u štítku je, kolika
 * vybraných se týká („2/3"). × odebere kategorii všem, „+ Kategorie" ji
 * přidá všem; uloží se až „Uložit vše" v panelu.
 */
export const BulkClassification = ({
  products,
  collections,
  categories,
  draft,
  onChange,
}: {
  products: { id: string; collection_id: string | null; category_ids: string[] }[];
  collections: Collection[];
  categories: Category[];
  draft: BulkClassificationDraft;
  onChange: (next: BulkClassificationDraft) => void;
}) => {
  const [addKey, setAddKey] = useState(0);
  const total = products.length;
  const after = products.map((product) => applyBulkClassification(product, draft, categories));
  const titleOf = (id: string) => collections.find((item) => item.id === id)?.title ?? "Kolekce";
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const categoriesIn = (id: string) => categories.filter((category) => collectionOf(category) === id);

  const rowIds: string[] = [];
  for (const product of after) {
    if (product.collection_id && !rowIds.includes(product.collection_id)) rowIds.push(product.collection_id);
    for (const id of product.category_ids) {
      const owner = categoryById.get(id) ? collectionOf(categoryById.get(id)!) : null;
      if (owner && !rowIds.includes(owner)) rowIds.push(owner);
    }
  }
  for (const id of draft.draftRows ?? []) if (!rowIds.includes(id)) rowIds.push(id);

  const countWith = (categoryId: string) =>
    after.filter((product) => product.category_ids.includes(categoryId)).length;
  const mainCount = (collectionId: string) =>
    after.filter((product) => product.collection_id === collectionId).length;

  const addCategory = (categoryId: string) =>
    onChange({
      ...draft,
      add: [...new Set([...draft.add, categoryId])],
      remove: draft.remove.filter((id) => id !== categoryId),
    });
  const removeCategory = (categoryId: string) =>
    onChange({
      ...draft,
      add: draft.add.filter((id) => id !== categoryId),
      remove: [...new Set([...draft.remove, categoryId])],
    });
  const addCollection = (id: string) => {
    setAddKey((key) => key + 1);
    if (categoriesIn(id).length === 0) {
      onChange({ ...draft, collection: id });
      return;
    }
    onChange({ ...draft, draftRows: [...(draft.draftRows ?? []), id] });
  };
  const available = collections.filter((collection) => !rowIds.includes(collection.id));

  return (
    <>
      {rowIds.map((rowId) => {
        const own = categoriesIn(rowId);
        const chosen = own.filter((category) => countWith(category.id) > 0);
        const offer = own.filter((category) => countWith(category.id) < total);
        const main = mainCount(rowId);
        return (
          <div key={rowId} className="flex flex-col gap-2 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Text size="small" weight="plus">
                {titleOf(rowId)}
              </Text>
              {main === total ? (
                <Badge size="2xsmall" color="blue">
                  hlavní
                </Badge>
              ) : main > 0 ? (
                <Badge size="2xsmall" color="grey">
                  hlavní u {main}/{total}
                </Badge>
              ) : null}
              {main < total && own.length === 0 && (
                <button
                  type="button"
                  onClick={() => onChange({ ...draft, collection: rowId })}
                  className="text-ui-fg-muted hover:text-ui-fg-subtle txt-compact-xsmall"
                >
                  nastavit jako hlavní všem
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {chosen.map((category) => {
                const count = countWith(category.id);
                return (
                  <span
                    key={category.id}
                    className="bg-ui-bg-base-pressed text-ui-fg-base inline-flex min-h-[30px] items-center gap-1 rounded-full pl-3 pr-1"
                  >
                    <Text size="small">
                      {category.name}
                      {count < total ? (
                        <span className="text-ui-fg-muted"> {count}/{total}</span>
                      ) : null}
                    </Text>
                    <button
                      type="button"
                      aria-label={`Odebrat kategorii ${category.name} všem vybraným`}
                      onClick={() => removeCategory(category.id)}
                      className="text-ui-fg-muted hover:text-ui-fg-base flex size-6 items-center justify-center rounded-full"
                    >
                      <XMark className="size-3.5" />
                    </button>
                  </span>
                );
              })}
              {own.length === 0 ? (
                <Text size="xsmall" className="text-ui-fg-muted">
                  Kolekce nemá kategorie.
                </Text>
              ) : offer.length > 0 ? (
                <div className="w-40">
                  <Select
                    key={`${rowId}:${draft.add.join(",")}:${draft.remove.join(",")}`}
                    size="small"
                    onValueChange={addCategory}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="+ Kategorie" />
                    </Select.Trigger>
                    <Select.Content className="z-50">
                      {offer.map((category) => (
                        <Select.Item key={category.id} value={category.id}>
                          {category.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      {available.length > 0 && (
        <div className="px-3 py-2.5">
          <div className="w-full">
            <Select key={addKey} size="small" onValueChange={addCollection}>
              <Select.Trigger>
                <Select.Value placeholder="+ Přidat do kolekce" />
              </Select.Trigger>
              <Select.Content className="z-50">
                {available.map((collection) => (
                  <Select.Item key={collection.id} value={collection.id}>
                    {collection.title}
                    {categoriesIn(collection.id).length === 0 ? " (jako hlavní)" : ""}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </div>
      )}
    </>
  );
};

/** Pro toast po uložení — volající ho ukáže, když uložení projde. */
export const classificationToast = (message?: string) => {
  if (message) toast.success(message);
};
