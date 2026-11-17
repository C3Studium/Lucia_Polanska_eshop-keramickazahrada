import { ArrowUpRightOnBox, ChevronDown, Photo, Plus, Trash } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Select,
  Skeleton,
  Switch,
  Text,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSousedi } from "../../../lib/seznam-kontext";
import { ConfirmDialog } from "../../../components/confirm-dialog";
import { EmptyState, pieces } from "../../../components/empty-state";
import {
  InlineNumber,
  InlineText,
  InlineTextarea,
} from "../../../components/inline-field";
import { PhotoStrip, PhotoViewer } from "../../../components/photo-strip";
import { ProductionProfileEditor } from "../../../components/production-profile-editor";
import { ProductDetailMenu } from "../../../components/product-detail-menu";
import { ProductStats } from "../../../components/product-stats";
import { SHIPPING_CLASS_OPTIONS } from "../../../components/product-row-more";
import { CopyId, RawData, useExpertMode } from "../../../lib/expert-mode";
import { formatDate, formatDateTime } from "../../../lib/format";
import { sdk } from "../../../lib/sdk";
import { formatCzk } from "../../../lib/workbench";
import { adminQueryClient } from "../../../lib/query-client"
import { ceskaChyba } from "../../../lib/ceska-chyba";

/**
 * Detail produktu — jedna stránka místo nativní editace (Matěj, 2026-08-16).
 *
 * The native product page hides every edit behind a three-dot menu and a
 * modal; this one follows the workbench rule instead: what you see is the
 * field, leaving the field saves it. Everything the shop actually uses —
 * photos, price, stock, zařazení, the workbench flags, zakázka terms — lives
 * here. Order follows how often she needs it (17. 11. 2026): header with
 * name, status, price and stock; what is missing for sale; then price/stock,
 * photos, description, zařazení; sale switches in the side column; rarely
 * used things collapsed and the numbers (Statistiky) at the very bottom.
 *
 * Writes go where they always go: native product endpoints for native
 * fields, the flags route for the shop's own switches (it merges), the
 * additive add-stock route for the kiln unload. The native page stays
 * reachable from Expertní režim for the rare corner this page does not cover.
 */

type NativeVariant = {
  id: string;
  title: string | null;
  sku: string | null;
  allow_backorder?: boolean;
  /** Carries the variant's own photos (`images`) and customer note (`note`). */
  metadata?: Record<string, unknown> | null;
  prices?: { id?: string; currency_code: string; amount: number }[];
  /** Hodnoty voleb varianty — to, co zákazník v obchodě vybírá. */
  options?: { id: string; value: string; option_id?: string | null }[];
};

type NativeOption = {
  id: string;
  title: string;
  values?: { id: string; value: string }[];
};

type NativeProduct = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  handle: string | null;
  status: string;
  thumbnail: string | null;
  weight: number | null;
  length: number | null;
  height: number | null;
  width: number | null;
  material: string | null;
  collection_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  collection?: { id: string; title: string } | null;
  images?: { id?: string; url: string }[];
  categories?: { id: string; name: string }[];
  /** Prodejní kanály — obchod vidí jen produkty v kanálu svého klíče. */
  sales_channels?: { id: string; name: string }[];
  options?: NativeOption[];
  variants?: NativeVariant[];
};

type StockVariant = {
  id: string;
  available: number | null;
  reserved: number | null;
  stock_state: "low" | "out" | "ok" | null;
  inventory_item_id: string | null;
  waiting_customers: number;
  wishlist_count: number;
};

type WorkbenchDetail = {
  id: string;
  store_url?: string | null;
  variants: StockVariant[];
  sales_by_month: { month: string; sold: number }[];
  reviews: {
    count: number;
    average: number | null;
    latest: { rating: number; title: string | null; content: string; created_at: string }[];
  };
  production: {
    enabled: boolean;
    deposit_floor_percentage: number;
    allow_full_prepayment: boolean;
  } | null;
  memberships: {
    bundles: { id: string; title: string }[];
    seasonal_selections: { id: string; title: string; status: string }[];
  };
};

const stockMeta: Record<string, { label: string; color: "green" | "orange" | "red" }> = {
  ok: { label: "skladem", color: "green" },
  low: { label: "dochází", color: "orange" },
  out: { label: "vyprodáno", color: "red" },
};

const flagOf = (product: NativeProduct | undefined, key: string): boolean =>
  Boolean(product?.metadata?.[key]);

/* Velikost zásilky (16. 11. 2026): uložená hodnota, jinak poukaz u dárkového
   poukazu a malé u všeho ostatního — totéž pravidlo jako lib/shipping-rates
   (sem se sdílí jen typ, admin je kód prohlížeče). */
const shippingClassOfProduct = (product: NativeProduct | undefined): string => {
  const meta = (product?.metadata ?? {}) as Record<string, unknown>;
  const stored = String(meta.shipping_class ?? "");
  if (["male", "velke", "poukaz"].includes(stored)) return stored;
  const voucher =
    meta.gift_voucher === true ||
    meta.gift_voucher === "true" ||
    meta.voucher_custom_amount === true ||
    meta.voucher_custom_amount === "true";
  return voucher ? "poukaz" : "male";
};

const czkPrice = (variant: NativeVariant): number | null => {
  const czk = (variant.prices ?? []).find(
    (price) => String(price.currency_code).toLowerCase() === "czk"
  );
  return czk ? Number(czk.amount) : null;
};

/** „v eurech 12,50 €" čte se líp než samotný kód měny. */
const currencyWords: Record<string, string> = {
  eur: "v eurech",
  pln: "ve zlotých",
  usd: "v dolarech",
  gbp: "v librách",
  huf: "ve forintech",
};

const PRODUCT_FIELDS = [
  "id", "title", "subtitle", "description", "handle", "status", "thumbnail",
  "weight", "length", "height", "width", "material", "collection_id", "metadata",
  "created_at", "updated_at",
  "*collection", "*images", "*categories", "*sales_channels", "*options", "*variants",
  "*variants.prices", "variants.metadata", "*options.values", "*variants.options",
].join(",");

/*
 * Provedení = varianta + hodnota volby (např. Provedení: Modrá). Obchod
 * zákazníkovi nabízí HODNOTY volby, ne názvy variant — a Medusa 2.18 novou
 * variantu s hodnotou, kterou volba ještě nezná, odmítne („Option value …
 * does not exist"). Proto se hodnota před založením / přejmenováním přidá
 * a po přejmenování / odebrání se nepoužívaná stará uklidí, ať v obchodě
 * nevisí volba bez varianty. Jen u produktu s právě jednou volbou (všech
 * 267 v živé databázi); víc voleb je výjimka pro původní editaci.
 */
const optionValueOf = (variant: NativeVariant, option: NativeOption): string | null =>
  (variant.options ?? []).find((value) => value.option_id === option.id)?.value ??
  null;

const addOptionValue = async (
  productId: string,
  option: NativeOption,
  value: string
) => {
  if ((option.values ?? []).some((entry) => entry.value === value)) return;
  await sdk.client.fetch(`/admin/products/${productId}/options/batch`, {
    method: "POST",
    body: { update: [{ product_option_id: option.id, add: [{ value }] }] },
  });
};

/** Úklid je doplněk — když selže, provedení samo je uložené správně. */
const removeUnusedOptionValue = async (
  productId: string,
  option: NativeOption,
  value: string | null,
  remaining: NativeVariant[]
) => {
  if (!value) return;
  const entry = (option.values ?? []).find((candidate) => candidate.value === value);
  if (!entry) return;
  if (remaining.some((variant) => optionValueOf(variant, option) === value)) return;
  try {
    await sdk.client.fetch(`/admin/products/${productId}/options/batch`, {
      method: "POST",
      body: { update: [{ product_option_id: option.id, remove: [entry.id] }] },
    });
  } catch {
    // nic — stará hodnota jen zůstane v nabídce volby
  }
};

