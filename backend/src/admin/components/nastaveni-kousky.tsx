import { Text } from "@medusajs/ui";
import type { ReactNode } from "react";

/*
 * Stavební kousky okna nastavení výrobku (19. 11. 2026) — sdílí je nabídka
 * „…" u jednoho kusu (product-row-more) i Hromadné změny (product-bulk-drawer),
 * aby obě okna vypadala a ovládala se stejně.
 *
 * Jsou mimo komponenty — jinak by je React při každém psaní vyměnil a pole
 * (Balné, Rozměry, ceny) by ztrácela fokus.
 */

/** Skupina s nadpisem verzálkami a kartou řádků (jako detail výrobku). */
export const Skupina = ({ nazev, popis, poznamka, children }: { nazev: string; popis?: string; poznamka?: string; children: ReactNode }) => (
  <section className="flex flex-col gap-1">
    <Text size="xsmall" weight="plus" className="text-ui-fg-muted px-1 uppercase tracking-wide">
      {nazev}
    </Text>
    {popis && (
      <Text size="xsmall" className="text-ui-fg-subtle -mt-0.5 px-1">
        {popis}
      </Text>
    )}
    <div className="bg-ui-bg-base shadow-borders-base divide-y rounded-lg">{children}</div>
    {poznamka && (
      <Text size="xsmall" className="text-ui-fg-subtle px-1">
        {poznamka}
      </Text>
    )}
  </section>
);

/** Řádek: název (+ „•" u změněného) a popis vlevo, ovládání vpravo. */
export const Radek = ({
  nazev,
  popis,
  zmeneno,
  children,
  pod,
}: {
  nazev: string;
  popis?: string;
  /** Rozpracovaná změna — za název přibude „•". */
  zmeneno?: boolean;
  children?: ReactNode;
  /** Obsah na celou šířku pod řádkem (zpráva, procenta slevy…). */
  pod?: ReactNode;
}) => (
  <div className="px-3 py-2">
    <div className="flex min-h-[28px] items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="txt-compact-small-plus text-ui-fg-base block">
          {nazev}
          {zmeneno ? " •" : ""}
        </span>
        {popis && <span className="txt-compact-xsmall text-ui-fg-subtle block">{popis}</span>}
      </span>
      {children}
    </div>
    {pod && <div className="mt-2">{pod}</div>}
  </div>
);

/** Řádek, který otevře další okno vedle nabídky (›). */
export const Otevrit = ({ aktivni, onToggle, nazev, popis }: { aktivni: boolean; onToggle: () => void; nazev: string; popis: string }) => (
  <button
    type="button"
    role="menuitem"
    aria-expanded={aktivni}
    onClick={onToggle}
    className={`flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${aktivni ? "bg-ui-bg-base-pressed" : "hover:bg-ui-bg-base-hover"}`}
  >
    <span className="min-w-0">
      <span className="txt-compact-small-plus text-ui-fg-base block">{nazev}</span>
      <span className="txt-compact-xsmall text-ui-fg-subtle block">{popis}</span>
    </span>
    <span className="text-ui-fg-muted shrink-0">{aktivni ? "‹" : "›"}</span>
  </button>
);

/** Volba z několika (Malé | Velké | Poukaz) — jedna hodnota. */
export const Volby = <T extends string>({ popisek, hodnota, moznosti, onVyber, vypnuto }: {
  popisek: string; hodnota: T; moznosti: { value: T; label: string }[]; onVyber: (v: T) => void; vypnuto?: boolean;
}) => (
  <div role="radiogroup" aria-label={popisek} className="bg-ui-bg-subtle flex shrink-0 flex-wrap rounded-md p-0.5">
    {moznosti.map((m) => (
      <button
        key={m.value}
        type="button"
        role="radio"
        aria-checked={hodnota === m.value}
        disabled={vypnuto}
        onClick={() => onVyber(m.value)}
        className={`txt-compact-xsmall-plus min-h-[30px] rounded px-2.5 disabled:opacity-60 ${hodnota === m.value ? "bg-ui-bg-base shadow-borders-base text-ui-fg-base" : "text-ui-fg-subtle hover:text-ui-fg-base"}`}
      >
        {m.label}
      </button>
    ))}
  </div>
);

/** Pole s jednotkou vpravo (Kč, %) ve stylu nabídky. */
export const poleTrida = (zmeneno: boolean, chyba = false) =>
  `bg-ui-bg-field txt-compact-small min-h-[32px] rounded-md border px-2 ${chyba ? "border-ui-border-error" : zmeneno ? "border-ui-border-interactive" : "border-ui-border-base"}`;
