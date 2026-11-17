import type { AdminOrder } from "@medusajs/framework/types";
import { Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { OrderSection } from "../components/order-section";
import type { MerchantOrder } from "../components/merchant-order-queue";
import { formatDateTime } from "../lib/format";
import { sdk } from "../lib/sdk";
import { stageLabel } from "../lib/stage-words";

/**
 * „Historie" — kdy se objednávka posunula a kým (17. 11. 2026). Nahrazuje
 * nativní kartu Aktivita z pravého sloupce: ta míchala platby, zásilky
 * a technické události. Nejnovější nahoře; sbalená, v záhlaví poslední krok.
 */

type HistoryEntry = {
  from: string | null;
  to: string;
  at: string;
  note?: string | null;
  reconciled?: boolean;
};

export const OrderHistoryPanel = ({ order }: { order: AdminOrder }) => {
  const { data } = useQuery<{ merchant_order: MerchantOrder | null; stage_history?: HistoryEntry[] }>({
    queryKey: ["merchant-order-state", order.id],
    queryFn: () => sdk.client.fetch(`/admin/merchant-orders/${order.id}`, { method: "GET" }),
    retry: false,
  });
  const pickup = Boolean(data?.merchant_order?.is_personal_pickup);
  // Založení stavu („→ Nové") je totéž co „Objednávka přijata" dole.
  const entries = [...(data?.stage_history ?? [])]
    .filter((entry) => !(entry.from === null && entry.to === "received"))
    .reverse();
  const created = (order as any).created_at as string | undefined;
  const latest = entries[0];

  return (
    <OrderSection
      title="Historie"
      summary={
        latest
          ? `Naposledy: ${stageLabel(latest.to, pickup)} · ${formatDateTime(latest.at)}`
          : created
            ? `Objednáno ${formatDateTime(created)}`
            : undefined
      }
    >
      <ol className="flex flex-col divide-y">
        {entries.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 px-6 py-3">
            <Text size="small" className="text-ui-fg-subtle">
              {formatDateTime(entry.at)}
            </Text>
            <div className="min-w-0">
              <Text size="small" weight="plus">
                {stageLabel(entry.to, pickup)}
                {entry.reconciled ? (
                  <span className="text-ui-fg-muted font-normal"> · samo</span>
                ) : null}
              </Text>
              {entry.note ? (
                <Text size="small" className="text-ui-fg-subtle">
                  {entry.note}
                </Text>
              ) : null}
            </div>
          </li>
        ))}
        {created && (
          <li className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 px-6 py-3">
            <Text size="small" className="text-ui-fg-subtle">
              {formatDateTime(created)}
            </Text>
            <Text size="small" weight="plus">
              Objednávka přijata
            </Text>
          </li>
        )}
      </ol>
    </OrderSection>
  );
};
