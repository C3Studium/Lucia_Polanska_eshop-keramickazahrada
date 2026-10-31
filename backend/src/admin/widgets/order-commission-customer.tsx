import { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import {
  Container,
  Heading,
  Skeleton,
  Text,
  Textarea,
  Button,
  toast,
} from "@medusajs/ui";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sdk } from "../lib/sdk";
import { adminQueryClient } from "../lib/query-client";
import { ProductionDiary } from "../components/production-diary";
import { ceskaChyba } from "../lib/ceska-chyba";

type ProductionOrder = {
  id: string;
  internal_note?: string | null;
  customer_specification?: string | null;
  customer_note?: string | null;
  customer_photos?: string[];
  /** Zadání po kusech (řádek s množstvím > 1); jeden kus = jeden prvek. */
  customer_pieces?: { specification: string; photos: string[] }[];
  line_title?: string | null;
  line_variant_title?: string | null;
  line_thumbnail?: string | null;
};

type ProductionResponse = {
  production_order?: ProductionOrder | null;
  production_orders?: ProductionOrder[];
};

/** Jeden kus jedné zakázky objednávky — to, mezi čím se přepíná. */
type Slot = {
  key: string;
  production: ProductionOrder;
  piece: number;
  ofLine: number;
  title: string;
  thumbnail: string | null;
  wish: string;
  photos: string[];
};

type DiaryNote = {
  id: string;
  text: string | null;
  image_url: string | null;
  author?: "customer" | "atelier";
  created_at: string;
};

const queryClient = adminQueryClient;

/**
 * Co zákazník poslal k zakázce — vedle „Zákazník" v pravém baru.
 *
 * Workflow-wise to patří k zákazníkovi: jeho přání (text) + fotky (klik =
 * celá obrazovka), a pod tím vlastní interní poznámka ateliéru. Dřív to bylo
 * zamíchané v hlavním bloku „Výroba na zakázku"; tady je to přehlednější.
 */
