import {
  Button,
  Checkbox,
  Label,
  Prompt,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useState, type ReactNode } from "react";
import {
  asNumber,
  RESOLUTION_LABEL,
  type CancelOrderResponse,
  type ReturnRequest,
  type ReturnResolution,
} from "../../lib/return-requests";
import { formatCzk } from "../../lib/workbench";
import { useReturnAction } from "./use-return-action";

/**
 * Panely akcí nad žádostí (docs/reklamace-a-zruseni.md §3, §8, §12.6).
 *
 * Každý panel je jeden formulář = jeden POST; po úspěchu zavolá `onClose`
 * (stránka zavře panel, detail se obnoví přes hook). Vrácení peněz má vlastní
 * soubor (`refund-panel.tsx`), protože má tři rozsahy.
 */

export type PanelProps = {
  request: ReturnRequest;
  onClose: () => void;
};

const RESOLUTION_OPTIONS: { value: ReturnResolution; label: string }[] = [
  { value: "repair", label: RESOLUTION_LABEL.repair },
  { value: "replace", label: RESOLUTION_LABEL.replace },
  { value: "discount", label: RESOLUTION_LABEL.discount },
  { value: "refund", label: RESOLUTION_LABEL.refund },
];

export const PanelShell = ({
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
 *
 * `allowChain` (výchozí zapnuto): u odstoupení/vrácení nabídne „rovnou vrátit
 * peníze" + „zrušit objednávku" v jednom kroku. U zakázky je vypnuté — o záloze
 * se rozhoduje výslovně v bloku Zakázka (§12.3, §1837), ne mimochodem.
 */
export const ApprovePanel = ({
  request,
  onClose,
  allowChain = true,
}: PanelProps & { allowChain?: boolean }) => {
  const isReklamace = request.kind === "reklamace";
  const [resolution, setResolution] = useState<string>(
    isReklamace && request.requested_resolution ? request.requested_resolution : ""
  );
  const [note, setNote] = useState("");
  const mutation = useReturnAction<{ message?: string }>(request.id, "decide");
  const canSubmit = !isReklamace || resolution !== "";

  // Odstoupení / vrácení v jednom kroku: zboží neodešlo → peníze hned a
  // objednávku rovnou zrušit (výchozí zapnuto). Odeslané zboží → výchozí
  // vypnuto (§ 1832/4: smíte počkat na zásilku), ale jde to vědomě zapnout.
  const remaining = asNumber(request.remaining);
  const goodsNeverShipped = request.goods_shipped === false;
  const chainOffered = !isReklamace && allowChain;
  const [refundNow, setRefundNow] = useState(chainOffered && goodsNeverShipped && remaining > 0);
  const [cancelOrder, setCancelOrder] = useState(chainOffered && goodsNeverShipped);
  const chainRefund = chainOffered && refundNow && remaining > 0;
  const chainCancel = chainOffered && cancelOrder && (chainRefund || remaining <= 0);

  const explanation = (() => {
    if (!isReklamace) {
      if (!allowChain) {
        return "Zákazník dostane e-mail se schválením. O záloze zakázky rozhodnete zvlášť v bloku Zakázka — vrátit, nebo ponechat a zakázku zrušit.";
      }
      if (goodsNeverShipped) {
        return remaining > 0
          ? "Zboží k zákazníkovi neodešlo — nic neposílá. Zákazník dostane e-mail, že je objednávka zrušená; peníze se vrátí podle volby níže."
          : "Zboží k zákazníkovi neodešlo a nebylo zaplaceno nic — není co vracet. Žádost se vyřídí hned; objednávku můžete rovnou zrušit.";
      }
      return "Zákazník dostane e-mail se schválením, adresou pro vrácení zboží (z nastavení E-maily obchodu) a lhůtou 14 dnů. Peníze se vrátí až po přijetí zboží — nebo hned, když to níže zapnete.";
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
            ...(chainRefund ? { refund_now: true } : {}),
            ...(chainCancel ? { cancel_order: true } : {}),
          },
          {
            onSuccess: (result) => {
              toast.success(
                result?.message ??
                  "Žádost byla schválena — zákazníkovi odešel e-mail s dalším postupem."
              );
              onClose();
            },
          }
        );
      }}
    >
      {chainOffered && (
        <div className="flex flex-col gap-y-2">
          <label className="flex items-start gap-x-2">
            <Checkbox
              checked={refundNow}
              disabled={remaining <= 0}
              onCheckedChange={(checked) => setRefundNow(checked === true)}
            />
            <span>
              <Text size="small">
                {remaining > 0
                  ? `Rovnou vrátit peníze (${formatCzk(remaining)}) přes ComGate`
                  : "Není co vracet — nic nebylo zaplaceno"}
              </Text>
              {remaining > 0 && !goodsNeverShipped && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Zboží už odešlo. Zapnutím se vědomě vzdáváte práva počkat na jeho vrácení (§ 1832/4).
                </Text>
              )}
            </span>
          </label>
          <label className="flex items-start gap-x-2">
            <Checkbox
              checked={cancelOrder}
              disabled={!(chainRefund || remaining <= 0)}
              onCheckedChange={(checked) => setCancelOrder(checked === true)}
            />
            <span>
              <Text size="small">Zrušit objednávku a uvolnit sklad</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {chainRefund || remaining <= 0
                  ? "Objednávka se zruší v Medusa a rezervované kusy se vrátí na sklad."
                  : "Jde až po vrácení peněz — zapněte vrácení, nebo zrušte později z detailu."}
              </Text>
            </span>
          </label>
        </div>
      )}
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
          {chainRefund && chainCancel
            ? "Schválit, vrátit peníze a zrušit objednávku"
            : chainRefund
              ? "Schválit a vrátit peníze"
              : chainCancel
                ? "Schválit a zrušit objednávku"
                : "Schválit a poslat e-mail"}
        </Button>
        <Button size="small" variant="secondary" type="button" onClick={onClose}>
          Zpět
        </Button>
      </div>
    </PanelShell>
  );
};

