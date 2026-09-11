import { defineRouteConfig } from "@medusajs/admin-sdk";
import { DocumentText } from "@medusajs/icons";
import {
  Badge, Button, Container, Heading, Input, Label, Text, Toaster, toast,
} from "@medusajs/ui";
import {
  QueryClientProvider, useQuery, useQueryClient,
} from "@tanstack/react-query";
import { useRef, useState } from "react";
import { sdk } from "../../lib/sdk";
import { adminQueryClient } from "../../lib/query-client"

/**
 * Dokumenty — PDF, na která web někde odkazuje.
 *
 * Dvě části, protože jsou to dvě různé věci:
 *
 * - **Co web očekává** — místa zadrátovaná v kódu (`modules/dokumenty/catalogue.ts`).
 *   Ukazují se i prázdná a prázdné povinné hlásí Přehled. Bez toho by se
 *   o chybějícím dokumentu nikdo nedozvěděl, dokud si ho nevšimne zákazník.
 * - **Vlastní** — cokoli dalšího. Pojmenuje se tady a v kódu se pak zavolá
 *   `/store/documents/<jméno>`.
 *
 * Nahrávání jde přes `/admin/uploads` (MinIO), stejně jako fotky v deníku
 * výroby — modul si drží jen jméno, název a adresu souboru.
 */
type Nahrany = {
  id: string;
  key: string;
  title: string;
  file_url: string;
  file_name: string | null;
  size: number | null;
  updated_at?: string;
};

type Ocekavany = {
  key: string;
  title: string;
  where: string;
  required: boolean;
  uploaded: Nahrany | null;
};

const velikost = (bytes: number | null) =>
  bytes ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : "";

const Nahrat = ({
  documentKey,
  title,
  onDone,
}: {
  documentKey: string;
  title: string;
  onDone: () => void;
}) => {
  const vstup = useRef<HTMLInputElement>(null);
  const [pracuje, setPracuje] = useState(false);

  const nahrat = async (file: File) => {
    setPracuje(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const odpoved = await fetch("/admin/uploads", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!odpoved.ok) throw new Error("Soubor se nepodařilo nahrát.");

      const payload = await odpoved.json();
      const url: string | undefined = payload?.files?.[0]?.url;
      if (!url) throw new Error("Úložiště nevrátilo adresu souboru.");

      await sdk.client.fetch("/admin/dokumenty", {
        method: "POST",
        body: {
          key: documentKey,
          title,
          file_url: url,
          file_name: file.name,
          mime_type: file.type || undefined,
          size: file.size,
        },
      });

      toast.success(`${title} — nahráno.`);
      onDone();
    } catch (chyba) {
      toast.error(chyba instanceof Error ? chyba.message : "Nahrání selhalo.");
    } finally {
      setPracuje(false);
      if (vstup.current) vstup.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={vstup}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void nahrat(file);
        }}
      />
      <Button
        size="small"
        variant="secondary"
        isLoading={pracuje}
        onClick={() => vstup.current?.click()}
      >
        Nahrát PDF
      </Button>
    </>
  );
};

const Blok = ({ slot, onDone }: { slot: Ocekavany; onDone: () => void }) => (
  <Container className="flex flex-col gap-y-3 p-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <Heading level="h3">{slot.title}</Heading>
        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
          {slot.where}
        </Text>
        <Text size="xsmall" className="text-ui-fg-muted mt-1">
          Volá se jako <code>{slot.key}</code>
        </Text>
      </div>
      {slot.uploaded ? (
        <Badge size="2xsmall" color="green">Nahráno</Badge>
      ) : (
        <Badge size="2xsmall" color={slot.required ? "red" : "grey"}>
          {slot.required ? "Chybí" : "Nenahráno"}
        </Badge>
      )}
    </div>

    {slot.uploaded ? (
      <Text size="small">
        <a href={slot.uploaded.file_url} target="_blank" rel="noreferrer">
          {slot.uploaded.file_name ?? "Otevřít dokument"}
        </a>{" "}
        <span className="text-ui-fg-muted">{velikost(slot.uploaded.size)}</span>
      </Text>
    ) : (
      <Text size="small" className="text-ui-fg-subtle">
        {slot.required
          ? "Dokud tu nic není, ukáže web na tom místě náhradní text."
          : "Nepovinné — web se bez toho obejde."}
      </Text>
    )}

    <div className="flex gap-x-2">
      <Nahrat documentKey={slot.key} title={slot.title} onDone={onDone} />
      {slot.uploaded ? (
        <Text size="xsmall" className="text-ui-fg-muted self-center">
          Nahrání nového ten stávající přepíše.
        </Text>
      ) : null}
    </div>
  </Container>
);

