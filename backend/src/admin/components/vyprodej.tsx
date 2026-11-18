import { MagnifyingGlass } from "@medusajs/icons";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Prompt,
  Text,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
import { ceskaChyba } from "../lib/ceska-chyba";
import { sdk } from "../lib/sdk";
import { formatCzk } from "../lib/workbench";
import { ConfirmDialog } from "./confirm-dialog";
import { InspectorRow } from "./product-inspector";
import {
  endOfDay,
  QUICK,
  SALE_STATE,
  salePeriod,
  salePrice,
  startOfDay,
  toInputDate,
  today,
} from "./product-sale";

/**
 * Výprodej v adminu (18. 11. 2026, přání majitele). Backend `lib/vyprodej.ts`.
 *
 * - `VyprodejWizard` — okno ve třech krocích: typ → výrobky (kolekce,
 *   kategorie, vybrané kusy) → sleva a období. Zakládá i upravuje.
 * - `ProductVyprodejRow` — řádek „Výprodej" na detailu výrobku pod Slevou:
 *   ve kterém výprodeji je, nebo „Přidat do výprodeje" (vybrat existující,
 *   nebo založit nový s tímhle výrobkem).
 */

export type VyprodejType = "time" | "stock";

export type VyprodejRowData = {
  id: string;
  title: string;
  status: "active" | "draft";
  state: "off" | "scheduled" | "running" | "ended";
  type: VyprodejType;
  percent: number;
  starts_at: string | null;
  ends_at: string | null;
  collections: { id: string; title: string }[];
  categories: { id: string; name: string }[];
  products: { id: string; title: string; thumbnail: string | null }[];
  excluded_count: number;
  members_count: number;
  members: { id: string; title: string; thumbnail: string | null }[];
  /** Co výprodej přinesl (lib/vyprodej-stats); `null`, když se nepodařilo spočítat. */
  stats: {
    orders: number;
    units: number;
    revenue: number;
    saved: number;
    top: { product_id: string; title: string; units: number }[];
  } | null;
};

export const VYPRODEJ_TYPE: Record<VyprodejType, { label: string; hint: string }> = {
  time: { label: "Na čas", hint: "Platí od–do, pak se ceny vrátí." },
  stock: {
    label: "Do vyprodání zásob",
    hint: "Jen kusy skladem. Prodaný kus ze slevy vypadne, po vyprodání výprodej skončí.",
  },
};

export const vyprodejScope = (row: Pick<VyprodejRowData, "collections" | "categories" | "products">) =>
  [
    ...row.collections.map((item) => `kolekce ${item.title}`),
    ...row.categories.map((item) => `kategorie ${item.name}`),
    ...(row.products.length
      ? [row.products.length === 1 ? row.products[0].title : `${row.products.length} vybraných výrobků`]
      : []),
  ].join(" · ");

const pocet = (n: number) => (n === 1 ? "1 výrobek" : n >= 2 && n <= 4 ? `${n} výrobky` : `${n} výrobků`);

export const useVyprodeje = () =>
  useQuery<{ vyprodeje: VyprodejRowData[]; orders_scanned?: number }>({
    queryKey: ["vyprodeje"],
    queryFn: () => sdk.client.fetch("/admin/workbench/vyprodeje"),
  });

export type ProductVyprodejInfo = {
  vyprodej: {
    id: string;
    title: string;
    state: VyprodejRowData["state"];
    status: "active" | "draft";
    type: VyprodejType;
    percent: number;
    starts_at: string | null;
    ends_at: string | null;
    via: "product" | "category" | "collection" | null;
    /** Výprodej jen tohoto výrobku (řádek „Výprodej tohoto produktu"). */
    single?: boolean;
  } | null;
  blocked: string | null;
};

export const productVyprodejKey = (productId: string) => ["product-vyprodej", productId];

export const useProductVyprodej = (productId: string) =>
  useQuery<ProductVyprodejInfo>({
    queryKey: productVyprodejKey(productId),
    queryFn: () => sdk.client.fetch(`/admin/workbench/products/${productId}/vyprodej`),
  });

/** Po každém zápisu výprodeje: seznamy, řádky výrobků i jejich slevy. */
const useInvalidateVyprodej = () => {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vyprodeje"] }),
      queryClient.invalidateQueries({ queryKey: ["product-vyprodej"] }),
      queryClient.invalidateQueries({ queryKey: ["product-sale"] }),
      queryClient.invalidateQueries({ queryKey: ["product-sales"] }),
    ]);
  };
};

