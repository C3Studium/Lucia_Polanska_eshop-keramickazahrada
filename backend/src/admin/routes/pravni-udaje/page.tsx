import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ShieldCheck } from "@medusajs/icons";
import {
  Badge, Button, Container, Heading, Input, Label, Text, Textarea, Toaster, toast,
} from "@medusajs/ui";
import {
  QueryClientProvider, useMutation, useQuery, useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { sdk } from "../../lib/sdk";
import { adminQueryClient } from "../../lib/query-client";
import { ceskaChyba } from "../../lib/ceska-chyba";
import { formatDateTime } from "../../lib/format";
/* `lib/legal-facts` je schválně bez jediného importu — jen tak smí do
   prohlížečového bundlu (viz `obsah/page.tsx`). Popisky a nápovědy jsou tak
   na jednom místě se schématem, které hlídá zápis. */
import {
  LEGAL_FACT_GROUPS,
  LEGAL_FACT_KEYS,
  LEGAL_FACT_META,
  legalFactProblem,
  missingLegalFacts,
  resolveLegalFacts,
  type LegalFactKey,
  type LegalFactValues,
} from "../../../lib/legal-facts";

/**
 * Právní údaje — fakta, která se dosazují do obchodních podmínek, poučení,
 * zásad, pokladny a e-mailů (`{{seller.email}}`, `{{mto.deposit}}` …).
 *
 * ## Proč tady a ne ve Studiu
 *
 * Texty dokumentů jsou ve Studiu, ale tyhle údaje patří k obchodu: čte je
 * i backend (patička e-mailů, storno v potvrzení rezervace kurzu, reklamační
 * protokol) a nesmí záviset na tom, jestli CMS běží. Ukládají se do nastavení
 * obchodu (`legal_facts`), web si je bere z `GET /store/legal/facts`.
 *
 * ## Jak se ukládá
 *
 * Odesílají se jen změněná pole (backend je do uložených slučuje). Prázdné
 * pole se uloží jako `""` = výslovně nevyplněno → na webu žluté
 * `[[DOPLNIT]]`, v e-mailu se údaj vynechá. Úpravy se drží zvlášť od
 * načtených hodnot: administrace po každém zápisu obnoví všechny dotazy
 * a obnova nesmí přepsat rozepsané pole.
 *
 * Pozor na vydaná znění: dokument se zveřejněným PDF má údaje z doby vydání
 * (otisk v manifestu). Podstatná změna podmínek proto patří do nového znění
 * ve Studiu — stránka to říká nahoře.
 */

type SettingsResponse = {
  settings: {
    legal_facts?: Record<string, string>;
    legal_facts_updated_at?: string;
  };
};

/** Kotva pole — tečky z klíče pryč, ať jde id použít i v selektoru. */
const fieldId = (key: LegalFactKey) => `pravni-udaj-${key.replace(/\./g, "-")}`;

const jumpTo = (key: LegalFactKey) => {
  const field = document.getElementById(fieldId(key));
  field?.scrollIntoView({ behavior: "smooth", block: "center" });
  field?.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true });
};

