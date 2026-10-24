import { Badge, Button, Input, Label, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ceskaChyba } from "../lib/ceska-chyba";
import { formatAmount, formatDateTime } from "../lib/format";
import { sdk } from "../lib/sdk";

/**
 * Cena po domluvě u zakázky — blok „Domluvená cena" (24. 10. 2026, Matěj).
 *
 * Výrobek s cenou po domluvě se objedná za 0 Kč; zakázka (= jedna POLOŽKA
 * objednávky) pak čeká, až Lucie zadá domluvenou cenu a % zálohy a klikne
 * „Poslat domluvenou cenu" (`send_agreed_price`). Zákazník dostane e-mail
 * „Zaplatit zálohu / Zaplatit celé". Výroba nezačne, dokud není zaplacená
 * aspoň záloha — backend to hlídá (`assertDepositPaidForAgreedPrice`), tady
 * se to jen ukazuje dopředu (zakázané tlačítko s vysvětlením).
 *
 * Sdílí ho widget na detailu objednávky, Denní práce i Přehled → Zakázky,
 * všechny nad jednou odpovědí `GET /admin/made-to-order/orders/:orderId`
 * (klíč `["made-to-order-order", orderId]`).
 *
 * „Odesláno" se pozná podle `agreed_total > 0`, ne podle
 * `agreed_price_sent_at`: to se plní z `final_total_confirmed_at`, které
 * nastaví i „Potvrdit zadání" — bez jakékoli ceny.
 */

/** Zakázka tak, jak ji vrací detail `GET /admin/made-to-order/orders/:orderId`. */
export type AgreedPriceCommission = {
  id: string;
  stage: string;
  currency_code: string;
  agreed_total?: number | string | null;
  deposit_percentage?: number | string | null;
  deposit_amount?: number | string | null;
  paid_amount?: number | string | null;
  outstanding_amount?: number | string | null;
  price_on_request?: boolean;
  agreed_price_sent_at?: string | null;
  line_title?: string | null;
  line_variant_title?: string | null;
  line_thumbnail?: string | null;
};

export type CommissionsOfOrderResponse = {
  production_order?: AgreedPriceCommission | null;
  production_orders?: AgreedPriceCommission[];
};

/** Fáze, kdy jde domluvenou cenu poslat / opravit (= před zahájením výroby). */
export const AGREED_PRICE_EDITABLE_STAGES = ["specification_pending", "confirmed"];

