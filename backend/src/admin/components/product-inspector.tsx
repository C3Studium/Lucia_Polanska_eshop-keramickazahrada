import { InformationCircle } from "@medusajs/icons";
import { Input, Popover, Switch, Text, toast } from "@medusajs/ui";
import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";

/**
 * Pravý sloupec detailu výrobku jako Nastavení na iPhonu (17. 11. 2026).
 *
 * Matěj: stránka byla pořád neuspořádaná — přepínače měly po dvou řádcích
 * vysvětlivek a míchaly se s obsahem. Teď: skupina = nadpis + rámeček
 * s řádky, v řádku popisek vlevo, ovládání vpravo, pod popiskem jedna krátká
 * věta. Celé vysvětlení je schované za „i" (a v `title` pro najetí myší),
 * nikde se neztratilo.
 */

/** Skupina nastavení — nadpis nad rámečkem s řádky. */
export const InspectorGroup = ({
  title,
  id,
  note,
  children,
}: {
  title: string;
  /** Kotva pro skok z karty „Připraveno k prodeji". */
  id?: string;
  /** Drobná věta pod rámečkem. */
  note?: ReactNode;
  children: ReactNode;
}) => (
  <section id={id} className="scroll-mt-24 px-5 py-4">
    <Text size="small" weight="plus" className="text-ui-fg-subtle mb-2 px-1">
      {title}
    </Text>
    <div className="bg-ui-bg-base shadow-borders-base divide-y rounded-lg">
      {children}
    </div>
    {note ? (
      <Text size="xsmall" className="text-ui-fg-muted mt-1.5 px-1">
        {note}
      </Text>
    ) : null}
  </section>
);

/**
 * „i" vedle popisku — celé vysvětlení, které se do jedné věty nevešlo.
 * Popover z @medusajs/ui se vykresluje mimo stránku a nemá vlastní z-index,
 * proto `z-50` (jinak se schová pod lištu adminu).
 */
export const InfoTip = ({ text, label }: { text: string; label: string }) => (
  <Popover>
    <Popover.Trigger asChild>
      <button
        type="button"
        title={text}
        aria-label={`Víc o: ${label}`}
        className="text-ui-fg-muted hover:text-ui-fg-subtle focus-visible:shadow-borders-focus inline-flex size-6 shrink-0 items-center justify-center rounded-full outline-none"
      >
        <InformationCircle />
      </button>
    </Popover.Trigger>
    <Popover.Content align="start" className="z-50 w-72 p-3">
      <Text size="small">{text}</Text>
    </Popover.Content>
  </Popover>
);

/**
 * Řádek: popisek (+ jedna věta) vlevo, ovládání vpravo. `children` jsou pod
 * řádkem přes celou šířku (např. zpráva pro zákazníka po zapnutí přepínače).
 */
export const InspectorRow = ({
  label,
  hint,
  info,
  control,
  htmlFor,
  id,
  children,
}: {
  label: string;
  hint?: ReactNode;
  info?: string;
  control?: ReactNode;
  /** Kliknutí na popisek ovládá prvek s tímhle id (přepínač). */
  htmlFor?: string;
  /** Kotva pro skok z karty „Připraveno k prodeji". */
  id?: string;
  children?: ReactNode;
}) => (
  <div id={id} className="scroll-mt-24 px-3 py-2.5">
    <div className="flex min-h-[32px] items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {htmlFor ? (
            <label htmlFor={htmlFor} className="cursor-pointer">
              <Text size="small" weight="plus" as="span">
                {label}
              </Text>
            </label>
          ) : (
            <Text size="small" weight="plus">
              {label}
            </Text>
          )}
          {info ? <InfoTip text={info} label={label} /> : null}
        </div>
        {hint ? (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {hint}
          </Text>
        ) : null}
      </div>
      {/* shrink-0: dlouhý popisek nesmí přepínač zmáčknout (Dobírka, 17. 11.). */}
      {control ? <div className="shrink-0">{control}</div> : null}
    </div>
    {children ? <div className="mt-2">{children}</div> : null}
  </div>
);

/** Řádek s přepínačem — klik na popisek přepíná taky, „i" ne. */
export const InspectorSwitchRow = ({
  label,
  hint,
  info,
  checked,
  onChange,
  disabled,
  id,
  children,
}: {
  label: string;
  hint?: ReactNode;
  info?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
  children?: ReactNode;
}) => {
  const switchId = useId();
  return (
    <InspectorRow
      label={label}
      hint={hint}
      info={info}
      htmlFor={switchId}
      id={id}
      control={
        <Switch
          id={switchId}
          className="shrink-0"
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      }
    >
      {children}
    </InspectorRow>
  );
};

/**
 * Číslo s jednotkou UVNITŘ pole („890 Kč", „450 g") — stejné chování jako
 * InlineNumber z inline-field.tsx (opuštění pole uloží, Enter taky, beze
 * změny se nic nezapisuje, po uložení se pole srovná s uloženou hodnotou),
 * jen jednotka nestojí vedle pole, kde v úzkém sloupci odskakovala.
 */
export const InlineAmount = ({
  value,
  onSave,
  unit,
  placeholder,
  allowEmpty = true,
  min = 0,
  widthClassName = "w-28",
}: {
  value: number | null | undefined;
  onSave: (next: number | null) => Promise<unknown>;
  unit: string;
  placeholder?: string;
  allowEmpty?: boolean;
  min?: number;
  widthClassName?: string;
}) => {
  const asText = (input: number | null | undefined) =>
    input === null || input === undefined ? "" : String(input);
  const [draft, setDraft] = useState(asText(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(asText(value));
  }, [value]);

  const run = async (next: number | null) => {
    setSaving(true);
    try {
      await onSave(next);
    } catch {
      // Chybu už ukázala mutace volajícího.
      setDraft(asText(value));
    } finally {
      setSaving(false);
    }
  };

  const commit = async () => {
    const trimmed = draft.trim().replace(",", ".");
    if (trimmed === asText(value)) return;
    if (!trimmed) {
      if (!allowEmpty) {
        setDraft(asText(value));
        toast.error("Tohle pole nemůže zůstat prázdné.");
        return;
      }
      await run(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < min) {
      setDraft(asText(value));
      toast.error("Zadejte prosím kladné číslo.");
      return;
    }
    await run(parsed);
  };

  return (
    <div className={`relative ${widthClassName}`}>
      <Input
        size="small"
        type="number"
        min={min}
        value={draft}
        placeholder={placeholder}
        className="pr-9 tabular-nums"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          // Esc vrátí rozepsané číslo zpátky na uložené.
          if (event.key === "Escape") {
            setDraft(asText(value));
            event.currentTarget.blur();
          }
        }}
        disabled={saving}
      />
      <span className="text-ui-fg-muted txt-compact-small pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
        {unit}
      </span>
    </div>
  );
};
