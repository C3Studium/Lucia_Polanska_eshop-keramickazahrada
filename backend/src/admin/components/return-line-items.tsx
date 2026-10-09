import { Badge, Text } from "@medusajs/ui";
import {
  asNumber,
  DAMAGE_CAUSE_COLOR,
  DAMAGE_CAUSE_LABEL,
  isDamageCause,
  lineItemsQuantity,
  lineItemsTotal,
  type ReturnLineItem,
} from "../lib/return-requests";
import { formatCzk } from "../lib/workbench";

/**
 * Položky žádosti + badge „Poškozeno přepravou" (docs/reklamace-a-zruseni.md
 * §11). Jedna komponenta pro modul /reklamace, widget na detailu objednávky i
 * Objednávky+, aby se vybrané položky kreslily všude stejně — miniatura,
 * název, kusy, částka (po slevě, s DPH).
 */

/** Badge jen když příčina poškození existuje; jinak nic (žádné „—"). */
export const DamageBadge = ({ cause }: { cause: unknown }) => {
  if (!isDamageCause(cause)) {
    return null;
  }
  return (
    <Badge size="2xsmall" color={DAMAGE_CAUSE_COLOR[cause]}>
      {DAMAGE_CAUSE_LABEL[cause]}
    </Badge>
  );
};

export const LineItemsList = ({
  items,
  showTotal = false,
  totalLabel = "Cena vybraných položek",
}: {
  items: ReturnLineItem[] | null | undefined;
  /** Řádek se součtem pod seznamem — „Cena vybraných položek". */
  showTotal?: boolean;
  totalLabel?: string;
}) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-y-1.5">
      {items.map((item, index) => {
        const quantity = asNumber(item.quantity);
        const unit = asNumber(item.unit_price);
        const variant =
          item.variant_title && item.variant_title !== "Default variant"
            ? item.variant_title
            : null;
        return (
          <div
            key={item.line_item_id || index}
            className="flex items-start gap-x-2"
          >
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt=""
                className="mt-0.5 h-7 w-7 shrink-0 rounded object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="bg-ui-bg-component mt-0.5 h-7 w-7 shrink-0 rounded"
              />
            )}
            <div className="min-w-0 flex-1">
              <Text size="xsmall" className="truncate" title={item.title}>
                {item.title}
                {variant ? (
                  <span className="text-ui-fg-subtle"> — {variant}</span>
                ) : null}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {quantity} ks
                {quantity > 1 && unit > 0 ? ` à ${formatCzk(unit)}` : ""}
              </Text>
            </div>
            <Text size="xsmall" weight="plus" className="whitespace-nowrap">
              {formatCzk(asNumber(item.total))}
            </Text>
          </div>
        );
      })}
      {showTotal && (
        <div className="border-ui-border-base flex items-center justify-between gap-x-3 border-t pt-1.5">
          <Text size="xsmall" className="text-ui-fg-subtle">
            {totalLabel} · {lineItemsQuantity(items)} ks
          </Text>
          <Text size="xsmall" weight="plus" className="whitespace-nowrap">
            {formatCzk(lineItemsTotal(items))}
          </Text>
        </div>
      )}
    </div>
  );
};
