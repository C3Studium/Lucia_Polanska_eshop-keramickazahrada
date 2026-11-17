import { PencilSquare } from "@medusajs/icons";
import { Button, Popover, Switch, Text, clx } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { SHIPPING_CLASS_OPTIONS, shippingClassLabel } from "./product-row-more";
import type { ShippingClass } from "../../lib/shipping-rates";

/**
 * Sloupec „Doprava" v Produkty+ — jeden řádek tichých štítků a okénko
 * s nastavením (17. 11. 2026).
 *
 * ## Proč štítky místo čtyř ovladačů
 *
 * Balné, dobírka, křehké a velikost zásilky stály v řádku pod sebou jako malá
 * tabulka s přepínači. Šlo to měnit rovnou, ale každý řádek měl přes 160 px
 * a seznam o padesáti kusech se nedal přehlédnout. Matěj: „možnosti ať tam
 * jsou, ale jednodušeji". V řádku je teď jen shrnutí (`Balné 49 Kč` `Malé`
 * `Dobírka` `Křehké`) a klik na něj otevře okénko se stejnými ovladači.
 * Hromadně se totéž mění v liště výběru dole.
 *
 * ## Ukládání se nemění
 *
 * Okénko jen rozpracovává — přesně jako dřív ovladače v řádku. Uloží se
 * tlačítkem Uložit v okénku, Potvrdit pod řádkem nebo Potvrdit vše nahoře,
 * vždy přes tutéž cestu (`applyFlags` na stránce) s „Vrátit zpět". Okénko
 * zavřené klikem vedle změny nezahodí: řádek je ukáže oranžově a nabídne
 * Potvrdit / Zrušit.
 */

type FlagKey = "cod_allowed" | "fragile";

export type ShippingValues = {
  packaging: number | null;
  codAllowed: boolean;
  fragile: boolean;
  shippingClass: ShippingClass;
};

export type ShippingDirty = {
  packaging: boolean;
  codAllowed: boolean;
  fragile: boolean;
  shippingClass: boolean;
};

/** Malý štítek; rozpracovaná hodnota oranžově, jako dřív celý řádek. */
const Chip = ({ children, dirty }: { children: React.ReactNode; dirty: boolean }) => (
  <span
    className={clx(
      "txt-compact-xsmall inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-md border px-1.5",
      dirty
        ? "border-ui-tag-orange-border bg-ui-tag-orange-bg text-ui-tag-orange-text font-medium"
        : "border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle"
    )}
  >
    {children}
  </span>
);

const formatKc = (value: number) =>
  `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} Kč`;

/** Shrnutí do štítků — sdílí ho řádek i (do budoucna) další pohledy. */
export const ShippingChips = ({
  values,
  dirty,
}: {
  values: ShippingValues;
  dirty: ShippingDirty;
}) => (
  <span className="flex flex-wrap items-center gap-1">
    <Chip dirty={dirty.packaging}>
      {values.packaging ? `Balné ${formatKc(values.packaging)}` : "Bez balného"}
    </Chip>
    <Chip dirty={dirty.shippingClass}>{shippingClassLabel(values.shippingClass)}</Chip>
    <Chip dirty={dirty.codAllowed}>{values.codAllowed ? "Dobírka" : "Bez dobírky"}</Chip>
    {/* Křehké jen když platí — „nekřehké" je běžný stav a nemá co hlásit.
        Rozpracované vypnutí ale vidět být musí. */}
    {(values.fragile || dirty.fragile) && (
      <Chip dirty={dirty.fragile}>{values.fragile ? "Křehké" : "Ne křehké"}</Chip>
    )}
  </span>
);

const lineClass = (dirty: boolean) =>
  clx(
    "flex min-h-[40px] items-center justify-between gap-4 rounded-md px-2",
    dirty && "bg-ui-tag-orange-bg"
  );
const lineLabel = (dirty: boolean) =>
  dirty ? "text-ui-fg-base font-medium" : "text-ui-fg-subtle";

/**
 * Balné [cena]. Píše se do rozpracovaných změn při opuštění pole nebo Enteru.
 * Prázdné = bez ceny balení (zákazník uvidí „Balné 0,-").
 */
const PackagingInput = ({
  value,
  dirty,
  onChange,
}: {
  value: number | null;
  dirty: boolean;
  onChange: (value: number | null) => void;
}) => {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") return onChange(null);
    const parsed = Number(trimmed.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) onChange(Math.round(parsed * 100) / 100);
    else setDraft(value === null ? "" : String(value));
  };
  return (
    <label
      className={lineClass(dirty)}
      title="Cena balení za kus — zákazník ji uvidí jako „Balné“ pod výrobkem."
    >
      <Text size="small" className={lineLabel(dirty)}>
        Balné
      </Text>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          inputMode="decimal"
          placeholder="0"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          }}
          className={clx(
            "border-ui-border-base bg-ui-bg-field txt-compact-small h-8 w-20 rounded-md border px-2 text-right",
            dirty && "border-ui-tag-orange-border"
          )}
        />
        <Text size="small" className="text-ui-fg-subtle">
          Kč
        </Text>
      </span>
    </label>
  );
};

