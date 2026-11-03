import { Button, Prompt, Switch, Text, toast } from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";
import { pushUndo, toastWithUndo } from "../lib/undo";
import { ProductionProfileEditor } from "./production-profile-editor";
import { ShippingProfileEditor } from "./shipping-profile-editor";

/**
 * „…" u řádku produktu — malé okno se vzácnými nastaveními kusu.
 *
 * Matěj 3. 11. 2026: „to hlavní tam nech jako balné atd., ale to vedlejší dej
 * opět do … a to otevře malé okno". V řádku zůstává, co se mění často
 * (balné, dobírka, křehké, viditelnost); sem patří, na co se sahá jednou za
 * čas: poškozený kus, slevové kódy, profil dopravy, zakázka, archiv.
 *
 * Všechno v tomhle okně se ukládá HNED a dá se vrátit („Vrátit zpět" /
 * Ctrl+Z) — jeden způsob pro celé okno, žádné „Uložit" navíc. Profil dopravy a zakázka
 * otevírají své vlastní panely se svým Uložit, stejně jako dřív z řádku.
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

export const ProductRowMore = ({
  product,
  flags,
  onFlagSaved,
  showShipping,
  showMakeCommission,
  showArchive,
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
  showShipping: boolean;
  showMakeCommission: boolean;
  showArchive: boolean;
  trigger: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  /* Hodnota hned po kliknutí, než se seznam načte znovu. */
  const [local, setLocal] = useState<Partial<Record<FlagKey, boolean>>>({});
  useEffect(() => {
    if (open) setLocal({});
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

          {(showShipping || showMakeCommission || showArchive) && (
            <div
              className={`flex flex-col gap-y-2 ${flagKeys.length ? "border-ui-border-base border-t pt-4" : ""}`}
            >
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
