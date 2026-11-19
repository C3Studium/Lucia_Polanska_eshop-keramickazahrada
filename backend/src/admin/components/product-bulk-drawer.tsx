import { Badge, Button, Drawer, Text, clx, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ceskaChyba } from "../lib/ceska-chyba";
import { sdk } from "../lib/sdk";
import {
  applyBulkClassification,
  BulkClassification,
  bulkClassificationDirty,
  emptyBulkClassification,
  type BulkClassificationDraft,
} from "./product-classification";
import { InspectorGroup, InspectorRow } from "./product-inspector";

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
  shipping_class: "male" | "velke" | "poukaz";
  collection_id: string | null;
  category_refs?: { id: string; name: string }[];
};

type FlagDraft = {
  cod_allowed?: boolean;
  fragile?: boolean;
  clearance?: boolean;
  no_promo?: boolean;
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
}: {
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

  /* Při každém otevření načisto. */
  useEffect(() => {
    if (!open) return;
    setFlags({});
    setClassification(emptyBulkClassification());
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
  const flagValue = (key: "cod_allowed" | "fragile" | "clearance" | "no_promo") => {
    if (flags[key] !== undefined) return flags[key] ? "on" : "off";
    const value = shared(products, (product) => product[key]);
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

  const flagKeys = Object.keys(flags) as (keyof FlagDraft)[];
  const changeCount =
    flagKeys.length + (balneChanged ? 1 : 0) + (bulkClassificationDirty(classification) ? 1 : 0);
  const dirty = changeCount > 0;
  const hint = (mixed: boolean) => (mixed ? "U vybraných se liší — klikem nastavíte všem." : undefined);

  const save = useMutation({
    mutationFn: async () => {
      const { status, ...rest } = flags;
      const flagBody: Record<string, unknown> = { ...rest, ...(balneChanged ? { packaging_price: balneValue } : {}) };
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
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workbench-products"] }),
        queryClient.invalidateQueries({ queryKey: ["workbench-products-all"] }),
        queryClient.invalidateQueries({ queryKey: ["operations-products"] }),
        queryClient.invalidateQueries({ queryKey: ["rozdeleni-collections"] }),
      ]);
      toast.success(`Uloženo u ${total} ${total === 1 ? "výrobku" : "výrobků"}.`);
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
          <Drawer.Title>{`Hromadné změny — ${total} ${pocet(total)}`}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col overflow-y-auto p-0">
          <Text size="xsmall" className="text-ui-fg-subtle px-6 pt-4">
            {products.slice(0, 4).map((product) => product.title).join(", ")}
            {total > 4 ? ` a dalších ${total - 4}` : ""}
          </Text>

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

          <InspectorGroup
            title="Zařazení"
            note="× odebere kategorii všem vybraným, + Kategorie ji přidá všem. Číslo 2/3 = kolika vybraných se týká."
          >
            <BulkClassification
              products={products.map((product) => ({
                id: product.id,
                collection_id: product.collection_id,
                category_ids: (product.category_refs ?? []).map((category) => category.id),
              }))}
              collections={collectionsQuery.data?.collections ?? []}
              categories={categories}
              draft={classification}
              onChange={setClassification}
            />
          </InspectorGroup>
        </Drawer.Body>
        <Drawer.Footer className="flex items-center justify-between gap-2">
          <Text size="xsmall" className="text-ui-fg-subtle">
            {dirty ? (
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
                Zrušit
              </Button>
            </Drawer.Close>
            <Button size="small" disabled={!dirty} isLoading={save.isPending} onClick={() => save.mutate()}>
              {`Uložit vše (${total})`}
            </Button>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
