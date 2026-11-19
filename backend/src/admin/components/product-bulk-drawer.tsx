import { Badge, Button, Drawer, Input, Select, Text, clx, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ceskaChyba } from "../lib/ceska-chyba";
import { sdk } from "../lib/sdk";
import {
  applyBulkClassification,
  BulkClassification,
  bulkClassificationDirty,
  BulkSortPanel,
  emptyBulkClassification,
  type BulkClassificationDraft,
} from "./product-classification";
import { InspectorGroup, InspectorRow } from "./product-inspector";
import { endOfDay, QUICK, startOfDay, today } from "./product-sale";
import { useVyprodeje } from "./vyprodej";

/**
 * Hromadné změny — pravý panel (19. 11. 2026, Matěj: „lišta dole je
 * hrozná; udělej pravý panel jako na detailu výrobku, řádek po řádku, jen
 * nastavení, která výrobky sdílí — a otevírat ho tlačítkem, ať nepřekrývá
 * název a zaškrtávátko").
 *
 * Jedna komponenta pro Produkty+ i Kolekce a kategorie. Otevírá ji tlačítko
 * „Hromadné změny (N)" až po označení výrobků. Vzhled = pravý sloupec
 * detailu výrobku (`InspectorGroup` / `InspectorRow`), Zařazení = stejné
 * řádky jako na detailu (`BulkClassification`). Ceny, varianty a fotky sem
 * schválně nepatří — ty jsou u každého kusu jiné.
 *
 * Nic se nezapisuje hned: všechno se rozpracuje a uloží jedním „Uložit vše"
 * (Zrušit = zahodit a zavřít). U vlastnosti, kterou mají vybrané kusy různě,
 * stojí „různé" a nic není stisknuté — klik nastaví konkrétní hodnotu všem.
 */

export type BulkProduct = {
  id: string;
  title: string;
  status: string;
  cod_allowed: boolean;
  fragile: boolean;
  packaging_price: number | null;
  clearance: boolean;
  no_promo: boolean;
  frost_resistant?: boolean;
  shipping_class: "male" | "velke" | "poukaz";
  collection_id: string | null;
  category_refs?: { id: string; name: string }[];
};

type FlagDraft = {
  cod_allowed?: boolean;
  fragile?: boolean;
  clearance?: boolean;
  no_promo?: boolean;
  frost_resistant?: boolean;
  shipping_class?: "male" | "velke" | "poukaz";
  /** Viditelnost v obchodě — stav výrobku. */
  status?: "published" | "draft";
};

const pocet = (n: number) => (n === 1 ? "výrobek" : n >= 2 && n <= 4 ? "výrobky" : "výrobků");

/** Shodná hodnota napříč výběrem, jinak `null` (= „různé"). */
const shared = <T,>(items: BulkProduct[], read: (item: BulkProduct) => T): T | null => {
  if (!items.length) return null;
  const first = read(items[0]);
  return items.every((item) => read(item) === first) ? first : null;
};

