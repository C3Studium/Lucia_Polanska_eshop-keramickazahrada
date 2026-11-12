import type { AdminOrder } from "@medusajs/framework/types";
import {
  Badge,
  Button,
  Container,
  Heading,
  Skeleton,
  Text,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";
import { useExpertMode } from "../lib/expert-mode";
import { isCeskaPosta, isPersonalPickup } from "../lib/cp-shipping";
import {
  otevritStitek,
  sdiletStitek,
  stahnoutStitek,
  type StitekZasilky,
} from "../lib/stitky";
import { ceskaChyba } from "../lib/ceska-chyba";
import { reloadOrderPageSoon } from "../lib/reload-order-page";

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

/**
 * Štítek České pošty na detailu objednávky (doplněk k frontě Denní práce).
 *
 * „Vygenerovat štítek" podá zásilku ČP (vznikne štítek + číslo zásilky) BEZ
 * odeslání — objednávka zůstane „K odeslání" a zákazníkovi nic nechodí, to až
 * na „Označit jako odeslané". Štítek se uloží do úložiště (MinIO), ať
 * nezávisí jen na jednom záznamu (ČP nemá reprint). Pak jde stáhnout (soubor
 * `Stitek-Jmeno-Prijmeni-0026.pdf`), sdílet do telefonu (tisk přes mobil) nebo
 * otevřít. Jen pro zásilky ČP; osobní odběr a jiní dopravci widget skryjí.
 *
 * Vykresluje ho „Práce s objednávkou" (`order-workspace.tsx`) hned pod Denní
 * prací. Testovací generování je jen v expertním režimu (3. 11. 2026).
 */
export const CpLabelPanel = ({ order }: { order: AdminOrder }) => {
  const queryClient = useQueryClient();
  const expert = useExpertMode();

  // Sdílené s widgetem sledování (lib/cp-shipping.ts), ať se oba shodnou.
  const ceskaPosta = isCeskaPosta(order);
  const personalPickup = isPersonalPickup(order);

  const labelQuery = useQuery<LabelResponse>({
    queryKey: ["cp-label", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}/label`, {
        method: "GET",
      }),
    retry: false,
    // Jen pro zásilky ČP, které nejsou osobní odběr.
    enabled: ceskaPosta && !personalPickup,
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
        // Štítek zakládá nativní plnění → ať záhlaví a Nesplněné položky sedí.
        reloadOrderPageSoon();
      } else {
        toast.info(result.reason ?? "Štítek se zatím nepodařilo vytvořit");
      }
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Štítek se nepodařilo vygenerovat")
      ),
  });

  /*
   * Fáze z Denní práce — stejný klíč i adresa jako karta nad námi, takže
   * jde o jednu odpověď, žádný dotaz navíc.
   */
  const stageQuery = useQuery<{ merchant_order: { stage?: string } | null }>({
    queryKey: ["merchant-order-state", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/merchant-orders/${order.id}`, { method: "GET" }),
    retry: false,
    enabled: ceskaPosta && !personalPickup,
  });

  // Osobní odběr ani cizí dopravce tu nemají co dělat.
  if (!ceskaPosta || personalPickup) {
    return null;
  }

  const data = labelQuery.data;
  const label = data?.labels?.[0] ?? null;

  /*
   * Hotová objednávka bez štítku: karta ZŮSTÁVÁ.
   *
   * Od 3. 11. 2026 se tady schovávala, ať u odeslané zásilky nestraší oranžové
   * „Zatím bez štítku". Tím ale zmizela i jediná cesta ke štítku — a kdo ji
   * hledá, nemá jak poznat, že karta vůbec existuje (hlášeno 5. 11. 2026).
   * Místo schování se tedy jen utiší: šedý odznak a věta, proč štítek není.
   */
  const stage = stageQuery.data?.merchant_order?.stage;
  const hotovo = stage === "shipped" || stage === "cancelled";
  const zrusena = stage === "cancelled";
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
        ) : hotovo ? (
          /* Odeslanou ani zrušenou objednávku už nikdo neurguje — šedě. */
          <Badge color="grey">Bez štítku</Badge>
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
                    {zrusena
                      ? "Objednávka je zrušená — štítek se k ní nevystavuje."
                      : hotovo
                        ? "Objednávka je označená jako odeslaná a štítek u ní nemáme — zásilka šla mimo systém a Česká pošta štítek znovu nevydá. Jestli část objednávky ještě leží, podat ji jde i teď."
                        : /* Ve fázi „K odeslání" je zásilka připravená — hláška backendu
                             „Nejdřív ji připravte k odeslání" (vrací ji, dokud nemá plnění,
                             a plnění vzniká až štítkem) tu majitelku posílala o krok zpět
                             (živý test 13. 11. 2026, objednávka #70). */
                          stage === "shipping"
                          ? "Zatím bez štítku. Podáním u České pošty vznikne štítek i číslo zásilky."
                          : (data?.reason ??
                            "Zatím bez štítku. Podáním u České pošty vznikne štítek i číslo zásilky.")}
                  </Text>
                  {/* Zrušená objednávka se nepodává — tlačítko by lhalo. */}
                  {!zrusena && (
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
                      {expert && (
                        <Button
                          size="small"
                          variant="secondary"
                          isLoading={generate.isPending && generate.variables === true}
                          disabled={generate.isPending}
                          onClick={() => generate.mutate(true)}
                        >
                          Testovací generování
                        </Button>
                      )}
                    </div>
                  )}
                  {expert && !zrusena && (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      Testovací generování použije zkušební výdejnu, kterou ČP
                      testovací prostředí zná (reálnou výdejnu z widgetu test odmítá
                      přes chybu 247). Slouží jen k ověření, jak štítek vypadá, že
                      dorazí e-mailem a jak se uloží — reálnou výdejnu objednávky
                      nemění.
                    </Text>
                  )}
                </div>
              )
            )}
          </>
        )}
      </div>
    </Container>
  );
};
