/**
 * Malé náčrtky k volbám, které se slovy špatně vysvětlují (19. 11. 2026,
 * Matěj: „všechno musí být jasné — dej tam malé sketche"). Kreslí se jen
 * `currentColor` a barvy se berou z textových tříd Medusy, takže sedí ve
 * světlém i tmavém režimu. Výrobek = květináček (je to keramika).
 *
 * Náčrtky jsou ozdoba k textu, ne místo něj: `aria-hidden`, význam nese
 * popisek vedle.
 */

/** Výška 48 px, pokud volající nedá vlastní `h-*`. */
const svgClass = (extra: string) =>
  `w-auto ${/(^|\s)h-/.test(extra) ? "" : "h-12 "}${extra}`;

const Pot =({ x, y, ghost = false }: { x: number; y: number; ghost?: boolean }) => (
  <g transform={`translate(${x} ${y})`} opacity={ghost ? 0.45 : 1}>
    <rect
      x={0}
      y={0}
      width={18}
      height={4}
      rx={1.5}
      fill={ghost ? "none" : "currentColor"}
      stroke="currentColor"
      strokeWidth={1.2}
      strokeDasharray={ghost ? "2 2" : undefined}
    />
    <path
      d="M2 5 H16 L14 16 H4 Z"
      fill={ghost ? "none" : "currentColor"}
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinejoin="round"
      strokeDasharray={ghost ? "2 2" : undefined}
    />
  </g>
);

/** Krabička = kolekce/kategorie v obchodě. */
const Shelf = ({ x, label, strong = false }: { x: number; label: string; strong?: boolean }) => (
  <g className={strong ? "text-ui-fg-interactive" : "text-ui-fg-muted"}>
    <rect x={x} y={10} width={58} height={38} rx={7} fill="none" stroke="currentColor" strokeWidth={strong ? 1.6 : 1.2} />
    <text x={x + 29} y={7} textAnchor="middle" fontSize={8} fill="currentColor" fontFamily="inherit">
      {label}
    </text>
  </g>
);

const Arrow = ({ x1, x2, y }: { x1: number; x2: number; y: number }) => (
  <g className="text-ui-fg-interactive">
    <path d={`M${x1} ${y} H${x2 - 2}`} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    <path d={`M${x2 - 6} ${y - 4} L${x2} ${y} L${x2 - 6} ${y + 4}`} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

/** „Přesunout sem": z původního místa zmizí, je jen v novém. */
export const SketchMove = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 160 52" className={svgClass(className)} aria-hidden>
    <Shelf x={2} label="teď" />
    <g className="text-ui-fg-muted">
      <Pot x={22} y={22} ghost />
      <path d="M18 20 L44 46 M44 20 L18 46" stroke="currentColor" strokeWidth={1} opacity={0.5} />
    </g>
    <Arrow x1={66} x2={94} y={29} />
    <Shelf x={100} label="sem" strong />
    <g className="text-ui-fg-interactive">
      <Pot x={120} y={22} />
    </g>
  </svg>
);

/** „Přidat i sem": zůstane, kde je, a objeví se i v novém. */
export const SketchAdd = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 160 52" className={svgClass(className)} aria-hidden>
    <Shelf x={2} label="teď" />
    <g className="text-ui-fg-subtle">
      <Pot x={22} y={22} />
    </g>
    <Arrow x1={66} x2={94} y={29} />
    <Shelf x={100} label="i sem" strong />
    <g className="text-ui-fg-interactive">
      <Pot x={120} y={22} />
      <text x={146} y={24} fontSize={11} fontWeight={600} fill="currentColor">
        +
      </text>
    </g>
  </svg>
);

/** Výprodej „Na čas": sleva platí mezi dvěma daty, pak se cena vrátí. */
export const SketchTimed = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 160 52" className={svgClass(className)} aria-hidden>
    <g className="text-ui-fg-muted">
      {/* běžná cena před a po */}
      <path d="M4 14 H40 M120 14 H156" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M40 14 V30 M120 30 V14" stroke="currentColor" strokeWidth={1} strokeDasharray="2 2" />
      <path d="M40 44 V48 M120 44 V48" stroke="currentColor" strokeWidth={1.2} />
      <path d="M4 46 H156" stroke="currentColor" strokeWidth={1} />
      <text x={40} y={40} textAnchor="middle" fontSize={8} fill="currentColor">od</text>
      <text x={120} y={40} textAnchor="middle" fontSize={8} fill="currentColor">do</text>
    </g>
    <g className="text-ui-tag-green-icon">
      <path d="M40 30 H120" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <text x={80} y={25} textAnchor="middle" fontSize={9} fontWeight={600} fill="currentColor">
        −20 %
      </text>
    </g>
  </svg>
);

/** Výprodej „Do vyprodání": kusy ubývají, s posledním výprodej končí. */
export const SketchUntilSold = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 160 52" className={svgClass(className)} aria-hidden>
    <g className="text-ui-tag-green-icon">
      <Pot x={2} y={18} />
      <Pot x={22} y={18} />
      <Pot x={42} y={18} />
    </g>
    <g className="text-ui-fg-muted">
      <path d="M66 26 H78" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M75 23 L78 26 L75 29" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      <Pot x={84} y={18} ghost />
      <path d="M108 26 H120" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M117 23 L120 26 L117 29" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      <text x={20} y={48} textAnchor="middle" fontSize={8} fill="currentColor">3 ks</text>
      <text x={93} y={48} textAnchor="middle" fontSize={8} fill="currentColor">0 ks</text>
    </g>
    <g className="text-ui-fg-subtle">
      <text x={142} y={30} textAnchor="middle" fontSize={9} fontWeight={600} fill="currentColor">
        konec
      </text>
    </g>
  </svg>
);

/**
 * Pořadí slev jako tři schody: platí vždy jen ta nejvyšší, co se na kus
 * vztahuje. Jedna komponenta pro stránku Slevy i detail výrobku.
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