/** Section shell — heading + hint on the left rhythm of the page. */
const Section = ({
  title,
  hint,
  children,
  action,
}: {
  title: string;
  hint?: string;
  /** Bez obsahu (např. vypnutý přepínač) zůstane jen nadpis a nápověda. */
  children?: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <section className="px-6 py-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Heading level="h2">{title}</Heading>
      {action}
    </div>
    {hint && (
      <Text size="small" className="text-ui-fg-subtle mt-1">
        {hint}
      </Text>
    )}
    {children ? <div className="mt-4">{children}</div> : null}
  </section>
);

/**
 * Sbalený oddíl pro to, co se otevírá zřídka (zakázka, fotky v popisu,
 * technické údaje). Stejné chování jako OrderSection na detailu objednávky:
 * zavřený ukazuje stav jednou větou; jen bez vlastního Containeru, protože
 * tahle stránka je jedna karta s oddíly pod sebou.
 */
const Disclosure = ({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** Jedna věta pod nadpisem, když je oddíl zavřený. */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="hover:bg-ui-bg-base-hover flex min-h-[56px] w-full items-center justify-between gap-x-3 px-6 py-4 text-left transition-colors"
      >
        <div className="min-w-0">
          <Heading level="h2">{title}</Heading>
          {!open && summary ? (
            <Text size="small" className="text-ui-fg-subtle mt-0.5">
              {summary}
            </Text>
          ) : null}
        </div>
        <ChevronDown
          className={`text-ui-fg-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="px-6 pb-5">{children}</div> : null}
    </section>
  );
};

/**
 * Řádek formuláře jako ve WordPressu: popisek vlevo, pole vpravo. Na úzkém
 * displeji popisek nad polem.
 */
const FieldRow = ({
  label,
  hint,
  narrow = false,
  children,
}: {
  label: string;
  /** Drobná věta pod polem — co údaj dělá. */
  hint?: React.ReactNode;
  /** Úzký sloupec (pravý panel): popisek vlevo vždy, jen užší. */
  narrow?: boolean;
  children: React.ReactNode;
}) => (
  <div
    className={`grid items-start gap-x-3 gap-y-1 py-2.5 ${
      narrow
        ? "grid-cols-[6.5rem_minmax(0,1fr)]"
        : "sm:grid-cols-[8.5rem_minmax(0,1fr)]"
    }`}
  >
    <div className={narrow ? "pt-1.5" : "sm:pt-1.5"}>
      <FieldLabel>{label}</FieldLabel>
    </div>
    <div className="min-w-0">
      {children}
      {hint ? (
        <Text size="xsmall" className="text-ui-fg-muted mt-1">
          {hint}
        </Text>
      ) : null}
    </div>
  </div>
);

/**
 * Fotky v popisu (15. 11. 2026) — fotky, které se na webu ukážou pod popiskem
 * v Detailech výrobku (detail glazury, zadní strana, kus v místnosti). Zvlášť
 * od galerie nahoře. Ukládá se seznam adres do `metadata.detail_images`
 * přes `/flags` (sloučení metadat, obnova obchodu).
 */
const DetailImagesEditor = ({
  images,
  onSave,
}: {
  images: string[];
  onSave: (next: string[]) => Promise<unknown>;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  /* Malé náhledy, úkony až u zvětšené fotky — stejně jako hlavní galerie. */
  const [viewing, setViewing] = useState<number | null>(null);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const result = await sdk.admin.upload.create({ files });
      const urls = (result.files ?? [])
        .map((file: { url?: string }) => file.url)
        .filter(Boolean) as string[];
      if (!urls.length) throw new Error("Fotky se nepodařilo nahrát.");
      await onSave([...images, ...urls].slice(0, 12));
    } catch (error) {
      toast.error(ceskaChyba(error, "Fotky se nepodařilo nahrát."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const move = (index: number, step: number) => {
    const next = [...images];
    const target = index + step;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void onSave(next);
    // Prohlížeč zůstává na téže fotce, ať jde posouvat opakovaně.
    setViewing(target);
  };

  return (
    <div className="flex flex-col gap-3">
      <PhotoViewer
        title="Fotky v popisu"
        photos={images}
        index={viewing}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
        actions={(index) => (
          <>
            <Button
              variant="secondary"
              disabled={busy || index === 0}
              onClick={() => move(index, -1)}
            >
              ← Dopředu
            </Button>
            <Button
              variant="secondary"
              disabled={busy || index === images.length - 1}
              onClick={() => move(index, 1)}
            >
              Dozadu →
            </Button>
            <Button
              variant="secondary"
              className="text-ui-fg-error"
              disabled={busy}
              onClick={() => void onSave(images.filter((_, i) => i !== index))}
            >
              <Trash /> Odebrat
            </Button>
          </>
        )}
      />
      {images.length > 0 ? (
        <PhotoStrip
          photos={images}
          label="Fotka v popisu"
          onOpen={setViewing}
          sizeClassName="size-[72px]"
        />
      ) : (
        <Text size="small" className="text-ui-fg-muted">
          Zatím žádné. Na webu se popisek ukáže bez fotek.
        </Text>
      )}
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => void upload(Array.from(event.target.files ?? []))}
        />
        <Button
          size="small"
          variant="secondary"
          isLoading={busy}
          disabled={busy || images.length >= 12}
          onClick={() => inputRef.current?.click()}
        >
          <Plus /> Přidat fotky
        </Button>
        <Text size="xsmall" className="text-ui-fg-muted mt-1">
          Nejvýš 12. Ukážou se v Detailech pod popiskem. Kliknutím na fotku ji
          zvětšíte, posunete nebo odeberete.
        </Text>
      </div>
    </div>
  );
};

/* Popisek pole — běžné malé písmo místo drobných verzálek (čitelnost 50+). */
const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Text size="small" weight="plus" className="text-ui-fg-subtle">
    {children}
  </Text>
);

/** One flag row: switch, name, consequence. */
const FlagRow = ({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) => (
  <label className="flex items-start justify-between gap-4 py-3">
    <div className="min-w-0">
      <Text size="small" weight="plus">
        {label}
      </Text>
      <Text size="small" className="text-ui-fg-subtle mt-0.5">
        {description}
      </Text>
    </div>
    <Switch className="mt-0.5 shrink-0" checked={checked} onCheckedChange={onChange} disabled={disabled} />
  </label>
);

/** Inline restock — kolik kusů přišlo z pece, nic víc. */
const RestockCell = ({
  inventoryItemId,
  onDone,
}: {
  inventoryItemId: string | null;
  onDone: () => Promise<unknown>;
}) => {
  const [amount, setAmount] = useState("");
  const add = useMutation({
    mutationFn: () => {
      const parsed = Number(amount);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("Napište prosím, kolik kusů přibylo.");
      }
      return sdk.client.fetch(`/admin/workbench/inventory/add-stock`, {
        method: "POST",
        body: { inventory_item_id: inventoryItemId, quantity: parsed },
      });
    },
    onSuccess: async () => {
      const added = Number(amount);
      setAmount("");
      await onDone();
      toast.success(`Přidáno ${pieces(added)}.`);
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Naskladnění se nepodařilo.")),
  });

  if (!inventoryItemId) {
    return (
      <Text size="xsmall" className="text-ui-fg-muted">
        bez skladové karty
      </Text>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        size="small"
        type="number"
        min={1}
        className="w-16"
        placeholder="+ ks"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && amount) add.mutate();
        }}
        disabled={add.isPending}
      />
      <Button
        size="small"
        variant="secondary"
        isLoading={add.isPending}
        disabled={!amount}
        onClick={() => add.mutate()}
      >
        Přidat
      </Button>
    </div>
  );
};

/**
 * Řádek provedení — a při jediném provedení prostě „Cena a sklad".
 *
 * ## Proč dva režimy jedné komponenty
 *
 * Změřeno v živé databázi 20. 10. 2026: všech 267 produktů má právě jedno
 * provedení, 266 z nich se jmenuje „Standardní" a jediná volba, kterou
 * katalog zná, je „Provedení". Tabulka o šesti sloupcích tedy obsluhovala
 * jeden řádek, který se vždy jmenuje stejně — a stála na detailu produktu
 * na třetím místě odshora.
 *
 * Provedení se neruší; jen přestávají být první, co je na kusu vidět.
 * Při jednom je to cena a sklad, při druhém se tabulka vrátí. Logika
 * (ukládání, ceny v cizích měnách, naskladnění, fotky) je v obou režimech
 * tatáž, proto jedna komponenta a ne dvě.
 */
const VariantRow = ({
  productId,
  variant,
  stock,
  canDelete,
  expert,
  invalidate,
  solo = false,
  priceOnRequest = false,
  option = null,
  siblings = [],
}: {
  productId: string;
  variant: NativeVariant;
  /** Jediná volba produktu (Provedení) — název varianty se drží s její hodnotou. */
  option?: NativeOption | null;
  /** Ostatní varianty produktu — kvůli úklidu nepoužívané hodnoty volby. */
  siblings?: NativeVariant[];
  stock: StockVariant | undefined;
  canDelete: boolean;
  expert: boolean;
  invalidate: () => Promise<unknown>;
  /** Jediné provedení produktu — vykreslí se jako údaje kusu, ne jako řádek tabulky. */
  solo?: boolean;
  /**
   * „Bez ceny — cena po domluvě“ (metadata.price_on_request): cena se tu
   * nezadává. Uložené ceny variant se nemažou — po vypnutí se vrátí.
   */
  priceOnRequest?: boolean;
}) => {
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch(`/admin/products/${productId}/variants/${variant.id}`, {
        method: "POST",
        body,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Varianta uložena.");
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await sdk.client.fetch(`/admin/products/${productId}/variants/${variant.id}`, {
        method: "DELETE",
      });
      if (option) {
        await removeUnusedOptionValue(
          productId,
          option,
          optionValueOf(variant, option),
          siblings
        );
      }
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Varianta odstraněna.");
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Odstranění se nepodařilo.")),
  });

  /*
   * A variant is a mini-product: its own photos and note live on its metadata.
   * The storefront shows them the moment the customer picks this provedení —
   * a blue glaze sold by a photo of the green one is a return waiting to happen.
   */
  const photoInput = useRef<HTMLInputElement>(null);
  const photos = Array.isArray(variant.metadata?.images)
    ? (variant.metadata.images as unknown[]).filter(
        (url): url is string => typeof url === "string"
      )
    : [];
  const note =
    typeof variant.metadata?.note === "string" ? variant.metadata.note : "";
  const saveMeta = (patch: Record<string, unknown>) =>
    save.mutateAsync({ metadata: { ...(variant.metadata ?? {}), ...patch } });

  const uploadPhotos = useMutation({
    mutationFn: async (files: File[]) => {
      const result = await sdk.admin.upload.create({ files });
      const urls = (result.files ?? [])
        .map((file: { url?: string }) => file.url)
        .filter(Boolean) as string[];
      if (!urls.length) throw new Error("Fotky se nepodařilo nahrát.");
      return saveMeta({ images: [...photos, ...urls] });
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Nahrání se nepodařilo.")),
  });

  const state = stock?.stock_state ? stockMeta[stock.stock_state] : null;

  /*
   * Jedno pole ve dvou rozvrženích.
   *
   * U jediného provedení je mřížka dvousloupcová (popisek | hodnota), takže
   * pole vydá DVĚ buňky. V tabulce je sloupec jeden a popisek se schovává do
   * něj — na širokém displeji ho nese hlavička sloupce, na úzkém se ukáže
   * nad hodnotou.
   */
  const Pole = ({
    label,
    className,
    children,
  }: {
    label: string;
    className?: string;
    children: React.ReactNode;
  }) =>
    solo ? (
      <>
        <div className="pt-1.5">
          <FieldLabel>{label}</FieldLabel>
        </div>
        <div className={className}>{children}</div>
      </>
    ) : (
      <div className={className}>
        <div className="mb-1 lg:hidden">
          <FieldLabel>{label}</FieldLabel>
        </div>
        {children}
      </div>
    );

  return (
    <div className={solo ? "px-6 pb-2" : "px-6 py-4"}>
    <div
      className={
        solo
          ? "grid items-start gap-x-4 gap-y-2.5 sm:grid-cols-[6rem_minmax(0,1fr)]"
          : "grid items-center gap-x-3 gap-y-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_150px_170px_auto]"
      }
    >
      {/* Název provedení: při jediném je to vždy „Standardní" a nikoho
          nezajímá. Objeví se, jakmile je provedení víc. */}
      {!solo && (
        <div className="min-w-0">
          <InlineText
            value={variant.title ?? ""}
            required
            placeholder="Název varianty"
            onSave={async (next) => {
              const current = option ? optionValueOf(variant, option) : null;
              if (!option || !current || current === next) {
                return save.mutateAsync({ title: next });
              }
              // Přejmenování = i nová hodnota volby, kterou zákazník vidí.
              try {
                await addOptionValue(productId, option, next);
              } catch (error) {
                toast.error(ceskaChyba(error, "Uložení se nepodařilo."));
                throw error;
              }
              const result = await save.mutateAsync({
                title: next,
                options: { [option.title]: next },
              });
              await removeUnusedOptionValue(productId, option, current, siblings);
              return result;
            }}
          />
          {expert && <CopyId value={variant.id} />}
        </div>
      )}
      {/* Kód je pro ni technický údaj — u jediného provedení jen v expertním
          režimu, aby nezabíral místo vedle ceny. */}
      {(!solo || expert) && (
        <Pole label="Kód" className="min-w-0">
          <InlineText
            value={variant.sku ?? ""}
            placeholder="kód (nepovinný)"
            onSave={(next) => save.mutateAsync({ sku: next || null })}
          />
        </Pole>
      )}
      <Pole label="Cena">
        {priceOnRequest ? (
          <div className="flex flex-col gap-0.5 pt-1">
            <Text size="small" weight="plus">
              Po domluvě
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Cenu tu vyplňovat nemusíte — pošlete ji zákazníkovi z objednávky.
            </Text>
          </div>
        ) : (
        <div className="flex flex-col gap-0.5">
        <InlineNumber
          value={czkPrice(variant)}
          unit="Kč"
          allowEmpty={false}
          placeholder="cena"
          inputClassName="w-24"
          onSave={(next) =>
            save.mutateAsync({
              // The price list replaces wholesale — foreign currencies are
              // derived by the daily ČNB job and must ride along, or a CZK
              // edit would wipe them until the next fixing.
              prices: [
                { currency_code: "czk", amount: Number(next) },
                ...(variant.prices ?? [])
                  .filter(
                    (price) =>
                      String(price.currency_code).toLowerCase() !== "czk"
                  )
                  .map((price) => ({
                    currency_code: price.currency_code,
                    amount: price.amount,
                  })),
              ],
            })
          }
        />
        {/* Ceny v ostatních měnách obchodu: dopočítává je denně úloha
            sync-currency-prices z kurzu ČNB (jobs/sync-currency-prices.ts),
            ručně se neupravují — přepsala by je. Zůstávají vidět pro
            kontrolu, jedním čitelným řádkem. */}
        {(() => {
          const foreign = (variant.prices ?? []).filter(
            (price) => String(price.currency_code).toLowerCase() !== "czk"
          );
          if (!foreign.length) return null;
          return (
            <Text
              size="xsmall"
              className="text-ui-fg-subtle tabular-nums"
              title="Dopočítává se samo každý den z ceny v Kč. Ručně se nemění."
            >
              {foreign
                .map((price) => {
                  const code = String(price.currency_code).toLowerCase();
                  const amount = new Intl.NumberFormat("cs-CZ", {
                    style: "currency",
                    currency: code.toUpperCase(),
                  }).format(Number(price.amount));
                  return currencyWords[code]
                    ? `${currencyWords[code]} ${amount}`
                    : amount;
                })
                .join(" · ")}{" "}
              · podle kurzu ČNB
            </Text>
          );
        })()}
        {czkPrice(variant) == null && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Bez ceny — vyplňte ji, ostatní měny se dopočítají samy.
          </Text>
        )}
        </div>
        )}
      </Pole>
      <Pole label="Skladem">
        <div className="flex items-center gap-2">
          <Text size="small" className="tabular-nums">
            {stock?.available ?? "—"}
          </Text>
          {state && (
            <Badge size="2xsmall" color={state.color}>
              {state.label}
            </Badge>
          )}
          {/* U jediného provedení stojí naskladnění hned u stavu — je to
              úkon nad tímhle číslem, ne vlastní sloupec. */}
          {solo && (
            <RestockCell
              inventoryItemId={stock?.inventory_item_id ?? null}
              onDone={invalidate}
            />
          )}
        </div>
        {(Number(stock?.reserved) > 0 ||
          Number(stock?.waiting_customers) > 0 ||
          Number(stock?.wishlist_count) > 0) && (
          <Text size="xsmall" className="text-ui-fg-muted mt-0.5">
            {[
              Number(stock?.reserved) > 0 && `${stock?.reserved} rezervováno`,
              Number(stock?.waiting_customers) > 0 &&
                `${stock?.waiting_customers} čeká`,
              Number(stock?.wishlist_count) > 0 &&
                `${stock?.wishlist_count}× v oblíbených`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        )}
      </Pole>
      {!solo && (
        <Pole label="Naskladnit">
          <RestockCell
            inventoryItemId={stock?.inventory_item_id ?? null}
            onDone={invalidate}
          />
        </Pole>
      )}
      <div className="flex justify-end">
        {canDelete && (
          <ConfirmDialog
            trigger={
              <button
                type="button"
                title="Odebrat variantu"
                className="text-ui-fg-muted hover:text-ui-fg-base"
              >
                <Trash />
              </button>
            }
            title={`Odebrat variantu „${variant.title}"?`}
            description="Varianta zmizí z obchodu i ze skladu. Historie objednávek zůstává."
            consequence="Vrátit to nejde."
            confirmLabel="Odebrat"
            isPending={remove.isPending}
            onConfirm={() => remove.mutate()}
          />
        )}
      </div>
    </div>

    {/* Mini-produkt varianty: fotky a poznámka patří k řádku nahoře — jemné
        pozadí je drží pohromadě, aby se sekce nerozpadala do volných řádků.

        U jediného provedení se tenhle blok ukáže, jen když v něm něco je:
        fotky kusu patří do oddílu „Fotky" o kus výš a druhá, skoro prázdná
        galerie pod cenou byla hlavně matoucí. Co už nahrané je, se ale
        skrývat nesmí. */}
    {(!solo || photos.length > 0 || note) && (
    <div className="bg-ui-bg-subtle mt-3 flex flex-col gap-2 rounded-lg px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((url, index) => (
          <figure key={url} className="group relative m-0">
            <button
              type="button"
              title={index === 0 ? "Hlavní fotka varianty" : "Nastavit jako hlavní"}
              onClick={() => {
                if (index === 0) return;
                void saveMeta({
                  images: [url, ...photos.filter((entry) => entry !== url)],
                });
              }}
              className={`block size-12 overflow-hidden rounded-md ${
                index === 0 ? "shadow-borders-interactive-with-active" : "shadow-borders-base"
              }`}
            >
              <img src={url} alt="" className="size-full object-cover" />
            </button>
            <button
              type="button"
              title="Odebrat fotku"
              onClick={() =>
                void saveMeta({
                  images: photos.filter((entry) => entry !== url),
                })
              }
              className="bg-ui-bg-base text-ui-fg-muted hover:text-ui-fg-base shadow-borders-base absolute -right-1.5 -top-1.5 hidden size-4 items-center justify-center rounded-full text-[10px] leading-none group-hover:flex"
            >
              ×
            </button>
          </figure>
        ))}
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length) uploadPhotos.mutate(files);
            event.target.value = "";
          }}
        />
        <Button
          size="small"
          variant="secondary"
          isLoading={uploadPhotos.isPending}
          onClick={() => photoInput.current?.click()}
        >
          <Plus /> Fotka varianty
        </Button>
        <Text size="xsmall" className="text-ui-fg-muted">
          {photos.length
            ? "Zákazník je uvidí po zvolení tohohle provedení."
            : "Bez vlastních fotek platí fotky produktu."}
        </Text>
      </div>
      <div className="flex items-center gap-2">
        <FieldLabel>Poznámka</FieldLabel>
        <div className="min-w-0 flex-1">
          <InlineText
            value={note}
            placeholder="např. glazura kobalt, každý kus se liší — uvidí zákazník"
            onSave={(next) => saveMeta({ note: next || null })}
          />
        </div>
      </div>
    </div>
    )}
    </div>
  );
};

