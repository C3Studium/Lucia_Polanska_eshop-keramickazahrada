import { Badge, Button, Input, Label, Prompt, Switch, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { ceskaChyba } from "../lib/ceska-chyba";
import { formatDate } from "../lib/format";
import { sdk } from "../lib/sdk";
import { formatCzk } from "../lib/workbench";
import { InspectorRow } from "./product-inspector";

/**
 * Sleva u výrobku — řádek „Sleva" v Ceně a skladu a okno s procenty
 * a obdobím (18. 11. 2026, přání majitele). Backend: `lib/product-sale.ts`
 * (vlastní akční ceník výrobku), seznam všech ve Slevách → Zlevněné výrobky.
 */

export type ProductSale = {
  price_list_id: string;
  product_id: string;
  percent: number;
  status: "active" | "draft";
  starts_at: string | null;
  ends_at: string | null;
  state: "off" | "scheduled" | "running" | "ended";
};

export const SALE_STATE: Record<
  ProductSale["state"],
  { label: string; color: "green" | "blue" | "grey" | "orange" }
> = {
  running: { label: "Běží", color: "green" },
  scheduled: { label: "Naplánovaná", color: "blue" },
  off: { label: "Vypnutá", color: "grey" },
  ended: { label: "Skončila", color: "orange" },
};

export const salePeriod = (sale: Pick<ProductSale, "starts_at" | "ends_at">) => {
  if (sale.starts_at && sale.ends_at)
    return `${formatDate(sale.starts_at)} – ${formatDate(sale.ends_at)}`;
  if (sale.starts_at) return `od ${formatDate(sale.starts_at)}`;
  if (sale.ends_at) return `do ${formatDate(sale.ends_at)}`;
  return "bez omezení";
};

export const salePrice = (price: number, percent: number) =>
  Math.max(1, Math.round((price * (100 - percent)) / 100));

const pad = (value: number) => String(value).padStart(2, "0");
/** ISO → „RRRR-MM-DD" v místním čase (pole typu date). */
const toInputDate = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const today = () => toInputDate(new Date().toISOString());
/* Začátek dne „od", konec dne „do" — sleva do 24. 12. platí celý 24. 12. */
const startOfDay = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : null);
const endOfDay = (value: string) => (value ? new Date(`${value}T23:59:59`).toISOString() : null);

const QUICK = [10, 20, 30, 50];

export const productSaleKey = (productId: string) => ["product-sale", productId];

