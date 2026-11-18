import { ChevronLeft, ChevronRight } from "@medusajs/icons";
import { Badge, Button, FocusModal, Heading, Text } from "@medusajs/ui";
import { useState, type DragEvent, type ReactNode } from "react";
import { movePhoto } from "./photo-strip-order";

/**
 * Fotky jako pás malých náhledů + prohlížeč jedné fotky (17. 11. 2026).
 *
 * Na detailu výrobku zabíraly fotky po 140 px celou první obrazovku a pod
 * každou visely dva textové úkony. Teď je to pás náhledů jako ve Fotkách na
 * Macu: kliknutí fotku zvětší a úkony (hlavní, smazat, posunout) jsou až
 * u velké fotky — tam, kde je vidět, na co se kliká.
 *
 * `ProductLightbox` z product-thumb.tsx se sem nehodí: ukazuje všechny fotky
 * pod sebou, načítá je znovu a úkony nemá.
 */
/**
 * Přetahování náhledů myší (18. 11. 2026) — sdílené pro galerii výrobku
 * i fotky variant. Bez `onReorder` nic nedělá. Vlastní typ dat, takže
 * oddíl Fotky (ten bere jen soubory „Files" z počítače) se nesplete.
 */
export const usePhotoDrag = (
  photos: string[],
  onReorder?: (next: string[]) => void
) => {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const reset = () => {
    setDragFrom(null);
    setDragOver(null);
  };
  const itemProps = (index: number, className = "") => ({
    className: `${className} transition-opacity ${dragFrom === index ? "opacity-40" : ""} ${
      onReorder ? "cursor-grab active:cursor-grabbing" : ""
    }`,
    draggable: Boolean(onReorder),
    onDragStart: (event: DragEvent) => {
      if (!onReorder) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-kz-photo", String(index));
      setDragFrom(index);
    },
    onDragOver: (event: DragEvent) => {
      if (!onReorder || dragFrom === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dragOver !== index) setDragOver(index);
    },
    onDrop: (event: DragEvent) => {
      if (!onReorder || dragFrom === null) return;
      event.preventDefault();
      event.stopPropagation();
      const next = movePhoto(photos, dragFrom, index);
      reset();
      if (next !== photos) onReorder(next);
    },
    onDragEnd: reset,
  });
  /** Svislá čárka, kam fotka po puštění dopadne. */
  const marker = (index: number) =>
    onReorder && dragFrom !== null && dragOver === index && dragFrom !== index ? (
      <span
        aria-hidden
        className={`bg-ui-fg-interactive absolute inset-y-0 z-10 w-0.5 rounded-full ${
          dragFrom > index ? "-left-1.5" : "-right-1.5"
        }`}
      />
    ) : null;
  return { itemProps, marker };
};

export const PhotoStrip = ({
  photos,
  mainUrl,
  onOpen,
  onReorder,
  sizeClassName = "size-20",
  trailing,
  label = "Fotka",
}: {
  photos: string[];
  /** Hlavní fotka dostane rámeček a štítek. */
  mainUrl?: string | null;
  onOpen: (index: number) => void;
  /**
   * Přetahování (18. 11. 2026): s tímhle jdou náhledy přetáhnout jinam,
   * dostane se nové pořadí. První fotka je hlavní.
   */
  onReorder?: (next: string[]) => void;
  sizeClassName?: string;
  /** Např. dlaždice „Nahrát" na konci pásu. */
  trailing?: ReactNode;
  label?: string;
}) => {
  const drag = usePhotoDrag(photos, onReorder);
  return (
  <ul className="flex flex-wrap gap-2">
    {photos.map((url, index) => {
      const isMain = mainUrl === url;
      return (
        <li key={url} {...drag.itemProps(index, "relative")}>
          {drag.marker(index)}
          <button
            type="button"
            title="Zvětšit"
            aria-label={`${label} ${index + 1}${isMain ? " (hlavní)" : ""} — zvětšit`}
            onClick={() => onOpen(index)}
            className={`bg-ui-bg-subtle block ${sizeClassName} cursor-zoom-in overflow-hidden rounded-lg outline-none focus-visible:shadow-borders-focus ${
              isMain ? "ring-ui-border-interactive ring-2 ring-offset-1" : "shadow-borders-base"
            }`}
          >
            <img src={url} alt="" loading="lazy" draggable={false} className="size-full object-cover" />
          </button>
          {isMain && (
            <span className="pointer-events-none absolute bottom-1 left-1">
              <Badge size="2xsmall" color="blue">
                hlavní
              </Badge>
            </span>
          )}
        </li>
      );
    })}
    {trailing ? <li>{trailing}</li> : null}
  </ul>
  );
};

/**
 * Jedna fotka přes celou obrazovku, šipkami (i na klávesnici) na další.
 * Úkony nad fotkou dodává volající — každá galerie má jiné.
 */
export const PhotoViewer = ({
  title,
  photos,
  index,
  onIndexChange,
  onClose,
  caption,
  actions,
}: {
  title: string;
  photos: string[];
  /** `null` = zavřeno. */
  index: number | null;
  onIndexChange: (next: number) => void;
  onClose: () => void;
  /** Krátký popisek u počítadla, např. „Hlavní fotka". */
  caption?: (index: number) => ReactNode;
  /** Tlačítka v patičce pro právě zobrazenou fotku. */
  actions?: (index: number) => ReactNode;
}) => {
  // Po smazání poslední fotky se index sám posune, prázdná galerie zavře.
  const current =
    index === null || photos.length === 0
      ? null
      : Math.min(Math.max(index, 0), photos.length - 1);
  const go = (step: number) => {
    if (current === null || photos.length < 2) return;
    onIndexChange((current + step + photos.length) % photos.length);
  };

  return (
    <FocusModal
      open={current !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <FocusModal.Content
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") go(-1);
          if (event.key === "ArrowRight") go(1);
        }}
      >
        <FocusModal.Header>
          <FocusModal.Title asChild>
            <Heading>{title}</Heading>
          </FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="flex min-h-0 flex-col">
          {current !== null && (
            <>
              <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
                <img
                  src={photos[current]}
                  alt={`${title} — fotka ${current + 1}`}
                  className="max-h-[calc(100vh-11rem)] max-w-full rounded-lg object-contain"
                />
                {photos.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      aria-label="Předchozí fotka"
                      className="absolute left-4 top-1/2 size-11 -translate-y-1/2 rounded-full p-0"
                      onClick={() => go(-1)}
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      variant="secondary"
                      aria-label="Další fotka"
                      className="absolute right-4 top-1/2 size-11 -translate-y-1/2 rounded-full p-0"
                      onClick={() => go(1)}
                    >
                      <ChevronRight />
                    </Button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3">
                <div className="flex items-center gap-2">
                  <Text size="small" className="text-ui-fg-subtle tabular-nums">
                    {current + 1} / {photos.length}
                  </Text>
                  {caption?.(current)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {actions?.(current)}
                </div>
              </div>
            </>
          )}
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  );
};
