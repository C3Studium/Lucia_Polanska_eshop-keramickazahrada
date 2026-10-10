import { Button, Label, Text, Textarea, toast } from "@medusajs/ui";
import { useState } from "react";
import {
  asNumber,
  round2,
  type RefundResponse,
  type ReturnRequest,
} from "../../lib/return-requests";
import { formatCzk } from "../../lib/workbench";
import { PanelShell } from "./panels";
import { useReturnAction } from "./use-return-action";

/**
 * Vrátit zálohu zakázky — `POST …/refund { scope: "deposit" }`
 * (docs/reklamace-a-zruseni.md §12.3). Částka je daná (zaplacená záloha
 * snížená o už vrácené), nic se neupravuje: zákazník na vrácení zálohy u
 * zboží na míru nárok nemá (§1837 d), proto je to výslovné tlačítko a
 * rozhodnutí majitelky. O uzavření žádosti rozhoduje server (zpravidla
 * pokračuje zrušením zakázky), přepínač „vyřízeno" se nenabízí.
 *
 * Vrácení po položkách / poštovné / jiná částka / celá objednávka žije v
 * košíku vrácení (`refund-basket.tsx`, §13.2) — tady se už nic nepředvyplňuje.
 */
export const DepositRefundPanel = ({
  request,
  depositAmount,
  onClose,
}: {
  request: ReturnRequest;
  /** Zaplacená záloha snížená o už vrácené. */
  depositAmount: number | null | undefined;
  onClose: () => void;
}) => {
  const remaining = asNumber(request.remaining);
  const amount = round2(Math.min(asNumber(depositAmount), remaining));
  const [note, setNote] = useState("");
  const mutation = useReturnAction<RefundResponse>(request.id, "refund");
  const canSubmit = amount > 0 && !mutation.isPending;

  return (
    <PanelShell
      title="Vrátit zálohu zakázky"
      onSubmit={() => {
        if (!canSubmit) return;
        mutation.mutate(
          {
            scope: "deposit",
            ...(note.trim() ? { note: note.trim() } : {}),
          },
          {
            onSuccess: (result) => {
              toast.success(result?.message ?? "Záloha byla vrácena.");
              onClose();
            },
          }
        );
      }}
    >
      <Text size="small" className="text-ui-fg-subtle">
        Zákazník na vrácení zálohy u zakázky nemá nárok (§1837 d) — je to vaše
        rozhodnutí. Zapíše se k zakázce jako „záloha vrácena"; zakázku pak
        zrušíte tlačítkem v bloku Zakázka.
      </Text>

      <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div className="flex flex-col gap-y-1">
          <Label size="xsmall">Částka (Kč)</Label>
          <Text size="large" weight="plus">
            {formatCzk(amount)}
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Zbývá vrátit {formatCzk(remaining)}.
          </Text>
          {amount <= 0 && (
            <Text size="xsmall" className="text-ui-fg-error">
              Není co vrátit — záloha je vrácená, nebo nebylo zaplaceno nic.
            </Text>
          )}
        </div>
        <div className="flex flex-col gap-y-1">
          <Label size="xsmall" htmlFor={`deposit-note-${request.id}`}>
            Poznámka (volitelné)
          </Label>
          <Textarea
            id={`deposit-note-${request.id}`}
            rows={3}
            placeholder="Např. Výroba nezačala, materiál nebyl objednán."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>

      <Text size="small" className="text-ui-fg-subtle">
        Placeno kartou → vrátí se přes ComGate; jinak se zaznamená k ručnímu
        vrácení (převod / hotovost). Zákazník dostane e-mail o vrácení peněz;
        dobropis se vystaví za tuto refundaci (v ostrém režimu).
      </Text>

      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          variant="primary"
          type="submit"
          isLoading={mutation.isPending}
          disabled={!canSubmit}
        >
          Vrátit {amount > 0 ? formatCzk(amount) : "zálohu"}
        </Button>
        <Button size="small" variant="secondary" type="button" onClick={onClose}>
          Zpět
        </Button>
      </div>
    </PanelShell>
  );
};
