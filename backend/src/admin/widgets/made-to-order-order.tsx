import { AdminOrder } from "@medusajs/framework/types";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Skeleton,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SettleBalanceOffline } from "../components/production-order-actions";
import {
  AgreedPriceBlock,
  agreedPriceConfirmBlock,
  agreedPriceStartBlock,
} from "../components/agreed-price";
import { formatAmount } from "../lib/format";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";
import { reloadOrderPageSoon } from "../lib/reload-order-page";
import { PanelError } from "../components/panel-error";
import { maZakazkovouPolozku } from "../lib/order-commission";
import {
  productionStageMeta as stageMeta,
  productionStep as actionForStage,
  productionStepPlacement,
  type ProductionStage,
} from "../lib/production-stage";

type ProductionPayment = {
  id: string;
  type: "deposit" | "balance";
  /** Záloha, i když je uložená jako „balance" — rozhoduje projekce, ne typ. */
  is_deposit?: boolean;
  status: "draft" | "pending" | "sent" | "paid" | "failed" | "expired" | "cancelled";
  amount: number | string;
  currency_code: string;
  payment_url?: string | null;
  sent_at?: string | null;
  paid_at?: string | null;
};

type ProductionOrder = {
  id: string;
  order_id: string;
  stage: ProductionStage;
  deposit_percentage: number;
  agreed_total?: number | string | null;
  surcharge?: number | string | null;
  original_total: number | string;
  final_total?: number | string;
  currency_code: string;
  estimated_completion_at?: string | null;
  payment_requests?: ProductionPayment[];
  paid_amount?: number | string;
  outstanding_amount?: number | string;
  can_fulfill?: boolean;
  /** Jen zakázky, žádné běžné zboží — postup výroby pak ovládá Denní práce. */
  pure_commission?: boolean;
  /** Osobní odběr v ateliéru — jen tady má smysl „Zaplaceno na místě". */
  personal_pickup?: boolean;
  /** Smluvní záloha v penězích (LEGAL_AUDIT § 0, Z2/Z5) — nevratná část po zahájení výroby. */
  deposit_amount?: number | string | null;
  /** Z3: kdy odešel e-mail „Zakázka je ve výrobě"; null = výroba (prokazatelně) nezačala. */
  production_start_notified_at?: string | null;
  production_started_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: "customer" | "seller" | string | null;
  cancellation_phase?: "before_production" | "after_production" | string | null;
  cancellation_refund_amount?: number | string | null;
  /** Z11: PDF „Potvrzení zakázky" — plní subscriber PDF; tady se jen čte. */
  confirmation_pdf_url?: string | null;
  confirmation_sent_at?: string | null;
  /** Cena po domluvě: položka objednaná za 0 Kč, cenu Lucie pošle odsud. */
  price_on_request?: boolean;
  agreed_price_sent_at?: string | null;
  /** Položka zakázky (§ 0c) — objednávka může mít zakázek víc. */
  line_title?: string | null;
  line_variant_title?: string | null;
  line_thumbnail?: string | null;
};

const formatDateTime = (value: string | null | undefined): string =>
  value
    ? new Intl.DateTimeFormat("cs-CZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Prague",
      }).format(new Date(value))
    : "";

type ProductionResponse = {
  production_order?: ProductionOrder | null;
  /** Všechny zakázky objednávky — jedna na zakázkovou položku (§ 0c). */
  production_orders?: ProductionOrder[];
};

type ProductionAction =
  | "confirm_specification"
  | "adjust_surcharge"
  | "notify_surcharge"
  | "start_production"
  | "complete_production"
  | "request_balance"
  | "remind_balance"
  | "cancel";

const toNum = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    return Number(v.value ?? v.numeric_ ?? v.raw_ ?? 0) || 0;
  }
  return 0;
};

/**
 * Záloha u ceny po domluvě se ukládá s typem „balance" (dohled ani vypořádání
 * jiný typ neumí, lib/balance-payment), takže se v „Platbách zakázky"
 * ukazovala zaplacená záloha jako „Doplatek". Rozhoduje příznak z projekce.
 */
const jeZaloha = (payment: ProductionPayment): boolean =>
  payment.is_deposit ?? payment.type === "deposit";

/** Stav platby česky — „pending" majitelce nic neříká. */
const stavPlatby: Record<
  ProductionPayment["status"],
  { label: string; color: "green" | "orange" | "red" | "grey" }
