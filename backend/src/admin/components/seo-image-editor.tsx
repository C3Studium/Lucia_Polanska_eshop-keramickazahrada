import { Button, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sdk } from "../lib/sdk";
import { ceskaChyba } from "../lib/ceska-chyba";
import { PanelDrawer as Drawer } from "./panel-shell";

/**
 * „Fotka pro vyhledávače" (21. 11. 2026, Matěj) — okno z nabídky „…"
 * v Produkty+.
 *
 * Vybraná fotka jde na webu do náhledu odkazu (og:image — Seznam, Facebook,
 * sdílené odkazy) a jako první do strukturovaných dat výrobku, ze kterých
 * Google i Seznam berou obrázek do hledání obrázků. Google si nakonec vybírá
 * sám, tohle je nejsilnější nápověda, kterou dát jde. Bez volby platí náhled
 * kusu (thumbnail) jako dosud.
 *
 * Ukládá se adresa fotky do `metadata.seo_image` přes příznaky workbenche
 * (slučuje metadata — nativní zápis by je přepsal). Storefront volbu
 * použije jen dokud fotka u výrobku pořád je; po smazání fotky se vrátí
 * k náhledu sám.
 */
type Detail = {
  product: {
    thumbnail: string | null;
    images: { id: string; url: string }[] | null;
    metadata: Record<string, unknown> | null;
  };
};

export const SeoImageEditor = ({
  productId,
  productTitle,
  inline = false,
  onClose,
}: {
  productId: string;
  productTitle: string;
  inline?: boolean;
  onClose?: () => void;
}) => {
  const [open, setOpen] = useState(inline);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<Detail>({
    queryKey: ["seo-image", productId],
    queryFn: () =>
      sdk.client.fetch(`/admin/products/${productId}?fields=thumbnail,metadata,*images`),
    enabled: open,
  });

  const ulozena = typeof data?.product.metadata?.seo_image === "string" ? (data.product.metadata.seo_image as string) : "";
  const [vyber, setVyber] = useState("");
  useEffect(() => setVyber(ulozena), [ulozena]);

  /* Fotky v pořadí galerie; náhled navíc, kdyby v galerii nebyl. */
  const fotky = (() => {
    const urls = (data?.product.images ?? []).map((image) => image.url).filter(Boolean);
    const thumb = data?.product.thumbnail;
    if (thumb && !urls.includes(thumb)) urls.unshift(thumb);
    return urls;
  })();
  const nahled = data?.product.thumbnail ?? fotky[0] ?? null;
  /* Uložená fotka, která mezitím z výrobku zmizela, se chová jako bez volby. */
  const platna = vyber && fotky.includes(vyber) ? vyber : "";

  const ulozit = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/workbench/products/${productId}/flags`, {
        method: "POST",
        body: { seo_image: platna || null },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["seo-image", productId] });
      await queryClient.invalidateQueries({ queryKey: ["row-menu", productId] });
      toast.success(
        platna
          ? `${productTitle} — fotka pro vyhledávače uložena. Vyhledávače ji převezmou při další návštěvě stránky.`
          : `${productTitle} — vyhledávače dostanou náhled výrobku.`
      );
      setOpen(false);
    },
    onError: (error) => toast.error(ceskaChyba(error, "Uložení se nepodařilo.")),
  });

  const zmeneno = platna !== (ulozena && fotky.includes(ulozena) ? ulozena : "");

  return (
    <Drawer open={open} onOpenChange={setOpen} inline={inline} onClose={onClose}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Fotka pro vyhledávače — {productTitle}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex w-[min(420px,calc(100vw-24px))] flex-col gap-y-4">
          <Text size="small" className="text-ui-fg-subtle">
            Kterou fotku ukázat v Seznamu, Googlu a v náhledu sdíleného odkazu. Na stránce výrobku se nic
            nemění. Vyhledávač si ji vezme, až stránku znovu navštíví (obvykle za pár dní).
          </Text>

          {isLoading ? (
            <Text size="small" className="text-ui-fg-muted">Načítám fotky…</Text>
          ) : fotky.length === 0 ? (
            <Text size="small" className="text-ui-fg-muted">
              Výrobek zatím nemá žádnou fotku. Nahrajte ji v detailu výrobku.
            </Text>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setVyber("")}
                aria-pressed={!platna}
                className={`flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                  !platna ? "border-ui-border-interactive bg-ui-bg-highlight" : "border-ui-border-base"
                }`}
              >
                {nahled && <img src={nahled} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />}
                <span>
                  <span className="txt-compact-small-plus text-ui-fg-base block">Automaticky — náhled výrobku</span>
                  <span className="txt-compact-xsmall text-ui-fg-subtle block">Hlavní fotka z obchodu</span>
                </span>
              </button>

              <div className="grid grid-cols-3 gap-2">
                {fotky.map((url, index) => {
                  const zvolena = platna === url;
                  return (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setVyber(url)}
                      aria-pressed={zvolena}
                      aria-label={`Fotka ${index + 1}${zvolena ? " (vybraná)" : ""}`}
                      className={`relative aspect-square overflow-hidden rounded-lg border-2 ${
                        zvolena ? "border-ui-border-interactive" : "border-transparent"
                      }`}
                    >
                      <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      {zvolena && (
                        <span className="txt-compact-xsmall-plus bg-ui-button-inverted text-ui-fg-on-inverted absolute bottom-1 left-1 rounded px-1.5 py-0.5">
                          Vybraná
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Button size="small" disabled={!zmeneno || isLoading} isLoading={ulozit.isPending} onClick={() => ulozit.mutate()}>
            Uložit
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
