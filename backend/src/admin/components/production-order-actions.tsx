import {
  Button,
  Drawer,
  Input,
  Label,
  Prompt,
  Select,
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
  | "settle_balance_offline"
  | "announce_delay"
  | "cancel";

/** Jak zákazník doplatek zaplatil mimo bránu — hodnoty zrcadlí `lib/balance-settlement`. */
type OfflineMethod = "cash" | "card_on_site" | "bank_transfer";

const offlineMethodLabels: Record<OfflineMethod, string> = {
  cash: "Hotově",
  card_on_site: "Kartou v ateliéru",
  bank_transfer: "Převodem na účet",
};

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

/**
 * „Zaplaceno na místě" — doplatek zakázky zaplacený u pultu / převodem, mimo
 * bránu (docs/zaplaceno-na-miste.md).
 *
 * Jedno tlačítko, které platbu ZAPÍŠE (nativně k objednávce i u zakázky) a
 * zároveň pošle zákazníkovi potvrzení s doplatkovou fakturou — přání
 * majitelky po #31, kde se zakázka s osobním odběrem vydala, aniž by šlo
 * hotovost z pultu kamkoli zapsat. Částka je jen ke čtení: zapisuje se vždy
 * celý dluh (částečné platby server odmítne). Sdílené pro panel Zakázky i
 * widget na detailu objednávky, ať obě místa nabízejí totéž.
 */
export const SettleBalanceOffline = ({
  orderId,
  displayId,
  outstanding,
  currencyCode,
  variant = "secondary",
  onSettled,
}: {
  orderId: string;
  displayId?: number | string | null;
  outstanding: number;
  currencyCode: string;
  variant?: "primary" | "secondary";
  /** Po zápisu — widget na detailu si přes to obnoví nativní části stránky. */
  onSettled?: () => void | Promise<unknown>;
}) => {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<OfflineMethod>("cash");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const settle = useMutation<{ settled: boolean; message?: string }>({
    mutationFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${orderId}/actions`, {
        method: "POST",
        body: {
          action: "settle_balance_offline",
          method,
          note: note.trim() || undefined,
        },
      }),
    onSuccess: async (result) => {
      // Mění se fronta zakázek, fronta objednávek, souhrn i widget na detailu.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["production-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["merchant-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["operations-summary"] }),
        queryClient.invalidateQueries({
          queryKey: ["made-to-order-order", orderId],
        }),
      ]);
      if (result?.settled === false) {
        toast.info(result.message ?? "Zakázka je zaplacená — není co zaznamenat.");
      } else {
        toast.success(result?.message ?? "Doplatek zaznamenán.");
      }
      setOpen(false);
      setNote("");
      await onSettled?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Platbu se nepodařilo zaznamenat"
      );
    },
  });

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button size="small" variant={variant}>
          Zaplaceno na místě
        </Button>
      </Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>
            Zaplaceno na místě{displayId ? ` — zakázka #${displayId}` : ""}
          </Drawer.Title>
          <Drawer.Description>
            Zákazník doplatil mimo platební bránu. Zapíšeme platbu k objednávce
            a pošleme mu potvrzení s doplatkovou fakturou.
          </Drawer.Description>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
          <div className="flex flex-col gap-y-1">
            <Label size="small" weight="plus" htmlFor={`settle-amount-${orderId}`}>
              Částka
            </Label>
            <Input
              id={`settle-amount-${orderId}`}
              value={formatAmount(outstanding, currencyCode)}
              readOnly
              disabled
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              Vždy celý zbývající doplatek. Část se zaznamenat nedá — zbytek
              domluvte se zákazníkem zvlášť.
            </Text>
          </div>

          <div className="flex flex-col gap-y-1">
            <Label size="small" weight="plus" htmlFor={`settle-method-${orderId}`}>
              Způsob platby
            </Label>
            <Select
              value={method}
              onValueChange={(value) => setMethod(value as OfflineMethod)}
            >
              <Select.Trigger id={`settle-method-${orderId}`}>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {(Object.keys(offlineMethodLabels) as OfflineMethod[]).map(
                  (key) => (
                    <Select.Item key={key} value={key}>
                      {offlineMethodLabels[key]}
                    </Select.Item>
                  )
                )}
              </Select.Content>
            </Select>
          </div>

          <div className="flex flex-col gap-y-1">
            <Label size="small" weight="plus" htmlFor={`settle-note-${orderId}`}>
              Poznámka (nepovinné, jen pro vás)
            </Label>
            <Textarea
              id={`settle-note-${orderId}`}
              rows={2}
              placeholder="Např. zaplaceno při vyzvednutí 9. 10."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <Text size="small" className="text-ui-fg-subtle">
            Co se stane: objednávka bude zaplacená, zakázka se přesune mezi
            hotové a zaplacené, zákazníkovi odejde e-mail „Doplatek přijat"
            s fakturou. Teprve potom půjde potvrdit „Vyzvednuto a zaplaceno".
          </Text>
        </Drawer.Body>

        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary" type="button">
              Zpět
            </Button>
          </Drawer.Close>
          <Button
            size="small"
            isLoading={settle.isPending}
            onClick={() => settle.mutate()}
          >
            Zaznamenat {formatAmount(outstanding, currencyCode)}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
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

      {/*
        Doplatek zaplacený mimo bránu (u pultu při vyzvednutí, převodem). Vidět
        v KAŽDÉ živé fázi, kde něco zbývá — ne jen „čeká na doplatek": příplatek
        přidaný po dokončení, nebo zakázka už vydaná s nezaplaceným zůstatkem.
      */}
      {order.outstanding > 0.005 && order.stage !== "cancelled" && (
        <SettleBalanceOffline
          orderId={order.order_id}
          displayId={order.display_id}
          outstanding={order.outstanding}
          currencyCode={order.currency_code}
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
              ? `Zákazník už zaplatil ${formatAmount(
                  order.paid_total,
                  order.currency_code
                )}. Zrušení projde až po vyřízení vrácení peněz v „Reklamace a zrušení" — dokud na objednávce zbývá nevrácená částka, server zrušení odmítne. Nezaplacené platby se stornují.`
              : "Zakázka se zruší a zmizí z fronty."
          }
          confirmLabel="Zrušit zakázku"
          successMessage="Zakázka byla zrušena"
        />
      )}
    </div>
  );
};
