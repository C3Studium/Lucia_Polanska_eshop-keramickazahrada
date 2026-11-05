import type { AdminOrder } from "@medusajs/framework/types";
import { Badge, Button, Container, Heading, Skeleton, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  nextStage,
  nextStageLabel,
  stageMeta,
  type MerchantOrder,
  type MerchantOrderStage,
} from "../components/merchant-order-queue";
import { PanelError } from "../components/panel-error";
import { sdk } from "../lib/sdk";
import { ceskaChyba, ceskyText } from "../lib/ceska-chyba";
import { nextStepLabel, stageLabel } from "../lib/stage-words";
import {
  agreedPriceConfirmBlock,
  agreedPriceStartBlock,
  type AgreedPriceCommission,
} from "../components/agreed-price";
import {
  isProductionPhase,
  leastAdvancedStage,
  productionStageMeta,
  productionStep,
  productionStepPlacement,
  type ProductionStage,
  type ProductionStepAction,
} from "../lib/production-stage";

type MerchantOrderDetailResponse = {
  merchant_order: MerchantOrder | null;
};

/** Sdílený dotaz s widgetem „Výroba na zakázku" (stejný klíč = jedna odpověď). */
type ProductionCommission = AgreedPriceCommission & {
  stage: ProductionStage;
  pure_commission?: boolean;
  outstanding_amount?: number | string;
};
type ProductionResponse = {
  production_order?: ProductionCommission | null;
  /** Všechny zakázky objednávky — jedna na zakázkovou položku (§ 0c). */
  production_orders?: ProductionCommission[];
};

const stepSuccess: Record<ProductionStepAction, string> = {
  confirm_specification: "Zadání potvrzeno",
  start_production: "Výroba začala",
  complete_production: "Výroba označena jako dokončená",
};

/**
 * Shows the Denní práce state on the native order page, with the *same* single action the
 * queue offers.
 *
 * This is the answer to the two views disagreeing. Rather than duplicating the native
 * order screen inside Denní práce, the merchant-specific bit is injected into the native
 * screen — so there is one order page, and the next step is visible wherever the merchant
 * arrives from. The button posts to the same endpoint and therefore runs the same
 * workflows, including the full native fulfilment flow for "Odesláno".
 *
 * Od 3. 11. 2026 už to není samostatný widget: vykresluje ho „Práce
 * s objednávkou" (`order-workspace.tsx`), aby stál vždycky nahoře — Medusa 2.18
 * jinak řadí widgety v jednom sloupci podle pořadí souborů na disku.
 */
