import type { AdminOrder } from "@medusajs/framework/types";
import { CheckMini } from "@medusajs/icons";
import { Badge, Button, Container, Heading, Input, Skeleton, Text, Textarea, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  agreedPriceConfirmBlock,
  agreedPriceStartBlock,
  type AgreedPriceCommission,
} from "../components/agreed-price";
import type { MerchantOrder, MerchantOrderStage } from "../components/merchant-order-queue";
import { stageMeta } from "../components/merchant-order-queue";
import { PanelError } from "../components/panel-error";
import { ceskaChyba, ceskyText } from "../lib/ceska-chyba";
import { formatAmount } from "../lib/format";
import { useOdlozenaAkce } from "../lib/odlozena-akce";
import { buildOrderSteps, liveCommissions, type OrderStep, type StepKey } from "../lib/order-steps";
import {
  isProductionPhase,
  leastAdvancedStage,
  productionStageMeta,
  productionStep,
  type ProductionStage,
} from "../lib/production-stage";
import { reloadOrderPageSoon } from "../lib/reload-order-page";
import { sdk } from "../lib/sdk";
import { stageLabel } from "../lib/stage-words";
import { WorkshopSheetButton } from "../components/workshop-sheet-button";

/**
 * „Postup objednávky" — pravý sloupec detailu objednávky, úplně nahoře
 * (17. 11. 2026, přání majitelky).
 *
 * Všechny kroky, které zákazníkovi posílají e-mail, na jednom místě a pod
 * sebou: hotové s fajfkou, aktuální s JEDNÍM tlačítkem, další šedé. Pořadí
 * kroků určuje `lib/order-steps`. Tlačítka volají tytéž endpointy jako
 * fronta Denní práce a každé má 5 s na „Vrátit" (lib/odlozena-akce).
 *
 * Nahradilo kartu „Denní práce" na detailu a tlačítka kroků výroby v kartě
 * zakázky — ta teď v hlavním sloupci jen ukazuje data (zadání, ceny, platby).
 */

type Commission = AgreedPriceCommission & {
  id: string;
  stage: ProductionStage;
  pure_commission?: boolean;
  outstanding_amount?: number | string;
  surcharge?: number | string | null;
  currency_code?: string;
  personal_pickup?: boolean;
  line_title?: string | null;
  line_variant_title?: string | null;
  line_thumbnail?: string | null;
  payment_requests?: Array<{ type: string; status: string; payment_url?: string | null }>;
};

type ProductionResponse = {
  production_order?: Commission | null;
  production_orders?: Commission[];
};

type ProductionAction =
  | "confirm_specification"
  | "start_production"
  | "complete_production"
  | "request_balance"
  | "remind_balance"
  | "adjust_surcharge"
  | "notify_surcharge";

const toNum = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    return Number(v.value ?? v.numeric_ ?? 0) || 0;
  }
  return 0;
};

const nameOf = (commission: Commission, index: number) =>
  [commission.line_title, commission.line_variant_title].filter(Boolean).join(" · ") ||
  `Zakázka ${index + 1}`;

const ACTION_DONE: Record<ProductionAction, string> = {
  confirm_specification: "Zadání potvrzeno, e-mail odešel.",
  start_production: "Výroba začala, e-mail odešel.",
  complete_production: "Zakázka je hotová, e-mail odešel.",
  request_balance: "Výzva k doplacení odešla e-mailem.",
  remind_balance: "Připomínka doplatku odešla e-mailem.",
  adjust_surcharge: "Příplatek je uložený.",
  notify_surcharge: "Potvrzení příplatku odešlo e-mailem.",
};

