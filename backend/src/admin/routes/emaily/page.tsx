import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Envelope } from "@medusajs/icons";
import { Badge, Button, Container, Heading, Input, Text, Textarea, toast } from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { sdk } from "../../lib/sdk";
import { adminQueryClient } from "../../lib/query-client";
import { ceskaChyba } from "../../lib/ceska-chyba";
import { SaveBar } from "../../components/save-bar";

/**
 * Emaily — texty e-mailů, které obchod posílá (15. 11. 2026, přání klientky).
 *
 * Vlevo seznam e-mailů, uprostřed jeho texty (předmět a jednotlivé odstavce),
 * vpravo náhled, který se překresluje během psaní (vzorová objednávka
 * a jméno, ne skutečný zákazník). Prázdné pole = výchozí znění. Upravuje se
 * čeština; zákazníci z ciziny dostávají dál překlad. Nový řádek (Enter)
 * zůstane novým řádkem i v e-mailu.
 */

type Field = { key: string; label: string; default: string; value: string };
type Email = {
  template: string;
  title: string;
  forOwner: boolean;
  editableBody: boolean;
  subject: { default: string; value: string };
  fields: Field[];
};

const fetchEmails = () => sdk.client.fetch<{ emaily: Email[] }>("/admin/email-texty");

const valuesOf = (email: Email): Record<string, string> => ({
  subject: email.subject.value,
  ...Object.fromEntries(email.fields.map((field) => [field.key, field.value])),
});

