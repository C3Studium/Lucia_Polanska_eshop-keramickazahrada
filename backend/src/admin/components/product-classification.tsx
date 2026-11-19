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

import {
  applyBulkClassification,
  collectionOf,
  emptyBulkClassification,
  sortDraft,
  type BulkClassificationDraft,
  type Category,
  type Collection,
  type SortMode,
} from "./classification-draft";
export {
  applyBulkClassification,
  bulkClassificationDirty,
  emptyBulkClassification,
  sortDraft,
  type BulkClassificationDraft,
  type SortMode,
} from "./classification-draft";

export type ClassificationChange = {
  collection_id?: string | null;
  categories?: { id: string }[];
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

/* ———————————————— Přeřazení (Kolekce a kategorie) ———————————————— */

/**
 * Panel „Zařadit N výrobků" v Kolekce a kategorie (19. 11. 2026, Matěj:
 * „jen zařazení a ať to dává smysl"). Tři kroky shora dolů jako
 * v Nastavení: Teď (kde výrobky jsou) → Co udělat (Přesunout / Přidat
 * i sem) → Kam (kolekce, pak její kategorie). Dole věta, co se stane.
 */
export const BulkSortPanel = ({
  products,
  collections,
  categories,
  onChange,
}: {
  products: { id: string; collection_id: string | null; category_ids: string[] }[];
  collections: Collection[];
  categories: Category[];
  onChange: (draft: BulkClassificationDraft, summary: string | null) => void;
}) => {
  const [mode, setMode] = useState<SortMode>("move");
  const [target, setTarget] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const total = products.length;
  const titleOf = (id: string | null) => collections.find((item) => item.id === id)?.title ?? "—";
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const categoriesIn = (id: string) => categories.filter((category) => collectionOf(category) === id);
  const anyMain = products.some((product) => product.collection_id);

  /* Teď: kolekce → kategorie s počty. */
  const now = new Map<string, { main: number; cats: Map<string, number> }>();
  let nowhere = 0;
  for (const product of products) {
    const owners = new Set<string>();
    if (product.collection_id) {
      owners.add(product.collection_id);
      const entry = now.get(product.collection_id) ?? { main: 0, cats: new Map() };
      entry.main += 1;
      now.set(product.collection_id, entry);
    }
    for (const id of product.category_ids) {
      const owner = categoryById.get(id) ? collectionOf(categoryById.get(id)!) : null;
      if (!owner) continue;
      owners.add(owner);
      const entry = now.get(owner) ?? { main: 0, cats: new Map() };
      entry.cats.set(id, (entry.cats.get(id) ?? 0) + 1);
      now.set(owner, entry);
    }
    if (!owners.size) nowhere += 1;
  }

  const emit = (nextMode: SortMode, nextTarget: string | null, nextChosen: string[]) => {
    const draft = sortDraft(nextMode, nextTarget, nextChosen, products);
    const names = nextChosen.map((id) => categoryById.get(id)?.name).filter(Boolean).join(", ");
    const kam = nextTarget ? `${titleOf(nextTarget)}${names ? ` › ${names}` : ""}` : null;
    onChange(
      draft,
      kam
        ? nextMode === "move"
          ? `Po uložení budou jen v: ${kam}`
          : `Po uložení budou navíc i v: ${kam}`
        : null
    );
  };
  const pickMode = (next: SortMode) => {
    setMode(next);
    /* „Přidat i sem" neumí kolekci bez kategorií, když už mají hlavní. */
    const keep = next === "add" && target && anyMain && categoriesIn(target).length === 0 ? null : target;
    setTarget(keep);
    if (!keep) setChosen([]);
    emit(next, keep, keep ? chosen : []);
  };
  const pickTarget = (id: string) => {
    setTarget(id);
    setChosen([]);
    emit(mode, id, []);
  };
  const toggleCategory = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((other) => other !== id) : [...chosen, id];
    setChosen(next);
    emit(mode, target, next);
  };

  const step = (n: number, title: string) => (
    <Text size="small" weight="plus" className="text-ui-fg-subtle mb-2 flex items-center gap-2 px-1">
      <span className="bg-ui-bg-base-pressed text-ui-fg-base txt-compact-xsmall-plus flex size-5 items-center justify-center rounded-full">
        {n}
      </span>
      {title}
    </Text>
  );

  return (
    <div className="flex flex-col gap-5 px-5 py-4">
      <section>
        {step(1, "Teď jsou")}
        <div className="bg-ui-bg-subtle flex flex-col gap-1.5 rounded-lg px-3 py-2.5">
          {[...now.entries()].map(([id, entry]) => (
            <Text key={id} size="small">
              <span className="font-medium">{titleOf(id)}</span>
              {entry.cats.size ? (
                <span className="text-ui-fg-subtle">
                  {" › "}
                  {[...entry.cats.entries()]
                    .map(([cat, n]) => `${categoryById.get(cat)?.name ?? "?"}${n < total ? ` (${n})` : ""}`)
                    .join(", ")}
                </span>
              ) : (
                <span className="text-ui-fg-muted"> · bez kategorie</span>
              )}
            </Text>
          ))}
          {nowhere > 0 && (
            <Text size="small" className="text-ui-tag-orange-text">
              Nezařazené: {nowhere} — v obchodě je v nabídce nikdo nenajde
            </Text>
          )}
        </div>
      </section>

      <section>
        {step(2, "Co udělat")}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["move", "Přesunout sem", "Budou jen v kolekci a kategoriích, které vyberete."],
              ["add", "Přidat i sem", "Zůstanou, kde jsou, a přibudou i sem."],
            ] as const
          ).map(([key, label, hint]) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => pickMode(key)}
              className={`flex min-h-[64px] flex-col items-start rounded-lg border px-3 py-2 text-left ${
                mode === key
                  ? "border-ui-border-interactive bg-ui-bg-base-pressed"
                  : "border-ui-border-base hover:bg-ui-bg-base-hover"
              }`}
            >
              <Text size="small" weight="plus">
                {label}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {hint}
              </Text>
            </button>
          ))}
        </div>
      </section>

      <section>
        {step(3, "Kam")}
        <div className="bg-ui-bg-base shadow-borders-base divide-y rounded-lg">
          {collections.map((collection) => {
            const own = categoriesIn(collection.id);
            const blocked = mode === "add" && anyMain && own.length === 0;
            const selected = target === collection.id;
            return (
              <div key={collection.id}>
                <button
                  type="button"
                  disabled={blocked}
                  aria-pressed={selected}
                  onClick={() => pickTarget(collection.id)}
                  className={`flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected ? "bg-ui-bg-base-pressed" : "hover:bg-ui-bg-base-hover"
                  }`}
                >
                  <span>
                    <Text size="small" weight={selected ? "plus" : "regular"}>
                      {collection.title}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {blocked
                        ? "Bez kategorií — jde jen přesunout"
                        : own.length
                          ? `${own.length} ${own.length === 1 ? "kategorie" : own.length <= 4 ? "kategorie" : "kategorií"}`
                          : "bez kategorií"}
                    </Text>
                  </span>
                  {selected ? <span className="text-ui-fg-interactive txt-compact-small-plus">✓</span> : null}
                </button>
                {selected && own.length > 0 && (
                  <div className="bg-ui-bg-subtle flex flex-wrap gap-1.5 px-3 pb-3 pt-2">
                    <Text size="xsmall" className="text-ui-fg-subtle w-full">
                      Do kterých kategorií? (můžete víc)
                    </Text>
                    {own.map((category) => {
                      const on = chosen.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleCategory(category.id)}
                          className={`min-h-[32px] rounded-full border px-3 ${
                            on
                              ? "border-ui-border-interactive bg-ui-bg-base text-ui-fg-base"
                              : "border-ui-border-base bg-ui-bg-base text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                          }`}
                        >
                          <Text size="small" weight={on ? "plus" : "regular"}>
                            {on ? "✓ " : ""}
                            {category.name}
                          </Text>
                        </button>
                      );
                    })}
                    {chosen.length === 0 && (
                      <Text size="xsmall" className="text-ui-fg-muted w-full">
                        Bez kategorie budou jen pod „Vše" této kolekce.
                      </Text>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

/** Pro toast po uložení — volající ho ukáže, když uložení projde. */
export const classificationToast = (message?: string) => {
  if (message) toast.success(message);
};