const OrderCommissionCustomerInner = ({ order }: { order: AdminOrder }) => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery<ProductionResponse>({
    queryKey: ["made-to-order-order", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${order.id}`, {
        method: "GET",
      }),
    retry: false,
  });
  const production = data?.production_order;
  /*
   * Objednávka může mít zakázek víc (jedna na položku) a každá položka víc
   * kusů — a každý kus má vlastní zadání a fotky. Do 31. 10. 2026 se tu
   * ukazovala jen PRVNÍ zakázka a všechno slité dohromady: „Kus 1: … / Kus
   * 2: …" v jednom odstavci a fotky obou kusů na jedné hromadě. Teď se mezi
   * nimi přepíná stejně jako v pokladně.
   */
  const commissions: ProductionOrder[] =
    data?.production_orders?.length
      ? data.production_orders
      : production
        ? [production]
        : [];
  const [activeIndex, setActiveIndex] = useState(0);

  // Celé vlákno — ať „Od zákazníka" ukazuje to NEJNOVĚJŠÍ, co zákazník poslal
  // (ne jen původní zadání z objednávky). Sdílí klíč s drawerem konverzace,
  // takže se po odpovědi/nové zprávě obnoví obojí najednou. Backend řadí DESC.
  const notesQuery = useQuery<{ notes: DiaryNote[] }>({
    queryKey: ["production-diary", order.id],
    queryFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${order.id}/notes`),
    retry: false,
  });

  const [note, setNote] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  /*
   * Interní poznámka patří ZAKÁZCE, ne kusu — kusy jedné položky ji sdílejí.
   * Která zakázka je na řadě, plyne z přepínače: kusy se do seznamu skládají
   * v pořadí zakázek, takže `activeIndex` stačí přepočítat přes jejich počty.
   * Bez `production_order_id` při ukládání by se u víc zakázek poznámky
   * přepisovaly navzájem.
   */
  const pocetKusu = (commission: ProductionOrder) =>
    Math.max(1, commission.customer_pieces?.length ?? 1);
  const aktivniZakazka = (() => {
    let zbyva = activeIndex;
    for (const commission of commissions) {
      const kusu = pocetKusu(commission);
      if (zbyva < kusu) return commission;
      zbyva -= kusu;
    }
    return commissions[0] ?? production ?? null;
  })();

  useEffect(() => {
    setNote(aktivniZakazka?.internal_note || "");
  }, [aktivniZakazka?.id, aktivniZakazka?.internal_note]);

  const saveNote = useMutation({
    mutationFn: (productionOrderId: string | null) =>
      sdk.client.fetch(`/admin/made-to-order/orders/${order.id}/actions`, {
        method: "POST",
        body: {
          action: "set_internal_note",
          internal_note: note,
          ...(productionOrderId ? { production_order_id: productionOrderId } : {}),
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["made-to-order-order", order.id],
      });
      toast.success("Interní poznámka uložena");
    },
    onError: (error) =>
      toast.error(
        ceskaChyba(error, "Poznámku se nepodařilo uložit")
      ),
  });

  if (isLoading) {
    return (
      <Container>
        <Skeleton className="h-28 rounded-lg" />
      </Container>
    );
  }
  if (isError || !production) return null;

  // „Od zákazníka" = to NEJNOVĚJŠÍ dle data. Zprávy zákazníka (vlákno) chodí
  // DESC z backendu; původní zadání z objednávky (metadata) slouží jako záloha,
  // když ještě žádná zpráva není. Fotky řadíme nejnovější první a odduplikujeme
  // (původní zadání se do vlákna zrcadlí, URL by se jinak objevila dvakrát).
  const customerNotes = (notesQuery.data?.notes ?? []).filter(
    (note) => note.author === "customer"
  );
  const notePhotos = customerNotes
    .map((note) => note.image_url)
    .filter((url): url is string => Boolean(url));
  /* Nejnovější zpráva z vlákna patří zakázce jako celku, ne kusu — ukáže se
     u prvního kusu, kde ji majitelka hledá. */
  const latestMessage =
    customerNotes.find((note) => note.text && note.text.trim())?.text ?? "";

  const slots: Slot[] = commissions.flatMap((commission) => {
    const title =
      [commission.line_title, commission.line_variant_title]
        .filter((part) => part && part !== "Standardní" && part !== "Default")
        .join(" — ") || "Zakázka";
    const pieces =
      commission.customer_pieces?.length
        ? commission.customer_pieces
        : [
            {
              specification:
                commission.customer_specification || commission.customer_note || "",
              photos: Array.isArray(commission.customer_photos)
                ? commission.customer_photos
                : [],
            },
          ];
    return pieces.map((piece, index) => ({
      key: `${commission.id}:${index}`,
      production: commission,
      piece: index,
      ofLine: pieces.length,
      title,
      thumbnail: commission.line_thumbnail ?? null,
      wish:
        piece.specification?.trim() ||
        (index === 0 ? latestMessage : "") ||
        "",
      photos: Array.from(
        new Set([...(index === 0 ? notePhotos : []), ...(piece.photos ?? [])])
      ),
    }));
  });

  const index = Math.min(activeIndex, Math.max(0, slots.length - 1));
  const active = slots[index];
  const wish = active?.wish;
  const photos = active?.photos ?? [];
  const jdi = (delta: number) =>
    setActiveIndex((current) => {
      const base = Math.min(current, slots.length - 1);
      return (base + delta + slots.length) % slots.length;
    });

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-2 px-6 py-4">
        <Heading level="h2">Od zákazníka</Heading>
        {/* Celá konverzace se zákazníkem (deník zakázky) jako popup — jsou tam
            i NOVÉ zprávy od zákazníka, které se v bloku výš neukazovaly, a dá se
            rovnou odpovědět (odpověď viditelná zákazníkovi mu přijde e-mailem). */}
        <ProductionDiary
          orderId={order.id}
          label={`#${order.display_id}`}
          trigger={
            <Button size="small" variant="secondary">
              Konverzace se zákazníkem
            </Button>
          }
        />
      </div>

      {/*
        Přepínač kusů — jen od dvou nahoru. Vedle šipek jméno a pořadí, ať je
        poznat, čí zadání se zrovna čte; u jediného kusu je jedno číslo volba
        bez obsahu.
      */}
      {slots.length > 1 && active && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3">
          <div className="flex min-w-0 items-center gap-x-2">
            {active.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.thumbnail}
                alt=""
                className="size-8 shrink-0 rounded object-cover"
              />
            )}
            <div className="min-w-0">
              <Text size="small" weight="plus" className="truncate">
                {active.title}
              </Text>
              {active.ofLine > 1 && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  kus {active.piece + 1} z {active.ofLine}
                </Text>
              )}
            </div>
          </div>
          <div className="flex items-center gap-x-2">
            <Button
              size="small"
              variant="secondary"
              onClick={() => jdi(-1)}
              aria-label="Předchozí kus"
            >
              ‹
            </Button>
            <Text size="xsmall" className="text-ui-fg-subtle tabular-nums">
              {index + 1} / {slots.length}
            </Text>
            <Button
              size="small"
              variant="secondary"
              onClick={() => jdi(1)}
              aria-label="Další kus"
            >
              ›
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-y-4 px-6 py-4">
        <div>
          <Text size="xsmall" className="text-ui-fg-muted uppercase">
            Přání zákazníka
          </Text>
          <Text size="small" className="mt-1 whitespace-pre-wrap">
            {wish && wish.trim() ? wish : "Zákazník nepřidal žádný popis."}
          </Text>
        </div>

        {photos.length > 0 && (
          <div>
            <Text size="xsmall" className="text-ui-fg-muted uppercase">
              Fotky od zákazníka
            </Text>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {photos.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  className="bg-ui-bg-subtle shadow-borders-base aspect-square overflow-hidden rounded-lg"
                  onClick={() => setLightbox(url)}
                  title="Zobrazit přes celou obrazovku"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-y-2 px-6 py-4">
        <Text size="xsmall" className="text-ui-fg-muted uppercase">
          Interní poznámka
        </Text>
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Jen pro ateliér — zákazník ji nevidí…"
        />
        <div className="flex justify-end">
          <Button
            size="small"
            isLoading={saveNote.isPending}
            onClick={() => saveNote.mutate(aktivniZakazka?.id ?? null)}
          >
            Uložit poznámku
          </Button>
        </div>
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </Container>
  );
};

const OrderCommissionCustomerWidget = ({
  data,
}: DetailWidgetProps<AdminOrder>) => (
  <QueryClientProvider client={queryClient}>
    <OrderCommissionCustomerInner order={data} />
  </QueryClientProvider>
);

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
  id: "keramicka-zahrada:commission-customer",
});

export default OrderCommissionCustomerWidget;
