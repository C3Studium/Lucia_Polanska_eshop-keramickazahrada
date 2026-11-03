import { Prompt, Text } from "@medusajs/ui";
import type { MouseEvent, ReactNode } from "react";

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
 *
 * ## Tlačítka
 *
 * Odmítnutí se všude jmenuje „Ponechat" — „Zrušit" by se pletlo s akcemi
 * „Zrušit poukaz / termín / objednávku" a člověk by nevěděl, jestli tím
 * dialog zavírá, nebo věc ruší. Potvrzení opakuje akci („Smazat", „Zrušit
 * termín", „Odeslat"); červené je jen u akce, která něco ničí nebo ruší.
 *
 * Formuláře (pole, výběr) sem nepatří — ty mají vlastní okno a tlačítko
 * „Zavřít".
 */
const MAX_JMEN = 5;

export const ConfirmDialog = ({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  items = [],
  children,
  consequence,
  confirmLabel,
  cancelLabel = "Ponechat",
  onConfirm,
  isPending = false,
  disabled = false,
  destructive = true,
}: {
  /** Tlačítko, které dialog otevírá. Bez něj se dialog řídí přes `open`. */
  trigger?: ReactNode;
  /** Řízené otevření — dialog otevřený odjinud (řádek tabulky, menu). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Otázka: „Smazat tyhle 3 kusy?" */
  title: ReactNode;
  /** Nepovinné upřesnění nad seznamem. */
  description?: ReactNode;
  /** Čeho se to týká, jmény. Prázdné u akce nad jedinou věcí. */
  items?: string[];
  /** Další obsah pod seznamem (rozpis částek). Ne pole formuláře. */
  children?: ReactNode;
  /** Věta o tom, co se nedá vrátit — jediná červená věta v dialogu. */
  consequence?: ReactNode;
  /** Text potvrzovacího tlačítka; opakuje, co udělá. */
  confirmLabel: ReactNode;
  /** Text odmítnutí; výchozí „Ponechat" — měnit jen výjimečně. */
  cancelLabel?: string;
  /**
   * Potvrzení. Dialog se po kliknutí zavře; `event.preventDefault()` ho
   * nechá otevřený (zavře se až po úspěchu přes `onOpenChange`).
   */
  onConfirm: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Akce běží — potvrzení nejde kliknout podruhé. */
  isPending?: boolean;
  /** Potvrzení zatím nejde (chybí předpoklad). */
  disabled?: boolean;
  destructive?: boolean;
}) => {
  const shown = items.slice(0, MAX_JMEN);
  const rest = items.length - shown.length;
  const hasBody = shown.length > 0 || Boolean(children) || Boolean(consequence);

  return (
    <Prompt
      variant={destructive ? "danger" : "confirmation"}
      open={open}
      onOpenChange={onOpenChange}
    >
      {trigger ? <Prompt.Trigger asChild>{trigger}</Prompt.Trigger> : null}
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>{title}</Prompt.Title>
          {description ? (
            <Prompt.Description>{description}</Prompt.Description>
          ) : null}
        </Prompt.Header>

        {hasBody ? (
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

            {children}

            {/* Jediná červená věta v dialogu — barva tu nese stav, ne důraz. */}
            {consequence ? (
              <Text size="small" className="text-ui-fg-error">
                {consequence}
              </Text>
            ) : null}
          </div>
        ) : null}

        <Prompt.Footer>
          <Prompt.Cancel>{cancelLabel}</Prompt.Cancel>
          {/* Tlačítko opakuje, co udělá — dialog se dá přečíst i odspoda. */}
          <Prompt.Action disabled={isPending || disabled} onClick={onConfirm}>
            {confirmLabel}
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};
