import {
  Badge,
  Button,
  Container,
  Heading,
  Select,
  Skeleton,
  Text,
} from "@medusajs/ui";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState } from "../../../components/empty-state";
import { formatDateTime } from "../../../lib/format";
import { sdk } from "../../../lib/sdk";
import { adminQueryClient } from "../../../lib/query-client";

/**
 * Přehled → Provoz (3. 11. 2026).
 *
 * Totéž, co chodí večer v provozním e-mailu, jen hned a bez čekání: co se
 * stalo (součty po druzích), co selhalo a jak jsou na tom kontroly.
 *
 * Bez `config` exportu — jako ostatní stránky Přehledu se na ni chodí
 * z rozcestníku, ne z nabídky vlevo.
 *
 * Kontroly se spouštějí až tlačítkem. Některé sahají na web a do skladu,
 * takže by při každém otevření dělaly práci, o kterou si nikdo neřekl.
 */

type Zaznam = {
  id: string;
  kind: string;
  action: string;
  status: string;
  actor: string | null;
  ref_type: string | null;
  ref_id: string | null;
  summary: string | null;
  detail: Record<string, unknown> | null;
  duration_ms: number | null;
  created_at: string;
};

type Soucet = { druh: string; nazev: string; ok: number; chyby: number };

type Kontrola = {
  klic: string;
  nazev: string;
  stav: "ok" | "chyba" | "nenastaveno";
  zprava: string;
  detail?: string[];
};

type Odpoved = {
  od: string;
  hodin: number;
  celkem: number;
  soucty: Soucet[];
  zaznamy: Zaznam[];
  kontroly?: Kontrola[];
};

const OKNA: { hodnota: string; popis: string }[] = [
  { hodnota: "4", popis: "posledních 4 hodiny" },
  { hodnota: "24", popis: "posledních 24 hodin" },
  { hodnota: "72", popis: "poslední 3 dny" },
  { hodnota: "168", popis: "poslední týden" },
];

const stavKontroly: Record<
  Kontrola["stav"],
  { popis: string; barva: "green" | "red" | "grey" }
> = {
  ok: { popis: "Funguje", barva: "green" },
  chyba: { popis: "Nefunguje", barva: "red" },
  nenastaveno: { popis: "Nekontroluje se", barva: "grey" },
};

const ProvozInner = () => {
  const [hodin, setHodin] = useState("24");
  const [jenChyby, setJenChyby] = useState(false);
  const [sKontrolami, setSKontrolami] = useState(false);

  const { data, isLoading, isFetching } = useQuery<Odpoved>({
    queryKey: ["operations-provoz", hodin, jenChyby, sKontrolami],
    queryFn: () =>
      sdk.client.fetch("/admin/operations/provoz", {
        query: {
          hodin,
          ...(jenChyby ? { stav: "chyba" } : {}),
          ...(sKontrolami ? { kontroly: "1" } : {}),
        },
      }),
    placeholderData: (predchozi) => predchozi,
  });

  const zaznamy = data?.zaznamy ?? [];
  const chyb = (data?.soucty ?? []).reduce((soucet, s) => soucet + s.chyby, 0);

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <Heading level="h1">Provoz</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Co se v obchodě dělo a co z toho neprošlo. Totéž chodí večer
            e-mailem.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={hodin} onValueChange={setHodin}>
            <Select.Trigger className="w-52 max-w-full">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {OKNA.map((okno) => (
                <Select.Item key={okno.hodnota} value={okno.hodnota}>
                  {okno.popis}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Button
            size="small"
            variant={jenChyby ? "primary" : "secondary"}
            onClick={() => setJenChyby((predchozi) => !predchozi)}
          >
            Jen co selhalo
          </Button>
          <Button
            size="small"
            variant="secondary"
            isLoading={isFetching && sKontrolami}
            onClick={() => setSKontrolami(true)}
          >
            Zkontrolovat teď
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="px-6 py-4">
          <Skeleton className="h-24 rounded-lg" />
        </div>
      )}

      {data?.kontroly?.length ? (
        <div className="px-6 py-4">
          <Text size="small" weight="plus" className="mb-3">
            Kontroly
          </Text>
          <div className="flex flex-col gap-2">
            {data.kontroly.map((kontrola) => (
              <div
                key={kontrola.klic}
                className="flex flex-wrap items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <Text size="small" weight="plus">
                    {kontrola.nazev}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {kontrola.zprava}
                  </Text>
                  {kontrola.detail?.length ? (
                    <ul className="mt-1">
                      {kontrola.detail.map((radek, index) => (
                        <li
                          key={`${kontrola.klic}-${index}`}
                          className="text-ui-fg-muted txt-compact-xsmall"
                        >
                          {radek}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <Badge size="2xsmall" color={stavKontroly[kontrola.stav].barva}>
                  {stavKontroly[kontrola.stav].popis}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!isLoading && (data?.soucty?.length ?? 0) > 0 && (
        <div className="px-6 py-4">
          <Text size="small" weight="plus" className="mb-3">
            Co se stalo {chyb ? `· ${chyb}× to neprošlo` : ""}
          </Text>
          <div className="grid gap-2 md:grid-cols-2">
            {data?.soucty.map((soucet) => (
              <div
                key={soucet.druh}
                className="flex items-center justify-between gap-2"
              >
                <Text size="small">{soucet.nazev}</Text>
                <div className="flex items-center gap-2">
                  <Badge size="2xsmall" color="grey">
                    {soucet.ok}× proběhlo
                  </Badge>
                  {soucet.chyby ? (
                    <Badge size="2xsmall" color="red">
                      {soucet.chyby}× selhalo
                    </Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && zaznamy.length === 0 && (
        <EmptyState
          title="Zatím nic"
          description={
            jenChyby
              ? "V tomhle okně nic neselhalo."
              : "V tomhle okně se nic nezapsalo."
          }
        />
      )}

      {zaznamy.length > 0 && (
        <div className="divide-y">
          {zaznamy.map((zaznam) => (
            <article
              key={zaznam.id}
              className="flex flex-wrap items-start justify-between gap-2 px-6 py-3"
            >
              <div className="min-w-0">
                <Text size="small" weight="plus" className="break-all">
                  {zaznam.action}
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted mt-1">
                  {formatDateTime(zaznam.created_at)}
                  {zaznam.actor ? ` · ${zaznam.actor}` : ""}
                  {typeof zaznam.duration_ms === "number"
                    ? ` · ${zaznam.duration_ms} ms`
                    : ""}
                  {zaznam.ref_id ? ` · ${zaznam.ref_type} ${zaznam.ref_id}` : ""}
                </Text>
                {zaznam.summary ? (
                  <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                    {zaznam.summary}
                  </Text>
                ) : null}
                {zaznam.detail?.chyba ? (
                  <Text size="xsmall" className="text-ui-fg-error mt-1 break-all">
                    {String(zaznam.detail.chyba)}
                  </Text>
                ) : null}
              </div>
              <Badge
                size="2xsmall"
                color={zaznam.status === "chyba" ? "red" : "green"}
              >
                {zaznam.status === "chyba" ? "Selhalo" : "Proběhlo"}
              </Badge>
            </article>
          ))}
        </div>
      )}
    </Container>
  );
};

const queryClient = adminQueryClient;

const ProvozPage = () => (
  <QueryClientProvider client={queryClient}>
    <ProvozInner />
  </QueryClientProvider>
);

export default ProvozPage;
