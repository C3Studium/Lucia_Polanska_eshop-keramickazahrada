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

type ProductionOrder = {
  id: string;
  internal_note?: string | null;
  customer_specification?: string | null;
  customer_note?: string | null;
  customer_photos?: string[];
};

type ProductionResponse = {
  production_order?: ProductionOrder | null;
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

  const [note, setNote] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (production) setNote(production.internal_note || "");
  }, [production]);

  const saveNote = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/made-to-order/orders/${order.id}/actions`, {
        method: "POST",
        body: { action: "set_internal_note", internal_note: note },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["made-to-order-order", order.id],
      });
      toast.success("Interní poznámka uložena");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Poznámku se nepodařilo uložit"
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

  const wish = production.customer_specification || production.customer_note;
  const photos = Array.isArray(production.customer_photos)
    ? production.customer_photos
    : [];

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Od zákazníka</Heading>
      </div>

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
            onClick={() => saveNote.mutate()}
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
