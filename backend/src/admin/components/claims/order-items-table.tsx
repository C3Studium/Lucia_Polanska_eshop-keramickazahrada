import { Badge, Button, Checkbox, Input, Table, Text } from "@medusajs/ui";
import { useState } from "react";
import {
  asNumber,
  round2,
  type ClaimDetailItem,
  type ClaimDetailOrder,
  type ClaimItemComponent,
  type RefundLineInput,
} from "../../lib/return-requests";
import { formatCzk } from "../../lib/workbench";

/**
 * Objednávka na stránce žádosti (docs/reklamace-a-zruseni.md §12.6, §13.2,
 * §13.5): všechny položky s miniaturou, cenou za kus (po slevě, s DPH) a
 * součtem, štítky „zakázka" / „balíček" / „už vráceno N ks" / „v žádosti N ks",
 * a — když server povolí vracení — zaškrtávátko + počet kusů k vrácení,
 * omezený tím, co ještě jde vrátit.
 *
 * Balíček (`components`) se dá rozbalit na komponenty; vracet jde buď celý
 * balíček, nebo jednotlivé komponenty (ne obojí — to by se počítalo dvakrát;
 * server to stejně odmítne).
 *
 * NIC se nepředvybírá (§13.2): `selected_in_claim` je jen nápověda v badge.
 * Výběr drží stránka (`BasketSelection`), tabulka ho kreslí a mění; košík
 * vrácení (`refund-basket.tsx`) z něj skládá řádky `lines`.
 */

export type BasketSelection = {
  /** id položky → kusy k vrácení */
  items: Record<string, number>;
  /** `componentKey(line_item_id, product_id)` → kusy komponenty k vrácení */
  components: Record<string, number>;
};

export const emptySelection = (): BasketSelection => ({ items: {}, components: {} });

export const componentKey = (lineItemId: string, productId: string) =>
  `${lineItemId}/${productId}`;

/** Kolik kusů ještě jde vrátit — server to posílá; bez toho objednané − vrácené. */
export const refundableQuantity = (item: ClaimDetailItem): number => {
  if (item.refundable_quantity !== undefined && item.refundable_quantity !== null) {
    return Math.max(0, asNumber(item.refundable_quantity));
  }
  return Math.max(0, asNumber(item.quantity) - asNumber(item.refunded_quantity));
};

/**
 * Kusy komponenty, které ještě jde vrátit (za celou položku). Server posílá
 * `refundable_quantity`; bez něj kusy na balíček × nevrácené balíčky − už
 * vrácené kusy komponenty.
 */
export const componentRefundableQuantity = (
  item: ClaimDetailItem,
  component: ClaimItemComponent
): number => {
  if (component.refundable_quantity !== undefined && component.refundable_quantity !== null) {
    return Math.max(0, asNumber(component.refundable_quantity));
  }
  return Math.max(
    0,
    asNumber(component.quantity) * refundableQuantity(item) - asNumber(component.refunded_quantity)
  );
};

/** Částka za `quantity` kusů položky, omezená tím, co je za ni zaplaceno. */
export const itemAmount = (item: ClaimDetailItem, quantity: number): number => {
  const raw = asNumber(item.unit_total) * quantity;
  if (item.refundable_amount !== undefined && item.refundable_amount !== null) {
    return Math.min(raw, asNumber(item.refundable_amount));
  }
  return raw;
};

export const componentAmount = (component: ClaimItemComponent, quantity: number): number =>
  asNumber(component.unit_share) * quantity;

const itemTitle = (item: ClaimDetailItem) => {
  const variant =
    item.variant_title && item.variant_title !== "Default variant" ? item.variant_title : null;
  return variant ? `${item.title} · ${variant}` : item.title;
};

/** Řádek košíku složený z výběru — s popiskem a částkou pro živý součet. */
export type BasketItemLine = {
  key: string;
  line: Extract<RefundLineInput, { type: "item" | "component" }>;
  title: string;
  quantity: number;
  /** Kolik jde nejvýš — výběr se na to ořezává (po refundaci se mění). */
  max: number;
  amount: number;
};

