import {
  ArchiveBox,
  ArrowUpRightOnBox,
  ArrowUturnLeft,
  ChartBar,
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
import { toast } from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type RefObject } from "react";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";
import { toastWithUndo } from "../lib/undo";
import { BundleEditor } from "./bundle-editor";
import { ConfirmDialog } from "./confirm-dialog";
import { ProductionProfileEditor } from "./production-profile-editor";
import { RowOptionsMenu, type RowOption } from "./row-options-menu";
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

/** Skryté spouštěcí tlačítko panelu — klikne na něj nabídka. */
const HiddenTrigger = ({
  buttonRef,
}: {
  buttonRef: RefObject<HTMLButtonElement>;
}) => (
  <button
    ref={buttonRef}
    type="button"
    tabIndex={-1}
    aria-hidden="true"
    className="sr-only"
  />
);

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
  const variantsRef = useRef<HTMLButtonElement>(null);
  const commissionRef = useRef<HTMLButtonElement>(null);
  const bundleRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLButtonElement>(null);

  /* Panely se připojí až při prvním otevření — dvě stě řádků po čtyřech
     panelech by jinak držely osm set spících dialogů. Po připojení se
     klikne na jejich spouštěč (až po vykreslení, proto efekt). */
  type PanelKey = "variants" | "commission" | "bundle" | "profile";
  const [mounted, setMounted] = useState<Set<PanelKey>>(new Set());
  const [toOpen, setToOpen] = useState<PanelKey | null>(null);
  const openPanel = (key: PanelKey) => {
    setMounted((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    setToOpen(key);
  };
  useEffect(() => {
    if (!toOpen) return;
    const refs = {
      variants: variantsRef,
      commission: commissionRef,
      bundle: bundleRef,
      profile: profileRef,
    };
    refs[toOpen].current?.click();
    setToOpen(null);
  }, [toOpen, mounted]);

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

  /* Pořadí: úpravy kusu → co je vidět → vzácná nastavení → archiv a mazání. */
  const edits: RowOption[] = [
    ...(onEditShipping
      ? [
          {
            label: "Upravit balné a dopravu",
            icon: <TruckFast />,
            takesFocus: true,
            onSelect: onEditShipping,
          },
        ]
      : []),
    ...(showVariants
      ? [
          {
            label: "Varianty a ceny",
            icon: <Swatch />,
            takesFocus: true,
            onSelect: () => openPanel("variants"),
          },
        ]
      : []),
    ...(commission === "terms"
      ? [
          {
            label: "Podmínky zakázky",
            icon: <Tools />,
            takesFocus: true,
            onSelect: () => openPanel("commission"),
          },
        ]
      : []),
    ...(bundleId
      ? [
          {
            label: "Složení balíčku",
            icon: <SquareTwoStack />,
            takesFocus: true,
            onSelect: () => openPanel("bundle"),
          },
        ]
      : []),
    ...(onToggleExpand
      ? [
          {
            label: expanded ? "Skrýt prodeje a hodnocení" : "Prodeje po měsících a hodnocení",
            icon: <ChartBar />,
            onSelect: onToggleExpand,
          },
        ]
      : []),
  ];

  const shop: RowOption[] = [
    ...(showVisibility
      ? [
          {
            label: visible ? "Skrýt z obchodu" : "Zobrazit v obchodě",
            icon: visible ? <EyeSlash /> : <Eye />,
            onSelect: () =>
              saveVisibility.mutate({ next: !visible, previousStatus: product.status }),
          },
        ]
      : []),
    ...(storeUrl
      ? [
          {
            label: "Otevřít v obchodě",
            icon: <ArrowUpRightOnBox />,
            // Nové okno jen přímo z kliknutí, jinak ho Safari zablokuje.
            sync: true,
            onSelect: () => window.open(storeUrl, "_blank", "noopener"),
          },
        ]
      : []),
  ];

  const rare: RowOption[] = [
    ...flagKeys.map((key) => ({
      label: flags[key] ? FLAG_TEXT[key].offLabel : FLAG_TEXT[key].onLabel,
      icon: key === "no_promo" ? <ReceiptPercent /> : <PencilSquare />,
      onSelect: () => saveFlag.mutate({ key, value: !flags[key] }),
    })),
    ...(showShipping
      ? [
          {
            label: "Profil dopravy…",
            icon: <TruckFast />,
            takesFocus: true,
            onSelect: () => openPanel("profile"),
          },
        ]
      : []),
    ...(commission === "make"
      ? [
          {
            label: "Nastavit jako zakázku…",
            icon: <Tools />,
            takesFocus: true,
            onSelect: () => openPanel("commission"),
          },
        ]
      : []),
  ];

  const end: RowOption[] = [
    ...(showArchive
      ? [
          {
            label: archiving ? "Archivovat" : "Obnovit z archivu",
            icon: archiving ? <ArchiveBox /> : <ArrowUturnLeft />,
            onSelect: () => archive.mutate(),
          },
        ]
      : []),
    ...(showDelete !== false
      ? [
          {
            label: "Smazat…",
            icon: <Trash />,
            destructive: true,
            takesFocus: true,
            onSelect: () => setPtaSeNaSmazani(true),
          },
        ]
      : []),
  ];

  /* Skupiny oddělené čarou; prázdná skupina čáru nedělá. */
  const items = [edits, shop, rare, end]
    .filter((group) => group.length > 0)
    .flatMap((group, index) =>
      index === 0 ? group : (["separator", ...group] as RowOption[])
    );

  return (
    <>
      <RowOptionsMenu label={`Možnosti produktu ${product.title}`} items={items} />

      {/* Panely se svým Uložit — otevírá je nabídka přes skrytý spouštěč. */}
      {showVariants && mounted.has("variants") && (
        <VariantsEditor
          productId={product.id}
          productTitle={product.title}
          trigger={<HiddenTrigger buttonRef={variantsRef} />}
        />
      )}
      {commission && mounted.has("commission") && (
        <ProductionProfileEditor
          productId={product.id}
          productTitle={product.title}
          trigger={<HiddenTrigger buttonRef={commissionRef} />}
        />
      )}
      {bundleId && mounted.has("bundle") && (
        <BundleEditor bundleId={bundleId} trigger={<HiddenTrigger buttonRef={bundleRef} />} />
      )}
      {showShipping && mounted.has("profile") && (
        <ShippingProfileEditor
          productId={product.id}
          productTitle={product.title}
          fragile={product.fragile}
          packagingPrice={product.packaging_price}
          trigger={<HiddenTrigger buttonRef={profileRef} />}
        />
      )}

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
