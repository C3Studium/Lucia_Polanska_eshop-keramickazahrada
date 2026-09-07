import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Badge, Button, Container, Heading, Select, Text, toast } from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sdk } from "../lib/sdk";

/**
 * Profil dopravy u produktu — políčko, které nativní admin nemá.
 *
 * Bez profilu se produkt **nedá prodat**: Medusa při dokončení košíku porovnává
 * profil produktu s profilem zvolené dopravy, a produkt bez profilu se
 * neshodne s ničím. Objednávka spadne — ale až po zaplacení. Nativní stránka
 * produktu přitom profil nikde neukazuje ani nenabízí, takže se ta díra nedala
 * ani zjistit, ani zavřít; jediná cesta byla přes API.
 *
 * Zapisuje se běžnou cestou (`POST /admin/products/:id`), kterou Medusa umí —
 * `updateProductsWorkflow` starý odkaz zruší a založí nový. Chybí opravdu jen
 * to políčko.
 *
 * Pozor na pojmy: profil není „doprava". Na jednom profilu leží všechny
 * nabídky, které k němu patří — u téhle dílny pošta, Balíkovna i osobní odběr.
 * Přiřadit profil tedy znamená zpřístupnit všechny, ne vybrat jednu.
 */
const Inner = ({ productId }: { productId: string }) => {
  const queryClient = useQueryClient();
  const [vybrany, setVybrany] = useState<string>("");

  const { data: produkt } = useQuery<any>({
    queryKey: ["product-shipping-profile", productId],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/products/${productId}?fields=id,*shipping_profile`
      ),
  });

  const { data: profily } = useQuery<any>({
    queryKey: ["shipping-profiles"],
    queryFn: () => sdk.client.fetch("/admin/shipping-profiles?limit=100"),
  });

  const soucasny = produkt?.product?.shipping_profile?.id ?? "";

  // Až po načtení: dokud se neví, co produkt má, není co předvybrat.
  useEffect(() => {
    setVybrany(soucasny);
  }, [soucasny]);

  const ulozit = useMutation({
    mutationFn: (shipping_profile_id: string) =>
      sdk.client.fetch(`/admin/products/${productId}`, {
        method: "POST",
        body: { shipping_profile_id },
      }),
    onSuccess: () => {
      toast.success("Profil dopravy uložen.");
      queryClient.invalidateQueries({
        queryKey: ["product-shipping-profile", productId],
      });
    },
    onError: (error: any) =>
      toast.error(error?.message ?? "Profil se nepodařilo uložit."),
  });

  if (!produkt) return null;

  const nabidka: any[] = profily?.shipping_profiles ?? [];
  const zmeneno = vybrany !== soucasny && Boolean(vybrany);

  return (
    <Container className="flex flex-col gap-y-3 p-4">
      <div className="flex items-center justify-between">
        <Heading level="h2">Doprava</Heading>
        {soucasny ? (
          <Badge size="2xsmall" color="green">Lze objednat</Badge>
        ) : (
          <Badge size="2xsmall" color="red">Nelze objednat</Badge>
        )}
      </div>

      {!soucasny && (
        <Text size="xsmall" className="text-ui-fg-error">
          Produkt nemá profil dopravy. Zákazník ho vloží do košíku, zaplatí —
          a objednávka teprve pak spadne. Vyberte profil níž.
        </Text>
      )}

      <Select value={vybrany} onValueChange={setVybrany}>
        <Select.Trigger>
          <Select.Value placeholder="Bez profilu" />
        </Select.Trigger>
        <Select.Content>
          {nabidka.map((profil: any) => (
            <Select.Item key={profil.id} value={profil.id}>
              {profil.name}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>

      <Text size="xsmall" className="text-ui-fg-subtle">
        Profil zpřístupní všechny dopravy, které na něm leží — u výchozího
        profilu poštu, Balíkovnu i osobní odběr.
      </Text>

      <Button
        size="small"
        variant="secondary"
        disabled={!zmeneno || ulozit.isPending}
        onClick={() => ulozit.mutate(vybrany)}
      >
        {ulozit.isPending ? "Ukládám…" : "Uložit profil"}
      </Button>
    </Container>
  );
};

const queryClient = new QueryClient();
const Widget = ({ data }: { data: { id: string } }) => (
  <QueryClientProvider client={queryClient}>
    <Inner productId={data.id} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({ zone: "product.details.side.after" });
export default Widget;
