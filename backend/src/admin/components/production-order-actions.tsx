import {
  Button,
  Input,
  Label,
  Prompt,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatAmount } from "../lib/format";
import { sdk } from "../lib/sdk";

/**
 * The one next step for a commission, per stage (§7.2, P6-1).
 *
 * Every action is server-guarded: `requireStage` on the actions route rejects
 * anything out of order, so this only ever offers what the backend would
 * accept. Confirming a price runs a native Order Edit chain, requesting a
 * balance creates a real payment collection — neither is undone by clicking
 * again, which is why the two that move money confirm first.
 */

export type ProductionOrderSummary = {
  id: string;
  order_id: string;
  display_id: number | string | null;
  stage: string;
  currency_code: string;
  agreed_total: number;
  paid_total: number;
  outstanding: number;
  customer_note: string | null;
  /** A balance link already exists, so it can be re-sent rather than re-made. */
  has_open_balance_request?: boolean;
  balance_requested_at?: string | null;
};

type Action =
  | "confirm_specification"
  | "start_production"
  | "complete_production"
  | "request_balance"
  | "remind_balance"
  | "announce_delay"
  | "cancel";

const useAction = (orderId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch(`/admin/made-to-order/orders/${orderId}/actions`, {
        method: "POST",
        body,
      }),
    onSuccess: async () => {
      // A commission move changes the queue, the order's stage and the
      // dashboard counts, so all three are refreshed rather than guessed at.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["production-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["merchant-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["operations-summary"] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Akci se nepodařilo provést"
      );
    },
  });
};

/**
 * „Potvrdit zadání a cenu" — the only action that takes input, because it is
 * the moment the agreed price is set and it rewrites the order total.
 */
const ConfirmSpecification = ({
  order,
}: {
  order: ProductionOrderSummary;
}) => {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(String(order.agreed_total || ""));
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const action = useAction(order.order_id);

  const parsed = Number(price);
  const isValid = Number.isFinite(parsed) && parsed > 0;
  // The deposit is already paid; agreeing a price below it would leave the
  // shop owing money, which is a refund conversation, not a confirmation.
  const belowPaid = isValid && parsed < order.paid_total;

  if (!open) {
    return (
      <Button size="small" variant="primary" onClick={() => setOpen(true)}>
        Potvrdit zadání a cenu
      </Button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-y-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isValid || belowPaid) {
          return;
        }
        action.mutate(
          {
            action: "confirm_specification",
            agreed_total: parsed,
            estimated_completion_at: deadline || undefined,
            internal_note: note || undefined,
          },
          {
            onSuccess: () => {
              toast.success("Zadání a cena potvrzeny");
              setOpen(false);
            },
          }
        );
      }}
    >
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-y-1">
          <Label size="xsmall" htmlFor={`price-${order.id}`}>
            Domluvená celková cena
          </Label>
          <Input
            id={`price-${order.id}`}
            type="number"
            min={0}
            step="0.01"
            className="w-40"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-y-1">
          <Label size="xsmall" htmlFor={`deadline-${order.id}`}>
            Termín dokončení
          </Label>
          <Input
            id={`deadline-${order.id}`}
            type="date"
            className="w-44"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-y-1">
        <Label size="xsmall" htmlFor={`note-${order.id}`}>
          Poznámka pro vás (zákazník ji neuvidí)
        </Label>
        <Textarea
          id={`note-${order.id}`}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {isValid && !belowPaid && (
        <Text size="small" className="text-ui-fg-subtle">
          Zákazník už zaplatil{" "}
          {formatAmount(order.paid_total, order.currency_code)}, doplatí{" "}
          {formatAmount(
            Math.max(0, parsed - order.paid_total),
            order.currency_code
          )}
          .
        </Text>
      )}

      {belowPaid && (
        <Text size="small" className="text-ui-fg-error">
          Cena je nižší než už zaplacená záloha{" "}
          {formatAmount(order.paid_total, order.currency_code)}. Přeplatek je
          potřeba vrátit v detailu objednávky.
        </Text>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          type="submit"
          isLoading={action.isPending}
          disabled={!isValid || belowPaid}
        >
          Potvrdit
        </Button>
        <Button
          size="small"
          variant="secondary"
          type="button"
          onClick={() => setOpen(false)}
        >
          Zpět
        </Button>
      </div>
    </form>
  );
};

/**
 * „Oznámit zpoždění" — posune termín dokončení a pošle zákazníkovi e-mail
 * „Výroba se protáhne". Vědomě formulář, ne jen potvrzení: nový termín je
 * povinný a důvod (pokud ho vyplní) zákazník uvidí doslova.
 */