const Inner = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ["email-texty"], queryFn: fetchEmails });
  const emails = data?.emaily ?? [];

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const current = emails.find((email) => email.template === selected) ?? null;

  // První e-mail vybraný hned, ať je napravo co vidět.
  useEffect(() => {
    if (!selected && emails.length) setSelected(emails[0].template);
  }, [emails, selected]);

  // Při přepnutí e-mailu (nebo po uložení) formulář z uloženého znění.
  useEffect(() => {
    if (current) setDraft(valuesOf(current));
  }, [current?.template, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const saved = current ? valuesOf(current) : {};
  const changes = Object.keys({ ...saved, ...draft }).filter(
    (key) => (draft[key] ?? "") !== (saved[key] ?? "")
  ).length;

  /* Náhled: půl vteřiny po posledním stisku klávesy. */
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const draftKey = JSON.stringify(draft);
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setPreviewLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await sdk.client.fetch<{ html: string; subject: string }>(
          "/admin/email-texty/nahled",
          { method: "POST", body: { template: current.template, values: draft } }
        );
        if (!cancelled) {
          setPreviewHtml(result.html);
          setPreviewSubject(result.subject);
        }
      } catch {
        if (!cancelled) setPreviewHtml("<p style='font-family:sans-serif;padding:24px'>Náhled se nepodařilo načíst.</p>");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [current?.template, draftKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (values: Record<string, string>) =>
      sdk.client.fetch<{ emaily: Email[] }>("/admin/email-texty", {
        method: "POST",
        body: { template: current?.template, values },
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(["email-texty"], result);
      toast.success("E-mail uložený — další odeslané už půjdou s novým zněním.");
    },
    onError: (error) => toast.error(ceskaChyba(error, "E-mail se nepodařilo uložit.")),
  });

  const visible = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase("cs");
    return emails.filter((email) => !query || email.title.toLocaleLowerCase("cs").includes(query));
  }, [emails, filter]);

  if (isLoading) return <Container className="p-6"><Text>Načítám e-maily…</Text></Container>;
  if (isError) return <Container className="p-6"><Text>E-maily se nepodařilo načíst.</Text></Container>;

  const customized = (email: Email) =>
    Boolean(email.subject.value) || email.fields.some((field) => field.value);

  const set = (key: string, value: string) => setDraft((previous) => ({ ...previous, [key]: value }));

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="px-6 py-4">
        <Heading level="h1">Emaily</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Vyberte e-mail, přepište text a vpravo hned uvidíte, jak přijde. Prázdné pole = výchozí znění.
          Enter v textu udělá nový řádek i v e-mailu.
        </Text>
      </Container>

      <div className="grid gap-3 xl:grid-cols-[17rem_minmax(0,1fr)_minmax(0,36rem)]">
        {/* ---------------------------------------------- seznam */}
        <Container className="p-0">
          <div className="border-b px-4 py-3">
            <Input
              size="small"
              type="search"
              placeholder="Hledat e-mail"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
          <ul className="max-h-[70vh] overflow-y-auto py-1">
            {visible.map((email, index) => {
              const first = index === 0 || visible[index - 1].forOwner !== email.forOwner;
              return (
                <li key={email.template}>
                  {first && (
                    <Text size="xsmall" weight="plus" className="text-ui-fg-muted px-4 pb-1 pt-3 uppercase">
                      {email.forOwner ? "Chodí vám" : "Chodí zákazníkům"}
                    </Text>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (changes && !window.confirm("Máte neuložené změny. Opravdu přepnout na jiný e-mail?")) return;
                      setSelected(email.template);
                    }}
                    className={`flex w-full items-start justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-ui-bg-base-hover ${
                      email.template === selected ? "bg-ui-bg-base-pressed font-medium" : ""
                    }`}
                  >
                    <span>{email.title}</span>
                    {customized(email) && <Badge size="2xsmall" color="blue">upraveno</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
        </Container>

        {/* ---------------------------------------------- formulář */}
        <Container className="flex flex-col gap-y-5 px-6 py-5">
          {current && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Heading level="h2">{current.title}</Heading>
                {customized(current) && (
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => {
                      if (window.confirm("Vrátit celý e-mail na výchozí znění?")) save.mutate({});
                    }}
                  >
                    Vrátit výchozí znění
                  </Button>
                )}
              </div>

              <Pole
                label="Předmět"
                hint="Co uvidí zákazník v seznamu e-mailů."
                value={draft.subject ?? ""}
                fallback={current.subject.default}
                onChange={(value) => set("subject", value)}
                single
              />

              {current.fields.map((field) => (
                <Pole
                  key={field.key}
                  label={field.label}
                  value={draft[field.key] ?? ""}
                  fallback={field.default}
                  onChange={(value) => set(field.key, value)}
                />
              ))}

              {!current.editableBody && (
                <Text size="small" className="text-ui-fg-subtle">
                  U tohoto e-mailu jde zatím upravit jen předmět — text je složený z údajů (kurz, objednávka).
                </Text>
              )}
            </>
          )}
        </Container>

        {/* ---------------------------------------------- náhled */}
        <Container className="flex flex-col p-0 xl:sticky xl:top-4 xl:self-start">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="min-w-0">
              <Text size="xsmall" className="text-ui-fg-muted uppercase">Náhled · vzorová data</Text>
              <Text size="small" weight="plus" className="truncate">{previewSubject}</Text>
            </div>
            {previewLoading && <Text size="xsmall" className="text-ui-fg-muted">aktualizuji…</Text>}
          </div>
          <iframe
            title="Náhled e-mailu"
            srcDoc={previewHtml}
            sandbox=""
            className="h-[75vh] w-full rounded-b-lg bg-white"
          />
        </Container>
      </div>

      <SaveBar
        dirty={changes > 0}
        count={changes}
        saving={save.isPending}
        onSave={() => save.mutate(draft)}
        onDiscard={() => current && setDraft(valuesOf(current))}
      />
    </div>
  );
};

const Pole = ({
  label,
  hint,
  value,
  fallback,
  onChange,
  single,
}: {
  label: string;
  hint?: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
  single?: boolean;
}) => (
  <div className="flex flex-col gap-y-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <Text size="small" weight="plus">{label}</Text>
      {value ? (
        <button type="button" className="text-ui-fg-interactive text-xs underline" onClick={() => onChange("")}>
          Vrátit výchozí
        </button>
      ) : (
        <Text size="xsmall" className="text-ui-fg-muted">výchozí znění</Text>
      )}
    </div>
    {single ? (
      <Input value={value} placeholder={fallback} onChange={(event) => onChange(event.target.value)} />
    ) : (
      <Textarea
        value={value}
        placeholder={fallback}
        rows={Math.min(8, Math.max(2, Math.ceil(fallback.length / 70)))}
        onChange={(event) => onChange(event.target.value)}
      />
    )}
    {hint && <Text size="xsmall" className="text-ui-fg-muted">{hint}</Text>}
    {!value && fallback && !single && (
      <button
        type="button"
        className="self-start text-xs text-ui-fg-subtle underline"
        onClick={() => onChange(fallback)}
      >
        Upravit výchozí text
      </button>
    )}
  </div>
);

const Page = () => (
  <QueryClientProvider client={adminQueryClient}>
    <Inner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Emaily",
  icon: Envelope,
  // Vedlejší: hned za Newsletterem (65).
  rank: 66,
});

export default Page;