export const useVyprodejWrites = () => {
  const invalidate = useInvalidateVyprodej();
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      sdk.client.fetch(`/admin/workbench/vyprodeje/${id}`, { method: "POST", body }),
    onSuccess: invalidate,
    onError: (error) => toast.error(ceskaChyba(error, "Výprodej se nepodařilo uložit.")),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/workbench/vyprodeje/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Výprodej smazán — ceny jsou zpátky.");
    },
    onError: (error) => toast.error(ceskaChyba(error, "Výprodej se nepodařilo smazat.")),
  });
  return { update, remove };
};

/* ———————————————————— Průvodce ———————————————————— */

type Collection = { id: string; title: string };
type Category = {
  id: string;
  name: string;
  parent_category_id?: string | null;
  metadata?: Record<string, unknown> | null;
};
type ProductLite = { id: string; title: string; thumbnail: string | null };

const STEPS = ["Typ", "Výrobky", "Sleva"] as const;
type ScopeTab = "collections" | "categories" | "products";

const SelectList = <T extends { id: string }>({
  items,
  selected,
  onToggle,
  render,
  search,
  empty,
}: {
  items: T[];
  selected: string[];
  onToggle: (id: string) => void;
  render: (item: T) => React.ReactNode;
  search: (item: T) => string;
  empty: string;
}) => {
  const [q, setQ] = useState("");
  const needle = q.trim().toLocaleLowerCase("cs");
  const shown = needle
    ? items.filter((item) => search(item).toLocaleLowerCase("cs").includes(needle))
    : items;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <MagnifyingGlass className="text-ui-fg-muted pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2" />
        <Input
          size="small"
          value={q}
          placeholder="Hledat…"
          className="pl-8"
          onChange={(event) => setQ(event.target.value)}
        />
      </div>
      <div className="shadow-borders-base max-h-64 overflow-y-auto rounded-lg">
        {shown.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle px-3 py-3">
            {empty}
          </Text>
        ) : (
          shown.map((item) => (
            <label
              key={item.id}
              className="hover:bg-ui-bg-base-hover flex min-h-[44px] cursor-pointer items-center gap-3 border-b px-3 py-1.5 last:border-b-0"
            >
              <Checkbox
                checked={selected.includes(item.id)}
                onCheckedChange={() => onToggle(item.id)}
              />
              <div className="min-w-0 flex-1">{render(item)}</div>
            </label>
          ))
        )}
      </div>
    </div>
  );
};

