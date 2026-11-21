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
import { NavodTip } from "../../components/navod-tip";
import { SubTabs } from "../../components/work-tabs";

/**
 * Emaily — texty e-mailů, které obchod posílá (15. 11. 2026, přání klientky).
 *
 * Vlevo seznam e-mailů, uprostřed jeho texty (předmět a jednotlivé odstavce),
 * vpravo náhled, který se překresluje během psaní (vzorová objednávka
 * a jméno, ne skutečný zákazník). Prázdné pole = výchozí znění. Upravuje se
 * čeština; zákazníci z ciziny dostávají dál překlad. Nový řádek (Enter)
 * zůstane novým řádkem i v e-mailu.
 *
 * Záložky Zákazník / Admin (21. 11. 2026, Matěj): zákaznické e-maily jdou
 * filtrovat podle akce (objednávka, doprava, platby…), v Adminu jsou e-maily
 * pro majitelku včetně jednotlivých podob „Nové objednávky" podle platby —
 * ty jen s náhledem a vysvětlením, kdy chodí, protože nadpis i text skládá
 * obchod sám z objednávky.
 */

type Field = { key: string; label: string; default: string; value: string };
type Audience = "customer" | "owner";
type Email = {
  id: string;
  template: string;
  title: string;
  audience: Audience;
  forOwner: boolean;
  category: string;
  when: string | null;
  readOnly: boolean;
  editableSubject: boolean;
  editableBody: boolean;
  subject: { default: string; value: string };
  fields: Field[];
};
type Category = { key: string; label: string; audience: Audience };

const fetchEmails = () =>
  sdk.client.fetch<{ emaily: Email[]; kategorie: Category[] }>("/admin/email-texty");

const VSE = "vse";

/** Záložka z adresy (`?komu=admin`), ať jde odkázat rovnou na e-maily pro majitelku. */
const tabFromUrl = (): Audience => {
  try {
    return new URLSearchParams(window.location.search).get("komu") === "admin" ? "owner" : "customer";
  } catch {
    return "customer";
  }
};

const valuesOf = (email: Email): Record<string, string> => ({
  subject: email.subject.value,
  ...Object.fromEntries(email.fields.map((field) => [field.key, field.value])),
});

