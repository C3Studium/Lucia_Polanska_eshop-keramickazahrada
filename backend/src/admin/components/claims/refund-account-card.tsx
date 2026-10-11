import { Button, Input, Label, Text, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";
import {
  asNumber,
  type ClaimRefundAccount,
  type ReturnRequest,
} from "../../lib/return-requests";
import { formatCzk } from "../../lib/workbench";
import { useReturnAction } from "./use-return-action";

/**
 * Vrácení převodem (11. 10. 2026) — objednávka nebyla placená kartou
 * (dobírka, platba při osobním odběru), takže „Vrátit peníze" peníze samo
 * neodešle: zaznamená vrácení a majitelka pošle převod. Tady vidí, KAM:
 * účet od zákazníka (z formuláře), IBAN, VS = číslo objednávky — vše ke
 * zkopírování do bankovnictví. Když účet chybí (nebo je špatně), doplní ho
 * sem; server ho zkontroluje stejně jako formulář (modulo 11 / IBAN).
 */
export const RefundAccountCard = ({
  request,
  account,
}: {
  request: ReturnRequest;
  account: ClaimRefundAccount;
}) => {
  const [value, setValue] = useState(account.display ?? "");
  const [editing, setEditing] = useState(!account.display);
  const mutation = useReturnAction<{ message?: string }>(request.id, "refund-account");

  useEffect(() => {
    setValue(account.display ?? "");
    setEditing(!account.display);
  }, [account.display]);

  const remaining = asNumber(request.remaining);
  const copy = (text: string, what: string) => {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => toast.success(`${what} zkopírováno.`))
      .catch(() => undefined);
  };

  const Row = ({ label, text, copyAs }: { label: string; text: string; copyAs?: string }) => (
    <div className="flex items-baseline justify-between gap-x-3">
      <Text size="xsmall" className="text-ui-fg-subtle shrink-0">
        {label}
      </Text>
      <span className="flex min-w-0 items-baseline gap-x-2">
        <Text size="small" weight="plus" className="min-w-0 break-all text-right">
          {text}
        </Text>
        <button
          type="button"
          className="text-ui-fg-muted txt-xsmall hover:text-ui-fg-base shrink-0"
          onClick={() => copy(copyAs ?? text, label)}
        >
          kopírovat
        </button>
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-y-3">
      <Text size="small" className="text-ui-fg-subtle">
        Objednávka nebyla placená kartou — peníze se nevrátí samy. Po „Vrátit
        peníze" je pošlete převodem na tento účet.
      </Text>

      {account.display && !editing ? (
        <div className="flex flex-col gap-y-1.5">
          <Row label="Účet" text={account.display} />
          {account.iban && <Row label="IBAN" text={account.iban} copyAs={account.iban.replace(/\s+/g, "")} />}
          <Row label="VS" text={String(request.order_display_id)} />
          <Row
            label="Zpráva"
            text={`Vraceni objednavka ${request.order_display_id}`}
          />
          {remaining > 0 && (
            <Row label="Zbývá vrátit" text={formatCzk(remaining)} copyAs={String(remaining)} />
          )}
          <div>
            <Button size="small" variant="transparent" type="button" onClick={() => setEditing(true)}>
              Změnit účet
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(
              { account: value.trim() },
              {
                onSuccess: (result) => {
                  toast.success(result?.message ?? "Účet uložen.");
                  setEditing(false);
                },
              }
            );
          }}
        >
          {!account.display && (
            <Text size="small" className="text-ui-tag-orange-text">
              Zákazník účet nevyplnil — bez něj peníze nemáte kam poslat.
              Vyžádejte si ho e-mailem a vložte sem.
            </Text>
          )}
          <Label size="xsmall" htmlFor={`refund-account-${request.id}`}>
            Účet pro vrácení (123456789/0800, s předčíslím 19-123456789/0800, nebo IBAN)
          </Label>
          <Input
            id={`refund-account-${request.id}`}
            size="small"
            value={value}
            placeholder="19-2000145399/0800"
            onChange={(event) => setValue(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="small"
              variant="secondary"
              type="submit"
              isLoading={mutation.isPending}
              disabled={!value.trim() || mutation.isPending}
            >
              Uložit účet
            </Button>
            {account.display && (
              <Button
                size="small"
                variant="transparent"
                type="button"
                onClick={() => {
                  setValue(account.display ?? "");
                  setEditing(false);
                }}
              >
                Zpět
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