/** Slova kroku: název, tlačítko a co dostane zákazník. */
const stepWords = (
  key: StepKey,
  pickup: boolean,
  pickupPaymentDue: boolean
): { title: string; action?: string; email?: string } => {
  switch (key) {
    case "received":
      return { title: "Objednávka přijata", email: "Potvrzení objednávky odešlo samo." };
    case "working":
      return {
        title: "Připravujeme",
        action: "Začít připravovat",
        email: "Zákazník dostane e-mail „Připravujeme vaši objednávku“.",
      };
    case "confirm":
      return {
        title: "Zadání potvrzeno",
        action: "Potvrdit zadání",
        email: "Zákazník dostane e-mail „Zadání potvrzeno“.",
      };
    case "production":
      return {
        title: "Ve výrobě",
        action: "Začít výrobu",
        email: "Zákazník dostane e-mail „Zakázka je ve výrobě“.",
      };
    case "complete":
      return {
        title: "Výroba hotová",
        action: "Výroba dokončena",
        email: "Zákazník dostane e-mail „Zakázka je hotová“.",
      };
    case "production_multi":
      return {
        title: "Výroba zakázek",
        email: "Každá zakázka má svůj krok — e-mail půjde jen o té jedné.",
      };
    case "balance":
      return { title: "Doplaceno", email: "Zákazník dostane e-mail s odkazem k doplacení." };
    case "packed":
      return pickup
        ? {
            title: "Připraveno k vyzvednutí",
            action: "Připraveno k vyzvednutí",
            email: "Zákazník dostane e-mail, že si může přijít (s adresou a částkou).",
          }
        : {
            title: "Zabaleno",
            action: "Zabaleno, připraveno k odeslání",
            email: "Zákazník dostane e-mail „Objednávka je zabalená“.",
          };
    case "done":
      return pickup
        ? {
            title: "Vyzvednuto",
            action: pickupPaymentDue ? "Vyzvednuto a zaplaceno" : "Vyzvednuto",
            email: "Zapíše výdej a objednávku dokončí.",
          }
        : {
            title: "Odesláno",
            action: "Označit jako odeslané",
            email:
              "Zákazník dostane e-mail s číslem zásilky. Když balík převezme pošta, zapíše se to i samo.",
          };
  }
};

