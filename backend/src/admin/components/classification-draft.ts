/**
 * Čisté funkce zařazení výrobků (bez Reactu — testují se v
 * admin/__tests__/classification-draft.unit.spec.ts). Komponenty jsou
 * v product-classification.tsx.
 */

export type Collection = { id: string; title: string };
export type Category = { id: string; name: string; metadata?: Record<string, unknown> | null };

export const collectionOf = (category: Category): string | null => {
  const value = (category.metadata ?? {})["collection_id"];
  return typeof value === "string" && value ? value : null;
};

export type BulkClassificationDraft = {
  /** Kategorie přidat všem vybraným. */
  add: string[];
  /** Kategorie odebrat všem vybraným. */
  remove: string[];
  /** Hlavní kolekce všem vybraným; `undefined` = beze změny. */
  collection?: string | null;
  /** Kolekce přidané, ale zatím bez kategorie (jen zobrazení). */
  draftRows?: string[];
  /** Hlavní kolekce jen výrobkům, které žádnou nemají („Přidat i sem"). */
  collectionIfMissing?: string;
};

export const emptyBulkClassification = (): BulkClassificationDraft => ({ add: [], remove: [] });

export const bulkClassificationDirty = (draft: BulkClassificationDraft) =>
  draft.add.length > 0 ||
  draft.remove.length > 0 ||
  draft.collection !== undefined ||
  draft.collectionIfMissing !== undefined;

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
  if (!collection && draft.collectionIfMissing) collection = draft.collectionIfMissing;
  if (!collection) {
    /* Bez hlavní kolekce → první kolekce z přidaných kategorií. */
    const first = draft.add.map((id) => categories.find((c) => c.id === id)).find(Boolean);
    collection = first ? collectionOf(first) : null;
  }
  return { collection_id: collection ?? null, category_ids: ids };
};

export type SortMode = "move" | "add";

/**
 * Z voleb přeřazení udělá hromadnou změnu (čistá funkce, testovaná).
 * - Přesunout sem: výrobky budou JEN v cílové kolekci a vybraných
 *   kategoriích (ostatní kategorie pryč, hlavní kolekce = cíl).
 * - Přidat i sem: vybrané kategorie přibudou, nic se nebere; kdo nemá
 *   hlavní kolekci, dostane cílovou.
 */
export const sortDraft = (
  mode: SortMode,
  target: string | null,
  chosen: string[],
  products: { category_ids: string[] }[]
): BulkClassificationDraft => {
  if (!target) return emptyBulkClassification();
  if (mode === "move") {
    const all = [...new Set(products.flatMap((product) => product.category_ids))];
    return {
      collection: target,
      add: chosen,
      remove: all.filter((id) => !chosen.includes(id)),
    };
  }
  return { add: chosen, remove: [], collectionIfMissing: target };
};