const AddVariantRow = ({
  productId,
  option,
  invalidate,
  solo = false,
  priceOnRequest = false,
}: {
  productId: string;
  /** Jediná volba produktu; null = produkt bez voleb (nebo s víc volbami). */
  option: NativeOption | null;
  invalidate: () => Promise<unknown>;
  /** Produkt má zatím jediné provedení — formulář se schová za tlačítko. */
  solo?: boolean;
  /** Cena po domluvě — nové provedení se zakládá bez ceny. */
  priceOnRequest?: boolean;
}) => {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  /*
   * U jediného provedení je přidávání výjimka, ne běžný úkon: 267 produktů
   * z 267 ho nikdy nepotřebovalo. Dvě prázdná pole pod cenou proto nestojí
   * otevřená — nabídne se tlačítko a věta, co to znamená.
   */
  const [open, setOpen] = useState(!solo);

  const add = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Varianta potřebuje název.");
      // Bez hodnoty ve volbě by Medusa variantu odmítla (viz addOptionValue).
      if (option) await addOptionValue(productId, option, title.trim());
      return sdk.client.fetch(`/admin/products/${productId}/variants`, {
        method: "POST",
        body: {
          title: title.trim(),
          ...(option ? { options: { [option.title]: title.trim() } } : {}),
          prices:
            price && !priceOnRequest
              ? [{ currency_code: "czk", amount: Number(price) }]
              : [],
          // The shop default: a sold-out piece keeps selling (stock goes
          // negative); the page's „Objednání bez kusů na skladu" switch turns it off.
          allow_backorder: true,
        },
      });
    },
    onSuccess: async () => {
      setTitle("");
      setPrice("");
      await invalidate();
      toast.success("Varianta přidána.");
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Přidání se nepodařilo.")),
  });

  if (!open) {
    return (
      <div className="mx-6 my-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button size="small" variant="secondary" onClick={() => setOpen(true)}>
          <Plus /> Přidat provedení
        </Button>
        <Text size="xsmall" className="text-ui-fg-muted">
          Pro víc velikostí nebo barev — každé provedení má vlastní cenu a
          sklad.
        </Text>
      </div>
    );
  }

  return (
    <div className="mx-6 my-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2">
      <Input
        size="small"
        className="min-w-40 flex-1"
        placeholder="Nové provedení (např. Modrá)"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      {priceOnRequest ? (
        <Text size="xsmall" className="text-ui-fg-muted">
          cena po domluvě
        </Text>
      ) : (
        <Input
          size="small"
          className="w-28"
          type="number"
          placeholder="Kč"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      )}
      <Button size="small" isLoading={add.isPending} onClick={() => add.mutate()}>
        Přidat
      </Button>
    </div>
  );
};

/**
 * Stav dopravy kusu pro kontrolu „Než publikujete".
 *
 * `none` = kus nemá profil dopravy, `empty` = profil má, ale pod ním není
 * žádná možnost dopravy (Domovní znamení, 31. 10.). Obojí shodí objednávku až
 * při dokončení, po zaplacení — viz widgets/product-shipping-profile.tsx.
 */
type ShippingCheck = {
  state: "ok" | "none" | "empty";
  profileName: string | null;
  /** Kam kus přeřadit, aby šel objednat; `null` = není kam (obchod nemá dopravu). */
  fixTarget: { id: string; name: string } | null;
  onFix: () => void;
  fixing: boolean;
};

/** „Než publikujete" + kupitelnost — one merged checklist, warnings only. */
const ReadinessCard = ({
  product,
  detail,
  inShop,
  onAddToShop,
  addingToShop,
  shipping,
}: {
  product: NativeProduct;
  detail: WorkbenchDetail | undefined;
  /** Je kus v kanálu, ze kterého čte obchod? `null` = ještě se načítá. */
  inShop: boolean | null;
  onAddToShop: () => void;
  addingToShop: boolean;
  /** `null` = ještě se načítá (nebo nejde zjistit) — pak se nic netvrdí. */
  shipping: ShippingCheck | null;
}) => {
  const variants = product.variants ?? [];
  const metadata = product.metadata ?? {};
  /*
   * Cena: „cena po domluvě“ (hlavně zakázky) cenu mít nemusí — 0 Kč nebo
   * prázdná je u ní v pořádku (Matěj, 3. 11. 2026). Jinak 0 Kč cenou není:
   * kus by šel koupit zadarmo. Výjimka je poukaz, jehož hodnota se volí
   * v košíku (lib/voucher.ts).
   */
  const priceOnRequest = metadata.price_on_request === true;
  const voucher =
    metadata.gift_voucher === true ||
    metadata.voucher_custom_amount === true ||
    metadata.voucher_custom_amount === "true";
  const czkPrices = variants
    .map(czkPrice)
    .filter((price): price is number => price !== null);
  const hasPrice =
    priceOnRequest ||
    czkPrices.some((price) => price > 0) ||
    (voucher && czkPrices.length > 0);
  const anyBackorder = variants.some((variant) => variant.allow_backorder);
  const allOut =
    detail !== undefined &&
    detail.variants.length > 0 &&
    detail.variants.every((variant) => (variant.available ?? 0) <= 0) &&
    !detail.production?.enabled &&
    !anyBackorder;

  const checks: {
    label: string;
    ok: boolean;
    why: string;
    action?: React.ReactNode;
  }[] = [
    /*
     * Obchod čte jen kanál svého publikovatelného klíče. Kus mimo něj je
     * „publikovaný", a přesto pro obchod neexistuje — stránka „nenalezeno",
     * v seznamu chybí (Domovní znamení, 28. 10.). Stav publikace to neukáže.
     */
    ...(inShop === null
      ? []
      : [
          {
            label: "Viditelné v obchodě",
            ok: inShop,
            why: "Kus není v prodejním kanálu obchodu — zákazník ho nenajde ani podle odkazu, i když je publikovaný.",
            action: (
              <Button
                size="small"
                variant="secondary"
                isLoading={addingToShop}
                onClick={onAddToShop}
              >
                Přidat do obchodu
              </Button>
            ),
          },
        ]),
    /*
     * Doprava, „aby to nemohlo spadnout" (Matěj, 3. 11. 2026). Nový kus
     * profil dostává sám (subscribers/default-shipping-profile.ts); tohle
     * chytí, co se rozbilo potom — přeřazení na prázdný profil, import.
     */
    ...(shipping === null
      ? []
      : [
          {
            label: "Doprava",
            ok: shipping.state === "ok",
            why:
              shipping.state === "none"
                ? "Kus nemá nastavenou dopravu — zákazník by zaplatil a objednávka by pak spadla."
                : `Doprava „${shipping.profileName ?? "?"}“ nemá žádnou možnost doručení — objednávka by spadla až po zaplacení.`,
            action: shipping.fixTarget ? (
              <Button
                size="small"
                variant="secondary"
                isLoading={shipping.fixing}
                onClick={shipping.onFix}
              >
                Nastavit běžnou dopravu ({shipping.fixTarget.name})
              </Button>
            ) : (
              <Text size="small" className="text-ui-fg-error">
                Obchod nemá žádnou dopravu, na kterou by šel kus přeřadit —
                ozvěte se prosím Matějovi.
              </Text>
            ),
          },
        ]),
    {
      label: "Fotografie",
      ok: Boolean(product.thumbnail || (product.images ?? []).length),
      why: "Bez fotky si kousek nikdo nekoupí.",
    },
    {
      label: "Cena",
      ok: hasPrice,
      why: czkPrices.length
        ? "Cena je 0 Kč — kus by šel koupit zadarmo. (U ceny po domluvě to nevadí.)"
        : "Bez ceny ho zákazník nekoupí. (U ceny po domluvě to nevadí.)",
    },
    {
      label: "Popis",
      ok: Boolean(product.description?.trim()),
      why: "Pár vět o kousku pomáhá i ve vyhledávání.",
    },
    {
      label: "Kategorie nebo kolekce",
      ok: Boolean((product.categories ?? []).length || product.collection_id),
      why: "Jinak ho zákazníci najdou jen přes vyhledávání.",
    },
    {
      label: "Kusy skladem",
      ok: !allOut,
      why: "Všechno je vyprodané, kus se nevyrábí na zakázku a objednání bez kusů na skladu je vypnuté — zákazník nemá co koupit.",
    },
    {
      label: "Hmotnost",
      ok: Boolean(product.weight),
      why: "Bez hmotnosti se cena dopravy počítá z výchozího odhadu.",
    },
  ];
  // Vidět je jen to, co chybí — splněné body nikoho nezajímají (Matěj, 3. 11.).
  const missing = checks.filter((check) => !check.ok);

  if (!missing.length) {
    return (
      <section className="px-6 py-2.5">
        <Text size="small" weight="plus" className="text-ui-tag-green-text">
          ✓ Připraveno k prodeji
        </Text>
      </section>
    );
  }

  /*
   * Hned pod hlavičkou, ale úsporně (17. 11. 2026): jeden řádek na upozornění
   * — co chybí, proč, a případně tlačítko, které to spraví. Dřív to byla
   * vysoká karta v pravém sloupci se štítkem „Chybí" u každého bodu.
   */
  return (
    <section className="bg-ui-tag-orange-bg px-6 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Text size="small" weight="plus">
          Než publikujete — chybí {missing.length}×
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle">
          Publikovat můžete i tak, je to jen upozornění.
        </Text>
      </div>
      <ul className="mt-1.5 flex flex-col">
        {missing.map((check) => (
          <li
            key={check.label}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1"
          >
            <span
              aria-hidden
              className="bg-ui-tag-orange-icon size-2 shrink-0 rounded-full"
            />
            <Text size="small" className="min-w-0 flex-1">
              <span className="font-medium">{check.label}</span>
              <span className="text-ui-fg-subtle"> — {check.why}</span>
            </Text>
            {check.action}
          </li>
        ))}
      </ul>
    </section>
  );
};