/** Výběr → řádky košíku (jen kusy > 0, oříznuté na to, co ještě jde vrátit). */
export const selectionToLines = (
  items: ClaimDetailItem[],
  selection: BasketSelection
): BasketItemLine[] =>
  items.flatMap((item) => {
    const lines: BasketItemLine[] = [];
    const max = refundableQuantity(item);
    const quantity = Math.min(asNumber(selection.items[item.line_item_id]), max);
    if (quantity > 0) {
      lines.push({
        key: item.line_item_id,
        line: { type: "item", line_item_id: item.line_item_id, quantity },
        title: itemTitle(item),
        quantity,
        max,
        amount: itemAmount(item, quantity),
      });
    }
    for (const component of item.components ?? []) {
      const key = componentKey(item.line_item_id, component.product_id);
      const componentMax = componentRefundableQuantity(item, component);
      const componentQuantity = Math.min(asNumber(selection.components[key]), componentMax);
      if (componentQuantity > 0) {
        lines.push({
          key,
          line: {
            type: "component",
            line_item_id: item.line_item_id,
            product_id: component.product_id,
            quantity: componentQuantity,
          },
          title: `${component.title} (z balíčku ${item.title})`,
          quantity: componentQuantity,
          max: componentMax,
          amount: componentAmount(component, componentQuantity),
        });
      }
    }
    return lines;
  });

export const selectionTotal = (items: ClaimDetailItem[], selection: BasketSelection) =>
  selectionToLines(items, selection).reduce(
    (sum, line) => ({
      amount: round2(sum.amount + line.amount),
      quantity: sum.quantity + line.quantity,
    }),
    { amount: 0, quantity: 0 }
  );

/** Kusy položky / komponenty v tabulce: − [n] + z max. */
const QuantityControl = ({
  value,
  max,
  label,
  onChange,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (next: number) => void;
}) => (
  <div className="flex items-center justify-end gap-x-1">
    <Button
      size="small"
      variant="secondary"
      type="button"
      aria-label={`Méně kusů — ${label}`}
      disabled={value <= 0}
      onClick={() => onChange(value - 1)}
    >
      −
    </Button>
    <Input
      size="small"
      type="number"
      min={0}
      max={max}
      className="w-14 text-center"
      value={String(value)}
      aria-label={`Kusů k vrácení — ${label}`}
      onChange={(event) => onChange(Number(event.target.value))}
    />
    <Button
      size="small"
      variant="secondary"
      type="button"
      aria-label={`Více kusů — ${label}`}
      disabled={value >= max}
      onClick={() => onChange(value + 1)}
    >
      +
    </Button>
    <Text size="xsmall" className="text-ui-fg-subtle whitespace-nowrap">
      z {max}
    </Text>
  </div>
);

