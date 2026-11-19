import {
  ArchiveBox,
  ArrowUpRightOnBox,
  ArrowUturnLeft,
  ChartBar,
  EllipsisHorizontal,
  Eye,
  EyeSlash,
  PencilSquare,
  ReceiptPercent,
  SquareTwoStack,
  Swatch,
  Tools,
  Trash,
  TruckFast,
} from "@medusajs/icons";
import { IconButton, Popover, Switch, Text, toast } from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";
import { toastWithUndo } from "../lib/undo";
import { BundleEditor } from "./bundle-editor";
import { ConfirmDialog } from "./confirm-dialog";
import { ProductionProfileEditor } from "./production-profile-editor";
import { ShippingProfileEditor } from "./shipping-profile-editor";
import { VariantsEditor } from "./variants-editor";
import type { ShippingClass } from "../../lib/shipping-rates";

/**
 * „…" u řádku produktu — vedlejší akce kusu v nabídce (RowOptionsMenu).
 *
 * ## Proč nabídka, a ne okno (17. 11. 2026)
 *
 * Dřív tu bylo modální okno „Další nastavení" s přepínači a řadou tlačítek.
 * Matěj: nabídka „…" z Rozdělení je to, co chce vidět všude — jeden klik,
 * velké položky, mazání červeně za čarou. Okno navíc schovávalo i věci, které
 * se mění často (velikost zásilky); ta je teď u balného a dobírky v okénku
 * „Doprava" přímo v řádku.
 *
 * Každá položka buď něco hned udělá (skrýt, poškozený kus, slevové kódy,
 * archiv) a v hlášce nabídne „Vrátit zpět", nebo otevře svůj panel (varianty,
 * profil dopravy, zakázka) se svým Uložit. Nabídka se po kliknutí zavře, takže
 * se na tlačítko v hlášce dá kliknout — v modálním okně nešlo.
 *
 * ## Archiv není mazání (9. 11. 2026)
 *
 * - **Archivovat** kus schová, ale nechá ho. Vratné.
 * - **Smazat** ho odstraní z obchodu i ze všech seznamů. Nevratné, proto se
 *   ptá potvrzovacím dialogem se jménem kusu. Objednávky si svůj záznam
 *   nechávají — řádek objednávky má vlastní kopii názvu i ceny.
 *
 * ## Panely bez vlastního řízení
 *
 * Editory variant, zakázky, balíčku a profilu dopravy se otevírají jen přes
 * svůj `trigger`. Nabídka proto drží jejich skrytá spouštěcí tlačítka a klikne
 * na ně — editory zůstávají beze změny a fungují dál i odjinud.
 */

type FlagKey = "clearance" | "no_promo";

const FLAG_TEXT: Record<
  FlagKey,
  { onLabel: string; offLabel: string; on: string; off: string }
> = {
  clearance: {
    onLabel: "Označit jako poškozený kus",
    offLabel: "Už to není poškozený kus",
    on: "Označeno jako poškozený kus — najdete ho v záložce Poškozené.",
    off: "Už to není poškozený kus — vrátil se mezi běžné produkty.",
  },
  no_promo: {
    onLabel: "Vyloučit ze slevových kódů",
    offLabel: "Povolit slevové kódy",
    on: "Na produkt už slevové kódy neplatí.",
    off: "Na produkt zase platí slevové kódy.",
  },
};

