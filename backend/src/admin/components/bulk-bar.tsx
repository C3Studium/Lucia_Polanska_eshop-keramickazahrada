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
  layout = "inline",
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
  /**
   * „inline" = vše v jednom řádku (objednávky, pár akcí). „stacked" = nahoře
   * počet a potvrzení, pod tím skupiny ovladačů — pro seznamy, kde se hromadně
   * nastavuje víc vlastností (Produkty+).
   */
  layout?: "inline" | "stacked";
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

  const frame = clx(
    "sticky bottom-3 z-20 mx-4 mb-3 mt-2 rounded-lg border px-3 py-2.5",
    "border-ui-border-interactive bg-ui-bg-base shadow-elevation-card-rest",
    "transition-transform duration-150 ease-out motion-reduce:transition-none",
    shown ? "translate-y-0" : "translate-y-3"
  );

  /*
   * Dvě patra: nahoře co je vybrané a co s tím (Zrušit výběr · Potvrdit),
   * dole ovladače ve skupinách. U šesti vlastností v jednom řádku se
   * „Potvrdit" ztrácelo mezi přepínači; takhle stojí vždy na stejném místě.
   * „Zrušit výběr" zůstává i s rozpracovanou změnou — výběr a změny jsou
   * dvě různé věci (zrušený výběr změny nechá v řádcích k potvrzení).
   */
  if (layout === "stacked") {
    /*
     * 19. 11. 2026 (Matěj: „lišta je hrozná, chce aspoň Uložit vše"):
     * „Uložit vše" stojí vpravo nahoře VŽDY — bez změn je jen neaktivní,
     * takže je pořád jasné, kde se ukládá. Pod ovladači jedna věta, co
     * lišta dělá. Lišta sama se ukazuje až od 2 vybraných (Produkty+).
     */
    const kusu = count === 1 ? "výrobek" : count >= 2 && count <= 4 ? "výrobky" : "výrobků";
    return (
      <div role="region" aria-label={`Hromadná úprava, vybráno ${count}`} className={frame}>
        {/* Jako dialog: vlevo co se upravuje, vpravo vždy Zrušit · Uložit vše.
            Zrušit zahodí rozpracované změny a zavře lištu (zruší výběr). */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Text size="small" weight="plus" className="shrink-0">
            Hromadně: {count} {kusu}
          </Text>
          {onConfirm && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                size="small"
                variant="secondary"
                disabled={isSaving}
                onClick={() => {
                  if (hasPending) onDiscard?.();
                  onClear();
                }}
              >
                Zrušit
              </Button>
              <Button
                size="small"
                variant={hasPending ? "primary" : "secondary"}
                disabled={!hasPending}
                isLoading={isSaving}
                onClick={onConfirm}
              >
                {hasPending ? `Uložit vše (${pendingCount})` : "Uložit vše"}
              </Button>
            </div>
          )}
        </div>
        <div className="border-ui-border-base mt-2 flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-2.5">
          {children}
        </div>
        <Text size="xsmall" className="text-ui-fg-muted mt-2">
          {hasPending
            ? `Změněno u ${pendingCount} ${pendingCount === 1 ? "výrobku" : "výrobků"} — uloží se všechny najednou tlačítkem Uložit vše.`
            : "Nastavte, co chcete změnit u všech vybraných, a dejte Uložit vše. Zobrazit / skrýt platí hned."}
        </Text>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={`Hromadná úprava, vybráno ${count}`}
      className={frame}
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
  applyLabel,
  onSet,
}: {
  label: string;
  unit?: string;
  /**
   * Text tlačítka vedle pole („Použít"). Zapisuje i opuštění pole a Enter;
   * tlačítko je tu pro ruku na myši, která čeká, že se číslo někam „pošle".
   */
  applyLabel?: string;
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
      {applyLabel && (
        <Button
          size="small"
          variant="secondary"
          type="button"
          disabled={disabled || draft.trim() === (mixed ? "" : asText(value))}
          onClick={commit}
        >
          {applyLabel}
        </Button>
      )}
    </label>
  );
};

/**
 * Hodnota textové vlastnosti napříč výběrem: shodná, nebo `"mixed"`.
 * Totéž co `sharedNumberOf`, jen pro volbu z pevného seznamu.
 */
export const sharedValueOf = <T, V extends string>(
  items: T[],
  read: (item: T) => V
): { kind: "same"; value: V | null } | { kind: "mixed" } => {
  if (items.length === 0) {
    return { kind: "same", value: null };
  }
  const first = read(items[0]);
  return items.every((item) => read(item) === first)
    ? { kind: "same", value: first }
    : { kind: "mixed" };
};

