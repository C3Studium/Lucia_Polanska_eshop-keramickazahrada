import { Button, Switch, Text, clx } from "@medusajs/ui";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Hromadná úprava — jedna lišta pro všechny seznamy (admin-ux-spec §2).
 *
 * ## Proč vznikla
 *
 * Produkty+ měly hromadné nastavení jako **dvojici tlačítek na vlastnost** —
 * „Dobírka zapnout", „Dobírka vypnout", „Křehké zapnout", „Křehké vypnout" —
 * a klik odesílal okamžitě. U pěti vlastností to je deset tlačítek, deset
 * nevratných akcí a žádné místo, kde si rozmyslet celek. Vedle toho běžel na
 * téže stránce druhý model: rozpracované změny v řádku s „Potvrdit vše".
 * Dva způsoby ukládání v jednom okně.
 *
 * Tahle lišta je ten druhý model, dotažený: **jeden ovladač na vlastnost**,
 * nic se neodešle bez potvrzení, a počet v tlačítku pořád říká, kolika kusů
 * se to týká.
 *
 * ## Pravidlo, na kterém to stojí
 *
 * Uvnitř jednoho kusu se ukládá samo. V seznamu, kde jedna změna sáhne na
 * dvanáct kusů naráz, se potvrzuje. Lišta je ta druhá polovina pravidla.
 *
 * ## Umístění
 *
 * `sticky bottom` místo `fixed`: admin má vlastní postranní panel a lišta
 * přes celou šířku okna by se mu schovala pod něj. Takhle sedí v obsahu
 * stránky, drží se u dolní hrany při rolování dlouhého seznamu a nikam se
 * nevejde křivě.
 */

/** Stav vlastnosti napříč výběrem. „mixed" = vybrané kusy ji mají různě. */
export type TriState = "on" | "off" | "mixed";

/**
 * Spočítá stav vlastnosti přes vybrané položky.
 *
 * Prázdný výběr vrací „off", ne „mixed" — lišta se stejně nevykreslí a
 * „různé" u nuly položek by byla lež.
 */
export const triStateOf = <T,>(
  items: T[],
  read: (item: T) => boolean
): TriState => {
  if (items.length === 0) {
    return "off";
  }
  const first = read(items[0]);
  return items.every((item) => read(item) === first)
    ? first
      ? "on"
      : "off"
    : "mixed";
};

/**
 * Hodnota čísla napříč výběrem: shodná hodnota, nebo `"mixed"`.
 *
 * `null` je plnohodnotná hodnota (balné 0,-), takže se musí odlišit od
 * „neshodují se" — proto zvláštní návratový typ, ne jen `number | null`.
 */
export const sharedNumberOf = <T,>(
  items: T[],
  read: (item: T) => number | null
): { kind: "same"; value: number | null } | { kind: "mixed" } => {
  if (items.length === 0) {
    return { kind: "same", value: null };
  }
  const first = read(items[0]);
  return items.every((item) => read(item) === first)
    ? { kind: "same", value: first }
    : { kind: "mixed" };
};

