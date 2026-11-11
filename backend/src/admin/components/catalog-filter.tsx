import { Button, Input, Popover, Text } from "@medusajs/ui";
import { useCallback, useMemo, useState } from "react";
import { useUrlPatch, useUrlState } from "../lib/url-state";

/**
 * Sekundární filtr podle zařazení — kolekce a kategorie (2026-08-16).
 *
 * The kind tabs answer "what sort of thing", this bar answers "where does it
 * live". Volby se odvozují z řádků, které jsou právě na obrazovce, takže se
 * nikdy nenabídne kolekce, kterou tahle záložka neobsahuje, a počty sedí se
 * seznamem pod tím. Filtruje se podle názvů, které řádky už nesou — žádné
 * dotazy navíc.
 *
 * Od 3. 11. 2026 jsou to dvě rozbalovačky s hledáním místo řádků pilulek:
 * kategorií je přes dvacet, takže filtr zabíral tři řádky, na telefonu půl
 * obrazovky, a hledat se v něm muselo očima. Rozbalovačka ukazuje, co je
 * vybrané, a psaním se seznam zúží.
 *
 * Používá to Produkty+, Přehled → Produkty a Balení+; může se přidat každá
 * stránka, jejíž řádky nesou `collection` + `categories`.
 */

export type CatalogFilter = {
  collection: string | null;
  category: string | null;
};

export const EMPTY_CATALOG_FILTER: CatalogFilter = {
  collection: null,
  category: null,
};

/**
 * Vybraná kolekce a kategorie v adrese, ne v paměti komponenty.
 *
 * ## Proč
 *
 * Měřeno v ostré administraci 11. 11. 2026: vybrat kolekci, otevřít kus
 * a vrátit se tlačítkem Zpět znamenalo vybírat znovu. Výběr žil
 * v `useState`, a ten odchodem na detail zanikne. V adrese ho tlačítko Zpět
 * vrátí samo a filtr se dá i poslat odkazem.
 *
 * Je to tentýž postup, jaký „Kolekce a kategorie" dostaly 9. 11., jen
 * povýšený na společnou pomůcku: tenhle filtr mají tři stránky (Produkty+,
 * Přehled → Produkty, Balení+) a tři kopie téhož by se rozešly.
 *
 * ## Proč jedním zápisem
 *
 * Klik na kolekci zahazuje kategorii, takže se mění dva klíče najednou.
 * Dvě volání setteru by si přepsala adresu navzájem (vysvětleno v
 * `lib/url-state`), proto jde obojí jedním `useUrlPatch`.
 */
export const useCatalogFilterUrl = (): [
  CatalogFilter,
  (filtr: CatalogFilter) => void,
] => {
  const [collection] = useUrlState("kolekce");
  const [category] = useUrlState("kategorie");
  const zapis = useUrlPatch();

  const hodnota = useMemo<CatalogFilter>(
    () => ({ collection, category }),
    [collection, category]
  );

  const nastav = useCallback(
    (filtr: CatalogFilter) => {
      zapis({ kolekce: filtr.collection, kategorie: filtr.category });
    },
    [zapis]
  );

  return [hodnota, nastav];
};

/** Sentinel for "pieces with no collection at all". */
export const NO_COLLECTION = "__bez_kolekce__";

type FilterableProduct = {
  collection?: string | null;
  /**
   * VŠECHNY kolekce produktu — vlastní + kolekce jeho kategorií (12. 10. 2026:
   * kategorie může mít z víc kolekcí, Medusa ale jen jednu kolekci). Řádky,
   * které to pole nemají, se řídí `collection`.
   */
  collections?: string[];
  categories?: string[];
  /** Kategorie → kolekce, ke které patří (pod vybranou kolekcí jen její kategorie). */
  category_collections?: Record<string, string | null>;
};

const collectionsOf = (product: FilterableProduct): string[] =>
  product.collections?.length
    ? product.collections
    : product.collection
      ? [product.collection]
      : [];