const FactField = ({
  factKey,
  value,
  saved,
  onChange,
}: {
  factKey: LegalFactKey;
  value: string;
  /** Uložená hodnota (`""` = nevyplněno) — proti ní se pozná neuložená změna. */
  saved: string;
  onChange: (value: string) => void;
}) => {
  const meta = LEGAL_FACT_META[factKey];
  const id = fieldId(factKey);
  const length = value.trim().length;
  const problem = legalFactProblem(factKey, value);
  const empty = length === 0;
  const changed = value.trim() !== saved;

  const hint = problem
    ? problem
    : empty
      ? "Nevyplněno — na webu je na tomto místě žluté [[DOPLNIT]]."
      : changed
        ? "Neuloženo — po uložení to web ukáže do minuty."
        : "";

  return (
    <div id={id} className="flex scroll-mt-24 flex-col gap-y-2 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`${id}-pole`} size="small" weight="plus">
          {meta.label}
        </Label>
        {empty ? (
          <Badge size="2xsmall" color="orange">Chybí</Badge>
        ) : null}
      </div>
      <Text size="small" className="text-ui-fg-subtle max-w-3xl">
        {meta.help}
      </Text>
      <Text size="xsmall" className="text-ui-fg-muted max-w-3xl">
        Například: {meta.example}
      </Text>
      {meta.multiline ? (
        <Textarea
          id={`${id}-pole`}
          rows={factKey === "course.cancellation" ? 6 : 3}
          value={value}
          placeholder={meta.example}
          aria-invalid={problem ? true : undefined}
          className="min-h-[96px] max-w-3xl"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={`${id}-pole`}
          type={meta.format === "email" ? "email" : meta.format === "url" ? "url" : "text"}
          inputMode={meta.format === "email" ? "email" : meta.format === "url" ? "url" : undefined}
          autoComplete="off"
          value={value}
          placeholder={meta.example}
          aria-invalid={problem ? true : undefined}
          className="h-11 max-w-3xl md:h-10"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <div className="flex max-w-3xl flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <Text
          size="xsmall"
          className={
            problem
              ? "text-ui-fg-error"
              : empty
                ? "text-ui-tag-orange-text"
                : "text-ui-fg-muted"
          }
        >
          {hint}
        </Text>
        {/* Počítadlo bez `maxLength` na poli: vložený delší text se nemá
            potichu uříznout uprostřed věty — radši ať je vidět, že je dlouhý. */}
        <Text
          size="xsmall"
          className={length > meta.maxLength ? "text-ui-fg-error" : "text-ui-fg-muted"}
        >
          {length} / {meta.maxLength}
        </Text>
      </div>
    </div>
  );
};

const Inner = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["merchant-settings"],
    queryFn: () => sdk.client.fetch("/admin/merchant-settings"),
  });

  /* Adresa Studia je serverová proměnná — stejně jako na stránce Obsah webu.
     null = ještě se načítá. */
  const [studio, setStudio] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    sdk.client
      .fetch<{ studio_url: string }>("/admin/workbench/cms-config")
      .then((config) => {
        if (!cancelled) setStudio(config.studio_url ?? "");
      })
      .catch(() => {
        if (!cancelled) setStudio("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Platné uložené hodnoty — tytéž, které právě vidí web. */
  const saved: LegalFactValues = useMemo(
    () => resolveLegalFacts(data?.settings?.legal_facts),
    [data]
  );
  const savedText = (key: LegalFactKey) => saved[key] ?? "";

  /* Jen rozepsaná pole; ostatní ukazují uloženou hodnotu. */
  const [edits, setEdits] = useState<Partial<Record<LegalFactKey, string>>>({});
  const valueOf = (key: LegalFactKey) => edits[key] ?? savedText(key);

  const changedKeys = LEGAL_FACT_KEYS.filter(
    (key) => key in edits && (edits[key] ?? "").trim() !== savedText(key)
  );
  const problems = LEGAL_FACT_KEYS.filter((key) => legalFactProblem(key, valueOf(key)));
  const missing = missingLegalFacts(saved);
  const updatedAt = data?.settings?.legal_facts_updated_at || "";

  const save = useMutation({
    mutationFn: (legalFacts: Partial<Record<LegalFactKey, string>>) =>
      sdk.client.fetch("/admin/merchant-settings", {
        method: "POST",
        body: { legal_facts: legalFacts },
      }),
    onSuccess: async (_response, sent) => {
      // Nejdřív nové uložené hodnoty, pak teprve pryč s úpravami — jinak by
      // pole na okamžik bliklo starou hodnotou. Pryč jdou jen pole uložená
      // beze změny; co se mezitím dopsalo, zůstává rozepsané.
      await queryClient.invalidateQueries({ queryKey: ["merchant-settings"] });
      setEdits((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([key, value]) => (value ?? "").trim() !== sent[key as LegalFactKey]
          )
        )
      );
      toast.success("Uloženo — e-maily to mají hned, web do minuty.");
    },
    onError: (error) =>
      toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  return (
    <Container className="divide-y p-0">
      <Toaster />
      <header className="px-6 pb-4 pt-6">
        <Heading>Právní údaje</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-3xl">
          Údaje o vás a o pravidlech obchodu, které se samy dosazují do
          obchodních podmínek, poučení o odstoupení, reklamačního řádu, zásad
          ochrany osobních údajů, do posledního kroku pokladny a do e-mailů.
          Stačí je napsat jednou tady.
        </Text>
      </header>

      <section className="flex flex-col gap-y-3 px-6 py-5">
        <div className="flex max-w-3xl flex-col gap-y-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
          <Text size="small">
            Každý údaj se vkládá doprostřed věty — u pole najdete větu, do které
            patří, a příklad. Pište obyčejný text bez uvozovek a bez formátování.
          </Text>
          <Text size="small">
            Samotné texty dokumentů (co kolem těchto údajů v podmínkách stojí)
            se upravují ve Studiu.
          </Text>
          {studio === null ? null : studio ? (
            <div>
              <Button
                size="small"
                variant="secondary"
                onClick={() => window.open(studio, "_blank", "noopener,noreferrer")}
              >
                Otevřít Studio
              </Button>
            </div>
          ) : (
            <Text size="xsmall" className="text-ui-fg-muted">
              Adresa Studia není nastavená (proměnná <code>CMS_STUDIO_URL</code>).
            </Text>
          )}
          <Text size="small" weight="plus">
            Pozor na vydaná znění: obchodní podmínky a další dokumenty, které už
            mají zveřejněné PDF, mají údaje z doby vydání a tahle stránka je
            nezmění. Podstatnou změnu podmínek — výši zálohy, storno podmínky
            kurzů, pravidla poukazů nebo odhad nákladů na vrácení — je potřeba
            zavést novým zněním obchodních podmínek ve Studiu (s novým datem
            účinnosti).
          </Text>
        </div>
      </section>

      <section className="flex flex-col gap-y-3 px-6 py-5">
        {isLoading ? (
          <Text size="small" className="text-ui-fg-muted">Načítám…</Text>
        ) : missing.length ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge size="small" color="orange">
                Chybí {missing.length} z {LEGAL_FACT_KEYS.length}
              </Badge>
              <Text size="small" weight="plus">Tohle je potřeba vyplnit před spuštěním</Text>
            </div>
            <Text size="small" className="text-ui-fg-subtle max-w-3xl">
              Na webu je na místě každého z nich žluté [[DOPLNIT]]; e-maily ho
              vynechají. Klepnutím skočíte na pole.
            </Text>
            <div className="flex flex-wrap gap-2">
              {missing.map((key) => (
                <Button
                  key={key}
                  size="small"
                  variant="secondary"
                  onClick={() => jumpTo(key)}
                >
                  {LEGAL_FACT_META[key].label}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Badge size="small" color="green">Vše vyplněno</Badge>
            <Text size="small" className="text-ui-fg-subtle">
              Na webu už není žádné [[DOPLNIT]] z těchto údajů.
            </Text>
          </div>
        )}
        {updatedAt ? (
          <Text size="xsmall" className="text-ui-fg-muted">
            Naposledy změněno {formatDateTime(updatedAt)}.
          </Text>
        ) : null}
      </section>

      {LEGAL_FACT_GROUPS.map((group) => (
        <section key={group} className="px-6 pt-5 pb-1">
          <Heading level="h2">{group}</Heading>
          <div className="divide-y">
            {LEGAL_FACT_KEYS.filter((key) => LEGAL_FACT_META[key].group === group).map(
              (key) => (
                <FactField
                  key={key}
                  factKey={key}
                  value={valueOf(key)}
                  saved={savedText(key)}
                  onChange={(value) => setEdits((current) => ({ ...current, [key]: value }))}
                />
              )
            )}
          </div>
        </section>
      ))}

      {/* Lepí se ke spodku okna: formulář je dlouhý a „Uložit" má být po ruce
          i na telefonu, ne až za devatenácti poli. */}
      <footer className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-b-lg bg-ui-bg-base px-6 py-4">
        <Button
          size="base"
          disabled={!changedKeys.length || problems.length > 0}
          isLoading={save.isPending}
          onClick={() =>
            save.mutate(
              Object.fromEntries(
                changedKeys.map((key) => [key, (edits[key] ?? "").trim()])
              )
            )
          }
        >
          Uložit
        </Button>
        {problems.length ? (
          <Text size="small" className="text-ui-fg-error">
            Opravte {problems.length === 1 ? "zvýrazněné pole" : `zvýrazněná pole (${problems.length})`}.
          </Text>
        ) : changedKeys.length ? (
          <>
            <Text size="small" className="text-ui-fg-subtle">
              Neuložené změny: {changedKeys.length}
            </Text>
            <Button size="small" variant="transparent" onClick={() => setEdits({})}>
              Zahodit
            </Button>
          </>
        ) : null}
      </footer>
    </Container>
  );
};

const queryClient = adminQueryClient;
const Page = () => (
  <QueryClientProvider client={queryClient}><Inner /></QueryClientProvider>
);
export const config = defineRouteConfig({
  label: "Právní údaje",
  icon: ShieldCheck,
  // Mezi nastavení obchodu: za E-maily obchodu (110), před Obsah webu (120).
  rank: 115,
});
export default Page;