const Inner = () => {
  const queryClient = useQueryClient();
  const [novyKlic, setNovyKlic] = useState("");
  const [novyNazev, setNovyNazev] = useState("");

  const { data, isLoading } = useQuery<{
    expected: Ocekavany[];
    extra: Nahrany[];
  }>({
    queryKey: ["dokumenty"],
    queryFn: () => sdk.client.fetch("/admin/dokumenty"),
  });

  const obnovit = () =>
    queryClient.invalidateQueries({ queryKey: ["dokumenty"] });

  const ocekavane = data?.expected ?? [];
  const chybi = ocekavane.filter((slot) => slot.required && !slot.uploaded);

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="flex items-center justify-between p-4">
        <div>
          <Heading level="h1">Dokumenty</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            PDF, na která web někde odkazuje.
          </Text>
        </div>
        {isLoading ? null : chybi.length ? (
          <Badge size="small" color="red">
            Chybí {chybi.length} z {ocekavane.length}
          </Badge>
        ) : (
          <Badge size="small" color="green">
            Hotovo {ocekavane.length} z {ocekavane.length}
          </Badge>
        )}
      </Container>

      {ocekavane.map((slot) => (
        <Blok key={slot.key} slot={slot} onDone={obnovit} />
      ))}

      {data?.extra?.length ? (
        <Container className="flex flex-col gap-y-3 p-4">
          <Heading level="h2">Vlastní dokumenty</Heading>
          {data.extra.map((document) => (
            <div
              key={document.id}
              className="flex items-center justify-between gap-4 border-t border-ui-border-base pt-3 first:border-t-0 first:pt-0"
            >
              <div>
                <Text size="small" weight="plus">{document.title}</Text>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Volá se jako <code>{document.key}</code> ·{" "}
                  <a href={document.file_url} target="_blank" rel="noreferrer">
                    {document.file_name ?? "otevřít"}
                  </a>{" "}
                  {velikost(document.size)}
                </Text>
              </div>
              <Nahrat
                documentKey={document.key}
                title={document.title}
                onDone={obnovit}
              />
            </div>
          ))}
        </Container>
      ) : null}

      <Container className="flex flex-col gap-y-3 p-4">
        <Heading level="h2">Přidat vlastní</Heading>
        <Text size="xsmall" className="text-ui-fg-subtle">
          Pojmenujte dokument a nahrajte ho. V kódu se pak volá adresou{" "}
          <code>/store/documents/&lt;jméno&gt;</code>.
        </Text>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label size="small" weight="plus">Název</Label>
            <Input
              size="small"
              placeholder="Reklamační protokol"
              value={novyNazev}
              onChange={(event) => setNovyNazev(event.target.value)}
            />
          </div>
          <div>
            <Label size="small" weight="plus">Jméno v kódu</Label>
            <Input
              size="small"
              placeholder="reklamacni-protokol"
              value={novyKlic}
              onChange={(event) => setNovyKlic(event.target.value)}
            />
            <Text size="xsmall" className="text-ui-fg-muted mt-1">
              Malá písmena bez diakritiky, číslice a pomlčky — jde to do adresy.
            </Text>
          </div>
        </div>

        {novyKlic.trim() && novyNazev.trim() ? (
          <div className="flex gap-x-2">
            <Nahrat
              documentKey={novyKlic.trim()}
              title={novyNazev.trim()}
              onDone={() => {
                setNovyKlic("");
                setNovyNazev("");
                obnovit();
              }}
            />
          </div>
        ) : (
          <Text size="xsmall" className="text-ui-fg-muted">
            Vyplňte obojí a objeví se tlačítko pro nahrání.
          </Text>
        )}
      </Container>

      <Toaster />
    </div>
  );
};

const queryClient = adminQueryClient;
const Page = () => (
  <QueryClientProvider client={queryClient}>
    <Inner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Dokumenty",
  icon: DocumentText,
  rank: 95,
});

export default Page;
