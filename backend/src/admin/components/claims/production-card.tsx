import { Badge, Button, Label, Prompt, Text, Textarea, toast } from "@medusajs/ui";
import { useState } from "react";
import {
  asNumber,
  type CancelProductionResponse,
  type ClaimActions,
  type ClaimProduction,
  type ReturnRequest,
} from "../../lib/return-requests";
import { formatCzk, productionStageLabels, stageColors } from "../../lib/workbench";
import { PanelShell } from "./panels";
import { RefundPanel } from "./refund-panel";
import { useReturnAction } from "./use-return-action";

/**
 * Zakázka na stránce žádosti (docs/reklamace-a-zruseni.md §12.4): záloha,
 * doplatek, příplatek, co zbývá doplatit, a tři rozhodnutí majitelky:
 *
 * - „Vrátit zálohu"            → `POST …/refund { scope: "deposit" }` (§1837:
 *                                zákazník nárok nemá, proto výslovné tlačítko);
 * - „Zálohu nevracet a zrušit" → `POST …/cancel-production { keep_deposit: true }`;
 * - „Zrušit zakázku"           → `POST …/cancel-production {}` — až když je
 *                                záloha vrácená (nebo nebyla žádná).
 *
 * Tlačítka se řídí `actions.refund_deposit` / `actions.cancel_production`.
 */

export type ProductionPanel = "refund-deposit" | "cancel-production-keep";

/** `true`, nebo vrácená částka > 0 (starší tvar). */
export const depositIsRefunded = (production: ClaimProduction): boolean => {
  const value = production.deposit_refunded;
  if (typeof value === "number") return value > 0;
  return Boolean(value);
};

/** Záloha, kterou ještě jde vrátit: zaplacená minus (číselně) už vrácená. */
export const refundableDeposit = (production: ClaimProduction): number => {
  const paid = asNumber(production.deposit_paid);
  if (typeof production.deposit_refunded === "number") {
    return Math.max(0, paid - production.deposit_refunded);
  }
  return production.deposit_refunded ? 0 : paid;
};

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <>
    <dt>
      <Text size="small" className="text-ui-fg-subtle">
        {label}
      </Text>
    </dt>
    <dd>
      <Text size="small" weight={strong ? "plus" : "regular"}>
        {value}
      </Text>
    </dd>
  </>
);

/** Zálohu nevracet + zrušit zakázku — důvod (volitelný) jde do poznámky k vyřízení. */
const KeepDepositPanel = ({
  request,
  production,
  onClose,
}: {
  request: ReturnRequest;
  production: ClaimProduction;
  onClose: () => void;
}) => {
  const [note, setNote] = useState("");
  const mutation = useReturnAction<CancelProductionResponse>(request.id, "cancel-production");

  return (
    <PanelShell
      title="Zálohu nevracet a zrušit zakázku"
      onSubmit={() =>
        mutation.mutate(
          { keep_deposit: true, ...(note.trim() ? { note: note.trim() } : {}) },
          {
            onSuccess: (result) => {
              toast.success(result?.message ?? "Zakázka byla zrušena, záloha zůstává.");
              onClose();
            },
          }
        )
      }
    >
      <Text size="small" className="text-ui-fg-subtle">
        Záloha {formatCzk(refundableDeposit(production))} zůstane vám (zboží na
        míru, §1837 d). Zakázka se uzavře, výrobní příkaz skončí; u smíšené
        objednávky se zakázková položka z objednávky odebere a zbytek zůstává.
        Rozhodnutí se zapíše do žádosti.
      </Text>
      <div className="flex flex-col gap-y-1">
        <Label size="xsmall" htmlFor={`keep-deposit-note-${request.id}`}>
          Důvod (volitelné, do poznámky k vyřízení)
        </Label>
        <Textarea
          id={`keep-deposit-note-${request.id}`}
          rows={2}
          placeholder="Např. Výroba už začala, materiál spotřebován."
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="small" variant="danger" type="submit" isLoading={mutation.isPending}>
          Nevracet zálohu a zrušit zakázku
        </Button>
        <Button size="small" variant="secondary" type="button" onClick={onClose}>
          Zpět
        </Button>
      </div>
    </PanelShell>
  );
};