const Inner = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ["email-texty"], queryFn: fetchEmails });
  const emails = data?.emaily ?? [];
  const categories = data?.kategorie ?? [];

  const [tab, setTab] = useState<Audience>(tabFromUrl);
  const [category, setCategory] = useState<string>(VSE);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const current = emails.find((email) => email.id === selected) ?? null;
  const inTab = useMemo(() => emails.filter((email) => email.audience === tab), [emails, tab]);

  // První e-mail záložky vybraný hned, ať je napravo co vidět.
  useEffect(() => {
    if (inTab.length && !inTab.some((email) => email.id === selected)) setSelected(inTab[0].id);
  }, [inTab, selected]);

  // Při přepnutí e-mailu (nebo po uložení) formulář z uloženého znění.
  useEffect(() => {
    if (current) setDraft(valuesOf(current));
  }, [current?.id, data]); // eslint-disable-line react-hooks/exhaustive-deps

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
          { method: "POST", body: { template: current.id, values: current.readOnly ? {} : draft } }
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
  }, [current?.id, draftKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (values: Record<string, string>) =>
      sdk.client.fetch<{ emaily: Email[]; kategorie: Category[] }>("/admin/email-texty", {
        method: "POST",
        body: { template: current?.template, values },
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(["email-texty"], result);
      toast.success("E-mail uložený — další odeslané už půjdou s novým zněním.");
    },
    onError: (error) => toast.error(ceskaChyba(error, "E-mail se nepodařilo uložit.")),
  });

  const query = filter.trim().toLocaleLowerCase("cs");
  const matchesQuery = (email: Email) => !query || email.title.toLocaleLowerCase("cs").includes(query);

  /* Filtr podle akce jen u zákazníků — v Adminu je e-mailů pár a skupiny stačí. */
  const visible = useMemo(
    () =>
      inTab.filter(
        (email) => matchesQuery(email) && (tab === "owner" || category === VSE || email.category === category)
      ),
    [inTab, query, tab, category] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const labelOf = (key: string) => categories.find((item) => item.key === key)?.label ?? "Ostatní";
  const chips = useMemo(
    () =>
      categories
        .filter((item) => item.audience === "customer")
        .map((item) => ({
          ...item,
          count: inTab.filter((email) => email.category === item.key && matchesQuery(email)).length,
        }))
        .filter((item) => item.count > 0),
    [categories, inTab, query] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* Skupina z filtru — e-mail uprostřed se přepne na první z ní, pokud do ní
     ten vybraný nepatří (jinak by vpravo zůstal e-mail, který v seznamu není). */
  const pickCategory = (key: string) => {
    if (key === category) return;
    const keepsCurrent = Boolean(current) && (key === VSE || current?.category === key);
    if (!keepsCurrent && changes && !window.confirm("Máte neuložené změny. Opravdu přepnout?")) return;
    setCategory(key);
    if (!keepsCurrent) {
      const first = inTab.find((email) => matchesQuery(email) && email.category === key);
      if (first) setSelected(first.id);
    }
  };

  const switchTab = (next: string) => {
    if (next === tab) return;
    if (changes && !window.confirm("Máte neuložené změny. Opravdu přepnout?")) return;
    setTab(next as Audience);
    setCategory(VSE);
    try {
      const url = new URL(window.location.href);
      if (next === "owner") url.searchParams.set("komu", "admin");
      else url.searchParams.delete("komu");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* bez adresy se jen nepamatuje záložka */
    }
  };

  if (isLoading) return <Container className="p-6"><Text>Načítám e-maily…</Text></Container>;
  if (isError) return <Container className="p-6"><Text>E-maily se nepodařilo načíst.</Text></Container>;

  const customized = (email: Email) =>
    Boolean(email.subject.value) || email.fields.some((field) => field.value);

  const set = (key: string, value: string) => setDraft((previous) => ({ ...previous, [key]: value }));

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1">
            <Heading level="h1">Emaily</Heading>
            <NavodTip tema="emaily.prehled" />
          </span>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            {tab === "customer"
              ? "Vyberte e-mail, přepište text a vpravo hned uvidíte, jak přijde. Prázdné pole = výchozí znění. Enter v textu udělá nový řádek i v e-mailu."
              : "E-maily, které obchod posílá vám — na e-mail obchodu z Nastavení obchodu › E-maily obchodu. Vyberte e-mail a uvidíte, kdy chodí a jak vypadá."}
          </Text>
        </div>
        <SubTabs
          bare
          active={tab}
          onSelect={switchTab}
          tabs={[
            { key: "customer", label: "Zákazník", count: emails.filter((email) => email.audience === "customer").length },
            { key: "owner", label: "Admin", count: emails.filter((email) => email.audience === "owner").length },
          ]}
        />
      </Container>

      <div className="grid gap-3 xl:grid-cols-[17rem_minmax(0,1fr)_minmax(0,36rem)]">
        {/* ---------------------------------------------- seznam */}
        <Container className="p-0">
          <div className="flex flex-col gap-2 border-b px-4 py-3">
            <Input
              size="small"
              type="search"
              placeholder="Hledat e-mail"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            {/* Filtr podle akce — jen zákaznické e-maily. */}
            {tab === "customer" && chips.length > 1 && (
              <div className="flex flex-wrap gap-1" role="group" aria-label="Filtr podle akce">
                {[{ key: VSE, label: "Vše", count: chips.reduce((sum, item) => sum + item.count, 0) }, ...chips].map(
                  (item) => {
                    const active = category === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => pickCategory(item.key)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-fg ${
                          active
                            ? "border-ui-border-interactive bg-ui-bg-interactive text-ui-fg-on-color"
                            : "border-ui-border-base text-ui-fg-subtle hover:bg-ui-bg-base-hover"
                        }`}
                      >
                        {item.label}
                        <span className={`ml-1 tabular-nums ${active ? "" : "text-ui-fg-muted"}`}>{item.count}</span>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>
          <ul className="max-h-[70vh] overflow-y-auto py-1">
            {visible.length === 0 && (
              <li>
                <Text size="small" className="text-ui-fg-muted px-4 py-3">
                  Žádný e-mail neodpovídá hledání.
                </Text>
              </li>
            )}
            {visible.map((email, index) => {
              const first = index === 0 || visible[index - 1].category !== email.category;
              return (
                <li key={email.id}>
                  {first && (
                    <Text size="xsmall" weight="plus" className="text-ui-fg-muted px-4 pb-1 pt-3 uppercase">
                      {labelOf(email.category)}
                    </Text>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (changes && !window.confirm("Máte neuložené změny. Opravdu přepnout na jiný e-mail?")) return;
                      setSelected(email.id);
                    }}
                    className={`flex w-full items-start justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-ui-bg-base-hover ${
                      email.id === selected ? "bg-ui-bg-base-pressed font-medium" : ""
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

              {current.audience === "owner" && (
                <div className="bg-ui-bg-subtle flex flex-col gap-y-2 rounded-lg px-4 py-3">
                  {current.when && (
                    <div>
                      <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">Kdy přijde</Text>
                      <Text size="small">{current.when}</Text>
                    </div>
                  )}
                  <div>
                    <Text size="xsmall" weight="plus" className="text-ui-fg-muted uppercase">Komu</Text>
                    <Text size="small">
                      {current.template === "user-invited"
                        ? "Pozvanému člověku na jeho e-mail."
                        : "Na e-mail obchodu — nastavíte ho v Nastavení obchodu › E-maily obchodu."}
                    </Text>
                  </div>
                </div>
              )}

              {current.editableSubject ? (
                <Pole
                  label="Předmět"
                  hint={current.audience === "owner" ? undefined : "Co uvidí zákazník v seznamu e-mailů."}
                  value={draft.subject ?? ""}
                  fallback={current.subject.default}
                  onChange={(value) => set("subject", value)}
                  single
                />
              ) : (
                <div className="flex flex-col gap-y-1">
                  <Text size="small" weight="plus">Předmět</Text>
                  <Text size="small">{current.subject.default}</Text>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Předmět skládá obchod sám (číslo objednávky, datum) — tady jen ukázka.
                  </Text>
                </div>
              )}

              {current.fields.map((field) => (
                <Pole
                  key={field.key}
                  label={field.label}
                  value={draft[field.key] ?? ""}
                  fallback={field.default}
                  onChange={(value) => set(field.key, value)}
                />
              ))}

              {current.readOnly ? (
                <Text size="small" className="text-ui-fg-subtle">
                  Text skládá obchod z objednávky, upravit ho nejde. Vpravo je ukázka se vzorovými daty.
                </Text>
              ) : (
                !current.editableBody && (
                  <Text size="small" className="text-ui-fg-subtle">
                    U tohoto e-mailu jde zatím upravit jen předmět — text je složený z údajů (kurz, objednávka).
                  </Text>
                )
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

      {!current?.readOnly && (
        <SaveBar
          dirty={changes > 0}
          count={changes}
          saving={save.isPending}
          onSave={() => save.mutate(draft)}
          onDiscard={() => current && setDraft(valuesOf(current))}
        />
      )}
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