export const VyprodejWizard = ({
  open,
  onOpenChange,
  editing = null,
  initialProductIds = [],
  onSaved,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Úprava existujícího výprodeje; jinak se zakládá nový. */
  editing?: VyprodejRowData | null;
  /** Nový výprodej rovnou s těmito výrobky (z detailu výrobku). */
  initialProductIds?: string[];
  onSaved?: () => void;
}) => {
  const ids = useId();
  const invalidate = useInvalidateVyprodej();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<VyprodejType>("time");
  const [tab, setTab] = useState<ScopeTab>("collections");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [percent, setPercent] = useState("20");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState("");

  /* Při otevření převzít výprodej (úprava) nebo začít načisto. */
  useEffect(() => {
    if (!open) return;
    setStep(editing ? 1 : 0);
    setType(editing?.type ?? "time");
    setCollectionIds(editing?.collections.map((item) => item.id) ?? []);
    setCategoryIds(editing?.categories.map((item) => item.id) ?? []);
    setProductIds(editing?.products.map((item) => item.id) ?? initialProductIds);
    setTab(editing ? (editing.collections.length ? "collections" : editing.categories.length ? "categories" : "products") : initialProductIds.length ? "products" : "collections");
    setTitle(editing?.title ?? "");
    setPercent(String(editing?.percent ?? 20));
    setFrom(editing ? toInputDate(editing.starts_at) : today());
    setTo(editing ? toInputDate(editing.ends_at) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const collections = useQuery<{ collections: Collection[] }>({
    queryKey: ["vyprodej-collections"],
    queryFn: () => sdk.client.fetch("/admin/collections?limit=200&fields=id,title"),
    enabled: open,
  });
  const categories = useQuery<{ product_categories: Category[] }>({
    queryKey: ["vyprodej-categories"],
    queryFn: () =>
      sdk.client.fetch("/admin/product-categories?limit=500&fields=id,name,parent_category_id,metadata"),
    enabled: open,
  });
  const products = useQuery<{ products: ProductLite[] }>({
    queryKey: ["vyprodej-products"],
    queryFn: () =>
      sdk.client.fetch("/admin/products?limit=1000&fields=id,title,thumbnail&status[]=published&order=title"),
    enabled: open,
  });

  const collectionTitle = useMemo(
    () => new Map((collections.data?.collections ?? []).map((item) => [item.id, item.title])),
    [collections.data]
  );

  /* Živý náhled: kolik výrobků výprodej vezme. */
  const scopeKey = JSON.stringify([type, collectionIds, categoryIds, productIds]);
  const preview = useQuery<{
    count: number;
    products: ProductLite[];
    skipped: { nelze: number; jinyVyprodej: number; vyprodano: number };
  }>({
    queryKey: ["vyprodej-preview", scopeKey, editing?.id ?? null],
    queryFn: () =>
      sdk.client.fetch("/admin/workbench/vyprodej-preview", {
        method: "POST",
        body: {
          type,
          collection_ids: collectionIds,
          category_ids: categoryIds,
          product_ids: productIds,
          ...(editing ? { ignore_id: editing.id } : {}),
        },
      }),
    enabled: open && step >= 1 && collectionIds.length + categoryIds.length + productIds.length > 0,
  });

  const value = Number(percent);
  const percentOk = Number.isInteger(value) && value >= 1 && value <= 90;
  const datesOk = type === "stock" || !from || !to || from <= to;
  const scopeOk = collectionIds.length + categoryIds.length + productIds.length > 0;
  const defaultTitle = () => {
    const first =
      (collectionIds[0] && collectionTitle.get(collectionIds[0])) ||
      (categoryIds[0] && (categories.data?.product_categories ?? []).find((item) => item.id === categoryIds[0])?.name) ||
      /* Výprodej jednoho výrobku (z jeho detailu) se jmenuje po něm. */
      (productIds.length === 1 &&
        (products.data?.products ?? []).find((item) => item.id === productIds[0])?.title) ||
      "";
    return first ? `Výprodej — ${first}` : "Výprodej";
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: title.trim() || defaultTitle(),
        type,
        percent: value,
        starts_at: type === "stock" ? null : startOfDay(from),
        ends_at: type === "stock" ? null : endOfDay(to),
        collection_ids: collectionIds,
        category_ids: categoryIds,
        product_ids: productIds,
      };
      return editing
        ? sdk.client.fetch(`/admin/workbench/vyprodeje/${editing.id}`, { method: "POST", body })
        : sdk.client.fetch("/admin/workbench/vyprodeje", { method: "POST", body });
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(editing ? "Výprodej uložen." : `Výprodej spuštěn — ${pocet(preview.data?.count ?? 0)} −${value} %.`);
      onOpenChange(false);
      onSaved?.();
    },
    onError: (error) => toast.error(ceskaChyba(error, "Výprodej se nepodařilo uložit.")),
  });

  const toggle = (list: string[], set: (next: string[]) => void) => (id: string) =>
    set(list.includes(id) ? list.filter((other) => other !== id) : [...list, id]);

  const canNext = step === 0 ? true : step === 1 ? scopeOk : percentOk && datesOk;

  /* Kategorie seskupené podle kolekce (vazba z Kolekcí a kategorií). */
  const categoryItems = useMemo(() => {
    const list = categories.data?.product_categories ?? [];
    return [...list].sort((a, b) => {
      const ca = collectionTitle.get(String(a.metadata?.collection_id ?? "")) ?? "~";
      const cb = collectionTitle.get(String(b.metadata?.collection_id ?? "")) ?? "~";
      return ca.localeCompare(cb, "cs") || a.name.localeCompare(b.name, "cs");
    });
  }, [categories.data, collectionTitle]);

  return (
    <Prompt variant="confirmation" open={open} onOpenChange={onOpenChange}>
      <Prompt.Content className="w-[calc(100%-2rem)] max-w-[560px]">
        <Prompt.Header>
          <Prompt.Title>{editing ? `Upravit výprodej` : "Nový výprodej"}</Prompt.Title>
          <Prompt.Description>
            {/* Kroky — kde jsem a kam se dá vrátit. */}
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              {STEPS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  disabled={index > step}
                  onClick={() => setStep(index)}
                  className={`rounded-full px-2.5 py-0.5 ${
                    index === step
                      ? "bg-ui-bg-base-pressed text-ui-fg-base"
                      : index < step
                        ? "text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                        : "text-ui-fg-muted"
                  }`}
                >
                  {index + 1}. {label}
                </button>
              ))}
            </span>
          </Prompt.Description>
        </Prompt.Header>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-4">
          {step === 0 && (
            <div className="flex flex-col gap-2">
              {(Object.keys(VYPRODEJ_TYPE) as VyprodejType[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={type === key}
                  onClick={() => setType(key)}
                  className={`flex min-h-[64px] flex-col items-start rounded-lg border px-4 py-3 text-left ${
                    type === key
                      ? "border-ui-border-interactive bg-ui-bg-base-pressed"
                      : "border-ui-border-base hover:bg-ui-bg-base-hover"
                  }`}
                >
                  <Text size="small" weight="plus">
                    {VYPRODEJ_TYPE[key].label}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {VYPRODEJ_TYPE[key].hint}
                  </Text>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <>
              <div className="bg-ui-bg-subtle flex rounded-lg p-0.5">
                {(
                  [
                    ["collections", "Kolekce", collectionIds.length],
                    ["categories", "Kategorie", categoryIds.length],
                    ["products", "Výrobky", productIds.length],
                  ] as const
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`min-h-[36px] flex-1 rounded-md px-2 ${
                      tab === key ? "bg-ui-bg-base shadow-borders-base" : "text-ui-fg-subtle"
                    }`}
                  >
                    <Text size="small" weight={tab === key ? "plus" : "regular"}>
                      {label}
                      {count ? ` (${count})` : ""}
                    </Text>
                  </button>
                ))}
              </div>
              {tab === "collections" && (
                <SelectList
                  items={collections.data?.collections ?? []}
                  selected={collectionIds}
                  onToggle={toggle(collectionIds, setCollectionIds)}
                  search={(item) => item.title}
                  empty="Žádná kolekce."
                  render={(item) => (
                    <Text size="small">
                      {item.title}{" "}
                      <span className="text-ui-fg-muted">— celá kolekce i její kategorie</span>
                    </Text>
                  )}
                />
              )}
              {tab === "categories" && (
                <SelectList
                  items={categoryItems}
                  selected={categoryIds}
                  onToggle={toggle(categoryIds, setCategoryIds)}
                  search={(item) => `${item.name} ${collectionTitle.get(String(item.metadata?.collection_id ?? "")) ?? ""}`}
                  empty="Žádná kategorie."
                  render={(item) => (
                    <Text size="small">
                      {item.name}
                      {item.metadata?.collection_id ? (
                        <span className="text-ui-fg-muted">
                          {" "}
                          · {collectionTitle.get(String(item.metadata.collection_id)) ?? ""}
                        </span>
                      ) : null}
                    </Text>
                  )}
                />
              )}
              {tab === "products" && (
                <SelectList
                  items={products.data?.products ?? []}
                  selected={productIds}
                  onToggle={toggle(productIds, setProductIds)}
                  search={(item) => item.title}
                  empty="Žádný výrobek."
                  render={(item) => (
                    <span className="flex items-center gap-2">
                      <span className="bg-ui-bg-subtle size-8 shrink-0 overflow-hidden rounded">
                        {item.thumbnail && <img src={item.thumbnail} alt="" className="size-full object-cover" />}
                      </span>
                      <Text size="small" className="truncate">
                        {item.title}
                      </Text>
                    </span>
                  )}
                />
              )}
              <VyprodejPreviewLine scopeOk={scopeOk} preview={preview} type={type} />
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${ids}-title`} size="small" weight="plus">
                  Název
                </Label>
                <Input
                  id={`${ids}-title`}
                  value={title}
                  placeholder={defaultTitle()}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${ids}-pct`} size="small" weight="plus">
                  Sleva
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-28">
                    <Input
                      id={`${ids}-pct`}
                      type="number"
                      min={1}
                      max={90}
                      inputMode="numeric"
                      value={percent}
                      className="pr-8 tabular-nums"
                      onChange={(event) => setPercent(event.target.value)}
                    />
                    <span className="text-ui-fg-muted txt-compact-small pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      %
                    </span>
                  </div>
                  {QUICK.map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      aria-pressed={value === quick}
                      onClick={() => setPercent(String(quick))}
                      className={`min-h-[36px] rounded-full border px-3 ${
                        value === quick
                          ? "border-ui-border-interactive bg-ui-bg-base-pressed"
                          : "border-ui-border-base hover:bg-ui-bg-base-hover"
                      }`}
                    >
                      <Text size="small">{quick} %</Text>
                    </button>
                  ))}
                </div>
                {!percentOk && (
                  <Text size="xsmall" className="text-ui-fg-error">
                    Zadejte celé číslo od 1 do 90.
                  </Text>
                )}
              </div>
              {type === "time" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`${ids}-from`} size="small" weight="plus">
                        Od
                      </Label>
                      <Input id={`${ids}-from`} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`${ids}-to`} size="small" weight="plus">
                        Do
                      </Label>
                      <Input
                        id={`${ids}-to`}
                        type="date"
                        value={to}
                        min={from || undefined}
                        onChange={(event) => setTo(event.target.value)}
                      />
                    </div>
                  </div>
                  <Text size="xsmall" className={datesOk ? "text-ui-fg-subtle -mt-2" : "text-ui-fg-error -mt-2"}>
                    {datesOk
                      ? "Prázdné „Do“ = výprodej běží, dokud ho nevypnete. Poslední den platí celý."
                      : "Konec výprodeje musí být po jeho začátku."}
                  </Text>
                </>
              ) : (
                <Text size="small" className="text-ui-fg-subtle">
                  Začne hned a skončí sám, až se poslední kus prodá.
                </Text>
              )}
              <div className="bg-ui-bg-subtle rounded-lg px-3 py-2.5">
                <Text size="small" weight="plus">
                  {pocet(preview.data?.count ?? 0)} −{percentOk ? value : "?"} % · {VYPRODEJ_TYPE[type].label.toLowerCase()}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
                  Výprodej ruší vlastní slevu výrobků a slevové kódy na ně neplatí.
                </Text>
              </div>
            </>
          )}
        </div>

        <Prompt.Footer className="flex-wrap">
          {step > 0 && !(editing && step === 1) ? (
            <Button size="small" variant="secondary" className="mr-auto" onClick={() => setStep(step - 1)}>
              Zpět
            </Button>
          ) : null}
          <Prompt.Cancel>Zrušit</Prompt.Cancel>
          {step < 2 ? (
            <Button size="small" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Další
            </Button>
          ) : (
            <Button size="small" disabled={!canNext || !scopeOk} isLoading={save.isPending} onClick={() => save.mutate()}>
              {editing ? "Uložit" : "Spustit výprodej"}
            </Button>
          )}
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

