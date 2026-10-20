import { Prompt, Text } from "@medusajs/ui";
import type { ReactNode } from "react";

/**
 * Potvrzení u akce, kterou nejde vzít zpět (admin-ux-spec §12).
 *
 * ## Kdy se ptát a kdy ne
 *
 * Dialog, který se odklikává pokaždé, se přestane číst — po třetím
 * „Opravdu?" je potvrzení jen další klik na cestě. Nabídka vrátit to
 * (`lib/undo.ts`) přijde až ve chvíli, kdy už je omyl vidět, a tam funguje.
 * Ptát se proto má smysl jen tam, kde vrátit **nejde**:
 *
 * - odeslaný e-mail zákazníkovi,
 * - podaný štítek u České pošty,
 * - vrácené peníze a dobropis,
 * - smazaný produkt, kolekce nebo provedení.
 *
 * Archivace, skrytí, přesun fronty nebo naskladnění vratné jsou — ty se
 * udělají a nabídne se vrácení.
 *
 * ## Proč jmény, a ne počtem
 *
 * „Smazat 3 produkty?" se nedá zkontrolovat: když je výběr špatně, číslo
 * sedí a dialog projde. Seznam jmen jde přečíst. Nad deset položek se vypíše
 * prvních pět a kolik dalších — delší seznam nikdo nečte a dialog by
 * přetekl.
 */
const MAX_JMEN = 5;

export const ConfirmDialog = ({
  trigger,
  title,
  description,
  items = [],
  consequence,
  confirmLabel,
  onConfirm,
  isPending = false,
  destructive = true,
}: {
  /** Tlačítko, které dialog otevírá. */
  trigger: ReactNode;
  /** Otázka: „Smazat tyhle 3 kusy?" */
  title: string;
  /** Nepovinné upřesnění nad seznamem. */
  description?: string;
  /** Čeho se to týká, jmény. Prázdné u akce nad jedinou věcí. */
  items?: string[];
  /** Věta o tom, co se nedá vrátit — jediná červená věta v dialogu. */
  consequence: string;
  /** Text potvrzovacího tlačítka; opakuje, co udělá. */
  confirmLabel: string;
  onConfirm: () => void;
  isPending?: boolean;
  destructive?: boolean;
}) => {
  const shown = items.slice(0, MAX_JMEN);
  const rest = items.length - shown.length;

  return (
    <Prompt variant={destructive ? "danger" : "confirmation"}>
      <Prompt.Trigger asChild>{trigger}</Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>{title}</Prompt.Title>
          {description ? (
            <Prompt.Description>{description}</Prompt.Description>
          ) : null}
        </Prompt.Header>

        <div className="flex flex-col gap-y-3 px-6 pb-2">
          {shown.length > 0 && (
            <ul className="flex flex-col gap-y-1">
              {shown.map((item) => (
                <li key={item}>
                  <Text size="small" className="text-ui-fg-subtle">
                    · {item}
                  </Text>
                </li>
              ))}
              {rest > 0 && (
                <li>
                  <Text size="small" className="text-ui-fg-muted">
                    …a {rest < 5 ? `další ${rest}` : `dalších ${rest}`}
                  </Text>
                </li>
              )}
            </ul>
          )}

          {/* Jediná červená věta v dialogu — barva tu nese stav, ne důraz. */}
          <Text size="small" className="text-ui-fg-error">
            {consequence}
          </Text>
        </div>

        <Prompt.Footer>
          <Prompt.Cancel>Zrušit</Prompt.Cancel>
          {/* Tlačítko opakuje, co udělá — dialog se dá přečíst i odspoda. */}
          <Prompt.Action disabled={isPending} onClick={onConfirm}>
            {confirmLabel}
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};
