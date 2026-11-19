import { XMark } from "@medusajs/icons";
import { Drawer, Heading } from "@medusajs/ui";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * Okno nastavení, které umí dvě podoby (19. 11. 2026, Matěj):
 *
 * - **boční panel** (výchozí) — přesně Medusa `Drawer`, jak ho okna
 *   používala dosud (detail výrobku, Produkty+ mimo nabídku);
 * - **vedle nabídky** (`inline`) — totéž okno se vykreslí jako obyčejný
 *   rámeček, který si nabídka „…" v řádku postaví vlevo vedle sebe.
 *   Nabídka zůstane otevřená, okno se nezavře samo; zavře ho Uložit,
 *   Zrušit nebo ×.
 *
 * API je stejné jako `Drawer` (Root/Trigger/Content/Header/Title/Body/
 * Footer/Close), takže okna se přepnou jen importem a dvěma vlastnostmi.
 * Dřív se okno z nabídky otevíralo skrytým tlačítkem a hned zase zavřelo:
 * nabídka po výběru vracela fokus na „…" a boční panel to bral jako klik
 * vedle.
 */

type Ctx = { inline: boolean; zavrit: () => void; zpet?: () => void };
const PanelCtx = createContext<Ctx>({ inline: false, zavrit: () => undefined });

/** Nabídka „…" na telefonu: okno je místo ní → „← Zpět do nabídky". */
export const PanelZpet = createContext<(() => void) | undefined>(undefined);

type RootProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Vykreslit vedle nabídky místo bočního panelu. */
  inline?: boolean;
  /** Okno vedle nabídky se zavřelo (Uložit, Zrušit, ×). */
  onClose?: () => void;
  /** Telefon: okno je místo nabídky — „← Zpět do nabídky" v hlavičce. */
  onBack?: () => void;
  children: ReactNode;
};

const Root = ({ open, onOpenChange, inline = false, onClose, onBack, children }: RootProps) => {
  const zpetZNabidky = useContext(PanelZpet);
  const bylo = useRef(Boolean(open));
  useEffect(() => {
    /* Okno samo nastaví open=false (po uložení) → dát vědět nabídce. */
    if (inline && bylo.current && !open) onClose?.();
    bylo.current = Boolean(open);
  }, [open, inline, onClose]);
  if (!inline) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    );
  }
  const zavrit = () => {
    onOpenChange?.(false);
    onClose?.();
  };
  return <PanelCtx.Provider value={{ inline: true, zavrit, zpet: onBack ?? zpetZNabidky }}>{children}</PanelCtx.Provider>;
};

const Trigger = ({ children, ...props }: { children: ReactNode; asChild?: boolean }) => {
  const { inline } = useContext(PanelCtx);
  if (inline) return null;
  return <Drawer.Trigger {...props}>{children}</Drawer.Trigger>;
};

const Content = ({ children, className, ...props }: { children: ReactNode; className?: string; [k: string]: unknown }) => {
  const { inline } = useContext(PanelCtx);
  if (!inline) return <Drawer.Content className={className} {...props}>{children}</Drawer.Content>;
  return (
    <div className="bg-ui-bg-base flex max-h-[min(78vh,720px)] w-[min(460px,calc(100vw-320px))] min-w-[320px] flex-col overflow-hidden">
      {children}
    </div>
  );
};

const Header = ({ children }: { children: ReactNode }) => {
  const { inline, zavrit, zpet } = useContext(PanelCtx);
  if (!inline) return <Drawer.Header>{children}</Drawer.Header>;
  return (
    <div className="border-ui-border-base flex items-start justify-between gap-3 border-b px-4 py-3">
      <div className="min-w-0">
        {zpet && (
          <button
            type="button"
            onClick={zpet}
            className="text-ui-fg-interactive txt-compact-small-plus -ml-1 mb-1 inline-flex min-h-[32px] items-center gap-1 rounded-md px-1 hover:underline"
          >
            ← Zpět do nabídky
          </button>
        )}
        {children}
      </div>
      <button
        type="button"
        aria-label="Zavřít"
        onClick={zavrit}
        className="text-ui-fg-muted hover:text-ui-fg-subtle hover:bg-ui-bg-base-hover -m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md"
      >
        <XMark />
      </button>
    </div>
  );
};

const Title = ({ children }: { children: ReactNode }) => {
  const { inline } = useContext(PanelCtx);
  if (!inline) return <Drawer.Title>{children}</Drawer.Title>;
  return <Heading level="h3">{children}</Heading>;
};

const Body = ({ children, className = "" }: { children: ReactNode; className?: string }) => {
  const { inline } = useContext(PanelCtx);
  if (!inline) return <Drawer.Body className={className}>{children}</Drawer.Body>;
  return <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 ${className}`}>{children}</div>;
};

const Footer = ({ children }: { children: ReactNode }) => {
  const { inline } = useContext(PanelCtx);
  if (!inline) return <Drawer.Footer>{children}</Drawer.Footer>;
  return <div className="border-ui-border-base flex items-center justify-end gap-2 border-t px-4 py-3">{children}</div>;
};

const Close = ({ children, asChild }: { children: ReactNode; asChild?: boolean }) => {
  const { inline, zavrit } = useContext(PanelCtx);
  if (!inline) return <Drawer.Close asChild={asChild}>{children}</Drawer.Close>;
  const child = Children.only(children);
  if (!isValidElement(child)) return null;
  const el = child as ReactElement<{ onClick?: (e: unknown) => void }>;
  return cloneElement(el, {
    onClick: (event: unknown) => {
      el.props.onClick?.(event);
      zavrit();
    },
  });
};

export const PanelDrawer = Object.assign(Root, { Trigger, Content, Header, Title, Body, Footer, Close });
