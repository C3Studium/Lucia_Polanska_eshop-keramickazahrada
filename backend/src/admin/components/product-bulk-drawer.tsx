import { Badge, Button, IconButton, Input, Select, Text, clx, toast } from "@medusajs/ui";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
import { Radek, Skupina, poleTrida } from "./nastaveni-kousky";
import { NavodTip } from "./navod-tip";
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

/**
 * Spojená tlačítka (Ano | Ne, Malé | Velké | Poukaz) — vypadají jako volby
 * v nabídce „…"; `null` = u vybraných různé, nic není stisknuté.
 */
const Seg = <V extends string>({
  label,
  options,
  value,
  onSet,
}: {
  label: string;
  options: { value: V; label: string }[];
  value: V | null;
  dirty?: boolean;
  onSet: (next: V) => void;
}) => (
  <div role="group" aria-label={label} className="bg-ui-bg-subtle flex shrink-0 flex-wrap rounded-md p-0.5">
    {options.map((option) => {
      const pressed = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={pressed}
          onClick={() => onSet(option.value)}
          className={clx(
            "txt-compact-xsmall-plus min-h-[30px] rounded px-2.5 outline-none focus-visible:shadow-borders-focus",
            pressed ? "bg-ui-bg-base shadow-borders-base text-ui-fg-base" : "text-ui-fg-subtle hover:text-ui-fg-base"
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

  /* Okno jako nabídka „…" (19. 11. 2026, Matěj): plovoucí, dva sloupce,
     stejné skupiny a řádky; na telefonu jeden sloupec přes celou šířku. */
  const okno = useRef<HTMLDivElement>(null);
  const zkusitZavrit = () => {
    if (save.isPending) return;
    if (dirty) {
      toast.warning("Máte neuložené změny — klikněte na Uložit vše, nebo Zrušit vše.");
      return;
    }
    onOpenChange(false);
  };
  useEffect(() => {
    if (open) okno.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const klavesa = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      /* Escape v rozbalovacím výběru zavře jen ten výběr. */
      if (document.querySelector("[role=listbox], [data-navod-velky]")) return;
      zkusitZavrit();
    };
    window.addEventListener("keydown", klavesa);
    return () => window.removeEventListener("keydown", klavesa);
  });

  if (!open || typeof document === "undefined") return null;

  const nazev = mode === "zarazeni" ? `Zařadit ${total} ${pocet(total)}` : `Hromadné změny — ${total} ${pocet(total)}`;
  const nazvy = products.slice(0, 4).map((product) => product.title).join(", ") + (total > 4 ? ` a dalších ${total - 4}` : "");
  const flagNazev = (key: keyof FlagDraft) => flags[key] !== undefined;

  const zarazeni = (
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
  );

  const ceník = (
    <Skupina nazev="Cena a sklad" popis="Ceny v Kč — euro se dopočítá podle kurzu. Nepřepsaná cena zůstane.">
      <div className="max-h-[260px] divide-y overflow-y-auto">
        {variantyQuery.isLoading && (
          <div className="px-3 py-2.5">
            <Text size="small" className="text-ui-fg-subtle">Načítám ceny…</Text>
          </div>
        )}
        {varianty.flatMap((p) =>
          p.variants.map((v) => {
            const vice = p.variants.length > 1;
            const zmena = zmenenaCena(v) !== null;
            return (
              <Radek key={v.id} nazev={vice ? v.title : p.title} popis={vice ? p.title : undefined} zmeneno={zmena}>
                <span className="flex shrink-0 items-center gap-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={`Cena — ${p.title}${vice ? ` (${v.title})` : ""}`}
                    value={ceny[v.id] ?? (czkOf(v) === null ? "" : String(czkOf(v)))}
                    onChange={(event) => setCeny((prev) => ({ ...prev, [v.id]: event.target.value }))}
                    className={`${poleTrida(zmena)} w-24 text-right tabular-nums`}
                  />
                  <Text size="small" className="text-ui-fg-muted">Kč</Text>
                </span>
              </Radek>
            );
          })
        )}
      </div>
      <Radek
        nazev="Objednání bez kusů na skladu"
        zmeneno={bezSkladu !== "__beze" || Boolean(zprava.trim())}
        popis={bezSkladu === "__beze" && bezSkladuSdilene === null ? "U vybraných se liší — klikem nastavíte všem." : "Zákazník koupí i vyprodaný kus"}
        pod={
          (bezSkladu === "on" || (bezSkladu === "__beze" && bezSkladuSdilene !== "off")) && (
            <input
              type="text"
              aria-label="Zpráva pro zákazníka"
              value={zprava}
              onChange={(event) => setZprava(event.target.value)}
              placeholder="Zpráva pro zákazníka, např. Vyrobíme do 3 týdnů. (prázdné = beze změny)"
              className={`${poleTrida(Boolean(zprava.trim()))} w-full`}
            />
          )
        }
      >
        <Seg
          label="Objednání bez kusů na skladu"
          options={ANO_NE}
          value={bezSkladu === "__beze" ? bezSkladuSdilene : bezSkladu}
          onSet={(next) => setBezSkladu(next)}
        />
      </Radek>
    </Skupina>
  );

  const doprava = (
    <Skupina nazev="Doprava">
      <Radek nazev="Velikost zásilky" zmeneno={flagNazev("shipping_class")} popis={hint(shippingValue === null) ?? "Podle ní se počítá poštovné"}>
        <Seg
          label="Zásilka"
          options={[
            { value: "male" as const, label: "Malé" },
            { value: "velke" as const, label: "Velké" },
            { value: "poukaz" as const, label: "Poukaz" },
          ]}
          value={shippingValue}
          onSet={(next) => setFlags((prev) => ({ ...prev, shipping_class: next }))}
        />
      </Radek>
      <Radek nazev="Křehké" zmeneno={flagNazev("fragile")} popis={hint(flagValue("fragile") === null) ?? "Celá zásilka pojede jako křehká"}>
        <Seg label="Křehké" options={ANO_NE} value={flagValue("fragile")} onSet={(next) => setFlags((prev) => ({ ...prev, fragile: next === "on" }))} />
      </Radek>
      <Radek nazev="Dobírka" zmeneno={flagNazev("cod_allowed")} popis={hint(flagValue("cod_allowed") === null) ?? "Ne = jen platba předem"}>
        <Seg label="Dobírka" options={ANO_NE} value={flagValue("cod_allowed")} onSet={(next) => setFlags((prev) => ({ ...prev, cod_allowed: next === "on" }))} />
      </Radek>
      <Radek
        nazev="Balné"
        zmeneno={balneChanged}
        popis={!balneValid ? "Napište číslo, třeba 20" : packagingMixed && !balneChanged ? "U vybraných se liší" : "Za kus; prázdné = 0 Kč"}
      >
        <span className="flex shrink-0 items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            aria-label="Balné u všech vybraných"
            placeholder={packagingMixed ? "různé" : "0"}
            value={balneText}
            onChange={(event) => setBalneText(event.target.value)}
            className={`${poleTrida(balneChanged, !balneValid)} w-20 text-right tabular-nums`}
          />
          <Text size="small" className="text-ui-fg-muted">Kč</Text>
        </span>
      </Radek>
    </Skupina>
  );

  const prodej = (
    <Skupina nazev="Prodej">
      <Radek nazev="V obchodě" zmeneno={flags.status !== undefined} popis={hint(statusValue === null) ?? "Skryté zákazník nevidí"}>
        <Seg
          label="V obchodě"
          options={[
            { value: "published" as const, label: "Zobrazit" },
            { value: "draft" as const, label: "Skrýt" },
          ]}
          value={statusValue}
          onSet={(next) => setFlags((prev) => ({ ...prev, status: next }))}
        />
      </Radek>
      <Radek nazev="Poškozený kus" zmeneno={flagNazev("clearance")} popis={hint(flagValue("clearance") === null) ?? "Levněji; po prodeji se skryje"}>
        <Seg label="Poškozený kus" options={ANO_NE} value={flagValue("clearance")} onSet={(next) => setFlags((prev) => ({ ...prev, clearance: next === "on" }))} />
      </Radek>
      <Radek nazev="Slevové kódy" zmeneno={flagNazev("no_promo")} popis={hint(flagValue("no_promo") === null) ?? "Vyloučené kusy kód nesníží"}>
        <Seg
          label="Slevové kódy"
          options={[
            { value: "off" as const, label: "Platí" },
            { value: "on" as const, label: "Vyloučit" },
          ]}
          value={flagValue("no_promo")}
          onSet={(next) => setFlags((prev) => ({ ...prev, no_promo: next === "on" }))}
        />
      </Radek>
    </Skupina>
  );

  const material_ = (
    <Skupina nazev="Materiál a rozměry">
      <Radek nazev="Materiál" zmeneno={material !== "__beze"} popis={material === "__none" ? "Všem se materiál smaže" : undefined}>
        <select
          aria-label="Materiál"
          value={material}
          onChange={(event) => setMaterial(event.target.value)}
          className={`${poleTrida(material !== "__beze")} max-w-[170px]`}
        >
          <option value="__beze">Beze změny</option>
          <option value="__none">Bez materiálu</option>
          {(materialsQuery.data?.materials ?? []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </Radek>
      <Radek nazev="Rozměry" zmeneno={Boolean(rozmery.trim())}>
        <input
          type="text"
          aria-label="Rozměry"
          placeholder="beze změny"
          value={rozmery}
          onChange={(event) => setRozmery(event.target.value)}
          className={`${poleTrida(Boolean(rozmery.trim()))} w-[170px]`}
        />
      </Radek>
      <Radek nazev="Mrazuvzdorné" zmeneno={flagNazev("frost_resistant")} popis={hint(flagValue("frost_resistant") === null) ?? "Vydrží mráz — štítek u výrobku"}>
        <Seg label="Mrazuvzdorné" options={ANO_NE} value={flagValue("frost_resistant")} onSet={(next) => setFlags((prev) => ({ ...prev, frost_resistant: next === "on" }))} />
      </Radek>
    </Skupina>
  );

  const slevy = (
    <Skupina nazev="Slevy" poznamka="Výprodej ruší vlastní slevu výrobku a na zlevněné kusy slevové kódy neplatí.">
      <Radek nazev="Výprodej" zmeneno={Boolean(vyprodejTarget)} popis={vyprodejTarget ? "Vybrané se přidají do výprodeje" : "Přidat do existujícího výprodeje"}>
        <div className="w-44 shrink-0">
          <Select value={vyprodejTarget ?? "__none__"} onValueChange={(value) => setVyprodejTarget(value === "__none__" ? null : value)}>
            <Select.Trigger>
              <Select.Value placeholder="Beze změny" />
            </Select.Trigger>
            <Select.Content className="z-[70]">
              <Select.Item value="__none__">Beze změny</Select.Item>
              {usableVyprodeje.map((item) => (
                <Select.Item key={item.id} value={item.id}>
                  {`${item.title} · −${item.percent} %${item.state === "off" ? " (vypnutý)" : ""}`}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </Radek>
      <Radek
        nazev="Sleva výrobku"
        zmeneno={saleKind !== "none"}
        popis={saleKind === "set" ? "Stejná sleva všem, od dneška" : saleKind === "remove" ? "Vlastní slevu vybraným zruší" : "Vlastní sleva (ne výprodej)"}
        pod={
          saleKind === "set" && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    aria-label="Sleva v procentech"
                    value={salePercent}
                    onChange={(event) => setSalePercent(event.target.value)}
                    className={`${poleTrida(true, !saleValid)} w-16 text-right tabular-nums`}
                  />
                  <Text size="small" className="text-ui-fg-muted">%</Text>
                </span>
                {QUICK.map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    aria-pressed={salePercentValue === quick}
                    onClick={() => setSalePercent(String(quick))}
                    className={clx(
                      "txt-compact-xsmall-plus min-h-[28px] rounded-full border px-2.5",
                      salePercentValue === quick ? "border-ui-border-interactive bg-ui-bg-base-pressed" : "border-ui-border-base hover:bg-ui-bg-base-hover"
                    )}
                  >
                    {quick} %
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2">
                <Text size="xsmall" className="text-ui-fg-subtle">Do (nepovinné)</Text>
                <Input type="date" size="small" className="w-40" value={saleTo} min={today()} onChange={(event) => setSaleTo(event.target.value)} />
              </label>
              {!saleValid && <Text size="xsmall" className="text-ui-fg-error">Zadejte celé číslo od 1 do 90.</Text>}
            </div>
          )
        }
      >
        <Seg
          label="Sleva"
          options={[
            { value: "none" as const, label: "Beze změny" },
            { value: "set" as const, label: "Nastavit" },
            { value: "remove" as const, label: "Zrušit" },
          ]}
          value={saleKind}
          onSet={(next) => setSaleKind(next as "none" | "set" | "remove")}
        />
      </Radek>
    </Skupina>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="bg-ui-bg-overlay absolute inset-0" aria-hidden onClick={zkusitZavrit} />
      <div
        ref={okno}
        role="dialog"
        aria-modal="true"
        aria-label={nazev}
        tabIndex={-1}
        className={clx(
          "bg-ui-bg-base shadow-elevation-flyout relative flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-xl outline-none",
          mode === "zarazeni" ? "max-w-[560px]" : "max-w-[920px]"
        )}
      >
        {/* Hlavička jako u nabídky „…" */}
        <div className="border-ui-border-base flex items-center justify-between gap-2 border-b px-4 py-3">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            {mode !== "zarazeni" && <NavodTip tema="produkty.hromadne" />}
            <span className="min-w-0">
              <Text size="small" weight="plus" className="block truncate">
                {nazev}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle block truncate" title={nazvy}>
                {nazvy}
              </Text>
            </span>
          </span>
          <IconButton size="small" variant="transparent" aria-label="Zavřít" onClick={zkusitZavrit}>
            ×
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {mode === "zarazeni" ? (
            zarazeni
          ) : (
            <div className="flex flex-col gap-4 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-4">
                  {ceník}
                  {doprava}
                </div>
                <div className="flex min-w-0 flex-col gap-4">
                  {prodej}
                  {material_}
                  {slevy}
                </div>
              </div>
              {/* Zařazení přes celou šířku — stejné tři kroky jako v Kolekce a kategorie. */}
              <section className="flex flex-col gap-1">
                <Text size="xsmall" weight="plus" className="text-ui-fg-muted px-1 uppercase tracking-wide">
                  Zařazení
                </Text>
                <div className="shadow-borders-base rounded-lg">{zarazeni}</div>
              </section>
            </div>
          )}
        </div>

        {/* Spodní lišta jako u nabídky „…" */}
        <div className="border-ui-border-base flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5">
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
            <Button size="small" variant="secondary" disabled={save.isPending} onClick={() => onOpenChange(false)}>
              {mode === "zarazeni" ? "Zrušit" : "Zrušit vše"}
            </Button>
            <Button size="small" disabled={!dirty} isLoading={save.isPending} onClick={() => save.mutate()}>
              {mode === "zarazeni" ? "Uložit" : dirty ? `Uložit vše (${changeCount})` : "Uložit vše"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
