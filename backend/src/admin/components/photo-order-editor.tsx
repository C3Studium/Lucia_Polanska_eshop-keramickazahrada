import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSix } from "@medusajs/icons";
import { Badge } from "@medusajs/ui";
import { movePhoto } from "./photo-strip-order";

/**
 * Řazení fotek (18. 11. 2026, přání majitele).
 *
 * Přetahování „kdykoli" nebylo poznat — nic neříkalo, že fotka jde chytit.
 * Teď se řadí v režimu: „Nastavit pořadí" → na fotkách se objeví úchyt
 * (šest teček, jako u kolekcí v Rozložení) a číslo pořadí → „Uložit" /
 * „Zrušit". První fotka je hlavní.
 *
 * Stejná knihovna jako Rozložení (dnd-kit): kromě myši umí i prst (krátké
 * podržení) a klávesnici (mezerník, šipky). Komponenta je řízená — drží jen
 * rozpracované pořadí, ukládá volající.
 */

const DND_TEXTS = {
  screenReaderInstructions: {
    draggable:
      "Fotku zvednete mezerníkem nebo klávesou Enter. Šipkami ji přesunete, mezerníkem položíte, klávesou Escape přesun zrušíte.",
  },
  announcements: {
    onDragStart: () => "Fotka zvednuta. Šipkami ji přesuňte, mezerníkem položte.",
    onDragOver: () => undefined,
    onDragEnd: () => "Fotka položena.",
    onDragCancel: () => "Přesun zrušen.",
  },
};

const SortablePhoto = ({
  url,
  index,
  sizeClassName,
}: {
  url: string;
  index: number;
  sizeClassName: string;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: url });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative touch-none select-none ${isDragging ? "z-10 opacity-80" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-roledescription="přesouvatelná fotka"
        aria-label={`Fotka ${index + 1}${index === 0 ? " (hlavní)" : ""} — přesunout`}
        title="Chyťte a přetáhněte na jiné místo"
        className={`bg-ui-bg-subtle block ${sizeClassName} cursor-grab overflow-hidden rounded-lg outline-none active:cursor-grabbing focus-visible:shadow-borders-focus ${
          isDragging
            ? "shadow-elevation-flyout ring-ui-border-interactive ring-2"
            : index === 0
              ? "ring-ui-border-interactive ring-2 ring-offset-1"
              : "shadow-borders-base"
        }`}
      >
        <img src={url} alt="" draggable={false} className="pointer-events-none size-full object-cover" />
      </button>
      {/* Úchyt a pořadí — vidět je, že fotka jde chytit a kolikátá je. */}
      <span className="bg-ui-bg-base text-ui-fg-subtle shadow-borders-base pointer-events-none absolute left-1 top-1 flex items-center gap-0.5 rounded-md px-0.5 py-px">
        <DotsSix />
        <span className="txt-compact-xsmall-plus pr-1 tabular-nums">{index + 1}</span>
      </span>
      {index === 0 && (
        <span className="pointer-events-none absolute bottom-1 left-1">
          <Badge size="2xsmall" color="blue">
            hlavní
          </Badge>
        </span>
      )}
    </li>
  );
};

export const PhotoOrderEditor = ({
  photos,
  onChange,
  sizeClassName = "size-20",
}: {
  /** Rozpracované pořadí. */
  photos: string[];
  onChange: (next: string[]) => void;
  sizeClassName?: string;
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Na telefonu krátké podržení — jinak by tah prstem jen posouval stránku.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = photos.indexOf(String(active.id));
    const to = photos.indexOf(String(over.id));
    onChange(movePhoto(photos, from, to));
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={DND_TEXTS}
    >
      <SortableContext items={photos} strategy={rectSortingStrategy}>
        <ul className="flex flex-wrap gap-2">
          {photos.map((url, index) => (
            <SortablePhoto key={url} url={url} index={index} sizeClassName={sizeClassName} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
};