> = {
  draft: { label: "Rozepsaná", color: "grey" },
  pending: { label: "Čeká na zaplacení", color: "orange" },
  sent: { label: "Odeslaná zákazníkovi", color: "orange" },
  paid: { label: "Zaplaceno", color: "green" },
  failed: { label: "Nepodařilo se", color: "red" },
  expired: { label: "Platnost vypršela", color: "red" },
  cancelled: { label: "Zrušená", color: "grey" },
};

/** „Domovní znamení · velké" — jak zakázku v záhlaví karty pojmenovat. */
const itemNameOf = (commission: ProductionOrder): string =>
  [commission.line_title, commission.line_variant_title]
    .filter(Boolean)
    .join(" · ");

/**
 * Karta JEDNÉ zakázky objednávky (§ 0c: zakázka = položka).
 *
 * Od 3. 11. 2026 jich widget vykreslí tolik, kolik má objednávka zakázek.
 * Dřív byla karta jedna a ovládala vždycky tu první, takže u objednávky se
 * dvěma zakázkami nešlo druhou potvrdit, pustit do výroby ani dokončit — a
 * tím ani poslat zákazníkovi e-mail o jejím zahájení a průběhu. Každá karta
 * posílá akce se svým `production_order_id`, takže e-mail je vždycky jen
 * o té jedné zakázce.
 */