const VyprodejPreviewLine = ({
  scopeOk,
  preview,
  type,
}: {
  scopeOk: boolean;
  preview: UseQueryResult<any>;
  type: VyprodejType;
}) => {
  if (!scopeOk) {
    return (
      <Text size="xsmall" className="text-ui-fg-subtle">
        Vyberte kolekci, kategorii nebo jednotlivé výrobky — klidně kombinaci.
      </Text>
    );
  }
  if (preview.isLoading) {
    return (
      <Text size="xsmall" className="text-ui-fg-subtle">
        Počítám výrobky…
      </Text>
    );
  }
  const data = preview.data;
  if (!data) return null;
  const notes = [
    data.skipped.nelze ? `${data.skipped.nelze} nejde zlevnit (poukaz, poškozený kus, zakázka…)` : "",
    data.skipped.jinyVyprodej ? `${data.skipped.jinyVyprodej} už je v jiném výprodeji` : "",
    type === "stock" && data.skipped.vyprodano ? `${data.skipped.vyprodano} není skladem` : "",
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-1">
      <Text size="small" weight="plus">
        Výprodej vezme {pocet(data.count)}
      </Text>
      {data.products.length > 0 && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {data.products.map((product: ProductLite) => product.title).join(", ")}
          {data.count > data.products.length ? " …" : ""}
        </Text>
      )}
      {notes.length > 0 && (
        <Text size="xsmall" className="text-ui-fg-muted">
          Mimo: {notes.join(" · ")}.
        </Text>
      )}
    </div>
  );
};

