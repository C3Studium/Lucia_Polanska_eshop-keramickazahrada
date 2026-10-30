import { Badge, Button, Checkbox, Input, Label, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ceskaChyba } from "../lib/ceska-chyba";
import { formatAmount, formatDateTime } from "../lib/format";
import { sdk } from "../lib/sdk";

/**
 * Cena po domluvě u zakázky — blok „Domluvená cena" (24. 10. 2026, Matěj).
 *
 * Výrobek s cenou po domluvě se objedná za 0 Kč a na osobní odběr (v pokladně
 * není z čeho spočítat dopravu). Zakázka (= jedna POLOŽKA objednávky) pak
 * čeká, až se Lucie se zákazníkem domluví na čtyřech číslech — cena výrobku,
 * záloha v Kč, a jestli se posílá, tak poštovné a balné — a klikne „Poslat
 * e-mail k zaplacení" (`send_agreed_price`). Zákazník dostane e-mail
 * „Zaplatit zálohu / Zaplatit celé". Výroba nezačne, dokud není zaplacená
 * aspoň záloha — backend to hlídá (`assertDepositPaidForAgreedPrice`), tady
 * se to jen ukazuje dopředu (zakázané tlačítko s vysvětlením).
 *
 * Záloha se od 30. 10. 2026 zadává v korunách, ne v procentech: u telefonu
 * se domlouvá částka. Procento si backend dopočítá pro záznam (nese ho
 * zrušení zakázky i Potvrzení zakázky) a hlídá na něm strop 50 % ceny
 * VÝROBKU — poštovné ani balné zálohu nezvyšují.
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
  /** Poštovné a balné domluvené spolu s cenou (0 u osobního odběru). */
  shipping_total?: number | string | null;
  packaging_total?: number | string | null;
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
  const shipping = toNum(commission.shipping_total);
  const packaging = toNum(commission.packaging_total);
  /** Co zákazník dluží celkem: cena výrobku + poštovné + balné. */
  const total = round2(agreed + shipping + packaging);
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
  return {
    agreed,
    shipping,
    packaging,
    total,
    sent,
    deposit,
    paid,
    outstanding,
    fullyPaid,
    depositPaid,
    status,
  };
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

  /*
   * Čtyři čísla, která se se zákazníkem domlouvají (30. 10. 2026): cena
   * výrobku, poštovné (jen když si ho nechá poslat — objednával na osobní
   * odběr, protože v pokladně nebylo z čeho dopravu spočítat), balné k té
   * zásilce a záloha. Záloha se zadává v KORUNÁCH, protože tak se domlouvá
   * („dáte mi tisícovku"), ne v procentech; procento si backend dopočítá
   * pro záznam a hlídá na nich strop 50 % ceny výrobku (Z2).
   */
  const initialDeposit = (() => {
    const stored = toNum(commission.deposit_amount);
    return state.sent && stored > 0 ? String(round2(stored)) : "";
  })();
  const [price, setPrice] = useState(state.sent ? String(state.agreed) : "");
  const [deposit, setDeposit] = useState(initialDeposit);
  const [byPost, setByPost] = useState(state.shipping > 0.005);
  const [shipping, setShipping] = useState(
    state.shipping > 0.005 ? String(round2(state.shipping)) : ""
  );
  const [packaging, setPackaging] = useState(
    state.packaging > 0.005 ? String(round2(state.packaging)) : ""
  );

  const num = (value: string) => Number(value.replace(",", "."));
  /** Prázdné pole = nula, ne chyba: balné nemusí být vždycky. */
  const optional = (value: string): number | null => {
    if (value.trim() === "") return 0;
    const parsed = num(value);
    return Number.isFinite(parsed) && parsed >= 0 ? round2(parsed) : null;
  };

  const parsedPrice = num(price);
  const priceValid = price.trim() !== "" && Number.isFinite(parsedPrice) && parsedPrice > 0;
  const parsedShipping = byPost ? optional(shipping) : 0;
  const parsedPackaging = byPost ? optional(packaging) : 0;
  const extrasValid = parsedShipping !== null && parsedPackaging !== null;

  const parsedDeposit = num(deposit);
  const depositCap = priceValid ? round2(parsedPrice / 2) : 0;
  const depositValid =
    deposit.trim() !== "" &&
    Number.isFinite(parsedDeposit) &&
    parsedDeposit > 0 &&
    parsedDeposit <= depositCap + 0.005;

  const totalPreview =
    priceValid && extrasValid
      ? round2(parsedPrice + (parsedShipping ?? 0) + (parsedPackaging ?? 0))
      : null;
  const unchanged =
    state.sent &&
    priceValid &&
    depositValid &&
    extrasValid &&
    round2(parsedPrice) === round2(state.agreed) &&
    round2(parsedDeposit) === round2(state.deposit) &&
    (parsedShipping ?? 0) === round2(state.shipping) &&
    (parsedPackaging ?? 0) === round2(state.packaging);
  const formValid = priceValid && depositValid && extrasValid;

  const send = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${orderId}/actions`, {
        method: "POST",
        body: {
          action: "send_agreed_price",
          production_order_id: commission.id,
          agreed_total: round2(parsedPrice),
          deposit_amount: round2(parsedDeposit),
          shipping_total: parsedShipping ?? 0,
          packaging_total: parsedPackaging ?? 0,
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
          <Fact label="Cena výrobku" value={formatAmount(state.agreed, currency)} />
          {state.shipping > 0.005 && (
            <Fact label="Poštovné" value={formatAmount(state.shipping, currency)} />
          )}
          {state.packaging > 0.005 && (
            <Fact label="Balné" value={formatAmount(state.packaging, currency)} />
          )}
          {state.total > state.agreed + 0.005 && (
            <Fact label="Celkem" value={formatAmount(state.total, currency)} />
          )}
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
            if (formValid && !unchanged) send.mutate();
          }}
        >
          {!state.sent && (
            <Text size="small" className="text-ui-fg-subtle">
              Zákazník objednal za 0 Kč a na osobní odběr. Až se domluvíte,
              zadejte cenu a zálohu — a jestli mu kus máte poslat, i poštovné
              a balné. E-mailem pak zaplatí zálohu, nebo rovnou celé.
            </Text>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-y-1">
              <Label size="xsmall" htmlFor={`agreed-price-${commission.id}`}>
                Domluvená cena (Kč)
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
                Záloha (Kč)
              </Label>
              <Input
                id={`agreed-deposit-${commission.id}`}
                type="number"
                min={0}
                step="1"
                className="w-28"
                placeholder={depositCap > 0 ? `max ${depositCap}` : "např. 1000"}
                value={deposit}
                onChange={(event) => setDeposit(event.target.value)}
              />
            </div>
          </div>

          {/*
            Poštovné se nabízí jako volba, ne jako prázdné políčko: výchozí
            stav je osobní odběr (tak si zákazník objednal) a teprve
            „Poslat poštou" otevře obě částky.
          */}
          <label className="mt-1 flex items-center gap-x-2">
            <Checkbox
              id={`agreed-by-post-${commission.id}`}
              checked={byPost}
              onCheckedChange={(next) => setByPost(next === true)}
            />
            <Text size="small">Poslat poštou (jinak si pro kus přijde)</Text>
          </label>

          {byPost && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-y-1">
                <Label size="xsmall" htmlFor={`agreed-shipping-${commission.id}`}>
                  Poštovné (Kč)
                </Label>
                <Input
                  id={`agreed-shipping-${commission.id}`}
                  type="number"
                  min={0}
                  step="1"
                  className="w-28"
                  placeholder="např. 150"
                  value={shipping}
                  onChange={(event) => setShipping(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-y-1">
                <Label size="xsmall" htmlFor={`agreed-packaging-${commission.id}`}>
                  Balné (Kč)
                </Label>
                <Input
                  id={`agreed-packaging-${commission.id}`}
                  type="number"
                  min={0}
                  step="1"
                  className="w-28"
                  placeholder="např. 100"
                  value={packaging}
                  onChange={(event) => setPackaging(event.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="small"
              type="submit"
              isLoading={send.isPending}
              disabled={!formValid || unchanged}
            >
              {state.sent ? "Poslat opravený e-mail" : "Poslat e-mail k zaplacení"}
            </Button>
            {totalPreview !== null && depositValid && (
              <Text size="small" className="text-ui-fg-subtle tabular-nums">
                Celkem {formatAmount(totalPreview, currency)} — záloha{" "}
                {formatAmount(round2(parsedDeposit), currency)} teď, zbytek{" "}
                {formatAmount(round2(totalPreview - parsedDeposit), currency)} po
                dokončení.
              </Text>
            )}
          </div>
          {deposit.trim() !== "" && priceValid && !depositValid && (
            <Text size="small" className="text-ui-fg-error">
              Záloha musí být kladná a nejvýš polovina ceny výrobku (
              {formatAmount(depositCap, currency)}).
            </Text>
          )}
          {!extrasValid && (
            <Text size="small" className="text-ui-fg-error">
              Poštovné ani balné nemůže být záporné.
            </Text>
          )}
          {state.sent && (
            <Text size="xsmall" className="text-ui-fg-muted">
              Dokud nezačne výroba, jdou částky opravit — zákazník dostane nový
              e-mail s novými čísly.
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