const Thumb = ({ src, small }: { src?: string | null; small?: boolean }) => {
  const size = small ? "h-7 w-7" : "h-10 w-10";
  return src ? (
    <img src={src} alt="" className={`mt-0.5 ${size} shrink-0 rounded object-cover`} />
  ) : (
    <div aria-hidden="true" className={`bg-ui-bg-component mt-0.5 ${size} shrink-0 rounded`} />
  );
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
  selection: BasketSelection;
  onChange: (next: BasketSelection) => void;
  /** Server teď povoluje vracení → kreslí se výběr. */
  selectable: boolean;
}) => {
  const totals = selectionTotal(items, selection);
  const anyRefundable = items.some((item) => refundableQuantity(item) > 0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const setItemQuantity = (item: ClaimDetailItem, quantity: number) => {
    const max = refundableQuantity(item);
    const next = Math.max(0, Math.min(max, Math.floor(quantity)));
    const copy = { ...selection.items };
    if (next > 0) {
      copy[item.line_item_id] = next;
    } else {
      delete copy[item.line_item_id];
    }
    onChange({ ...selection, items: copy });
  };

  const setComponentQuantity = (
    item: ClaimDetailItem,
    component: ClaimItemComponent,
    quantity: number
  ) => {
    const key = componentKey(item.line_item_id, component.product_id);
    const max = componentRefundableQuantity(item, component);
    const next = Math.max(0, Math.min(max, Math.floor(quantity)));
    const copy = { ...selection.components };
    if (next > 0) {
      copy[key] = next;
    } else {
      delete copy[key];
    }
    onChange({ ...selection, components: copy });
  };

  const anyComponentSelected = (item: ClaimDetailItem) =>
    (item.components ?? []).some(
      (component) =>
        asNumber(selection.components[componentKey(item.line_item_id, component.product_id)]) > 0
    );

  const selectAll = () => {
    const all: Record<string, number> = {};
    for (const item of items) {
      const max = refundableQuantity(item);
      if (max > 0) all[item.line_item_id] = max;
    }
    onChange({ items: all, components: {} });
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
            {items.flatMap((item) => {
              const max = refundableQuantity(item);
              const refundedQty = asNumber(item.refunded_quantity);
              const selected = Math.min(asNumber(selection.items[item.line_item_id]), max);
              const inClaim = asNumber(item.selected_in_claim);
              const components = item.components ?? [];
              const isBundle = Boolean(item.is_bundle) || components.length > 0;
              const isExpanded = expanded[item.line_item_id] === true;
              const componentsSelected = anyComponentSelected(item);
              const title = itemTitle(item);

              const rows = [
                <Table.Row key={item.line_item_id}>
                  {selectable && (
                    <Table.Cell>
                      <Checkbox
                        checked={selected > 0}
                        disabled={max <= 0 || componentsSelected}
                        aria-label={`Vrátit ${title}`}
                        title={
                          componentsSelected
                            ? "Vybrané jsou komponenty balíčku — celý balíček a komponenty naráz vrátit nejde."
                            : undefined
                        }
                        onCheckedChange={(checked) =>
                          setItemQuantity(
                            item,
                            checked === true ? (inClaim > 0 ? Math.min(inClaim, max) : max) : 0
                          )
                        }
                      />
                    </Table.Cell>
                  )}
                  <Table.Cell>
                    <div className="flex items-start gap-x-3">
                      <Thumb src={item.thumbnail} />
                      <div className="min-w-0">
                        <Text size="small" className="truncate" title={title}>
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
                          {isBundle && (
                            <Badge size="2xsmall" color="blue">
                              balíček
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
                          {components.length > 0 && (
                            <button
                              type="button"
                              className="text-ui-fg-interactive txt-small hover:underline"
                              aria-expanded={isExpanded}
                              onClick={() =>
                                setExpanded({ ...expanded, [item.line_item_id]: !isExpanded })
                              }
                            >
                              {isExpanded ? "▾ skrýt komponenty" : `▸ ${components.length} komponent`}
                            </button>
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
                      {max > 0 && !componentsSelected ? (
                        <QuantityControl
                          value={selected}
                          max={max}
                          label={title}
                          onChange={(next) => setItemQuantity(item, next)}
                        />
                      ) : (
                        <Text size="xsmall" className="text-ui-fg-muted text-right">
                          {componentsSelected ? "po komponentách" : "nic k vrácení"}
                        </Text>
                      )}
                    </Table.Cell>
                  )}
                </Table.Row>,
              ];

              if (isExpanded) {
                for (const component of components) {
                  const key = componentKey(item.line_item_id, component.product_id);
                  const componentMax = componentRefundableQuantity(item, component);
                  const componentSelected = Math.min(
                    asNumber(selection.components[key]),
                    componentMax
                  );
                  const componentRefunded = asNumber(component.refunded_quantity);
                  const perBundle = asNumber(component.quantity);
                  const blockedByItem = selected > 0;
                  rows.push(
                    <Table.Row key={key} className="bg-ui-bg-subtle">
                      {selectable && (
                        <Table.Cell>
                          <Checkbox
                            checked={componentSelected > 0}
                            disabled={componentMax <= 0 || blockedByItem}
                            aria-label={`Vrátit komponentu ${component.title}`}
                            title={
                              blockedByItem
                                ? "Vybraný je celý balíček — komponenty zvlášť vrátit nejde."
                                : undefined
                            }
                            onCheckedChange={(checked) =>
                              setComponentQuantity(
                                item,
                                component,
                                checked === true ? Math.min(perBundle || 1, componentMax) : 0
                              )
                            }
                          />
                        </Table.Cell>
                      )}
                      <Table.Cell>
                        <div className="flex items-start gap-x-3 pl-6">
                          <Thumb src={component.thumbnail} small />
                          <div className="min-w-0">
                            <Text size="xsmall" className="truncate" title={component.title}>
                              {component.title}
                            </Text>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                              <Text size="xsmall" className="text-ui-fg-subtle">
                                {perBundle} ks na balíček
                              </Text>
                              {componentRefunded > 0 && (
                                <Badge size="2xsmall" color="green">
                                  už vráceno {componentRefunded} ks
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {perBundle * asNumber(item.quantity)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Text size="xsmall" className="text-ui-fg-subtle whitespace-nowrap">
                          {formatCzk(asNumber(component.unit_share))}
                        </Text>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Text size="xsmall" className="text-ui-fg-subtle whitespace-nowrap">
                          {formatCzk(
                            round2(asNumber(component.unit_share) * perBundle * asNumber(item.quantity))
                          )}
                        </Text>
                      </Table.Cell>
                      {selectable && (
                        <Table.Cell>
                          {componentMax > 0 && !blockedByItem ? (
                            <QuantityControl
                              value={componentSelected}
                              max={componentMax}
                              label={component.title}
                              onChange={(next) => setComponentQuantity(item, component, next)}
                            />
                          ) : (
                            <Text size="xsmall" className="text-ui-fg-muted text-right">
                              {blockedByItem ? "celý balíček" : "nic k vrácení"}
                            </Text>
                          )}
                        </Table.Cell>
                      )}
                    </Table.Row>
                  );
                }
              }

              return rows;
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
              Vybráno: {formatCzk(totals.amount)}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {totals.quantity} ks · částka se skládá v košíku vrácení
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
                    onClick={() => onChange(emptySelection())}
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
