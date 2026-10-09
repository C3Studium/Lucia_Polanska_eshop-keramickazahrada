import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ArrowUturnLeft } from "@medusajs/icons";
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Prompt,
  Select,
  Skeleton,
  Table,
  Text,
  Textarea,
  Toaster,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { DamageBadge, LineItemsList } from "../../components/return-line-items";
import { SubTabs } from "../../components/work-tabs";
import { formatDateTime } from "../../lib/format";
import { adminQueryClient } from "../../lib/query-client";
import {
  asNumber,
  DAMAGE_CAUSE_HINT,
  deadlineInfo,
  formatLineItems,
  isDamageCause,
  isFinalStatus,
  isReturnKind,
  isReturnStatus,
  KIND_META,
  lineItemsQuantity,
  lineItemsTotal,
  RESOLUTION_LABEL,
  STATUS_META,
  type CancelOrderResponse,
  type RefundResponse,
  type ReturnKind,
  type ReturnRequest,
  type ReturnRequestCounts,
  type ReturnRequestListResponse,
  type ReturnResolution,
  type ReturnStatus,
} from "../../lib/return-requests";
import { sdk } from "../../lib/sdk";
import { formatCzk } from "../../lib/workbench";

/**
 * Reklamace a zrušení — jeden modul pro reklamace, vrácení zboží a odstoupení
 * od smlouvy (docs/reklamace-a-zruseni.md, §8).
 *
 * Zásada č. 1: peníze se nikdy nevrací automaticky. Každý případ jde cestou
 * žádost → rozhodnutí → (zboží zpět) → refundace → potvrzení o vyřízení, a
 * tahle stránka nabízí v každém stavu jen ty akce, které server v tom stavu
 * přijme. Co tu není vidět, nejde udělat — ani odjinud (widget na objednávce
 * sem jen odkazuje).
 */

const STATUS_TABS: { key: ReturnStatus; label: string }[] = [
  { key: "pending", label: "Nové" },
  { key: "approved", label: "Schválené – čeká na zboží" },
  { key: "received", label: "Zboží přijato" },
  { key: "resolved", label: "Vyřízené" },
  { key: "rejected", label: "Zamítnuté" },
  { key: "cancelled", label: "Stornované" },
];

const KIND_FILTERS: { value: "all" | ReturnKind; label: string }[] = [
  { value: "all", label: "Vše" },
  { value: "reklamace", label: "Reklamace" },
  { value: "vraceni", label: "Vrácení" },
  { value: "odstoupeni", label: "Odstoupení" },
];

const RESOLUTION_OPTIONS: { value: ReturnResolution; label: string }[] = [
  { value: "repair", label: RESOLUTION_LABEL.repair },
  { value: "replace", label: RESOLUTION_LABEL.replace },
  { value: "discount", label: RESOLUTION_LABEL.discount },
  { value: "refund", label: RESOLUTION_LABEL.refund },
];

const PAGE_SIZE = 25;

/** Zaokrouhlení na haléře, aby „zbývá 0" nebylo 0.00000001. */
const nearlyZero = (value: number) => Math.abs(value) < 0.005;

/* ------------------------------------------------------------ mutace ---- */

/**
 * Jeden hook pro všechny akce nad žádostí. Po úspěchu obnoví seznam, počty
 * v tabech i widget na detailu objednávky; chybu ze serveru ukáže doslova —
 * server vrací srozumitelné hlášky („Vrácení peněz vyřiďte…"), tak ať je vidí.
 */
