import { Button, Checkbox, Input, Label, Text, Textarea, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";
import {
  asNumber,
  lineItemsTotal,
  type RefundResponse,
  type RefundScope,
  type ReturnRequest,
} from "../../lib/return-requests";
import { formatCzk } from "../../lib/workbench";
import { PanelShell } from "./panels";
import { useReturnAction } from "./use-return-action";

/**
 * Vrátit peníze — jádro modulu (docs/reklamace-a-zruseni.md §3, §11.2, §12.3).
 *
 * Tři rozsahy:
 * - `items`  — částka = Σ `unit_total × quantity` vybraných položek (server ji
 *              počítá sám, tady se jen ukazuje); položky se uloží k refundaci.
 * - `all`    — celá objednávka: výchozí = zbývá, lze snížit (krácení §1833),
 *              nikdy přes zbývá.
 * - `deposit`— záloha zakázky: částka daná, rozhodnutí majitelky (§1837).
 * Bez `scope` se panel chová jako dřív (výchozí částka z `line_items` žádosti).
 *
 * `skip_goods_check` je vědomé rozhodnutí u vrácení / odstoupení, že se na
 * zásilku nečeká (zboží nikdy neodešlo) — vyžaduje důvod.
 *
 * `amount` se posílá vždy: nový server ho u `items`/`deposit` ignoruje a
 * počítá sám, starší server (bez `scope`) ho použije — stránka tak funguje
 * i během nasazování.
 */

/** Jedna vybraná položka k refundaci (ze stránky žádosti). */
export type RefundSelection = {
  line_item_id: string;
  quantity: number;
  title: string;
  unit_total: number;
  /** `unit_total × quantity`, u zakázky omezené zaplacenou zálohou. */
  amount: number;
};

/** Zaokrouhlení na haléře, aby „zbývá 0" nebylo 0.00000001. */
export const nearlyZero = (value: number) => Math.abs(value) < 0.005;

const round2 = (value: number) => Math.round(value * 100) / 100;

const TITLE: Record<RefundScope, string> = {
  items: "Vrátit peníze za vybrané položky",
  all: "Vrátit celou objednávku",
  deposit: "Vrátit zálohu zakázky",
};

export const RefundPanel = ({
  request,
  onClose,
  skipGoodsCheck = false,
  scope,
  selection = [],
  depositAmount,
}: {
  request: ReturnRequest;
  onClose: () => void;
  skipGoodsCheck?: boolean;
  scope?: RefundScope;
  /** Jen `scope: "items"`. */
  selection?: RefundSelection[];
  /** Jen `scope: "deposit"` — zaplacená záloha snížená o už vrácené. */
  depositAmount?: number | null;
}) => {
  const remaining = asNumber(request.remaining);
  const refunded = asNumber(request.refunded_total);

  // Pevná částka (položky / záloha) vs. editovatelná (celek / bez rozsahu).
  const fixedAmount = (() => {
    if (scope === "items") {
      return round2(Math.min(selection.reduce((sum, item) => sum + item.amount, 0), remaining));
    }
    if (scope === "deposit") {
      return round2(Math.min(asNumber(depositAmount), remaining));
    }
    return null;
  })();

  // §11.2: bez rozsahu je s vybranými položkami v žádosti výchozí částka
  // jejich cena (server posílá `suggested_amount`; když chybí, spočítá se tu).
  const lineItems = request.line_items ?? [];
  const suggestedRaw =
    request.suggested_amount ??
    (lineItems.length > 0 ? lineItemsTotal(lineItems) : null);
  const suggested =
    !scope && lineItems.length > 0 && suggestedRaw !== null && suggestedRaw !== undefined
      ? round2(Math.min(asNumber(suggestedRaw), remaining))
      : null;
  const useSuggested = suggested !== null && suggested > 0;

  const [amount, setAmount] = useState(
    String(fixedAmount ?? (useSuggested ? suggested : remaining))
  );
  const [note, setNote] = useState("");
  const [markResolved, setMarkResolved] = useState(true);
  const mutation = useReturnAction<RefundResponse>(request.id, "refund");

  const parsed = fixedAmount ?? Number(amount.replace(",", "."));
  const amountValid =
    Number.isFinite(parsed) && parsed > 0 && parsed <= remaining + 0.005;
  const isFull = amountValid && nearlyZero(parsed - remaining);

  // Výchozí „označit jako vyřízené" = vracíte všechno. Při snížení částky se
  // vypne, ať se částečná refundace neuzavře omylem; přepínač zůstává ruční.
  useEffect(() => {
    setMarkResolved(isFull);
  }, [isFull]);

  const noteRequired = skipGoodsCheck;
  const canSubmit =
    amountValid &&
    (!noteRequired || note.trim().length > 0) &&
    (scope !== "items" || selection.length > 0);

  // U zálohy o uzavření rozhoduje server (žádost zpravidla pokračuje zrušením
  // zakázky); přepínač se nenabízí.
  const offerMarkResolved = scope !== "deposit";

  return (
    <PanelShell
      title={scope ? TITLE[scope] : `Vrátit peníze — objednávka #${request.order_display_id}`}
      onSubmit={() => {
        if (!canSubmit) return;
        mutation.mutate(
          {
            amount: parsed,
            ...(scope ? { scope } : {}),
            ...(scope === "items"
              ? {
                  items: selection.map((item) => ({
                    line_item_id: item.line_item_id,
                    quantity: item.quantity,
                  })),
                }
              : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
            ...(skipGoodsCheck ? { skip_goods_check: true } : {}),
            ...(offerMarkResolved ? { mark_resolved: markResolved } : {}),
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

      {scope === "items" && (
        <ul className="flex flex-col gap-y-0.5">
          {selection.map((item) => (
            <li key={item.line_item_id} className="flex items-baseline justify-between gap-x-3">
              <Text size="xsmall" className="truncate" title={item.title}>
                {item.title} · {item.quantity} ks
              </Text>
              <Text size="xsmall" weight="plus" className="whitespace-nowrap">
                {formatCzk(round2(item.amount))}
              </Text>
            </li>
          ))}
          {selection.length === 0 && (
            <Text size="xsmall" className="text-ui-fg-error">
              Vyberte v tabulce objednávky alespoň jednu položku.
            </Text>
          )}
        </ul>
      )}

      {scope === "deposit" && (
        <Text size="small" className="text-ui-fg-subtle">
          Zákazník na vrácení zálohy u zakázky nemá nárok (§1837 d) — je to vaše
          rozhodnutí. Zapíše se k zakázce jako „záloha vrácena"; zakázku pak
          zrušíte tlačítkem v bloku Zakázka.
        </Text>
      )}

      <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div className="flex flex-col gap-y-1">
          <Label size="xsmall" htmlFor={`refund-amount-${request.id}`}>
            {fixedAmount !== null ? "Částka (Kč)" : "Kolik vrátit (Kč)"}
          </Label>
          {fixedAmount !== null ? (
            <Text size="large" weight="plus">
              {formatCzk(fixedAmount)}
            </Text>
          ) : (
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
          )}
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
            {refunded > 0 ? ` (už vráceno ${formatCzk(refunded)})` : ""}.
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
          {fixedAmount === null && amount !== "" && !amountValid && (
            <Text size="xsmall" className="text-ui-fg-error">
              Částka musí být větší než 0 a nejvýš {formatCzk(remaining)}.
            </Text>
          )}
          {fixedAmount !== null && !amountValid && (
            <Text size="xsmall" className="text-ui-fg-error">
              Není co vrátit — částka musí být větší než 0.
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

      {offerMarkResolved && (
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
      )}

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
          Vrátit {amountValid ? formatCzk(round2(parsed)) : "peníze"}
        </Button>
        <Button size="small" variant="secondary" type="button" onClick={onClose}>
          Zpět
        </Button>
      </div>
    </PanelShell>
  );
};
