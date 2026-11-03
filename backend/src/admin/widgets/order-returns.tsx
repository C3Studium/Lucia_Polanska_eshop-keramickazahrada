import { Badge, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { OrderSection } from "../components/order-section";
import { DamageBadge, LineItemsList } from "../components/return-line-items";
import { formatDateTime } from "../lib/format";
import {
  asNumber,
  DAMAGE_CAUSE_HINT,
  DAMAGE_CAUSE_TEXT_CLASS,
  deadlineInfo,
  isDamageCause,
  isFinalStatus,
  KIND_META,
  reklamaceLink,
  RESOLUTION_LABEL,
  STATUS_META,
  type ReturnRequest,
  type ReturnRequestListResponse,
} from "../lib/return-requests";
import { sdk } from "../lib/sdk";
import { formatCzk } from "../lib/workbench";

/**
 * Reklamace a vrácení na detailu objednávky — ať majitelka vidí stav i tady.
 *
 * Jen čtení + odkaz do modulu. Schválení, přijetí zboží i vrácení peněz se
 * dělá výhradně v „Reklamace a vrácení", kde se akce nabízejí podle stavu
 * (docs/reklamace-a-zruseni.md §3, §8) — tlačítko „vrátit celou částku" tu
 * záměrně není, obcházelo pravidla. Bez žádostí se widget nevykreslí.
 */

/** Co teď čeká na majitelku, jednou větou. */
const nextStep = (request: ReturnRequest): string => {
  switch (request.status) {
    case "pending":
      return "Čeká na vaše rozhodnutí — schválit, nebo zamítnout.";
    case "approved":
      if (
        request.kind === "reklamace" &&
        (request.resolution === "refund" || request.resolution === "discount")
      ) {
        return "Schváleno — můžete vrátit peníze, nebo počkat na zboží.";
      }
      if (request.resolution === "repair" || request.resolution === "replace") {
        return "Schváleno — čeká se na zboží k opravě / výměně.";
      }
      return "Schváleno — čeká se, až zákazník pošle zboží zpět.";
    case "received":
      return asNumber(request.remaining) > 0
        ? "Zboží je u vás — vraťte peníze a žádost vyřiďte."
        : "Zboží je u vás — zbývá potvrdit vyřízení.";
    case "resolved":
      return request.kind === "reklamace"
        ? "Vyřízeno."
        : "Vyřízeno — objednávku můžete zrušit a uvolnit sklad.";
    case "rejected":
      return "Zamítnuto.";
    case "cancelled":
      return "Žádost stornována.";
    default:
      return "";
  }
};

const RequestRow = ({ request }: { request: ReturnRequest }) => {
  const deadline = isFinalStatus(request.status)
    ? null
    : deadlineInfo(request.resolve_by);
  const captured = asNumber(request.captured_total);
  const refunded = asNumber(request.refunded_total);
  const remaining = asNumber(request.remaining);

  return (
    <div className="flex flex-col gap-y-2 px-6 py-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {request.kind && (
          <Badge size="2xsmall" color={KIND_META[request.kind].color}>
            {KIND_META[request.kind].label}
          </Badge>
        )}
        <Badge size="2xsmall" color={STATUS_META[request.status].color}>
          {STATUS_META[request.status].label}
        </Badge>
        {deadline && (
          <Badge size="2xsmall" color={deadline.color}>
            {deadline.label}
          </Badge>
        )}
        {request.resolution && request.status !== "pending" && (
          <Badge size="2xsmall" color="grey">
            {RESOLUTION_LABEL[request.resolution]}
          </Badge>
        )}
        <DamageBadge cause={request.damage_cause} />
      </div>

      {isDamageCause(request.damage_cause) && (
        <Text size="xsmall" className={DAMAGE_CAUSE_TEXT_CLASS[request.damage_cause]}>
          {DAMAGE_CAUSE_HINT[request.damage_cause]}
        </Text>
      )}

      <Text size="small" className="text-ui-fg-subtle">
        {request.reason}
      </Text>

      {request.line_items && request.line_items.length > 0 && (
        <LineItemsList items={request.line_items} showTotal />
      )}

      <Text size="xsmall" weight="plus">
        {nextStep(request)}
      </Text>

      {captured > 0 && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Zachyceno {formatCzk(captured)} · vráceno {formatCzk(refunded)} · zbývá{" "}
          {formatCzk(remaining)}
        </Text>
      )}

      <Text size="xsmall" className="text-ui-fg-muted">
        Přijato {formatDateTime(request.created_at)}
        {request.protocol_number ? ` · ${request.protocol_number}` : ""}
      </Text>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={reklamaceLink(request)}
          className="text-ui-fg-interactive txt-small hover:underline"
        >
          Otevřít v Reklamace a vrácení
        </Link>
        {request.protocol_url && (
          <a
            href={request.protocol_url}
            target="_blank"
            rel="noreferrer"
            className="text-ui-fg-interactive txt-small hover:underline"
          >
            Protokol (PDF)
          </a>
        )}
      </div>
    </div>
  );
};

/**
 * Sbalená karta v „Práci s objednávkou" (3. 11. 2026). Bez žádostí se
 * nevykreslí vůbec; sama se otevře, dokud nějaká žádost není vyřízená.
 */
export const OrderReturnsPanel = ({ orderId }: { orderId: string }) => {
  const { data } = useQuery<ReturnRequestListResponse>({
    queryKey: ["order-returns", orderId],
    queryFn: () =>
      sdk.client.fetch("/admin/return-requests", {
        query: { order_id: orderId, status: "all", limit: 20 },
      }),
  });

  const requests = data?.return_requests ?? [];
  if (!requests.length) {
    return null;
  }

  const open = requests.filter((request) => !isFinalStatus(request.status));

  return (
    <OrderSection
      title="Reklamace a vrácení"
      badge={
        open.length ? (
          <Badge color="orange">Otevřené: {open.length}</Badge>
        ) : (
          <Badge color="grey">Vyřízeno</Badge>
        )
      }
      summary={
        requests.length === 1
          ? `1 žádost · ${STATUS_META[requests[0].status].label}`
          : `${requests.length} ${requests.length < 5 ? "žádosti" : "žádostí"}`
      }
      attention={open.length > 0}
    >
      {requests.map((request) => (
        <RequestRow key={request.id} request={request} />
      ))}

      <div className="flex flex-col gap-y-2 px-6 py-3">
        <Link
          to="/reklamace"
          className="text-ui-fg-interactive txt-small hover:underline"
        >
          Otevřít Reklamace a vrácení
        </Link>
        <Text size="xsmall" className="text-ui-fg-muted">
          Rozhodnutí, přijetí zboží i vrácení peněz se dělá jen v modulu
          Reklamace a vrácení — podle stavu žádosti. Nativní „Zrušit objednávku"
          projde až po vyřízení vrácení peněz.
        </Text>
      </div>
    </OrderSection>
  );
};
