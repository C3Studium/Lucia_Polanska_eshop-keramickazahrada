import { CheckMini, ChevronDownMini, XMarkMini } from "@medusajs/icons";
import { Input, Popover, Text, clx } from "@medusajs/ui";
import { useState } from "react";
import {
  NO_COLLECTION,
  applyCatalogFilter,
  type CatalogFilter,
} from "./catalog-filter";

/**
 * Lišta filtrů Produkty+ — hledání a čtyři rozbalovačky v jednom řádku
 * (17. 11. 2026).
 *
 * ## Proč
 *
 * Matěj: „produkty by mohly mít lepší filtry". Stránka uměla jen kolekci
 * a kategorii; vyprodané nebo skryté kusy, křehké nebo bez dobírky se hledaly
 * očima v dlouhém seznamu. Teď je vlevo hledání a vedle něj Kolekce,
 * Kategorie, Stav a Doprava — jako filtry v tabulce článků ve WordPressu.
 * Co je zapnuté, stojí pod lištou jako štítky s křížkem a jedno „Zrušit
 * filtry" vrátí celý seznam.
 *
 * ## Proč v adrese
 *
 * Stejně jako záložka a kolekce (lib/url-state): odchod na detail a tlačítko
 * Zpět filtr nesmí zahodit. Lišta sama nic neukládá, stav jí dává stránka.
 *
 * ## Jedna volba v každé rozbalovačce
 *
 * Stav i Doprava jsou výběr jedné možnosti, ne zaškrtávání více. „Křehké
 * a zároveň velké" je vzácné a dvě kombinované podmínky se na první pohled
 * špatně čtou; jedna volba na rozbalovačku se čte sama.
 */

/* ------------------------------------------------------------------ */
/* Stav a sklad — jeden zdroj pravdy pro štítek v řádku i pro filtr.   */
/* ------------------------------------------------------------------ */

type StockVariant = {
  available: number | null;
  stock_state: "low" | "out" | "ok" | null;
};

export type StockInfo =
  /** Aspoň jedna varianta počítá kusy a dá se koupit. */
  | { kind: "skladem"; count: number; low: boolean }
  /** Všechny počítané varianty jsou na nule a žádná jiná není. */
  | { kind: "vyprodano" }
  /** Kusy se nepočítají (zakázka, výroba na přání) — koupit jde vždy. */
  | { kind: "na-objednavku" };

/**
 * Sklad kusu tak, jak ho čte prodejna: stačí jedna prodejná varianta.
 * Varianta, která kusy nepočítá (`stock_state` null), se koupit dá vždycky —
 * proto kus s takovou variantou nikdy není „Vyprodáno".
 */
export const stockOf = (variants: StockVariant[]): StockInfo => {
  const tracked = variants.filter((variant) => variant.stock_state !== null);
  const untracked = variants.length - tracked.length;
  const sellable = tracked.filter((variant) => variant.stock_state !== "out");
  if (sellable.length > 0) {
    return {
      kind: "skladem",
      count: sellable.reduce((sum, variant) => sum + Math.max(0, variant.available ?? 0), 0),
      low: sellable.every((variant) => variant.stock_state === "low"),
    };
  }
  if (untracked > 0 || tracked.length === 0) return { kind: "na-objednavku" };
  return { kind: "vyprodano" };
};

type FilterableProduct = {
  status: string;
  archived: boolean;
  variants: StockVariant[];
  fragile: boolean;
  cod_allowed: boolean;
  packaging_price: number | null;
  shipping_class: string;
  collection?: string | null;
  collections?: string[];
  categories?: string[];
  category_collections?: Record<string, string | null>;
};

export type StavFiltr = "v-obchode" | "skryte" | "vyprodane" | "na-objednavku";
export type DopravaFiltr = "krehke" | "velke" | "bez-dobirky" | "bez-balneho";

