import { MagnifyingGlass } from "@medusajs/icons";
import { Badge, Button, Input, Prompt, Text, clx } from "@medusajs/ui";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sdk } from "../lib/sdk";

/**
 * Hledání odkudkoli — lupa v liště Přehledu a Ctrl+K (⌘K na Macu).
 *
 * Matěj 3. 11. 2026: „můžeš dát, ale asi se používat nebude" — takže malé
 * okno: jedno pole, pár výsledků, klik (nebo Enter) otevře stránku.
 * Hledá objednávky (číslo, jméno, e-mail), kódy poukazů, rezervace kurzů,
 * čísla zásilek a produkty — `api/admin/search`.
 *
 * Ctrl+K se chytá na `window` ve fázi zachycení a dál se nepouští: Medusa má
 * na stejné zkratce vlastní hledání (na `document`), a dvě okna přes sebe by
 * byla horší než žádné. Mimo Přehled (bez lišty) zůstává Ctrl+K Meduse.
 */

type SearchResult = {
  type: "order" | "product" | "voucher" | "course" | "parcel";
  id: string;
  title: string;
  subtitle: string | null;
  to: string;
};

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  order: "Objednávka",
  parcel: "Zásilka",
  voucher: "Poukaz",
  course: "Kurz",
  product: "Produkt",
};

export const AdminSearch = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [active, setActive] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopPropagation();
        setOpen((previous) => !previous);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  // Po zavření začíná okno znovu načisto — staré výsledky by mátly.
  useEffect(() => {
    if (!open) {
      setInput("");
      setResults([]);
      setState("idle");
      setActive(0);
    }
  }, [open]);

  /* Dotaz odejde 300 ms po poslední klávese; pozdní odpověď na starší text se zahodí. */
  useEffect(() => {
    const text = input.trim();
    if (!open || (text.length < 2 && !/^#?\d+$/.test(text))) {
      setResults([]);
      setState("idle");
      return;
    }
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setState("loading");
      try {
        const response = (await sdk.client.fetch("/admin/search", {
          query: { q: text },
        })) as { results?: SearchResult[] };
        if (id !== requestId.current) return;
        setResults(response.results ?? []);
        setActive(0);
        setState("done");
      } catch {
        if (id !== requestId.current) return;
        setResults([]);
        setState("error");
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input, open]);

  const go = (result: SearchResult | undefined) => {
    if (!result) return;
    setOpen(false);
    navigate(result.to);
  };

  return (
    <Prompt open={open} onOpenChange={setOpen} variant="confirmation">
      <Prompt.Trigger asChild>
        <Button
          size="small"
          variant="transparent"
          title="Hledat objednávku, poukaz, kurz… (Ctrl+K)"
          aria-label="Hledat"
        >
          {/* Jen lupa: s textem se lišta záložek zalomila o řádek níž. */}
          <MagnifyingGlass />
        </Button>
      </Prompt.Trigger>
      <Prompt.Content className="max-w-[560px]">
        <Prompt.Header>
          <Prompt.Title>Hledat</Prompt.Title>
          <Prompt.Description>
            Číslo objednávky, jméno, e-mail, kód poukazu, číslo zásilky nebo název
            produktu.
          </Prompt.Description>
        </Prompt.Header>

        <div className="flex flex-col gap-y-3 px-6 pt-4">
          <Input
            autoFocus
            type="search"
            placeholder="Např. 128, Nováková nebo 7HQ4M2XP"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                go(results[active]);
              }
            }}
          />

          <div className="max-h-[50vh] overflow-y-auto" role="listbox" aria-label="Výsledky">
            {state === "loading" && results.length === 0 && (
              <Text size="small" className="text-ui-fg-subtle py-3">
                Hledám…
              </Text>
            )}
            {state === "error" && (
              <Text size="small" className="text-ui-fg-error py-3">
                Hledání se nepovedlo. Zkuste to prosím znovu.
              </Text>
            )}
            {state === "done" && results.length === 0 && (
              <Text size="small" className="text-ui-fg-subtle py-3">
                Nic nenalezeno.
              </Text>
            )}
            {results.map((result, index) => (
              <button
                key={`${result.type}-${result.id}`}
                type="button"
                role="option"
                aria-selected={index === active}
                // Pohyb, ne najetí: výsledek, který se vykreslí pod stojící
                // myší, nesmí přebít výběr šipkami (Enter by otevřel jiný).
                onMouseMove={() => setActive(index)}
                onClick={() => go(result)}
                className={clx(
                  "flex w-full items-start gap-x-3 rounded-md px-3 py-2 text-left outline-none focus-visible:shadow-borders-focus",
                  index === active ? "bg-ui-bg-base-hover" : "hover:bg-ui-bg-base-hover"
                )}
              >
                <Badge size="2xsmall" className="mt-0.5 shrink-0">
                  {TYPE_LABEL[result.type]}
                </Badge>
                <span className="min-w-0">
                  <Text size="small" weight="plus" className="truncate">
                    {result.title}
                  </Text>
                  {result.subtitle && (
                    <Text size="xsmall" className="text-ui-fg-subtle truncate">
                      {result.subtitle}
                    </Text>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Prompt.Footer>
          <Prompt.Cancel>Zavřít</Prompt.Cancel>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};
