import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ExclamationCircle } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  Switch,
  Text,
  Toaster,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sdk } from "../../lib/sdk";
import { adminQueryClient } from "../../lib/query-client";

/**
 * Zkušební režim — stránka, na které se pozná, jestli obchod jede naostro.
 *
 * ## Proč to má vlastní stránku
 *
 * Vyzkoušet celou cestu objednávky na živém obchodě znamená vyrobit
 * objednávky, které nejsou skutečné. E-maily to přežijí. Účetnictví ne:
 * iDoklad vystaví fakturu, vytrhne číslo z číselné řady a to číslo se
 * nevrací — deset zkoušek udělá deset děr, které pak někdo vysvětluje.
 *
 * ## Proč jsou tu dva různé druhy řádků
 *
 * **Přepínač** opravdu přepíná: vypne vystavování faktur, hned a bez
 * restartu.
 *
 * **Stav ComGate** se jen ukazuje. Platební poskytovatel dostává „zkušební"
 * z konfigurace při startu a k nastavení obchodu se za běhu nedostane, takže
 * by přepínač lhal. Stránka proto říká, co platí, a vedle toho napíše
 * proměnnou, kterou se to mění. Tichý nesoulad mezi zaškrtnutým políčkem
 * a tím, kam jdou peníze, je přesně ten druh chyby, kterou nikdo nenajde včas.
 */

type Stav = {
  test_mode_enabled: boolean;
  comgate_test: boolean;
  idoklad_configured: boolean;
  idoklad_active: boolean;
};

const Inner = () => {
  const queryClient = useQueryClient();

  const { data: stav } = useQuery<Stav>({
    queryKey: ["test-mode"],
    queryFn: () => sdk.client.fetch("/admin/workbench/test-mode"),
    refetchOnWindowFocus: true,
  });

  const { data: settings } = useQuery<{ settings: any }>({
    queryKey: ["merchant-settings"],
    queryFn: () => sdk.client.fetch("/admin/merchant-settings"),
  });

  const [zkusebni, setZkusebni] = useState(false);

  useEffect(() => {
    const s = settings?.settings;
    if (!s) return;
    setZkusebni(Boolean(s.test_mode_enabled));
  }, [settings]);

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/merchant-settings", {
        method: "POST",
        body: { test_mode_enabled: zkusebni },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["merchant-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["test-mode"] });
      toast.success(
        zkusebni
          ? "Zkušební režim zapnut — faktury se nevystavují."
          : "Zkušební režim vypnut — faktury se zase vystavují."
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Uložení se nepodařilo."
      ),
  });

  /* Uložené proti tomu, co je na obrazovce — aby „Uložit" nesvítilo nadarmo. */
  const zmeneno =
    settings?.settings !== undefined &&
    Boolean(settings.settings.test_mode_enabled) !== zkusebni;

  return (
    <Container className="divide-y p-0">
      <Toaster />

      <header className="px-6 pb-4 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Heading>Zkušební režim</Heading>
          {stav && (
            <Badge
              color={stav.test_mode_enabled || stav.comgate_test ? "orange" : "green"}
              size="small"
            >
              {stav.test_mode_enabled || stav.comgate_test
                ? "Obchod jede nanečisto"
                : "Ostrý provoz"}
            </Badge>
          )}
        </div>
        <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
          Než se zkouší objednávání na živém obchodě, patří sem zapnout zkušební
          režim. Faktury se pak nevystavují — číslo z účetní řady se vytrhnout
          nedá vrátit.
        </Text>
      </header>

      <section className="flex items-start justify-between gap-6 px-6 py-5">
        <div className="max-w-xl">
          <Text weight="plus">Zkušební režim</Text>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Zapnuto: iDoklad nevystaví žádnou fakturu ani ji neoznačí jako
            zaplacenou. Objednávky, e-maily i platby běží dál jako obvykle —
            jen se neúčtuje.
          </Text>
        </div>
        <Switch checked={zkusebni} onCheckedChange={setZkusebni} />
      </section>

      <section className="px-6 py-5">
        <Text weight="plus">Co z toho právě platí</Text>

        <dl className="mt-3 grid gap-3">
          <div className="flex items-center justify-between gap-4">
            <dt>
              <Text size="small">Faktury v iDokladu</Text>
              {stav && !stav.idoklad_configured && (
                <Text size="xsmall" className="text-ui-fg-muted mt-1">
                  iDoklad nemá vyplněné přihlašovací údaje, takže se
                  nevystavují tak jako tak.
                </Text>
              )}
            </dt>
            <dd>
              <Badge
                color={stav?.idoklad_active ? "green" : "grey"}
                size="small"
              >
                {stav?.idoklad_active ? "Vystavují se" : "Nevystavují se"}
              </Badge>
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4">
            <dt className="max-w-xl">
              <Text size="small">Platby ComGate</Text>
              <Text size="xsmall" className="text-ui-fg-muted mt-1">
                Tohle se přepíná proměnnou <code>COMGATE_TEST</code> a projeví
                se až po restartu — poskytovatel plateb si ji čte při startu
                a k nastavení obchodu se nedostane. Přepínač výš na ni nesahá,
                aby stránka netvrdila něco jiného, než kam jdou peníze.
              </Text>
            </dt>
            <dd>
              <Badge
                color={stav?.comgate_test ? "orange" : "green"}
                size="small"
              >
                {stav?.comgate_test ? "Zkušební" : "Ostré"}
              </Badge>
            </dd>
          </div>
        </dl>
      </section>

      <footer className="flex items-center gap-3 px-6 py-4">
        <Button
          size="small"
          disabled={!zmeneno}
          isLoading={save.isPending}
          onClick={() => save.mutate()}
        >
          Uložit
        </Button>
        {zmeneno && (
          <Text size="small" className="text-ui-fg-subtle">
            Neuložená změna.
          </Text>
        )}
      </footer>
    </Container>
  );
};

const queryClient = adminQueryClient;

const Page = () => (
  <QueryClientProvider client={queryClient}>
    <Inner />
  </QueryClientProvider>
);

export const config = defineRouteConfig({
  label: "Zkušební režim",
  icon: ExclamationCircle,
  rank: 101,
});

export default Page;