const useReturnAction = <TResponse = unknown,>(
  requestId: string,
  action: string
) => {
  const queryClient = useQueryClient();
  return useMutation<TResponse, Error, Record<string, unknown>>({
    mutationFn: (body) =>
      sdk.client.fetch<TResponse>(
        `/admin/return-requests/${requestId}/${action}`,
        { method: "POST", body }
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["return-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["return-requests", "counts"] }),
        queryClient.invalidateQueries({ queryKey: ["order-returns"] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Akci se nepodařilo provést"
      );
    },
  });
};

/* ------------------------------------------------------------- panely ---- */

type PanelProps = {
  request: ReturnRequest;
  onClose: () => void;
};

const PanelShell = ({
  title,
  children,
  onSubmit,
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
}) => (
  <form
    className="border-ui-border-base flex w-full flex-col gap-y-3 rounded-lg border p-4"
    onSubmit={(event) => {
      event.preventDefault();
      onSubmit();
    }}
  >
    <Text size="small" weight="plus">
      {title}
    </Text>
    {children}
  </form>
);

/**
 * Schválit — u reklamace rozhoduje majitelka o způsobu vyřízení (§2169–2172);
 * u vrácení/odstoupení je způsob vždy vrácení peněz a server si ho doplní.
 */
const ApprovePanel = ({ request, onClose }: PanelProps) => {
  const isReklamace = request.kind === "reklamace";
  const [resolution, setResolution] = useState<string>(
    isReklamace && request.requested_resolution ? request.requested_resolution : ""
  );
  const [note, setNote] = useState("");
  const mutation = useReturnAction(request.id, "decide");
  const canSubmit = !isReklamace || resolution !== "";

  const explanation = (() => {
    if (!isReklamace) {
      return "Zákazník dostane e-mail se schválením, adresou pro vrácení zboží (z nastavení E-maily obchodu) a lhůtou 14 dnů. Peníze se vrátí až po přijetí zboží.";
    }
    switch (resolution) {
      case "repair":
        return "Zákazník dostane e-mail, že reklamaci uznáváte a zboží opravíte — s adresou, kam ho poslat.";
      case "replace":
        return "Zákazník dostane e-mail, že reklamaci uznáváte a zboží vyměníte — s adresou, kam ho poslat.";
      case "discount":
        return "Zákazník dostane e-mail, že reklamaci uznáváte formou slevy z ceny. Částku vrátíte hned v dalším kroku, zboží si nechá.";
      case "refund":
        return "Zákazník dostane e-mail, že reklamaci uznáváte a vrátíte peníze. Vrátit je můžete hned, nebo až po přijetí zboží.";
      default:
        return "Vyberte, jak reklamaci vyřídíte — podle toho se napíše e-mail zákazníkovi i protokol.";
    }
  })();

  return (
    <PanelShell
      title={`Schválit žádost k objednávce #${request.order_display_id}`}
      onSubmit={() => {
        if (!canSubmit) return;
        mutation.mutate(
          {
            decision: "approve",
            ...(isReklamace ? { resolution } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          },
          {
            onSuccess: () => {
              toast.success(
                "Žádost byla schválena — zákazníkovi odešel e-mail s dalším postupem."
              );
              onClose();
            },
          }
        );
      }}
    >
      {isReklamace && (
        <div className="flex flex-col gap-y-1">
          <Label size="xsmall" htmlFor={`resolution-${request.id}`}>
            Způsob vyřízení (povinné)
          </Label>
          <Select value={resolution} onValueChange={setResolution}>
            <Select.Trigger id={`resolution-${request.id}`} className="max-w-xs">
              <Select.Value placeholder="Vyberte způsob vyřízení…" />
            </Select.Trigger>
            <Select.Content>
              {RESOLUTION_OPTIONS.map((option) => (
                <Select.Item key={option.value} value={option.value}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          {request.requested_resolution && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Zákazník žádá: {RESOLUTION_LABEL[request.requested_resolution]}.
              Můžete rozhodnout jinak — do e-mailu se dostane vaše rozhodnutí.
            </Text>
          )}
        </div>
      )}

      <div className="flex flex-col gap-y-1">
        <Label size="xsmall" htmlFor={`approve-note-${request.id}`}>
          Poznámka pro zákazníka (volitelné)
        </Label>
        <Textarea
          id={`approve-note-${request.id}`}
          rows={2}
          placeholder="Např. Zboží prosím zabalte do původní krabice."
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <Text size="small" className="text-ui-fg-subtle">
        {explanation}
      </Text>

      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          variant="primary"
          type="submit"
          isLoading={mutation.isPending}
          disabled={!canSubmit}
        >
          Schválit a poslat e-mail
        </Button>
        <Button size="small" variant="secondary" type="button" onClick={onClose}>
          Zpět
        </Button>
      </div>
    </PanelShell>
  );
};

/** Zamítnout — odůvodnění je povinné, jde zákazníkovi doslova (§19/3 ZOS). */
const RejectPanel = ({ request, onClose }: PanelProps) => {
  const [note, setNote] = useState("");
  const mutation = useReturnAction(request.id, "decide");
  const trimmed = note.trim();

  return (
    <PanelShell
      title={`Zamítnout žádost k objednávce #${request.order_display_id}`}
      onSubmit={() => {
        if (!trimmed) return;
        mutation.mutate(
          { decision: "reject", note: trimmed },
          {
            onSuccess: () => {
              toast.success(
                "Žádost byla zamítnuta — zákazník dostal e-mail s odůvodněním."
              );
              onClose();
            },
          }
        );
      }}
    >
      <div className="flex flex-col gap-y-1">
        <Label size="xsmall" htmlFor={`reject-note-${request.id}`}>
          Odůvodnění zamítnutí (povinné, zákazník ho uvidí)
        </Label>
        <Textarea
          id={`reject-note-${request.id}`}
          rows={3}
          placeholder="Objekt nese stopy používání, proto vrácení nemůžeme přijmout."
          value={note}
          onChange={(event) => setNote(event.target.value)}
          autoFocus
        />
      </div>
      <Text size="small" className="text-ui-fg-subtle">
        Zamítnutí musí být písemně odůvodněno. Tento text půjde zákazníkovi
        e-mailem i do protokolu, včetně poučení o možnosti obrátit se na ČOI.
      </Text>
      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          variant="danger"
          type="submit"
          isLoading={mutation.isPending}
          disabled={!trimmed}
        >
          Zamítnout a poslat e-mail
        </Button>
        <Button size="small" variant="secondary" type="button" onClick={onClose}>
          Zpět
        </Button>
      </div>
    </PanelShell>
  );
};

/** Zboží přijato — zásilka dorazila zpět (nebo kus přišel k opravě). */
const ReceivedPanel = ({ request, onClose }: PanelProps) => {
  const [note, setNote] = useState("");
  const mutation = useReturnAction(request.id, "received");

  return (
    <PanelShell
      title="Potvrdit přijetí zboží"
      onSubmit={() =>
        mutation.mutate(
          note.trim() ? { note: note.trim() } : {},
          {
            onSuccess: () => {
              toast.success(
                "Zboží je označené jako přijaté — zákazník dostal e-mail, že ho kontrolujete."
              );
              onClose();
            },
          }
        )
      }
    >
      <div className="flex flex-col gap-y-1">
        <Label size="xsmall" htmlFor={`received-note-${request.id}`}>
          Poznámka (volitelné, interní)
        </Label>
        <Textarea
          id={`received-note-${request.id}`}
          rows={2}
          placeholder="Např. Dorazilo 3. 10., krabice poškozená, obsah v pořádku."
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <Text size="small" className="text-ui-fg-subtle">
        Zákazníkovi odejde e-mail „zboží k nám dorazilo, kontrolujeme". Vrácení
        peněz je pak dalším krokem — nestane se samo.
      </Text>
      <div className="flex flex-wrap gap-2">
        <Button size="small" variant="primary" type="submit" isLoading={mutation.isPending}>
          Zboží přijato
        </Button>
        <Button size="small" variant="secondary" type="button" onClick={onClose}>
          Zpět
        </Button>
      </div>
    </PanelShell>
  );
};

/** Vyřízeno — oprava/výměna hotová, nebo se nic nevrací. Posílá potvrzení. */
const ResolvePanel = ({ request, onClose }: PanelProps) => {
  const [note, setNote] = useState("");
  const mutation = useReturnAction(request.id, "resolve");
  const remaining = asNumber(request.remaining);
  const expectsMoney =
    request.resolution === "refund" || request.resolution === "discount";

  return (
    <PanelShell
      title="Označit jako vyřízené"
      onSubmit={() =>
        mutation.mutate(
          note.trim() ? { note: note.trim() } : {},
          {
            onSuccess: () => {
              toast.success(
                "Žádost je vyřízená — zákazník dostal potvrzení o vyřízení."
              );
              onClose();
            },
          }
        )
      }
    >
      <div className="flex flex-col gap-y-1">
        <Label size="xsmall" htmlFor={`resolve-note-${request.id}`}>
          Text do potvrzení o vyřízení (volitelné)
        </Label>
        <Textarea
          id={`resolve-note-${request.id}`}
          rows={2}
          placeholder="Např. Glazura opravena a znovu vypálena, kus odeslán zpět 5. 10."
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {expectsMoney && remaining > 0 && (
        <Text size="small" className="text-ui-tag-orange-text">
          Pozor: způsob vyřízení je {RESOLUTION_LABEL[request.resolution!]}, ale
          zbývá vrátit {formatCzk(remaining)}. Po vyřízení už peníze přes modul
          vrátit nepůjde — nejdřív použijte „Vrátit peníze".
        </Text>
      )}
      <Text size="small" className="text-ui-fg-subtle">
        Zákazník dostane e-mail s potvrzením o vyřízení (datum, způsob) a
        protokol se doplní o výsledek. Stav je konečný.
      </Text>
      <div className="flex flex-wrap gap-2">
        <Button size="small" variant="primary" type="submit" isLoading={mutation.isPending}>
          Vyřízeno a poslat potvrzení
        </Button>
        <Button size="small" variant="secondary" type="button" onClick={onClose}>
          Zpět
        </Button>
      </div>
    </PanelShell>
  );
};

/** Stornovat žádost — zákazník ji stáhl, duplicita, omyl. Důvod povinný. */
const CancelPanel = ({ request, onClose }: PanelProps) => {
  const [note, setNote] = useState("");
  const mutation = useReturnAction(request.id, "cancel");
  const trimmed = note.trim();

  return (
    <PanelShell
      title="Stornovat žádost"
      onSubmit={() => {
        if (!trimmed) return;
        mutation.mutate(
          { note: trimmed },
          {
            onSuccess: () => {
              toast.success("Žádost byla stornována.");
              onClose();
            },
          }
        );
      }}
    >
      <div className="flex flex-col gap-y-1">
        <Label size="xsmall" htmlFor={`cancel-note-${request.id}`}>
          Důvod storna (povinné, interní)
        </Label>
        <Textarea
          id={`cancel-note-${request.id}`}
          rows={2}
          placeholder="Např. Zákazník si vrácení rozmyslel (telefonát 4. 10.)."
          value={note}
          onChange={(event) => setNote(event.target.value)}
          autoFocus
        />
      </div>
      <Text size="small" className="text-ui-fg-subtle">
        Žádost se uzavře bez vyřízení. Zákazníkovi žádný e-mail neodejde; pro
        zamítnutí s odůvodněním použijte „Zamítnout" u nové žádosti.
      </Text>
      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          variant="danger"
          type="submit"
          isLoading={mutation.isPending}
          disabled={!trimmed}
        >
          Stornovat žádost
        </Button>
        <Button size="small" variant="secondary" type="button" onClick={onClose}>
          Zpět
        </Button>
      </div>
    </PanelShell>
  );
};

/**
 * Vrátit peníze — jádro modulu. Částka je předvyplněná na „zbývá", lze snížit
 * (krácení za opotřebení, §1833), nikdy ne přes zbývá; částečné a opakované
 * vrácení je dovolené. `skip_goods_check` je vědomé rozhodnutí u vrácení /
 * odstoupení, že se na zásilku nečeká (zboží nikdy neodešlo).
 */
const RefundPanel = ({
  request,
  skipGoodsCheck,
  onClose,
}: PanelProps & { skipGoodsCheck: boolean }) => {
  const remaining = asNumber(request.remaining);
  // §11.2: s vybranými položkami je výchozí částka jejich cena (server posílá
  // `suggested_amount` = min(zbývá, Σ položek); když chybí, spočítá se tu
  // stejně). Bez položek zůstává výchozí „zbývá". Strop je VŽDY „zbývá" —
  // položky ho nikdy nezvednou.
  const lineItems = request.line_items ?? [];
  const suggestedRaw =
    request.suggested_amount ??
    (lineItems.length > 0 ? lineItemsTotal(lineItems) : null);
  const suggested =
    lineItems.length > 0 && suggestedRaw !== null && suggestedRaw !== undefined
      ? Math.round(Math.min(asNumber(suggestedRaw), remaining) * 100) / 100
      : null;
  const useSuggested = suggested !== null && suggested > 0;
  const [amount, setAmount] = useState(
    String(useSuggested ? suggested : remaining)
  );
  const [note, setNote] = useState("");
  const [markResolved, setMarkResolved] = useState(true);
  const mutation = useReturnAction<RefundResponse>(request.id, "refund");

  const parsed = Number(amount.replace(",", "."));
  const amountValid =
    Number.isFinite(parsed) && parsed > 0 && parsed <= remaining + 0.005;
  const isFull = amountValid && nearlyZero(parsed - remaining);

  // Výchozí „označit jako vyřízené" = vracíte všechno. Při snížení částky se
  // vypne, ať se částečná refundace neuzavře omylem; přepínač zůstává ruční.
  useEffect(() => {
    setMarkResolved(isFull);
  }, [isFull]);

  const noteRequired = skipGoodsCheck;
  const canSubmit = amountValid && (!noteRequired || note.trim().length > 0);

  return (
    <PanelShell
      title={`Vrátit peníze — objednávka #${request.order_display_id}`}
      onSubmit={() => {
        if (!canSubmit) return;
        mutation.mutate(
          {
            amount: parsed,
            ...(note.trim() ? { note: note.trim() } : {}),
            ...(skipGoodsCheck ? { skip_goods_check: true } : {}),
            mark_resolved: markResolved,
          },
          {
            onSuccess: (result) => {
              toast.success(result?.message ?? "Peníze byly vráceny.");
              onClose();
            },
          }
        );
      }}
    >
      {skipGoodsCheck && (
        <Text size="small" className="text-ui-tag-orange-text">
          Vracíte bez čekání na zásilku. Podle §1832/4 smíte s vrácením počkat,
          dokud zboží nedostanete zpět — tímto se té možnosti vědomě vzdáváte
          (např. zboží nikdy neodešlo). Důvod se zapíše k refundaci.
        </Text>
      )}

      <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div className="flex flex-col gap-y-1">
          <Label size="xsmall" htmlFor={`refund-amount-${request.id}`}>
            Kolik vrátit (Kč)
          </Label>
          <Input
            id={`refund-amount-${request.id}`}
            type="number"
            min={0}
            max={remaining}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoFocus
          />
          {useSuggested && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Cena vybraných položek: {formatCzk(suggested)}
              {nearlyZero(suggested - remaining)
                ? ""
                : " — předvyplněno, můžete změnit až do výše, která zbývá vrátit."}
            </Text>
          )}
          <Text size="xsmall" className="text-ui-fg-subtle">
            Zbývá vrátit {formatCzk(remaining)}
            {asNumber(request.refunded_total) > 0
              ? ` (už vráceno ${formatCzk(asNumber(request.refunded_total))})`
              : ""}
            .
          </Text>
          {useSuggested && !nearlyZero(suggested - remaining) && (
            <div className="flex flex-wrap gap-x-3">
              <button
                type="button"
                className="text-ui-fg-interactive txt-small hover:underline"
                onClick={() => setAmount(String(suggested))}
              >
                Cena položek
              </button>
              <button
                type="button"
                className="text-ui-fg-interactive txt-small hover:underline"
                onClick={() => setAmount(String(remaining))}
              >
                Vše, co zbývá
              </button>
            </div>
          )}
          {amount !== "" && !amountValid && (
            <Text size="xsmall" className="text-ui-fg-error">
              Částka musí být větší než 0 a nejvýš {formatCzk(remaining)}.
            </Text>
          )}
        </div>
        <div className="flex flex-col gap-y-1">
          <Label size="xsmall" htmlFor={`refund-note-${request.id}`}>
            {noteRequired
              ? "Důvod vrácení bez zásilky (povinné)"
              : "Poznámka (volitelné, např. důvod krácení)"}
          </Label>
          <Textarea
            id={`refund-note-${request.id}`}
            rows={3}
            placeholder={
              noteRequired
                ? "Zboží zákazník nikdy neobdržel — zásilka se vrátila."
                : "Např. Kráceno o 200 Kč za poškrábanou glazuru."
            }
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>

      <label className="flex items-start gap-x-2">
        <Checkbox
          checked={markResolved}
          onCheckedChange={(checked) => setMarkResolved(checked === true)}
        />
        <span>
          <Text size="small">Označit jako vyřízené</Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Žádost se uzavře a zákazník dostane potvrzení o vyřízení. Když
            zbývá vrátit 0 Kč, uzavře se vždy. Nechte vypnuté, pokud budete
            vracet nadvakrát.
          </Text>
        </span>
      </label>

      <Text size="small" className="text-ui-fg-subtle">
        Placeno kartou → vrátí se přes ComGate; jinak se zaznamená k ručnímu
        vrácení (převod / hotovost). Zákazník dostane jeden e-mail o vrácení
        peněz; dobropis se vystaví podle výše vrácené částky.
      </Text>

      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          variant="primary"
          type="submit"
          isLoading={mutation.isPending}
          disabled={!canSubmit}
        >
          Vrátit {amountValid ? formatCzk(parsed) : "peníze"}
        </Button>
        <Button size="small" variant="secondary" type="button" onClick={onClose}>
          Zpět
        </Button>
      </div>
    </PanelShell>
  );
};

/**
 * Zrušit objednávku a uvolnit sklad — až po vyřízení žádosti (§3), kdy je
 * refundace hotová a nativní zrušení už žádné peníze nehýbe.
 */
const CancelOrderPrompt = ({ request }: { request: ReturnRequest }) => {
  const [open, setOpen] = useState(false);
  const mutation = useReturnAction<CancelOrderResponse>(request.id, "cancel-order");
  const remaining = asNumber(request.remaining);

  return (
    <Prompt open={open} onOpenChange={setOpen}>
      <Prompt.Trigger asChild>
        <Button size="small" variant="danger">
          Zrušit objednávku a uvolnit sklad
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>
            Zrušit objednávku #{request.order_display_id}?
          </Prompt.Title>
          <Prompt.Description>
            Objednávka se zruší v Medusa, posune se do fáze „zrušeno" a
            rezervované kusy se vrátí na sklad.{" "}
            {remaining > 0
              ? `Pozor: na objednávce zbývá nevrácených ${formatCzk(remaining)} — server zrušení odmítne, dokud nejsou vráceny.`
              : "Peníze jsou vyřízené, zrušení už nic nevrací."}
          </Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel>Zpět</Prompt.Cancel>
          <Prompt.Action
            onClick={() =>
              mutation.mutate(
                {},
                {
                  onSuccess: (result) => {
                    if (result?.cancelled) {
                      toast.success(result.message ?? "Objednávka byla zrušena.");
                    } else {
                      toast.warning(
                        result?.message ??
                          "Objednávku se nepodařilo zrušit úplně — zkontrolujte detail."
                      );
                    }
                    setOpen(false);
                  },
                }
              )
            }
          >
            Zrušit objednávku
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};

/* -------------------------------------------------------------- detail ---- */

type Panel =
  | null
  | "approve"
  | "reject"
  | "received"
  | "refund"
  | "resolve"
  | "cancel";

/** Časová osa: přijato → rozhodnuto → zboží přijato → vyřízeno/zamítnuto. */
const Timeline = ({ request }: { request: ReturnRequest }) => {
  type Step = { label: string; at: string | null; state: "done" | "current" | "upcoming" | "skipped" };
  const steps: Step[] = [];

  steps.push({ label: "Žádost přijata", at: request.created_at, state: "done" });

  if (request.status === "pending") {
    steps.push({ label: "Rozhodnutí", at: null, state: "current" });
    steps.push({ label: "Zboží přijato", at: null, state: "upcoming" });
    steps.push({ label: "Vyřízeno", at: null, state: "upcoming" });
  } else if (request.status === "rejected") {
    steps.push({ label: "Zamítnuto", at: request.decided_at, state: "done" });
  } else if (request.status === "cancelled") {
    if (request.decided_at) {
      steps.push({ label: "Schváleno", at: request.decided_at, state: "done" });
    }
    if (request.goods_received_at) {
      steps.push({ label: "Zboží přijato", at: request.goods_received_at, state: "done" });
    }
    steps.push({ label: "Stornováno", at: request.updated_at ?? null, state: "done" });
  } else {
    steps.push({
      label: request.resolution
        ? `Schváleno — ${RESOLUTION_LABEL[request.resolution]}`
        : "Schváleno",
      at: request.decided_at,
      state: "done",
    });
    const needsGoods =
      request.kind !== "reklamace" ||
      request.resolution === "repair" ||
      request.resolution === "replace" ||
      request.resolution === "refund";
    if (request.goods_received_at) {
      steps.push({ label: "Zboží přijato", at: request.goods_received_at, state: "done" });
    } else if (request.status === "approved") {
      steps.push({
        label: needsGoods ? "Čeká na zboží" : "Zboží přijato (není třeba)",
        at: null,
        state: needsGoods ? "current" : "skipped",
      });
    } else if (request.status === "resolved") {
      steps.push({ label: "Zboží přijato (přeskočeno)", at: null, state: "skipped" });
    }
    if (request.status === "resolved") {
      steps.push({ label: "Vyřízeno", at: request.resolved_at, state: "done" });
    } else {
      steps.push({
        label: "Vyřízeno",
        at: null,
        state: request.status === "received" ? "current" : "upcoming",
      });
    }
  }

  const dot: Record<Step["state"], string> = {
    done: "bg-ui-tag-green-icon",
    current: "bg-ui-tag-orange-icon",
    upcoming: "bg-ui-border-strong",
    skipped: "bg-ui-border-base",
  };

  return (
    <ol className="flex flex-col gap-y-2">
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-x-3">
          <span
            aria-hidden="true"
            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot[step.state]}`}
          />
          <div className="min-w-0">
            <Text
              size="small"
              weight={step.state === "current" ? "plus" : "regular"}
              className={step.state === "upcoming" || step.state === "skipped" ? "text-ui-fg-muted" : ""}
            >
              {step.label}
            </Text>
            {step.at && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                {formatDateTime(step.at)}
              </Text>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
};

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">
    {children}
  </Text>
);

/**
 * Akce podle stavu. Co tu není, server by stejně odmítl — proto se jiné
 * tlačítka nezobrazují, místo aby byla šedá.
 */
const Actions = ({
  request,
  panel,
  setPanel,
}: {
  request: ReturnRequest;
  panel: Panel;
  setPanel: (panel: Panel) => void;
}) => {
  // Přepínač u vrácení/odstoupení ve stavu „schváleno": vracím bez zásilky.
  const [skipGoods, setSkipGoods] = useState(false);
  useEffect(() => {
    setSkipGoods(false);
  }, [request.id, request.status]);

  const close = () => setPanel(null);
  const remaining = asNumber(request.remaining);
  const isReklamace = request.kind === "reklamace";
  const isReturnKindGoods = request.kind === "vraceni" || request.kind === "odstoupeni";
  const moneyResolution =
    request.resolution === "refund" || request.resolution === "discount";
  const workResolution =
    request.resolution === "repair" || request.resolution === "replace";

  if (isFinalStatus(request.status)) {
    const canCancelOrder = request.status === "resolved" && isReturnKindGoods;
    return (
      <div className="flex flex-col gap-y-3">
        <Text size="small" className="text-ui-fg-subtle">
          {request.status === "resolved"
            ? "Žádost je vyřízená. Stav je konečný."
            : request.status === "rejected"
              ? "Žádost byla zamítnuta. Stav je konečný."
              : "Žádost byla stornována. Stav je konečný."}
        </Text>
        {canCancelOrder && (
          <div className="flex flex-col gap-y-2">
            <CancelOrderPrompt request={request} />
            <Text size="xsmall" className="text-ui-fg-subtle">
              Zruší objednávku v Medusa a vrátí rezervované kusy na sklad.
              Udělejte to, až když je zboží zpět a peníze vrácené.
            </Text>
          </div>
        )}
      </div>
    );
  }

  if (panel === "approve") return <ApprovePanel request={request} onClose={close} />;
  if (panel === "reject") return <RejectPanel request={request} onClose={close} />;
  if (panel === "received") return <ReceivedPanel request={request} onClose={close} />;
  if (panel === "resolve") return <ResolvePanel request={request} onClose={close} />;
  if (panel === "cancel") return <CancelPanel request={request} onClose={close} />;
  if (panel === "refund") {
    return (
      <RefundPanel
        request={request}
        skipGoodsCheck={request.status === "approved" && isReturnKindGoods && skipGoods}
        onClose={close}
      />
    );
  }

  if (request.status === "pending") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="small" variant="primary" onClick={() => setPanel("approve")}>
          Schválit
        </Button>
        <Button size="small" variant="danger" onClick={() => setPanel("reject")}>
          Zamítnout
        </Button>
      </div>
    );
  }

  if (request.status === "approved") {
    const canRefundNow = isReklamace && moneyResolution && remaining > 0;
    // Odstoupení/vrácení PŘED odesláním: zboží nikdy neodešlo, takže se
    // nečeká na „zboží přijato" — peníze jdou rovnou, při nule jde objednávku
    // rovnou zrušit (server to povolí: remaining == 0).
    const goodsNeverShipped = isReturnKindGoods && request.goods_shipped === false;
    return (
      <div className="flex flex-col gap-y-3">
        <div className="flex flex-wrap gap-2">
          {!goodsNeverShipped && (
            <Button size="small" variant="primary" onClick={() => setPanel("received")}>
              Zboží přijato
            </Button>
          )}
          {canRefundNow && (
            <Button size="small" variant="secondary" onClick={() => setPanel("refund")}>
              Vrátit peníze
            </Button>
          )}
          {goodsNeverShipped && remaining > 0 && (
            <Button size="small" variant="primary" onClick={() => setPanel("refund")}>
              Vrátit peníze
            </Button>
          )}
          {goodsNeverShipped && remaining <= 0 && <CancelOrderPrompt request={request} />}
          {!goodsNeverShipped && isReturnKindGoods && skipGoods && remaining > 0 && (
            <Button size="small" variant="secondary" onClick={() => setPanel("refund")}>
              Vrátit peníze bez čekání na zásilku
            </Button>
          )}
          {(workResolution || (isReklamace && !moneyResolution)) && (
            <Button size="small" variant="secondary" onClick={() => setPanel("resolve")}>
              Vyřízeno
            </Button>
          )}
          <Button size="small" variant="transparent" onClick={() => setPanel("cancel")}>
            Stornovat žádost
          </Button>
        </div>

        {goodsNeverShipped && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Zboží k zákazníkovi neodešlo — není co vracet.{" "}
            {remaining > 0
              ? "Vraťte peníze a pak objednávku zrušte."
              : "Nebylo zaplaceno nic; objednávku můžete rovnou zrušit a uvolnit sklad."}
          </Text>
        )}

        {isReturnKindGoods && !goodsNeverShipped && (
          <label className="flex items-start gap-x-2">
            <Checkbox
              checked={skipGoods}
              onCheckedChange={(checked) => setSkipGoods(checked === true)}
              disabled={remaining <= 0}
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

        {isReklamace && workResolution && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Způsob vyřízení je {RESOLUTION_LABEL[request.resolution!]} — peníze se
            nevrací. Až bude oprava/výměna hotová, klikněte „Vyřízeno".
          </Text>
        )}
      </div>
    );
  }

  if (request.status === "received") {
    return (
      <div className="flex flex-col gap-y-2">
        <div className="flex flex-wrap gap-2">
          {remaining > 0 && (
            <Button size="small" variant="primary" onClick={() => setPanel("refund")}>
              Vrátit peníze
            </Button>
          )}
          <Button
            size="small"
            variant={remaining > 0 ? "secondary" : "primary"}
            onClick={() => setPanel("resolve")}
          >
            Vyřízeno
          </Button>
        </div>
        {remaining <= 0 && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Na objednávce už nezbývá nic k vrácení — zbývá jen potvrdit vyřízení.
          </Text>
        )}
      </div>
    );
  }

  return null;
};

const RequestDetail = ({
  request,
  onClose,
}: {
  request: ReturnRequest | null;
  onClose: () => void;
}) => {
  const [panel, setPanel] = useState<Panel>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Nový detail nebo změna stavu → zavřít rozpracovaný panel.
  useEffect(() => {
    setPanel(null);
  }, [request?.id, request?.status]);

  const deadline =
    request && !isFinalStatus(request.status) ? deadlineInfo(request.resolve_by) : null;
  const refunds = request?.refunds ?? [];

  return (
    <>
      <Drawer open={!!request} onOpenChange={(open) => !open && onClose()}>
        <Drawer.Content
          style={{ width: "min(46rem, 94vw)", maxWidth: "min(46rem, 94vw)" }}
        >
          {request && (
            <>
              <Drawer.Header>
                <Drawer.Title>
                  Objednávka #{request.order_display_id}
                  {request.kind ? ` · ${KIND_META[request.kind].label}` : ""}
                </Drawer.Title>
                <Text size="small" className="text-ui-fg-subtle">
                  {request.customer_name ? `${request.customer_name} · ` : ""}
                  {request.email} · přijato {formatDateTime(request.created_at)}
                </Text>
              </Drawer.Header>

              <Drawer.Body className="flex flex-col gap-y-6 overflow-y-auto">
                <div className="flex flex-wrap items-center gap-1.5">
                  {request.kind && (
                    <Badge size="2xsmall" color={KIND_META[request.kind].color}>
                      {KIND_META[request.kind].label}
                    </Badge>
                  )}
                  <Badge size="2xsmall" color={STATUS_META[request.status].color}>
                    {STATUS_META[request.status].label}
                  </Badge>
                  {deadline && (
                    <Badge size="2xsmall" color={deadline.color}>
                      {deadline.label}
                    </Badge>
                  )}
                  <DamageBadge cause={request.damage_cause} />
                  {request.kind === "reklamace" && request.requested_resolution && (
                    <Badge size="2xsmall" color="grey">
                      Žádá: {RESOLUTION_LABEL[request.requested_resolution]}
                    </Badge>
                  )}
                  {request.resolution && request.status !== "pending" && (
                    <Badge size="2xsmall" color="green">
                      Rozhodnuto: {RESOLUTION_LABEL[request.resolution]}
                    </Badge>
                  )}
                  {request.protocol_number && (
                    <Badge size="2xsmall" color="grey">
                      {request.protocol_number}
                    </Badge>
                  )}
                  <Button size="small" variant="transparent" asChild>
                    <Link to={`/orders/${request.order_id}`}>Detail objednávky</Link>
                  </Button>
                </div>

                {isDamageCause(request.damage_cause) && (
                  <Text size="xsmall" className="text-ui-tag-red-text">
                    {DAMAGE_CAUSE_HINT[request.damage_cause]}
                  </Text>
                )}

                <section className="border-ui-border-base rounded-lg border p-4">
                  <SectionTitle>Akce</SectionTitle>
                  <div className="mt-3">
                    <Actions request={request} panel={panel} setPanel={setPanel} />
                  </div>
                </section>

                <div className="grid gap-6 lg:grid-cols-2">
                  <section>
                    <SectionTitle>Průběh</SectionTitle>
                    <div className="mt-2">
                      <Timeline request={request} />
                    </div>
                    {request.resolve_by && (
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
                  </section>

                  <section>
                    <SectionTitle>Platby</SectionTitle>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                      <dt>
                        <Text size="small" className="text-ui-fg-subtle">
                          Zachyceno
                        </Text>
                      </dt>
                      <dd>
                        <Text size="small">{formatCzk(asNumber(request.captured_total))}</Text>
                      </dd>
                      <dt>
                        <Text size="small" className="text-ui-fg-subtle">
                          Vráceno
                        </Text>
                      </dt>
                      <dd>
                        <Text size="small">{formatCzk(asNumber(request.refunded_total))}</Text>
                      </dd>
                      <dt>
                        <Text size="small" className="text-ui-fg-subtle">
                          Zbývá vrátit
                        </Text>
                      </dt>
                      <dd>
                        <Text size="small" weight="plus">
                          {formatCzk(asNumber(request.remaining))}
                        </Text>
                      </dd>
                    </dl>
                    {refunds.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-y-1">
                        {refunds.map((refund, index) => (
                          <li key={index}>
                            <Text size="xsmall">
                              {formatCzk(asNumber(refund.amount))}{" "}
                              {refund.method === "comgate" ? "(ComGate)" : "(ručně)"}{" "}
                              <span className="text-ui-fg-muted">
                                {formatDateTime(refund.at)}
                              </span>
                              {refund.note ? ` — ${refund.note}` : ""}
                            </Text>
                          </li>
                        ))}
                      </ul>
                    )}
                    {refunds.length === 0 && request.refunded_at && (
                      <Text size="xsmall" className="text-ui-fg-subtle mt-3">
                        Vráceno {formatCzk(asNumber(request.refund_amount))}{" "}
                        {request.refund_method === "comgate" ? "(ComGate)" : "(ručně)"} ·{" "}
                        {formatDateTime(request.refunded_at)}
                      </Text>
                    )}
                  </section>
                </div>

                {request.line_items && request.line_items.length > 0 && (
                  <section>
                    <SectionTitle>Položky</SectionTitle>
                    <div className="mt-2 max-w-xl">
                      <LineItemsList items={request.line_items} showTotal />
                    </div>
                  </section>
                )}

                <section>
                  <SectionTitle>Důvod</SectionTitle>
                  <Text size="small" className="mt-2 whitespace-pre-wrap">
                    {request.reason}
                  </Text>
                  {/* Textové `items` jsou záloha pro staré žádosti — s
                      vybranými položkami nahoře by byly dvakrát. */}
                  {request.items && !(request.line_items && request.line_items.length > 0) && (
                    <Text size="xsmall" className="text-ui-fg-subtle mt-2 whitespace-pre-wrap">
                      Objekty: {request.items}
                    </Text>
                  )}
                </section>

                {request.photos && request.photos.length > 0 && (
                  <section>
                    <SectionTitle>Fotky</SectionTitle>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {request.photos.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setLightbox(url)}
                          className="focus-visible:shadow-borders-focus block h-20 w-20 overflow-hidden rounded-md border outline-none"
                          title="Zvětšit fotku"
                        >
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                  <section>
                    <SectionTitle>Protokol</SectionTitle>
                    {request.protocol_url ? (
                      <a
                        href={request.protocol_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ui-fg-interactive txt-small mt-2 inline-block hover:underline"
                      >
                        Protokol (PDF)
                        {request.protocol_number ? ` · ${request.protocol_number}` : ""}
                      </a>
                    ) : (
                      <Text size="small" className="text-ui-fg-muted mt-2">
                        Protokol zatím není k dispozici.
                      </Text>
                    )}
                  </section>

                  <section>
                    <SectionTitle>Vrácená zásilka</SectionTitle>
                    <Text size="small" className={`mt-2 ${request.goods_tracking ? "" : "text-ui-fg-muted"}`}>
                      {request.goods_tracking
                        ? `Číslo zásilky od zákazníka: ${request.goods_tracking}`
                        : "Zákazník zatím nezadal číslo zásilky."}
                    </Text>
                  </section>
                </div>

                {(request.decision_note || request.resolution_note) && (
                  <section>
                    <SectionTitle>Poznámky</SectionTitle>
                    {request.decision_note && (
                      <Text size="small" className="mt-2 whitespace-pre-wrap">
                        <span className="text-ui-fg-subtle">K rozhodnutí: </span>
                        {request.decision_note}
                      </Text>
                    )}
                    {request.resolution_note && (
                      <Text size="small" className="mt-2 whitespace-pre-wrap">
                        <span className="text-ui-fg-subtle">K vyřízení: </span>
                        {request.resolution_note}
                      </Text>
                    )}
                  </section>
                )}
              </Drawer.Body>
            </>
          )}
        </Drawer.Content>
      </Drawer>

      {/* Fotka přes celou obrazovku — klik kamkoli zavře. z-index nad drawer. */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
};

/* -------------------------------------------------------------- seznam ---- */

const ReklamaceInner = () => {
  const [searchParams] = useSearchParams();

  const [active, setActive] = useState<ReturnStatus>(() => {
    const fromUrl = searchParams.get("status");
    return isReturnStatus(fromUrl) ? fromUrl : "pending";
  });
  const [kind, setKind] = useState<"all" | ReturnKind>("all");
  // „Jen poškozené přepravou" — pošle se serveru (až ho bude umět) a pro
  // jistotu se přefiltruje i načtená stránka.
  const [damagedOnly, setDamagedOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get("id")
  );

  // Hluboký odkaz (widget, Přehled): ?status=&id= otevře tab i detail. Když se
  // parametry změní za běhu (klik z jiné objednávky), přepnout znovu.
  useEffect(() => {
    const status = searchParams.get("status");
    const id = searchParams.get("id");
    if (isReturnStatus(status)) {
      setActive(status);
      setOffset(0);
    }
    if (id) {
      setSelectedId(id);
    }
  }, [searchParams]);

  /* Vstup se mění hned; dotaz odejde 350 ms po poslední klávese. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const countsQuery = useQuery<ReturnRequestCounts>({
    queryKey: ["return-requests", "counts"],
    queryFn: () => sdk.client.fetch("/admin/return-requests/counts"),
    refetchOnWindowFocus: true,
  });

  const listQuery = useQuery<ReturnRequestListResponse>({
    queryKey: ["return-requests", "list", active, kind, search, damagedOnly, offset],
    queryFn: () =>
      sdk.client.fetch("/admin/return-requests", {
        query: {
          status: active,
          ...(kind !== "all" ? { kind } : {}),
          ...(damagedOnly ? { damage_cause: "carrier" } : {}),
          ...(search ? { q: search } : {}),
          limit: PAGE_SIZE,
          offset,
        },
      }),
    refetchOnWindowFocus: true,
  });

  const rows = (listQuery.data?.return_requests ?? []).filter(
    (row) => !damagedOnly || isDamageCause(row.damage_cause)
  );
  const total = listQuery.data?.count ?? 0;
  const counts = countsQuery.data;

  // Detail se odvozuje ze seznamu — po akci, která změní stav, řádek z tabu
  // zmizí a drawer se zavře sám (toast už řekl, co se stalo).
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  useEffect(() => {
    if (selectedId && listQuery.isSuccess && !listQuery.isFetching && !selected) {
      setSelectedId(null);
    }
  }, [selectedId, selected, listQuery.isSuccess, listQuery.isFetching]);

  const selectTab = (key: string) => {
    if (isReturnStatus(key)) {
      setActive(key);
      setOffset(0);
      setSelectedId(null);
    }
  };

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div>
          <Heading>Reklamace a zrušení</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Reklamace, vrácení zboží a odstoupení od smlouvy na jednom místě.
            Každá žádost jde cestou rozhodnutí → zboží zpět → vrácení peněz →
            potvrzení o vyřízení. Peníze se nikdy nevrací samy — jen tady,
            tlačítkem.
          </Text>
          {counts && counts.overdue > 0 && (
            <div className="mt-3">
              <Badge size="2xsmall" color="red">
                Po lhůtě: {counts.overdue}
              </Badge>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            size="small"
            value={kind}
            onValueChange={(value) => {
              setKind(isReturnKind(value) ? value : "all");
              setOffset(0);
            }}
          >
            <Select.Trigger className="w-44">
              <Select.Value placeholder="Druh" />
            </Select.Trigger>
            <Select.Content>
              {KIND_FILTERS.map((filter) => (
                <Select.Item key={filter.value} value={filter.value}>
                  {filter.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Input
            size="small"
            type="search"
            placeholder="Hledat číslo objednávky, e-mail, jméno…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-72"
          />
          <label className="flex items-center gap-x-2">
            <Checkbox
              checked={damagedOnly}
              onCheckedChange={(checked) => {
                setDamagedOnly(checked === true);
                setOffset(0);
              }}
            />
            <Text size="small">Jen poškozené přepravou</Text>
          </label>
        </div>
      </header>

      <SubTabs
        tabs={STATUS_TABS.map((tab) => ({
          key: tab.key,
          label: tab.label,
          count: counts?.[tab.key],
        }))}
        active={active}
        onSelect={selectTab}
      />

      {listQuery.isLoading && (
        <div className="flex flex-col gap-y-3 px-6 py-5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}

      {listQuery.isError && (
        <div className="flex min-h-48 flex-col items-center justify-center gap-y-3 px-6 text-center">
          <Heading level="h2">Žádosti se nepodařilo načíst</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {listQuery.error instanceof Error ? listQuery.error.message : ""}
          </Text>
          <Button size="small" variant="secondary" onClick={() => listQuery.refetch()}>
            Zkusit znovu
          </Button>
        </div>
      )}

      {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
        <EmptyState
          title={
            search || kind !== "all" || damagedOnly
              ? "Nic neodpovídá filtru"
              : active === "pending"
                ? "Žádné nové žádosti"
                : `V tomto stavu nic není`
          }
          description={
            search || kind !== "all" || damagedOnly
              ? "Zkuste jiný druh nebo jiné hledání."
              : active === "pending"
                ? "Jakmile zákazník uplatní reklamaci, vrácení nebo odstoupení přes e-shop, objeví se tady a dostanete upozornění e-mailem."
                : "Žádosti se sem přesunou, až budou v tomto stavu."
          }
        />
      )}

      {!listQuery.isLoading && !listQuery.isError && rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Objednávka</Table.HeaderCell>
                <Table.HeaderCell>Zákazník</Table.HeaderCell>
                <Table.HeaderCell>Druh</Table.HeaderCell>
                <Table.HeaderCell>Stav</Table.HeaderCell>
                <Table.HeaderCell>Lhůta</Table.HeaderCell>
                <Table.HeaderCell>Zbývá vrátit</Table.HeaderCell>
                <Table.HeaderCell>Přijato</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((request) => {
                const deadline = isFinalStatus(request.status)
                  ? null
                  : deadlineInfo(request.resolve_by);
                const remaining = asNumber(request.remaining);
                const refunded = asNumber(request.refunded_total);
                return (
                  <Table.Row
                    key={request.id}
                    className="cursor-pointer"
                    onClick={(event) => {
                      // Klik na řádek otevře detail; odkazy a tlačítka v řádku
                      // si svou akci nechají.
                      if ((event.target as HTMLElement).closest("a, button")) {
                        return;
                      }
                      setSelectedId(request.id);
                    }}
                  >
                    <Table.Cell>
                      <Button size="small" variant="transparent" asChild>
                        <Link to={`/orders/${request.order_id}`}>
                          #{request.order_display_id}
                        </Link>
                      </Button>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small">{request.customer_name ?? "—"}</Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {request.email}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      {request.kind && (
                        <Badge size="2xsmall" color={KIND_META[request.kind].color}>
                          {KIND_META[request.kind].label}
                        </Badge>
                      )}
                      {isDamageCause(request.damage_cause) && (
                        <div className="mt-1">
                          <DamageBadge cause={request.damage_cause} />
                        </div>
                      )}
                      {request.line_items && request.line_items.length > 0 && (
                        <Text
                          size="xsmall"
                          className="text-ui-fg-subtle mt-1"
                          title={formatLineItems(request.line_items)}
                        >
                          {lineItemsQuantity(request.line_items)} ks ·{" "}
                          {formatCzk(lineItemsTotal(request.line_items))}
                        </Text>
                      )}
                      {request.kind === "reklamace" && request.requested_resolution && (
                        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                          žádá: {RESOLUTION_LABEL[request.requested_resolution]}
                        </Text>
                      )}
                      {request.resolution && request.status !== "pending" && (
                        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                          rozhodnuto: {RESOLUTION_LABEL[request.resolution]}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge size="2xsmall" color={STATUS_META[request.status].color}>
                        {STATUS_META[request.status].label}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {deadline ? (
                        <Badge size="2xsmall" color={deadline.color}>
                          {deadline.label}
                        </Badge>
                      ) : (
                        <Text size="xsmall" className="text-ui-fg-muted">
                          —
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Text
                        size="small"
                        weight={remaining > 0 && !isFinalStatus(request.status) ? "plus" : "regular"}
                        className={remaining > 0 && !isFinalStatus(request.status) ? "" : "text-ui-fg-subtle"}
                      >
                        {formatCzk(remaining)}
                      </Text>
                      {refunded > 0 && (
                        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                          vráceno {formatCzk(refunded)}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="text-ui-fg-subtle whitespace-nowrap">
                        {formatDateTime(request.created_at)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end">
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => setSelectedId(request.id)}
                        >
                          Detail
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      )}

      {!listQuery.isLoading && !listQuery.isError && total > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Zobrazeno {offset + 1}–{Math.min(offset + rows.length, total)} z {total}
          </Text>
          <div className="flex gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Předchozí
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Další
            </Button>
          </div>
        </div>
      )}

      <RequestDetail request={selected} onClose={() => setSelectedId(null)} />
    </Container>
  );
};

const queryClient = adminQueryClient;

const ReklamacePage = () => (
  <QueryClientProvider client={queryClient}>
    <ReklamaceInner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Reklamace a zrušení",
  icon: ArrowUturnLeft,
  rank: 15,
});

export default ReklamacePage;