const CommissionCard = ({
  order,
  commission,
  index,
  count,
  stepHere,
}: {
  order: AdminOrder;
  commission: ProductionOrder;
  /** Kolikátá zakázka objednávky (od nuly) — do záhlaví karty. */
  index: number;
  count: number;
  /** Další krok výroby ovládá tahle karta (jinak je v Denní práci). */
  stepHere: boolean;
}) => {
  const queryClient = useQueryClient();
  const [editingSurcharge, setEditingSurcharge] = useState(false);
  const [surchargeDraft, setSurchargeDraft] = useState("");
  const [notifyingSurcharge, setNotifyingSurcharge] = useState(false);
  const [surchargeReason, setSurchargeReason] = useState("");

  const runAction = useMutation({
    mutationFn: (payload: {
      action: ProductionAction;
      surcharge?: number;
      reason?: string;
    }) =>
      sdk.client.fetch(`/admin/made-to-order/orders/${order.id}/actions`, {
        method: "POST",
        // Akce patří TÉHLE zakázce — u objednávky s víc zakázkami by ji
        // server bez id odmítl a u jediné by si ji domyslel (§ 0c).
        body: { ...payload, production_order_id: commission.id },
      }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["made-to-order-order", order.id],
      });
      // Denní práce u čisté zakázky ukazuje fázi výroby — ať nezůstane pozadu.
      await queryClient.invalidateQueries({
        queryKey: ["merchant-order-state", order.id],
      });
      setEditingSurcharge(false);
      if (variables.action === "notify_surcharge") {
        setNotifyingSurcharge(false);
        setSurchargeReason("");
      }
      /* U víc zakázek hláška připomene, že e-mail šel jen o téhle jedné. */
      const jenTahle = count > 1 ? " — zákazník ho dostal jen o téhle zakázce" : "";
      const message =
        variables.action === "request_balance"
          ? "Výzva k doplacení odeslána zákazníkovi e-mailem"
          : variables.action === "remind_balance"
            ? "Připomínka doplatku odeslána e-mailem"
            : variables.action === "notify_surcharge"
              ? "Potvrzení příplatku odesláno zákazníkovi e-mailem"
              : variables.action === "confirm_specification"
                ? `Zadání potvrzeno, e-mail odešel${jenTahle}`
                : variables.action === "start_production"
                  ? `Výroba začala, e-mail odešel${jenTahle}`
                  : variables.action === "complete_production"
                    ? `Zakázka je hotová, e-mail odešel${jenTahle}`
                    : "Zakázka byla aktualizována";
      toast.success(message);

      // Výzva k doplacení zakládá NATIVNÍ platební kolekci objednávky
      // (createOrderPaymentCollectionWorkflow). Tenhle widget se obnoví sám,
      // ale nativní části detailu — Aktivita, Souhrn plateb, stav v záhlaví —
      // běží na vlastním query klientu Medusy, který náš invalidate nevidí,
      // takže by zůstaly viset na staré částce. Po zobrazení hlášky proto
      // stránku načteme znovu, ať objednávka sedí celá.
      if (variables.action === "request_balance") {
        reloadOrderPageSoon();
      }
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Akci se nepodařilo dokončit")
      ),
  });

  const payments = useMemo(
    () =>
      Array.isArray(commission.payment_requests) ? commission.payment_requests : [],
    [commission]
  );

  // Další krok výroby (a s ním e-mail) — jen tam, kde se podle pravidla
  // ovládá; u čisté jediné zakázky ho má Denní práce.
  const nextAction = stepHere ? actionForStage[commission.stage] : undefined;
  // Cena po domluvě: potvrzení zadání až po poslané ceně, výroba až po záloze.
  const nextActionBlocked =
    nextAction?.action === "start_production"
      ? agreedPriceStartBlock(commission)
      : nextAction?.action === "confirm_specification"
        ? agreedPriceConfirmBlock(commission)
        : null;
  const priceNotSentYet =
    Boolean(commission.price_on_request) &&
    toNum(commission.agreed_total) <= 0.005;
  const stepInDailyWork = !stepHere && Boolean(actionForStage[commission.stage]);
  const basePrice = toNum(commission.agreed_total ?? commission.original_total);
  const surcharge = toNum(commission.surcharge);
  // Poštovné a balné domluvené u ceny po domluvě — v přehledové větě musí
  // být vidět, jinak „cena 2 500" neodpovídá tomu, co zákazník platí.
  const agreedShipping = toNum((commission as any).shipping_total);
  const agreedPackaging = toNum((commission as any).packaging_total);
  const currency = commission.currency_code;
  const itemName = itemNameOf(commission);

  // Doplatek: tlačítko „Poslat výzvu k doplacení" se ukáže vždy, když něco
  // zbývá doplatit a zakázka ještě běží. Když už výzva běží (pending/sent),
  // nabídne se připomínka + odkaz, který zákazník dostal.
  const outstanding = toNum(commission.outstanding_amount);
  const settled =
    outstanding <= 0.005 &&
    ["ready_to_ship", "completed", "cancelled"].includes(commission.stage);
  const openBalance = payments.find(
    (payment) =>
      payment.type === "balance" &&
      (payment.status === "pending" || payment.status === "sent")
  );
  // Cena po domluvě před výrobou: platební odkazy (záloha / celé) nese e-mail
  // „Domluvená cena" — druhá výzva k doplacení celé částky by zákazníka mátla.
  const canRequestBalance =
    outstanding > 0.005 &&
    !(
      commission.price_on_request &&
      ["specification_pending", "confirmed"].includes(commission.stage)
    ) &&
    !["ready_to_ship", "completed", "cancelled"].includes(commission.stage);

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-x-2">
            <Heading level="h2">Výroba na zakázku</Heading>
            <Badge color={stageMeta[commission.stage].color}>
              {stageMeta[commission.stage].label}
            </Badge>
            {commission.price_on_request && (
              <Badge color="purple">Cena po domluvě</Badge>
            )}
          </div>
          {/* Víc zakázek v jedné objednávce: každá má svou kartu, tak ať je
              na první pohled vidět, o kterou položku jde. */}
          {count > 1 && (
            <div className="mt-1 flex items-center gap-x-2">
              {commission.line_thumbnail && (
                <img
                  src={commission.line_thumbnail}
                  alt=""
                  className="size-8 rounded object-cover"
                />
              )}
              <Text size="small" weight="plus">
                {itemName || `Zakázka ${index + 1}`} (zakázka {index + 1} z{" "}
                {count})
              </Text>
            </div>
          )}
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Smluvní záloha{" "}
            {commission.deposit_amount !== null &&
            commission.deposit_amount !== undefined
              ? `${formatAmount(toNum(commission.deposit_amount), currency)} (${
                  commission.deposit_percentage
                } %)`
              : `${commission.deposit_percentage} %`}{" "}
            · cena{" "}
            {priceNotSentYet
              ? "po domluvě (zatím neodeslaná)"
              : formatAmount(basePrice, currency)}
            {surcharge > 0
              ? ` + příplatek ${formatAmount(surcharge, currency)}`
              : ""}
            {agreedShipping > 0
              ? ` + poštovné ${formatAmount(agreedShipping, currency)}`
              : ""}
            {agreedPackaging > 0
              ? ` + balné ${formatAmount(agreedPackaging, currency)}`
              : ""}
          </Text>
          {/* Z3 (LEGAL_AUDIT § 0): zahájení výroby platí od odeslaného e-mailu.
              „Ve výrobě" bez e-mailu je stav, který podle OP nenastal — červeně. */}
          {commission.production_start_notified_at ? (
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              E-mail o zahájení výroby odeslán:{" "}
              {formatDateTime(commission.production_start_notified_at)}
            </Text>
          ) : commission.stage === "in_production" ? (
            <Text size="xsmall" className="text-ui-fg-error mt-1">
              E-mail o zahájení výroby neodeslán — podle obchodních podmínek výroba
              nezačala (záloha je zatím vratná). Klikněte znovu na „Začít výrobu“.
            </Text>
          ) : null}
          {commission.stage === "cancelled" && commission.cancelled_by ? (
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              Zrušení:{" "}
              {commission.cancelled_by === "customer"
                ? "zrušil zákazník"
                : "zrušila prodávající"}
              {commission.cancellation_phase === "after_production"
                ? ", po zahájení výroby"
                : commission.cancellation_phase === "before_production"
                  ? ", před zahájením výroby"
                  : ""}
              {commission.cancellation_refund_amount !== null &&
              commission.cancellation_refund_amount !== undefined
                ? `, vráceno ${formatAmount(
                    toNum(commission.cancellation_refund_amount),
                    currency
                  )}`
                : ""}
              {commission.cancelled_at
                ? ` (${formatDateTime(commission.cancelled_at)})`
                : ""}
            </Text>
          ) : null}
          {/* Z11: PDF „Potvrzení zakázky" — sloupce plní subscriber PDF. */}
          {commission.confirmation_pdf_url ? (
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              <a
                href={commission.confirmation_pdf_url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Potvrzení zakázky (PDF)
              </a>
              {commission.confirmation_sent_at
                ? ` · odesláno ${formatDateTime(commission.confirmation_sent_at)}`
                : " · zatím neodesláno"}
            </Text>
          ) : (
            <Text size="xsmall" className="text-ui-fg-muted mt-1">
              Potvrzení zakázky (PDF): zatím nevygenerováno.
            </Text>
          )}
          {stepInDailyWork && (
            <Text size="xsmall" className="text-ui-fg-muted mt-1">
              Další krok výroby ({actionForStage[commission.stage]?.label})
              je v Denní práci.
            </Text>
          )}
        </div>

        {/* Příplatek (vpravo nahoře) + další krok. Příplatek je vlastní částka
            navíc nad cenu — navýší doplatek, cenu samotnou nemění. */}
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {/* Zaplacená a hotová zakázka — příplatek je zaplacený, není co
              upravovat ani potvrzovat (14. 10. 2026). */}
          {settled ? null : editingSurcharge ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                autoFocus
                className="w-28"
                placeholder="0"
                value={surchargeDraft}
                onChange={(e) => setSurchargeDraft(e.target.value)}
              />
              <Text size="small" className="text-ui-fg-muted">
                Kč
              </Text>
              <Button
                size="small"
                isLoading={runAction.isPending}
                onClick={() =>
                  runAction.mutate({
                    action: "adjust_surcharge",
                    surcharge: Math.max(0, Number(surchargeDraft) || 0),
                  })
                }
              >
                Uložit
              </Button>
              <Button
                size="small"
                variant="secondary"
                onClick={() => setEditingSurcharge(false)}
              >
                Zrušit
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button
                size="small"
                variant="secondary"
                onClick={() => {
                  setSurchargeDraft(surcharge > 0 ? String(surcharge) : "");
                  setEditingSurcharge(true);
                }}
              >
                {surcharge > 0
                  ? `Příplatek ${formatAmount(surcharge, currency)} · upravit`
                  : "+ Přidat příplatek"}
              </Button>

              {/* Potvrdit příplatek zákazníkovi — ruční e-mail s písemným
                  potvrzením příplatku dohodnutého jinou cestou (telefon/e-mail)
                  a novou částkou k doplacení. Ukáže se, jen když příplatek je. */}
              {surcharge > 0 && !notifyingSurcharge && (
                <Button
                  size="small"
                  variant="transparent"
                  onClick={() => setNotifyingSurcharge(true)}
                >
                  Potvrdit příplatek zákazníkovi
                </Button>
              )}

              {surcharge > 0 && notifyingSurcharge && (
                <div className="flex w-64 max-w-full flex-col gap-2">
                  <Textarea
                    rows={2}
                    autoFocus
                    placeholder="Na čem jste se domluvili (telefon/e-mail) — uvidí zákazník (nepovinné)"
                    value={surchargeReason}
                    onChange={(e) => setSurchargeReason(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="small"
                      isLoading={runAction.isPending}
                      onClick={() =>
                        runAction.mutate({
                          action: "notify_surcharge",
                          reason: surchargeReason.trim() || undefined,
                        })
                      }
                    >
                      Potvrdit a odeslat
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => {
                        setNotifyingSurcharge(false);
                        setSurchargeReason("");
                      }}
                    >
                      Zrušit
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {nextAction && (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button
                variant="primary"
                isLoading={runAction.isPending}
                disabled={Boolean(nextActionBlocked)}
                onClick={() => runAction.mutate({ action: nextAction.action })}
              >
                {nextAction.label}
              </Button>
              {nextActionBlocked ? (
                <Text size="xsmall" className="text-ui-fg-muted max-w-xs sm:text-right">
                  {nextActionBlocked}
                </Text>
              ) : count > 1 ? (
                /* Víc zakázek: ať je jasné, že e-mail popíše jen tuhle jednu. */
                <Text size="xsmall" className="text-ui-fg-muted max-w-xs sm:text-right">
                  E-mail zákazníkovi půjde jen o téhle zakázce
                  {itemName ? ` (${itemName})` : ""}.
                </Text>
              ) : null}
            </div>
          )}

          {/* Doplatek — pošle zákazníkovi e-mail s platebním odkazem. Vidět
              vždy, když něco zbývá doplatit, ne jen ve fázi „čeká na doplatek". */}
          {canRequestBalance && (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button
                variant={nextAction ? "secondary" : "primary"}
                isLoading={runAction.isPending}
                onClick={() =>
                  runAction.mutate({
                    action: openBalance ? "remind_balance" : "request_balance",
                  })
                }
              >
                {openBalance
                  ? "Poslat připomínku doplatku"
                  : "Poslat výzvu k doplacení"}
              </Button>
              {openBalance?.payment_url && (
                <a
                  href={openBalance.payment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ui-fg-muted text-xs underline"
                >
                  Platební odkaz zákazníka
                </a>
              )}
            </div>
          )}

          {/* Doplatek zaplacený mimo bránu — u pultu při vyzvednutí, převodem.
              Vidět vždy, když něco zbývá (i u ready_to_ship/completed s
              příplatkem a u už vydané objednávky), jen ne u zrušené zakázky.
              Po zápisu se mění nativní stav platby, který náš query klient
              nevidí → reload jako u výzvy k doplacení výš. */}
          {/* Jen u osobního odběru — u zásilky zákazník do ateliéru nepřijde
              (14. 10. 2026). */}
          {commission.personal_pickup &&
            outstanding > 0.005 &&
            commission.stage !== "cancelled" && (
            <SettleBalanceOffline
              orderId={order.id}
              productionOrderId={commission.id}
              displayId={order.display_id}
              outstanding={outstanding}
              currencyCode={currency}
              variant={canRequestBalance ? "secondary" : "primary"}
              onSettled={() => reloadOrderPageSoon()}
            />
          )}
        </div>
      </div>

      {/* Cena po domluvě — blok u KAŽDÉ takové zakázky (položky) zvlášť. */}
      {commission.price_on_request && (
        <div className="px-6 py-5">
          <AgreedPriceBlock
            orderId={order.id}
            commission={commission}
            showItem={count > 1}
            // Odeslání srovná nativní „Nesplacenou částku" objednávky, kterou
            // náš query klient nevidí → jako u výzvy k doplacení stránku obnovíme.
            onSent={() => reloadOrderPageSoon(1500)}
          />
        </div>
      )}

      <div className="grid gap-px bg-ui-border-base sm:grid-cols-4">
        <div className="bg-ui-bg-base px-6 py-4">
          <Text size="xsmall" className="text-ui-fg-muted uppercase">
            Zaplaceno
          </Text>
          <Text size="large" weight="plus" className="mt-1">
            {formatAmount(
              commission.paid_amount ??
                payments
                  .filter((payment) => payment.status === "paid")
                  .reduce((sum, payment) => sum + toNum(payment.amount), 0),
              currency
            )}
          </Text>
        </div>
        <div className="bg-ui-bg-base px-6 py-4">
          <Text size="xsmall" className="text-ui-fg-muted uppercase">
            Zbývá doplatit
          </Text>
          <Text size="large" weight="plus" className="mt-1">
            {formatAmount(commission.outstanding_amount, currency)}
          </Text>
        </div>
        <div className="bg-ui-bg-base px-6 py-4">
          <Text size="xsmall" className="text-ui-fg-muted uppercase">
            Příplatek
          </Text>
          <Text size="large" weight="plus" className="mt-1">
            {formatAmount(surcharge, currency)}
          </Text>
        </div>
        <div className="bg-ui-bg-base px-6 py-4">
          <Text size="xsmall" className="text-ui-fg-muted uppercase">
            Odeslání
          </Text>
          <Text size="small" weight="plus" className="mt-1">
            {commission.can_fulfill
              ? "Povoleno – plně zaplaceno"
              : "Uzamčeno do úplného zaplacení"}
          </Text>
        </div>
      </div>

      <div className="px-6 py-5">
        <Text size="xsmall" className="text-ui-fg-muted uppercase">
          Platby zakázky
        </Text>
        <div className="mt-2 flex flex-col gap-y-2">
          {payments.length ? (
            payments.map((payment) => (
              <div
                key={payment.id}
                className="bg-ui-bg-subtle shadow-borders-base flex items-center justify-between gap-3 rounded-lg px-3 py-2"
              >
                <div>
                  <Text size="small" weight="plus">
                    {jeZaloha(payment) ? "Záloha" : "Doplatek"}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {formatAmount(payment.amount, payment.currency_code)}
                  </Text>
                </div>
                <Badge color={stavPlatby[payment.status]?.color ?? "grey"}>
                  {stavPlatby[payment.status]?.label ?? "Čeká na zaplacení"}
                </Badge>
              </div>
            ))
          ) : (
            <Text size="small" className="text-ui-fg-muted">
              Zatím nebyla vytvořena žádná platební žádost.
            </Text>
          )}
        </div>
      </div>
    </Container>
  );
};

/**
 * Karty zakázek objednávky — po jedné na zakázkovou položku. Od 3. 11. 2026
 * je vykresluje „Práce s objednávkou" (`order-workspace-main.tsx`) v hlavním
 * sloupci; obsah karet a jejich akce se tím nemění.
 */
export const MadeToOrderPanel = ({ order }: { order: AdminOrder }) => {
  const productionQuery = useQuery<ProductionResponse>({
    queryKey: ["made-to-order-order", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${order.id}`, {
        method: "GET",
      }),
    retry: false,
  });
  const productionOrder = productionQuery.data?.production_order;
  const commissions = productionQuery.data?.production_orders ??
    (productionOrder ? [productionOrder] : []);

  if (productionQuery.isLoading) {
    return (
      <Container>
        <Skeleton className="h-36 rounded-lg" />
      </Container>
    );
  }

  /*
   * Chyba se hlásí jen tam, kde zakázka opravdu je — razítko na položce to ví
   * i bez odpovědi serveru. U běžné objednávky by se karta „nenačteno" jinak
   * objevila u každé a strašila zbytečně.
   */
  if (productionQuery.isError) {
    return maZakazkovouPolozku(order) ? (
      <PanelError title="Výroba na zakázku" onRetry={productionQuery.refetch} />
    ) : null;
  }
  if (!commissions.length) return null;

  /*
   * Kde se ovládá postup výroby — a tím i odkud odcházejí e-maily o zahájení
   * a průběhu: u jediné zakázky bez dalšího zboží v Denní práci, jinak v
   * kartě každé zakázky (`lib/production-stage`).
   */
  const stepHere =
    productionStepPlacement({
      pureCommission: Boolean(commissions[0]?.pure_commission),
      commissionCount: commissions.length,
    }) === "commission-card";

  return (
    <div className="flex flex-col gap-y-3">
      {commissions.map((commission, index) => (
        <CommissionCard
          key={commission.id}
          order={order}
          commission={commission}
          index={index}
          count={commissions.length}
          stepHere={stepHere}
        />
      ))}
    </div>
  );
};