const ProduktDetailInner = ({ productId }: { productId: string }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  /* Odkud přišla a co je další v řadě — z pořadí posledního výpisu. */
  const sousedi = useSousedi("produkty", productId);
  const expert = useExpertMode();
  /* Prohlížeč fotek galerie: index zvětšené fotky, `null` = zavřeno. */
  const [viewing, setViewing] = useState<number | null>(null);
  /* Druhý krok mazání fotky v prohlížeči — platí jen pro tuhle adresu. */
  const [confirmDeleteUrl, setConfirmDeleteUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const productQuery = useQuery<{ product: NativeProduct }>({
    queryKey: ["produkt", productId],
    queryFn: () =>
      sdk.client.fetch(`/admin/products/${productId}?fields=${PRODUCT_FIELDS}`),
    retry: false,
    refetchOnWindowFocus: true,
  });

  const detailQuery = useQuery<WorkbenchDetail>({
    queryKey: ["produkt-workbench", productId],
    queryFn: () => sdk.client.fetch(`/admin/workbench/products/${productId}`),
    refetchOnWindowFocus: true,
  });

  const collectionsQuery = useQuery<{ collections: { id: string; title: string }[] }>({
    queryKey: ["produkt-collections"],
    queryFn: () =>
      sdk.client.fetch(`/admin/collections?limit=100&fields=id,title`),
    staleTime: 5 * 60_000,
  });

  const categoriesQuery = useQuery<{
    product_categories: {
      id: string;
      name: string;
      is_active: boolean;
      /** Vazba na kolekci z admin Rozdělení — stejná konvence čte i menu obchodu. */
      metadata?: Record<string, unknown> | null;
    }[];
  }>({
    queryKey: ["produkt-categories"],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/product-categories?limit=100&fields=id,name,is_active,metadata`
      ),
    staleTime: 5 * 60_000,
  });

  /*
   * Kanály, ze kterých čte obchod = kanály jeho (nezrušených) publikovatelných
   * klíčů. Ne výchozí kanál obchodu — rozhoduje klíč, který storefront posílá.
   */
  const shopChannelsQuery = useQuery<{
    api_keys: {
      id: string;
      revoked_at: string | null;
      sales_channels?: { id: string }[];
    }[];
  }>({
    queryKey: ["produkt-shop-channels"],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/api-keys?type=publishable&limit=50&fields=id,revoked_at,*sales_channels`
      ),
    staleTime: 5 * 60_000,
  });
  const shopChannelIds = useMemo(
    () =>
      shopChannelsQuery.data
        ? new Set(
            shopChannelsQuery.data.api_keys
              .filter((key) => !key.revoked_at)
              .flatMap((key) => (key.sales_channels ?? []).map((sc) => sc.id))
          )
        : null,
    [shopChannelsQuery.data]
  );

  const salesChannelsQuery = useQuery<{
    sales_channels: { id: string; name: string; is_disabled: boolean }[];
  }>({
    queryKey: ["produkt-sales-channels"],
    queryFn: () =>
      sdk.client.fetch(`/admin/sales-channels?limit=50&fields=id,name,is_disabled`),
    staleTime: 5 * 60_000,
  });

  // The material offer = every material the catalogue already uses; adding a
  // new one on any product teaches it to the whole admin.
  const materialsQuery = useQuery<{ materials: string[] }>({
    queryKey: ["produkt-materials"],
    queryFn: () => sdk.client.fetch(`/admin/workbench/materials`),
    staleTime: 5 * 60_000,
  });
  const [addingMaterial, setAddingMaterial] = useState(false);

  /*
   * Doprava pro kontrolu „Než publikujete". Klíče a adresy schválně stejné
   * jako widget Doprava na nativní stránce (widgets/product-shipping-profile.tsx),
   * ať se obě místa obnovují spolu a nečtou dvakrát.
   */
  const shippingProfileQuery = useQuery<{
    product: { id: string; shipping_profile?: { id: string; name?: string } | null };
  }>({
    queryKey: ["product-shipping-profile", productId],
    queryFn: () =>
      sdk.client.fetch(`/admin/products/${productId}?fields=id,*shipping_profile`),
    refetchOnWindowFocus: true,
  });
  const shippingProfilesQuery = useQuery<{
    shipping_profiles: { id: string; name: string; type?: string | null }[];
  }>({
    queryKey: ["shipping-profiles"],
    queryFn: () => sdk.client.fetch("/admin/shipping-profiles?limit=100"),
    staleTime: 5 * 60_000,
  });
  const shippingOptionsQuery = useQuery<{
    shipping_options: { id: string; shipping_profile_id?: string | null }[];
  }>({
    queryKey: ["shipping-options-per-profile"],
    queryFn: () =>
      sdk.client.fetch(
        "/admin/shipping-options?limit=1000&fields=id,name,shipping_profile_id"
      ),
    staleTime: 5 * 60_000,
  });

  const product = productQuery.data?.product;
  const detail = detailQuery.data;

  /** Kolik možností dopravy leží na profilu; `null` = ještě se neví. */
  const optionsOnProfile = (profileId: string): number | null => {
    const all = shippingOptionsQuery.data?.shipping_options;
    if (!all) return null;
    return all.filter((option) => option.shipping_profile_id === profileId).length;
  };
  const currentProfile = shippingProfileQuery.data?.product?.shipping_profile ?? null;
  /*
   * Kam kus přeřadit: výchozí profil, má-li dopravu; jinak jediný profil
   * s dopravou. Při víc kandidátech se nehádá (stejně jako
   * lib/shipping-profile-default.ts) — špatný profil = špatná doprava.
   */
  const profilesWithOptions = (shippingProfilesQuery.data?.shipping_profiles ?? []).filter(
    (profile) => (optionsOnProfile(profile.id) ?? 0) > 0
  );
  const shippingFixTarget =
    profilesWithOptions.find((profile) => profile.type === "default") ??
    (profilesWithOptions.length === 1 ? profilesWithOptions[0] : null);
  const shippingState: ShippingCheck["state"] | null =
    !shippingProfileQuery.data || !shippingOptionsQuery.data
      ? null
      : !currentProfile?.id
        ? "none"
        : optionsOnProfile(currentProfile.id) === 0
          ? "empty"
          : "ok";

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["produkt", productId] });
    await queryClient.invalidateQueries({ queryKey: ["produkt-workbench", productId] });
    await queryClient.invalidateQueries({ queryKey: ["produkt-materials"] });
  };

  // Native fields — title, description, zařazení, rozměry… One mutation, the
  // patch decides. Never carries the shop's own switches (those merge below).
  const saveProduct = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      sdk.client.fetch(`/admin/products/${productId}`, {
        method: "POST",
        body: patch,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Změna uložena.");
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  const saveFlags = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      sdk.client.fetch(`/admin/workbench/products/${productId}/flags`, {
        method: "POST",
        body: patch,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Změna uložena.");
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  /*
   * „Bez ceny — cena po domluvě“. Zapnutí udělá z kusu zakázku (backend zapne
   * profil výroby i metadata.made_to_order), proto se po něm obnoví i dotazy
   * na zakázkový profil a seznamy — štítek „zakázka" a oddíl Zakázková výroba
   * se ukážou hned. Vypnutí zakázku nechá (vypíná se v Zakázkové výrobě).
   */
  const togglePriceOnRequest = useMutation({
    mutationFn: (next: boolean) =>
      sdk.client.fetch(`/admin/workbench/products/${productId}/flags`, {
        method: "POST",
        body: { price_on_request: next },
      }),
    onSuccess: async (_data, next) => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["production-profile", productId] });
      await queryClient.invalidateQueries({ queryKey: ["product-type-tools", productId] });
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      toast.success(
        next
          ? "Cena po domluvě zapnutá — kus je teď zakázka, zákazník ho objedná za 0 Kč."
          : "Cena po domluvě vypnutá — kus se zase prodává za cenu u provedení."
      );
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Změna se nepodařila.")),
  });

  /*
   * Přepínač „Na zakázku" ve Vlastnostech prodeje.
   *
   * Zakázka se do té doby zapínala jen dialogem s osmi poli („Nastavit
   * zakázku"), takže ze 27 kusů, co mají „na zakázku" v názvu, ji měl
   * doopravdy jeden — zbytek se prodával jako běžné zboží, bez zálohy.
   * Jedno kliknutí zakázku zapne na výchozích podmínkách (záloha 25 %,
   * 14–42 dní), podrobnosti zůstávají v oddílu Zakázková výroba níž.
   * Vypnutí podmínky NEMAŽE — backend je při částečném PATCHi zachová,
   * takže opětovné zapnutí vrátí, co bylo domluvené.
   */
  const toggleMadeToOrder = useMutation({
    mutationFn: (next: boolean) =>
      sdk.client.fetch(`/admin/made-to-order/products/${productId}`, {
        method: "PATCH",
        body: { enabled: next },
      }),
    onSuccess: async (_data, next) => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["production-profile", productId] });
      await queryClient.invalidateQueries({ queryKey: ["product-type-tools", productId] });
      await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
      toast.success(
        next
          ? "Kus je teď zakázka — zákazník zaplatí zálohu a počká na výrobu."
          : "Zakázková výroba vypnutá — kus se prodává ze skladu."
      );
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Zakázku se nepodařilo přepnout.")),
  });

  // One switch for the whole piece: backorder is a per-variant fact in the
  // catalog, but the merchant thinks per product — so the toggle writes every
  // variant at once through the native batch endpoint.
  const toggleBackorder = useMutation({
    mutationFn: (next: boolean) =>
      sdk.client.fetch(`/admin/products/${productId}/variants/batch`, {
        method: "POST",
        body: {
          update: (product?.variants ?? []).map((variant) => ({
            id: variant.id,
            allow_backorder: next,
          })),
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Změna uložena.");
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  // Oprava z kontroly „Doprava" — stejný zápis, jakým profil mění widget Doprava.
  const fixShipping = useMutation({
    mutationFn: (shippingProfileId: string) =>
      sdk.client.fetch(`/admin/products/${productId}`, {
        method: "POST",
        body: { shipping_profile_id: shippingProfileId },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["product-shipping-profile", productId],
      });
      toast.success("Doprava nastavena — kus jde objednat.");
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Dopravu se nepodařilo nastavit.")),
  });

  /*
   * A quick price cut for a damaged piece: every variant's CZK price drops by
   * the given percentage (foreign currencies re-derive from the daily ČNB
   * job), the pre-discount prices are remembered in metadata, and by default
   * the piece is flagged Poškozený kus (`clearance`) — the same switch the
   * workbenches use.
   */
  const applyDiscount = useMutation({
    mutationFn: async (input: { percent: number; markClearance: boolean }) => {
      const before: Record<string, number> = {};
      for (const variant of product?.variants ?? []) {
        const price = czkPrice(variant);
        if (price === null) continue;
        before[variant.id] = price;
        const next = Math.max(1, Math.round((price * (100 - input.percent)) / 100));
        await sdk.client.fetch(`/admin/products/${productId}/variants/${variant.id}`, {
          method: "POST",
          body: {
            prices: [
              { currency_code: "czk", amount: next },
              ...(variant.prices ?? [])
                .filter((entry) => String(entry.currency_code).toLowerCase() !== "czk")
                .map((entry) => ({
                  currency_code: entry.currency_code,
                  amount: entry.amount,
                })),
            ],
          },
        });
      }
      await sdk.client.fetch(`/admin/products/${productId}`, {
        method: "POST",
        body: { metadata: { price_before_discount: before } },
      });
      if (input.markClearance) {
        await sdk.client.fetch(`/admin/workbench/products/${productId}/flags`, {
          method: "POST",
          body: { clearance: true },
        });
      }
    },
    onSuccess: async (_, input) => {
      await invalidate();
      toast.success(`Cena snížena o ${input.percent} %.`);
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Slevu se nepodařilo nastavit.")),
  });

  /*
   * She throws series — six mugs from one glaze test. „Duplikovat" copies
   * everything describable (texts, zařazení, flags, photos, variants with
   * prices) into a DRAFT with no SKUs and no stock, and jumps straight to it.
   */
  const duplicateProduct = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Produkt se ještě načítá.")
      const metadata = (product.metadata ?? {}) as Record<string, unknown>
      const copiedFlags: Record<string, unknown> = {}
      for (const key of [
        "cod_allowed",
        "fragile",
        "frost_resistant",
        "shipping_class",
        "is_personalized",
        "packaging_price",
        "dimensions",
        "backorder_note",
      ]) {
        if (metadata[key] !== undefined) copiedFlags[key] = metadata[key]
      }
      const optionTitle = product.options?.[0]?.title ?? "Provedení"
      /*
       * Doprava: kopie jede jako originál (třeba křehký profil), ale jen když
       * pod jeho profilem nějaká doprava je — rozbitý stav se nekopíruje.
       * Jinak běžný profil; a kdyby se nevědělo nic, doplní ho subscriber
       * default-shipping-profile při vzniku produktu.
       */
      const copiedProfileId =
        currentProfile?.id && (optionsOnProfile(currentProfile.id) ?? 0) > 0
          ? currentProfile.id
          : shippingFixTarget?.id
      const created = await sdk.client.fetch<{ product: { id: string } }>(
        `/admin/products`,
        {
          method: "POST",
          body: {
            title: `${product.title} (kopie)`,
            subtitle: product.subtitle ?? undefined,
            description: product.description ?? undefined,
            material: product.material ?? undefined,
            weight: product.weight ?? undefined,
            length: product.length ?? undefined,
            height: product.height ?? undefined,
            width: product.width ?? undefined,
            status: "draft",
            ...(copiedProfileId ? { shipping_profile_id: copiedProfileId } : {}),
            collection_id: product.collection_id ?? undefined,
            categories: (product.categories ?? []).map((category) => ({
              id: category.id,
            })),
            ...(product.thumbnail ? { thumbnail: product.thumbnail } : {}),
            images: (product.images ?? []).map((image) => ({ url: image.url })),
            options: [
              {
                title: optionTitle,
                values: (product.variants ?? []).map(
                  (variant) => variant.title ?? "Standardní"
                ),
              },
            ],
            variants: (product.variants ?? []).map((variant) => ({
              title: variant.title ?? "Standardní",
              options: { [optionTitle]: variant.title ?? "Standardní" },
              manage_inventory: true,
              // A copy has to sell the way the original does — without this the
              // duplicate stops at zero. The subscriber would fix it a moment
              // later anyway; saying it here keeps the payload honest.
              allow_backorder: true,
              prices: (variant.prices ?? []).map((price) => ({
                currency_code: price.currency_code,
                amount: price.amount,
              })),
              ...(variant.metadata ? { metadata: variant.metadata } : {}),
            })),
            ...(Object.keys(copiedFlags).length
              ? { metadata: copiedFlags }
              : {}),
          },
        }
      )
      return created.product.id
    },
    onSuccess: (newId) => {
      toast.success("Kopie založena jako koncept — jste na ní.")
      navigate(`/produkt/${newId}`)
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Kopii se nepodařilo založit.")
      ),
  })

  // Deleting is forever — orders keep their snapshots, but the piece is gone
  // from the catalogue. Archiv is the reversible sibling next door.
  const removeProduct = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/products/${productId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Produkt smazán.");
      navigate("/produkty-workbench");
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Smazání se nepodařilo.")),
  });

  // Same two-step contract as the shared ArchiveToggle: the flag hides the
  // piece from the working lists, draft status takes it off the shop — and
  // restoring brings back a *draft* on purpose, so nothing returns to sale
  // because somebody clicked twice.
  const archive = useMutation({
    mutationFn: async (next: boolean) => {
      await sdk.client.fetch(`/admin/workbench/products/${productId}/flags`, {
        method: "POST",
        body: { archived: next },
      });
      if (next) {
        await sdk.client.fetch(`/admin/products/${productId}`, {
          method: "POST",
          body: { status: "draft" },
        });
      }
    },
    onSuccess: async (_, next) => {
      await invalidate();
      toast.success(
        next
          ? "Archivováno — zmizelo z obchodu i ze seznamů."
          : "Obnoveno jako koncept. Do obchodu ho vrátíte zveřejněním."
      );
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Změna se nepodařila.")),
  });

  const uploadImages = useMutation({
    mutationFn: async (files: File[]) => {
      const result = await sdk.admin.upload.create({ files });
      const urls = (result.files ?? [])
        .map((file: { url?: string }) => file.url)
        .filter(Boolean) as string[];
      if (!urls.length) throw new Error("Fotky se nepodařilo nahrát.");
      const existing = (product?.images ?? []).map((image) => ({
        id: image.id,
        url: image.url,
      }));
      return sdk.client.fetch(`/admin/products/${productId}`, {
        method: "POST",
        body: {
          images: [...existing, ...urls.map((url) => ({ url }))],
          ...(product?.thumbnail ? {} : { thumbnail: urls[0] }),
        },
      });
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Fotky nahrány.");
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Nahrání se nepodařilo.")),
  });

  if (productQuery.isLoading) {
    return (
      <Container className="p-0">
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </Container>
    );
  }

  if (productQuery.isError || !product) {
    return (
      <Container className="p-0">
        <EmptyState
          title="Produkt nebyl nalezen"
          description="Možná byl smazán, nebo je odkaz starý."
          action={
            <Button size="small" variant="secondary" asChild>
              <Link to="/produkty-workbench">Zpět na Produkty</Link>
            </Button>
          }
        />
      </Container>
    );
  }

  const isPublished = product.status === "published";
  const archived = flagOf(product, "archived");
  const productChannelIds = (product.sales_channels ?? []).map((sc) => sc.id);
  const inShop = shopChannelIds
    ? productChannelIds.some((id) => shopChannelIds.has(id))
    : null;
  const setChannels = (ids: string[]) =>
    saveProduct.mutate({ sales_channels: ids.map((id) => ({ id })) });
  const addToShop = () => {
    const target = shopChannelIds ? [...shopChannelIds][0] : undefined;
    if (!target) {
      toast.error("Obchod nemá žádný prodejní kanál — zkontrolujte publikovatelný klíč.");
      return;
    }
    setChannels([...new Set([...productChannelIds, target])]);
  };

  const clearance = flagOf(product, "clearance");
  const production = detail?.production ?? null;
  const isBundle = (detail?.memberships.bundles ?? []).length > 0;
  const packagingPrice =
    typeof product.metadata?.packaging_price === "number"
      ? (product.metadata.packaging_price as number)
      : null;
  const backorderNote =
    typeof product.metadata?.backorder_note === "string"
      ? (product.metadata.backorder_note as string)
      : null;
  const dimensions =
    typeof product.metadata?.dimensions === "string"
      ? (product.metadata.dimensions as string)
      : null;
  const clearanceDamage =
    typeof product.metadata?.clearance_damage === "string"
      ? (product.metadata.clearance_damage as string)
      : null;
  const madeToOrderPrompt =
    typeof product.metadata?.made_to_order_prompt === "string"
      ? (product.metadata.made_to_order_prompt as string)
      : null;
  const backorderAll =
    (product.variants ?? []).length > 0 &&
    (product.variants ?? []).every((variant) => variant.allow_backorder);
  const pricedCzk = (product.variants ?? [])
    .map(czkPrice)
    .filter((price): price is number => price !== null);
  const priceMin = pricedCzk.length ? Math.min(...pricedCzk) : null;
  const priceMax = pricedCzk.length ? Math.max(...pricedCzk) : null;
  const variants = product.variants ?? [];
  const priceOnRequest = product.metadata?.price_on_request === true;
  const singleOption =
    (product.options ?? []).length === 1 ? product.options![0] : null;
  const stockByVariant = new Map(
    (detail?.variants ?? []).map((variant) => [variant.id, variant])
  );
  const wishlistTotal = (detail?.variants ?? []).reduce(
    (sum, variant) => sum + variant.wishlist_count,
    0
  );
  const waitingTotal = (detail?.variants ?? []).reduce(
    (sum, variant) => sum + variant.waiting_customers,
    0
  );
  const categories = categoriesQuery.data?.product_categories ?? [];
  const selectedCategories = new Set((product.categories ?? []).map((c) => c.id));

  const toggleCategory = (categoryId: string) => {
    const current = (product.categories ?? []).map((c) => ({ id: c.id }));
    const next = selectedCategories.has(categoryId)
      ? current.filter((c) => c.id !== categoryId)
      : [...current, { id: categoryId }];
    saveProduct.mutate({ categories: next });
  };

  const removeImage = (url: string) => {
    const remaining = (product.images ?? []).filter((image) => image.url !== url);
    saveProduct.mutate({
      images: remaining.map((image) => ({ id: image.id, url: image.url })),
      ...(product.thumbnail === url
        ? { thumbnail: remaining[0]?.url ?? null }
        : {}),
    });
  };

  /* Fotky galerie; bez nich aspoň hlavní fotka, ať jde zvětšit z hlavičky. */
  const gallery = (product.images ?? []).map((image) => image.url);
  const viewerPhotos = gallery.length
    ? gallery
    : product.thumbnail
      ? [product.thumbnail]
      : [];
  const openMainPhoto = () => {
    if (!viewerPhotos.length) {
      fileInput.current?.click();
      return;
    }
    setViewing(Math.max(0, viewerPhotos.indexOf(product.thumbnail ?? "")));
  };

  /* Hlavička: cena a sklad jednou větou — dvě věci, které kontroluje první. */
  const priceLabel =
    priceMin === null
      ? null
      : priceMin === priceMax
        ? formatCzk(priceMin)
        : `${formatCzk(priceMin)} – ${formatCzk(priceMax!)}`;
  const stockKnown = (detail?.variants ?? []).some(
    (variant) => variant.available !== null
  );
  const stockTotal = (detail?.variants ?? []).reduce(
    (sum, variant) => sum + Math.max(0, variant.available ?? 0),
    0
  );
  const categoryPath =
    [
      product.collection?.title,
      ...(product.categories ?? []).map((category) => category.name),
    ]
      .filter(Boolean)
      .join(" · ") || "Bez zařazení";
  const detailImages = Array.isArray(product.metadata?.detail_images)
    ? (product.metadata.detail_images as unknown[]).filter(
        (url): url is string => typeof url === "string"
      )
    : [];
  const currentShippingClass = shippingClassOfProduct(product);

  return (
    <Container className="divide-y p-0">
      {/* Zvětšená fotka galerie — úkony (hlavní, smazat) jsou tady, ne pod
          každým náhledem. */}
      <PhotoViewer
        title={product.title}
        photos={viewerPhotos}
        index={viewing}
        onIndexChange={(next) => {
          setViewing(next);
          setConfirmDeleteUrl(null);
        }}
        onClose={() => {
          setViewing(null);
          setConfirmDeleteUrl(null);
        }}
        caption={(index) =>
          viewerPhotos[index] === product.thumbnail ? (
            <Badge size="2xsmall" color="blue">
              Hlavní fotka
            </Badge>
          ) : null
        }
        actions={(index) => {
          const url = viewerPhotos[index];
          // Jen hlavní fotka bez galerie — není co nastavovat ani mazat.
          if (!gallery.includes(url)) return null;
          if (confirmDeleteUrl === url) {
            return (
              <>
                <Text size="small" className="text-ui-fg-subtle">
                  Opravdu smazat tuhle fotku?
                </Text>
                <Button variant="secondary" onClick={() => setConfirmDeleteUrl(null)}>
                  Ne
                </Button>
                <Button
                  variant="danger"
                  isLoading={saveProduct.isPending}
                  onClick={() => {
                    removeImage(url);
                    setConfirmDeleteUrl(null);
                  }}
                >
                  <Trash /> Smazat
                </Button>
              </>
            );
          }
          return (
            <>
              {url !== product.thumbnail && (
                <Button
                  variant="secondary"
                  isLoading={saveProduct.isPending}
                  onClick={() => saveProduct.mutate({ thumbnail: url })}
                >
                  Nastavit jako hlavní
                </Button>
              )}
              <Button
                variant="secondary"
                className="text-ui-fg-error"
                onClick={() => setConfirmDeleteUrl(url)}
              >
                <Trash /> Smazat fotku
              </Button>
            </>
          );
        }}
      />

      {/* ————— Hlavička: název, stav, cena, sklad — a jedno hlavní tlačítko ————— */}
      <header className="px-6 pb-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          {/*
            Zpět přesně tam, odkud přišla — i s filtry — a vedle toho krok
            na sousední kus. Bez toho je procházení katalogu u každého
            produktu dvojí kliknutí navíc (8. 11. 2026, lib/seznam-kontext).
            Když se do výpisu nevejde (přišla odjinud), zbude původní odkaz.
          */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              to={sousedi.zpet || "/produkty-workbench"}
              className="text-ui-fg-muted txt-small hover:text-ui-fg-subtle inline-flex min-h-[40px] items-center"
            >
              ← {sousedi.zpet ? "Zpět na výpis" : "Produkty"}
            </Link>
            {sousedi.poradi ? (
              <div className="flex items-center gap-x-1">
                <Button
                  size="small"
                  variant="transparent"
                  className="min-h-[40px] min-w-[40px]"
                  disabled={!sousedi.predchozi}
                  onClick={() =>
                    sousedi.predchozi && navigate(`/produkt/${sousedi.predchozi}`)
                  }
                  aria-label="Předchozí výrobek"
                >
                  ‹
                </Button>
                <Text size="xsmall" className="text-ui-fg-muted tabular-nums">
                  {sousedi.poradi.index} / {sousedi.poradi.celkem}
                </Text>
                <Button
                  size="small"
                  variant="transparent"
                  className="min-h-[40px]"
                  disabled={!sousedi.dalsi}
                  onClick={() =>
                    sousedi.dalsi && navigate(`/produkt/${sousedi.dalsi}`)
                  }
                  aria-label="Další výrobek"
                >
                  Další ›
                </Button>
              </div>
            ) : null}
          </div>
          {/* Jednou pro celou stránku místo „ukládá se při opuštění pole"
              u každého oddílu (Matěj, 3. 11. 2026). */}
          <Text size="xsmall" className="text-ui-fg-muted">
            Změny se ukládají samy — stačí opustit pole nebo přepnout přepínač.
          </Text>
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          {/* basis-80: na telefonu se tlačítka zalomí pod název, ne vedle něj. */}
          <div className="flex min-w-0 flex-1 basis-80 items-start gap-4">
            <button
              type="button"
              title={viewerPhotos.length ? "Zvětšit fotku" : "Nahrát fotky"}
              className="bg-ui-bg-subtle shadow-borders-base size-16 shrink-0 cursor-zoom-in overflow-hidden rounded-lg"
              onClick={openMainPhoto}
            >
              {product.thumbnail ? (
                <img
                  src={product.thumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-ui-fg-muted flex h-full w-full items-center justify-center">
                  <Photo />
                </div>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <InlineText
                value={product.title}
                required
                placeholder="Název produktu"
                inputClassName="txt-large font-medium"
                onSave={(next) => saveProduct.mutateAsync({ title: next })}
              />
              {/* Stav, cena, sklad — co si u kusu kontroluje nejdřív. */}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <Badge
                  size="small"
                  color={isPublished ? "green" : "grey"}
                  title={
                    isPublished
                      ? "Zákazníci ho v obchodě vidí a můžou koupit."
                      : "Zákazníci ho v obchodě nevidí, dokud ho nepublikujete."
                  }
                >
                  {isPublished ? "Publikováno" : "Koncept — zákazník ho nevidí"}
                </Badge>
                {!priceOnRequest && (
                  <Text size="base" weight="plus" className="tabular-nums">
                    {priceLabel ?? "Bez ceny"}
                  </Text>
                )}
                {stockKnown && (
                  <Text
                    size="small"
                    weight="plus"
                    className={
                      stockTotal > 0 ? "text-ui-fg-subtle" : "text-ui-tag-orange-text"
                    }
                  >
                    {stockTotal > 0 ? `${pieces(stockTotal)} skladem` : "Není skladem"}
                  </Text>
                )}
                {/* Štítky zůstávají všechny (Matěj, 3. 11.) — jen řečí, kterou
                    Lucie čte bez překladu: co kus je a jestli ho zákazník vidí. */}
                {production?.enabled && (
                  <Badge size="2xsmall" color="purple">
                    Na zakázku
                  </Badge>
                )}
                {priceOnRequest && (
                  <Badge size="2xsmall" color="purple">
                    Cena po domluvě
                  </Badge>
                )}
                {isBundle && (
                  <Badge size="2xsmall" color="blue">
                    Součást balíčku
                  </Badge>
                )}
                {clearance && (
                  <Badge size="2xsmall" color="orange">
                    Poškozený kus
                  </Badge>
                )}
                {archived && (
                  <Badge size="2xsmall" color="red">
                    V archivu
                  </Badge>
                )}
                {expert && <CopyId value={product.id} />}
              </div>
              <Text size="small" className="text-ui-fg-subtle mt-1 truncate">
                {categoryPath}
              </Text>
            </div>
          </div>

          {/*
            Jedno hlavní tlačítko (17. 11. 2026): u publikovaného kusu
            „Zobrazit v obchodě", u konceptu „Publikovat". Duplikovat, Skrýt
            z obchodu, sleva, archiv i smazání jsou pod „…".
          */}
          <div className="flex items-center gap-2">
            {isPublished ? (
              detail?.store_url && (
                <Button variant="primary" className="min-h-[40px]" asChild>
                  <a href={detail.store_url} target="_blank" rel="noreferrer">
                    Zobrazit v obchodě <ArrowUpRightOnBox />
                  </a>
                </Button>
              )
            ) : (
              <Button
                variant="primary"
                className="min-h-[40px]"
                isLoading={saveProduct.isPending}
                onClick={() => saveProduct.mutate({ status: "published" })}
              >
                Publikovat
              </Button>
            )}
            <ProductDetailMenu
              productId={product.id}
              productTitle={product.title}
              priceLabel={priceLabel}
              damaged={clearance}
              archived={archived}
              isPublished={isPublished}
              storeUrl={detail?.store_url ?? null}
              pending={{
                duplicate: duplicateProduct.isPending,
                visibility: saveProduct.isPending,
                discount: applyDiscount.isPending,
                archive: archive.isPending,
                remove: removeProduct.isPending,
              }}
              onDuplicate={() => duplicateProduct.mutate()}
              onSetPublished={(next) =>
                saveProduct.mutate({ status: next ? "published" : "draft" })
              }
              onDiscount={(input) => applyDiscount.mutate(input)}
              onArchive={(next) => archive.mutate(next)}
              onDelete={() => removeProduct.mutate()}
            />
          </div>
        </div>
      </header>

      {/* Co chybí k prodeji — hned pod hlavičkou, jeden řádek na bod. */}
      <ReadinessCard
        product={product}
        detail={detail}
        inShop={inShop}
        onAddToShop={addToShop}
        addingToShop={saveProduct.isPending}
        shipping={
          shippingState === null
            ? null
            : {
                state: shippingState,
                profileName: currentProfile?.name ?? null,
                fixTarget: shippingFixTarget
                  ? { id: shippingFixTarget.id, name: shippingFixTarget.name }
                  : null,
                onFix: () => {
                  if (shippingFixTarget) fixShipping.mutate(shippingFixTarget.id);
                },
                fixing: fixShipping.isPending,
              }
        }
      />

      {/*
        Rozvržení (17. 11. 2026, „nejdůležitější nahoře"):
          hlavní sloupec nahoře — Cena a sklad, Fotky, Popis, Zařazení
          pravý sloupec        — Vlastnosti prodeje, Materiál a rozměry
          hlavní sloupec dole  — sbalené zřídka používané věci, Statistiky
        Na úzkém displeji jdou pod sebou v pořadí DOM, tedy horní část,
        vlastnosti prodeje a teprve pak statistiky. Pravý sloupec se roztáhne
        přes oba řádky (svislá čára vede až dolů); zbylé místo bere druhý řádek.
      */}
      <div className="grid xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr]">
        {/* ————— Hlavní sloupec, nahoře: s čím se denně pracuje ————— */}
        <div className="divide-y xl:col-start-1 xl:row-start-1">
          <section className="py-5">
            <div className="px-6">
              <Heading level="h2">
                {variants.length === 1 ? "Cena a sklad" : "Provedení a ceny"}
              </Heading>
              {variants.length > 1 && (
                <Text size="small" className="text-ui-fg-subtle mt-1">
                  Každé provedení má vlastní název, cenu a sklad.
                </Text>
              )}
            </div>
            {/* Hlavička sloupců dává smysl jen nad tabulkou. */}
            {variants.length > 1 && (
              <div className="mt-4 hidden gap-2 px-6 pb-1 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_150px_170px_auto]">
                <FieldLabel>Název</FieldLabel>
                <FieldLabel>Kód</FieldLabel>
                <FieldLabel>Cena</FieldLabel>
                <FieldLabel>Skladem</FieldLabel>
                <FieldLabel>Naskladnit</FieldLabel>
                <span />
              </div>
            )}
            <div
              className={
                variants.length > 1 ? "divide-y border-t" : "mt-4"
              }
            >
              {variants.map((variant) => (
                <VariantRow
                  key={variant.id}
                  productId={product.id}
                  variant={variant}
                  stock={stockByVariant.get(variant.id)}
                  canDelete={variants.length > 1}
                  expert={expert}
                  invalidate={invalidate}
                  solo={variants.length === 1}
                  priceOnRequest={priceOnRequest}
                  option={singleOption}
                  siblings={variants.filter((other) => other.id !== variant.id)}
                />
              ))}
            </div>
            <AddVariantRow
              productId={product.id}
              option={singleOption}
              invalidate={invalidate}
              solo={variants.length === 1}
              priceOnRequest={priceOnRequest}
            />
            {/* Dva přepínače, které mění, jak se cena a sklad chovají —
                patří k nim, ne mezi vlastnosti prodeje. */}
            <div className="mx-6 mt-1 divide-y border-t">
              {/* Cena po domluvě (metadata.price_on_request) — jediné místo,
                  kde se zapíná. Pravidlo z kontroly „Než publikujete": u ceny
                  po domluvě cena chybět smí (0 Kč nevadí). */}
              <FlagRow
                label="Bez ceny — cena po domluvě"
                description={
                  priceOnRequest
                    ? "Cenu vyplňovat nemusíte (0 Kč nevadí) — zákazník objedná za 0 Kč a cenu mu pošlete z objednávky. Kus je zakázka."
                    : "Když cenu domlouváte až po objednávce (hlavně u zakázek). Kus se stane zakázkou a cenu vyplňovat nemusíte — stačí 0 Kč."
                }
                checked={priceOnRequest}
                disabled={togglePriceOnRequest.isPending}
                onChange={(next) => togglePriceOnRequest.mutate(next)}
              />
              {/* Jeden přepínač; zpráva pro zákazníka jen když je zapnutý.
                  Uložená zpráva se vypnutím nemaže — po zapnutí je zpátky. */}
              <div>
                <FlagRow
                  label="Objednání bez kusů na skladu"
                  description="Zákazník může koupit produkt, který není na skladu, ale uvidí zprávu, že to bude trvat déle."
                  checked={backorderAll}
                  disabled={toggleBackorder.isPending || variants.length === 0}
                  onChange={(next) => toggleBackorder.mutate(next)}
                />
                {backorderAll ? (
                  <div className="flex flex-col gap-2 pb-3">
                    <FieldRow
                      label="Zpráva pro zákazníka"
                      hint="Ukáže se u kusu, který není skladem, vedle „Na objednávku“. Sklad pak jde do mínusu — uvidíte, kolik kusů dlužíte."
                    >
                      <InlineText
                        value={backorderNote}
                        placeholder="např. Vyrobíme pro vás do 3 týdnů."
                        onSave={(next) =>
                          saveFlags.mutateAsync({ backorder_note: next || null })
                        }
                      />
                    </FieldRow>
                    {clearance && (
                      <Text size="small" className="text-ui-fg-error">
                        Pozor: poškozený kus se po prodeji sám skryje z obchodu,
                        takže objednání bez kusů na skladu se neuplatní. Vypněte
                        jedno z toho.
                      </Text>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <Heading level="h2">Fotky</Heading>
                {gallery.length > 0 && (
                  <Text size="small" className="text-ui-fg-subtle tabular-nums">
                    {gallery.length}
                  </Text>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length) uploadImages.mutate(files);
                  event.target.value = "";
                }}
              />
              {gallery.length > 0 && (
                <Button
                  size="small"
                  variant="secondary"
                  className="min-h-[36px]"
                  isLoading={uploadImages.isPending}
                  onClick={() => fileInput.current?.click()}
                >
                  <Plus /> Nahrát fotky
                </Button>
              )}
            </div>
            <div className="mt-3">
              {gallery.length === 0 ? (
                // Prázdný stav je zároveň tlačítko — kam kliknout, je jasné.
                <button
                  type="button"
                  disabled={uploadImages.isPending}
                  onClick={() => fileInput.current?.click()}
                  className="border-ui-border-strong hover:bg-ui-bg-base-hover text-ui-fg-subtle flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-5 disabled:opacity-60"
                >
                  <Photo />
                  <Text size="small" weight="plus">
                    Zatím žádné fotky — klikněte a nahrajte první
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Bez fotky si kousek nikdo nekoupí. První fotka bude hlavní.
                  </Text>
                </button>
              ) : (
                <>
                  <PhotoStrip
                    photos={gallery}
                    mainUrl={product.thumbnail}
                    onOpen={setViewing}
                  />
                  <Text size="xsmall" className="text-ui-fg-muted mt-2">
                    Hlavní fotka se ukazuje v seznamech a na kartě. Kliknutím
                    na fotku ji zvětšíte — tam ji nastavíte jako hlavní nebo
                    smažete.
                  </Text>
                </>
              )}
            </div>
          </section>

          <Section title="Popis">
            <div className="flex flex-col gap-1">
              <InlineTextarea
                value={product.description}
                placeholder="Pár vět o kousku — z čeho je, jak vznikl, jak o něj pečovat…"
                rows={5}
                onSave={(next) =>
                  saveProduct.mutateAsync({ description: next || null })
                }
              />
              <div className="mt-2 divide-y">
                <FieldRow label="Podtitulek">
                  <InlineText
                    value={product.subtitle}
                    placeholder="např. ručně točená kamenina"
                    onSave={(next) =>
                      saveProduct.mutateAsync({ subtitle: next || null })
                    }
                  />
                </FieldRow>
                {clearance && (
                  <FieldRow
                    label="Popis poškození"
                    hint="Vidí ho zákazník na stránce kusu."
                  >
                    <InlineText
                      value={clearanceDamage}
                      placeholder="co je za vadu — ukáže se zákazníkovi"
                      onSave={(next) =>
                        saveFlags.mutateAsync({ clearance_damage: next || null })
                      }
                    />
                  </FieldRow>
                )}
                {production?.enabled && (
                  <FieldRow
                    label="Poznámka pro zákazníka"
                    hint="Zákazník ji uvidí při objednání jako výzvu, co má poslat. Prázdné = obecný text."
                  >
                    <InlineTextarea
                      value={madeToOrderPrompt}
                      rows={3}
                      placeholder="Co od zákazníka potřebujete k zakázce — rozměry, barvu, fotku místa, popis…"
                      onSave={(next) =>
                        saveFlags.mutateAsync({
                          made_to_order_prompt: next || null,
                        })
                      }
                    />
                  </FieldRow>
                )}
              </div>
            </div>
          </Section>

          <Section
            title="Zařazení"
            hint="Nejdřív kolekce — kategorie se pak nabídnou podle ní."
          >
            {(() => {
              /* Kaskáda: kategorie patří kolekci přes metadata.collection_id
                 (nastavuje se v Kolekce a kategorie; stejnou vazbu čte menu obchodu).
                 Plochý mrak všech 20 kategorií nutil Lucii pamatovat si,
                 co kam patří — teď jí stránka nabídne jen ty správné. */
              const collectionId = product.collection_id ?? null;
              const inCollection = collectionId
                ? categories.filter(
                    (category) =>
                      (category.metadata ?? {})["collection_id"] === collectionId
                  )
                : [];
              const inCollectionIds = new Set(
                inCollection.map((category) => category.id)
              );
              /* Už zařazené kategorie z JINÝCH kolekcí nikdy neschovávat —
                 jinak by nešly odebrat a produkt by v obchodě strašil tam,
                 kam nepatří. */
              const assignedElsewhere = categories.filter(
                (category) =>
                  selectedCategories.has(category.id) &&
                  !inCollectionIds.has(category.id)
              );
              const collectionTitle =
                (collectionsQuery.data?.collections ?? []).find(
                  (collection) => collection.id === collectionId
                )?.title ?? "";

              const chip = (category: { id: string; name: string }) => {
                const selected = selectedCategories.has(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={saveProduct.isPending}
                    onClick={() => toggleCategory(category.id)}
                    className={`transition-fg min-h-[36px] rounded-full border px-3.5 py-1.5 ${
                      selected
                        ? "border-ui-border-interactive bg-ui-bg-base-pressed text-ui-fg-base"
                        : "border-ui-border-base bg-ui-bg-base text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                    }`}
                  >
                    <Text size="small" weight={selected ? "plus" : "regular"}>
                      {selected ? "✓ " : ""}
                      {category.name}
                    </Text>
                  </button>
                );
              };

              return (
                <div className="flex flex-col gap-3">
                  <div className="divide-y">
                    <FieldRow label="Kolekce">
                      <div className="max-w-72">
                        <Select
                          value={product.collection_id ?? "none"}
                          onValueChange={(next) =>
                            saveProduct.mutate({
                              collection_id: next === "none" ? null : next,
                            })
                          }
                        >
                          <Select.Trigger>
                            <Select.Value placeholder="Bez kolekce" />
                          </Select.Trigger>
                          <Select.Content>
                            <Select.Item value="none">Bez kolekce</Select.Item>
                            {(collectionsQuery.data?.collections ?? []).map(
                              (collection) => (
                                <Select.Item
                                  key={collection.id}
                                  value={collection.id}
                                >
                                  {collection.title}
                                </Select.Item>
                              )
                            )}
                          </Select.Content>
                        </Select>
                      </div>
                    </FieldRow>

                    <FieldRow label="Kategorie">
                      <div className="flex flex-wrap gap-2">
                        {categories.length === 0 && (
                          <Text size="small" className="text-ui-fg-subtle">
                            Zatím žádné kategorie — založíte je v{" "}
                            <Link
                              to="/rozdeleni"
                              className="text-ui-fg-interactive hover:underline"
                            >
                              Kolekce a kategorie
                            </Link>
                            .
                          </Text>
                        )}
                        {categories.length > 0 && !collectionId && (
                          <Text size="small" className="text-ui-fg-subtle pt-1.5">
                            Nejdřív vyberte kolekci — kategorie se nabídnou podle
                            ní.
                          </Text>
                        )}
                        {categories.length > 0 &&
                          collectionId &&
                          inCollection.length === 0 && (
                            <Text size="small" className="text-ui-fg-subtle pt-1.5">
                              Kolekce „{collectionTitle}" nemá vlastní kategorie —
                              stačí samotné zařazení do kolekce.
                            </Text>
                          )}
                        {inCollection.map(chip)}
                      </div>
                    </FieldRow>
                  </div>

                  {/* Kategorie z JINÝCH kolekcí (Matěj 12. 10. 2026): kousek
                      může patřit do víc kolekcí — třeba zápich do „Zápichy"
                      (Do zahrady) i „Drobnosti pro radost" (Do bytu). Obchod
                      i Produkty+ ho pak ukážou v každé kolekci, ze které má
                      kategorii; kolekce nahoře zůstává hlavní. */}
                  {categories.length > 0 && (
                    <details
                      open={assignedElsewhere.length > 0}
                      className="border-ui-border-base rounded-lg border px-3 py-2"
                    >
                      <summary className="min-h-[32px] cursor-pointer pt-1">
                        <Text size="small" weight="plus" className="inline">
                          Zařadit i do jiné kolekce
                        </Text>
                        {assignedElsewhere.length > 0 && (
                          <Text size="xsmall" className="text-ui-fg-subtle ml-2 inline">
                            ({assignedElsewhere.map((category) => category.name).join(", ")})
                          </Text>
                        )}
                      </summary>
                      <Text size="xsmall" className="text-ui-fg-muted mt-1">
                        Kliknutím kousek přidáte i do kategorie jiné kolekce
                        (nebo ho z ní odeberete). V obchodě se pak ukáže
                        v obou kolekcích.
                      </Text>
                      <div className="mt-2 flex flex-col gap-3">
                        {[
                          ...(collectionsQuery.data?.collections ?? [])
                            .filter((collection) => collection.id !== collectionId)
                            .map((collection) => ({
                              title: collection.title,
                              items: categories.filter(
                                (category) =>
                                  (category.metadata ?? {})["collection_id"] === collection.id
                              ),
                            })),
                          {
                            title: "Bez kolekce",
                            items: categories.filter(
                              (category) => !(category.metadata ?? {})["collection_id"]
                            ),
                          },
                        ]
                          .filter((group) => group.items.length > 0)
                          .map((group) => (
                            <div key={group.title}>
                              <Text size="xsmall" className="text-ui-fg-subtle">
                                {group.title}
                              </Text>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {group.items.map(chip)}
                              </div>
                            </div>
                          ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })()}
          </Section>
        </div>

        {/* ————— Pravý sloupec: vlastnosti kusu ————— */}
        <div className="divide-y border-t xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:border-l xl:border-t-0">
          <Section title="Vlastnosti prodeje">
            <div className="divide-y">
              {/* Pořadí podle toho, co se u kusu mění nejčastěji: balení
                  a doprava, platba, zakázka; poškozený kus a balné na konci. */}
              <FlagRow
                label="Křehké"
                description="Celá zásilka s tímto kouskem pojede jako křehká."
                checked={flagOf(product, "fragile")}
                disabled={saveFlags.isPending}
                onChange={(next) => saveFlags.mutate({ fragile: next })}
              />
              {/* Velikost zásilky i tady, ne jen v „…" v Produkty+
                  (16. 11. 2026, Matěj) — podle ní se počítá poštovné. */}
              <div className="flex flex-col gap-2 py-3">
                <div>
                  <Text size="small" weight="plus">
                    Velikost zásilky
                  </Text>
                  <Text size="small" className="text-ui-fg-subtle mt-0.5">
                    Podle ní se v pokladně počítá poštovné — stačí jeden velký
                    kus a celá zásilka je velká.
                  </Text>
                </div>
                <div
                  role="radiogroup"
                  aria-label="Velikost zásilky"
                  className="grid grid-cols-3 gap-2"
                >
                  {SHIPPING_CLASS_OPTIONS.map((option) => {
                    const active = currentShippingClass === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={option.hint}
                        disabled={saveFlags.isPending}
                        onClick={() => {
                          if (!active) saveFlags.mutate({ shipping_class: option.value });
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
              <FlagRow
                label="Dobírka"
                description="Zapnuto (výchozí) = jde poslat na dobírku; vypnuto = jen platba předem. Zakázky a zahraničí ji nemají nikdy."
                checked={product?.metadata?.cod_allowed !== false}
                disabled={saveFlags.isPending}
                onChange={(next) => saveFlags.mutate({ cod_allowed: next })}
              />
              {/*
                Jedno kliknutí = zakázka. Podrobné podmínky zůstávají
                v oddílu Zakázková výroba níž; tenhle přepínač je jen zapne
                na výchozích hodnotách (nebo na tom, co u kusu bylo
                domluvené dřív — vypnutí podmínky nemaže).
              */}
              <FlagRow
                label="Na zakázku"
                description={
                  priceOnRequest
                    ? "Zapnuto, protože kus má cenu po domluvě (vypíná se tam)."
                    : production?.enabled
                      ? "Vyrábí se po objednání, zákazník platí zálohu — podmínky jsou v oddílu Zakázková výroba."
                      : "Vyrábí se až po objednání: záloha 25 %, zbytek před odesláním, výroba 14–42 dní."
                }
                checked={Boolean(production?.enabled)}
                disabled={toggleMadeToOrder.isPending || priceOnRequest}
                onChange={(next) => toggleMadeToOrder.mutate(next)}
              />
              <FlagRow
                label="Mrazuvzdorný"
                description="Vydrží mráz — u květináčů a zahradních kousků."
                checked={flagOf(product, "frost_resistant")}
                disabled={saveFlags.isPending}
                onChange={(next) => saveFlags.mutate({ frost_resistant: next })}
              />
              {/* Příznak `clearance` = jen poškozený kus, samostatně, ne
                  „výprodej" (Matěj, 3. 11. 2026). */}
              <FlagRow
                label="Poškozený kus"
                description="Kus s vadou, prodává se levněji. Po prodeji se sám skryje z obchodu."
                checked={clearance}
                disabled={saveFlags.isPending}
                onChange={(next) => saveFlags.mutate({ clearance: next })}
              />
              {/* Personalizace (cena podle rozměrů zadaných zákazníkem) je
                  z rozhraní schválně skrytá — obchod prodává za pevné ceny
                  (i zakázky, jen se zálohou), takže ji nikdo nepoužíval (0/266).
                  Funkce i flag `is_personalized` na backendu zůstávají spící
                  (flags endpoint, validate-personalized-product.ts), takže se
                  dá kdykoli vrátit vrácením tohoto přepínače. */}
              <div className="flex items-start justify-between gap-4 py-3">
                <div>
                  <Text size="small" weight="plus">
                    Cena balení
                  </Text>
                  <Text
                    size="small"
                    className="text-ui-fg-subtle mt-0.5"
                    title="V cizí měně se přepočte kurzem ČNB a zaokrouhlí nahoru na 0,50."
                  >
                    Balné za kus — zákazník ho uvidí jako položku pod výrobkem
                    (i u osobního odběru). Prázdné = 0 Kč.
                  </Text>
                </div>
                <InlineNumber
                  value={packagingPrice}
                  unit="Kč"
                  placeholder="0"
                  onSave={(next) => saveFlags.mutateAsync({ packaging_price: next })}
                />
              </div>
            </div>
          </Section>

          <Section
            title="Materiál a rozměry"
            hint="Popisné údaje pro zákazníka; hmotnost počítá cenu dopravy."
          >
            <div className="divide-y">
              <FieldRow label="Materiál" narrow>
                {addingMaterial ? (
                  <InlineText
                    value=""
                    placeholder="nový materiál — Enter uloží"
                    onSave={async (next) => {
                      setAddingMaterial(false);
                      if (next) {
                        await saveProduct.mutateAsync({ material: next });
                      }
                    }}
                  />
                ) : (
                  <Select
                    value={product.material ?? "none"}
                    onValueChange={(next) => {
                      if (next === "__add") {
                        setAddingMaterial(true);
                        return;
                      }
                      saveProduct.mutate({
                        material: next === "none" ? null : next,
                      });
                    }}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Bez materiálu" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="none">Bez materiálu</Select.Item>
                      {[
                        ...new Set(
                          [
                            ...(materialsQuery.data?.materials ?? []),
                            ...(product.material ? [product.material] : []),
                          ].filter(Boolean)
                        ),
                      ].map((material) => (
                        <Select.Item key={material} value={material}>
                          {material}
                        </Select.Item>
                      ))}
                      <Select.Item value="__add">+ Přidat nový…</Select.Item>
                    </Select.Content>
                  </Select>
                )}
              </FieldRow>
              <FieldRow label="Rozměry" narrow>
                <InlineText
                  value={dimensions}
                  placeholder="např. výška 12 cm, ø 9 cm"
                  onSave={(next) =>
                    saveFlags.mutateAsync({ dimensions: next || null })
                  }
                />
              </FieldRow>
              <FieldRow
                label="Hmotnost"
                narrow
                hint="Z hmotnosti se počítá cena dopravy u počítaných možností."
              >
                <InlineNumber
                  value={product.weight}
                  unit="g"
                  placeholder="—"
                  onSave={(next) =>
                    saveProduct.mutateAsync({
                      weight: next === null ? null : Math.round(Number(next)),
                    })
                  }
                />
              </FieldRow>
            </div>
          </Section>

          {/*
            Prodejní kanály — v Produkty+ jinak nikde. Jen v expertním režimu:
            běžně je kus ve výchozím kanálu a řeší ho kontrola „Viditelné
            v obchodě" nahoře; tady jde nastavit ručně (i odebrat).
          */}
          {expert && (
            <Section
              title="Prodejní kanály"
              hint="Obchod ukazuje jen kusy v kanálu, ze kterého čte."
            >
              <div className="divide-y">
                {(salesChannelsQuery.data?.sales_channels ?? []).map((channel) => {
                  const checked = productChannelIds.includes(channel.id);
                  const isShop = shopChannelIds?.has(channel.id) ?? false;
                  return (
                    <FlagRow
                      key={channel.id}
                      label={channel.name}
                      description={[
                        isShop
                          ? "Čte z něj obchod — kus v tomto kanálu je vidět na webu."
                          : "Obchod z tohoto kanálu nečte.",
                        channel.is_disabled ? "Kanál je vypnutý." : null,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      checked={checked}
                      disabled={saveProduct.isPending}
                      onChange={(next) =>
                        setChannels(
                          next
                            ? [...productChannelIds, channel.id]
                            : productChannelIds.filter((id) => id !== channel.id)
                        )
                      }
                    />
                  );
                })}
                {salesChannelsQuery.isLoading && (
                  <Text size="small" className="text-ui-fg-subtle py-3">
                    Načítám kanály…
                  </Text>
                )}
              </div>
            </Section>
          )}
        </div>

        {/* ————— Hlavní sloupec, dole: zřídka používané věci a čísla ————— */}
        <div className="divide-y self-start border-t xl:col-start-1 xl:row-start-2">
          <Disclosure
            title="Zakázková výroba"
            summary={
              production?.enabled
                ? `Zapnutá — záloha nejméně ${production.deposit_floor_percentage} %, platba předem celá ${
                    production.allow_full_prepayment ? "povolena" : "nepovolena"
                  }.`
                : "Vypnutá — běžný kus ze skladu."
            }
          >
            <div className="flex flex-col gap-3">
              <Text size="small" className="text-ui-fg-subtle">
                {production?.enabled
                  ? "Kus se vyrábí na objednávku — zákazník platí zálohu a čeká na výrobu."
                  : "Běžný kus ze skladu. Zapnout zakázkovou výrobu můžete tady (nebo přepínačem Na zakázku)."}
              </Text>
              {production?.enabled ? (
                <div className="divide-y">
                  <FieldRow label="Záloha minimálně">
                    <Text size="small" className="pt-1.5">
                      {production.deposit_floor_percentage} %
                    </Text>
                  </FieldRow>
                  <FieldRow label="Platba předem celá">
                    <Text size="small" className="pt-1.5">
                      {production.allow_full_prepayment ? "povolena" : "nepovolena"}
                    </Text>
                  </FieldRow>
                </div>
              ) : (
                <Text size="small" className="text-ui-fg-subtle">
                  Zákazník kupuje jen to, co je skladem.
                </Text>
              )}
              <div>
                <ProductionProfileEditor
                  productId={product.id}
                  productTitle={product.title}
                  onSaved={() => void invalidate()}
                  trigger={
                    <Button size="small" variant="secondary" className="min-h-[36px]">
                      {production?.enabled ? "Upravit podmínky" : "Nastavit zakázku"}
                    </Button>
                  }
                />
              </div>
            </div>
          </Disclosure>

          <Disclosure
            title="Fotky v popisu"
            summary={
              detailImages.length
                ? `${detailImages.length} ${
                    detailImages.length === 1
                      ? "fotka"
                      : detailImages.length <= 4
                        ? "fotky"
                        : "fotek"
                  } pod popiskem v Detailech výrobku.`
                : "Žádné — další fotky pod popiskem v Detailech výrobku, zvlášť od hlavní galerie."
            }
          >
            <DetailImagesEditor
              images={detailImages}
              onSave={(next) => saveFlags.mutateAsync({ detail_images: next })}
            />
          </Disclosure>

          {/* Čísla až na konec hlavního sloupce (Lucie, 17. 11. 2026): nahoře
              je jen to, s čím se něco dělá. */}
          <ProductStats
            detail={detail}
            wishlistTotal={wishlistTotal}
            waitingTotal={waitingTotal}
          />

          <Disclosure
            title="Technické údaje"
            summary={`Vytvořeno ${formatDate(product.created_at)} · naposledy upraveno ${formatDateTime(product.updated_at)}`}
          >
            <div className="flex flex-col gap-2">
              <Text size="small" className="text-ui-fg-subtle">
                Vytvořeno {formatDate(product.created_at)} · naposledy upraveno{" "}
                {formatDateTime(product.updated_at)}
              </Text>
              {expert && (
                <FieldRow
                  label="Adresa v obchodě"
                  hint="Změna rozbije staré odkazy na produkt."
                >
                  <InlineText
                    value={product.handle}
                    required
                    placeholder="adresa-produktu"
                    onSave={(next) =>
                      saveProduct.mutateAsync({
                        handle: next
                          .toLowerCase()
                          .replace(/[^a-z0-9-]+/g, "-")
                          .replace(/^-+|-+$/g, ""),
                      })
                    }
                  />
                </FieldRow>
              )}
              <RawData data={{ product, detail }} />
              {!expert && (
                <Text size="xsmall" className="text-ui-fg-muted">
                  Expertní režim (nahoře pod „…“) ukáže i adresu v obchodě,
                  surová data a původní editaci.
                </Text>
              )}
            </div>
          </Disclosure>
        </div>
      </div>
    </Container>
  );
};

const queryClient = adminQueryClient;

const ProduktDetailPage = () => {
  const { id } = useParams();
  if (!id) {
    return null;
  }
  return (
    <QueryClientProvider client={queryClient}>
      <ProduktDetailInner productId={id} />
    </QueryClientProvider>
  );
};

// Deliberately no `config` export — the page is reached from product lists,
// not from the sidebar (same convention as merchant-catalog and novy-produkt).
export default ProduktDetailPage;
