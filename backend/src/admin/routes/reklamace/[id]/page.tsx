import {
  Button,
  Checkbox,
  Container,
  Heading,
  Skeleton,
  Text,
  Toaster,
} from "@medusajs/ui";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { MoneyCard } from "../../../components/claims/money-card";
import {
  initialSelection,
  OrderItemsTable,
  refundableQuantity,
  selectionToRefund,
  type ItemSelection,
} from "../../../components/claims/order-items-table";
import {
  ApprovePanel,
  CancelOrderPrompt,
  CancelPanel,
  ReceivedPanel,
  RejectPanel,
  ResolvePanel,
} from "../../../components/claims/panels";
import { PhotoGallery } from "../../../components/claims/photo-lightbox";
import {
  ProductionCard,
  type ProductionPanel,
} from "../../../components/claims/production-card";
import { RefundPanel } from "../../../components/claims/refund-panel";
import { RequestBadges } from "../../../components/claims/request-badges";
import { Timeline } from "../../../components/claims/timeline";
import { LineItemsList } from "../../../components/return-line-items";
import { formatDate, formatDateTime } from "../../../lib/format";
import { adminQueryClient } from "../../../lib/query-client";
import {
  asNumber,
  DAMAGE_CAUSE_HINT,
  deriveActions,
  fallbackSteps,
  isDamageCause,
  isFinalStatus,
  KIND_META,
  RESOLUTION_LABEL,
  type ClaimActions,
  type ClaimDetailItem,
  type ClaimDetailResponse,
  type ClaimFlags,
  type ReturnRequest,
} from "../../../lib/return-requests";
import { sdk } from "../../../lib/sdk";
import { formatCzk } from "../../../lib/workbench";

/**
 * Stránka žádosti — Reklamace a zrušení (docs/reklamace-a-zruseni.md §12).
 *
 * Drawer ukazoval jen žádost; tady majitelka vidí celou objednávku (položky,
 * platby, zakázku) a rozhoduje nad ní: vrátit peníze za vybrané položky nebo
 * za celou objednávku, u zakázky rozhodnout o záloze, u smíšené objednávky
 * obojí zvlášť. Průběh (kroky) skládá server podle případu; tlačítka se kreslí
 * přesně podle `actions` ze serveru — co tu není, server by stejně odmítl.
 *
 * Cesta: `/reklamace/:id` (seznam `/reklamace` sem naviguje; widget na
 * objednávce a Objednávky+ odkazují přes `reklamaceLink`). Žádný záznam v
 * postranním menu.
 *
 * Jediná vědomá výjimka ze „strictly `actions`": přepínač „Zboží neodešlo /
 * vracím bez čekání na zásilku" (§3, §8) u schváleného vrácení/odstoupení —
 * server refundaci před přijetím zboží povolí jen s `skip_goods_check: true`,
 * a to rozhodnutí musí jít udělat odsud.
 */

type Panel =
  | null
  | "approve"
  | "reject"
  | "received"
  | "refund-items"
  | "refund-all"
  | "resolve"
  | "cancel";

const Card = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) => (
  <section className="border-ui-border-base rounded-lg border p-4">
    <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
      {title}
    </Text>
    {hint && (
      <Text size="xsmall" className="text-ui-fg-subtle mt-1">
        {hint}
      </Text>
    )}
    <div className="mt-3">{children}</div>
  </section>
);

/**
 * Kdy se nabízí přepínač „Zboží neodešlo / vracím bez čekání na zásilku":
 * schválené vrácení / odstoupení, zboží odešlo (nebo nevíme) a je co vracet.
 */
const skipGoodsOffered = (request: ReturnRequest, flags: ClaimFlags) =>
  request.status === "approved" &&
  (request.kind === "vraceni" || request.kind === "odstoupeni") &&
  (flags.goods_shipped ?? request.goods_shipped) !== false &&
  asNumber(request.remaining) > 0;

/* ---------------------------------------------------------------- akce ---- */

