import { Badge, Button, Checkbox, Input, Table, Text } from "@medusajs/ui";
import {
  asNumber,
  type ClaimDetailItem,
  type ClaimDetailOrder,
} from "../../lib/return-requests";
import { formatCzk } from "../../lib/workbench";
import type { RefundSelection } from "./refund-panel";

/**
 * Objednávka na stránce žádosti (docs/reklamace-a-zruseni.md §12.6): všechny
 * položky s miniaturou, cenou za kus (po slevě, s DPH) a součtem, štítek
 * „zakázka", „už vráceno N ks", a — když server povolí vracení po položkách —
 * zaškrtávátko + počet kusů k vrácení, omezený tím, co ještě jde vrátit.
 *
 * Výběr drží stránka (`selection`: id položky → kusy), tabulka ho jen kreslí
 * a mění; živý součet „K vrácení" se počítá z `unit_total × kusy`, u zakázkové
 * položky omezený `refundable_amount` (zaplacenou zálohou).
 */

export type ItemSelection = Record<string, number>;

/** Kolik kusů ještě jde vrátit — server to posílá; bez toho objednané − vrácené. */
export const refundableQuantity = (item: ClaimDetailItem): number => {
  if (item.refundable_quantity !== undefined && item.refundable_quantity !== null) {
    return Math.max(0, asNumber(item.refundable_quantity));
  }
  return Math.max(0, asNumber(item.quantity) - asNumber(item.refunded_quantity));
};

/** Částka za `quantity` kusů položky, omezená tím, co je za ni zaplaceno. */
export const itemAmount = (item: ClaimDetailItem, quantity: number): number => {
  const raw = asNumber(item.unit_total) * quantity;
  if (item.refundable_amount !== undefined && item.refundable_amount !== null) {
    return Math.min(raw, asNumber(item.refundable_amount));
  }
  return raw;
};

/** Předvýběr: co zákazník vybral v žádosti, nejvýš kolik ještě jde vrátit. */
export const initialSelection = (items: ClaimDetailItem[]): ItemSelection => {
  const selection: ItemSelection = {};
  for (const item of items) {
    const wanted = Math.min(asNumber(item.selected_in_claim), refundableQuantity(item));
    if (wanted > 0) {
      selection[item.line_item_id] = wanted;
    }
  }
  return selection;
};

/** Výběr → položky pro panel refundace (jen ty s kusy > 0). */
export const selectionToRefund = (
  items: ClaimDetailItem[],
  selection: ItemSelection
): RefundSelection[] =>
  items.flatMap((item) => {
    const quantity = Math.min(asNumber(selection[item.line_item_id]), refundableQuantity(item));
    if (quantity <= 0) return [];
    return [
      {
        line_item_id: item.line_item_id,
        quantity,
        title: itemTitle(item),
        unit_total: asNumber(item.unit_total),
        amount: itemAmount(item, quantity),
      },
    ];
  });

export const selectionTotal = (items: ClaimDetailItem[], selection: ItemSelection) =>
  selectionToRefund(items, selection).reduce(
    (sum, item) => ({ amount: sum.amount + item.amount, quantity: sum.quantity + item.quantity }),
    { amount: 0, quantity: 0 }
  );

const itemTitle = (item: ClaimDetailItem) => {
  const variant =
    item.variant_title && item.variant_title !== "Default variant" ? item.variant_title : null;
  return variant ? `${item.title} · ${variant}` : item.title;
};