export const STAV_OPTIONS: { value: StavFiltr; label: string }[] = [
  { value: "v-obchode", label: "V obchodě" },
  { value: "skryte", label: "Skryté" },
  { value: "vyprodane", label: "Vyprodané" },
  { value: "na-objednavku", label: "Bez skladu" },
];

export const DOPRAVA_OPTIONS: { value: DopravaFiltr; label: string }[] = [
  { value: "krehke", label: "Křehké" },
  { value: "velke", label: "Velká zásilka" },
  { value: "bez-dobirky", label: "Bez dobírky" },
  { value: "bez-balneho", label: "Bez balného" },
];

const stavMatches = (product: FilterableProduct, stav: StavFiltr) => {
  switch (stav) {
    case "v-obchode":
      return product.status === "published" && !product.archived;
    case "skryte":
      return product.status !== "published" || product.archived;
    case "vyprodane":
      return stockOf(product.variants).kind === "vyprodano";
    case "na-objednavku":
      return stockOf(product.variants).kind === "na-objednavku";
  }
};

/* Filtruje se podle ULOŽENÝCH hodnot, ne rozpracovaných: jinak by kus
   zmizel ze seznamu uprostřed úpravy, ještě než ji potvrdí. */
const dopravaMatches = (product: FilterableProduct, doprava: DopravaFiltr) => {
  switch (doprava) {
    case "krehke":
      return product.fragile;
    case "velke":
      return product.shipping_class === "velke";
    case "bez-dobirky":
      return !product.cod_allowed;
    case "bez-balneho":
      return !product.packaging_price;
  }
};

export type ProductFilters = {
  catalog: CatalogFilter;
  stav: StavFiltr | null;
  doprava: DopravaFiltr | null;
};

export const applyProductFilters = <T extends FilterableProduct>(
  products: T[],
  filters: ProductFilters
): T[] =>
  applyCatalogFilter(products, filters.catalog).filter(
    (product) =>
      (!filters.stav || stavMatches(product, filters.stav)) &&
      (!filters.doprava || dopravaMatches(product, filters.doprava))
  );

/* ------------------------------------------------------------------ */
/* Rozbalovačka                                                         */
/* ------------------------------------------------------------------ */

/** Hledá se bez ohledu na diakritiku — „ruze" najde „Růže". */
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

type Choice = { key: string; label: string; count: number };