/**
 * Volba z pevného seznamu pro celý výběr (velikost zásilky).
 *
 * Výběr jde do rozpracovaných změn jako přepínače a balné — uloží se až
 * Potvrdit. U různých hodnot stojí v poli „různé" a nic se nemění, dokud
 * se nevybere konkrétní možnost.
 */
export const BulkChoice = <V extends string>({
  label,
  title,
  options,
  value,
  mixed = false,
  dirty = false,
  disabled = false,
  onSet,
}: {
  label: string;
  title?: string;
  options: { value: V; label: string }[];
  value: V | null;
  mixed?: boolean;
  dirty?: boolean;
  disabled?: boolean;
  onSet: (next: V) => void;
}) => (
  <label
    className={clx(
      "flex shrink-0 items-center gap-1.5",
      disabled && "cursor-not-allowed opacity-50"
    )}
    title={title}
  >
    <Text
      size="xsmall"
      className={dirty ? "text-ui-fg-base font-medium" : "text-ui-fg-subtle"}
    >
      {label}
    </Text>
    <select
      disabled={disabled}
      aria-label={`${label} u všech vybraných kusů`}
      value={mixed || value === null ? "" : value}
      onChange={(event) => {
        const next = options.find((option) => option.value === event.target.value);
        if (next) onSet(next.value);
      }}
      className={clx(
        "border-ui-border-base bg-ui-bg-field txt-compact-xsmall rounded-md border px-2 py-1",
        dirty && "border-ui-tag-orange-border"
      )}
    >
      {(mixed || value === null) && (
        <option value="" disabled>
          {mixed ? "různé" : "—"}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

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

/**
 * Skupina ovladačů v liště (Doprava, Obchod) — popisek a za ním ovladače.
 * Skupiny dělí svislá čára, aby se dlouhá lišta četla po kouscích.
 */
export const BulkGroup = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div
    role="group"
    aria-label={label}
    className="border-ui-border-base flex flex-wrap items-center gap-x-4 gap-y-2 sm:border-l sm:pl-5 sm:first:border-l-0 sm:first:pl-0"
  >
    <Text size="xsmall" weight="plus" className="text-ui-fg-muted w-full uppercase sm:w-auto">
      {label}
    </Text>
    {children}
  </div>
);

/**
 * Volba z pár možností jako spojená tlačítka (Dobírka Ano | Ne,
 * Zásilka Malé | Velké).
 *
 * Proč ne přepínač: u výběru je běžné „různé" a přepínač ho neumí ukázat
 * jinak než slovem vedle. Tady je to vidět rovnou — není stisknuté nic —
 * a klik nastaví konkrétní hodnotu, ne „opak". Jde do rozpracovaných změn
 * jako ostatní ovladače lišty, uloží se až Potvrdit.
 */
export const BulkSegmented = <V extends string>({
  label,
  title,
  options,
  value,
  dirty = false,
  disabled = false,
  onSet,
}: {
  label: string;
  title?: string;
  options: { value: V; label: string }[];
  /** Shodná hodnota výběru; `null` = vybrané kusy ji mají různě. */
  value: V | null;
  dirty?: boolean;
  disabled?: boolean;
  onSet: (next: V) => void;
}) => (
  <div
    className={clx("flex shrink-0 items-center gap-1.5", disabled && "opacity-50")}
    title={title}
  >
    <Text
      size="xsmall"
      className={dirty ? "text-ui-fg-base font-medium" : "text-ui-fg-subtle"}
    >
      {label}
    </Text>
    <div
      role="group"
      aria-label={`${label} u všech vybraných kusů`}
      className={clx(
        "bg-ui-bg-subtle flex rounded-md border p-0.5",
        dirty ? "border-ui-tag-orange-border" : "border-ui-border-base"
      )}
    >
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={pressed}
            onClick={() => onSet(option.value)}
            className={clx(
              "txt-compact-xsmall min-h-[28px] rounded px-2.5 outline-none transition-fg focus-visible:shadow-borders-focus",
              pressed
                ? "bg-ui-bg-base text-ui-fg-base shadow-borders-base font-medium"
                : "text-ui-fg-subtle hover:text-ui-fg-base"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
    {value === null && (
      <Text size="xsmall" className="text-ui-fg-muted">
        různé
      </Text>
    )}
  </div>
);