export const OrderItemsTable = ({
  items,
  order,
  selection,
  onChange,
  selectable,
}: {
  items: ClaimDetailItem[];
  order?: ClaimDetailOrder | null;
  selection: ItemSelection;
  onChange: (next: ItemSelection) => void;
  /** Server teď povoluje vracení po položkách → kreslí se výběr. */
  selectable: boolean;
}) => {
  const totals = selectionTotal(items, selection);
  const anyRefundable = items.some((item) => refundableQuantity(item) > 0);

  const setQuantity = (item: ClaimDetailItem, quantity: number) => {
    const max = refundableQuantity(item);
    const next = Math.max(0, Math.min(max, Math.floor(quantity)));
    const copy = { ...selection };
    if (next > 0) {
      copy[item.line_item_id] = next;
    } else {
      delete copy[item.line_item_id];
    }
    onChange(copy);
  };

  const selectAll = () => {
    const all: ItemSelection = {};
    for (const item of items) {
      const max = refundableQuantity(item);
      if (max > 0) all[item.line_item_id] = max;
    }
    onChange(all);
  };

  if (items.length === 0) {
    return (
      <Text size="small" className="text-ui-fg-muted">
        Položky objednávky se nepodařilo načíst.
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div className="overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row>
              {selectable && <Table.HeaderCell className="w-10" />}
              <Table.HeaderCell>Položka</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Ks</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Za kus</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Celkem</Table.HeaderCell>
              {selectable && <Table.HeaderCell className="text-right">K vrácení</Table.HeaderCell>}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item) => {
              const max = refundableQuantity(item);
              const refundedQty = asNumber(item.refunded_quantity);
              const selected = Math.min(asNumber(selection[item.line_item_id]), max);
              const inClaim = asNumber(item.selected_in_claim);
              return (
                <Table.Row key={item.line_item_id}>
                  {selectable && (
                    <Table.Cell>
                      <Checkbox
                        checked={selected > 0}
                        disabled={max <= 0}
                        aria-label={`Vrátit ${itemTitle(item)}`}
                        onCheckedChange={(checked) =>
                          setQuantity(item, checked === true ? (inClaim > 0 ? Math.min(inClaim, max) : max) : 0)
                        }
                      />
                    </Table.Cell>
                  )}
                  <Table.Cell>
                    <div className="flex items-start gap-x-3">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="mt-0.5 h-10 w-10 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden="true"
                          className="bg-ui-bg-component mt-0.5 h-10 w-10 shrink-0 rounded"
                        />
                      )}
                      <div className="min-w-0">
                        <Text size="small" className="truncate" title={itemTitle(item)}>
                          {item.title}
                          {item.variant_title && item.variant_title !== "Default variant" ? (
                            <span className="text-ui-fg-subtle"> · {item.variant_title}</span>
                          ) : null}
                        </Text>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {item.is_made_to_order && (
                            <Badge size="2xsmall" color="purple">
                              zakázka
                            </Badge>
                          )}
                          {refundedQty > 0 && (
                            <Badge size="2xsmall" color="green">
                              už vráceno {refundedQty} ks
                            </Badge>
                          )}
                          {inClaim > 0 && (
                            <Badge size="2xsmall" color="grey">
                              v žádosti {inClaim} ks
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text size="small">{asNumber(item.quantity)}</Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text size="small" className="whitespace-nowrap">
                      {formatCzk(asNumber(item.unit_total))}
                    </Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text size="small" weight="plus" className="whitespace-nowrap">
                      {formatCzk(asNumber(item.line_total))}
                    </Text>
                  </Table.Cell>
                  {selectable && (
                    <Table.Cell>
                      {max > 0 ? (
                        <div className="flex items-center justify-end gap-x-1">
                          <Button
                            size="small"
                            variant="secondary"
                            type="button"
                            aria-label="Méně kusů"
                            disabled={selected <= 0}
                            onClick={() => setQuantity(item, selected - 1)}
                          >
                            −
                          </Button>
                          <Input
                            size="small"
                            type="number"
                            min={0}
                            max={max}
                            className="w-14 text-center"
                            value={String(selected)}
                            aria-label="Kusů k vrácení"
                            onChange={(event) => setQuantity(item, Number(event.target.value))}
                          />
                          <Button
                            size="small"
                            variant="secondary"
                            type="button"
                            aria-label="Více kusů"
                            disabled={selected >= max}
                            onClick={() => setQuantity(item, selected + 1)}
                          >
                            +
                          </Button>
                          <Text size="xsmall" className="text-ui-fg-subtle whitespace-nowrap">
                            z {max}
                          </Text>
                        </div>
                      ) : (
                        <Text size="xsmall" className="text-ui-fg-muted text-right">
                          nic k vrácení
                        </Text>
                      )}
                    </Table.Cell>
                  )}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        {order && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
            {order.subtotal !== undefined && order.subtotal !== null && (
              <>
                <dt>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Zboží
                  </Text>
                </dt>
                <dd>
                  <Text size="xsmall">{formatCzk(asNumber(order.subtotal))}</Text>
                </dd>
              </>
            )}
            {order.shipping_total !== undefined && order.shipping_total !== null && (
              <>
                <dt>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Doprava
                  </Text>
                </dt>
                <dd>
                  <Text size="xsmall">{formatCzk(asNumber(order.shipping_total))}</Text>
                </dd>
              </>
            )}
            {order.total !== undefined && order.total !== null && (
              <>
                <dt>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Celkem
                  </Text>
                </dt>
                <dd>
                  <Text size="xsmall" weight="plus">
                    {formatCzk(asNumber(order.total))}
                  </Text>
                </dd>
              </>
            )}
          </dl>
        )}

        {selectable && (
          <div className="flex flex-col items-end gap-y-1">
            <Text size="small" weight="plus">
              K vrácení: {formatCzk(Math.round(totals.amount * 100) / 100)}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              vybráno {totals.quantity} ks
            </Text>
            {anyRefundable && (
              <div className="flex gap-x-3">
                <button
                  type="button"
                  className="text-ui-fg-interactive txt-small hover:underline"
                  onClick={selectAll}
                >
                  Vybrat vše
                </button>
                {totals.quantity > 0 && (
                  <button
                    type="button"
                    className="text-ui-fg-interactive txt-small hover:underline"
                    onClick={() => onChange({})}
                  >
                    Zrušit výběr
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