const ActionsCard = ({
  request,
  actions,
  flags,
  items,
  selection,
  hasProduction,
  panel,
  setPanel,
  skipGoods,
  setSkipGoods,
  onItemsRefunded,
}: {
  request: ReturnRequest;
  actions: ClaimActions;
  flags: ClaimFlags;
  items: ClaimDetailItem[];
  selection: ItemSelection;
  hasProduction: boolean;
  panel: Panel;
  setPanel: (panel: Panel) => void;
  /** Přepínač „vracím bez čekání na zásilku" — drží ho stránka (řídí i tabulku). */
  skipGoods: boolean;
  setSkipGoods: (value: boolean) => void;
  onItemsRefunded: () => void;
}) => {
  const remaining = asNumber(request.remaining);
  const goodsKind = request.kind === "vraceni" || request.kind === "odstoupeni";
  const goodsShipped = flags.goods_shipped ?? request.goods_shipped;

  const skipOffered = skipGoodsOffered(request, flags);
  const skipActive = skipOffered && skipGoods;

  const refundSelection = selectionToRefund(items, selection);
  const selectedAmount = refundSelection.reduce((sum, item) => sum + item.amount, 0);
  const anyRefundableItem = items.some((item) => refundableQuantity(item) > 0);

  const canRefundItems =
    items.length > 0 &&
    anyRefundableItem &&
    remaining > 0 &&
    (actions.refund_items === true || skipActive);
  const canRefundAll = remaining > 0 && (actions.refund_all === true || skipActive);

  const close = () => setPanel(null);

  if (panel === "approve") {
    return <ApprovePanel request={request} allowChain={!hasProduction} onClose={close} />;
  }
  if (panel === "reject") return <RejectPanel request={request} onClose={close} />;
  if (panel === "received") return <ReceivedPanel request={request} onClose={close} />;
  if (panel === "resolve") return <ResolvePanel request={request} onClose={close} />;
  if (panel === "cancel") return <CancelPanel request={request} onClose={close} />;
  if (panel === "refund-items") {
    return (
      <RefundPanel
        request={request}
        scope="items"
        selection={refundSelection}
        skipGoodsCheck={skipActive}
        onClose={() => {
          close();
          onItemsRefunded();
        }}
      />
    );
  }
  if (panel === "refund-all") {
    return (
      <RefundPanel request={request} scope="all" skipGoodsCheck={skipActive} onClose={close} />
    );
  }

  const buttons: ReactNode[] = [];
  if (actions.approve) {
    buttons.push(
      <Button key="approve" size="small" variant="primary" onClick={() => setPanel("approve")}>
        Schválit
      </Button>
    );
  }
  if (actions.reject) {
    buttons.push(
      <Button key="reject" size="small" variant="danger" onClick={() => setPanel("reject")}>
        Zamítnout
      </Button>
    );
  }
  if (actions.received) {
    buttons.push(
      <Button key="received" size="small" variant="primary" onClick={() => setPanel("received")}>
        Zboží přijato
      </Button>
    );
  }
  if (canRefundItems) {
    buttons.push(
      <Button
        key="refund-items"
        size="small"
        variant={actions.received ? "secondary" : "primary"}
        disabled={refundSelection.length === 0}
        onClick={() => setPanel("refund-items")}
        title={
          refundSelection.length === 0
            ? "Nejdřív vyberte položky v tabulce objednávky."
            : undefined
        }
      >
        Vrátit peníze za vybrané položky
        {refundSelection.length > 0
          ? ` (${formatCzk(Math.round(Math.min(selectedAmount, remaining) * 100) / 100)})`
          : ""}
      </Button>
    );
  }
  if (canRefundAll) {
    buttons.push(
      <Button
        key="refund-all"
        size="small"
        variant={canRefundItems || actions.received ? "secondary" : "primary"}
        onClick={() => setPanel("refund-all")}
      >
        Vrátit celou objednávku ({formatCzk(remaining)})
      </Button>
    );
  }
  if (actions.resolve) {
    buttons.push(
      <Button
        key="resolve"
        size="small"
        variant={buttons.length === 0 ? "primary" : "secondary"}
        onClick={() => setPanel("resolve")}
      >
        Vyřízeno
      </Button>
    );
  }
  if (actions.cancel_order) {
    buttons.push(<CancelOrderPrompt key="cancel-order" request={request} />);
  }
  if (actions.cancel_request) {
    buttons.push(
      <Button key="cancel" size="small" variant="transparent" onClick={() => setPanel("cancel")}>
        Stornovat žádost
      </Button>
    );
  }

  const finalText = isFinalStatus(request.status)
    ? request.status === "resolved"
      ? "Žádost je vyřízená. Stav je konečný."
      : request.status === "rejected"
        ? "Žádost byla zamítnuta. Stav je konečný."
        : "Žádost byla stornována. Stav je konečný."
    : null;

  return (
    <div className="flex flex-col gap-y-3">
      {finalText && (
        <Text size="small" className="text-ui-fg-subtle">
          {finalText}
        </Text>
      )}

      {buttons.length > 0 ? (
        <div className="flex flex-wrap gap-2">{buttons}</div>
      ) : (
        !finalText && (
          <Text size="small" className="text-ui-fg-subtle">
            {request.status === "approved" && goodsKind
              ? "Čeká se, až zákazník pošle zboží zpět. Až dorazí, klikněte „Zboží přijato\"."
              : hasProduction
                ? "Rozhodněte o záloze v bloku Zakázka."
                : "Teď tu není žádná akce — stav se změní odjinud (např. po vrácení peněz)."}
          </Text>
        )
      )}

      {skipOffered && (
        <label className="flex items-start gap-x-2">
          <Checkbox
            checked={skipGoods}
            onCheckedChange={(checked) => setSkipGoods(checked === true)}
          />
          <span>
            <Text size="small">Zboží neodešlo / vracím bez čekání na zásilku</Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Běžně se peníze u vrácení a odstoupení vrací až po přijetí zboží
              (§1832/4). Zaškrtněte jen vědomě — např. když zásilka k zákazníkovi
              nikdy neodešla.
            </Text>
          </span>
        </label>
      )}

      {goodsKind && goodsShipped === false && !isFinalStatus(request.status) && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Zboží k zákazníkovi neodešlo — není co vracet.{" "}
          {remaining > 0
            ? "Vraťte peníze a pak objednávku zrušte."
            : "Nebylo zaplaceno nic; objednávku můžete rovnou zrušit a uvolnit sklad."}
        </Text>
      )}

      {request.kind === "reklamace" &&
        (request.resolution === "repair" || request.resolution === "replace") &&
        !isFinalStatus(request.status) && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Způsob vyřízení je {RESOLUTION_LABEL[request.resolution]} — peníze se
            nevrací. Až bude oprava/výměna hotová, klikněte „Vyřízeno".
          </Text>
        )}

      {request.status === "received" && remaining <= 0 && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Na objednávce už nezbývá nic k vrácení — zbývá jen potvrdit vyřízení.
        </Text>
      )}
    </div>
  );
};

