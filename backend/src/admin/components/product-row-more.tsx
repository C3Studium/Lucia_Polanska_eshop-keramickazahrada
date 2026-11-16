import { Button, Prompt, Switch, Text, toast } from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";
import { pushUndo, toastWithUndo } from "../lib/undo";
import { ProductionProfileEditor } from "./production-profile-editor";
import { ShippingProfileEditor } from "./shipping-profile-editor";
import type { ShippingClass } from "../../lib/shipping-rates";

/**
 * „…" u řádku produktu — malé okno se vzácnými nastaveními kusu.
 *
 * Matěj 3. 11. 2026: „to hlavní tam nech jako balné atd., ale to vedlejší dej
 * opět do … a to otevře malé okno". V řádku zůstává, co se mění často
 * (balné, dobírka, křehké, viditelnost); sem patří, na co se sahá jednou za
 * čas: poškozený kus, slevové kódy, velikost zásilky, profil dopravy,
 * zakázka, archiv.
 *
 * Všechno v tomhle okně se ukládá HNED a dá se vrátit („Vrátit zpět" /
 * Ctrl+Z) — jeden způsob pro celé okno, žádné „Uložit" navíc. Profil dopravy a zakázka
 * otevírají své vlastní panely se svým Uložit, stejně jako dřív z řádku.
 *
 * ## Archiv není mazání (9. 11. 2026)
 *
 * Matěj: „když ho smažu, tak tam zůstane". Nezůstával — nebylo ho čím smazat.
 * Produkty+ uměly jen archivovat, a archivovaný kus v Archivovaných z principu
 * leží dál. Mazání tedy chybělo, ne selhávalo.
 *
 * Teď je tu obojí vedle sebe a liší se tím, co drží:
 * - **Archivovat** kus schová, ale nechá ho. Vratné.
 * - **Smazat** ho odstraní z obchodu i ze všech seznamů. Nevratné.
 *
 * Měřeno na nanečisto založeném kusu (9. 11. 2026): po smazání zmizí
 * i ze záložky Archivované a jeho adresa se uvolní, takže kus stejného
 * jména jde založit znovu. Objednávky si svůj záznam nechávají — řádek
 * objednávky má vlastní kopii názvu i ceny, takže faktury zůstanou celé.
 *
 * Ptá se dvěma kroky uvnitř okna, ne dalším vyskakovacím dialogem: okno je
 * modální a dialog nad dialogem je na ovládání i na čtení horší než
 * potvrzovací řádek na místě. Jméno kusu stojí v hlavičce okna.
 */

type FlagKey = "clearance" | "no_promo";

const FLAG_TEXT: Record<FlagKey, { label: string; hint: string; on: string; off: string }> = {
  clearance: {
    label: "Poškozený kus",
    hint: "Jeden kus s vadou, prodává se zvlášť se slevou. Po prodeji se sám schová.",
    on: "Označeno jako poškozený kus — najdete ho v záložce Poškozené.",
    off: "Už to není poškozený kus — vrátil se mezi běžné produkty.",
  },
  no_promo: {
    label: "Bez slevových kódů",
    hint: "Slevové kódy se na tento produkt nevztahují.",
    on: "Na produkt už slevové kódy neplatí.",
    off: "Na produkt zase platí slevové kódy.",
  },
};

/**
 * Velikost zásilky (16. 11. 2026) — podle ní pokladna počítá poštovné.
 * Hodnoty jsou ty z `lib/shipping-rates` (typ se sdílí, kód ne: admin je
 * balík pro prohlížeč). Čte je i řádek a lišta výběru v Produkty+.
 */
export const SHIPPING_CLASS_OPTIONS: { value: ShippingClass; label: string; hint: string }[] = [
  { value: "male", label: "Malé", hint: "Vejde se do malé zásilky." },
  { value: "velke", label: "Velké", hint: "Celá zásilka s tímto kusem pojede jako velká." },
  { value: "poukaz", label: "Poukaz", hint: "Tištěný poukaz — vlastní cena poštovného." },
];

export const shippingClassLabel = (value: ShippingClass) =>
  SHIPPING_CLASS_OPTIONS.find((option) => option.value === value)?.label ?? value;

