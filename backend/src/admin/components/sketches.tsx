/**
 * Pořadí slev jako schody (19. 11. 2026). Náčrtky voleb (přesunout / přidat,
 * typ výprodeje) nahradily GIFy návodu pod otazníkem — Matěj: „radši GIF,
 * jak to funguje, než ikonky“.
 *
 * Platí vždy jen ta nejvyšší sleva, co se na kus vztahuje. Jedna komponenta
 * pro stránku Slevy i detail výrobku.
 */
export const DiscountOrder = ({ compact = false }: { compact?: boolean }) => {
  const steps = [
    { label: "Výprodej", note: "přebije všechno" },
    { label: "Sleva u výrobku", note: "platí, když není výprodej" },
    { label: "Slevové kódy", note: "jen na nezlevněné kusy" },
  ];
  return (
    <div className={`flex flex-col gap-1.5 ${compact ? "" : "max-w-md"}`} role="note" aria-label="Pořadí slev">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center gap-2" style={{ paddingLeft: `${index * 14}px` }}>
          <span className="bg-ui-bg-base shadow-borders-base txt-compact-xsmall-plus text-ui-fg-base inline-flex size-5 shrink-0 items-center justify-center rounded-full tabular-nums">
            {index + 1}
          </span>
          <span className="txt-compact-small-plus text-ui-fg-base">{step.label}</span>
          <span className="txt-compact-xsmall text-ui-fg-muted">— {step.note}</span>
        </div>
      ))}
    </div>
  );
};