const FilterMenu = ({
  label,
  value,
  choices,
  onPick,
  searchPlaceholder,
}: {
  label: string;
  value: string | null;
  choices: Choice[];
  onPick: (key: string | null) => void;
  /** S hledáním jen dlouhé seznamy (kolekce, kategorie). */
  searchPlaceholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState("");
  const shown = needle.trim()
    ? choices.filter((choice) => fold(choice.label).includes(fold(needle.trim())))
    : choices;
  const active = value !== null;

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
        {/* Zapnutý filtr má obrys a tečku; co přesně je vybrané, říká štítek
            pod lištou — tlačítka tak drží šířku a lišta neskáče. */}
        <button
          type="button"
          aria-label={`Filtr ${label}`}
          className={clx(
            "txt-compact-small focus-visible:shadow-borders-focus flex h-8 shrink-0 items-center gap-1 rounded-md border px-2.5 outline-none transition-fg",
            active
              ? "border-ui-border-interactive bg-ui-bg-base text-ui-fg-base font-medium"
              : "border-ui-border-base bg-ui-bg-base text-ui-fg-subtle hover:bg-ui-bg-base-hover"
          )}
        >
          {active && <span aria-hidden className="bg-ui-fg-interactive size-1.5 rounded-full" />}
          {label}
          <ChevronDownMini className="text-ui-fg-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Content align="start" className="z-50 w-72 p-0">
        {searchPlaceholder && choices.length > 8 && (
          <div className="border-ui-border-base border-b p-2">
            <Input
              type="search"
              size="small"
              autoFocus
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={needle}
              onChange={(event) => setNeedle(event.target.value)}
            />
          </div>
        )}
        <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto p-1">
          {[{ key: null, label: "Vše", count: undefined }, ...shown].map((choice) => {
            const selected = value === choice.key;
            return (
              <button
                key={choice.key ?? "__vse__"}
                type="button"
                aria-pressed={selected}
                onClick={() => pick(choice.key)}
                className={clx(
                  "transition-fg flex min-h-[36px] w-full items-center gap-2 rounded-md px-2 text-left",
                  selected
                    ? "bg-ui-bg-base-pressed text-ui-fg-base"
                    : "text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {selected && <CheckMini />}
                </span>
                <Text size="small" weight={selected ? "plus" : "regular"} className="min-w-0 flex-1 truncate">
                  {choice.label}
                </Text>
                {typeof choice.count === "number" && (
                  <Text size="xsmall" className="text-ui-fg-muted shrink-0">
                    {choice.count}
                  </Text>
                )}
              </button>
            );
          })}
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

/* ------------------------------------------------------------------ */
/* Lišta                                                                */
/* ------------------------------------------------------------------ */

const collectionsOf = (product: FilterableProduct): string[] =>
  product.collections?.length
    ? product.collections
    : product.collection
      ? [product.collection]
      : [];

const sortedChoices = (counts: Map<string, number>): Choice[] =>
  [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "cs"))
    .map(([name, count]) => ({ key: name, label: name, count }));

/** „1 produkt / 3 produkty / 12 produktů". */
export const pocetProduktu = (count: number) =>
  `${count} ${count === 1 ? "produkt" : count >= 2 && count <= 4 ? "produkty" : "produktů"}`;

const FilterChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <span className="bg-ui-bg-component border-ui-border-base txt-compact-small text-ui-fg-base flex h-7 items-center gap-1 rounded-full border pl-2.5 pr-1">
    {label}
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Zrušit filtr ${label}`}
      title="Zrušit tento filtr"
      className="text-ui-fg-muted hover:text-ui-fg-base hover:bg-ui-bg-base-hover flex size-5 items-center justify-center rounded-full outline-none focus-visible:shadow-borders-focus"
    >
      <XMarkMini />
    </button>
  </span>
);

export const ProductFilterToolbar = ({
  products,
  search,
  onSearch,
  filters,
  onChange,
  onClearAll,
  shownCount,
  showStav,
  showDoprava,
  selectAll,
}: {
  /** Řádky záložky PŘED filtrem — volby a počty se berou z nich. */
  products: FilterableProduct[];
  search: string;
  onSearch: (value: string) => void;
  filters: ProductFilters;
  onChange: (next: Partial<ProductFilters>) => void;
  /** Zruší všechny filtry i hledání najednou (jeden zápis do adresy). */
  onClearAll: () => void;
  shownCount: number;
  showStav: boolean;
  showDoprava: boolean;
  /** Zaškrtávátko „vybrat vše" pro pohledy bez hlavičky tabulky. */
  selectAll?: React.ReactNode;
}) => {
  const { catalog, stav, doprava } = filters;

  /* Kolekce: počty přes všechny kolekce kusu (vlastní + kolekce kategorií). */
  const collectionCounts = new Map<string, number>();
  let unassigned = 0;
  for (const product of products) {
    const own = collectionsOf(product);
    if (own.length) {
      for (const name of own) collectionCounts.set(name, (collectionCounts.get(name) ?? 0) + 1);
    } else unassigned += 1;
  }
  const collections = sortedChoices(collectionCounts);
  if (unassigned > 0) collections.push({ key: NO_COLLECTION, label: "Bez kolekce", count: unassigned });

  /* Kategorie jen z vybrané kolekce — první volba zužuje druhou. */
  const inCollection = applyCatalogFilter(products, { collection: catalog.collection, category: null });
  const categoryCounts = new Map<string, number>();
  for (const product of inCollection) {
    for (const category of product.categories ?? []) {
      const belongsTo = product.category_collections?.[category];
      if (
        catalog.collection &&
        catalog.collection !== NO_COLLECTION &&
        belongsTo &&
        belongsTo !== catalog.collection
      ) {
        continue;
      }
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }
  const categories = sortedChoices(categoryCounts);

  /* Počty u Stavu a Dopravy v rámci kolekce a kategorie — kolik jich
     klik opravdu ukáže. */
  const inCatalog = applyCatalogFilter(products, catalog);
  const stavChoices: Choice[] = STAV_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
    count: inCatalog.filter((product) => stavMatches(product, option.value)).length,
  }));
  const dopravaChoices: Choice[] = DOPRAVA_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
    count: inCatalog.filter((product) => dopravaMatches(product, option.value)).length,
  }));

  const collectionLabel =
    catalog.collection === NO_COLLECTION ? "Bez kolekce" : catalog.collection;
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(search
      ? [{ key: "hledat", label: `Hledání: „${search}“`, remove: () => onSearch("") }]
      : []),
    ...(catalog.collection
      ? [
          {
            key: "kolekce",
            label: `Kolekce: ${collectionLabel}`,
            remove: () => onChange({ catalog: { collection: null, category: null } }),
          },
        ]
      : []),
    ...(catalog.category
      ? [
          {
            key: "kategorie",
            label: `Kategorie: ${catalog.category}`,
            remove: () => onChange({ catalog: { ...catalog, category: null } }),
          },
        ]
      : []),
    ...(stav && showStav
      ? [
          {
            key: "stav",
            label: STAV_OPTIONS.find((option) => option.value === stav)?.label ?? stav,
            remove: () => onChange({ stav: null }),
          },
        ]
      : []),
    ...(doprava && showDoprava
      ? [
          {
            key: "doprava",
            label: DOPRAVA_OPTIONS.find((option) => option.value === doprava)?.label ?? doprava,
            remove: () => onChange({ doprava: null }),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-2 px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          size="small"
          type="search"
          placeholder="Hledat název…"
          aria-label="Hledat produkt podle názvu"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="w-full sm:w-64"
        />
        {collections.length > 1 && (
          <FilterMenu
            label="Kolekce"
            value={catalog.collection}
            choices={collections}
            searchPlaceholder="Hledat kolekci…"
            onPick={(collection) => onChange({ catalog: { collection, category: null } })}
          />
        )}
        {categories.length > 0 && (
          <FilterMenu
            label="Kategorie"
            value={catalog.category}
            choices={categories}
            searchPlaceholder="Hledat kategorii…"
            onPick={(category) => onChange({ catalog: { ...catalog, category } })}
          />
        )}
        {showStav && (
          <FilterMenu
            label="Stav"
            value={stav}
            choices={stavChoices}
            onPick={(key) => onChange({ stav: key as StavFiltr | null })}
          />
        )}
        {showDoprava && (
          <FilterMenu
            label="Doprava"
            value={doprava}
            choices={dopravaChoices}
            onPick={(key) => onChange({ doprava: key as DopravaFiltr | null })}
          />
        )}
      </div>

      <div className="flex min-h-[28px] flex-wrap items-center gap-2">
        {selectAll}
        <Text size="small" className="text-ui-fg-subtle">
          {shownCount !== products.length
            ? `${pocetProduktu(shownCount)} z ${products.length}`
            : pocetProduktu(shownCount)}
        </Text>
        {chips.map((chip) => (
          <FilterChip key={chip.key} label={chip.label} onRemove={chip.remove} />
        ))}
        {chips.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="txt-compact-small text-ui-fg-interactive hover:text-ui-fg-interactive-hover rounded-sm px-1 outline-none hover:underline focus-visible:shadow-borders-focus"
          >
            Zrušit filtry
          </button>
        )}
      </div>
    </div>
  );
};