const AnnounceDelay = ({ order }: { order: ProductionOrderSummary }) => {
  const [open, setOpen] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [reason, setReason] = useState("");
  const action = useAction(order.order_id);

  if (!open) {
    return (
      <Button size="small" variant="secondary" onClick={() => setOpen(true)}>
        Oznámit zpoždění
      </Button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-y-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!deadline) {
          return;
        }
        action.mutate(
          {
            action: "announce_delay",
            estimated_completion_at: deadline,
            delay_reason: reason || undefined,
          },
          {
            onSuccess: () => {
              toast.success("Zákazník dostal e-mail s novým termínem");
              setOpen(false);
              setReason("");
            },
          }
        );
      }}
    >
      <div className="flex flex-col gap-y-1">
        <Label size="xsmall" htmlFor={`delay-date-${order.id}`}>
          Nový termín dokončení
        </Label>
        <Input
          id={`delay-date-${order.id}`}
          type="date"
          className="w-44"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-y-1">
        <Label size="xsmall" htmlFor={`delay-reason-${order.id}`}>
          Důvod (zákazník ho uvidí — nepovinné)
        </Label>
        <Textarea
          id={`delay-reason-${order.id}`}
          rows={2}
          placeholder="Ruční výroba si vyžádala více času"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>

      <Text size="small" className="text-ui-fg-subtle">
        Zákazníkovi odejde e-mail s novým termínem. Stejné datum se podruhé
        neposílá; další posun na jiné datum ano.
      </Text>

      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          type="submit"
          isLoading={action.isPending}
          disabled={!deadline}
        >
          Oznámit
        </Button>
        <Button
          size="small"
          variant="secondary"
          type="button"
          onClick={() => setOpen(false)}
        >
          Zpět
        </Button>
      </div>
    </form>
  );
};

/** Actions that need a confirmation because they move money or are visible. */
const ConfirmedAction = ({
  order,
  action,
  label,
  variant = "primary",
  title,
  description,
  confirmLabel,
  successMessage,
}: {
  order: ProductionOrderSummary;
  action: Action;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
}) => {
  const [open, setOpen] = useState(false);
  const mutation = useAction(order.order_id);

  return (
    <Prompt open={open} onOpenChange={setOpen}>
      <Prompt.Trigger asChild>
        <Button size="small" variant={variant === "danger" ? "danger" : variant}>
          {label}
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>{title}</Prompt.Title>
          <Prompt.Description>{description}</Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel>Zpět</Prompt.Cancel>
          <Prompt.Action
            onClick={() =>
              mutation.mutate(
                { action },
                {
                  onSuccess: () => {
                    toast.success(successMessage);
                    setOpen(false);
                  },
                }
              )
            }
          >
            {confirmLabel}
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

export const ProductionOrderActions = ({
  order,
}: {
  order: ProductionOrderSummary;
}) => {
  const mutation = useAction(order.order_id);

  return (
    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
      {order.stage === "specification_pending" && (
        <ConfirmSpecification order={order} />
      )}

      {order.stage === "confirmed" && (
        <Button
          size="small"
          variant="primary"
          isLoading={mutation.isPending}
          onClick={() =>
            mutation.mutate(
              { action: "start_production" },
              { onSuccess: () => toast.success("Výroba začala") }
            )
          }
        >
          Začít výrobu
        </Button>
      )}

      {order.stage === "in_production" && (
        <ConfirmedAction
          order={order}
          action="complete_production"
          label="Výroba dokončena"
          title="Označit výrobu jako dokončenou?"
          description={
            order.outstanding > 0.01
              ? `Zakázka se přesune mezi čekající na doplatek — zbývá ${formatAmount(
                  order.outstanding,
                  order.currency_code
                )}.`
              : "Zakázka je zaplacená, takže se rovnou přesune mezi připravené k odeslání."
          }
          confirmLabel="Dokončit"
          successMessage="Výroba označena jako dokončená"
        />
      )}

      {/*
        P6-5. Only ever her click: D4 rules out an automatic reminder, and the
        overdue badge plus a daily nudge to *her* are the only prompts. Sends
        the same link again rather than a second demand — the notification
        module recognises the key and does not deliver twice.
      */}
      {order.stage === "awaiting_balance" && order.has_open_balance_request && (
        <ConfirmedAction
          order={order}
          action="remind_balance"
          label="Připomenout doplatek"
          variant="secondary"
          title="Poslat zákazníkovi připomínku?"
          description={`Znovu odešleme stejný odkaz na ${formatAmount(
            order.outstanding,
            order.currency_code
          )}. Nevytváří se nová platba a zákazník nedostane dvě různé výzvy.`}
          confirmLabel="Připomenout"
          successMessage="Připomínka byla odeslána"
        />
      )}

      {order.stage === "awaiting_balance" && (
        <ConfirmedAction
          order={order}
          action="request_balance"
          label={`Požádat o doplatek ${formatAmount(
            order.outstanding,
            order.currency_code
          )}`}
          title="Poslat zákazníkovi žádost o doplatek?"
          description={`Vytvoříme platbu na ${formatAmount(
            order.outstanding,
            order.currency_code
          )} a zákazník dostane odkaz k zaplacení. Opakované kliknutí pošle stejný odkaz, nevytvoří nový.`}
          confirmLabel="Poslat žádost"
          successMessage="Žádost o doplatek byla vytvořena"
        />
      )}

      {["confirmed", "in_production", "awaiting_balance"].includes(
        order.stage
      ) && <AnnounceDelay order={order} />}

      {["specification_pending", "confirmed", "in_production", "awaiting_balance"].includes(
        order.stage
      ) && (
        <ConfirmedAction
          order={order}
          action="cancel"
          label="Zrušit zakázku"
          variant="danger"
          title={`Zrušit zakázku #${order.display_id ?? ""}?`}
          description={
            order.paid_total > 0
              ? `Zakázka se zruší a nezaplacené platby se stornují. Zákazník už zaplatil ${formatAmount(
                  order.paid_total,
                  order.currency_code
                )} — vrácení peněz proveďte v detailu objednávky, samo se nestane.`
              : "Zakázka se zruší a zmizí z fronty."
          }
          confirmLabel="Zrušit zakázku"
          successMessage="Zakázka byla zrušena"
        />
      )}
    </div>
  );
};
