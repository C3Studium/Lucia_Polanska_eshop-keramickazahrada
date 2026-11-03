import {
  Badge, Button, Drawer, Input, Skeleton, Switch, Text, toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";
import { formatCzk } from "../lib/workbench";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Varianty — rychlé zakládání a úprava provedení přímo ze seznamu produktů.
 *
 * Matěj 3. 11. 2026: „nastaví se nejdřív, co je na něm jiné, a cena, pokud
 * je jiná, se nastaví zvlášť, jinak to bude stejná cena; fotka je tam třeba."
 * Formulář má proto tři kroky — čím se liší, cena (výchozí stejná jako
 * hlavní varianta), fotka.
 *
 * Všechno jde přes nativní API produktu stejně jako detail produktu
 * (routes/produkt/[id]); tenhle panel jen zkracuje cestu. Fotka varianty je
 * `variant.metadata.images` — to čte obchod (stránka produktu ji ukáže pod
 * výběrem) i detail produktu. Nativní obrázky variant Medusy (od 2.11) obchod
 * nečte, proto se nepoužívají.
 */

type Price = {
  currency_code: string;
  amount: number;
  rules?: Record<string, unknown> | null;
};
type PriceInput = {
  currency_code: string;
  amount: number;
  rules?: Record<string, unknown>;
};
type Variant = {
  id: string;
  title: string | null;
  created_at?: string;
  variant_rank?: number | null;
  metadata?: Record<string, unknown> | null;
  prices?: Price[];
  options?: { id: string; value: string; option_id?: string | null }[];
};
type Option = { id: string; title: string; values?: { id: string; value: string }[] };
type Product = {
  id: string;
  title: string;
  metadata?: Record<string, unknown> | null;
  images?: { id?: string; url: string }[];
  options?: Option[];
  variants?: Variant[];
};

const lower = (code: string) => String(code).toLowerCase();
const hasRules = (price: Price) => Object.keys(price.rules ?? {}).length > 0;

const czkOf = (variant: Variant | undefined): number | null => {
  const czk = (variant?.prices ?? []).find(
    (price) => lower(price.currency_code) === "czk" && !hasRules(price)
  );
  return czk ? Number(czk.amount) : null;
};

const photosOf = (variant: Variant | undefined): string[] => {
  const images = variant?.metadata?.images;
  return Array.isArray(images)
    ? images.filter((url): url is string => typeof url === "string")
    : [];
};

/** „1 200" / „1200,50" → číslo; prázdné nebo nesmysl → null. */
const parsePrice = (value: string): number | null => {
  const trimmed = value.replace(/\s/g, "").replace(",", ".");
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
};

/** Hlavní varianta = první založená (pořadí z Medusy, pak datum). */
const ordered = (variants: Variant[]) =>
  [...variants].sort(
    (a, b) =>
      (a.variant_rank ?? 0) - (b.variant_rank ?? 0) ||
      String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
  );

/** Měny bez haléřů; ostatní na dvě místa — stejně jako lib/cnb-rates. */
const ZERO_DECIMAL = new Set(["huf", "jpy", "isk", "krw", "clp"]);

/**
 * Ceník pro novou cenu v Kč podle vzoru (ceníku hlavní varianty).
 *
 * Ceník se při zápisu přepisuje celý, takže cizí měny jet musí. Cizí ceny
 * jinak dopočítá až denní úloha ČNB (jobs/sync-currency-prices) — do té doby
 * by nová varianta v eurech buď neměla cenu vůbec, nebo by nesla starou.
 * Poměr cizí ceny ke koruně ve vzoru je přesně kurz, kterým úloha počítala,
 * takže čísla sedí a úloha je příště jen potvrdí. Ceny s pravidly (např. pro
 * jeden region) se přenesou beze změny.
 */
const pricesFor = (template: Price[], czk: number): PriceInput[] => {
  const templateCzk = template.find(
    (price) => lower(price.currency_code) === "czk" && !hasRules(price)
  )?.amount;
  const out: PriceInput[] = [{ currency_code: "czk", amount: czk }];
  for (const price of template) {
    const code = lower(price.currency_code);
    if (hasRules(price)) {
      out.push({
        currency_code: price.currency_code,
        amount: Number(price.amount),
        rules: price.rules ?? undefined,
      });
      continue;
    }
    if (code === "czk" || !templateCzk) continue;
    const factor = 10 ** (ZERO_DECIMAL.has(code) ? 0 : 2);
    out.push({
      currency_code: price.currency_code,
      amount:
        Math.round(((Number(price.amount) * czk) / Number(templateCzk)) * factor) / factor,
    });
  }
  return out;
};

/*
 * Varianta = hodnota volby (např. Varianta: Modrá). Obchod nabízí zákazníkovi
 * HODNOTY volby a Medusa 2.18 odmítne variantu s hodnotou, kterou volba ještě
 * nezná. Proto se hodnota před založením / přejmenováním přidá a po
 * přejmenování / odebrání se nepoužívaná stará uklidí. Stejný postup jako
 * detail produktu (routes/produkt/[id]/page.tsx); jen u produktu s právě
 * jednou volbou.
 */
const singleOptionOf = (product: Product): Option | null =>
  (product.options ?? []).length === 1 ? (product.options as Option[])[0] : null;

const optionValueOf = (variant: Variant, option: Option): string | null =>
  (variant.options ?? []).find((value) => value.option_id === option.id)?.value ?? null;

const addOptionValue = async (productId: string, option: Option, value: string) => {
  if ((option.values ?? []).some((entry) => entry.value === value)) return;
  await sdk.client.fetch(`/admin/products/${productId}/options/batch`, {
    method: "POST",
    body: { update: [{ product_option_id: option.id, add: [{ value }] }] },
  });
};

/** Úklid je doplněk — když selže, varianta sama je uložená správně. */
const removeUnusedOptionValue = async (
  productId: string,
  option: Option,
  value: string | null,
  remaining: Variant[]
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
/** Jeden řádek seznamu — co varianta je, za kolik a jestli má svou fotku. */
const VariantCard = ({
  product,
  variant,
  isBase,
  baseCzk,
  canDelete,
  onEdit,
  invalidate,
}: {
  product: Product;
  variant: Variant;
  isBase: boolean;
  baseCzk: number | null;
  canDelete: boolean;
  onEdit: () => void;
  invalidate: () => Promise<unknown>;
}) => {
  const option = singleOptionOf(product);
  const priceOnRequest = product.metadata?.price_on_request === true;
  const czk = czkOf(variant);
  const photos = photosOf(variant);
  const name = variant.title || "Bez názvu";

  const remove = useMutation({
    mutationFn: async () => {
      await sdk.client.fetch(`/admin/products/${product.id}/variants/${variant.id}`, {
        method: "DELETE",
      });
      if (option) {
        await removeUnusedOptionValue(
          product.id,
          option,
          optionValueOf(variant, option),
          (product.variants ?? []).filter((entry) => entry.id !== variant.id)
        );
      }
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(`Varianta ${name} odebrána.`);
    },
    onError: (error) => toast.error(ceskaChyba(error, "Odebrání se nepodařilo.")),
  });

  const priceLine = priceOnRequest
    ? "cena po domluvě"
    : czk === null
      ? "bez ceny"
      : isBase
        ? formatCzk(czk)
        : czk === baseCzk
          ? `stejná cena jako hlavní (${formatCzk(czk)})`
          : `vlastní cena ${formatCzk(czk)}`;

  return (
    <div className="border-ui-border-base flex items-center gap-3 rounded-lg border p-3">
      <div className="bg-ui-bg-subtle size-12 shrink-0 overflow-hidden rounded-md">
        {photos[0] ? (
          <img src={photos[0]} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Text size="small" weight="plus" className="truncate">
            {name}
          </Text>
          {isBase && (
            <Badge size="2xsmall" color="grey">
              hlavní
            </Badge>
          )}
        </div>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {priceLine}
          {photos.length > 0 ? " · vlastní fotka" : ""}
        </Text>
      </div>
      <Button size="small" variant="secondary" onClick={onEdit}>
        Upravit
      </Button>
      {canDelete && (
        <ConfirmDialog
          trigger={
            <Button size="small" variant="transparent" isLoading={remove.isPending}>
              Odebrat
            </Button>
          }
          title={`Odebrat variantu ${name}?`}
          description={product.title}
          consequence="Varianta zmizí z obchodu i se svým skladem. Vrátit to nejde — objednávek, kde už je, se to nedotkne."
          confirmLabel="Odebrat variantu"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      )}
    </div>
  );
};

/** Výběr fotky — z fotek produktu, nebo nahráním nové. */
const PhotoPicker = ({
  pool,
  selected,
  onToggle,
  onUpload,
  uploading,
}: {
  pool: string[];
  selected: string[];
  onToggle: (url: string) => void;
  onUpload: (files: File[]) => void;
  uploading: boolean;
}) => {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {pool.map((url) => {
        const on = selected.includes(url);
        return (
          <button
            key={url}
            type="button"
            aria-pressed={on}
            title={on ? "Nepoužívat u této varianty" : "Použít u této varianty"}
            onClick={() => onToggle(url)}
            className={`relative size-16 overflow-hidden rounded-md border-2 transition-opacity ${
              on
                ? "border-ui-fg-interactive"
                : "border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
            {on && (
              <span className="bg-ui-fg-interactive text-ui-fg-on-color absolute right-1 top-1 rounded-full px-1 text-[10px] leading-4">
                ✓
              </span>
            )}
          </button>
        );
      })}
      <button
        type="button"
        disabled={uploading}
        onClick={() => input.current?.click()}
        className="border-ui-border-strong text-ui-fg-subtle hover:text-ui-fg-base txt-compact-xsmall flex size-16 items-center justify-center rounded-md border border-dashed text-center disabled:opacity-50"
      >
        {uploading ? "Nahrávám…" : "+ Nahrát"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) onUpload(files);
        }}
      />
    </div>
  );
};

const Step = ({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="flex gap-3">
    <span className="bg-ui-bg-component text-ui-fg-subtle txt-compact-xsmall-plus flex size-6 shrink-0 items-center justify-center rounded-full border">
      {number}
    </span>
    <div className="min-w-0 flex-1">
      <Text size="small" weight="plus">
        {title}
      </Text>
      {hint && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {hint}
        </Text>
      )}
      <div className="mt-2">{children}</div>
    </div>
  </div>
);

/**
 * Založení nebo úprava varianty ve třech krocích: čím se liší → cena →
 * fotka. Cena je napoprvé „stejná jako hlavní" — vlastní se zadává, jen
 * když je opravdu jiná.
 */
const VariantForm = ({
  product,
  base,
  editing,
  onClose,
  invalidate,
}: {
  product: Product;
  base: Variant | undefined;
  /** Upravovaná varianta; bez ní se zakládá nová. */
  editing: Variant | null;
  onClose: () => void;
  invalidate: () => Promise<unknown>;
}) => {
  const option = singleOptionOf(product);
  const priceOnRequest = product.metadata?.price_on_request === true;
  const isBase = editing !== null && editing.id === base?.id;
  const baseCzk = czkOf(base);
  const ownCzk = editing ? czkOf(editing) : null;
  const siblings = (product.variants ?? []).filter((entry) => entry.id !== editing?.id);
  /* Hlavní varianta zatím bez ceny — „stejná" by nebyla žádná. */
  const mustTypePrice = isBase || baseCzk === null;

  const [name, setName] = useState(editing?.title ?? "");
  const [different, setDifferent] = useState(
    editing !== null && !isBase && ownCzk !== null && ownCzk !== baseCzk
  );
  const [price, setPrice] = useState(ownCzk !== null ? String(ownCzk) : "");
  const [photos, setPhotos] = useState<string[]>(photosOf(editing ?? undefined));
  const [uploaded, setUploaded] = useState<string[]>([]);

  const pool = [
    ...new Set([
      ...(product.images ?? []).map((image) => image.url).filter(Boolean),
      ...photosOf(editing ?? undefined),
      ...uploaded,
    ]),
  ];

  /* Varianty, které teď stojí stejně jako hlavní — při změně hlavní ceny jdou s ní. */
  const followers =
    isBase && baseCzk !== null
      ? siblings.filter((entry) => czkOf(entry) === baseCzk)
      : [];

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const result = await sdk.admin.upload.create({ files });
      const urls = (result.files ?? [])
        .map((file: { url?: string }) => file.url)
        .filter((url): url is string => Boolean(url));
      if (!urls.length) throw new Error("Fotku se nepodařilo nahrát.");
      return urls;
    },
    onSuccess: (urls) => {
      setUploaded((previous) => [...previous, ...urls]);
      setPhotos((previous) => [...previous, ...urls.filter((url) => !previous.includes(url))]);
    },
    onError: (error) => toast.error(ceskaChyba(error, "Nahrání se nepodařilo.")),
  });

  const save = useMutation({
    mutationFn: async () => {
      const title = name.trim();
      if (!title) throw new Error("Napište, čím se varianta liší (např. Modrá).");
      const fold = (value: string | null) => (value ?? "").trim().toLocaleLowerCase("cs");
      if (siblings.some((entry) => fold(entry.title) === fold(title))) {
        throw new Error(`Varianta „${title}“ už u produktu je.`);
      }

      let prices: PriceInput[] | undefined;
      if (!priceOnRequest) {
        if (mustTypePrice || different) {
          const parsed = parsePrice(price);
          if (parsed === null) throw new Error("Zadejte cenu v Kč.");
          prices = pricesFor(isBase && editing ? editing.prices ?? [] : base?.prices ?? [], parsed);
        } else {
          // Stejná jako hlavní = kopie celého ceníku hlavní varianty, i cizích měn.
          prices = pricesFor(base?.prices ?? [], baseCzk as number);
        }
      }

      if (!editing) {
        // Bez hodnoty ve volbě by Medusa 2.18 variantu odmítla (viz detail produktu).
        if (option) await addOptionValue(product.id, option, title);
        return sdk.client.fetch(`/admin/products/${product.id}/variants`, {
          method: "POST",
          body: {
            title,
            ...(option ? { options: { [option.title]: title } } : {}),
            prices: prices ?? [],
            ...(photos.length ? { metadata: { images: photos } } : {}),
            // Výchozí v obchodě: prodává se i po vyprodání (sklad do minusu);
            // vypíná se přepínačem v detailu produktu.
            allow_backorder: true,
          },
        });
      }

      const current = option ? optionValueOf(editing, option) : null;
      const renamed = Boolean(option && current && current !== title);
      const photosChanged =
        JSON.stringify(photos) !== JSON.stringify(photosOf(editing));
      // Přejmenování = i nová hodnota volby, kterou zákazník v obchodě vybírá.
      if (renamed && option) await addOptionValue(product.id, option, title);
      await sdk.client.fetch(`/admin/products/${product.id}/variants/${editing.id}`, {
        method: "POST",
        body: {
          title,
          ...(renamed && option ? { options: { [option.title]: title } } : {}),
          ...(prices ? { prices } : {}),
          // Jen při změně fotek; posílá se celé, ať zůstane i poznámka z detailu.
          ...(photosChanged
            ? { metadata: { ...(editing.metadata ?? {}), images: photos } }
            : {}),
        },
      });
      if (renamed && option) {
        await removeUnusedOptionValue(product.id, option, current, siblings);
      }

      const newBaseCzk = prices?.find((entry) => entry.currency_code === "czk")?.amount;
      if (isBase && prices && newBaseCzk !== undefined && newBaseCzk !== baseCzk && followers.length) {
        await sdk.client.fetch(`/admin/products/${product.id}/variants/batch`, {
          method: "POST",
          body: {
            update: followers.map((entry) => ({ id: entry.id, prices })),
          },
        });
      }
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(editing ? "Varianta uložena." : "Varianta přidána.");
      onClose();
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, editing ? "Uložení se nepodařilo." : "Přidání se nepodařilo.")
      ),
  });

  return (
    <div className="border-ui-border-interactive flex flex-col gap-y-4 rounded-lg border p-4">
      <Text size="small" weight="plus">
        {editing ? `Upravit variantu ${editing.title ?? ""}` : "Nová varianta"}
      </Text>

      <Step
        number={1}
        title="Čím se liší"
        hint="Tohle zákazník uvidí, když si v obchodě vybírá — např. Modrá glazura, Velký."
      >
        <Input
          size="small"
          autoFocus
          placeholder="např. Modrá"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Step>

      <Step number={2} title="Cena">
        {priceOnRequest ? (
          <Text size="small" className="text-ui-fg-subtle">
            Produkt má cenu po domluvě — cena se nezadává.
          </Text>
        ) : mustTypePrice ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Input
                size="small"
                type="number"
                min={0}
                inputMode="decimal"
                className="w-32"
                placeholder="Kč"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
              <Text size="small" className="text-ui-fg-subtle">
                Kč
              </Text>
            </div>
            {isBase && followers.length > 0 && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                Se stejnou cenou se změní i:{" "}
                {followers.map((entry) => entry.title).join(", ")}.
              </Text>
            )}
            {!isBase && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                Hlavní varianta zatím nemá cenu, tak ji zadejte tady.
              </Text>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2">
              <Switch checked={different} onCheckedChange={setDifferent} />
              <Text size="small">Jiná cena než hlavní</Text>
            </label>
            {different ? (
              <div className="flex items-center gap-2">
                <Input
                  size="small"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  className="w-32"
                  placeholder="Kč"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
                <Text size="small" className="text-ui-fg-subtle">
                  Kč
                </Text>
              </div>
            ) : (
              <Text size="xsmall" className="text-ui-fg-subtle">
                Stejná jako hlavní: {formatCzk(baseCzk)}
              </Text>
            )}
          </div>
        )}
      </Step>

      <Step
        number={3}
        title="Fotka (nepovinné)"
        hint="Zákazník ji uvidí pod výběrem, když si tuhle variantu zvolí."
      >
        <PhotoPicker
          pool={pool}
          selected={photos}
          uploading={upload.isPending}
          onUpload={(files) => upload.mutate(files)}
          onToggle={(url) =>
            setPhotos((previous) =>
              previous.includes(url)
                ? previous.filter((entry) => entry !== url)
                : [...previous, url]
            )
          }
        />
      </Step>

      <div className="flex justify-end gap-2">
        <Button size="small" variant="secondary" disabled={save.isPending} onClick={onClose}>
          Zrušit
        </Button>
        <Button
          size="small"
          isLoading={save.isPending}
          disabled={upload.isPending}
          onClick={() => save.mutate()}
        >
          {editing ? "Uložit" : "Přidat variantu"}
        </Button>
      </div>
    </div>
  );
};

export const VariantsEditor = ({ productId, productTitle, trigger }: {
  productId: string; productTitle: string; trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  /* Otevřený je nejvýš jeden formulář: id upravované varianty, „new", nebo nic. */
  const [form, setForm] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ product: Product }>({
    queryKey: ["variants-editor", productId],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/products/${productId}?fields=id,title,metadata,*images,*variants,*variants.prices,variants.metadata,*variants.options,*options,*options.values`
      ),
    enabled: open,
  });
  const product = data?.product;
  const variants = ordered(product?.variants ?? []);
  const base = variants[0];
  const baseCzk = czkOf(base);
  const manyOptions = (product?.options ?? []).length > 1;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["variants-editor", productId] });
    await queryClient.invalidateQueries({ queryKey: ["workbench-products"] });
    await queryClient.invalidateQueries({ queryKey: ["workbench-product", productId] });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setForm(null);
      }}
    >
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Varianty — {productTitle}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-3 overflow-y-auto">
          <Text size="small" className="text-ui-fg-subtle">
            Varianta je jiné provedení téhož výrobku — barva, velikost, glazura.
            Zákazník si ji vybere na stránce produktu.
          </Text>

          {isLoading && <Skeleton className="h-16 rounded-lg" />}

          {product &&
            variants.map((variant) =>
              form === variant.id ? (
                <VariantForm
                  key={variant.id}
                  product={product}
                  base={base}
                  editing={variant}
                  onClose={() => setForm(null)}
                  invalidate={invalidate}
                />
              ) : (
                <VariantCard
                  key={variant.id}
                  product={product}
                  variant={variant}
                  isBase={variant.id === base?.id}
                  baseCzk={baseCzk}
                  canDelete={variants.length > 1}
                  onEdit={() => setForm(variant.id)}
                  invalidate={invalidate}
                />
              )
            )}

          {product && form === "new" && (
            <VariantForm
              product={product}
              base={base}
              editing={null}
              onClose={() => setForm(null)}
              invalidate={invalidate}
            />
          )}

          {product && form !== "new" && !manyOptions && (
            <div>
              <Button size="small" variant="secondary" onClick={() => setForm("new")}>
                + Přidat variantu
              </Button>
            </div>
          )}

          {product && manyOptions && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Tenhle produkt má víc voleb najednou (např. barvu i velikost) —
              nové varianty k němu přidáte v detailu produktu.
            </Text>
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
};
