import { Badge, Button, Text, toast } from "@medusajs/ui";
import { formatDateTime } from "../../lib/format";
import { useReturnAction } from "./use-return-action";
import {
  asNumber,
  creditNoteIssued,
  formatRefundLine,
  isRefundCreditNote,
  isRefundLine,
  isRefundScope,
  REFUND_SCOPE_LABEL,
  type ClaimMoney,
  type ClaimShipping,
  type ReturnRefund,
  type ReturnRequest,
} from "../../lib/return-requests";
import { formatCzk } from "../../lib/workbench";
import { ceskyText } from "../../lib/ceska-chyba";

/**
 * Platby na stránce žádosti: zachyceno / vráceno / zbývá (+ poštovné) a
 * seznam refundací (docs/reklamace-a-zruseni.md §12.2 `money`, §13.2–13.4):
 * u každé řádky košíku (položka × ks / komponenta / poštovné / jiná částka),
 * způsob, potvrzení ComGate (ref, test, kdy) a dobropis (číslo + PDF, nebo
 * „až v ostrém režimu"). Starší záznamy mají místo `lines` jen `items`.
 * Bez `money` (starší server) se bere dopočet ze žádosti.
 */

const methodLabel = (refund: ReturnRefund) =>
  (refund.provider ?? refund.method) === "comgate" ? "ComGate" : "ručně";

const RefundRow = ({ refund, requestId }: { refund: ReturnRefund; requestId: string }) => {
  // Dobropis znovu (§13.3): peníze už jsou venku, doklad jde dovystavit —
  // POST /refunds/:refundId/credit-note. Jen u záznamů s id (nové) a při chybě.
  const retryCreditNote = useReturnAction<{ message?: string }>(
    requestId,
    `refunds/${encodeURIComponent(String(refund.id ?? ""))}/credit-note`
  );
  const scope = isRefundScope(refund.scope) ? REFUND_SCOPE_LABEL[refund.scope] : null;
  const lines = (refund.lines ?? []).filter(isRefundLine);
  const items = refund.items ?? [];
  const provider = refund.provider ?? refund.method;
  const creditNote = isRefundCreditNote(refund.credit_note) ? refund.credit_note : null;
  const creditNoteOk = creditNoteIssued(creditNote);
  // Zkušební režim: nový tvar `{ status: "skipped", reason }`, starší
  // `credit_note: null` + `credit_note_skipped_reason`.
  const creditNoteSkipped =
    (creditNote?.status === "skipped") || (!creditNote && Boolean(refund.credit_note_skipped_reason));
  const creditNoteSkipReason = creditNote?.reason ?? refund.credit_note_skipped_reason ?? null;
  const creditNoteError = creditNote?.status === "error";

  return (
    <li className="flex flex-col gap-y-0.5">
      <Text size="xsmall">
        <span className="font-medium">{formatCzk(asNumber(refund.amount))}</span>{" "}
        ({methodLabel(refund)}){scope ? ` · ${scope}` : ""}{" "}
        <span className="text-ui-fg-muted">{formatDateTime(refund.at)}</span>
      </Text>

      {lines.length > 0 ? (
        <ul className="flex flex-col gap-y-0.5 pl-3">
          {lines.map((line, index) => (
            <li key={index} className="flex items-baseline justify-between gap-x-3">
              <Text size="xsmall" className="text-ui-fg-subtle min-w-0 truncate">
                {formatRefundLine(line)}
              </Text>
              {line.amount !== undefined && line.amount !== null && (
                <Text size="xsmall" className="text-ui-fg-subtle whitespace-nowrap">
                  {formatCzk(asNumber(line.amount))}
                </Text>
              )}
            </li>
          ))}
        </ul>
      ) : items.length > 0 ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {items
            .map((item) =>
              item.title ? `${item.title} × ${asNumber(item.quantity)}` : `${asNumber(item.quantity)} ks`
            )
            .join(", ")}
        </Text>
      ) : null}

      {provider === "comgate" && (refund.provider_ref || refund.provider_confirmed_at) && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          ComGate přijal
          {refund.provider_ref ? ` (ref ${refund.provider_ref})` : ""}
          {refund.provider_confirmed_at ? ` · ${formatDateTime(refund.provider_confirmed_at)}` : ""}
          {refund.provider_test && (
            <>
              {" "}
              <Badge size="2xsmall" color="orange">
                test
              </Badge>
            </>
          )}
          {refund.provider_refunded_total !== undefined && refund.provider_refunded_total !== null
            ? ` · u ComGate vráceno celkem ${formatCzk(asNumber(refund.provider_refunded_total))}`
            : ""}
        </Text>
      )}
      {provider === "manual" && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Ruční vrácení (převod / hotovost) — bez ComGate.
        </Text>
      )}

      {creditNote && creditNoteOk && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Dobropis {creditNote.number ?? creditNote.id ?? ""}
          {creditNote.pdf_url ? (
            <>
              {" "}
              <a
                href={creditNote.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="text-ui-fg-interactive hover:underline"
              >
                PDF
              </a>
            </>
          ) : null}
          {creditNote.issued_at ? ` · ${formatDateTime(creditNote.issued_at)}` : ""}
        </Text>
      )}
      {creditNoteSkipped && (
        <Text size="xsmall" className="text-ui-fg-muted" title={creditNoteSkipReason ?? undefined}>
          Dobropis až v ostrém režimu
          {creditNoteSkipReason ? ` — ${creditNoteSkipReason}` : " (iDoklad ve zkušebním režimu)"}.
        </Text>
      )}
      {creditNoteError && (
        <div className="flex flex-wrap items-center gap-2">
          <Text size="xsmall" className="text-ui-fg-error" title={creditNote?.reason ?? undefined}>
            Dobropis se nepodařilo vystavit
            {creditNote?.reason ? ` — ${creditNote.reason}` : " (iDoklad odmítl; vývojář má upozornění)"}.
          </Text>
          {refund.id && (
            <Button
              size="small"
              variant="secondary"
              isLoading={retryCreditNote.isPending}
              onClick={() =>
                retryCreditNote.mutate(
                  {},
                  {
                    onSuccess: (result) =>
                      toast.success(ceskyText(result?.message, "Dobropis vystaven.")),
                  }
                )
              }
            >
              Vystavit dobropis znovu
            </Button>
          )}
        </div>
      )}

      {refund.note && (
        <Text size="xsmall" className="text-ui-fg-subtle whitespace-pre-wrap">
          {refund.note}
        </Text>
      )}
    </li>
  );
};

export const MoneyCard = ({
  money,
  shipping,
  request,
}: {
  money?: ClaimMoney | null;
  /** §13.2 — poštovné: vráceno / k vrácení (jen když server posílá). */
  shipping?: ClaimShipping | null;
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
        {shipping && asNumber(shipping.total) > 0 && (
          <>
            <dt>
              <Text size="small" className="text-ui-fg-subtle">
                Poštovné
              </Text>
            </dt>
            <dd>
              <Text size="small">
                {formatCzk(asNumber(shipping.total))}
                {asNumber(shipping.refunded) > 0
                  ? ` · vráceno ${formatCzk(asNumber(shipping.refunded))}`
                  : " · zatím nevráceno"}
              </Text>
            </dd>
          </>
        )}
      </dl>

      {refunds.length > 0 && (
        <ul className="border-ui-border-base flex flex-col gap-y-2 border-t pt-3">
          {refunds.map((refund, index) => (
            <RefundRow key={refund.id ?? index} refund={refund} requestId={request.id} />
          ))}
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
