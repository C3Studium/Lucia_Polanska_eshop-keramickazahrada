import { useEffect, useRef } from "react";

/**
 * Zaškrtávátko pro výběr řádků v seznamech (Produkty+, Objednávky,
 * Rozdělení…) — větší políčko (20 px) a klikací plocha kolem (36 px).
 * Matěj 12. 10. 2026: původní 13px nativní políčko se špatně trefovalo,
 * hlavně na telefonu.
 *
 * Klik se nešíří dál — řádek objednávky je sám odkazem na detail a výběr
 * nesmí zároveň navigovat.
 */
export const SelectCheckbox = ({
  checked,
  indeterminate = false,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  /** Část vybraná (např. „Vybrat vše na stránce"). */
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  /** Pro čtečky — co se zaškrtnutím vybírá. */
  label?: string;
  className?: string;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <label
      className={`-m-2 inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md p-2 hover:bg-ui-bg-base-hover ${className ?? ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        ref={ref}
        type="checkbox"
        aria-label={label}
        className="size-5 cursor-pointer accent-[var(--fg-interactive,#3b82f6)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
};