/** Spojená tlačítka (Ano | Ne, Malé | Velké | Poukaz). */
const Seg = <V extends string>({
  label,
  options,
  value,
  dirty,
  onSet,
}: {
  label: string;
  options: { value: V; label: string }[];
  value: V | null;
  dirty: boolean;
  onSet: (next: V) => void;
}) => (
  <div
    role="group"
    aria-label={label}
    className={clx(
      "bg-ui-bg-subtle flex rounded-md border p-0.5",
      dirty ? "border-ui-tag-orange-border" : "border-ui-border-base"
    )}
  >
    {options.map((option) => {
      const pressed = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={pressed}
          onClick={() => onSet(option.value)}
          className={clx(
            "txt-compact-small min-h-[30px] rounded px-3 outline-none transition-fg focus-visible:shadow-borders-focus",
            pressed
              ? "bg-ui-bg-base text-ui-fg-base shadow-borders-base font-medium"
              : "text-ui-fg-subtle hover:text-ui-fg-base"
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

const ANO_NE = [
  { value: "on" as const, label: "Ano" },
  { value: "off" as const, label: "Ne" },
];

export const ProductBulkDrawer = ({
  products,
  open,
  onOpenChange,
  onSaved,
  mode = "vse",
}: {
  /**
   * „vse" = Produkty+ (doprava, prodej, slevy, zařazení);
   * „zarazeni" = Kolekce a kategorie — jen přeřazení (BulkSortPanel).
   */
  mode?: "vse" | "zarazeni";
  /** Vybrané výrobky (řádky ze seznamu). */
  products: BulkProduct[];
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Po uložení — rodič zruší výběr. */
  onSaved?: () => void;
}) => {
  const queryClient = useQueryClient();
  const [flags, setFlags] = useState<FlagDraft>({});
  const [classification, setClassification] = useState<BulkClassificationDraft>(emptyBulkClassification());
  const [balneText, setBalneText] = useState("");
  const [balneStart, setBalneStart] = useState("");
  /* Kolekce a kategorie: věta „Po uložení budou…" z panelu přeřazení. */
  const [sortSummary, setSortSummary] = useState<string | null>(null);
  /* Slevy: přidat do výprodeje, nastavit / zrušit slevu výrobku všem. */
  const [vyprodejTarget, setVyprodejTarget] = useState<string | null>(null);
  const [saleKind, setSaleKind] = useState<"none" | "set" | "remove">("none");
  const [salePercent, setSalePercent] = useState("20");
  const [saleTo, setSaleTo] = useState("");
  const vyprodeje = useVyprodeje();

  /* Materiál a rozměry (19. 11. 2026): "__beze" = nesahat, "__none" = bez materiálu. */
  const [material, setMaterial] = useState<string>("__beze");
  const [rozmery, setRozmery] = useState("");
  /* Objednání bez skladu (19. 11. 2026): "__beze" = nesahat. */
  const [bezSkladu, setBezSkladu] = useState<"__beze" | "on" | "off">("__beze");
  const [zprava, setZprava] = useState("");
  /* Ceny: id provedení → nová cena v Kč (text z pole). */
  const [ceny, setCeny] = useState<Record<string, string>>({});
  type VarRow = { id: string; title: string; allow_backorder?: boolean; prices?: { amount: number; currency_code: string }[] };
  const variantyQuery = useQuery<{ products: { id: string; title: string; variants: VarRow[] }[] }>({
    queryKey: ["bulk-varianty", products.map((p) => p.id).join(",")],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/products?${products.map((p) => `id[]=${p.id}`).join("&")}&limit=${products.length}&fields=id,title,variants.id,variants.title,variants.allow_backorder,variants.prices.amount,variants.prices.currency_code`
      ),
    enabled: open && mode === "vse" && products.length > 0,
  });
  const varianty = variantyQuery.data?.products ?? [];
  const czkOf = (v: VarRow) => v.prices?.find((p) => String(p.currency_code).toLowerCase() === "czk")?.amount ?? null;
  const zmenenaCena = (v: VarRow) => {
    const t = (ceny[v.id] ?? "").trim();
    if (t === "") return null;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) && n > 0 && n !== czkOf(v) ? Math.round(n * 100) / 100 : null;
  };
  const zmenenychCen = varianty.flatMap((p) => p.variants).filter((v) => zmenenaCena(v) !== null).length;
  const bezSkladuSdilene: "on" | "off" | null = (() => {
    if (!varianty.length) return null;
    const vse = varianty.flatMap((p) => p.variants.map((v) => Boolean(v.allow_backorder)));
    return vse.every(Boolean) ? "on" : vse.every((x) => !x) ? "off" : null;
  })();
  const materialsQuery = useQuery<{ materials: string[] }>({
    queryKey: ["produkt-materials"],
    queryFn: () => sdk.client.fetch(`/admin/workbench/materials`),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  /* Při každém otevření načisto. */
  useEffect(() => {
    if (!open) return;
    setFlags({});
    setMaterial("__beze");
    setRozmery("");
    setBezSkladu("__beze");
    setZprava("");
    setCeny({});
    setClassification(emptyBulkClassification());
    setSortSummary(null);
    setVyprodejTarget(null);
    setSaleKind("none");
    setSalePercent("20");
    setSaleTo("");
    const sharedPackaging = shared(products, (product) => product.packaging_price ?? null);
    const start = sharedPackaging === null ? "" : String(sharedPackaging);
    setBalneText(start);
    setBalneStart(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const collectionsQuery = useQuery<{ collections: { id: string; title: string }[] }>({
    queryKey: ["produkt-collections"],
    queryFn: () => sdk.client.fetch(`/admin/collections?limit=100&fields=id,title`),
    staleTime: 5 * 60_000,
    enabled: open,
  });
  const categoriesQuery = useQuery<{
    product_categories: { id: string; name: string; metadata?: Record<string, unknown> | null }[];
  }>({
    queryKey: ["produkt-categories"],
    queryFn: () => sdk.client.fetch(`/admin/product-categories?limit=100&fields=id,name,is_active,metadata`),
    staleTime: 5 * 60_000,
    enabled: open,
  });
  const categories = categoriesQuery.data?.product_categories ?? [];

  const total = products.length;
  /* Hodnota, kterou panel ukazuje: rozpracovaná, jinak shodná uložená. */
  const flagValue = (key: "cod_allowed" | "fragile" | "clearance" | "no_promo" | "frost_resistant") => {
    if (flags[key] !== undefined) return flags[key] ? "on" : "off";
    const value = shared(products, (product) => Boolean(product[key]));
    return value === null ? null : value ? "on" : "off";
  };
  const shippingValue = flags.shipping_class ?? shared(products, (product) => product.shipping_class);
  const statusValue =
    flags.status ?? shared(products, (product) => (product.status === "published" ? "published" : "draft"));
  const packagingShared = shared(products, (product) => product.packaging_price ?? null);
  const packagingMixed = products.length > 1 && !products.every((p) => (p.packaging_price ?? null) === packagingShared);

  /*
   * Balné se čte přímo z pole (ne až při jeho opuštění): kdo napíše číslo
   * a hned klikne Uložit vše, nesmí trefit ještě šedé tlačítko.
   * Prázdné pole u různých hodnot = „nic jsem nezadala", ne nula všem.
   */
  const balneTrim = balneText.trim();
  const balneParsed = balneTrim === "" ? null : Number(balneTrim.replace(",", "."));
  const balneValid = balneParsed === null || (Number.isFinite(balneParsed) && balneParsed >= 0);
  const balneChanged =
    balneTrim !== balneStart.trim() && balneValid && !(balneTrim === "" && packagingMixed);
  const balneValue = balneParsed === null ? null : Math.round(balneParsed * 100) / 100;

  const salePercentValue = Number(salePercent);
  const saleValid =
    saleKind !== "set" || (Number.isInteger(salePercentValue) && salePercentValue >= 1 && salePercentValue <= 90);
  const usableVyprodeje = (vyprodeje.data?.vyprodeje ?? []).filter(
    (item) => item.state === "running" || item.state === "scheduled" || item.state === "off"
  );

  const flagKeys = Object.keys(flags) as (keyof FlagDraft)[];
  const changeCount =
    flagKeys.length +
    (balneChanged ? 1 : 0) +
    (bulkClassificationDirty(classification) ? 1 : 0) +
    (vyprodejTarget ? 1 : 0) +
    (saleKind !== "none" && saleValid ? 1 : 0) +
    (material !== "__beze" ? 1 : 0) +
    (rozmery.trim() ? 1 : 0) +
    (bezSkladu !== "__beze" ? 1 : 0) +
    (zprava.trim() ? 1 : 0) +
    zmenenychCen;
  const dirty = changeCount > 0;
  const hint = (mixed: boolean) => (mixed ? "U vybraných se liší — klikem nastavíte všem." : undefined);

  const save = useMutation({
    mutationFn: async () => {
      const { status, ...rest } = flags;
      const flagBody: Record<string, unknown> = {
        ...rest,
        ...(balneChanged ? { packaging_price: balneValue } : {}),
        ...(rozmery.trim() ? { dimensions: rozmery.trim() } : {}),
        ...(zprava.trim() ? { backorder_note: zprava.trim() } : {}),
      };
      const classDirty = bulkClassificationDirty(classification);
      for (const product of products) {
        if (Object.keys(flagBody).length) {
          await sdk.client.fetch(`/admin/workbench/products/${product.id}/flags`, {
            method: "POST",
            body: flagBody,
          });
        }
        const body: Record<string, unknown> = {};
        if (status && status !== product.status) body.status = status;
        if (material !== "__beze") body.material = material === "__none" ? null : material;
        if (classDirty) {
          const next = applyBulkClassification(
            {
              collection_id: product.collection_id,
              category_ids: (product.category_refs ?? []).map((category) => category.id),
            },
            classification,
            categories
          );
          body.collection_id = next.collection_id;
          body.categories = next.category_ids.map((id) => ({ id }));
        }
        if (Object.keys(body).length) {
          await sdk.client.fetch(`/admin/products/${product.id}`, { method: "POST", body });
        }
      }
      /* Objednání bez skladu a ceny — po provedeních, jako na detailu výrobku. */
      for (const p of varianty) {
        if (bezSkladu !== "__beze") {
          await sdk.client.fetch(`/admin/products/${p.id}/variants/batch`, {
            method: "POST",
            body: { update: p.variants.map((v) => ({ id: v.id, allow_backorder: bezSkladu === "on" })) },
          });
        }
        for (const v of p.variants) {
          const nova = zmenenaCena(v);
          if (nova === null) continue;
          await sdk.client.fetch(`/admin/products/${p.id}/variants/${v.id}`, {
            method: "POST",
            /* Ostatní měny se pošlou s sebou, jinak by je ceník smazal do příštího kurzu ČNB. */
            body: {
              prices: [
                { currency_code: "czk", amount: nova },
                ...(v.prices ?? []).filter((x) => String(x.currency_code).toLowerCase() !== "czk").map((x) => ({ currency_code: x.currency_code, amount: x.amount })),
              ],
            },
          });
        }
      }
      /* Slevy: sleva výrobku každému zvlášť (výrobek ve výprodeji ji
         odmítne — spočítá se a řekne), výprodej jedním voláním. */
      let saleRefused = 0;
      if (saleKind === "set" && saleValid) {
        for (const product of products) {
          try {
            await sdk.client.fetch(`/admin/workbench/products/${product.id}/sale`, {
              method: "POST",
              body: {
                percent: salePercentValue,
                starts_at: startOfDay(today()),
                ends_at: endOfDay(saleTo),
                enabled: true,
              },
            });
          } catch {
            saleRefused += 1;
          }
        }
      }
      if (saleKind === "remove") {
        for (const product of products) {
          await sdk.client.fetch(`/admin/workbench/products/${product.id}/sale`, { method: "DELETE" });
        }
      }
      if (vyprodejTarget) {
        await sdk.client.fetch(`/admin/workbench/vyprodeje/${vyprodejTarget}`, {
          method: "POST",
          body: { add_product_ids: products.map((product) => product.id) },
        });
      }
      return { saleRefused };
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["product-sale"] }),
        queryClient.invalidateQueries({ queryKey: ["bulk-varianty"] }),
        queryClient.invalidateQueries({ queryKey: ["workbench-product"] }),
        queryClient.invalidateQueries({ queryKey: ["product-sales"] }),
        queryClient.invalidateQueries({ queryKey: ["vyprodeje"] }),
        queryClient.invalidateQueries({ queryKey: ["product-vyprodej"] }),
        queryClient.invalidateQueries({ queryKey: ["workbench-products"] }),
        queryClient.invalidateQueries({ queryKey: ["workbench-products-all"] }),
        queryClient.invalidateQueries({ queryKey: ["operations-products"] }),
        queryClient.invalidateQueries({ queryKey: ["rozdeleni-collections"] }),
      ]);
      toast.success(`Uloženo u ${total} ${total === 1 ? "výrobku" : "výrobků"}.`);
      if (result?.saleRefused) {
        toast.warning(`Slevu nešlo nastavit u ${result.saleRefused} — jsou ve výprodeji (výprodej ruší vlastní slevu).`);
      }
      onOpenChange(false);
      onSaved?.();
    },
    onError: (error) => toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {/* Portál Medusy nemá z-index — štítky a lišta seznamu (z-10/z-20) by
          prosvítaly přes panel. */}
      <Drawer.Content className="z-50" overlayProps={{ className: "z-50" }}>
        <Drawer.Header>
          <Drawer.Title>
            {mode === "zarazeni" ? `Zařadit ${total} ${pocet(total)}` : `Hromadné změny — ${total} ${pocet(total)}`}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col overflow-y-auto p-0">
          <Text size="xsmall" className="text-ui-fg-subtle px-6 pt-4">
            {products.slice(0, 4).map((product) => product.title).join(", ")}
            {total > 4 ? ` a dalších ${total - 4}` : ""}
          </Text>

          {mode === "zarazeni" ? (
            <BulkSortPanel
              products={products.map((product) => ({
                id: product.id,
                collection_id: product.collection_id,
                category_ids: (product.category_refs ?? []).map((category) => category.id),
              }))}
              collections={collectionsQuery.data?.collections ?? []}
              categories={categories}
              onChange={(draft, summary) => {
                setClassification(draft);
                setSortSummary(summary);
              }}
            />
          ) : (
          <>
          <InspectorGroup
            title="Ceny"
            note="Přepište cenu v Kč u kusu nebo provedení. Euro se dopočítá podle kurzu. Prázdné nebo stejné = beze změny."
          >
            {variantyQuery.isLoading && (
              <div className="px-3 py-3"><Text size="small" className="text-ui-fg-subtle">Načítám ceny…</Text></div>
            )}
            {varianty.map((p) => (
              <div key={p.id} className="px-3 py-2">
                {p.variants.length > 1 && (
                  <Text size="small" weight="plus" className="mb-1 truncate" title={p.title}>{p.title}</Text>
                )}
                <div className="flex flex-col gap-1.5">
                  {p.variants.map((v) => {
                    const zmena = zmenenaCena(v) !== null;
                    return (
                      <div key={v.id} className="flex items-center justify-between gap-3">
                        <Text size="small" className={`min-w-0 truncate ${p.variants.length > 1 ? "text-ui-fg-subtle pl-3" : ""}`} title={p.variants.length > 1 ? v.title : p.title}>
                          {p.variants.length > 1 ? v.title : p.title}
                        </Text>
                        <span className="flex shrink-0 items-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Cena — ${p.title}${p.variants.length > 1 ? ` (${v.title})` : ""}`}
                            value={ceny[v.id] ?? (czkOf(v) === null ? "" : String(czkOf(v)))}
                            onChange={(event) => setCeny((prev) => ({ ...prev, [v.id]: event.target.value }))}
                            className={`bg-ui-bg-field txt-compact-small min-h-[32px] w-24 rounded-md border px-2 text-right ${zmena ? "border-ui-border-interactive" : "border-ui-border-base"}`}
                          />
                          <Text size="small" className="text-ui-fg-muted">Kč</Text>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </InspectorGroup>

          <InspectorGroup title="Doprava">
            <InspectorRow
              label="Balné"
              hint={!balneValid ? "Zadejte kladné číslo." : packagingMixed && !balneChanged ? "U vybraných se liší." : "Za kus; prázdné = 0 Kč."}
              control={
                <div className="relative w-28">
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    aria-label="Balné u všech vybraných"
                    placeholder={packagingMixed ? "různé" : "0"}
                    value={balneText}
                    onChange={(event) => setBalneText(event.target.value)}

                    className={clx(
                      "bg-ui-bg-field txt-compact-small h-8 w-full rounded-md border pl-2 pr-9 text-right tabular-nums",
                      !balneValid ? "border-ui-border-error" : balneChanged ? "border-ui-tag-orange-border" : "border-ui-border-base"
                    )}
                  />
                  <span className="text-ui-fg-muted txt-compact-small pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                    Kč
                  </span>
                </div>
              }
            />
            <InspectorRow
              label="Dobírka"
              hint={hint(flagValue("cod_allowed") === null)}
              control={
                <Seg label="Dobírka" options={ANO_NE} value={flagValue("cod_allowed")} dirty={flags.cod_allowed !== undefined}
                  onSet={(next) => setFlags((prev) => ({ ...prev, cod_allowed: next === "on" }))} />
              }
            />
            <InspectorRow
              label="Křehké"
              hint={hint(flagValue("fragile") === null)}
              control={
                <Seg label="Křehké" options={ANO_NE} value={flagValue("fragile")} dirty={flags.fragile !== undefined}
                  onSet={(next) => setFlags((prev) => ({ ...prev, fragile: next === "on" }))} />
              }
            />
            <InspectorRow
              label="Zásilka"
              hint={hint(shippingValue === null) ?? "Podle ní se počítá poštovné."}
              control={
                <Seg
                  label="Zásilka"
                  options={[
                    { value: "male" as const, label: "Malé" },
                    { value: "velke" as const, label: "Velké" },
                    { value: "poukaz" as const, label: "Poukaz" },
                  ]}
                  value={shippingValue}
                  dirty={flags.shipping_class !== undefined}
                  onSet={(next) => setFlags((prev) => ({ ...prev, shipping_class: next }))}
                />
              }
            />
          </InspectorGroup>

          <InspectorGroup title="Prodej">
            <InspectorRow
              label="Objednání bez kusů na skladu"
              hint={
                bezSkladu === "__beze" && bezSkladuSdilene === null
                  ? "U vybraných se liší — klikem nastavíte všem."
                  : "Zákazník koupí i vyprodaný kus a uvidí zprávu níž."
              }
              control={
                <Seg
                  label="Objednání bez kusů na skladu"
                  options={ANO_NE}
                  value={bezSkladu === "__beze" ? bezSkladuSdilene : bezSkladu}
                  dirty={bezSkladu !== "__beze"}
                  onSet={(next) => setBezSkladu(next)}
                />
              }
            >
              {(bezSkladu === "on" || (bezSkladu === "__beze" && bezSkladuSdilene !== "off")) && (
                <div className="mt-2 flex flex-col gap-1">
                  <Text size="xsmall" weight="plus">Zpráva pro zákazníka</Text>
                  <Input
                    size="small"
                    value={zprava}
                    onChange={(event) => setZprava(event.target.value)}
                    placeholder="např. Vyrobíme pro vás do 3 týdnů. (prázdné = beze změny)"
                    className={zprava.trim() ? "shadow-borders-interactive-with-active" : undefined}
                  />
                </div>
              )}
            </InspectorRow>
            <InspectorRow
              label="V obchodě"
              hint={hint(statusValue === null) ?? "Skryté zákazník nevidí."}
              control={
                <Seg
                  label="V obchodě"
                  options={[
                    { value: "published" as const, label: "Zobrazit" },
                    { value: "draft" as const, label: "Skrýt" },
                  ]}
                  value={statusValue}
                  dirty={flags.status !== undefined}
                  onSet={(next) => setFlags((prev) => ({ ...prev, status: next }))}
                />
              }
            />
            <InspectorRow
              label="Poškozený kus"
              hint={hint(flagValue("clearance") === null) ?? "Levněji; po prodeji se skryje."}
              control={
                <Seg label="Poškozený kus" options={ANO_NE} value={flagValue("clearance")} dirty={flags.clearance !== undefined}
                  onSet={(next) => setFlags((prev) => ({ ...prev, clearance: next === "on" }))} />
              }
            />
            <InspectorRow
              label="Slevové kódy"
              hint={hint(flagValue("no_promo") === null) ?? "Vyloučené kusy kód nesníží."}
              control={
                <Seg
                  label="Slevové kódy"
                  options={[
                    { value: "off" as const, label: "Platí" },
                    { value: "on" as const, label: "Vyloučit" },
                  ]}
                  value={flagValue("no_promo")}
                  dirty={flags.no_promo !== undefined}
                  onSet={(next) => setFlags((prev) => ({ ...prev, no_promo: next === "on" }))}
                />
              }
            />
          </InspectorGroup>

          {/* Materiál a rozměry (19. 11. 2026, Matěj) — jako pravý sloupec detailu výrobku. */}
          <InspectorGroup title="Materiál a rozměry">
            <InspectorRow
              label="Materiál"
              hint={material === "__beze" ? "Beze změny — každý si nechá svůj." : material === "__none" ? "Všem se materiál smaže." : `Všem nastavím: ${material}`}
              control={
                <select
                  aria-label="Materiál"
                  value={material}
                  onChange={(event) => setMaterial(event.target.value)}
                  className={`bg-ui-bg-field txt-compact-small min-h-[36px] max-w-[200px] rounded-md border px-2 ${material !== "__beze" ? "border-ui-border-interactive" : "border-ui-border-base"}`}
                >
                  <option value="__beze">Beze změny</option>
                  <option value="__none">Bez materiálu</option>
                  {(materialsQuery.data?.materials ?? []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              }
            />
            <InspectorRow
              label="Rozměry"
              hint={rozmery.trim() ? "Stejné rozměry dostanou všechny vybrané." : "Prázdné = beze změny."}
              control={
                <input
                  type="text"
                  aria-label="Rozměry"
                  placeholder="např. výška 12 cm, ø 9 cm"
                  value={rozmery}
                  onChange={(event) => setRozmery(event.target.value)}
                  className={`bg-ui-bg-field txt-compact-small min-h-[36px] w-[200px] rounded-md border px-2 ${rozmery.trim() ? "border-ui-border-interactive" : "border-ui-border-base"}`}
                />
              }
            />
            <InspectorRow
              label="Mrazuvzdorné"
              hint={hint(flagValue("frost_resistant") === null) ?? "Vydrží mráz — štítek u výrobku."}
              control={
                <Seg label="Mrazuvzdorné" options={ANO_NE} value={flagValue("frost_resistant")} dirty={flags.frost_resistant !== undefined}
                  onSet={(next) => setFlags((prev) => ({ ...prev, frost_resistant: next === "on" }))} />
              }
            />
          </InspectorGroup>

          <InspectorGroup title="Slevy" note="Výprodej ruší vlastní slevu výrobku a na zlevněné kusy slevové kódy neplatí.">
            <InspectorRow
              label="Výprodej"
              hint={vyprodejTarget ? "Vybrané se přidají do výprodeje." : "Přidat vybrané do existujícího výprodeje."}
              control={
                <div className="w-48">
                  <Select
                    value={vyprodejTarget ?? "__none__"}
                    onValueChange={(value) => setVyprodejTarget(value === "__none__" ? null : value)}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Beze změny" />
                    </Select.Trigger>
                    <Select.Content className="z-[60]">
                      <Select.Item value="__none__">Beze změny</Select.Item>
                      {usableVyprodeje.map((item) => (
                        <Select.Item key={item.id} value={item.id}>
                          {`${item.title} · −${item.percent} %${item.state === "off" ? " (vypnutý)" : ""}`}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              }
            />
            <InspectorRow
              label="Sleva"
              hint={
                saleKind === "set"
                  ? "Stejná sleva všem vybraným, od dneška."
                  : saleKind === "remove"
                    ? "Vlastní slevu vybraným zruší."
                    : "Vlastní sleva výrobku (ne výprodej)."
              }
              control={
                <Seg
                  label="Sleva"
                  options={[
                    { value: "none" as const, label: "Beze změny" },
                    { value: "set" as const, label: "Nastavit" },
                    { value: "remove" as const, label: "Zrušit" },
                  ]}
                  value={saleKind}
                  dirty={saleKind !== "none"}
                  onSet={(next) => setSaleKind(next as "none" | "set" | "remove")}
                />
              }
            >
              {saleKind === "set" && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-24">
                      <Input
                        type="number"
                        min={1}
                        max={90}
                        size="small"
                        aria-label="Sleva v procentech"
                        value={salePercent}
                        className="pr-7 tabular-nums"
                        onChange={(event) => setSalePercent(event.target.value)}
                      />
                      <span className="text-ui-fg-muted txt-compact-small pointer-events-none absolute inset-y-0 right-2.5 flex items-center">%</span>
                    </div>
                    {QUICK.map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        aria-pressed={salePercentValue === quick}
                        onClick={() => setSalePercent(String(quick))}
                        className={clx(
                          "min-h-[30px] rounded-full border px-3",
                          salePercentValue === quick ? "border-ui-border-interactive bg-ui-bg-base-pressed" : "border-ui-border-base hover:bg-ui-bg-base-hover"
                        )}
                      >
                        <Text size="small">{quick} %</Text>
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2">
                    <Text size="xsmall" className="text-ui-fg-subtle">Do (nepovinné)</Text>
                    <Input type="date" size="small" className="w-40" value={saleTo} min={today()} onChange={(event) => setSaleTo(event.target.value)} />
                  </label>
                  {!saleValid && (
                    <Text size="xsmall" className="text-ui-fg-error">Zadejte celé číslo od 1 do 90.</Text>
                  )}
                </div>
              )}
            </InspectorRow>
          </InspectorGroup>

          {/* Zařazení dole — stejné tři kroky jako v Kolekce a kategorie
              (jedna komponenta BulkSortPanel, 19. 11. 2026). */}
          <section className="px-5 pt-4">
            <Text size="small" weight="plus" className="text-ui-fg-subtle px-1">
              Zařazení
            </Text>
          </section>
          <BulkSortPanel
            products={products.map((product) => ({
              id: product.id,
              collection_id: product.collection_id,
              category_ids: (product.category_refs ?? []).map((category) => category.id),
            }))}
            collections={collectionsQuery.data?.collections ?? []}
            categories={categories}
            onChange={(draft, summary) => {
              setClassification(draft);
              setSortSummary(summary);
            }}
          />
          </>
          )}
        </Drawer.Body>
        <Drawer.Footer className="flex items-center justify-between gap-2">
          <Text size="xsmall" className="text-ui-fg-subtle min-w-0 flex-1">
            {mode === "zarazeni" ? (
              sortSummary ?? "Vyberte, kam je dát."
            ) : dirty ? (
              <Badge size="2xsmall" color="orange">
                {changeCount === 1 ? "1 změna" : changeCount <= 4 ? `${changeCount} změny` : `${changeCount} změn`}
              </Badge>
            ) : (
              "Zatím beze změny"
            )}
          </Text>
          <div className="flex items-center gap-2">
            <Drawer.Close asChild>
              <Button size="small" variant="secondary" disabled={save.isPending}>
                {mode === "zarazeni" ? "Zrušit" : "Zrušit vše"}
              </Button>
            </Drawer.Close>
            <Button size="small" disabled={!dirty} isLoading={save.isPending} onClick={() => save.mutate()}>
              {mode === "zarazeni" ? "Uložit" : dirty ? `Uložit vše (${changeCount})` : "Uložit vše"}
            </Button>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
