import {
  ArchiveBox,
  ArrowUpRightOnBox,
  ArrowUturnLeft,
  EllipsisHorizontal,
  Eye,
  EyeSlash,
  Trash,
} from "@medusajs/icons";
import { Button, IconButton, Popover, Switch, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";
import { toastWithUndo } from "../lib/undo";
import { BundleEditor } from "./bundle-editor";
import { ConfirmDialog } from "./confirm-dialog";
import { PanelZpet } from "./panel-shell";
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


/* ————— Stavební kousky nabídky „…" (mimo komponentu — jinak by je React
   při každém psaní vyměnil a pole Balné / Rozměry by ztrácela fokus) ————— */
const Skupina = ({ nazev, children }: { nazev: string; children: ReactNode }) => (
  <section className="flex flex-col gap-1">
    <Text size="xsmall" weight="plus" className="text-ui-fg-muted px-1 uppercase tracking-wide">
      {nazev}
    </Text>
    <div className="bg-ui-bg-base shadow-borders-base divide-y rounded-lg">{children}</div>
  </section>
);
const Radek = ({ nazev, popis, children }: { nazev: string; popis?: string; children?: ReactNode }) => (
  <div className="flex min-h-[44px] items-center justify-between gap-3 px-3 py-2">
    <span className="min-w-0">
      <span className="txt-compact-small-plus text-ui-fg-base block">{nazev}</span>
      {popis && <span className="txt-compact-xsmall text-ui-fg-subtle block">{popis}</span>}
    </span>
    {children}
  </div>
);
const Otevrit = ({ aktivni, onToggle, nazev, popis }: { aktivni: boolean; onToggle: () => void; nazev: string; popis: string }) => (
  <button
    type="button"
    role="menuitem"
    aria-expanded={aktivni}
    onClick={onToggle}
    className={`flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${aktivni ? "bg-ui-bg-base-pressed" : "hover:bg-ui-bg-base-hover"}`}
  >
    <span className="min-w-0">
      <span className="txt-compact-small-plus text-ui-fg-base block">{nazev}</span>
      <span className="txt-compact-xsmall text-ui-fg-subtle block">{popis}</span>
    </span>
    <span className="text-ui-fg-muted shrink-0">{aktivni ? "‹" : "›"}</span>
  </button>
);
const Volby = <T extends string>({ popisek, hodnota, moznosti, onVyber, vypnuto }: {
  popisek: string; hodnota: T; moznosti: { value: T; label: string }[]; onVyber: (v: T) => void; vypnuto?: boolean;
}) => (
  <div role="radiogroup" aria-label={popisek} className="bg-ui-bg-subtle flex shrink-0 flex-wrap rounded-md p-0.5">
    {moznosti.map((m) => (
      <button
        key={m.value}
        type="button"
        role="radio"
        aria-checked={hodnota === m.value}
        disabled={vypnuto}
        onClick={() => onVyber(m.value)}
        className={`txt-compact-xsmall-plus min-h-[30px] rounded px-2.5 disabled:opacity-60 ${hodnota === m.value ? "bg-ui-bg-base shadow-borders-base text-ui-fg-base" : "text-ui-fg-subtle hover:text-ui-fg-base"}`}
      >
        {m.label}
      </button>
    ))}
  </div>
);

export const ProductRowMore = ({
  product,
  flags,
  onFlagSaved,
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


  /* ————— Údaje, které řádek nemá (načtou se při otevření nabídky) ————— */
  const detail = useQuery<{ product: { handle?: string; material: string | null; metadata: Record<string, unknown> | null } }>({
    queryKey: ["row-menu", product.id],
    queryFn: () => sdk.client.fetch(`/admin/products/${product.id}?fields=handle,material,metadata`),
    enabled: menuOpen,
  });
  const materialy = useQuery<{ materials: string[] }>({
    queryKey: ["produkt-materials"],
    queryFn: () => sdk.client.fetch(`/admin/workbench/materials`),
    staleTime: 5 * 60_000,
    enabled: menuOpen,
  });
  const meta = detail.data?.product.metadata ?? {};
  const trida = (["male", "velke", "poukaz"] as const).includes(meta.shipping_class as never)
    ? (meta.shipping_class as "male" | "velke" | "poukaz")
    : "male";
  const krehke = meta.fragile === true || meta.fragile === "true";
  const dobirka = meta.cod_allowed !== false;
  const mraz = meta.frost_resistant === true;
  const poskozeny = Boolean(flags.clearance ?? meta.clearance === true);
  const bezKodu = Boolean(flags.no_promo ?? meta.no_promo === true);
  const [balne, setBalne] = useState("");
  const [rozmery, setRozmery] = useState("");
  useEffect(() => {
    if (!detail.data) return;
    setBalne(meta.packaging_price === null || meta.packaging_price === undefined ? "" : String(meta.packaging_price));
    setRozmery(typeof meta.dimensions === "string" ? meta.dimensions : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data]);

  /* Telefon: okno nastavení MÍSTO nabídky (s „← Zpět do nabídky"). */
  const [uzky, setUzky] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const mq = window.matchMedia("(max-width: 1023px)");
    const nastav = () => setUzky(mq.matches);
    nastav();
    mq.addEventListener("change", nastav);
    return () => mq.removeEventListener("change", nastav);
  }, [menuOpen]);

  /* Uložení nastavení přímo v nabídce — hned, jako na detailu výrobku. */
  const ulozit = useMutation({
    mutationFn: async (zmena: { flags?: Record<string, unknown>; material?: string | null; hlaska: string }) => {
      if (zmena.flags) await writeFlags(zmena.flags);
      if (zmena.material !== undefined) {
        await sdk.client.fetch(`/admin/products/${product.id}`, { method: "POST", body: { material: zmena.material } });
      }
    },
    onSuccess: async (_r, zmena) => {
      await queryClient.invalidateQueries({ queryKey: ["row-menu", product.id] });
      await refresh();
      toast.success(zmena.hlaska);
    },
    onError: (error) => toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  const typ: "bezny" | "poskozeny" | "zakazka" = commission === "terms" ? "zakazka" : poskozeny ? "poskozeny" : "bezny";
  const nastavTyp = (dalsi: "bezny" | "poskozeny" | "zakazka") => {
    if (dalsi === typ) return;
    if (typ === "zakazka" || dalsi === "zakazka") {
      /* Zakázku zapíná i vypíná okno Podmínky zakázky (záloha, doba výroby). */
      setPanel("commission");
      if (typ === "zakazka") toast.info("Zakázku vypnete v okně Podmínky zakázky vlevo.");
      return;
    }
    saveFlag.mutate({ key: "clearance", value: dalsi === "poskozeny" });
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
        fragile={krehke}
        packagingPrice={product.packaging_price}
      />
    ) : null;

  const nacita = !detail.data;

  const nabidka = (
    <div className="flex max-h-[min(82vh,760px)] w-[min(680px,calc(100vw-24px))] flex-col" role="menu" aria-label={`Možnosti produktu ${product.title}`}>
      {/* Hlavička: název + viditelnost jako tlačítko */}
      <div className="border-ui-border-base flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <Text size="small" weight="plus" className="min-w-0 flex-1 truncate" title={product.title}>
          {product.title}
        </Text>
        <div className="flex items-center gap-2">
          {showVisibility && (
            <Button
              size="small"
              variant={visible ? "secondary" : "primary"}
              isLoading={saveVisibility.isPending}
              onClick={() => saveVisibility.mutate({ next: !visible, previousStatus: product.status })}
            >
              {visible ? <EyeSlash /> : <Eye />} {visible ? "Skrýt z obchodu" : "Zobrazit v obchodě"}
            </Button>
          )}
          {storeUrl && (
            <IconButton size="small" variant="transparent" aria-label="Otevřít v obchodě (nové okno)" title="Otevřít v obchodě" onClick={() => window.open(storeUrl, "_blank", "noopener")}>
              <ArrowUpRightOnBox />
            </IconButton>
          )}
          <IconButton size="small" variant="transparent" aria-label="Zavřít nabídku" onClick={zavritVse}>
            ×
          </IconButton>
        </div>
      </div>

      {/* Dva sloupce jako detail výrobku: vlevo cena a doprava, vpravo prodej a materiál */}
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Skupina nazev="Cena a sklad">
            {showVariants && <Otevrit aktivni={panel === "variants"} onToggle={() => setPanel(panel === "variants" ? null : "variants")} nazev="Ceny a provedení" popis="Cena, sklad, velikosti a barvy" />}
            {bundleId && <Otevrit aktivni={panel === "bundle"} onToggle={() => setPanel(panel === "bundle" ? null : "bundle")} nazev="Složení balíčku" popis="Které výrobky balíček obsahuje" />}
            {onToggleExpand && (
              <Radek nazev="Prodeje a hodnocení" popis="Graf po měsících pod řádkem">
                <Switch size="small" checked={Boolean(expanded)} onCheckedChange={() => onToggleExpand()} aria-label="Prodeje a hodnocení pod řádkem" />
              </Radek>
            )}
          </Skupina>
          {showShipping && (
            <Skupina nazev="Doprava">
              <div className="flex flex-col gap-2 px-3 py-2.5">
                <span>
                  <span className="txt-compact-small-plus text-ui-fg-base block">Velikost zásilky</span>
                  <span className="txt-compact-xsmall text-ui-fg-subtle block">Podle ní se počítá poštovné</span>
                </span>
                <Volby
                  popisek="Velikost zásilky"
                  hodnota={trida}
                  vypnuto={nacita || ulozit.isPending}
                  moznosti={[{ value: "male", label: "Malé" }, { value: "velke", label: "Velké" }, { value: "poukaz", label: "Poukaz" }]}
                  onVyber={(v) => ulozit.mutate({ flags: { shipping_class: v }, hlaska: `Velikost zásilky: ${v === "male" ? "Malé" : v === "velke" ? "Velké" : "Poukaz"}.` })}
                />
              </div>
              <Radek nazev="Křehké" popis="Celá zásilka pojede jako křehká">
                <Switch size="small" checked={krehke} disabled={nacita || ulozit.isPending} aria-label="Křehké"
                  onCheckedChange={(v) => ulozit.mutate({ flags: { fragile: v }, hlaska: v ? "Křehké zapnuto." : "Křehké vypnuto." })} />
              </Radek>
              <Radek nazev="Dobírka" popis="Vypnuto = jen platba předem">
                <Switch size="small" checked={dobirka} disabled={nacita || ulozit.isPending} aria-label="Dobírka"
                  onCheckedChange={(v) => ulozit.mutate({ flags: { cod_allowed: v }, hlaska: v ? "Dobírka povolena." : "Dobírka vypnuta — jen platba předem." })} />
              </Radek>
              <Radek nazev="Balné" popis="Za kus; prázdné = 0 Kč">
                <span className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label="Balné v Kč"
                    value={balne}
                    disabled={nacita}
                    onChange={(e) => setBalne(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    onBlur={() => {
                      const t = balne.trim();
                      const cislo = t === "" ? null : Number(t.replace(",", "."));
                      const puvodni = meta.packaging_price ?? null;
                      if (cislo !== null && (!Number.isFinite(cislo) || cislo < 0)) return toast.error("Balné musí být číslo, třeba 20.");
                      if (cislo === puvodni) return;
                      ulozit.mutate({ flags: { packaging_price: cislo }, hlaska: cislo === null ? "Balné 0 Kč." : `Balné ${cislo} Kč.` });
                    }}
                    className="bg-ui-bg-field border-ui-border-base txt-compact-small min-h-[32px] w-20 rounded-md border px-2 text-right"
                  />
                  <span className="txt-compact-small text-ui-fg-muted">Kč</span>
                </span>
              </Radek>
              <Otevrit aktivni={panel === "profile"} onToggle={() => setPanel(panel === "profile" ? null : "profile")} nazev="Povolené dopravy" popis="Profil dopravy — pokročilé, mění se zřídka" />
            </Skupina>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Skupina nazev="Prodej">
            {(flags.clearance !== undefined || commission) && (
              <div className="flex flex-col gap-2 px-3 py-2.5">
                <span>
                  <span className="txt-compact-small-plus text-ui-fg-base block">Typ výrobku</span>
                  <span className="txt-compact-xsmall text-ui-fg-subtle block">
                    {typ === "zakazka" ? "Vyrábí se po objednání, se zálohou" : typ === "poskozeny" ? "Levněji; po prodeji se skryje" : "Běžný kus ze skladu"}
                  </span>
                </span>
                <Volby
                  popisek="Typ výrobku"
                  hodnota={typ}
                  vypnuto={saveFlag.isPending}
                  moznosti={[
                    { value: "bezny" as const, label: "Běžný" },
                    ...(flags.clearance !== undefined ? [{ value: "poskozeny" as const, label: "Poškozený kus" }] : []),
                    ...(commission ? [{ value: "zakazka" as const, label: "Na zakázku" }] : []),
                  ]}
                  onVyber={nastavTyp}
                />
              </div>
            )}
            {commission === "terms" && <Otevrit aktivni={panel === "commission"} onToggle={() => setPanel(panel === "commission" ? null : "commission")} nazev="Podmínky zakázky" popis="Záloha a doba výroby" />}
            {flags.no_promo !== undefined && (
              <Radek nazev="Bez slevových kódů" popis="Kódy z pokladny na něj neplatí">
                <Switch size="small" checked={bezKodu} disabled={saveFlag.isPending} aria-label="Bez slevových kódů"
                  onCheckedChange={(v) => saveFlag.mutate({ key: "no_promo", value: v })} />
              </Radek>
            )}
          </Skupina>
          <Skupina nazev="Materiál a rozměry">
            <Radek nazev="Materiál">
              <select
                aria-label="Materiál"
                value={detail.data?.product.material ?? ""}
                disabled={nacita || ulozit.isPending}
                onChange={(e) => ulozit.mutate({ material: e.target.value || null, hlaska: e.target.value ? `Materiál: ${e.target.value}.` : "Materiál smazán." })}
                className="bg-ui-bg-field border-ui-border-base txt-compact-small min-h-[32px] max-w-[170px] rounded-md border px-2"
              >
                <option value="">Bez materiálu</option>
                {[...new Set([...(materialy.data?.materials ?? []), ...(detail.data?.product.material ? [detail.data.product.material] : [])])].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Radek>
            <Radek nazev="Rozměry">
              <input
                type="text"
                aria-label="Rozměry"
                placeholder="např. výška 12 cm, ø 9 cm"
                value={rozmery}
                disabled={nacita}
                onChange={(e) => setRozmery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                onBlur={() => {
                  const t = rozmery.trim();
                  if (t === (typeof meta.dimensions === "string" ? meta.dimensions : "")) return;
                  ulozit.mutate({ flags: { dimensions: t || null }, hlaska: t ? `Rozměry: ${t}.` : "Rozměry smazány." });
                }}
                className="bg-ui-bg-field border-ui-border-base txt-compact-small min-h-[32px] w-[170px] rounded-md border px-2"
              />
            </Radek>
            <Radek nazev="Mrazuvzdorné" popis="Vydrží mráz — štítek u výrobku">
              <Switch size="small" checked={mraz} disabled={nacita || ulozit.isPending} aria-label="Mrazuvzdorné"
                onCheckedChange={(v) => ulozit.mutate({ flags: { frost_resistant: v }, hlaska: v ? "Mrazuvzdorné." : "Už není mrazuvzdorné." })} />
            </Radek>
          </Skupina>
        </div>
      </div>

      {/* Spodní lišta: archiv a mazání */}
      {(showArchive || showDelete !== false) && (
        <div className="border-ui-border-base flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5">
          <Text size="xsmall" className="text-ui-fg-muted">Změny se ukládají hned.</Text>
          <div className="flex items-center gap-2">
            {showArchive && (
              <Button size="small" variant="secondary" isLoading={archive.isPending} onClick={() => { zavritVse(); archive.mutate(); }}>
                {archiving ? <ArchiveBox /> : <ArrowUturnLeft />} {archiving ? "Archivovat" : "Obnovit z archivu"}
              </Button>
            )}
            {showDelete !== false && (
              <Button size="small" variant="secondary" className="text-ui-fg-error" onClick={() => { zavritVse(); window.setTimeout(() => setPtaSeNaSmazani(true), 0); }}>
                <Trash /> Smazat…
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );

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
            title="Nastavení výrobku"
            className="shrink-0"
          >
            <EllipsisHorizontal />
          </IconButton>
        </Popover.Trigger>
        <Popover.Content
          align="center"
          side={uzky ? "bottom" : "left"}
          sideOffset={6}
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
          {/* Telefon/úzké okno: jen jedno — buď nastavení (se „Zpět"), nebo nabídka.
              Široké okno: nastavení vlevo vedle nabídky. */}
          <PanelZpet.Provider value={uzky ? () => setPanel(null) : undefined}>
            {panelEl && <div className={uzky ? "flex" : "border-ui-border-base flex border-r"}>{panelEl}</div>}
          </PanelZpet.Provider>
          {(!uzky || !panelEl) && nabidka}
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