/* ———————————————————— Výrobek ———————————————————— */

const VIA: Record<"product" | "category" | "collection", string> = {
  product: "přidaný ručně",
  category: "přes kategorii",
  collection: "přes kolekci",
};

/** Okno „Přidat do výprodeje": vybrat běžící/naplánovaný, nebo založit nový. */
const VyprodejPicker = ({
  productId,
  productTitle,
  open,
  onOpenChange,
  onCreateNew,
}: {
  productId: string;
  productTitle: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreateNew: () => void;
}) => {
  const list = useVyprodeje();
  const { update } = useVyprodejWrites();
  const [chosen, setChosen] = useState<string | null>(null);
  const usable = (list.data?.vyprodeje ?? []).filter(
    (item) => item.state === "running" || item.state === "scheduled" || item.state === "off"
  );
  useEffect(() => {
    if (open) setChosen(null);
  }, [open]);

  return (
    <Prompt variant="confirmation" open={open} onOpenChange={onOpenChange}>
      <Prompt.Content className="w-[calc(100%-2rem)] max-w-[480px]">
        <Prompt.Header>
          <Prompt.Title>Přidat do výprodeje</Prompt.Title>
          <Prompt.Description>{productTitle}</Prompt.Description>
        </Prompt.Header>
        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto px-6 py-4">
          {list.isLoading ? (
            <Text size="small" className="text-ui-fg-subtle">
              Načítám výprodeje…
            </Text>
          ) : usable.length === 0 ? (
            <Text size="small" className="text-ui-fg-subtle">
              Žádný výprodej zatím neběží — založte nový.
            </Text>
          ) : (
            usable.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={chosen === item.id}
                onClick={() => setChosen(item.id)}
                className={`flex min-h-[56px] items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left ${
                  chosen === item.id
                    ? "border-ui-border-interactive bg-ui-bg-base-pressed"
                    : "border-ui-border-base hover:bg-ui-bg-base-hover"
                }`}
              >
                <span className="min-w-0">
                  <Text size="small" weight="plus" className="truncate">
                    {item.title} · −{item.percent} %
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle truncate">
                    {VYPRODEJ_TYPE[item.type].label} · {pocet(item.members_count)}
                    {item.type === "time" ? ` · ${salePeriod(item)}` : ""}
                  </Text>
                </span>
                <Badge size="2xsmall" color={SALE_STATE[item.state].color}>
                  {item.state === "running" ? "Běží" : SALE_STATE[item.state].label}
                </Badge>
              </button>
            ))
          )}
        </div>
        <Prompt.Footer className="flex-wrap">
          <Button
            size="small"
            variant="secondary"
            className="mr-auto"
            onClick={() => {
              onOpenChange(false);
              onCreateNew();
            }}
          >
            Nový výprodej
          </Button>
          <Prompt.Cancel>Zrušit</Prompt.Cancel>
          <Button
            size="small"
            disabled={!chosen}
            isLoading={update.isPending}
            onClick={() =>
              chosen &&
              update.mutate(
                { id: chosen, body: { add_product_ids: [productId] } },
                {
                  onSuccess: () => {
                    toast.success("Výrobek přidán do výprodeje.");
                    onOpenChange(false);
                  },
                }
              )
            }
          >
            Přidat
          </Button>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