const toNum = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    return Number(v.value ?? v.numeric_ ?? 0) || 0;
  }
  return 0;
};
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Detail zakázek objednávky — stejný klíč jako widget na detailu objednávky. */
export const useCommissionsOfOrder = (orderId: string, enabled = true) =>
  useQuery<CommissionsOfOrderResponse>({
    queryKey: ["made-to-order-order", orderId],
    queryFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${orderId}`, { method: "GET" }),
    retry: false,
    enabled,
  });

export const agreedPriceState = (commission: AgreedPriceCommission) => {
  const agreed = toNum(commission.agreed_total);
  const sent = agreed > 0.005;
  const deposit = toNum(commission.deposit_amount);
  const paid = toNum(commission.paid_amount);
  const outstanding = toNum(commission.outstanding_amount);
  const fullyPaid = sent && outstanding <= 0.005;
  const depositPaid = sent && paid + 0.005 >= deposit;
  const beforeProduction = AGREED_PRICE_EDITABLE_STAGES.includes(commission.stage);
  const status: { label: string; color: "orange" | "green" | "grey" } = !sent
    ? { label: "Cena zatím neodeslaná", color: "grey" }
    : fullyPaid
      ? { label: "Zaplaceno celé", color: "green" }
      : depositPaid
        ? {
            label: beforeProduction
              ? "Záloha zaplacená — můžete začít výrobu"
              : "Záloha zaplacená",
            color: "green",
          }
        : { label: "Čeká na zálohu", color: "orange" };
  return { agreed, sent, deposit, paid, outstanding, fullyPaid, depositPaid, status };
};

/**
 * Proč u zakázky s cenou po domluvě ještě nejde „Začít výrobu" (null = jde).
 * Stejná pravidla jako backend; jeho hláška se při odmítnutí ukáže taky.
 */
export const agreedPriceStartBlock = (
  commission: AgreedPriceCommission | null | undefined
): string | null => {
  if (!commission?.price_on_request) return null;
  const state = agreedPriceState(commission);
  if (!state.sent) return "Nejdřív pošlete zákazníkovi domluvenou cenu.";
  if (!state.depositPaid)
    return `Výroba může začít, až zákazník zaplatí zálohu ${formatAmount(
      state.deposit,
      commission.currency_code
    )}.`;
  return null;
};

/**
 * „Potvrdit zadání" u ceny po domluvě až po poslané ceně — e-mail o potvrzení
 * zakázky ukazuje domluvenou cenu a bez ní by v něm stálo 0 Kč.
 */
export const agreedPriceConfirmBlock = (
  commission: AgreedPriceCommission | null | undefined
): string | null => {
  if (!commission?.price_on_request) return null;
  return agreedPriceState(commission).sent
    ? null
    : "Nejdřív pošlete domluvenou cenu — potvrzení zadání ji zákazníkovi ukáže v e-mailu.";
};

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div>
    <Text size="xsmall" className="text-ui-fg-muted uppercase">
      {label}
    </Text>
    <Text size="small" weight="plus" className="mt-0.5 tabular-nums">
      {value}
    </Text>
  </div>
);

export const AgreedPriceBlock = ({
  orderId,
  commission,
  showItem = true,
  onSent,
}: {
  orderId: string;
  commission: AgreedPriceCommission;
  /** Název položky v záhlaví — objednávka může mít zakázek víc. */
  showItem?: boolean;
  /** Po odeslání (detail objednávky si obnoví nativní části stránky). */
  onSent?: () => void;
}) => {
  const queryClient = useQueryClient();
  const state = agreedPriceState(commission);
  const currency = commission.currency_code || "czk";
  const editable = AGREED_PRICE_EDITABLE_STAGES.includes(commission.stage);

  const initialPercent = (() => {
    const stored = toNum(commission.deposit_percentage);
    return stored > 0 ? Math.min(50, Math.round(stored)) : 25;
  })();
  const [price, setPrice] = useState(state.sent ? String(state.agreed) : "");
  const [percent, setPercent] = useState(String(initialPercent));

  const parsedPrice = Number(price.replace(",", "."));
  const parsedPercent = Number(percent);
  const priceValid = price.trim() !== "" && Number.isFinite(parsedPrice) && parsedPrice > 0;
  const percentValid =
    Number.isInteger(parsedPercent) && parsedPercent >= 1 && parsedPercent <= 50;
  const depositPreview = priceValid && percentValid ? round2((parsedPrice * parsedPercent) / 100) : null;
  const unchanged =
    state.sent &&
    priceValid &&
    round2(parsedPrice) === round2(state.agreed) &&
    parsedPercent === toNum(commission.deposit_percentage);

  const send = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${orderId}/actions`, {
        method: "POST",
        body: {
          action: "send_agreed_price",
          production_order_id: commission.id,
          agreed_total: round2(parsedPrice),
          deposit_percentage: parsedPercent,
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["made-to-order-order", orderId] }),
        queryClient.invalidateQueries({ queryKey: ["production-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["merchant-order-state", orderId] }),
        queryClient.invalidateQueries({ queryKey: ["merchant-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["operations-summary"] }),
      ]);
      toast.success(
        "Domluvená cena odeslaná — zákazník dostal e-mail s odkazem na zaplacení zálohy nebo celé částky."
      );
      onSent?.();
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Domluvenou cenu se nepodařilo poslat.")),
  });

  const itemName = [commission.line_title, commission.line_variant_title]
    .filter((part) => part && part !== "Standardní" && part !== "Default")
    .join(" — ");

  return (
    <div className="bg-ui-bg-subtle shadow-borders-base flex w-full flex-col gap-3 rounded-lg p-4 text-left">
      <div className="flex flex-wrap items-center gap-2">
        {showItem && commission.line_thumbnail && (
          <img
            src={commission.line_thumbnail}
            alt=""
            className="size-8 rounded object-cover"
          />
        )}
        <Text size="small" weight="plus">
          Domluvená cena{showItem && itemName ? ` — ${itemName}` : ""}
        </Text>
        <Badge size="2xsmall" color="purple">
          Cena po domluvě
        </Badge>
        <Badge size="2xsmall" color={state.status.color}>
          {state.status.label}
        </Badge>
      </div>

      {state.sent && (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Fact label="Domluvená cena" value={formatAmount(state.agreed, currency)} />
          <Fact
            label="Záloha"
            value={`${formatAmount(state.deposit, currency)} (${toNum(commission.deposit_percentage)} %)`}
          />
          <Fact label="Zaplaceno" value={formatAmount(state.paid, currency)} />
          {commission.agreed_price_sent_at && (
            <Fact label="Odesláno" value={formatDateTime(commission.agreed_price_sent_at)} />
          )}
        </div>
      )}

      {editable ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (priceValid && percentValid && !unchanged) send.mutate();
          }}
        >
          {!state.sent && (
            <Text size="small" className="text-ui-fg-subtle">
              Zákazník objednal za 0 Kč. Až se domluvíte, zadejte cenu — pošleme
              mu e-mail, kde zaplatí zálohu nebo rovnou celé.
            </Text>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-y-1">
              <Label size="xsmall" htmlFor={`agreed-price-${commission.id}`}>
                Částka (Kč)
              </Label>
              <Input
                id={`agreed-price-${commission.id}`}
                type="number"
                min={0}
                step="1"
                className="w-32"
                placeholder="např. 2500"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-y-1">
              <Label size="xsmall" htmlFor={`agreed-deposit-${commission.id}`}>
                Záloha %
              </Label>
              <Input
                id={`agreed-deposit-${commission.id}`}
                type="number"
                min={1}
                max={50}
                step="1"
                className="w-20"
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
              />
            </div>
            <Button
              size="small"
              type="submit"
              isLoading={send.isPending}
              disabled={!priceValid || !percentValid || unchanged}
            >
              {state.sent ? "Poslat opravenou cenu" : "Poslat domluvenou cenu"}
            </Button>
          </div>
          {depositPreview !== null && (
            <Text size="small" className="text-ui-fg-subtle tabular-nums">
              Záloha {formatAmount(depositPreview, currency)}, zbytek{" "}
              {formatAmount(round2(parsedPrice - depositPreview), currency)} doplatí
              po výrobě.
            </Text>
          )}
          {!percentValid && percent.trim() !== "" && (
            <Text size="small" className="text-ui-fg-error">
              Záloha může být 1 až 50 % (celé číslo).
            </Text>
          )}
          {state.sent && (
            <Text size="xsmall" className="text-ui-fg-muted">
              Dokud nezačne výroba, jde cenu opravit — zákazník dostane nový
              e-mail s novou částkou.
            </Text>
          )}
        </form>
      ) : state.sent ? (
        <Text size="xsmall" className="text-ui-fg-muted">
          Výroba už začala — domluvená cena se nemění. Navýšení řešte příplatkem.
        </Text>
      ) : null}
    </div>
  );
};