const FlagLine = ({
  label,
  hint,
  checked,
  dirty,
  onFlip,
}: {
  label: string;
  hint: string;
  checked: boolean;
  dirty: boolean;
  onFlip: () => void;
}) => (
  <label className={clx(lineClass(dirty), "cursor-pointer py-1.5")}>
    <span className="min-w-0">
      <Text size="small" className={lineLabel(dirty)}>
        {label}
      </Text>
      <Text size="xsmall" className="text-ui-fg-muted">
        {hint}
      </Text>
    </span>
    <Switch checked={checked} onCheckedChange={onFlip} aria-label={label} />
  </label>
);

export const ProductShippingCell = ({
  productTitle,
  values,
  dirty,
  open,
  onOpenChange,
  onPackaging,
  onFlip,
  onShippingClass,
  hasPending,
  isSaving,
  onSave,
  onDiscard,
}: {
  productTitle: string;
  /** Hodnoty, jak je vidí řádek — včetně rozpracovaných. */
  values: ShippingValues;
  dirty: ShippingDirty;
  /** Řízené otevření — otevírá ho i „Upravit balné a dopravu" v „…". */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPackaging: (value: number | null) => void;
  onFlip: (key: FlagKey) => void;
  onShippingClass: (value: ShippingClass) => void;
  /** Řádek má rozpracovanou změnu — Uložit má co uložit. */
  hasPending: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) => (
  <Popover open={open} onOpenChange={onOpenChange}>
    <Popover.Trigger asChild>
      {/* Nad překryvem řádku: klik na štítky otevře okénko, ne produkt. */}
      <button
        type="button"
        title="Upravit balné a dopravu"
        aria-label={`Upravit balné a dopravu — ${productTitle}`}
        className="group/doprava hover:bg-ui-bg-base-hover focus-visible:shadow-borders-focus relative z-10 -mx-1.5 flex min-h-[32px] max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left outline-none transition-colors"
      >
        <ShippingChips values={values} dirty={dirty} />
        <span className="text-ui-fg-muted shrink-0 opacity-0 transition-opacity group-hover/doprava:opacity-100 group-focus-visible/doprava:opacity-100">
          <PencilSquare />
        </span>
      </button>
    </Popover.Trigger>
    <Popover.Content align="start" className="z-50 w-[320px] p-0">
      <div className="border-ui-border-base border-b px-4 py-3">
        <Text size="small" weight="plus">
          Balné a doprava
        </Text>
        <Text size="xsmall" className="text-ui-fg-subtle truncate">
          {productTitle}
        </Text>
      </div>

      <div className="flex flex-col gap-1 p-2">
        <PackagingInput value={values.packaging} dirty={dirty.packaging} onChange={onPackaging} />
        <FlagLine
          label="Dobírka"
          hint="Platba při převzetí — jen ČR a Česká pošta na adresu."
          checked={values.codAllowed}
          dirty={dirty.codAllowed}
          onFlip={() => onFlip("cod_allowed")}
        />
        <FlagLine
          label="Křehké"
          hint="Celá zásilka pojede jako křehká, nebo osobní odběr."
          checked={values.fragile}
          dirty={dirty.fragile}
          onFlip={() => onFlip("fragile")}
        />
        <div className={clx("flex flex-col gap-1.5 rounded-md px-2 py-2", dirty.shippingClass && "bg-ui-tag-orange-bg")}>
          <Text size="small" className={lineLabel(dirty.shippingClass)}>
            Velikost zásilky
          </Text>
          <div role="radiogroup" aria-label="Velikost zásilky" className="grid grid-cols-3 gap-1.5">
            {SHIPPING_CLASS_OPTIONS.map((option) => {
              const active = option.value === values.shippingClass;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={option.hint}
                  onClick={() => onShippingClass(option.value)}
                  className={clx(
                    "txt-compact-small min-h-[36px] rounded-md border px-2 outline-none transition-fg focus-visible:shadow-borders-focus",
                    active
                      ? "border-ui-border-interactive bg-ui-bg-base-pressed text-ui-fg-base font-medium"
                      : "border-ui-border-base bg-ui-bg-base text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <Text size="xsmall" className="text-ui-fg-muted">
            Podle ní se v pokladně počítá poštovné.
          </Text>
        </div>
      </div>

      <div className="border-ui-border-base flex items-center justify-end gap-2 border-t px-4 py-3">
        {hasPending ? (
          <>
            <Button size="small" variant="transparent" disabled={isSaving} onClick={onDiscard}>
              Zrušit změny
            </Button>
            <Button size="small" isLoading={isSaving} onClick={onSave}>
              Uložit
            </Button>
          </>
        ) : (
          <Button size="small" variant="secondary" onClick={() => onOpenChange(false)}>
            Zavřít
          </Button>
        )}
      </div>
    </Popover.Content>
  </Popover>
);
