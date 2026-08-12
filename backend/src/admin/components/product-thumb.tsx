import { Plus } from "@medusajs/icons";
import { FocusModal, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";

/**
 * Product thumbnail + full-size photo lightbox, shared by every admin list
 * that shows pieces (Rozdělení, Produkty+).
 *
 * Picking by name alone is guesswork in a catalogue where half the pieces are
 * „Kytka …" — the photo is how she recognises them. A list-sized thumb is
 * enough to recognise a piece, not to check its details, so with `onZoom` the
 * thumb becomes a button (hover shows „+") that opens the photos full-size.
 * `shrink-0` is load-bearing: without it a crowded flex row squeezes the
 * image into a sliver.
 */
export const Thumb = ({
  src,
  title,
  onZoom,
  sizeClassName = "size-8",
}: {
  src?: string | null;
  title: string;
  onZoom?: () => void;
  sizeClassName?: string;
}) => {
  if (src && onZoom) {
    return (
      <button
        type="button"
        title="Zvětšit fotku"
        onClick={(e) => {
          /* Lists render thumbs inside <label>s — without this, the click
             would also toggle the row's checkbox. */
          e.preventDefault();
          e.stopPropagation();
          onZoom();
        }}
        className={`group bg-ui-bg-subtle shadow-borders-base relative flex ${sizeClassName} shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-md`}
      >
        <img src={src} alt="" className="size-full object-cover" />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Plus />
        </span>
      </button>
    );
  }
  return (
    <div
      className={`bg-ui-bg-subtle shadow-borders-base flex ${sizeClassName} shrink-0 items-center justify-center overflow-hidden rounded-md`}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span className="text-ui-fg-muted text-[10px] font-medium">
          {title?.slice(0, 1).toLocaleUpperCase("cs") || "–"}
        </span>
      )}
    </div>
  );
};

/**
 * The modal behind the thumbs: all photos of the clicked piece, full size,
 * fetched from the native product only when opened — lists carry just the
 * thumbnail.
 */
export const ProductLightbox = ({
  product,
  onClose,
}: {
  product: { id: string; title: string } | null;
  onClose: () => void;
}) => {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["product-lightbox", product?.id],
    queryFn: () =>
      sdk.client.fetch(
        `/admin/products/${product!.id}?fields=title,thumbnail,*images`
      ),
    enabled: Boolean(product),
  });

  const images: string[] = (() => {
    const record = data?.product;
    const urls = (record?.images ?? [])
      .map((image: any) => image?.url)
      .filter(Boolean);
    if (urls.length) return urls;
    return record?.thumbnail ? [record.thumbnail] : [];
  })();

  return (
    <FocusModal
      open={Boolean(product)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title asChild>
            <Heading>{product?.title ?? ""}</Heading>
          </FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center gap-6 overflow-y-auto p-6">
          {isLoading && (
            <Text size="small" className="text-ui-fg-subtle py-12">
              Načítám fotky…
            </Text>
          )}
          {!isLoading && images.length === 0 && (
            <Text size="small" className="text-ui-fg-subtle py-12">
              Produkt zatím nemá žádné fotky — přidáte je přes Upravit.
            </Text>
          )}
          {!isLoading &&
            images.map((url) => (
              <img
                key={url}
                src={url}
                alt={product?.title ?? ""}
                className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
              />
            ))}
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  );
};
