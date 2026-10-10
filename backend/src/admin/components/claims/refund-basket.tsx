import {
  Button,
  Checkbox,
  Input,
  Label,
  Prompt,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useEffect, useState } from "react";
import {
  asNumber,
  nearlyZero,
  round2,
  type ClaimDetailItem,
  type ClaimShipping,
  type RefundLineInput,
  type RefundResponse,
  type ReturnRequest,
} from "../../lib/return-requests";
import { formatCzk } from "../../lib/workbench";
import {
  emptySelection,
  refundableQuantity,
  itemAmount,
  selectionToLines,
  type BasketSelection,
} from "./order-items-table";
import { PanelShell } from "./panels";
import { useReturnAction } from "./use-return-action";

/**
 * Košík vrácení (docs/reklamace-a-zruseni.md §13.2) — žádná částka
 * automaticky, majitelka ji SESTAVÍ:
 *
 * - řádky = položky / komponenty balíčku vybrané v tabulce objednávky
 *   (checkbox + kusy), tady jen s částkou a možností řádek odebrat;
 * - „Poštovné" (částka `shipping.refundable`; vrací se nejvýš jednou);
 * - „Jiná částka" (částka + popisek, např. kompenzace, sleva z ceny);
 * - živý součet, poznámka, „Označit jako vyřízené" (zapnuté jen když součet
 *   = zbývá) a JEDNO tlačítko „Vrátit X Kč".
 *
 * Tělo: `POST …/refund { lines: RefundLine[], note?, mark_resolved,
 * skip_goods_check? }` — server částku spočítá sám a ověří stropy (položka /
 * komponenta jen jednou, celkem ≤ zbývá). Součet přes „zbývá" se hlídá i tady
 * (chyba + vypnuté tlačítko), ať se neklepe naslepo.
 *
 * Vedle košíku zůstávají VÝSLOVNÁ tlačítka: „Vrátit celou objednávku"
 * (`scope: "all"` = všechny zbývající položky + poštovné, s potvrzením, co
 * to zahrnuje) tady, a „Vrátit zálohu" (`scope: "deposit"`) v bloku Zakázka.
 */

type CustomRow = { on: boolean; amount: string; label: string };

const parseAmount = (value: string) => {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : NaN;
};

