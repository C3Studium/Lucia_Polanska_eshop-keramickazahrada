import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import {
  Badge,
  Button,
  Container,
  Heading,
  Skeleton,
  Text,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { sdk } from "../lib/sdk";
import { adminQueryClient } from "../lib/query-client";
import {
  otevritStitek,
  sdiletStitek,
  stahnoutStitek,
  type StitekZasilky,
} from "../lib/stitky";

const queryClient = adminQueryClient;

type LabelResponse = {
  available: boolean;
  reason?: string;
  labels: Array<StitekZasilky>;
  destination?: {
    type: "balikovna";
    zip: string | null;
    name: string | null;
    address: string | null;
    address_line: string | null;
  } | null;
  warnings?: string[];
  credentials_ready?: boolean;
  label_url?: string | null;
  filename?: string | null;
  generated_at?: string | null;
};

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Štítek České pošty na detailu objednávky (doplněk k frontě Denní práce).
 *
 * „Vygenerovat štítek" podá zásilku ČP (vznikne štítek + číslo zásilky) BEZ
 * odeslání — objednávka zůstane „K odeslání" a zákazníkovi nic nechodí, to až
 * na „Označit jako odeslané". Štítek se uloží do úložiště (MinIO), ať
 * nezávisí jen na jednom záznamu (ČP nemá reprint). Pak jde stáhnout (soubor
 * `Stitek-Jmeno-Prijmeni-0026.pdf`), sdílet do telefonu (tisk přes mobil) nebo
 * otevřít. Jen pro zásilky ČP; osobní odběr a jiní dopravci widget skryjí.
 */
const CpLabelWidgetInner = ({ order }: { order: AdminOrder }) => {
  const queryClient = useQueryClient();

  const methods = (order.shipping_methods ?? []) as any[];
  const isPersonalPickup = methods.some((method) => {
    const data = method?.data || {};
    return data.personal_pickup === true || data.service_code === "PICKUP";
  });
  const isCeskaPosta = methods.some((method) => {
    const data = method?.data || {};
    const provider = String(method?.shipping_option?.provider_id ?? "");
    const name = fold(String(method?.name ?? ""));
    return (
      provider.includes("ceska-posta") ||
      data.service_code === "NB" ||
      data.service_code === "DR" ||
      name.includes("balikovna") ||
      name.includes("balik") ||
      name.includes("posta")
    );
  });

  const labelQuery = useQuery<LabelResponse>({
    queryKey: ["cp-label", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}/label`, {
        method: "GET",
      }),
    retry: false,
    // Jen pro zásilky ČP, které nejsou osobní odběr.
    enabled: isCeskaPosta && !isPersonalPickup,
  });

  const generate = useMutation<LabelResponse, Error, boolean>({
    mutationFn: (test: boolean) =>
      sdk.client.fetch(
        `/admin/merchant-orders/${order.id}/label${test ? "?test=1" : ""}`,
        { method: "POST" }
      ),
    onSuccess: async (result, test) => {
      await queryClient.invalidateQueries({ queryKey: ["cp-label", order.id] });
      if (result.available) {
        toast.success(
          test
            ? "Testovací štítek vygenerován (zkušební výdejna) — zkontrolujte PDF a e-mail"
            : "Štítek byl vygenerován a uložen u objednávky"
        );
      } else {
        toast.info(result.reason ?? "Štítek se zatím nepodařilo vytvořit");
      }
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Štítek se nepodařilo vygenerovat"
      ),
  });

  // Osobní odběr ani cizí dopravce tu nemají co dělat.
  if (!isCeskaPosta || isPersonalPickup) {
    return null;
  }

  const data = labelQuery.data;
  const label = data?.labels?.[0] ?? null;
  const filename =
    data?.filename || `Stitek-objednavka-${order.display_id ?? ""}.pdf`;

  const handleShare = async () => {
    if (!label) return;
    const result = await sdiletStitek(label, filename);
    if (result === "unsupported") {
      // Na počítači sdílení souboru většinou nejede — stáhneme místo toho.
      stahnoutStitek(label, filename);
      toast.info("Sdílení na tomhle zařízení nejde — štítek se stáhl.");
    } else if (result === "error") {
      toast.error("Sdílení se nepodařilo.");
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-2 px-6 py-4">
        <Heading level="h2">Štítek České pošty</Heading>
        {data?.available ? (
          <Badge color="green">Vygenerováno</Badge>
        ) : data?.credentials_ready === false ? (
          <Badge color="grey">Čeká na přístupy</Badge>
        ) : (
          <Badge color="orange">Zatím bez štítku</Badge>
        )}
      </div>

      <div className="flex flex-col gap-y-4 px-6 py-4">
        {labelQuery.isLoading && <Skeleton className="h-20 rounded-lg" />}

        {!labelQuery.isLoading && (
          <>
            {/* Kam zásilka jede — kontrola řetězu checkout → objednávka → štítek. */}
            {data?.destination?.address_line && (
              <div>
                <Text size="xsmall" className="text-ui-fg-muted uppercase">
                  Doručení
                </Text>
                <Text size="small" className="mt-1">
                  {data.destination.address_line}
                </Text>
              </div>
            )}

            {(data?.warnings ?? []).map((warning, index) => (
              <Text key={index} size="small" className="text-ui-fg-error">
                {warning}
              </Text>
            ))}

            {data?.credentials_ready === false && (
              <Text size="small" className="text-ui-fg-subtle">
                {data.reason ??
                  "Štítek zatím nejde vytvořit — čekáme na přístupy k České poště."}
              </Text>
            )}

            {data?.available && label ? (
              <div className="flex flex-col gap-y-3">
                {label.tracking_number && (
                  <div>
                    <Text size="xsmall" className="text-ui-fg-muted uppercase">
                      Číslo zásilky
                    </Text>
                    <Text size="small" weight="plus" className="mt-1">
                      {label.tracking_number}
                    </Text>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="small"
                    variant="primary"
                    onClick={() => {
                      if (!stahnoutStitek(label, filename)) {
                        toast.error("Štítek se nepodařilo stáhnout.");
                      }
                    }}
                  >
                    Stáhnout
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={handleShare}
                  >
                    Sdílet / vytisknout
                  </Button>
                  <Button
                    size="small"
                    variant="transparent"
                    onClick={() => {
                      if (!otevritStitek(label)) {
                        toast.error("Štítek se nepodařilo otevřít.");
                      }
                    }}
                  >
                    Otevřít
                  </Button>
                </div>

                <Text size="xsmall" className="text-ui-fg-muted">
                  Soubor: {filename}
                  {data.generated_at
                    ? ` · vytvořeno ${new Date(
                        data.generated_at
                      ).toLocaleString("cs-CZ")}`
                    : ""}
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Objednávka se tím neoznačí jako odeslaná — to až tlačítkem
                  „Označit jako odeslané" v Denní práci.
                </Text>
              </div>
            ) : (
              data?.credentials_ready !== false && (
                <div className="flex flex-col gap-y-2">
                  <Text size="small" className="text-ui-fg-subtle">
                    {data?.reason ??
                      "Zatím bez štítku. Podáním u České pošty vznikne štítek i číslo zásilky."}
                  </Text>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="small"
                      variant="primary"
                      isLoading={generate.isPending && generate.variables !== true}
                      disabled={generate.isPending}
                      onClick={() => generate.mutate(false)}
                    >
                      Vygenerovat štítek pro Českou poštu
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      isLoading={generate.isPending && generate.variables === true}
                      disabled={generate.isPending}
                      onClick={() => generate.mutate(true)}
                    >
                      Testovací generování
                    </Button>
                  </div>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Testovací generování použije zkušební výdejnu, kterou ČP
                    testovací prostředí zná (reálnou výdejnu z widgetu test odmítá
                    přes chybu 247). Slouží jen k ověření, jak štítek vypadá, že
                    dorazí e-mailem a jak se uloží — reálnou výdejnu objednávky
                    nemění.
                  </Text>
                </div>
              )
            )}
          </>
        )}
      </div>
    </Container>
  );
};

const CpLabelWidget = ({ data }: DetailWidgetProps<AdminOrder>) => (
  <QueryClientProvider client={queryClient}>
    <CpLabelWidgetInner order={data} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
  id: "keramicka-zahrada:cp-label",
});

export default CpLabelWidget;