/**
 * Velikost zásilky (16. 11. 2026) — podle ní pokladna počítá poštovné.
 * Hodnoty jsou ty z `lib/shipping-rates` (typ se sdílí, kód ne: admin je
 * balík pro prohlížeč). Čte je i detail produktu a okénko Doprava v Produkty+.
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
  onEditShipping,
  showVariants = true,
  commission = null,
  bundleId = null,
  showShipping,
  showArchive,
  showDelete,
  storeUrl,
  showVisibility,
  expanded,
  onToggleExpand,
}: {
  product: {
    id: string;
    title: string;
    status: string;
    archived: boolean;
    fragile: boolean;
    packaging_price: number | null;
  };
  /** Příznaky, které nabídka nabídne — s hodnotou, jakou vidí řádek. */
  flags: Partial<Record<FlagKey, boolean>>;
  /** Po uložení příznaku — řádek zahodí jeho rozpracovanou hodnotu. */
  onFlagSaved?: (key: FlagKey) => void;
  /** Otevře okénko Doprava v řádku; bez něj se položka neukáže. */
  onEditShipping?: () => void;
  showVariants?: boolean;
  /** „terms" = podmínky zakázky, „make" = udělat z kusu zakázku. */
  commission?: "terms" | "make" | null;
  /** Balíček, jehož složení se dá upravit. */
  bundleId?: string | null;
  showShipping: boolean;
  showArchive: boolean;
  showDelete?: boolean;
  /** Odkaz „Otevřít v obchodě“. */
  storeUrl?: string | null;
  /** „Skrýt z obchodu" / „Zobrazit v obchodě". */
  showVisibility?: boolean;
  /** Jestli jsou pod řádkem rozbalené podrobnosti (prodeje, hodnocení). */
  expanded?: boolean;
  /** Rozbalí / sbalí podrobnosti pod řádkem; bez něj se položka neukáže. */
  onToggleExpand?: () => void;
}) => {
  const queryClient = useQueryClient();
  const [ptaSeNaSmazani, setPtaSeNaSmazani] = useState(false);
  /* Nabídka zůstává otevřená; vybrané nastavení se otevře VLEVO vedle ní
     (19. 11. 2026, Matěj — dřív okno po výběru hned zase zmizelo). */
  type PanelKey = "variants" | "commission" | "bundle" | "profile";
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const zavritVse = () => {
    setPanel(null);
    setMenuOpen(false);
  };

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
    onSuccess: async (_result, { key, value }) => {
      onFlagSaved?.(key);
      await refresh();
      toastWithUndo(
        value ? FLAG_TEXT[key].on : FLAG_TEXT[key].off,
        `${value ? FLAG_TEXT[key].onLabel : FLAG_TEXT[key].offLabel} — ${product.title}`,
        async () => {
          await writeFlags({ [key]: !value });
          await refresh();
        }
      );
    },
    onError: (error) => toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  /* Viditelnost v obchodě = stav produktu (zveřejněný / koncept). Vrácení
     vrátí přesně ten stav, který kus měl předtím. */
  const visible = product.status === "published";
  const saveVisibility = useMutation({
    mutationFn: ({ next }: { next: boolean; previousStatus: string }) =>
      sdk.client.fetch(`/admin/products/${product.id}`, {
        method: "POST",
        body: { status: next ? "published" : "draft" },
      }),
    onSuccess: async (_result, { next, previousStatus }) => {
      await refresh();
      toastWithUndo(
        next
          ? "Zobrazeno v obchodě — zákazníci ho teď uvidí a mohou koupit."
          : "Skryto z obchodu — zákazníci ho neuvidí, dokud ho zase nezobrazíte.",
        `${next ? "Zobrazení" : "Skrytí"} v obchodě — ${product.title}`,
        async () => {
          await sdk.client.fetch(`/admin/products/${product.id}`, {
            method: "POST",
            body: { status: previousStatus },
          });
          await refresh();
        }
      );
    },
    onError: (error) => toast.error(ceskaChyba(error, "Změna se nepodařila.")),
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

  /* Mazání se nevrací — proto žádné „Vrátit zpět", jen potvrzení předem. */
  const smazat = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/products/${product.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setPtaSeNaSmazani(false);
      await refresh();
      toast.success(`${product.title} smazán.`);
    },
    onError: (error) => toast.error(ceskaChyba(error, "Smazání se nepodařilo.")),
  });

  const flagKeys = (Object.keys(flags) as FlagKey[]).filter(
    (key) => flags[key] !== undefined
  );

  type Volba = {
    klic: string;
    ikona: ReactNode;
    nazev: string;
    popis: string;
    /** Otevře nastavení vlevo vedle nabídky. */
    panel?: PanelKey;
    /** Přepínač — ukazuje stav, přepne se na místě, nabídka zůstane. */
    zapnuto?: boolean;
    /** Akce, po které se nabídka zavře. */
    akce?: () => void;
    nebezpecne?: boolean;
  };
  const skupiny: { nadpis: string; volby: Volba[] }[] = [
    {
      nadpis: "Upravit",
      volby: [
        ...(onEditShipping
          ? [{ klic: "doprava", ikona: <TruckFast />, nazev: "Doprava a balné", popis: "Velikost zásilky, balné, křehké, dobírka", akce: onEditShipping }]
          : []),
        ...(showVariants
          ? [{ klic: "variants", ikona: <Swatch />, nazev: "Ceny a provedení", popis: "Cena, sklad, velikosti a barvy", panel: "variants" as const }]
          : []),
        ...(commission === "terms"
          ? [{ klic: "commission", ikona: <Tools />, nazev: "Podmínky zakázky", popis: "Záloha a doba výroby", panel: "commission" as const }]
          : []),
        ...(bundleId
          ? [{ klic: "bundle", ikona: <SquareTwoStack />, nazev: "Složení balíčku", popis: "Které výrobky balíček obsahuje", panel: "bundle" as const }]
          : []),
        ...(onToggleExpand
          ? [{ klic: "expand", ikona: <ChartBar />, nazev: expanded ? "Skrýt prodeje a hodnocení" : "Prodeje a hodnocení", popis: "Graf prodejů po měsících pod řádkem", akce: onToggleExpand }]
          : []),
      ],
    },
    {
      nadpis: "V obchodě",
      volby: [
        ...(showVisibility
          ? [{
              klic: "visible",
              ikona: visible ? <EyeSlash /> : <Eye />,
              nazev: visible ? "Skrýt z obchodu" : "Zobrazit v obchodě",
              popis: visible ? "Zákazníci ho přestanou vidět" : "Zákazníci ho uvidí a mohou koupit",
              akce: () => saveVisibility.mutate({ next: !visible, previousStatus: product.status }),
            }]
          : []),
        ...(storeUrl
          ? [{ klic: "store", ikona: <ArrowUpRightOnBox />, nazev: "Otevřít v obchodě", popis: "Stránka výrobku na webu (nové okno)", akce: () => window.open(storeUrl, "_blank", "noopener") }]
          : []),
      ],
    },
    {
      nadpis: "Nastavení výrobku",
      volby: [
        ...flagKeys.map((key) => ({
          klic: key,
          ikona: key === "no_promo" ? <ReceiptPercent /> : <PencilSquare />,
          nazev: key === "no_promo" ? "Bez slevových kódů" : "Poškozený kus",
          popis: key === "no_promo" ? "Slevové kódy z pokladny na něj neplatí" : "Prodává se levněji; po prodeji se skryje",
          zapnuto: Boolean(flags[key]),
        })),
        ...(showShipping
          ? [{ klic: "profile", ikona: <TruckFast />, nazev: "Povolené dopravy", popis: "Profil dopravy — pokročilé, mění se zřídka", panel: "profile" as const }]
          : []),
        ...(commission === "make"
          ? [{ klic: "commission-make", ikona: <Tools />, nazev: "Udělat z něj zakázku", popis: "Vyrábí se až po objednání, se zálohou", panel: "commission" as const }]
          : []),
      ],
    },
    {
      nadpis: "Archiv a mazání",
      volby: [
        ...(showArchive
          ? [{
              klic: "archive",
              ikona: archiving ? <ArchiveBox /> : <ArrowUturnLeft />,
              nazev: archiving ? "Archivovat" : "Obnovit z archivu",
              popis: archiving ? "Zmizí z obchodu i ze seznamů, historie zůstane" : "Vrátí se jako skrytý koncept",
              akce: () => archive.mutate(),
            }]
          : []),
        ...(showDelete !== false
          ? [{ klic: "delete", ikona: <Trash />, nazev: "Smazat…", popis: "Natrvalo — zeptám se ještě jednou", akce: () => setPtaSeNaSmazani(true), nebezpecne: true }]
          : []),
      ],
    },
  ].filter((skupina) => skupina.volby.length > 0);

  const vybrat = (volba: Volba) => {
    if (volba.panel) {
      setPanel((ted) => (ted === volba.panel ? null : volba.panel!));
      return;
    }
    if (volba.zapnuto !== undefined) {
      saveFlag.mutate({ key: volba.klic as FlagKey, value: !volba.zapnuto });
      return;
    }
    zavritVse();
    /* Až po zavření nabídky — okénko dopravy v řádku a potvrzení mazání
       si berou fokus a zavírající se nabídka by jim ho vzala. */
    window.setTimeout(() => volba.akce?.(), 0);
  };

  const panelEl =
    panel === "variants" ? (
      <VariantsEditor inline onClose={() => setPanel(null)} productId={product.id} productTitle={product.title} />
    ) : panel === "commission" ? (
      <ProductionProfileEditor inline onClose={() => setPanel(null)} productId={product.id} productTitle={product.title} />
    ) : panel === "bundle" && bundleId ? (
      <BundleEditor inline onClose={() => setPanel(null)} bundleId={bundleId} />
    ) : panel === "profile" ? (
      <ShippingProfileEditor
        inline
        onClose={() => setPanel(null)}
        productId={product.id}
        productTitle={product.title}
        fragile={product.fragile}
        packagingPrice={product.packaging_price}
      />
    ) : null;

  return (
    <>
      <Popover
        open={menuOpen}
        onOpenChange={(next) => {
          if (!next) setPanel(null);
          setMenuOpen(next);
        }}
      >
        <Popover.Trigger asChild>
          <IconButton
            type="button"
            variant="transparent"
            size="large"
            aria-label={`Možnosti produktu ${product.title}`}
            title="Další možnosti"
            className="shrink-0"
          >
            <EllipsisHorizontal />
          </IconButton>
        </Popover.Trigger>
        <Popover.Content
          align="end"
          side="bottom"
          sideOffset={4}
          collisionPadding={12}
          className="z-50 flex max-w-[calc(100vw-24px)] items-stretch overflow-hidden p-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            /* Výběry, potvrzení a hlášky okna vlevo se kreslí mimo nabídku
               (portály) — klik do nich nabídku nezavírá. */
            const cil = event.target as HTMLElement | null;
            if (cil?.closest?.("[data-radix-popper-content-wrapper], [role=listbox], [role=dialog], [role=alertdialog], [data-sonner-toaster], [data-navod-velky]")) {
              event.preventDefault();
            }
          }}
        >
          {panelEl && <div className="border-ui-border-base flex border-r">{panelEl}</div>}
          <div className="flex max-h-[min(78vh,720px)] w-[280px] shrink-0 flex-col overflow-y-auto py-1" role="menu" aria-label={`Možnosti produktu ${product.title}`}>
            {skupiny.map((skupina, index) => (
              <div key={skupina.nadpis} className={index > 0 ? "border-ui-border-base border-t pt-1" : ""}>
                <Text size="xsmall" weight="plus" className="text-ui-fg-muted px-3 pb-1 pt-2 uppercase tracking-wide">
                  {skupina.nadpis}
                </Text>
                {skupina.volby.map((volba) => {
                  const aktivni = volba.panel !== undefined && panel === volba.panel;
                  return (
                    <button
                      key={volba.klic}
                      type="button"
                      role={volba.zapnuto !== undefined ? "menuitemcheckbox" : "menuitem"}
                      aria-checked={volba.zapnuto}
                      aria-expanded={volba.panel ? aktivni : undefined}
                      disabled={volba.zapnuto !== undefined && saveFlag.isPending}
                      onClick={() => vybrat(volba)}
                      className={`flex w-full items-start gap-3 px-3 py-2 text-left transition-colors disabled:opacity-60 ${
                        aktivni ? "bg-ui-bg-base-pressed" : "hover:bg-ui-bg-base-hover"
                      }`}
                    >
                      <span className={`mt-0.5 shrink-0 ${volba.nebezpecne ? "text-ui-fg-error" : "text-ui-fg-subtle"}`}>{volba.ikona}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`txt-compact-small-plus block ${volba.nebezpecne ? "text-ui-fg-error" : "text-ui-fg-base"}`}>
                          {volba.nazev}
                          {volba.panel ? <span className="text-ui-fg-muted"> {aktivni ? "‹" : "›"}</span> : null}
                        </span>
                        <span className="txt-compact-xsmall text-ui-fg-subtle block">{volba.popis}</span>
                      </span>
                      {volba.zapnuto !== undefined && (
                        <Switch size="small" checked={volba.zapnuto} tabIndex={-1} aria-hidden className="pointer-events-none mt-0.5 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover>

      <ConfirmDialog
        open={ptaSeNaSmazani}
        onOpenChange={setPtaSeNaSmazani}
        title="Smazat tenhle kus natrvalo?"
        description={product.title}
        consequence="Kus zmizí z obchodu i ze všech seznamů včetně archivu a zpátky už ho nevrátíte. Objednávky, ve kterých už je, si svůj záznam nechají — faktury zůstanou celé."
        confirmLabel="Smazat natrvalo"
        isPending={smazat.isPending}
        onConfirm={(event) => {
          // Dialog zůstane otevřený, dokud mazání nedoběhne.
          event.preventDefault();
          smazat.mutate();
        }}
      />
    </>
  );
};
