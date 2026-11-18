import { toast } from "@medusajs/ui";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ceskaChyba } from "../lib/ceska-chyba";
import { sdk } from "../lib/sdk";

/**
 * Stav skladu jako „− 6 +" (18. 11. 2026, přání majitele: „jako přidat /
 * odebrat kusy v obchodě"). Zaoblený ovladač stejného tvaru jako „Počet
 * kusů" na stránce výrobku v obchodě:
 *
 * - **− / +** změní stav o kus. Rychlá kliknutí se sečtou a uloží jedním
 *   požadavkem chvíli po posledním (třikrát − = −3).
 * - **číslo uprostřed** je pole: napíše se nový stav (třeba 0) a Enter
 *   nebo kliknutí jinam ho uloží. Ukazuje i záporný stav (−7 = prodáno víc,
 *   než bylo na skladě).
 *
 * Ukládá přes `/admin/workbench/inventory/add-stock` rozdílem (+/−). Kusy
 * rezervované otevřenými objednávkami server neodebere.
 */
const pieces = (count: number) =>
  `${count} ${Math.abs(count) === 1 ? "kus" : Math.abs(count) >= 2 && Math.abs(count) <= 4 ? "kusy" : "kusů"}`;

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
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useMutation({
    mutationFn: (quantity: number) =>
      sdk.client.fetch(`/admin/workbench/inventory/add-stock`, {
        method: "POST",
        body: { inventory_item_id: inventoryItemId, quantity },
      }) as Promise<{ added?: number; removed?: number; reserved?: number }>,
    onSuccess: async (vysledek, quantity) => {
      await onDone();
      setDelta((current) => current - quantity);
      if (quantity < 0 && (vysledek?.removed ?? 0) < Math.abs(quantity)) {
        toast.info(
          `Odebráno jen ${pieces(vysledek?.removed ?? 0)} — zbytek drží otevřené objednávky.`
        );
      }
    },
    onError: (error, quantity) => {
      setDelta((current) => current - quantity);
      toast.error(ceskaChyba(error, "Změna skladu se nepodařila."));
    },
  });

  const shown = available + delta;

  const queue = (by: number) => {
    if (!by) return;
    setDelta((current) => current + by);
    pending.current += by;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const quantity = pending.current;
      pending.current = 0;
      if (quantity !== 0) save.mutate(quantity);
    }, 700);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  /* Napsaný stav → rozdíl proti tomu, co je vidět. „−" z telefonu taky. */
  const commitText = () => {
    if (text === null) return;
    const cleaned = text.trim().replace(/\s+/g, "").replace(/^[−–—]/, "-");
    setText(null);
    if (!/^-?\d+$/.test(cleaned)) return;
    const target = Number(cleaned);
    if (Math.abs(target) > 100_000) return;
    queue(target - shown);
  };

  return (
    <div
      className="border-ui-border-strong inline-flex items-center rounded-full border"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className="text-ui-fg-subtle hover:bg-ui-bg-base-hover hover:text-ui-fg-base flex size-8 items-center justify-center rounded-full text-base leading-none disabled:opacity-40"
        onClick={() => queue(-1)}
        disabled={shown <= 0}
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
        aria-label={`${label} — napište nový stav`}
        title="Napište nový stav a stiskněte Enter"
        className={`txt-compact-small-plus w-12 bg-transparent text-center tabular-nums outline-none focus:rounded focus:shadow-borders-focus ${
          shown < 0 ? "text-ui-fg-error" : "text-ui-fg-base"
        }`}
      />
      <button
        type="button"
        className="text-ui-fg-subtle hover:bg-ui-bg-base-hover hover:text-ui-fg-base flex size-8 items-center justify-center rounded-full text-base leading-none"
        onClick={() => queue(1)}
        aria-label="Přidat kus"
        title="Přidat kus"
      >
        +
      </button>
    </div>
  );
};
