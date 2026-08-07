import {
  Button,
  Input,
  Label,
  Popover,
  Text,
  toast,
} from "@medusajs/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../lib/sdk";

/**
 * „Poděkovat" — one-time code for a customer who keeps coming back.
 *
 * The button appears on every row but is only *suggested* on the ones worth
 * suggesting it for: the workbench already knows how many orders someone has
 * placed and what they have spent, so the row can hint without deciding.
 * Choosing who gets thanked stays hers — an automated rule would eventually
 * mail money to somebody who returned everything.
 *
 * The percentage and the window are asked for before sending, because the
 * right thank-you for a second-time buyer and for someone on their tenth order
 * are not the same size, and a fixed number would make her go and edit the
 * promotion afterwards — which is the four-screen detour this replaces.
 */
export const ThankYouButton = ({
  customerId,
  customerName,
  suggested,
}: {
  customerId: string;
  customerName: string;
  /** Worth a nudge — enough orders recently that a thank-you makes sense. */
  suggested?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [percentage, setPercentage] = useState("10");
  const [validDays, setValidDays] = useState("60");
  const [sent, setSent] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ code: string; expires_at: string }>(
        `/admin/workbench/customers/${customerId}/thank-you`,
        {
          method: "POST",
          body: {
            percentage: Number(percentage),
            valid_days: Number(validDays),
          },
        }
      ),
    onSuccess: (result) => {
      setSent(result.code);
      toast.success(`Kód ${result.code} odeslán na e-mail zákazníka.`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Poděkování se nepodařilo odeslat."
      ),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={
            suggested
              ? "text-ui-fg-interactive txt-small font-medium hover:underline"
              : "text-ui-fg-subtle txt-small hover:underline"
          }
        >
          Poděkovat{suggested ? " ★" : ""}
        </button>
      </Popover.Trigger>
      <Popover.Content className="z-50 w-72 p-4">
        <Text size="small" weight="plus">
          Poděkovat — {customerName}
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
          Vytvoří jednorázový kód jen pro tohoto zákazníka a rovnou mu ho pošle
          e-mailem.
        </Text>

        {sent ? (
          <div className="mt-3">
            <Text size="small" weight="plus">
              {sent}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              Odesláno. Kód lze uplatnit jednou.
            </Text>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <Label size="xsmall">Sleva %</Label>
                <Input
                  size="small"
                  type="number"
                  min={1}
                  max={50}
                  value={percentage}
                  onChange={(event) => setPercentage(event.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label size="xsmall">Platí dní</Label>
                <Input
                  size="small"
                  type="number"
                  min={1}
                  max={365}
                  value={validDays}
                  onChange={(event) => setValidDays(event.target.value)}
                />
              </div>
            </div>
            <Button
              size="small"
              className="mt-3 w-full"
              isLoading={send.isPending}
              onClick={() => send.mutate()}
            >
              Vytvořit a odeslat
            </Button>
          </>
        )}
      </Popover.Content>
    </Popover>
  );
};