/** Zrušit zakázku — záloha je vrácená (nebo žádná nebyla), nic se už nehýbe. */
const CancelProductionPrompt = ({ request }: { request: ReturnRequest }) => {
  const [open, setOpen] = useState(false);
  const mutation = useReturnAction<CancelProductionResponse>(request.id, "cancel-production");

  return (
    <Prompt open={open} onOpenChange={setOpen}>
      <Prompt.Trigger asChild>
        <Button size="small" variant="danger">
          Zrušit zakázku
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Zrušit zakázku k objednávce #{request.order_display_id}?</Prompt.Title>
          <Prompt.Description>
            Zakázka se uzavře a výrobní příkaz skončí. Když objednávka nemá jiné
            položky, zruší se celá; u smíšené objednávky se odebere jen zakázková
            položka a zbytek zůstává.
          </Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel>Zpět</Prompt.Cancel>
          <Prompt.Action
            onClick={() =>
              mutation.mutate(
                {},
                {
                  onSuccess: (result) => {
                    if (result?.cancelled === false) {
                      toast.warning(
                        result.message ?? "Zakázku se nepodařilo zrušit úplně — zkontrolujte detail."
                      );
                    } else {
                      toast.success(result?.message ?? "Zakázka byla zrušena.");
                    }
                    setOpen(false);
                  },
                }
              )
            }
          >
            Zrušit zakázku
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

export const ProductionCard = ({
  production,
  request,
  actions,
  panel,
  setPanel,
}: {
  production: ClaimProduction;
  /** Žádost s dopočtem `remaining` (z `money`). */
  request: ReturnRequest;
  actions: ClaimActions;
  panel: ProductionPanel | null;
  setPanel: (panel: ProductionPanel | null) => void;
}) => {
  const stage = production.stage ?? "";
  const refunded = depositIsRefunded(production);
  const depositLeft = refundableDeposit(production);
  const depositPaid = asNumber(production.deposit_paid);
  // „Hotovo se zálohou" = vrácená, nebo nikdy žádná nebyla → rovnou zrušit.
  const depositSettled = refunded || depositPaid <= 0 || depositLeft <= 0;
  const remaining = asNumber(request.remaining);

  const canRefundDeposit = actions.refund_deposit === true && depositLeft > 0 && remaining > 0;
  const canCancel = actions.cancel_production === true && stage !== "cancelled";

  if (panel === "refund-deposit") {
    return (
      <RefundPanel
        request={request}
        scope="deposit"
        depositAmount={depositLeft}
        onClose={() => setPanel(null)}
      />
    );
  }
  if (panel === "cancel-production-keep") {
    return (
      <KeepDepositPanel request={request} production={production} onClose={() => setPanel(null)} />
    );
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {stage && (
          <Badge size="2xsmall" color={stageColors[stage] ?? "grey"}>
            {productionStageLabels[stage] ?? stage}
          </Badge>
        )}
        {depositPaid > 0 && (
          <Badge size="2xsmall" color={refunded ? "green" : "orange"}>
            {refunded ? "záloha vrácena" : "záloha zaplacena"}
          </Badge>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {production.agreed_total !== undefined && production.agreed_total !== null && (
          <Row label="Dohodnutá cena" value={formatCzk(asNumber(production.agreed_total))} />
        )}
        {asNumber(production.surcharge) > 0 && (
          <Row label="Příplatek" value={formatCzk(asNumber(production.surcharge))} />
        )}
        <Row label="Záloha zaplacena" value={formatCzk(depositPaid)} />
        {asNumber(production.balance_paid) > 0 && (
          <Row label="Doplatek zaplacen" value={formatCzk(asNumber(production.balance_paid))} />
        )}
        {production.outstanding !== undefined && production.outstanding !== null && (
          <Row label="Zbývá doplatit" value={formatCzk(asNumber(production.outstanding))} />
        )}
        {typeof production.deposit_refunded === "number" && production.deposit_refunded > 0 && (
          <Row label="Záloha vrácena" value={formatCzk(production.deposit_refunded)} strong />
        )}
      </dl>

      {(canRefundDeposit || canCancel) && (
        <div className="flex flex-wrap gap-2">
          {canRefundDeposit && (
            <Button size="small" variant="primary" onClick={() => setPanel("refund-deposit")}>
              Vrátit zálohu ({formatCzk(Math.min(depositLeft, remaining))})
            </Button>
          )}
          {canCancel && !depositSettled && (
            <Button
              size="small"
              variant="secondary"
              onClick={() => setPanel("cancel-production-keep")}
            >
              Zálohu nevracet a zrušit zakázku
            </Button>
          )}
          {canCancel && depositSettled && <CancelProductionPrompt request={request} />}
        </div>
      )}

      <Text size="xsmall" className="text-ui-fg-subtle">
        {stage === "cancelled"
          ? "Zakázka je zrušená."
          : depositSettled
            ? canCancel
              ? "Záloha je vyřízená — zakázku můžete zrušit."
              : "Záloha je vyřízená."
            : "Zákazník na vrácení zálohy u zboží na míru nemá nárok (§1837 d). Rozhodněte: vrátit ji, nebo ponechat a zakázku zrušit."}
      </Text>
    </div>
  );
};
