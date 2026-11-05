import { Badge, Button, Container, Heading, Text } from "@medusajs/ui";

/**
 * Karta, která se nenačetla — a přesto zůstane vidět.
 *
 * Panely na detailu objednávky se při chybě dotazu schovávaly
 * (`isError` → `return null`). Krátký výpadek sítě nebo půlminuta po nasazení
 * tak kartu úplně odstranily a nebylo jak poznat, že tam vůbec patří: hledá se
 * něco, co podle obrazovky neexistuje. Přesně na to se 5. 11. 2026 ptala
 * majitelka u štítku České pošty.
 *
 * „Nenačteno" a „není co zobrazit" se proto musí dát rozeznat od sebe. Prázdno
 * zůstává jen tam, kde doopravdy není co ukázat (objednávka bez reklamace, bez
 * poukazu, bez zakázky); chyba dotazu má svou kartu s jednou větou a tlačítkem.
 */
export const PanelError = ({
  title,
  onRetry,
}: {
  /** Nadpis té karty, co se nenačetla — ať se pozná, která to je. */
  title: string;
  /** Znovu načíst bez obnovení stránky; typicky `query.refetch`. */
  onRetry?: () => void;
}) => (
  <Container className="divide-y p-0">
    <div className="flex items-center justify-between gap-x-2 px-6 py-4">
      <Heading level="h2">{title}</Heading>
      <Badge color="red">Nenačteno</Badge>
    </div>
    <div className="flex flex-col items-start gap-y-3 px-6 py-4">
      <Text size="small" className="text-ui-fg-subtle">
        Tahle karta se teď nenačetla — data k ní nedorazila. Zkuste to znovu;
        když to nepomůže, obnovte stránku.
      </Text>
      {onRetry && (
        <Button size="small" variant="secondary" onClick={onRetry}>
          Zkusit znovu
        </Button>
      )}
    </div>
  </Container>
);