export const applyCatalogFilter = <T extends FilterableProduct>(
  products: T[],
  filter: CatalogFilter
): T[] =>
  products.filter((product) => {
    if (filter.collection === NO_COLLECTION && collectionsOf(product).length) {
      return false;
    }
    if (
      filter.collection &&
      filter.collection !== NO_COLLECTION &&
      !collectionsOf(product).includes(filter.collection)
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

/** Hledá se bez ohledu na diakritiku a velikost písmen — „ruze" najde „Růže". */
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type Choice = { key: string; label: string; count: number };

const Row = ({
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
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={
      selected
        ? "bg-ui-bg-base-pressed text-ui-fg-base transition-fg flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left"
        : "text-ui-fg-subtle hover:bg-ui-bg-base-hover transition-fg flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left"
    }
  >
    <Text size="small" weight={selected ? "plus" : "regular"} className="truncate">
      {label}
    </Text>
    {typeof count === "number" && (
      <Text size="xsmall" className="text-ui-fg-muted shrink-0">
        {count}
      </Text>
    )}
  </button>
);

/**
 * Jedna rozbalovačka: co je vybrané stojí rovnou na tlačítku, uvnitř je
 * hledání a seznam. Zavřením se hledání zahodí, ať se příště otevře celá.
 */
const ChoiceMenu = ({
  label,
  allLabel,
  searchPlaceholder,
  value,
  choices,
  onPick,
}: {
  label: string;
  allLabel: string;
  searchPlaceholder: string;
  value: string | null;
  choices: Choice[];
  onPick: (key: string | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState("");

  const shown = needle.trim()
    ? choices.filter((choice) => fold(choice.label).includes(fold(needle.trim())))
    : choices;
  const current = choices.find((choice) => choice.key === value);

  const pick = (key: string | null) => {
    onPick(key);
    setOpen(false);
    setNeedle("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setNeedle("");
      }}
    >
      <Popover.Trigger asChild>
        <Button size="small" variant="secondary">
          <span className="text-ui-fg-muted">{label}:</span>{" "}
          {current ? current.label : allLabel} ▾
        </Button>
      </Popover.Trigger>
      <Popover.Content align="start" className="w-72 p-0">
        <div className="border-ui-border-base border-b p-2">
          <Input
            type="search"
            autoFocus
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={needle}
            onChange={(event) => setNeedle(event.target.value)}
          />
        </div>
        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto p-1">
          <Row label={allLabel} selected={value === null} onClick={() => pick(null)} />
          {shown.map((choice) => (
            <Row
              key={choice.key}
              label={choice.label}
              count={choice.count}
              selected={value === choice.key}
              onClick={() => pick(value === choice.key ? null : choice.key)}
            />
          ))}
          {shown.length === 0 && (
            <Text size="xsmall" className="text-ui-fg-muted px-2 py-3">
              Nic takového tu není.
            </Text>
          )}
        </div>
      </Popover.Content>
    </Popover>
  );
};

export const CatalogFilterBar = ({
  products,
  value,
  onChange,
}: {
  /** The tab's rows BEFORE this filter — volby se berou z nich. */
  products: FilterableProduct[];
  value: CatalogFilter;
  onChange: (next: CatalogFilter) => void;
}) => {
  const collectionCounts = new Map<string, number>();
  let unassigned = 0;
  for (const product of products) {
    const own = collectionsOf(product);
    if (own.length) {
      for (const collection of own) {
        collectionCounts.set(collection, (collectionCounts.get(collection) ?? 0) + 1);
      }
    } else {
      unassigned += 1;
    }
  }
  const collections: Choice[] = [...collectionCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "cs"))
    .map(([name, count]) => ({ key: name, label: name, count }));
  if (unassigned > 0) {
    collections.push({
      key: NO_COLLECTION,
      label: "Bez kolekce",
      count: unassigned,
    });
  }

  // Categories offered are those of the pieces matching the collection pick —
  // narrowing the first group narrows the second, never the other way round.
  const inCollection = applyCatalogFilter(products, {
    collection: value.collection,
    category: null,
  });
  const categoryCounts = new Map<string, number>();
  for (const product of inCollection) {
    for (const category of product.categories ?? []) {
      // Pod vybranou kolekcí jen kategorie, které k ní patří — zápich
      // v „Zápichy" i „Drobnosti pro radost" nesmí táhnout cizí kategorii.
      const belongsTo = product.category_collections?.[category];
      if (
        value.collection &&
        value.collection !== NO_COLLECTION &&
        belongsTo &&
        belongsTo !== value.collection
      ) {
        continue;
      }
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }
  const categories: Choice[] = [...categoryCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "cs"))
    .map(([name, count]) => ({ key: name, label: name, count }));

  // One collection and no categories = nothing to narrow; the bar would be
  // two buttons with a single choice each, which is furniture.
  if (collections.length <= 1 && categories.length <= 1) {
    return null;
  }

  const filtered = value.collection !== null || value.category !== null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-3">
      <ChoiceMenu
        label="Kolekce"
        allLabel="Všechny"
        searchPlaceholder="Hledat kolekci…"
        value={value.collection}
        choices={collections}
        onPick={(collection) => onChange({ collection, category: null })}
      />
      {categories.length > 0 && (
        <ChoiceMenu
          label="Kategorie"
          allLabel="Všechny"
          searchPlaceholder="Hledat kategorii…"
          value={value.category}
          choices={categories}
          onPick={(category) => onChange({ ...value, category })}
        />
      )}
      {filtered && (
        <Button
          size="small"
          variant="transparent"
          onClick={() => onChange(EMPTY_CATALOG_FILTER)}
        >
          Zrušit zúžení
        </Button>
      )}
    </div>
  );
};