export const BulkBar = ({
  count,
  onClear,
  pendingCount = 0,
  onConfirm,
  onDiscard,
  isSaving = false,
  children,
}: {
  /** Kolik řádků je vybráno. Lišta se vykresluje jen když je to > 0. */
  count: number;
  onClear: () => void;
  /** Kolik vybraných má rozpracovanou změnu. 0 = Potvrdit se nenabízí. */
  pendingCount?: number;
  onConfirm?: () => void;
  onDiscard?: () => void;
  isSaving?: boolean;
  /** Ovladače vlastností a akce — `BulkSwitch`, `BulkNumber`, `BulkAction`. */
  children: ReactNode;
}) => {
  /* Vysunutí zespodu. Lištu vykresluje rodič podmíněně, takže připojení
     komponenty = okamžik, kdy se má objevit. */
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const hasPending = pendingCount > 0 && Boolean(onConfirm);

  return (
    <div
      role="region"
      aria-label={`Hromadná úprava, vybráno ${count}`}
      className={clx(
        "sticky bottom-3 z-20 mx-4 mb-3 mt-2 rounded-lg border px-3 py-2.5",
        "border-ui-border-interactive bg-ui-bg-base shadow-elevation-card-rest",
        "transition-transform duration-150 ease-out motion-reduce:transition-none",
        shown ? "translate-y-0" : "translate-y-3"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Text size="small" weight="plus" className="shrink-0">
          Vybráno: {count}
        </Text>

        {children}

        {/* Potvrzení drží konec řádku; na úzkém displeji si vezme vlastní
            řádek, aby se „Potvrdit" nikdy nezalomilo pryč z dohledu. */}
        <div className="ml-auto flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
          <Button
            size="small"
            variant="transparent"
            disabled={isSaving}
            onClick={hasPending ? onDiscard : onClear}
          >
            {hasPending ? "Zahodit změny" : "Zrušit výběr"}
          </Button>
          {hasPending && (
            <Button size="small" isLoading={isSaving} onClick={onConfirm}>
              Potvrdit ({pendingCount})
            </Button>
          )}
        </div>
      </div>

      {hasPending && (
        <Text size="xsmall" className="text-ui-fg-muted mt-1.5">
          Změna se uloží u všech vybraných kusů naráz.
        </Text>
      )}
    </div>
  );
};

/**
 * Přepínač vlastnosti pro celý výběr.
 *
 * Tři stavy, dvě cesty: ze „zapnuto" se vypne, z „vypnuto" i z „různé" se
 * zapne. Z „různé" tedy první klik srovná výběr na zapnuto a druhý na
 * vypnuto — pořád jediný ovladač, ne dvojice tlačítek.
 *
 * Medusa `Switch` neumí nedourčený stav, takže „různé" nese slovo vedle
 * přepínače. Je to zároveň jediná podoba, kterou pozná i čtečka obrazovky,
 * a netechnickému člověku řekne víc než půlka vybarveného kolečka.
 */
export const BulkSwitch = ({
  label,
  title,
  state,
  dirty = false,
  disabled = false,
  onSet,
}: {
  label: string;
  /** Co se tím zapne, větou — stejná nápověda jako v řádku. */
  title?: string;
  state: TriState;
  /** Rozpracováno: hodnota se liší od uloženého stavu. */
  dirty?: boolean;
  disabled?: boolean;
  onSet: (next: boolean) => void;
}) => {
  const next = state !== "on";
  const accessibleLabel =
    state === "mixed"
      ? `${label} — u vybraných kusů se liší, kliknutím zapnete všem`
      : `${label} — ${state === "on" ? "zapnuto" : "vypnuto"} u všech vybraných`;

  return (
    <label
      className={clx(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1",
        dirty && "bg-ui-tag-orange-bg",
        disabled && "cursor-not-allowed opacity-50"
      )}
      title={title}
    >
      <Switch
        size="small"
        checked={state === "on"}
        disabled={disabled}
        aria-label={accessibleLabel}
        className={state === "mixed" ? "opacity-60" : undefined}
        onCheckedChange={() => onSet(next)}
      />
      <Text
        size="xsmall"
        className={dirty ? "text-ui-fg-base font-medium" : "text-ui-fg-subtle"}
      >
        {label}
      </Text>
      {state === "mixed" && (
        <Text size="xsmall" className="text-ui-fg-muted">
          různé
        </Text>
      )}
    </label>
  );
};

/**
 * Číselná vlastnost pro celý výběr (balné).
 *
 * Píše se lokálně, zapisuje se do rozpracovaných změn při opuštění pole —
 * tedy přesně jako totéž pole v řádku. Prázdné pole je platná hodnota
 * („Balné 0,-"), ne „nevyplněno", takže se ukládá jako `null`.
 */
export const BulkNumber = ({
  label,
  unit,
  value,
  mixed = false,
  dirty = false,
  disabled = false,
  onSet,
}: {
  label: string;
  unit?: string;
  value: number | null;
  /** Vybrané kusy mají různé hodnoty — pole zůstane prázdné s popiskem. */
  mixed?: boolean;
  dirty?: boolean;
  disabled?: boolean;
  onSet: (next: number | null) => void;
}) => {
  const asText = (next: number | null) => (next === null ? "" : String(next));
  const [draft, setDraft] = useState(mixed ? "" : asText(value));

  /* Po uložení i po změně výběru se pole srovná na to, co ve výběru
     doopravdy je — jinak by drželo číslo z minulého výběru. */
  useEffect(() => {
    setDraft(mixed ? "" : asText(value));
  }, [value, mixed]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      /* U různých hodnot prázdné pole znamená „nic jsem nezadala", ne
         „nastav všem nulu" — jinak by pouhé proklikání lištou přepsalo
         balné celému výběru. */
      if (!mixed) {
        onSet(null);
      }
      return;
    }
    const parsed = Number(trimmed.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSet(Math.round(parsed * 100) / 100);
    } else {
      setDraft(mixed ? "" : asText(value));
    }
  };

  return (
    <label
      className={clx(
        "flex shrink-0 items-center gap-1.5",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <Text
        size="xsmall"
        className={dirty ? "text-ui-fg-base font-medium" : "text-ui-fg-subtle"}
      >
        {label}
      </Text>
      <input
        type="number"
        min={0}
        inputMode="decimal"
        disabled={disabled}
        placeholder={mixed ? "různé" : "0"}
        aria-label={`${label} u všech vybraných kusů`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            (event.target as HTMLInputElement).blur();
          }
        }}
        className={clx(
          "border-ui-border-base bg-ui-bg-field txt-compact-xsmall w-20 rounded-md border px-2 py-1 text-right",
          dirty && "border-ui-tag-orange-border"
        )}
      />
      {unit && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {unit}
        </Text>
      )}
    </label>
  );
};

/**
 * Okamžitá akce nad výběrem — archivace, skrytí.
 *
 * Tahle tlačítka potvrzení nemají schválně: obojí je vratné a vrácení se
 * nabídne v hlášce hned po provedení. Dialog, který se odklikává pokaždé,
 * se přestane číst; nabídka „Vrátit zpět" přijde ve chvíli, kdy už je
 * omyl vidět.
 */
export const BulkAction = ({
  children,
  onClick,
  destructive = false,
  isLoading = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  destructive?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
}) => (
  <Button
    size="small"
    variant={destructive ? "danger" : "secondary"}
    isLoading={isLoading}
    disabled={disabled}
    onClick={onClick}
    className="shrink-0"
  >
    {children}
  </Button>
);
