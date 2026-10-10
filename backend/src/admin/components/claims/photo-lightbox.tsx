import { useState } from "react";

/**
 * Fotky k žádosti: miniatury + fotka přes celou obrazovku po kliknutí
 * (klik kamkoli zavře). Vytaženo z drawer modulu, aby ji stránka žádosti i
 * případné další místo kreslily stejně.
 */
export const PhotoGallery = ({ photos }: { photos: string[] | null | undefined }) => {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const urls = (photos ?? []).filter((url): url is string => typeof url === "string" && url !== "");

  if (urls.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => setLightbox(url)}
            className="focus-visible:shadow-borders-focus block h-20 w-20 overflow-hidden rounded-md border outline-none"
            title="Zvětšit fotku"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
};
