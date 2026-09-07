import { Badge, Container, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";

/**
 * „Chybí dokument" — první blok Přehledu, a jen když opravdu chybí.
 *
 * Dokument, na který web odkazuje a který nikdo nenahrál, se nijak neprojeví:
 * stránka se vykreslí, nic nespadne, jen na tom místě visí náhradní věta. Že
 * to tam je, se nedozví nikdo — leda zákazník, který ho zrovna potřebuje,
 * a ten už ho v tu chvíli hledá jinde.
 *
 * Proto to hlásí Přehled, a proto nahoře: prázdné místo na webu je práce, která
 * se má udělat dnes, ne informace, kterou je potřeba jít někam vyhledat. Když
 * nechybí nic, blok se nevykreslí vůbec — upozornění, které svítí pořád, se
 * nečte.
 */
type Ocekavany = {
  key: string;
  title: string;
  where: string;
  required: boolean;
  uploaded: unknown | null;
};

export const ChybejiciDokumenty = () => {
  const { data } = useQuery<{ expected: Ocekavany[] }>({
    queryKey: ["dokumenty"],
    queryFn: () => sdk.client.fetch("/admin/dokumenty"),
  });

  const chybi = (data?.expected ?? []).filter(
    (slot) => slot.required && !slot.uploaded
  );

  if (!chybi.length) {
    return null;
  }

  return (
    <Container className="flex flex-col gap-y-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <Heading level="h2">
          {chybi.length === 1 ? "Chybí dokument" : "Chybí dokumenty"}
        </Heading>
        <Badge size="2xsmall" color="red">
          {chybi.length}
        </Badge>
      </div>

      {chybi.map((slot) => (
        <Text key={slot.key} size="small">
          <span className="text-ui-fg-base">{slot.title}</span>{" "}
          <span className="text-ui-fg-subtle">— {slot.where}</span>
        </Text>
      ))}

      <Text size="xsmall" className="text-ui-fg-subtle">
        Než ho nahrajete, ukáže web na tom místě náhradní text. Nahrát se dá
        v <a href="/app/dokumenty">Dokumentech</a>.
      </Text>
    </Container>
  );
};

export default ChybejiciDokumenty;
