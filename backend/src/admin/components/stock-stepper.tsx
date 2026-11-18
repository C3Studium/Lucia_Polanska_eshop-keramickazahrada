import { Button, toast } from "@medusajs/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ceskaChyba } from "../lib/ceska-chyba";
import { sdk } from "../lib/sdk";

/**
 * Stav skladu jako „− 6 +" (18. 11. 2026, přání majitele: „jako přidat /
 * odebrat kusy v obchodě"). Zaoblený ovladač stejného tvaru jako „Počet
 * kusů" na stránce výrobku v obchodě.
 *
 * Změna se NEUKLÁDÁ hned (druhé kolo 18. 11.: „není jak to vrátit"):
 * − / + a přepsané číslo jen rozepíšou nový stav; vedle se objeví
 * **Uložit** a **Zrušit**. Teprve Uložit pošle jeden rozdíl na
 * `/admin/workbench/inventory/add-stock`.
 *
 * − jde i pod nulu — záporný stav (prodáno víc, než bylo) se tak dá
 * opravit oběma směry.
 */
export const StockStepper = ({
  inventoryItemId,
  available,
  onDone,
  label = "Počet kusů na skladě",
}: {
  inventoryItemId: string;
  /** Kolik je k prodeji (skladem − rezervováno); může být záporné. */
  available: number;
  onDone: () => Promise<unknown>;
  label?: string;
}) => {
  const [delta, setDelta] = useState(0);
  const [text, setText] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (quantity: number) =>
      sdk.client.fetch(`/admin/workbench/inventory/add-stock`, {
        method: "POST",
        body: { inventory_item_id: inventoryItemId, quantity },
      }),
    onSuccess: async (_vysledek, quantity) => {
      await onDone();
      setDelta((current) => current - quantity);
      toast.success(`Uloženo — stav skladu ${quantity > 0 ? "+" : ""}${quantity} ks.`);
    },
    onError: (error) => toast.error(ceskaChyba(error, "Změna skladu se nepodařila.")),
  });

  const shown = available + delta;
  const dirty = delta !== 0;

  /* Napsaný stav → rozdíl proti tomu, co je vidět. „−" z telefonu taky. */
  const commitText = () => {
    if (text === null) return;
    const cleaned = text.trim().replace(/\s+/g, "").replace(/^[−–—]/, "-");
    setText(null);
    if (!/^-?\d+$/.test(cleaned)) return;
    const target = Number(cleaned);
    if (Math.abs(target) > 100_000) return;
    setDelta(target - available);
  };

  const btn =
    "text-ui-fg-subtle hover:bg-ui-bg-base-hover hover:text-ui-fg-base flex size-8 items-center justify-center rounded-full text-base leading-none disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={`inline-flex items-center rounded-full border ${
          dirty ? "border-ui-border-interactive" : "border-ui-border-strong"
        }`}
        role="group"
        aria-label={label}
      >
        <button
          type="button"
          className={btn}
          onClick={() => setDelta((current) => current - 1)}
          disabled={save.isPending}
          aria-label="Odebrat kus"
          title="Odebrat kus"
        >
          −
        </button>
        {/* Text, ne number: číselná klávesnice iPhonu nemá mínus a kolečko
            myši by číslo tiše měnilo. */}
        <input
          type="text"
          value={text ?? String(shown)}
          onFocus={(event) => {
            setText(String(shown));
            event.currentTarget.select();
          }}
          onChange={(event) => setText(event.target.value)}
          onBlur={commitText}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setText(null);
              event.currentTarget.blur();
            }
          }}
          disabled={save.isPending}
          aria-label={`${label} — napište nový stav`}
          title="Napište nový stav"
          className={`txt-compact-small-plus w-12 bg-transparent text-center tabular-nums outline-none focus:rounded focus:shadow-borders-focus ${
            shown < 0 ? "text-ui-fg-error" : "text-ui-fg-base"
          }`}
        />
        <button
          type="button"
          className={btn}
          onClick={() => setDelta((current) => current + 1)}
          disabled={save.isPending}
          aria-label="Přidat kus"
          title="Přidat kus"
        >
          +
        </button>
      </div>
      {dirty && (
        <>
          <Button size="small" isLoading={save.isPending} onClick={() => save.mutate(delta)}>
            Uložit
          </Button>
          <Button
            size="small"
            variant="secondary"
            disabled={save.isPending}
            onClick={() => {
              setDelta(0);
              setText(null);
            }}
          >
            Zrušit
          </Button>
          <span className="txt-compact-xsmall text-ui-fg-muted tabular-nums">
            {available} → {shown}
          </span>
        </>
      )}
    </div>
  );
};
