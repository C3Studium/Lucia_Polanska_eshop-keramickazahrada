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
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  otevritZvenku,
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
  /** Změna čísla = otevřít nabídku (lišta dole „Nastavení výrobku" při jednom vybraném). */
  otevritZvenku?: number;
}) => {
  const queryClient = useQueryClient();
  const [ptaSeNaSmazani, setPtaSeNaSmazani] = useState(false);
  /* Nabídka zůstává otevřená; vybrané nastavení se otevře VLEVO vedle ní
     (19. 11. 2026, Matěj — dřív okno po výběru hned zase zmizelo). */
  type PanelKey = "variants" | "commission" | "bundle" | "profile";
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<PanelKey | null>(null);
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
  const ulozeno = {
    shipping_class: (["male", "velke", "poukaz"] as const).includes(meta.shipping_class as never) ? (meta.shipping_class as string) : "male",
    fragile: meta.fragile === true || meta.fragile === "true",
    cod_allowed: meta.cod_allowed !== false,
    frost_resistant: meta.frost_resistant === true,
    clearance: Boolean(flags.clearance ?? meta.clearance === true),
    no_promo: Boolean(flags.no_promo ?? meta.no_promo === true),
    packaging_price: (meta.packaging_price ?? null) as number | null,
    dimensions: typeof meta.dimensions === "string" ? meta.dimensions : "",
    material: detail.data?.product.material ?? "",
  };

  /*
   * Rozpracované změny (19. 11. 2026, Matěj: „ať je v nabídce Uložit
   * vše / Zrušit vše"). Nic se nezapíše, dokud se neklikne na Uložit vše; Zrušit
   * vrátí vše. Zavřít nabídku s neuloženým nejde — ozve se hláška.
   */
  const [navrh, setNavrh] = useState<Partial<Record<keyof typeof ulozeno, unknown>>>({});
  const [balneText, setBalneText] = useState<string | null>(null);
  const [rozmeryText, setRozmeryText] = useState<string | null>(null);
  const hodnota = <K extends keyof typeof ulozeno>(k: K) => (k in navrh ? (navrh[k] as (typeof ulozeno)[K]) : ulozeno[k]);
  const zmenit = (k: keyof typeof ulozeno, v: unknown) =>
    setNavrh((prev) => {
      const dalsi = { ...prev };
      if (v === ulozeno[k]) delete dalsi[k];
      else dalsi[k] = v;
      return dalsi;
    });
  const zahodit = () => {
    setNavrh({});
    setBalneText(null);
    setRozmeryText(null);
  };
  /* Balné a rozměry se do návrhu propíšou z pole hned při psaní. */
  useEffect(() => {
    if (balneText === null) return;
    const t = balneText.trim();
    const n = t === "" ? null : Number(t.replace(",", "."));
    if (n !== null && (!Number.isFinite(n) || n < 0)) return;
    zmenit("packaging_price", n === null ? null : Math.round(n * 100) / 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balneText]);
  useEffect(() => {
    if (rozmeryText === null) return;
    zmenit("dimensions", rozmeryText.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rozmeryText]);
  const pocetZmen = Object.keys(navrh).length;
  const balneSpatne = balneText !== null && balneText.trim() !== "" && !(Number(balneText.trim().replace(",", ".")) >= 0);

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

  /* Otevření z lišty dole („Nastavení výrobku" při jednom vybraném). */
  const spoustec = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (otevritZvenku === undefined) return;
    spoustec.current?.scrollIntoView({ block: "center" });
    const t = window.setTimeout(() => setMenuOpen(true), 150);
    return () => window.clearTimeout(t);
  }, [otevritZvenku]);

  const ulozit = useMutation({
    mutationFn: async () => {
      const { material, ...ostatni } = navrh;
      const telo: Record<string, unknown> = { ...ostatni };
      if ("dimensions" in telo) telo.dimensions = (telo.dimensions as string) || null;
      if (Object.keys(telo).length) await writeFlags(telo);
      if (material !== undefined) {
        await sdk.client.fetch(`/admin/products/${product.id}`, { method: "POST", body: { material: (material as string) || null } });
      }
    },
    onSuccess: async () => {
      for (const k of ["clearance", "no_promo"] as const) if (k in navrh) onFlagSaved?.(k);
      const presun = "clearance" in navrh;
      zahodit();
      await queryClient.invalidateQueries({ queryKey: ["row-menu", product.id] });
      await refresh();
      toast.success(presun ? "Uloženo. Poškozené kusy najdete v záložce Poškozené." : "Změny uloženy.");
    },
    onError: (error) => toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  const typ: "bezny" | "poskozeny" | "zakazka" = commission === "terms" ? "zakazka" : hodnota("clearance") ? "poskozeny" : "bezny";
  const nastavTyp = (dalsi: "bezny" | "poskozeny" | "zakazka") => {
    if (dalsi === typ) return;
    if (typ === "zakazka" || dalsi === "zakazka") {
      /* Zakázku zapíná i vypíná okno Podmínky zakázky (záloha, doba výroby). */
      setPanel("commission");
      if (typ === "zakazka") toast.info("Zakázku vypnete v okně Podmínky zakázky vlevo.");
      return;
    }
    zmenit("clearance", dalsi === "poskozeny");
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
        fragile={ulozeno.fragile}
        packagingPrice={product.packaging_price}
      />
    ) : null;

  const nacita = !detail.data;
  const zmeneno = (k: keyof typeof ulozeno) => k in navrh;
  const ram = (k: keyof typeof ulozeno) => (zmeneno(k) ? "border-ui-border-interactive" : "border-ui-border-base");

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
          <IconButton size="small" variant="transparent" aria-label="Zavřít nabídku" onClick={() => zkusitZavrit()}>
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
                  <span className="txt-compact-small-plus text-ui-fg-base block">Velikost zásilky{zmeneno("shipping_class") ? " •" : ""}</span>
                  <span className="txt-compact-xsmall text-ui-fg-subtle block">Podle ní se počítá poštovné</span>
                </span>
                <Volby
                  popisek="Velikost zásilky"
                  hodnota={hodnota("shipping_class") as "male" | "velke" | "poukaz"}
                  vypnuto={nacita}
                  moznosti={[{ value: "male", label: "Malé" }, { value: "velke", label: "Velké" }, { value: "poukaz", label: "Poukaz" }]}
                  onVyber={(v) => zmenit("shipping_class", v)}
                />
              </div>
              <Radek nazev={`Křehké${zmeneno("fragile") ? " •" : ""}`} popis="Celá zásilka pojede jako křehká">
                <Switch size="small" checked={hodnota("fragile")} disabled={nacita} aria-label="Křehké" onCheckedChange={(v) => zmenit("fragile", v)} />
              </Radek>
              <Radek nazev={`Dobírka${zmeneno("cod_allowed") ? " •" : ""}`} popis="Vypnuto = jen platba předem">
                <Switch size="small" checked={hodnota("cod_allowed")} disabled={nacita} aria-label="Dobírka" onCheckedChange={(v) => zmenit("cod_allowed", v)} />
              </Radek>
              <Radek nazev="Balné" popis={balneSpatne ? "Napište číslo, třeba 20" : "Za kus; prázdné = 0 Kč"}>
                <span className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label="Balné v Kč"
                    value={balneText ?? (ulozeno.packaging_price === null ? "" : String(ulozeno.packaging_price))}
                    disabled={nacita}
                    onChange={(e) => setBalneText(e.target.value)}
                    className={`bg-ui-bg-field txt-compact-small min-h-[32px] w-20 rounded-md border px-2 text-right ${balneSpatne ? "border-ui-border-error" : ram("packaging_price")}`}
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
                  <span className="txt-compact-small-plus text-ui-fg-base block">Typ výrobku{zmeneno("clearance") ? " •" : ""}</span>
                  <span className="txt-compact-xsmall text-ui-fg-subtle block">
                    {typ === "zakazka" ? "Vyrábí se po objednání, se zálohou" : typ === "poskozeny" ? "Levněji; po prodeji se skryje" : "Běžný kus ze skladu"}
                  </span>
                </span>
                <Volby
                  popisek="Typ výrobku"
                  hodnota={typ}
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
              <Radek nazev={`Bez slevových kódů${zmeneno("no_promo") ? " •" : ""}`} popis="Kódy z pokladny na něj neplatí">
                <Switch size="small" checked={hodnota("no_promo")} aria-label="Bez slevových kódů" onCheckedChange={(v) => zmenit("no_promo", v)} />
              </Radek>
            )}
          </Skupina>
          <Skupina nazev="Materiál a rozměry">
            <Radek nazev={`Materiál${zmeneno("material") ? " •" : ""}`}>
              <select
                aria-label="Materiál"
                value={hodnota("material")}
                disabled={nacita}
                onChange={(e) => zmenit("material", e.target.value)}
                className={`bg-ui-bg-field txt-compact-small min-h-[32px] max-w-[170px] rounded-md border px-2 ${ram("material")}`}
              >
                <option value="">Bez materiálu</option>
                {[...new Set([...(materialy.data?.materials ?? []), ...(ulozeno.material ? [ulozeno.material] : [])])].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Radek>
            <Radek nazev="Rozměry">
              <input
                type="text"
                aria-label="Rozměry"
                placeholder="např. výška 12 cm, ø 9 cm"
                value={rozmeryText ?? ulozeno.dimensions}
                disabled={nacita}
                onChange={(e) => setRozmeryText(e.target.value)}
                className={`bg-ui-bg-field txt-compact-small min-h-[32px] w-[170px] rounded-md border px-2 ${ram("dimensions")}`}
              />
            </Radek>
            <Radek nazev={`Mrazuvzdorné${zmeneno("frost_resistant") ? " •" : ""}`} popis="Vydrží mráz — štítek u výrobku">
              <Switch size="small" checked={hodnota("frost_resistant")} disabled={nacita} aria-label="Mrazuvzdorné" onCheckedChange={(v) => zmenit("frost_resistant", v)} />
            </Radek>
          </Skupina>
        </div>
      </div>

      {/* Spodní lišta: archiv a mazání vlevo, uložení vpravo */}
      <div className="border-ui-border-base flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5">
        <div className="flex items-center gap-2">
          {showArchive && (
            <Button size="small" variant="transparent" isLoading={archive.isPending} onClick={() => { zahodit(); setPanel(null); setMenuOpen(false); archive.mutate(); }}>
              {archiving ? <ArchiveBox /> : <ArrowUturnLeft />} {archiving ? "Archivovat" : "Obnovit z archivu"}
            </Button>
          )}
          {showDelete !== false && (
            <Button size="small" variant="transparent" className="text-ui-fg-error" onClick={() => { zahodit(); setPanel(null); setMenuOpen(false); window.setTimeout(() => setPtaSeNaSmazani(true), 0); }}>
              <Trash /> Smazat…
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pocetZmen > 0 && (
            <Button size="small" variant="secondary" disabled={ulozit.isPending} onClick={zahodit}>
              Zrušit vše
            </Button>
          )}
          <Button size="small" disabled={pocetZmen === 0 || balneSpatne} isLoading={ulozit.isPending} onClick={() => ulozit.mutate()}>
            {pocetZmen > 0 ? `Uložit vše (${pocetZmen})` : "Uložit vše"}
          </Button>
        </div>
      </div>
    </div>
  );

  /* Zavřít jde, jen když nic nečeká na uložení. */
  function zkusitZavrit() {
    if (pocetZmen > 0) {
      toast.warning("Máte neuložené změny — klikněte na Uložit vše, nebo Zrušit vše.");
      return false;
    }
    setPanel(null);
    setMenuOpen(false);
    return true;
  }

  return (
    <>
      <Popover
        open={menuOpen}
        onOpenChange={(next) => {
          if (next) setMenuOpen(true);
          else zkusitZavrit();
        }}
      >
        <Popover.Trigger asChild>
          <IconButton
            ref={spoustec}
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
          className="z-[60] flex max-w-[calc(100vw-24px)] items-stretch overflow-hidden p-0"
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
