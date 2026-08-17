import { Text } from "@medusajs/ui";

/**
 * Sekundární filtr podle zařazení — kolekce a kategorie (2026-08-16).
 *
 * The kind tabs answer "what sort of thing", this bar answers "where does it
 * live". Pills are derived from the rows actually on screen, so the bar never
 * offers a collection the current tab doesn't contain, and counts always
 * match the list below. Filtering is by the names the rows already carry —
 * no extra requests.
 *
 * Used by Produkty+, Přehled → Produkty and Balení+; any page whose rows
 * carry `collection` + `categories` can join.
 */

export type CatalogFilter = {
  collection: string | null;
  category: string | null;
};

export const EMPTY_CATALOG_FILTER: CatalogFilter = {
  collection: null,
  category: null,
};

/** Sentinel for "pieces with no collection at all". */
export const NO_COLLECTION = "__bez_kolekce__";

type FilterableProduct = {
  collection?: string | null;
  categories?: string[];
};

export const applyCatalogFilter = <T extends FilterableProduct>(
  products: T[],
  filter: CatalogFilter
): T[] =>
  products.filter((product) => {
    if (filter.collection === NO_COLLECTION && product.collection) {
      return false;
    }
    if (
      filter.collection &&
      filter.collection !== NO_COLLECTION &&
      product.collection !== filter.collection
    ) {
      return false;
    }
    if (
      filter.category &&
      !(product.categories ?? []).includes(filter.category)
    ) {
      return false;
    }
    return true;
  });

const pillClassName = (selected: boolean) =>
  selected
    ? "border-ui-border-interactive bg-ui-bg-base-pressed text-ui-fg-base transition-fg rounded-full border px-3 py-1"
    : "border-ui-border-base bg-ui-bg-base text-ui-fg-subtle hover:bg-ui-bg-base-hover transition-fg rounded-full border px-3 py-1";

const Pill = ({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
}) => (
  <button type="button" onClick={onClick} className={pillClassName(selected)}>
    <Text size="xsmall" weight={selected ? "plus" : "regular"}>
      {label}
      {typeof count === "number" ? (
        <span className="text-ui-fg-muted"> {count}</span>
      ) : null}
    </Text>
  </button>
);

export const CatalogFilterBar = ({
  products,
  value,
  onChange,
}: {
  /** The tab's rows BEFORE this filter — pills derive from them. */
  products: FilterableProduct[];
  value: CatalogFilter;
  onChange: (next: CatalogFilter) => void;
}) => {
  const collectionCounts = new Map<string, number>();
  let unassigned = 0;
  for (const product of products) {
    if (product.collection) {
      collectionCounts.set(
        product.collection,
        (collectionCounts.get(product.collection) ?? 0) + 1
      );
    } else {
      unassigned += 1;
    }
  }
  const collections = [...collectionCounts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "cs")
  );

  // Categories offered are those of the pieces matching the collection pick —
  // narrowing the first group narrows the second, never the other way round.
  const inCollection = applyCatalogFilter(products, {
    collection: value.collection,
    category: null,
  });
  const categoryCounts = new Map<string, number>();
  for (const product of inCollection) {
    for (const category of product.categories ?? []) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }
  const categories = [...categoryCounts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "cs")
  );

  // One collection and no categories = nothing to narrow; the bar would be
  // a row of single-choice pills, which is furniture.
  if (collections.length <= 1 && !unassigned && categories.length <= 1) {
    return null;
  }

  const pickCollection = (collection: string | null) =>
    onChange({ collection, category: null });

  return (
    <div className="flex flex-col gap-2 px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
          Kolekce
        </Text>
        <Pill
          label="Vše"
          selected={value.collection === null}
          onClick={() => pickCollection(null)}
        />
        {collections.map(([name, count]) => (
          <Pill
            key={name}
            label={name}
            count={count}
            selected={value.collection === name}
            onClick={() =>
              pickCollection(value.collection === name ? null : name)
            }
          />
        ))}
        {unassigned > 0 && (
          <Pill
            label="Bez kolekce"
            count={unassigned}
            selected={value.collection === NO_COLLECTION}
            onClick={() =>
              pickCollection(
                value.collection === NO_COLLECTION ? null : NO_COLLECTION
              )
            }
          />
        )}
      </div>
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Text
            size="xsmall"
            weight="plus"
            className="text-ui-fg-muted uppercase"
          >
            Kategorie
          </Text>
          <Pill
            label="Vše"
            selected={value.category === null}
            onClick={() => onChange({ ...value, category: null })}
          />
          {categories.map(([name, count]) => (
            <Pill
              key={name}
              label={name}
              count={count}
              selected={value.category === name}
              onClick={() =>
                onChange({
                  ...value,
                  category: value.category === name ? null : name,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