const useSaleWrites = (productId: string) => {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: productSaleKey(productId) });
    await queryClient.invalidateQueries({ queryKey: ["product-sales"] });
  };

  const save = useMutation({
    mutationFn: (body: {
      percent?: number;
      starts_at?: string | null;
      ends_at?: string | null;
      enabled?: boolean;
    }) =>
      sdk.client.fetch<{ sale: ProductSale }>(
        `/admin/workbench/products/${productId}/sale`,
        { method: "POST", body }
      ),
    onSuccess: invalidate,
    onError: (error) => toast.error(ceskaChyba(error, "Slevu se nepodařilo uložit.")),
  });

  const remove = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/workbench/products/${productId}/sale`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Sleva odebrána — výrobek je zase za plnou cenu.");
    },
    onError: (error) => toast.error(ceskaChyba(error, "Slevu se nepodařilo odebrat.")),
  });

  return { save, remove };
};

/** Zapnout/vypnout a odebrat — i z řádku ve Slevách. */
export const useProductSaleWrites = useSaleWrites;

/**
 * Okno „Sleva na výrobek": procenta (s rychlou volbou), od–do, náhled ceny.
 * U existující slevy navíc „Odebrat slevu".
 */
export const ProductSaleDialog = ({
  productId,
  productTitle,
  price,
  sale,
  open,
  onOpenChange,
}: {
  productId: string;
  productTitle: string;
  /** Nejnižší cena v Kč (náhled); `null` = jen procenta. */
  price: number | null;
  sale: ProductSale | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) => {
  const ids = useId();
  const { save, remove } = useSaleWrites(productId);
  const [percent, setPercent] = useState(String(sale?.percent ?? 20));
  const [from, setFrom] = useState(sale ? toInputDate(sale.starts_at) : today());
  const [to, setTo] = useState(sale ? toInputDate(sale.ends_at) : "");

  const reset = () => {
    setPercent(String(sale?.percent ?? 20));
    setFrom(sale ? toInputDate(sale.starts_at) : today());
    setTo(sale ? toInputDate(sale.ends_at) : "");
  };

  const value = Number(percent);
  const percentOk = Number.isInteger(value) && value >= 1 && value <= 90;
  const datesOk = !from || !to || from <= to;

  const submit = () =>
    save.mutate(
      {
        percent: value,
        starts_at: startOfDay(from),
        ends_at: endOfDay(to),
        enabled: true,
      },
      {
        onSuccess: (data) => {
          const state = data.sale.state;
          toast.success(
            state === "scheduled"
              ? `Sleva ${value} % naplánovaná od ${formatDate(data.sale.starts_at)}.`
              : `Sleva ${value} % nastavená — v obchodě do pár vteřin.`
          );
          onOpenChange(false);
        },
      }
    );

  return (
    <Prompt
      variant="confirmation"
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        onOpenChange(next);
      }}
    >
      <Prompt.Content className="w-[calc(100%-2rem)]">
        <Prompt.Header>
          <Prompt.Title>{sale ? "Upravit slevu" : "Sleva na výrobek"}</Prompt.Title>
          <Prompt.Description>{productTitle}</Prompt.Description>
        </Prompt.Header>

        <div className="flex flex-col gap-4 px-6 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${ids}-pct`} size="small" weight="plus">
              Sleva
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-28">
                <Input
                  id={`${ids}-pct`}
                  type="number"
                  min={1}
                  max={90}
                  inputMode="numeric"
                  value={percent}
                  className="pr-8 tabular-nums"
                  onChange={(event) => setPercent(event.target.value)}
                />
                <span className="text-ui-fg-muted txt-compact-small pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  %
                </span>
              </div>
              {QUICK.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  aria-pressed={value === quick}
                  onClick={() => setPercent(String(quick))}
                  className={`min-h-[36px] rounded-full border px-3 ${
                    value === quick
                      ? "border-ui-border-interactive bg-ui-bg-base-pressed"
                      : "border-ui-border-base hover:bg-ui-bg-base-hover"
                  }`}
                >
                  <Text size="small">{quick} %</Text>
                </button>
              ))}
            </div>
            {!percentOk && (
              <Text size="xsmall" className="text-ui-fg-error">
                Zadejte celé číslo od 1 do 90.
              </Text>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${ids}-from`} size="small" weight="plus">
                Od
              </Label>
              <Input
                id={`${ids}-from`}
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${ids}-to`} size="small" weight="plus">
                Do
              </Label>
              <Input
                id={`${ids}-to`}
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          </div>
          <Text size="xsmall" className={datesOk ? "text-ui-fg-subtle -mt-2" : "text-ui-fg-error -mt-2"}>
            {datesOk
              ? "Prázdné „Do“ = sleva platí, dokud ji nevypnete. Poslední den platí celý."
              : "Konec slevy musí být po jejím začátku."}
          </Text>

          {price !== null && percentOk && (
            <div className="bg-ui-bg-subtle flex items-baseline gap-2 rounded-lg px-3 py-2.5">
              <Text size="small" className="text-ui-fg-muted line-through">
                {formatCzk(price)}
              </Text>
              <Text size="large" weight="plus">
                {formatCzk(salePrice(price, value))}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                − {value} %
              </Text>
            </div>
          )}
        </div>

        <Prompt.Footer className="flex-wrap">
          {sale && (
            <Button
              size="small"
              variant="transparent"
              className="text-ui-fg-error hover:text-ui-fg-error mr-auto"
              isLoading={remove.isPending}
              onClick={() =>
                remove.mutate(undefined, { onSuccess: () => onOpenChange(false) })
              }
            >
              Odebrat slevu
            </Button>
          )}
          <Prompt.Cancel>Zrušit</Prompt.Cancel>
          <Button
            size="small"
            disabled={!percentOk || !datesOk}
            isLoading={save.isPending}
            onClick={submit}
          >
            {sale ? "Uložit" : "Nastavit slevu"}
          </Button>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

/**
 * Řádek „Sleva" pod cenami. Bez slevy tlačítko „Přidat slevu"; se slevou
 * stav, −%, cena po slevě, období, přepínač zapnuto a „Upravit".
 */
export const ProductSaleRow = ({
  productId,
  productTitle,
  price,
  blockedReason,
}: {
  productId: string;
  productTitle: string;
  price: number | null;
  /** Proč tu sleva nejde (cena po domluvě, poukaz…); `null` = jde. */
  blockedReason: string | null;
}) => {
  const [open, setOpen] = useState(false);
  const switchId = useId();
  const { data, isLoading } = useQuery<{ sale: ProductSale | null }>({
    queryKey: productSaleKey(productId),
    queryFn: () => sdk.client.fetch(`/admin/workbench/products/${productId}/sale`),
  });
  const { save } = useSaleWrites(productId);
  const sale = data?.sale ?? null;

  if (blockedReason && !sale) {
    return <InspectorRow id="produkt-sleva" label="Sleva" hint={blockedReason} />;
  }

  if (!sale) {
    return (
      <>
        <InspectorRow
          id="produkt-sleva"
          label="Sleva"
          hint="Prodává se za plnou cenu."
          control={
            <Button
              size="small"
              variant="secondary"
              disabled={isLoading || price === null}
              onClick={() => setOpen(true)}
            >
              Přidat slevu
            </Button>
          }
        />
        <ProductSaleDialog
          productId={productId}
          productTitle={productTitle}
          price={price}
          sale={null}
          open={open}
          onOpenChange={setOpen}
        />
      </>
    );
  }

  const state = SALE_STATE[sale.state];

  return (
    <>
      <InspectorRow
        id="produkt-sleva"
        label={`Sleva ${sale.percent} %`}
        htmlFor={switchId}
        hint={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
            <Badge size="2xsmall" color={state.color}>
              {save.isPending ? "Ukládám…" : state.label}
            </Badge>
            {price !== null && (
              <span>
                <span className="line-through">{formatCzk(price)}</span>{" "}
                <span className="text-ui-fg-base font-medium">
                  {formatCzk(salePrice(price, sale.percent))}
                </span>
              </span>
            )}
            <span>{salePeriod(sale)}</span>
          </span>
        }
        control={
          <div className="flex items-center gap-3">
            <Button size="small" variant="secondary" onClick={() => setOpen(true)}>
              Upravit
            </Button>
            <Switch
              id={switchId}
              aria-label="Sleva zapnutá"
              checked={sale.status === "active"}
              disabled={save.isPending}
              onCheckedChange={(next) =>
                save.mutate(
                  { enabled: next },
                  {
                    onSuccess: () =>
                      toast.success(
                        next ? "Sleva zapnutá." : "Sleva vypnutá — výrobek je za plnou cenu."
                      ),
                  }
                )
              }
            />
          </div>
        }
      />
      <ProductSaleDialog
        productId={productId}
        productTitle={productTitle}
        price={price}
        sale={sale}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
};