export const RefundBasket = ({
  request,
  items,
  shipping,
  selection,
  onSelectionChange,
  skipGoodsCheck,
  canRefundLines,
  canRefundAll,
  hasProduction,
  onRefunded,
}: {
  request: ReturnRequest;
  items: ClaimDetailItem[];
  /** §13.2 — bez něj (starší server) se řádek Poštovné nenabídne. */
  shipping?: ClaimShipping | null;
  selection: BasketSelection;
  onSelectionChange: (next: BasketSelection) => void;
  /** Vědomé „vracím bez čekání na zásilku" (§1832/4) — pak je poznámka povinná. */
  skipGoodsCheck: boolean;
  /** Server teď povoluje refund po řádcích (položky / poštovné / jiná částka). */
  canRefundLines: boolean;
  /** Server teď povoluje „Vrátit celou objednávku". */
  canRefundAll: boolean;
  hasProduction: boolean;
  onRefunded: () => void;
}) => {
  const remaining = asNumber(request.remaining);
  const refunded = asNumber(request.refunded_total);

  const [shippingOn, setShippingOn] = useState(false);
  const [custom, setCustom] = useState<CustomRow>({ on: false, amount: "", label: "" });
  const [note, setNote] = useState("");
  const [markResolved, setMarkResolved] = useState(false);
  const mutation = useReturnAction<RefundResponse>(request.id, "refund");

  const itemLines = selectionToLines(items, selection);
  const itemsSum = round2(itemLines.reduce((sum, line) => sum + line.amount, 0));

  const shippingRefundable = shipping ? Math.max(0, asNumber(shipping.refundable)) : 0;
  const shippingAlreadyRefunded = Boolean(shipping) && asNumber(shipping?.refunded) > 0;
  const shippingOffered = Boolean(shipping) && asNumber(shipping?.total) > 0;
  const shippingSelected = shippingOn && shippingRefundable > 0;

  const customAmount = custom.on ? parseAmount(custom.amount) : 0;
  const customValid =
    !custom.on ||
    (Number.isFinite(customAmount) && customAmount > 0 && custom.label.trim().length > 0);
  const customSum = custom.on && Number.isFinite(customAmount) && customAmount > 0 ? customAmount : 0;

  const total = round2(itemsSum + (shippingSelected ? shippingRefundable : 0) + customSum);
  const overRemaining = total > remaining + 0.005;
  const isFull = total > 0 && !overRemaining && nearlyZero(total - remaining);

  // Výchozí „označit jako vyřízené" = vracíte všechno, co zbývá. Při změně
  // součtu se přepočítá; přepínač zůstává ruční.
  useEffect(() => {
    setMarkResolved(isFull);
  }, [isFull]);

  const lines: RefundLineInput[] = [
    ...itemLines.map((entry) => entry.line),
    ...(shippingSelected ? [{ type: "shipping" } as const] : []),
    ...(custom.on && customValid
      ? [{ type: "custom", amount: round2(customAmount), label: custom.label.trim() } as const]
      : []),
  ];

  const noteRequired = skipGoodsCheck;
  const canSubmit =
    canRefundLines &&
    lines.length > 0 &&
    total > 0 &&
    !overRemaining &&
    customValid &&
    (!noteRequired || note.trim().length > 0) &&
    !mutation.isPending;

  const removeLine = (key: string, type: "item" | "component") => {
    const next = { items: { ...selection.items }, components: { ...selection.components } };
    if (type === "item") delete next.items[key];
    else delete next.components[key];
    onSelectionChange(next);
  };

  const reset = () => {
    onSelectionChange(emptySelection());
    setShippingOn(false);
    setCustom({ on: false, amount: "", label: "" });
    setNote("");
  };

  const body: Record<string, unknown> = {
    lines,
    ...(note.trim() ? { note: note.trim() } : {}),
    mark_resolved: markResolved,
    ...(skipGoodsCheck ? { skip_goods_check: true } : {}),
  };

  return (
    <div className="flex flex-col gap-y-3">
      {canRefundLines && (
        <PanelShell
          title={`Košík vrácení — zbývá ${formatCzk(remaining)}`}
          onSubmit={() => {
            if (!canSubmit) return;
            mutation.mutate(body, {
              onSuccess: (result) => {
                toast.success(result?.message ?? "Peníze byly vráceny.");
                reset();
                onRefunded();
              },
            });
          }}
        >
          {skipGoodsCheck && (
            <Text size="small" className="text-ui-tag-orange-text">
              Vracíte bez čekání na zásilku. Podle §1832/4 smíte s vrácením počkat,
              dokud zboží nedostanete zpět — tímto se té možnosti vědomě vzdáváte
              (např. zboží nikdy neodešlo). Důvod se zapíše k refundaci.
            </Text>
          )}

          {/* ------------------------------------------------ položky ---- */}
          <ul className="flex flex-col gap-y-1">
            {itemLines.length === 0 && (
              <li>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Žádná položka — vyberte ji v tabulce objednávky (zaškrtnutí + kusy),
                  nebo vraťte jen poštovné / jinou částku.
                </Text>
              </li>
            )}
            {itemLines.map((entry) => (
              <li key={entry.key} className="flex items-baseline justify-between gap-x-3">
                <Text size="xsmall" className="min-w-0 truncate" title={entry.title}>
                  {entry.line.type === "component" ? (
                    <span className="text-ui-fg-subtle">komponenta: </span>
                  ) : null}
                  {entry.title} · {entry.quantity} ks
                </Text>
                <span className="flex shrink-0 items-baseline gap-x-2">
                  <Text size="xsmall" weight="plus" className="whitespace-nowrap">
                    {formatCzk(round2(entry.amount))}
                  </Text>
                  <button
                    type="button"
                    className="text-ui-fg-muted txt-small hover:text-ui-fg-base"
                    aria-label={`Odebrat ${entry.title} z košíku`}
                    title="Odebrat z košíku"
                    onClick={() => removeLine(entry.key, entry.line.type)}
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>

          {/* ----------------------------------------------- poštovné ---- */}
          {shippingOffered && (
            <label className="flex items-start justify-between gap-x-3">
              <span className="flex items-start gap-x-2">
                <Checkbox
                  checked={shippingSelected}
                  disabled={shippingRefundable <= 0}
                  onCheckedChange={(checked) => setShippingOn(checked === true)}
                />
                <span>
                  <Text size="small">Poštovné</Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {shippingRefundable > 0
                      ? "Vrací se nejvýš jednou — celá cena dopravy z objednávky."
                      : shippingAlreadyRefunded
                        ? `Už vráceno (${formatCzk(asNumber(shipping?.refunded))}).`
                        : "Nic k vrácení."}
                  </Text>
                </span>
              </span>
              <Text
                size="xsmall"
                weight="plus"
                className={`whitespace-nowrap ${shippingRefundable > 0 ? "" : "text-ui-fg-muted"}`}
              >
                {formatCzk(shippingRefundable > 0 ? shippingRefundable : asNumber(shipping?.total))}
              </Text>
            </label>
          )}
          {!shipping && (
            <Text size="xsmall" className="text-ui-fg-muted">
              Server zatím neposílá poštovné — vraťte ho případně jako „Jinou částku".
            </Text>
          )}

          {/* -------------------------------------------- jiná částka ---- */}
          <div className="flex flex-col gap-y-2">
            <label className="flex items-start gap-x-2">
              <Checkbox
                checked={custom.on}
                onCheckedChange={(checked) => setCustom({ ...custom, on: checked === true })}
              />
              <span>
                <Text size="small">Jiná částka</Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Kompenzace, sleva z ceny, krácení… Do dobropisu jde jako „Vrácení — popisek".
                </Text>
              </span>
            </label>
            {custom.on && (
              <div className="grid gap-2 pl-6 sm:grid-cols-[120px_minmax(0,1fr)]">
                <div className="flex flex-col gap-y-1">
                  <Label size="xsmall" htmlFor={`custom-amount-${request.id}`}>
                    Částka (Kč)
                  </Label>
                  <Input
                    id={`custom-amount-${request.id}`}
                    size="small"
                    type="number"
                    min={0}
                    step="0.01"
                    value={custom.amount}
                    onChange={(event) => setCustom({ ...custom, amount: event.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-y-1">
                  <Label size="xsmall" htmlFor={`custom-label-${request.id}`}>
                    Popisek (povinné)
                  </Label>
                  <Input
                    id={`custom-label-${request.id}`}
                    size="small"
                    placeholder="kompenzace"
                    value={custom.label}
                    onChange={(event) => setCustom({ ...custom, label: event.target.value })}
                  />
                </div>
                {!customValid && (
                  <Text size="xsmall" className="text-ui-fg-error sm:col-span-2">
                    Zadejte částku větší než 0 a popisek.
                  </Text>
                )}
              </div>
            )}
          </div>

          {/* ------------------------------------------------ součet ---- */}
          <div className="border-ui-border-base flex items-baseline justify-between border-t pt-2">
            <Text size="small" className="text-ui-fg-subtle">
              Celkem k vrácení
            </Text>
            <Text size="large" weight="plus" className={overRemaining ? "text-ui-fg-error" : ""}>
              {formatCzk(total)}
            </Text>
          </div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Zbývá vrátit {formatCzk(remaining)}
            {refunded > 0 ? ` (už vráceno ${formatCzk(refunded)})` : ""}.
          </Text>
          {overRemaining && (
            <Text size="xsmall" className="text-ui-fg-error">
              Součet {formatCzk(total)} přesahuje, co zbývá vrátit ({formatCzk(remaining)}).
              Odeberte řádek nebo snižte kusy.
            </Text>
          )}

          <div className="flex flex-col gap-y-1">
            <Label size="xsmall" htmlFor={`basket-note-${request.id}`}>
              {noteRequired
                ? "Důvod vrácení bez zásilky (povinné)"
                : "Poznámka (volitelné, např. důvod krácení)"}
            </Label>
            <Textarea
              id={`basket-note-${request.id}`}
              rows={2}
              placeholder={
                noteRequired
                  ? "Zboží zákazník nikdy neobdržel — zásilka se vrátila."
                  : "Např. Kráceno o 200 Kč za poškrábanou glazuru."
              }
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <label className="flex items-start gap-x-2">
            <Checkbox
              checked={markResolved}
              onCheckedChange={(checked) => setMarkResolved(checked === true)}
            />
            <span>
              <Text size="small">Označit jako vyřízené</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Žádost se uzavře a zákazník dostane potvrzení o vyřízení. Když
                zbývá vrátit 0 Kč, uzavře se vždy. Nechte vypnuté, pokud budete
                vracet nadvakrát.
              </Text>
            </span>
          </label>

          <Text size="xsmall" className="text-ui-fg-subtle">
            Placeno kartou → vrátí se přes ComGate; jinak se zaznamená k ručnímu
            vrácení. Zákazník dostane e-mail s řádky a částkou; dobropis se
            vystaví za tuto refundaci (v ostrém režimu).
          </Text>

          <div className="flex flex-wrap gap-2">
            <Button
              size="small"
              variant="primary"
              type="submit"
              isLoading={mutation.isPending}
              disabled={!canSubmit}
              title={
                lines.length === 0
                  ? "Košík je prázdný — vyberte položky, poštovné nebo jinou částku."
                  : undefined
              }
            >
              Vrátit {total > 0 && !overRemaining ? formatCzk(total) : "peníze"}
            </Button>
          </div>
        </PanelShell>
      )}

      {(canRefundAll || hasProduction) && (
        <div className="flex flex-col gap-y-2">
          {canRefundAll && (
            <RefundAllPrompt
              request={request}
              items={items}
              shipping={shipping}
              skipGoodsCheck={skipGoodsCheck}
              onDone={() => {
                reset();
                onRefunded();
              }}
            />
          )}
          {hasProduction && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Zálohu zakázky vracíte výslovně tlačítkem „Vrátit zálohu" v bloku Zakázka
              (§1837 — rozhodnutí majitelky).
            </Text>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * „Vrátit celou objednávku" — `POST …/refund { scope: "all" }`: všechny
 * zbývající položky + poštovné = zbývá. Potvrzení vypíše, co to zahrnuje.
 * Při „bez čekání na zásilku" je důvod povinný (jde k refundaci).
 */
export const RefundAllPrompt = ({
  request,
  items,
  shipping,
  skipGoodsCheck,
  onDone,
}: {
  request: ReturnRequest;
  items: ClaimDetailItem[];
  shipping?: ClaimShipping | null;
  skipGoodsCheck: boolean;
  onDone?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const mutation = useReturnAction<RefundResponse>(request.id, "refund");
  const remaining = asNumber(request.remaining);

  const remainingItems = items
    .map((item) => ({ item, quantity: refundableQuantity(item) }))
    .filter((entry) => entry.quantity > 0);
  const shippingRefundable = shipping ? Math.max(0, asNumber(shipping.refundable)) : 0;
  const noteRequired = skipGoodsCheck;
  const canConfirm = remaining > 0 && (!noteRequired || note.trim().length > 0);

  return (
    <Prompt open={open} onOpenChange={setOpen}>
      <Prompt.Trigger asChild>
        <Button size="small" variant="secondary" disabled={remaining <= 0}>
          Vrátit celou objednávku ({formatCzk(remaining)})
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Vrátit celou objednávku #{request.order_display_id}?</Prompt.Title>
          <Prompt.Description>
            Vrátí se všechno, co na objednávce zbývá — {formatCzk(remaining)}. Zahrnuje:
          </Prompt.Description>
        </Prompt.Header>
        <div className="flex flex-col gap-y-3 px-6 pb-4">
          <ul className="flex flex-col gap-y-0.5">
            {remainingItems.map(({ item, quantity }) => (
              <li key={item.line_item_id} className="flex items-baseline justify-between gap-x-3">
                <Text size="xsmall" className="min-w-0 truncate" title={item.title}>
                  {item.title}
                  {item.variant_title && item.variant_title !== "Default variant"
                    ? ` · ${item.variant_title}`
                    : ""}{" "}
                  · {quantity} ks
                </Text>
                <Text size="xsmall" className="whitespace-nowrap">
                  {formatCzk(round2(itemAmount(item, quantity)))}
                </Text>
              </li>
            ))}
            {remainingItems.length === 0 && (
              <li>
                <Text size="xsmall" className="text-ui-fg-muted">
                  {items.length === 0
                    ? "Položky objednávky se nenačetly — vrátí se zbývající částka."
                    : "Všechny položky už jsou vrácené."}
                </Text>
              </li>
            )}
            {shipping && (
              <li className="flex items-baseline justify-between gap-x-3">
                <Text size="xsmall" className={shippingRefundable > 0 ? "" : "text-ui-fg-muted"}>
                  Poštovné{shippingRefundable > 0 ? "" : " (už vrácené / žádné)"}
                </Text>
                <Text size="xsmall" className="whitespace-nowrap">
                  {formatCzk(shippingRefundable)}
                </Text>
              </li>
            )}
            <li className="border-ui-border-base flex items-baseline justify-between gap-x-3 border-t pt-1">
              <Text size="xsmall" weight="plus">
                Celkem
              </Text>
              <Text size="xsmall" weight="plus" className="whitespace-nowrap">
                {formatCzk(remaining)}
              </Text>
            </li>
          </ul>
          {skipGoodsCheck && (
            <div className="flex flex-col gap-y-1">
              <Label size="xsmall" htmlFor={`refund-all-note-${request.id}`}>
                Důvod vrácení bez zásilky (povinné)
              </Label>
              <Textarea
                id={`refund-all-note-${request.id}`}
                rows={2}
                placeholder="Zboží zákazník nikdy neobdržel — zásilka se vrátila."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          )}
          <Text size="xsmall" className="text-ui-fg-subtle">
            Placeno kartou → ComGate, jinak ruční vrácení. Žádost se po vrácení všeho
            uzavře; zákazník dostane e-mail a dobropis (v ostrém režimu).
          </Text>
        </div>
        <Prompt.Footer>
          <Prompt.Cancel>Zpět</Prompt.Cancel>
          <Prompt.Action
            disabled={!canConfirm || mutation.isPending}
            onClick={() =>
              mutation.mutate(
                {
                  scope: "all",
                  ...(note.trim() ? { note: note.trim() } : {}),
                  ...(skipGoodsCheck ? { skip_goods_check: true } : {}),
                },
                {
                  onSuccess: (result) => {
                    toast.success(result?.message ?? "Celá objednávka byla vrácena.");
                    setOpen(false);
                    setNote("");
                    onDone?.();
                  },
                }
              )
            }
          >
            Vrátit {formatCzk(remaining)}
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};