/**
 * Okno „Výprodej tohoto produktu" (18. 11. 2026, Matěj) — jako okno slevy,
 * navíc volba na čas / do vyprodání zásob. Zakládá výprodej s jediným
 * výrobkem; u existujícího ho upraví nebo smaže.
 */
const OwnVyprodejDialog = ({
  productId,
  productTitle,
  price,
  existing,
  open,
  onOpenChange,
}: {
  productId: string;
  productTitle: string;
  price: number | null;
  existing: NonNullable<ProductVyprodejInfo["vyprodej"]> | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) => {
  const ids = useId();
  const invalidate = useInvalidateVyprodej();
  const { remove } = useVyprodejWrites();
  const [type, setType] = useState<VyprodejType>("stock");
  const [percent, setPercent] = useState("20");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!open) return;
    setType(existing?.type ?? "stock");
    setPercent(String(existing?.percent ?? 20));
    setFrom(existing ? toInputDate(existing.starts_at) : today());
    setTo(existing ? toInputDate(existing.ends_at) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const value = Number(percent);
  const percentOk = Number.isInteger(value) && value >= 1 && value <= 90;
  const datesOk = type === "stock" || !from || !to || from <= to;

  const save = useMutation({
    mutationFn: () => {
      const body = {
        type,
        percent: value,
        starts_at: type === "stock" ? null : startOfDay(from),
        ends_at: type === "stock" ? null : endOfDay(to),
      };
      return existing
        ? sdk.client.fetch(`/admin/workbench/vyprodeje/${existing.id}`, { method: "POST", body })
        : sdk.client.fetch("/admin/workbench/vyprodeje", {
            method: "POST",
            body: { ...body, title: `Výprodej — ${productTitle}`, product_ids: [productId] },
          });
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(
        existing
          ? "Výprodej uložen."
          : type === "stock"
            ? `Výprodej −${value} % do vyprodání zásob.`
            : `Výprodej −${value} % nastavený.`
      );
      onOpenChange(false);
    },
    onError: (error) => toast.error(ceskaChyba(error, "Výprodej se nepodařilo uložit.")),
  });

  return (
    <Prompt variant="confirmation" open={open} onOpenChange={onOpenChange}>
      <Prompt.Content className="w-[calc(100%-2rem)]">
        <Prompt.Header>
          <Prompt.Title>{existing ? "Upravit výprodej" : "Výprodej tohoto produktu"}</Prompt.Title>
          <Prompt.Description>{productTitle}</Prompt.Description>
        </Prompt.Header>

        <div className="flex flex-col gap-4 px-6 py-4">
          <div className="flex flex-col gap-2">
            <Text size="small" weight="plus">
              Jak dlouho
            </Text>
            <div className="grid grid-cols-2 gap-2">
              {(["stock", "time"] as VyprodejType[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={type === key}
                  onClick={() => setType(key)}
                  className={`flex min-h-[56px] flex-col items-start rounded-lg border px-3 py-2 text-left ${
                    type === key
                      ? "border-ui-border-interactive bg-ui-bg-base-pressed"
                      : "border-ui-border-base hover:bg-ui-bg-base-hover"
                  }`}
                >
                  <Text size="small" weight="plus">
                    {VYPRODEJ_TYPE[key].label}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {key === "stock" ? "Skončí, až se kusy prodají." : "Od–do, pak plná cena."}
                  </Text>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-pct`} size="small" weight="plus">
              Sleva
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-28">
                <Input
                  id={`${ids}-pct`}
                  type="number"
                  min={1}
                  max={90}
                  inputMode="numeric"
                  value={percent}
                  className="pr-8 tabular-nums"
                  onChange={(event) => setPercent(event.target.value)}
                />
                <span className="text-ui-fg-muted txt-compact-small pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  %
                </span>
              </div>
              {QUICK.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  aria-pressed={value === quick}
                  onClick={() => setPercent(String(quick))}
                  className={`min-h-[36px] rounded-full border px-3 ${
                    value === quick
                      ? "border-ui-border-interactive bg-ui-bg-base-pressed"
                      : "border-ui-border-base hover:bg-ui-bg-base-hover"
                  }`}
                >
                  <Text size="small">{quick} %</Text>
                </button>
              ))}
            </div>
            {!percentOk && (
              <Text size="xsmall" className="text-ui-fg-error">
                Zadejte celé číslo od 1 do 90.
              </Text>
            )}
          </div>

          {type === "time" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${ids}-from`} size="small" weight="plus">
                    Od
                  </Label>
                  <Input id={`${ids}-from`} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${ids}-to`} size="small" weight="plus">
                    Do
                  </Label>
                  <Input
                    id={`${ids}-to`}
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </div>
              </div>
              <Text size="xsmall" className={datesOk ? "text-ui-fg-subtle -mt-2" : "text-ui-fg-error -mt-2"}>
                {datesOk
                  ? "Prázdné „Do“ = platí, dokud ho nevypnete. Poslední den platí celý."
                  : "Konec musí být po začátku."}
              </Text>
            </>
          )}

          {price !== null && percentOk && (
            <div className="bg-ui-bg-subtle flex flex-wrap items-baseline gap-2 rounded-lg px-3 py-2.5">
              <Text size="small" className="text-ui-fg-muted line-through">
                {formatCzk(price)}
              </Text>
              <Text size="large" weight="plus">
                {formatCzk(salePrice(price, value))}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                − {value} % · ruší vlastní slevu, slevové kódy na něj neplatí
              </Text>
            </div>
          )}
        </div>

        <Prompt.Footer className="flex-wrap">
          {existing && (
            <Button
              size="small"
              variant="transparent"
              className="text-ui-fg-error hover:text-ui-fg-error mr-auto"
              isLoading={remove.isPending}
              onClick={() => remove.mutate(existing.id, { onSuccess: () => onOpenChange(false) })}
            >
              Smazat výprodej
            </Button>
          )}
          <Prompt.Cancel>Zrušit</Prompt.Cancel>
          <Button size="small" disabled={!percentOk || !datesOk} isLoading={save.isPending} onClick={() => save.mutate()}>
            {existing ? "Uložit" : "Spustit výprodej"}
          </Button>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

/** Řádek „Výprodej tohoto produktu" — mezi Slevou a Výprodejem. */
export const ProductOwnVyprodejRow = ({
  productId,
  productTitle,
  price,
}: {
  productId: string;
  productTitle: string;
  price: number | null;
}) => {
  const info = useProductVyprodej(productId);
  const [open, setOpen] = useState(false);
  const current = info.data?.vyprodej ?? null;
  const blocked = info.data?.blocked ?? null;
  const own = current?.single ? current : null;

  const dialog = (
    <OwnVyprodejDialog
      productId={productId}
      productTitle={productTitle}
      price={price}
      existing={own}
      open={open}
      onOpenChange={setOpen}
    />
  );

  if (!own) {
    const hint = blocked
      ? blocked
      : current
        ? `Je ve výprodeji „${current.title}“ (níž) — vlastní až po vyřazení z něj.`
        : "Jen tento kus — na čas, nebo do vyprodání zásob.";
    return (
      <>
        <InspectorRow
          id="produkt-vyprodej-vlastni"
          label="Výprodej tohoto produktu"
          hint={hint}
          control={
            blocked || current ? undefined : (
              <Button size="small" variant="secondary" disabled={info.isLoading || price === null} onClick={() => setOpen(true)}>
                Nastavit výprodej
              </Button>
            )
          }
        />
        {dialog}
      </>
    );
  }

  const state = SALE_STATE[own.state];
  return (
    <>
      <InspectorRow
        id="produkt-vyprodej-vlastni"
        label={`Výprodej tohoto produktu −${own.percent} %`}
        hint={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
            <Badge size="2xsmall" color={state.color}>
              {state.label}
            </Badge>
            {price !== null && (
              <span>
                <span className="line-through">{formatCzk(price)}</span>{" "}
                <span className="text-ui-fg-base font-medium">{formatCzk(salePrice(price, own.percent))}</span>
              </span>
            )}
            <span>
              {own.type === "stock" ? "do vyprodání zásob" : salePeriod(own)}
            </span>
          </span>
        }
        control={
          <Button size="small" variant="secondary" onClick={() => setOpen(true)}>
            Upravit
          </Button>
        }
      />
      {dialog}
    </>
  );
};

/** Řádek „Výprodej" pod Slevou na detailu výrobku. */
export const ProductVyprodejRow = ({
  productId,
  productTitle,
  price,
}: {
  productId: string;
  productTitle: string;
  price: number | null;
}) => {
  const info = useProductVyprodej(productId);
  const list = useVyprodeje();
  const { update, remove } = useVyprodejWrites();
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [wizard, setWizard] = useState<{ editing: VyprodejRowData | null } | null>(null);

  const current = info.data?.vyprodej ?? null;
  const blocked = info.data?.blocked ?? null;

  const dialogs = (
    <>
      <VyprodejPicker
        productId={productId}
        productTitle={productTitle}
        open={picking}
        onOpenChange={setPicking}
        onCreateNew={() => setWizard({ editing: null })}
      />
      <VyprodejWizard
        open={wizard !== null}
        onOpenChange={(next) => !next && setWizard(null)}
        editing={wizard?.editing ?? null}
        initialProductIds={[productId]}
      />
    </>
  );

  if (!current) {
    return (
      <>
        <InspectorRow
          id="produkt-vyprodej"
          label="Výprodej"
          hint={blocked ?? "Není v žádném výprodeji."}
          control={
            blocked ? undefined : (
              <Button size="small" variant="secondary" disabled={info.isLoading} onClick={() => setPicking(true)}>
                Přidat do výprodeje
              </Button>
            )
          }
        />
        {dialogs}
      </>
    );
  }

  /* Vlastní výprodej výrobku řídí řádek nad tímhle (ProductOwnVyprodejRow). */
  if (current.single) {
    return (
      <>
        <InspectorRow
          id="produkt-vyprodej"
          label="Výprodej"
          hint="Má vlastní výprodej (výš). Do výprodeje kolekce nebo kategorie půjde, až ten vlastní smažete."
        />
        {dialogs}
      </>
    );
  }

  const state = SALE_STATE[current.state];
  const row = (list.data?.vyprodeje ?? []).find((item) => item.id === current.id) ?? null;

  return (
    <>
      <InspectorRow
        id="produkt-vyprodej"
        label={`Výprodej −${current.percent} %`}
        hint={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
            <Badge size="2xsmall" color={state.color}>
              {state.label}
            </Badge>
            <span className="text-ui-fg-base font-medium">{current.title}</span>
            {price !== null && (
              <span>
                <span className="line-through">{formatCzk(price)}</span>{" "}
                <span className="text-ui-fg-base font-medium">{formatCzk(salePrice(price, current.percent))}</span>
              </span>
            )}
            <span>
              {VYPRODEJ_TYPE[current.type].label.toLowerCase()}
              {current.type === "time" ? `, ${salePeriod(current)}` : ""}
              {current.via ? ` · ${VIA[current.via]}` : ""}
            </span>
          </span>
        }
        control={
          <div className="flex items-center gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={!row}
              onClick={() => row && setWizard({ editing: row })}
            >
              Upravit
            </Button>
            <Button
              size="small"
              variant="transparent"
              isLoading={update.isPending}
              onClick={() =>
                update.mutate(
                  { id: current.id, body: { remove_product_ids: [productId] } },
                  { onSuccess: () => toast.success("Výrobek vyřazen z výprodeje — je za plnou cenu.") }
                )
              }
            >
              Vyřadit
            </Button>
            {/* Celý výprodej pryč i odsud (18. 11. 2026, Matěj) — ne jen
                tenhle výrobek. Nevratné, proto s potvrzením. */}
            <Button
              size="small"
              variant="transparent"
              className="text-ui-fg-error hover:text-ui-fg-error"
              isLoading={remove.isPending}
              onClick={() => setConfirmDelete(true)}
            >
              Smazat
            </Button>
          </div>
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Smazat celý výprodej „${current.title}“?`}
        description={`Zmizí pro všechny výrobky${
          row ? ` (${pocet(row.members_count)})` : ""
        } a ty se vrátí na plnou cenu. Jen tenhle výrobek vyřadíte tlačítkem Vyřadit.`}
        consequence="Smazaný výprodej nejde vrátit — dá se jen založit znovu."
        confirmLabel="Smazat výprodej"
        isPending={remove.isPending}
        onConfirm={() => remove.mutate(current.id, { onSuccess: () => setConfirmDelete(false) })}
      />
      {dialogs}
    </>
  );
};