/* -------------------------------------------------------------- stránka ---- */

const ClaimPageInner = () => {
  const { id } = useParams<{ id: string }>();

  const detailQuery = useQuery<ClaimDetailResponse>({
    queryKey: ["return-requests", "detail", id],
    queryFn: () =>
      sdk.client.fetch(`/admin/return-requests/${encodeURIComponent(id ?? "")}/detail`),
    enabled: Boolean(id),
    refetchOnWindowFocus: true,
  });

  const detail = detailQuery.data;
  const items = useMemo(() => detail?.items ?? [], [detail]);

  // Žádost s dopočtem z `money` / `flags`, aby panely (Schválit, Vrátit…)
  // dostaly stejné „zbývá" a „zboží odešlo" jako stránka.
  const request = useMemo<ReturnRequest | null>(() => {
    if (!detail) return null;
    const money = detail.money;
    return {
      ...detail.request,
      captured_total: asNumber(money?.captured ?? detail.request.captured_total),
      refunded_total: asNumber(money?.refunded ?? detail.request.refunded_total),
      remaining: asNumber(money?.remaining ?? detail.request.remaining),
      goods_shipped: detail.flags?.goods_shipped ?? detail.request.goods_shipped,
    };
  }, [detail]);

  const [panel, setPanel] = useState<Panel>(null);
  const [productionPanel, setProductionPanel] = useState<ProductionPanel | null>(null);
  const [selection, setSelection] = useState<ItemSelection>({});
  const [skipGoods, setSkipGoods] = useState(false);

  // Nová žádost nebo změna stavu → zavřít rozpracované panely a přepínač.
  useEffect(() => {
    setPanel(null);
    setProductionPanel(null);
    setSkipGoods(false);
  }, [detail?.request.id, detail?.request.status]);

  // Předvýběr položek z žádosti — jednou na žádost; po refundaci se vyčistí.
  useEffect(() => {
    setSelection(initialSelection(detail?.items ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.request.id]);

  const backLink = request ? `/reklamace?status=${request.status}` : "/reklamace";

  if (!id) {
    return (
      <Container className="p-6">
        <Heading level="h2">Chybí číslo žádosti</Heading>
        <Button size="small" variant="secondary" className="mt-4" asChild>
          <Link to="/reklamace">Zpět na Reklamace a zrušení</Link>
        </Button>
      </Container>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <Container className="flex flex-col gap-y-4 p-6">
        <Skeleton className="h-8 w-72 rounded-lg" />
        <Skeleton className="h-5 w-96 rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div className="flex flex-col gap-y-4">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
          <div className="flex flex-col gap-y-4">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        </div>
      </Container>
    );
  }

  if (detailQuery.isError || !detail || !request) {
    return (
      <Container className="flex min-h-64 flex-col items-center justify-center gap-y-3 p-6 text-center">
        <Toaster />
        <Heading level="h2">Žádost se nepodařilo načíst</Heading>
        <Text size="small" className="text-ui-fg-subtle max-w-md">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : "Server neposlal data žádosti."}
        </Text>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="small" variant="secondary" onClick={() => detailQuery.refetch()}>
            Zkusit znovu
          </Button>
          <Button size="small" variant="transparent" asChild>
            <Link to="/reklamace">Zpět na seznam</Link>
          </Button>
        </div>
      </Container>
    );
  }

  const order = detail.order ?? null;
  const flags: ClaimFlags = detail.flags ?? {};
  const production = detail.production ?? null;
  const hasProduction = Boolean(production);
  const actions: ClaimActions =
    detail.actions ??
    deriveActions(request, asNumber(request.remaining), request.goods_shipped, hasProduction);
  const steps = detail.steps && detail.steps.length > 0 ? detail.steps : fallbackSteps(request);
  const displayId = order?.display_id ?? request.order_display_id;
  const customerName = order?.customer_name ?? request.customer_name;
  const email = order?.email ?? request.email;
  const kindLabel = request.kind ? KIND_META[request.kind].label : "Žádost";
  // Výběr položek jen když teď jde vracet po položkách — podle serveru, nebo
  // po vědomém zapnutí „bez čekání na zásilku" (stejná podmínka jako tlačítko).
  const selectable =
    items.length > 0 &&
    !isFinalStatus(request.status) &&
    asNumber(request.remaining) > 0 &&
    (actions.refund_items === true || (skipGoods && skipGoodsOffered(request, flags)));

  const orderHint = [
    order?.created_at ? `objednáno ${formatDate(order.created_at)}` : null,
    order?.shipping_method?.name
      ? `${order.shipping_method.name}${order.shipping_method.is_pickup ? " (osobní odběr)" : ""}`
      : null,
    flags.goods_shipped === true
      ? "zboží odesláno"
      : flags.goods_shipped === false
        ? "zboží neodešlo"
        : null,
    flags.paid_online ? "zaplaceno online" : null,
    flags.nothing_captured ? "nic nezaplaceno" : null,
    flags.pay_later ? "platba později" : null,
    flags.is_mixed ? "smíšená objednávka (běžné zboží + zakázka)" : flags.is_commission ? "zakázka" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Container className="divide-y p-0">
      <Toaster />

      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div className="min-w-0">
          <Link to={backLink} className="text-ui-fg-interactive txt-small hover:underline">
            ← Reklamace a zrušení
          </Link>
          <Heading className="mt-2">
            Objednávka #{displayId} · {kindLabel}
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            {customerName ? `${customerName} · ` : ""}
            {email} · přijato {formatDateTime(request.created_at)}
          </Text>
          <div className="mt-3">
            <RequestBadges request={request} claimCase={detail.case} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="small" variant="secondary" asChild>
            <Link to={`/orders/${order?.id ?? request.order_id}`}>Detail objednávky</Link>
          </Button>
          {request.protocol_url ? (
            <Button size="small" variant="secondary" asChild>
              <a href={request.protocol_url} target="_blank" rel="noreferrer">
                Protokol (PDF)
              </a>
            </Button>
          ) : (
            <Button size="small" variant="secondary" disabled title="Protokol zatím není k dispozici.">
              Protokol
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        {/* ------------------------------------------------------ levý sloupec */}
        <div className="flex flex-col gap-y-6">
          <Card title="Průběh">
            <Timeline steps={steps} />
            {request.resolve_by && !isFinalStatus(request.status) && (
              <Text size="xsmall" className="text-ui-fg-subtle mt-3">
                Zákonná lhůta do {formatDateTime(request.resolve_by)}
                {request.kind === "reklamace" ? " (30 dnů)" : " (14 dnů)"}.
              </Text>
            )}
            {request.withdrawal_deadline && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                Lhůta pro odstoupení (14 dnů od převzetí) do{" "}
                {formatDateTime(request.withdrawal_deadline)}.
              </Text>
            )}
          </Card>

          <Card title="Objednávka" hint={orderHint || undefined}>
            <OrderItemsTable
              items={items}
              order={order}
              selection={selection}
              onChange={setSelection}
              selectable={selectable}
            />
            {items.length === 0 && request.line_items && request.line_items.length > 0 && (
              <div className="mt-3 max-w-xl">
                <LineItemsList items={request.line_items} showTotal />
              </div>
            )}
          </Card>

          <Card title="Žádost">
            <div className="flex flex-col gap-y-4">
              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Důvod
                </Text>
                <Text size="small" className="mt-1 whitespace-pre-wrap">
                  {request.reason}
                </Text>
                {/* Textové `items` jsou záloha pro staré žádosti bez položek. */}
                {request.items && !(request.line_items && request.line_items.length > 0) && (
                  <Text size="xsmall" className="text-ui-fg-subtle mt-2 whitespace-pre-wrap">
                    Objekty: {request.items}
                  </Text>
                )}
              </div>

              {request.kind === "reklamace" && (
                <div>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Co zákazník žádá
                  </Text>
                  <Text size="small" className="mt-1">
                    {request.requested_resolution
                      ? RESOLUTION_LABEL[request.requested_resolution]
                      : "— neuvedeno"}
                    {request.resolution && request.status !== "pending"
                      ? ` · rozhodnuto: ${RESOLUTION_LABEL[request.resolution]}`
                      : ""}
                  </Text>
                </div>
              )}

              {isDamageCause(request.damage_cause) && (
                <Text size="small" className="text-ui-tag-red-text">
                  Poškozeno přepravou — {DAMAGE_CAUSE_HINT[request.damage_cause]}
                </Text>
              )}

              {request.photos && request.photos.length > 0 && (
                <div>
                  <Text size="xsmall" className="text-ui-fg-subtle mb-2">
                    Fotky
                  </Text>
                  <PhotoGallery photos={request.photos} />
                </div>
              )}

              <div>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Vrácená zásilka
                </Text>
                <Text size="small" className={`mt-1 ${request.goods_tracking ? "" : "text-ui-fg-muted"}`}>
                  {request.goods_tracking
                    ? `Číslo zásilky od zákazníka: ${request.goods_tracking}`
                    : "Zákazník zatím nezadal číslo zásilky."}
                </Text>
              </div>

              {(request.decision_note || request.resolution_note) && (
                <div>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Poznámky
                  </Text>
                  {request.decision_note && (
                    <Text size="small" className="mt-1 whitespace-pre-wrap">
                      <span className="text-ui-fg-subtle">K rozhodnutí: </span>
                      {request.decision_note}
                    </Text>
                  )}
                  {request.resolution_note && (
                    <Text size="small" className="mt-1 whitespace-pre-wrap">
                      <span className="text-ui-fg-subtle">K vyřízení: </span>
                      {request.resolution_note}
                    </Text>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ----------------------------------------------------- pravý sloupec */}
        <div className="flex flex-col gap-y-6">
          <Card title="Akce">
            <ActionsCard
              request={request}
              actions={actions}
              flags={flags}
              items={items}
              selection={selection}
              hasProduction={hasProduction}
              panel={panel}
              setPanel={setPanel}
              skipGoods={skipGoods}
              setSkipGoods={setSkipGoods}
              onItemsRefunded={() => setSelection({})}
            />
          </Card>

          <Card title="Platby">
            <MoneyCard money={detail.money} request={request} />
          </Card>

          {production && (
            <Card title="Zakázka">
              <ProductionCard
                production={production}
                request={request}
                actions={actions}
                panel={productionPanel}
                setPanel={setProductionPanel}
              />
            </Card>
          )}
        </div>
      </div>
    </Container>
  );
};

const ClaimPage = () => (
  <QueryClientProvider client={adminQueryClient}>
    <ClaimPageInner />
  </QueryClientProvider>
);

export default ClaimPage;