export const MerchantOrderStatePanel = ({ order }: { order: AdminOrder }) => {
  const cache = useQueryClient();
  const stateQuery = useQuery<MerchantOrderDetailResponse>({
    queryKey: ["merchant-order-state", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}`, { method: "GET" }),
    retry: false,
  });

  const merchantOrder = stateQuery.data?.merchant_order ?? null;

  const productionQuery = useQuery<ProductionResponse>({
    queryKey: ["made-to-order-order", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${order.id}`, { method: "GET" }),
    retry: false,
    enabled: Boolean(merchantOrder?.is_made_to_order),
  });
  const production = productionQuery.data?.production_order ?? null;
  const commissions =
    productionQuery.data?.production_orders ?? (production ? [production] : []);

  /*
   * Čistá zakázka ve výrobě: Denní práce ovládá výrobu (Potvrdit zadání →
   * Začít výrobu → Výroba dokončena). Smíšená objednávka nebo zakázka už
   * hotová a zaplacená jede běžným postupem balení a odeslání.
   */
  const productionMode = Boolean(
    production?.pure_commission &&
      // Některá zakázka se ještě dělá. U víc zakázek nestačí koukat na první:
      // hotová první zakázka nabídla „Připraveno k odeslání" ve chvíli, kdy se
      // druhá teprve vyráběla (3. 11. 2026).
      commissions.some((commission) => isProductionPhase(commission.stage))
  );
  /*
   * Tlačítko tu je jen u JEDINÉ zakázky. Jedno tlačítko nad víc zakázkami by
   * neumělo říct, které se krok týká — a tím ani o které zakázce půjde
   * zákazníkovi e-mail; u víc zakázek ho proto má každá ve své kartě
   * „Výroba na zakázku" (3. 11. 2026, lib/production-stage).
   */
  const stepHere =
    productionStepPlacement({
      pureCommission: Boolean(production?.pure_commission),
      commissionCount: commissions.length,
    }) === "daily-work";

  const step = useMutation({
    mutationFn: (action: ProductionStepAction) =>
      sdk.client.fetch(`/admin/made-to-order/orders/${order.id}/actions`, {
        method: "POST",
        // Krok patří TÉ zakázce (§ 0c); tlačítko je tu jen u jediné.
        body: { action, production_order_id: production?.id },
      }),
    onSuccess: async (_data, action) => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["made-to-order-order", order.id] }),
        cache.invalidateQueries({ queryKey: ["merchant-order-state", order.id] }),
        cache.invalidateQueries({ queryKey: ["merchant-orders"] }),
        cache.invalidateQueries({ queryKey: ["production-orders"] }),
      ]);
      toast.success(stepSuccess[action]);
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Krok výroby se nepodařilo uložit")),
  });

  const transition = useMutation({
    /*
     * `pickup_collected` není fáze, ale sloveso („Vyzvednuto" = zachytit
     * platbu, vyskladnit, dokončit) — route ho bere na témže PATCHi, viz
     * `api/admin/merchant-orders/[orderId]/route.ts`.
     */
    mutationFn: (target: MerchantOrderStage | "pickup_collected") =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}`, {
        method: "PATCH",
        body: { stage: target },
      }),
    onSuccess: async (_data, target) => {
      await cache.invalidateQueries({
        queryKey: ["merchant-order-state", order.id],
      });
      await cache.invalidateQueries({ queryKey: ["merchant-orders"] });
      toast.success(
        target === "pickup_collected"
          ? "Vyzvednutí je zapsané"
          : target === "shipping" && merchantOrder?.is_personal_pickup
            ? "Zákazník dostal e-mail, že si může přijít pro objednávku."
            : "Stav objednávky byl změněn"
      );
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Stav se nepodařilo změnit")
      ),
  });

  /*
   * „Objednávka zaplacena" — hotovost (nebo převod) z pultu zapsaná zvlášť od
   * výdeje zboží; zachycení autorizované platby „zaplatíte při vyzvednutí"
   * rozjede fakturu v iDokladu i e-mail s ní. Stejné tlačítko má fronta
   * Denní práce, aby obě místa uměla totéž.
   */
  const pickupPaid = useMutation<{ captured: boolean; message?: string }>({
    mutationFn: () =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}/pickup-paid`, {
        method: "POST",
      }),
    onSuccess: async (result) => {
      await cache.invalidateQueries({
        queryKey: ["merchant-order-state", order.id],
      });
      await cache.invalidateQueries({ queryKey: ["merchant-orders"] });
      if (result?.captured) {
        toast.success(
          "Platba na místě je zapsaná. Fakturu posíláme zákazníkovi e-mailem."
        );
      } else {
        toast.info(
          ceskyText(result?.message, "Tahle objednávka už je zaplacená.")
        );
      }
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Platbu se nepodařilo zapsat")),
  });

  /*
   * „Peníze přišly (dobírka)" — totéž tlačítko a tentýž endpoint jako ve
   * frontě Denní práce; server ho nabízí (`dobirka_waiting`) jen u dobírky,
   * jejíž balík odjel a peníze ještě nikdo nezapsal.
   */
  const dobirkaPaid = useMutation<{ captured: boolean; message?: string }>({
    mutationFn: () =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}/dobirka-paid`, {
        method: "POST",
      }),
    onSuccess: async (result) => {
      await cache.invalidateQueries({
        queryKey: ["merchant-order-state", order.id],
      });
      await cache.invalidateQueries({ queryKey: ["merchant-orders"] });
      if (result?.captured) {
        toast.success("Peníze z dobírky jsou zapsané. Objednávka je zaplacená.");
      } else {
        toast.info(
          ceskyText(result?.message, "Peníze u této objednávky už jsou zapsané.")
        );
      }
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Peníze se nepodařilo zapsat")),
  });

  /*
   * Problém s platbou: jediný rozumný další krok je poslat zákazníkovi výzvu
   * k zaplacení. Dřív tu stálo „Tato objednávka už po vás nic nechce" a
   * tlačítko bylo schované v Odeslaných e-mailech (3. 11. 2026). Stejný
   * endpoint jako tam.
   */
  const paymentRequest = useMutation<
    { sent: boolean; warning?: string | null },
    Error,
    void
  >({
    mutationFn: () =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}/payment-request`, {
        method: "POST",
      }),
    onSuccess: async (result) => {
      if (result.warning) {
        toast.warning(result.warning);
      } else if (result.sent) {
        toast.success("Výzva k zaplacení odeslána");
      } else {
        toast.error("Výzvu se nepodařilo odeslat");
      }
      await cache.invalidateQueries({ queryKey: ["order-emails"] });
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Výzvu se nepodařilo odeslat")),
  });

  if (stateQuery.isLoading) {
    return (
      <Container>
        <Skeleton className="h-24 rounded-lg" />
      </Container>
    );
  }

  /*
   * „Nenačteno" a „není co zobrazit" nejsou totéž.
   *
   * Objednávka z doby před modulem žádný stav nemá a nekreslit u ní nic je
   * správně — nativní stránka zůstane, jak byla. Nedoručený dotaz ale kartu
   * schovával taky, takže Denní práce — ta nejdůležitější karta na stránce —
   * mizela přesně ve chvíli, kdy se něco děje (5. 11. 2026).
   */
  if (stateQuery.isError) {
    return <PanelError title="Denní práce" onRetry={stateQuery.refetch} />;
  }
  if (!merchantOrder) {
    return null;
  }

  const target = nextStage[merchantOrder.stage];
  /** Osobní odběr mluví jinak: nic se neposílá, zákazník si přijede. */
  const pickup = Boolean(merchantOrder.is_personal_pickup);
  const paymentProblem = merchantOrder.stage === "payment_problem";
  const shipBlocked =
    merchantOrder.stage === "shipping" && Boolean(merchantOrder.ship_block_reason);

  if (productionMode && production) {
    const next = stepHere ? productionStep[production.stage] : undefined;
    // U víc zakázek odznak ukazuje tu nejméně rozpracovanou — Denní práce
    // říká, co ještě čeká, ne co je nejdál hotové.
    const meta =
      productionStageMeta[
        stepHere
          ? production.stage
          : leastAdvancedStage(commissions.map((commission) => commission.stage))
      ];
    // Cena po domluvě: potvrzení až po poslané ceně, výroba až po záloze
    // (cenu Lucie posílá ve „Výrobě na zakázku" u položky).
    const blocked =
      next?.action === "start_production"
        ? agreedPriceStartBlock(production)
        : next?.action === "confirm_specification"
          ? agreedPriceConfirmBlock(production)
          : null;
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between gap-x-2 px-6 py-4">
          <Heading level="h2">Denní práce</Heading>
          <Badge color={meta.color}>{meta.label}</Badge>
        </div>

        <div className="flex flex-col gap-y-3 px-6 py-4">
          {merchantOrder.attention_reason && (
            <Text size="small" className="text-ui-fg-error">
              {merchantOrder.attention_reason}
            </Text>
          )}

          {stepHere ? (
            <Text size="small" className="text-ui-fg-subtle">
              {next
                ? `Zakázka na míru — další krok: ${next.label}`
                : `Zakázka je hotová a čeká na doplatek. Výzvu k doplacení pošlete ve Výrobě na zakázku; po zaplacení tu bude ${
                    pickup ? "Připraveno k vyzvednutí" : "Připraveno k odeslání"
                  }.`}
            </Text>
          ) : (
            <div className="flex flex-col gap-y-1">
              <Text size="small" className="text-ui-fg-subtle">
                Zakázek na míru je {commissions.length}. Další krok má každá ve
                své kartě „Výroba na zakázku“ — e-mail pak zákazníkovi odejde
                jen o té jedné.
              </Text>
              {commissions.map((commission, index) => (
                <Text
                  key={commission.id}
                  size="small"
                  className="text-ui-fg-subtle"
                >
                  {commission.line_title || `Zakázka ${index + 1}`} —{" "}
                  {productionStep[commission.stage]?.label ??
                    productionStageMeta[commission.stage].label}
                </Text>
              ))}
            </div>
          )}

          {next && (
            <Button
              variant="primary"
              size="small"
              isLoading={step.isPending}
              disabled={Boolean(blocked)}
              onClick={() => step.mutate(next.action)}
            >
              {next.label}
            </Button>
          )}
          {next && blocked && (
            <Text size="xsmall" className="text-ui-fg-muted">
              {blocked} Domluvená cena a platby jsou ve „Výrobě na zakázku“.
            </Text>
          )}
        </div>
      </Container>
    );
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-2 px-6 py-4">
        <Heading level="h2">Denní práce</Heading>
        <Badge color={stageMeta[merchantOrder.stage].color}>
          {stageLabel(merchantOrder.stage, pickup)}
        </Badge>
      </div>

      <div className="flex flex-col gap-y-3 px-6 py-4">
        {merchantOrder.attention_reason && (
          <Text size="small" className="text-ui-fg-error">
            {merchantOrder.attention_reason}
          </Text>
        )}

        <Text size="small" className="text-ui-fg-subtle">
          {paymentProblem
            ? "Platba neprošla. Můžete zákazníkovi poslat výzvu k zaplacení — e-mail s odkazem, odkud zaplatí znovu."
            : target
              ? `Další krok: ${nextStepLabel(merchantOrder.stage, pickup)}`
              : "Tato objednávka už po vás nic nechce."}
        </Text>

        {/* Stejné pravidlo jako fronta Denní práce: když server odeslání
            nepustí, tlačítko se neukáže a místo něj je vidět proč. */}
        {shipBlocked && !pickup && (
          <Text size="small" className="text-ui-fg-error">
            {merchantOrder.ship_block_reason}
          </Text>
        )}

        {paymentProblem && (
          <Button
            variant="primary"
            size="small"
            isLoading={paymentRequest.isPending}
            onClick={() => paymentRequest.mutate()}
          >
            Poslat výzvu k zaplacení
          </Button>
        )}

        {merchantOrder.dobirka_waiting && (
          <Button
            variant="primary"
            size="small"
            isLoading={dobirkaPaid.isPending}
            onClick={() => dobirkaPaid.mutate()}
          >
            Peníze přišly (dobírka)
          </Button>
        )}

        {/*
          Osobní odběr se nikam neposílá — místo „Označit jako odeslané" tu
          jsou kroky od pultu: pozvat si zákazníka, zapsat peníze, vydat
          zboží. Stejná trojice jako ve frontě Denní práce.
        */}
        {pickup ? (
          <div className="flex flex-wrap gap-2">
            {["received", "working"].includes(merchantOrder.stage) && (
              <Button
                variant="primary"
                size="small"
                isLoading={transition.isPending}
                onClick={() => transition.mutate("shipping")}
              >
                Připraveno k vyzvednutí
              </Button>
            )}

            {merchantOrder.pickup_payment_due &&
              merchantOrder.stage !== "cancelled" && (
                <Button
                  variant="secondary"
                  size="small"
                  isLoading={pickupPaid.isPending}
                  onClick={() => pickupPaid.mutate()}
                >
                  Objednávka zaplacena
                </Button>
              )}

            {!["shipped", "cancelled"].includes(merchantOrder.stage) && (
              <Button
                variant={
                  merchantOrder.stage === "shipping" ? "primary" : "secondary"
                }
                size="small"
                isLoading={transition.isPending}
                onClick={() => transition.mutate("pickup_collected")}
              >
                {merchantOrder.pickup_payment_due
                  ? "Vyzvednuto a zaplaceno"
                  : "Vyzvednuto"}
              </Button>
            )}
          </div>
        ) : (
          target &&
          !paymentProblem &&
          !shipBlocked && (
            <Button
              variant="primary"
              size="small"
              isLoading={transition.isPending}
              onClick={() => transition.mutate(target)}
            >
              {nextStageLabel[merchantOrder.stage]}
            </Button>
          )
        )}
      </div>
    </Container>
  );
};

