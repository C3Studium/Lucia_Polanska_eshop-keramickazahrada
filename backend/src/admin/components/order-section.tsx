import { ChevronDown } from "@medusajs/icons";
import { Container, Heading, Text } from "@medusajs/ui";
import { useState, useSyncExternalStore, type ReactNode } from "react";

/**
 * Sbalitelná karta na detailu objednávky (pravidlo 20/80, 3. 11. 2026).
 *
 * Občasné věci (sledování zásilky, reklamace, zpoždění, e-maily) zůstávají
 * zavřené a v záhlaví ukazují jen stav jednou větou. Samy se otevřou, když
 * v nich je něco k řešení (`attention`) — problém se zásilkou, otevřená
 * reklamace, e-mail, který neodešel. Jakmile na záhlaví někdo klikne, platí
 * jeho volba (do obnovení stránky).
 */
export const OrderSection = ({
  title,
  badge,
  summary,
  attention = false,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** Stav vpravo v záhlaví — vidět i u zavřené karty. */
  badge?: ReactNode;
  /** Jedna věta pod nadpisem, jen když je karta zavřená. */
  summary?: ReactNode;
  /** Je tu něco k řešení → karta se sama otevře. */
  attention?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) => {
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = choice ?? (attention || defaultOpen);

  return (
    <Container className="divide-y p-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setChoice(!open)}
        className="hover:bg-ui-bg-base-hover flex w-full items-center justify-between gap-x-3 rounded-t-lg px-6 py-4 text-left transition-colors"
      >
        <div className="min-w-0">
          <Heading level="h2">{title}</Heading>
          {!open && summary ? (
            <Text size="small" className="text-ui-fg-subtle mt-0.5">
              {summary}
            </Text>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-x-2">
          {badge}
          <ChevronDown
            className={`text-ui-fg-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {open ? children : null}
    </Container>
  );
};

/*
 * Široké okno = dva sloupce. Medusa skládá detail objednávky do dvou sloupců
 * od 1280 px (`xl:` v TwoColumnLayoutComponent); užší okno (telefon, tablet)
 * má jeden sloupec a pravý panel až úplně dole pod položkami.
 */
const WIDE_QUERY = "(min-width: 1280px)";

const subscribeWide = (listener: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};

const readWide = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia(WIDE_QUERY).matches
    : true;

/** Má detail objednávky dva sloupce (počítač), nebo jeden (telefon)? */
export const useWideLayout = (): boolean =>
  useSyncExternalStore(subscribeWide, readWide, () => true);