/** Zamítnout — odůvodnění je povinné, jde zákazníkovi doslova (§19/3 ZOS). */
export const RejectPanel = ({ request, onClose }: PanelProps) => {
  const [note, setNote] = useState("");
  const mutation = useReturnAction<{ message?: string }>(request.id, "decide");
  const trimmed = note.trim();

  return (
    <PanelShell
      title={`Zamítnout žádost k objednávce #${request.order_display_id}`}
      onSubmit={() => {
        if (!trimmed) return;
        mutation.mutate(
          { decision: "reject", note: trimmed },
          {
            onSuccess: (result) => {
              toast.success(
                result?.message ??
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
export const ReceivedPanel = ({ request, onClose }: PanelProps) => {
  const [note, setNote] = useState("");
  const mutation = useReturnAction<{ message?: string }>(request.id, "received");

  return (
    <PanelShell
      title="Potvrdit přijetí zboží"
      onSubmit={() =>
        mutation.mutate(
          note.trim() ? { note: note.trim() } : {},
          {
            onSuccess: (result) => {
              toast.success(
                result?.message ??
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
export const ResolvePanel = ({ request, onClose }: PanelProps) => {
  const [note, setNote] = useState("");
  const mutation = useReturnAction<{ message?: string }>(request.id, "resolve");
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
            onSuccess: (result) => {
              toast.success(
                result?.message ??
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
export const CancelPanel = ({ request, onClose }: PanelProps) => {
  const [note, setNote] = useState("");
  const mutation = useReturnAction<{ message?: string }>(request.id, "cancel");
  const trimmed = note.trim();

  return (
    <PanelShell
      title="Stornovat žádost"
      onSubmit={() => {
        if (!trimmed) return;
        mutation.mutate(
          { note: trimmed },
          {
            onSuccess: (result) => {
              toast.success(result?.message ?? "Žádost byla stornována.");
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
 * Zrušit objednávku a uvolnit sklad — až po vyřízení žádosti (§3), kdy je
 * refundace hotová a nativní zrušení už žádné peníze nehýbe.
 */
export const CancelOrderPrompt = ({
  request,
  onDone,
}: {
  request: ReturnRequest;
  onDone?: () => void;
}) => {
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
                    onDone?.();
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
