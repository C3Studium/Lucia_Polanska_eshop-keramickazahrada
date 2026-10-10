import { Text } from "@medusajs/ui";
import { formatDateTime } from "../../lib/format";
import {
  asNumber,
  isRefundScope,
  REFUND_SCOPE_LABEL,
  type ClaimMoney,
  type ReturnRequest,
} from "../../lib/return-requests";
import { formatCzk } from "../../lib/workbench";

/**
 * Platby na stránce žádosti: zachyceno / vráceno / zbývá + seznam refundací
 * s rozsahem a položkami (docs/reklamace-a-zruseni.md §12.2 `money`).
 * Bez `money` (starší server) se bere dopočet ze žádosti.
 */
export const MoneyCard = ({
  money,
  request,
}: {
  money?: ClaimMoney | null;
  request: ReturnRequest;
}) => {
  const captured = asNumber(money?.captured ?? request.captured_total);
  const refunded = asNumber(money?.refunded ?? request.refunded_total);
  const remaining = asNumber(money?.remaining ?? request.remaining);
  const refunds = money?.refunds ?? request.refunds ?? [];

  return (
    <div className="flex flex-col gap-y-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt>
          <Text size="small" className="text-ui-fg-subtle">
            Zachyceno
          </Text>
        </dt>
        <dd>
          <Text size="small">{formatCzk(captured)}</Text>
        </dd>
        <dt>
          <Text size="small" className="text-ui-fg-subtle">
            Vráceno
          </Text>
        </dt>
        <dd>
          <Text size="small">{formatCzk(refunded)}</Text>
        </dd>
        <dt>
          <Text size="small" className="text-ui-fg-subtle">
            Zbývá vrátit
          </Text>
        </dt>
        <dd>
          <Text size="small" weight="plus">
            {formatCzk(remaining)}
          </Text>
        </dd>
      </dl>

      {refunds.length > 0 && (
        <ul className="border-ui-border-base flex flex-col gap-y-2 border-t pt-3">
          {refunds.map((refund, index) => {
            const scope = isRefundScope(refund.scope) ? REFUND_SCOPE_LABEL[refund.scope] : null;
            const items = refund.items ?? [];
            return (
              <li key={index} className="flex flex-col gap-y-0.5">
                <Text size="xsmall">
                  <span className="font-medium">{formatCzk(asNumber(refund.amount))}</span>{" "}
                  {refund.method === "comgate" ? "(ComGate)" : "(ručně)"}
                  {scope ? ` · ${scope}` : ""}{" "}
                  <span className="text-ui-fg-muted">{formatDateTime(refund.at)}</span>
                </Text>
                {items.length > 0 && (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {items
                      .map((item) =>
                        item.title
                          ? `${item.title} × ${asNumber(item.quantity)}`
                          : `${asNumber(item.quantity)} ks`
                      )
                      .join(", ")}
                  </Text>
                )}
                {refund.note && (
                  <Text size="xsmall" className="text-ui-fg-subtle whitespace-pre-wrap">
                    {refund.note}
                  </Text>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {refunds.length === 0 && request.refunded_at && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Vráceno {formatCzk(asNumber(request.refund_amount))}{" "}
          {request.refund_method === "comgate" ? "(ComGate)" : "(ručně)"} ·{" "}
          {formatDateTime(request.refunded_at)}
        </Text>
      )}

      {refunds.length === 0 && !request.refunded_at && captured > 0 && (
        <Text size="xsmall" className="text-ui-fg-muted">
          Zatím se nic nevracelo.
        </Text>
      )}
      {captured <= 0 && (
        <Text size="xsmall" className="text-ui-fg-muted">
          Nic nebylo zaplaceno — není co vracet.
        </Text>
      )}
    </div>
  );
};