export const ProductRowMore = ({
  product,
  flags,
  onFlagSaved,
  shippingClass,
  onShippingClassSaved,
  showShipping,
  showMakeCommission,
  showArchive,
  showDelete,
  storeUrl,
  trigger,
}: {
  product: {
    id: string;
    title: string;
    status: string;
    archived: boolean;
    fragile: boolean;
    packaging_price: number | null;
  };
  /** Přepínače, které okno ukáže — s hodnotou, jakou vidí řádek. */
  flags: Partial<Record<FlagKey, boolean>>;
  /** Po uložení přepínače — řádek zahodí jeho rozpracovanou hodnotu. */
  onFlagSaved?: (key: FlagKey) => void;
  /** Velikost zásilky, jak ji vidí řádek. Bez hodnoty se volba neukáže. */
  shippingClass?: ShippingClass;
  /** Po uložení velikosti — řádek zahodí její rozpracovanou hodnotu. */
  onShippingClassSaved?: () => void;
  showShipping: boolean;
  showMakeCommission: boolean;
  showArchive: boolean;
  showDelete?: boolean;
  /** Odkaz „Otevřít v obchodě“ (dřív holá ikona v řádku, 14. 11. 2026). */
  storeUrl?: string | null;
  trigger: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  /* Hodnota hned po kliknutí, než se seznam načte znovu. */
  const [local, setLocal] = useState<Partial<Record<FlagKey, boolean>>>({});
  const [localClass, setLocalClass] = useState<ShippingClass | null>(null);
  /* Druhý krok mazání — ptá se tady, ne dalším dialogem nad dialogem. */
  const [ptaSeNaSmazani, setPtaSeNaSmazani] = useState(false);
  useEffect(() => {
    if (open) {
      setLocal({});
      setLocalClass(null);
      setPtaSeNaSmazani(false);
    }
  }, [open]);
  const queryClient = useQueryClient();

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
    await queryClient.invalidateQueries({ queryKey: ["operations-products"] });
    await queryClient.invalidateQueries({ queryKey: ["packaging-products"] });
  };

  const writeFlags = (body: Record<string, unknown>) =>
    sdk.client.fetch(`/admin/workbench/products/${product.id}/flags`, {
      method: "POST",
      body,
    });

  const saveFlag = useMutation({
    mutationFn: ({ key, value }: { key: FlagKey; value: boolean }) =>
      writeFlags({ [key]: value }),
    onMutate: ({ key, value }) => setLocal((previous) => ({ ...previous, [key]: value })),
    onSuccess: async (_result, { key, value }) => {
      onFlagSaved?.(key);
      await refresh();
      /* Bez tlačítka v toastu: otevřené okno je modální a na toast se nedá
         kliknout. Vrací se přepínačem zpátky, po zavření i „Vrátit zpět"
         v hlavičce stránky nebo Ctrl+Z. */
      pushUndo(`${FLAG_TEXT[key].label} — ${product.title}`, async () => {
        await writeFlags({ [key]: !value });
        await refresh();
      });
      toast.success(value ? FLAG_TEXT[key].on : FLAG_TEXT[key].off);
    },
    onError: (error, { key }) => {
      setLocal((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      toast.error(ceskaChyba(error, "Uložení se nepodařilo."));
    },
  });

  /* Velikost zásilky — ukládá se hned jako přepínače výš, vrací se volbou
     zpátky nebo „Vrátit zpět" / Ctrl+Z po zavření okna. */
  const saveClass = useMutation({
    mutationFn: ({ value }: { value: ShippingClass; previous: ShippingClass }) =>
      writeFlags({ shipping_class: value }),
    onMutate: ({ value }) => setLocalClass(value),
    onSuccess: async (_result, { value, previous }) => {
      onShippingClassSaved?.();
      await refresh();
      pushUndo(`Velikost zásilky — ${product.title}`, async () => {
        await writeFlags({ shipping_class: previous });
        await refresh();
      });
      toast.success(`Velikost zásilky: ${shippingClassLabel(value)}.`);
    },
    onError: (error) => {
      setLocalClass(null);
      toast.error(ceskaChyba(error, "Uložení se nepodařilo."));
    },
  });
  const currentClass = localClass ?? shippingClass;

  /*
   * Archivace = příznak (zmizí ze seznamů) + koncept (zmizí z obchodu), stejně
   * jako components/archive-toggle. Obnovení nechává kus jako koncept, do
   * obchodu se vrací až zveřejněním. Vrácení vrátí i původní stav zveřejnění.
   */
  const archiving = !product.archived;
  const archive = useMutation({
    mutationFn: async () => {
      await writeFlags({ archived: archiving });
      if (archiving && product.status !== "draft") {
        await sdk.client.fetch(`/admin/products/${product.id}`, {
          method: "POST",
          body: { status: "draft" },
        });
      }
    },
    onSuccess: async () => {
      setOpen(false);
      await refresh();
      const previousStatus = product.status;
      toastWithUndo(
        archiving
          ? `${product.title} archivován — zmizel z obchodu i ze seznamů.`
          : `${product.title} obnoven jako koncept. Do obchodu ho vrátíte zveřejněním.`,
        archiving ? `Archivace — ${product.title}` : `Obnovení — ${product.title}`,
        async () => {
          await writeFlags({ archived: !archiving });
          if (archiving && previousStatus !== "draft") {
            await sdk.client.fetch(`/admin/products/${product.id}`, {
              method: "POST",
              body: { status: previousStatus },
            });
          }
          await refresh();
        }
      );
    },
    onError: (error) => toast.error(ceskaChyba(error, "Změna se nepodařila.")),
  });

  /*
   * Mazání se nevrací. Proto žádné `toastWithUndo` jako u archivace — toast
   * s tlačítkem, které nic neumí, je horší než žádný.
   */
  const smazat = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/products/${product.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setOpen(false);
      await refresh();
      toast.success(`${product.title} smazán.`);
    },
    onError: (error) => toast.error(ceskaChyba(error, "Smazání se nepodařilo.")),
  });

  const flagKeys = (Object.keys(flags) as FlagKey[]).filter(
    (key) => flags[key] !== undefined
  );

  return (
    <Prompt open={open} onOpenChange={setOpen} variant="confirmation">
      <Prompt.Trigger asChild>{trigger}</Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Další nastavení</Prompt.Title>
          <Prompt.Description>{product.title}</Prompt.Description>
        </Prompt.Header>

        <div className="flex flex-col gap-y-4 px-6 pt-4">
          {flagKeys.map((key) => (
            <label key={key} className="flex cursor-pointer items-start justify-between gap-4">
              <span>
                <Text size="small" weight="plus">
                  {FLAG_TEXT[key].label}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {FLAG_TEXT[key].hint}
                </Text>
              </span>
              <Switch
                className="mt-0.5 shrink-0"
                checked={local[key] ?? Boolean(flags[key])}
                disabled={saveFlag.isPending}
                onCheckedChange={(value) => saveFlag.mutate({ key, value })}
              />
            </label>
          ))}

          {currentClass && (
            <div
              className={`flex flex-col gap-y-2 ${flagKeys.length ? "border-ui-border-base border-t pt-4" : ""}`}
            >
              <span>
                <Text size="small" weight="plus">
                  Velikost zásilky
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Podle ní se v pokladně počítá poštovné.
                </Text>
              </span>
              <div role="radiogroup" aria-label="Velikost zásilky" className="grid grid-cols-3 gap-2">
                {SHIPPING_CLASS_OPTIONS.map((option) => {
                  const active = option.value === currentClass;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={option.hint}
                      disabled={saveClass.isPending}
                      onClick={() => {
                        if (!active) saveClass.mutate({ value: option.value, previous: currentClass });
                      }}
                      className={`txt-compact-small min-h-[40px] rounded-lg border px-3 py-2 outline-none transition-fg focus-visible:shadow-borders-focus disabled:cursor-wait ${
                        active
                          ? "border-ui-border-interactive bg-ui-bg-base-pressed text-ui-fg-base font-medium"
                          : "border-ui-border-base bg-ui-bg-base text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(showShipping || showMakeCommission || showArchive || storeUrl) && (
            <div
              className={`flex flex-col gap-y-2 ${flagKeys.length || currentClass ? "border-ui-border-base border-t pt-4" : ""}`}
            >
              {storeUrl && (
                <Button size="small" variant="secondary" className="justify-start" asChild>
                  <a href={storeUrl} target="_blank" rel="noreferrer">
                    Otevřít v obchodě ↗
                  </a>
                </Button>
              )}
              {showShipping && (
                <ShippingProfileEditor
                  productId={product.id}
                  productTitle={product.title}
                  fragile={product.fragile}
                  packagingPrice={product.packaging_price}
                  trigger={
                    <Button size="small" variant="secondary" className="justify-start">
                      Profil dopravy…
                    </Button>
                  }
                />
              )}
              {showMakeCommission && (
                <ProductionProfileEditor
                  productId={product.id}
                  productTitle={product.title}
                  trigger={
                    <Button size="small" variant="secondary" className="justify-start">
                      Nastavit jako zakázku…
                    </Button>
                  }
                />
              )}
              {showArchive && (
                <Button
                  size="small"
                  variant="secondary"
                  className="justify-start"
                  isLoading={archive.isPending}
                  onClick={() => archive.mutate()}
                >
                  {archiving ? "Archivovat (zmizí z obchodu i ze seznamů)" : "Obnovit z archivu"}
                </Button>
              )}
            </div>
          )}

          {showDelete !== false && (
            <div className="border-ui-border-base flex flex-col gap-y-2 border-t pt-4">
              {ptaSeNaSmazani ? (
                <>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Smazat natrvalo? Kus zmizí z obchodu i ze všech seznamů
                    včetně archivu a zpátky už ho nevrátíte. Objednávky, ve
                    kterých už je, si svůj záznam nechají — faktury zůstanou
                    celé.
                  </Text>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="small"
                      variant="danger"
                      isLoading={smazat.isPending}
                      onClick={() => smazat.mutate()}
                    >
                      Smazat natrvalo
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      disabled={smazat.isPending}
                      onClick={() => setPtaSeNaSmazani(false)}
                    >
                      Nechat
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button
                    size="small"
                    variant="danger"
                    className="justify-start"
                    onClick={() => setPtaSeNaSmazani(true)}
                  >
                    Smazat produkt…
                  </Button>
                  {showArchive && archiving && (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Archiv kus jen schová a jde vrátit. Mazání ne.
                    </Text>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <Prompt.Footer>
          <Text size="xsmall" className="text-ui-fg-muted mr-auto">
            Změny se ukládají hned.
          </Text>
          <Prompt.Cancel>Zavřít</Prompt.Cancel>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};