/** Jeden řádek kroku: kolečko vlevo, čára k dalšímu, text a tlačítko vpravo. */
const StepRow = ({
  step,
  index,
  last,
  title,
  children,
}: {
  step: OrderStep;
  index: number;
  last: boolean;
  title: string;
  children?: ReactNode;
}) => (
  <li className="relative flex gap-x-3 pb-5 last:pb-0">
    {!last && (
      <span
        aria-hidden
        className={`absolute left-[13px] top-7 bottom-0 w-px ${
          step.state === "done" ? "bg-ui-tag-green-icon" : "bg-ui-border-base"
        }`}
      />
    )}
    <span
      aria-hidden
      className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
        step.state === "done"
          ? "bg-ui-tag-green-icon text-ui-fg-on-color"
          : step.state === "current"
            ? "bg-ui-bg-base text-ui-fg-interactive ring-2 ring-ui-fg-interactive"
            : "bg-ui-bg-base text-ui-fg-muted ring-1 ring-ui-border-strong"
      }`}
    >
      {step.state === "done" ? <CheckMini /> : index + 1}
    </span>
    <div className="flex min-w-0 flex-1 flex-col gap-y-2 pt-0.5">
      <Text
        size="base"
        weight={step.state === "current" ? "plus" : "regular"}
        className={step.state === "todo" ? "text-ui-fg-muted" : step.state === "done" ? "text-ui-fg-subtle" : ""}
      >
        <span className="sr-only">
          {step.state === "done" ? "Hotovo: " : step.state === "current" ? "Teď: " : "Později: "}
        </span>
        {title}
      </Text>
      {children}
    </div>
  </li>
);

export const OrderStepsPanel = ({
  order,
  layout = "column",
}: {
  order: AdminOrder;
  /** „row" = vodorovná řada kroků (širší displej), „column" = pod sebou (telefon). */
  layout?: "row" | "column";
}) => {
  const cache = useQueryClient();
  const stateQuery = useQuery<{ merchant_order: MerchantOrder | null }>({
    queryKey: ["merchant-order-state", order.id],
    queryFn: () => sdk.client.fetch(`/admin/merchant-orders/${order.id}`, { method: "GET" }),
    retry: false,
  });
  const merchantOrder = stateQuery.data?.merchant_order ?? null;

  const productionQuery = useQuery<ProductionResponse>({
    queryKey: ["made-to-order-order", order.id],
    queryFn: () => sdk.client.fetch(`/admin/made-to-order/orders/${order.id}`, { method: "GET" }),
    retry: false,
    enabled: Boolean(merchantOrder?.is_made_to_order),
  });
  const first = productionQuery.data?.production_order ?? null;
  const commissions: Commission[] =
    productionQuery.data?.production_orders ?? (first ? [first] : []);

  const refresh = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["merchant-order-state", order.id] }),
      cache.invalidateQueries({ queryKey: ["made-to-order-order", order.id] }),
      cache.invalidateQueries({ queryKey: ["merchant-orders"] }),
      cache.invalidateQueries({ queryKey: ["production-orders"] }),
      cache.invalidateQueries({ queryKey: ["order-emails"] }),
    ]);
  };

  const production = useMutation({
    mutationFn: (payload: {
      action: ProductionAction;
      commissionId: string;
      surcharge?: number;
      reason?: string;
    }) =>
      sdk.client.fetch(`/admin/made-to-order/orders/${order.id}/actions`, {
        method: "POST",
        body: {
          action: payload.action,
          production_order_id: payload.commissionId,
          ...(payload.surcharge !== undefined ? { surcharge: payload.surcharge } : {}),
          ...(payload.reason ? { reason: payload.reason } : {}),
        },
      }),
    onSuccess: async (_data, payload) => {
      await refresh();
      toast.success(ACTION_DONE[payload.action]);
      // Výzva k doplacení zakládá nativní platbu — ostatní karty stránky
      // běží na vlastním klientu Medusy, tak ať sedí i ony.
      if (payload.action === "request_balance") reloadOrderPageSoon();
    },
    onError: (error) => toast.error(ceskaChyba(error, "Krok se nepodařilo uložit")),
  });

  const transition = useMutation({
    mutationFn: (target: MerchantOrderStage | "pickup_collected") =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}`, {
        method: "PATCH",
        body: { stage: target },
      }),
    onSuccess: async (_data, target) => {
      await refresh();
      toast.success(
        target === "pickup_collected"
          ? "Vyzvednutí je zapsané."
          : target === "shipping" && merchantOrder?.is_personal_pickup
            ? "Zákazník dostal e-mail, že si může přijít."
            : "Hotovo, zákazník dostal e-mail."
      );
    },
    onError: (error) => toast.error(ceskaChyba(error, "Krok se nepodařilo uložit")),
  });

  const money = useMutation<{ captured?: boolean; sent?: boolean; warning?: string | null; message?: string }, Error, "pickup-paid" | "dobirka-paid" | "payment-request">({
    mutationFn: (endpoint) =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}/${endpoint}`, { method: "POST" }),
    onSuccess: async (result, endpoint) => {
      await refresh();
      if (endpoint === "payment-request") {
        if (result?.warning) toast.warning(result.warning);
        else if (result?.sent) toast.success("Výzva k zaplacení odeslána.");
        else toast.error("Výzvu se nepodařilo odeslat.");
        return;
      }
      if (result?.captured) {
        toast.success(
          endpoint === "pickup-paid"
            ? "Platba je zapsaná. Fakturu posíláme zákazníkovi e-mailem."
            : "Peníze z dobírky jsou zapsané."
        );
      } else {
        toast.info(ceskyText(result?.message, "Tahle objednávka už je zaplacená."));
      }
    },
    onError: (error) => toast.error(ceskaChyba(error, "Nepodařilo se to uložit")),
  });

  const { odlozit, ceka } = useOdlozenaAkce();
  const [surchargeOpen, setSurchargeOpen] = useState(false);
  const [surchargeDraft, setSurchargeDraft] = useState("");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyReason, setNotifyReason] = useState("");

  if (stateQuery.isLoading) {
    return (
      <Container>
        <Skeleton className="h-40 rounded-lg" />
      </Container>
    );
  }
  if (stateQuery.isError) {
    return <PanelError title="Postup objednávky" onRetry={stateQuery.refetch} />;
  }
  // Objednávka z doby před modulem žádný stav nemá — nic tu nekreslíme.
  if (!merchantOrder) return null;

  const cislo = `#${order.display_id ?? ""}`;
  const busy = ceka || production.isPending || transition.isPending || money.isPending;
  const pickup = Boolean(merchantOrder.is_personal_pickup);
  const stage = merchantOrder.stage;
  const live = liveCommissions(commissions);
  const single = live.length === 1 ? live[0] : null;
  const currency = single?.currency_code ?? merchantOrder.currency_code;

  const steps = buildOrderSteps({
    stage,
    pickup,
    commissions: live.map((commission) => ({
      stage: commission.stage,
      outstanding: toNum(commission.outstanding_amount),
    })),
  });

  const badge =
    stage === "cancelled"
      ? { label: "Zrušeno", color: "grey" as const }
      : live.some((commission) => isProductionPhase(commission.stage))
        ? productionStageMeta[leastAdvancedStage(live.map((commission) => commission.stage))]
        : { label: stageLabel(stage, pickup), color: stageMeta[stage].color };

  const runProduction = (commission: Commission, action: ProductionAction, label: string) =>
    odlozit(`${label} — ${cislo}`, () => production.mutate({ action, commissionId: commission.id }));

  const primary = (label: string, onClick: () => void, disabled = false) => (
    <Button
      size="base"
      variant="primary"
      className="w-full sm:w-auto sm:min-w-[16rem] sm:self-start"
      isLoading={busy && !ceka}
      disabled={disabled || busy}
      onClick={onClick}
    >
      {label}
    </Button>
  );

  const hint = (text: string, tone: "muted" | "error" = "muted") => (
    <Text size="small" className={tone === "error" ? "text-ui-fg-error" : "text-ui-fg-subtle"}>
      {text}
    </Text>
  );

  /** Ovládání aktuálního kroku. */
  const currentControls = (step: OrderStep): ReactNode => {
    const words = stepWords(step.key, pickup, merchantOrder.pickup_payment_due);
    const email = words.email ? hint(words.email) : null;

    if (step.key === "working" || step.key === "packed") {
      const target: MerchantOrderStage = step.key === "working" ? "working" : "shipping";
      return (
        <>
          {email}
          {primary(words.action as string, () =>
            odlozit(`${words.action} — ${cislo}`, () => transition.mutate(target))
          )}
        </>
      );
    }

    if (step.key === "done") {
      const blocked = !pickup && stage === "shipping" ? merchantOrder.ship_block_reason : null;
      return (
        <>
          {email}
          {blocked && hint(blocked, "error")}
          {primary(
            words.action as string,
            () =>
              odlozit(`${words.action} — ${cislo}`, () =>
                transition.mutate(pickup ? "pickup_collected" : "shipped")
              ),
            Boolean(blocked)
          )}
        </>
      );
    }

    if (single && (step.key === "confirm" || step.key === "production" || step.key === "complete")) {
      const next = productionStep[single.stage];
      if (!next) return email;
      const blocked =
        next.action === "start_production"
          ? agreedPriceStartBlock(single)
          : next.action === "confirm_specification"
            ? agreedPriceConfirmBlock(single)
            : null;
      return (
        <>
          {email}
          {blocked && hint(`${blocked} Cenu posíláte v kartě zakázky vlevo.`, "error")}
          {primary(next.label, () => runProduction(single, next.action, next.label), Boolean(blocked))}
        </>
      );
    }

    if (step.key === "production_multi") {
      return (
        <>
          {email}
          <ul className="flex flex-col gap-y-2">
            {live.map((commission, index) => {
              const next = productionStep[commission.stage];
              const blocked =
                next?.action === "start_production"
                  ? agreedPriceStartBlock(commission)
                  : next?.action === "confirm_specification"
                    ? agreedPriceConfirmBlock(commission)
                    : null;
              return (
                <li key={commission.id} className="bg-ui-bg-subtle flex flex-col gap-y-2 rounded-lg p-3">
                  <div className="flex items-center gap-x-2">
                    {commission.line_thumbnail && (
                      <img src={commission.line_thumbnail} alt="" className="size-8 rounded object-cover" />
                    )}
                    <Text size="small" weight="plus" className="min-w-0 flex-1 truncate">
                      {nameOf(commission, index)}
                    </Text>
                    <Badge size="2xsmall" color={productionStageMeta[commission.stage].color}>
                      {productionStageMeta[commission.stage].label}
                    </Badge>
                  </div>
                  {next && blocked && hint(blocked, "error")}
                  {next && (
                    <Button
                      size="small"
                      variant="secondary"
                      disabled={busy || Boolean(blocked)}
                      onClick={() => runProduction(commission, next.action, `${next.label} (${nameOf(commission, index)})`)}
                    >
                      {next.label}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      );
    }

    if (step.key === "balance") {
      if (!single) {
        return hint("Výzvu k doplacení pošlete u každé zakázky vlevo — každá má svou částku.");
      }
      const outstanding = toNum(single.outstanding_amount);
      const open = (single.payment_requests ?? []).find(
        (payment) => payment.type === "balance" && (payment.status === "pending" || payment.status === "sent")
      );
      const canRequest = !["ready_to_ship", "completed"].includes(single.stage);
      return (
        <>
          <Text size="small" className="text-ui-fg-subtle">
            Zbývá doplatit <strong>{formatAmount(outstanding, currency)}</strong>.
            {open ? " Výzva už odešla — můžete poslat připomínku." : ""}
          </Text>
          {canRequest
            ? primary(open ? "Poslat připomínku doplatku" : "Poslat výzvu k doplacení", () =>
                runProduction(
                  single,
                  open ? "remind_balance" : "request_balance",
                  open ? "Připomínka doplatku" : "Výzva k doplacení"
                )
              )
            : null}
          {single.personal_pickup && hint("Zaplatí-li na místě, zapište to v kartě zakázky vlevo.")}
          {open?.payment_url && (
            <a
              href={open.payment_url}
              target="_blank"
              rel="noreferrer"
              className="text-ui-fg-interactive text-sm underline"
            >
              Platební odkaz, který zákazník dostal
            </a>
          )}
        </>
      );
    }
    return email;
  };

  /* Příplatek — jen u jediné zakázky, dokud není vše zaplacené a hotové
     (u víc zakázek ho má každá ve své kartě vlevo). */
  const surcharge = toNum(single?.surcharge);
  const showSurcharge =
    Boolean(single) &&
    stage !== "cancelled" &&
    !(
      toNum(single?.outstanding_amount) <= 0.005 &&
      ["ready_to_ship", "completed"].includes(String(single?.stage))
    );

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-2 px-6 py-4">
        <Heading level="h2">Postup objednávky</Heading>
        <Badge color={badge.color}>{badge.label}</Badge>
      </div>

      {(merchantOrder.attention_reason ||
        stage === "payment_problem" ||
        merchantOrder.dobirka_waiting) && (
        <div className="flex flex-col gap-y-3 px-6 py-4">
          {merchantOrder.attention_reason && hint(merchantOrder.attention_reason, "error")}
          {stage === "payment_problem" && (
            <>
              {hint("Platba neprošla. Pošlete zákazníkovi výzvu — dostane odkaz, odkud zaplatí znovu.", "error")}
              {primary("Poslat výzvu k zaplacení", () =>
                odlozit(`Výzva k zaplacení — ${cislo}`, () => money.mutate("payment-request"))
              )}
            </>
          )}
          {merchantOrder.dobirka_waiting && (
            <>
              {hint("Balík na dobírku odjel. Až přijdou peníze, zapište to.")}
              {primary("Peníze přišly (dobírka)", () =>
                odlozit(`Peníze z dobírky přišly — ${cislo}`, () => money.mutate("dobirka-paid"))
              )}
            </>
          )}
        </div>
      )}

      {layout === "row" ? (
        <>
          {/* Vodorovně 1 → 7 (širší displej, 17. 11. 2026): názvy pod
              kolečky, aktuální krok a jeho tlačítko v kartičce pod řadou. */}
          <ol className="flex items-start px-4 pt-5" aria-label="Kroky objednávky">
            {steps.map((step, index) => {
              const words = stepWords(step.key, pickup, merchantOrder.pickup_payment_due);
              const previousDone = index > 0 && steps[index - 1].state === "done";
              return (
                <li
                  key={step.key}
                  className="relative flex min-w-0 flex-1 flex-col items-center text-center"
                >
                  {index > 0 && (
                    <span
                      aria-hidden
                      className={`absolute right-1/2 top-[13px] h-px w-full ${
                        previousDone && step.state === "done"
                          ? "bg-ui-tag-green-icon"
                          : "bg-ui-border-base"
                      }`}
                    />
                  )}
                  <span
                    aria-hidden
                    className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                      step.state === "done"
                        ? "bg-ui-tag-green-icon text-ui-fg-on-color"
                        : step.state === "current"
                          ? "bg-ui-bg-base text-ui-fg-interactive ring-2 ring-ui-fg-interactive"
                          : "bg-ui-bg-base text-ui-fg-muted ring-1 ring-ui-border-strong"
                    }`}
                  >
                    {step.state === "done" ? <CheckMini /> : index + 1}
                  </span>
                  <Text
                    size="xsmall"
                    weight={step.state === "current" ? "plus" : "regular"}
                    className={`mt-2 px-1 leading-tight ${
                      step.state === "current" ? "text-ui-fg-base" : "text-ui-fg-subtle"
                    }`}
                  >
                    <span className="sr-only">
                      {step.state === "done" ? "Hotovo: " : step.state === "current" ? "Teď: " : "Později: "}
                    </span>
                    {words.title}
                  </Text>
                </li>
              );
            })}
          </ol>
          {(() => {
            const current = steps.find((step) => step.state === "current");
            if (!current) return <div className="pb-5" />;
            return (
              <div className="px-6 pb-5 pt-4">
                <div className="bg-ui-bg-subtle flex flex-col gap-y-2 rounded-lg px-4 py-3">
                  <Text size="small" weight="plus">
                    Teď: {stepWords(current.key, pickup, merchantOrder.pickup_payment_due).title}
                  </Text>
                  {currentControls(current)}
                </div>
              </div>
            );
          })()}
        </>
      ) : (
        <ol className="flex flex-col px-6 py-5" aria-label="Kroky objednávky">
          {steps.map((step, index) => {
            const words = stepWords(step.key, pickup, merchantOrder.pickup_payment_due);
            return (
              <StepRow
                key={step.key}
                step={step}
                index={index}
                last={index === steps.length - 1}
                title={words.title}
              >
                {step.state === "current" ? currentControls(step) : null}
              </StepRow>
            );
          })}
        </ol>
      )}

      {pickup && merchantOrder.pickup_payment_due && stage !== "cancelled" && stage !== "shipped" && (
        <div className="flex flex-col gap-y-2 px-6 py-4">
          {hint("Zaplatil zákazník předem (převodem, hotově)? Zapište platbu zvlášť od výdeje.")}
          <Button
            size="base"
            variant="secondary"
            disabled={busy}
            onClick={() => odlozit(`Objednávka zaplacena — ${cislo}`, () => money.mutate("pickup-paid"))}
          >
            Objednávka zaplacena
          </Button>
        </div>
      )}

      {showSurcharge && single && (
        <div className="flex flex-col gap-y-3 px-6 py-4">
          <div className="flex items-center justify-between gap-x-3">
            <div>
              <Text size="small" weight="plus">
                Příplatek
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {surcharge > 0 ? formatAmount(surcharge, currency) : "Žádný"} · navýší doplatek
              </Text>
            </div>
            {!surchargeOpen && (
              <Button
                size="small"
                variant="secondary"
                onClick={() => {
                  setSurchargeDraft(surcharge > 0 ? String(surcharge) : "");
                  setSurchargeOpen(true);
                }}
              >
                {surcharge > 0 ? "Změnit" : "Přidat příplatek"}
              </Button>
            )}
          </div>

          {surchargeOpen && (
            <div className="flex items-center gap-x-2">
              <Input
                type="number"
                min={0}
                autoFocus
                className="w-28"
                placeholder="0"
                value={surchargeDraft}
                onChange={(event) => setSurchargeDraft(event.target.value)}
              />
              <Text size="small" className="text-ui-fg-muted">
                Kč
              </Text>
              <Button
                size="small"
                disabled={busy}
                onClick={() => {
                  production.mutate(
                    {
                      action: "adjust_surcharge",
                      commissionId: single.id,
                      surcharge: Math.max(0, Number(surchargeDraft) || 0),
                    },
                    { onSuccess: () => setSurchargeOpen(false) }
                  );
                }}
              >
                Uložit
              </Button>
              <Button size="small" variant="transparent" onClick={() => setSurchargeOpen(false)}>
                Zrušit
              </Button>
            </div>
          )}

          {surcharge > 0 && !surchargeOpen && !notifyOpen && (
            <Button size="small" variant="secondary" onClick={() => setNotifyOpen(true)}>
              Poslat zákazníkovi potvrzení příplatku
            </Button>
          )}
          {surcharge > 0 && notifyOpen && (
            <div className="flex flex-col gap-y-2">
              <Textarea
                rows={2}
                autoFocus
                placeholder="Na čem jste se domluvili — zákazník to uvidí v e-mailu (nepovinné)"
                value={notifyReason}
                onChange={(event) => setNotifyReason(event.target.value)}
              />
              <div className="flex gap-x-2">
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    odlozit(`Potvrzení příplatku — ${cislo}`, () =>
                      production.mutate(
                        {
                          action: "notify_surcharge",
                          commissionId: single.id,
                          reason: notifyReason.trim() || undefined,
                        },
                        {
                          onSuccess: () => {
                            setNotifyOpen(false);
                            setNotifyReason("");
                          },
                        }
                      )
                    )
                  }
                >
                  Odeslat
                </Button>
                <Button size="small" variant="transparent" onClick={() => setNotifyOpen(false)}>
                  Zrušit
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* List pro dílnu — totéž PDF, které chodí v e-mailu o nové
          objednávce (17. 11. 2026). */}
      <div className="flex px-6 py-4">
        <WorkshopSheetButton order={order} />
      </div>
    </Container>
  );
};
