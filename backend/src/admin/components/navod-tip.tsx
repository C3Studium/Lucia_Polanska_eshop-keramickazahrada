import { Popover, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { sdk } from "../lib/sdk";
import { NAVOD, type NavodTema } from "../lib/navod-katalog";

/**
 * Otazník s návodem (19. 11. 2026, Matěj: „? v kroužku, kde bude malý GIF,
 * jak se to dělá"). Klik otevře panel vpravo: k čemu to je, GIF s myší
 * a popisky kroků (klik ho zvětší), kroky slovy a odkaz na celý Návod.
 *
 * Texty jsou v lib/navod-katalog.ts, GIFy v backendu (navod_klip) —
 * nahrává je tools/navod. Chybějící GIF nevadí, zůstanou kroky.
 */

export type NavodKlip = { url: string; width?: number | null; height?: number | null };

export const useNavodKlipy = () =>
  useQuery({
    queryKey: ["navod-klipy"],
    queryFn: () => sdk.client.fetch<{ klipy: Record<string, NavodKlip> }>("/admin/navod/klipy"),
    staleTime: 10 * 60 * 1000,
  });

export const temaPodleKlice = (klic: string): NavodTema | undefined =>
  NAVOD.find((tema) => tema.klic === klic);

/** Zvětšený GIF přes celou obrazovku; Esc nebo klik zavře. */
const VelkyGif = ({ klip, popis, onClose }: { klip: NavodKlip; popis: string; onClose: () => void }) => {
  useEffect(() => {
    const esc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [onClose]);
  return createPortal(
    <div
      role="dialog"
      data-navod-velky=""
      aria-label={`Návod: ${popis}`}
      className="fixed inset-0 flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
      style={{ zIndex: 2147483000, pointerEvents: "auto" }}
      onClick={onClose}
    >
      <img src={klip.url} alt={popis} className="max-h-full max-w-full rounded-lg shadow-2xl" />
      <span className="txt-compact-small absolute right-4 top-4 rounded-md bg-black/60 px-2 py-1 text-white">
        Zavřít (Esc)
      </span>
    </div>,
    document.body
  );
};

/** Jeden GIF s popiskem — v panelu i na stránce Návod. */
export const NavodGif = ({ klic, popis, klipy }: { klic: string; popis: string; klipy?: Record<string, NavodKlip> }) => {
  const [velky, setVelky] = useState(false);
  const klip = klipy?.[klic];
  if (!klip) {
    return (
      <div className="bg-ui-bg-subtle text-ui-fg-muted txt-compact-small flex aspect-[16/10] items-center justify-center rounded-lg px-4 text-center">
        Video k „{popis}" se připravuje.
      </div>
    );
  }
  return (
    <figure className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setVelky(true)}
        title="Zvětšit"
        className="shadow-borders-base group relative block cursor-zoom-in overflow-hidden rounded-lg bg-white"
      >
        <img
          src={klip.url}
          alt={popis}
          loading="lazy"
          width={klip.width ?? undefined}
          height={klip.height ?? undefined}
          className="block h-auto w-full"
        />
        <span className="txt-compact-xsmall-plus absolute bottom-2 right-2 rounded-md bg-black/65 px-2 py-1 text-white opacity-90 group-hover:opacity-100">
          Zvětšit
        </span>
      </button>
      <figcaption className="txt-compact-small text-ui-fg-subtle">{popis}</figcaption>
      {velky && <VelkyGif klip={klip} popis={popis} onClose={() => setVelky(false)} />}
    </figure>
  );
};

/** Obsah jednoho tématu (panel otazníku i karta na stránce Návod). */
export const NavodObsah = ({ tema, klipy }: { tema: NavodTema; klipy?: Record<string, NavodKlip> }) => (
  <div className="flex flex-col gap-4">
    {tema.proc && (
      <Text size="small" className="text-ui-fg-subtle">
        {tema.proc}
      </Text>
    )}
    {tema.klipy.map((klip) => (
      <NavodGif key={klip.klic} klic={klip.klic} popis={klip.popis} klipy={klipy} />
    ))}
    {tema.kroky.length > 0 && (
      <ol className="flex flex-col gap-1.5">
        {tema.kroky.map((krok, index) => (
          <li key={index} className="flex gap-2.5">
            <span className="bg-ui-tag-orange-bg text-ui-tag-orange-text txt-compact-xsmall-plus mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full">
              {index + 1}
            </span>
            <Text size="small">{krok}</Text>
          </li>
        ))}
      </ol>
    )}
    {tema.pozor && (
      <div className="bg-ui-tag-orange-bg text-ui-tag-orange-text txt-small rounded-lg px-3 py-2">
        {tema.pozor}
      </div>
    )}
  </div>
);

/**
 * „?" v kroužku. `tema` = klíč z lib/navod-katalog.ts.
 * Do textu vedle nadpisu: <NavodTip tema="produkt.sleva" />.
 *
 * Otevře MALÉ okénko u otazníku (Matěj, 19. 11.: „na stránce v okénku,
 * velký formát jen v Návodu"): GIF (klik zvětší), jedna-dvě věty a odkaz
 * na celý návod s kroky. Víc klipů = přepínač nad GIFem.
 */
export const NavodTip = ({ tema: klic, className = "" }: { tema: string; className?: string }) => {
  const [open, setOpen] = useState(false);
  const [vybrany, setVybrany] = useState(0);
  const tema = temaPodleKlice(klic);
  const { data } = useNavodKlipy();
  if (!tema) return null;
  const klip = tema.klipy[Math.min(vybrany, tema.klipy.length - 1)];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Návod: ${tema.nazev}`}
          title={`Jak na to: ${tema.nazev}`}
          onClick={(event) => event.stopPropagation()}
          className={`text-ui-fg-muted hover:text-ui-fg-interactive data-[state=open]:text-ui-fg-interactive focus-visible:shadow-borders-focus inline-flex size-7 shrink-0 items-center justify-center rounded-full align-middle transition-colors ${className}`}
        >
          <span className="border-current txt-compact-xsmall-plus inline-flex size-[18px] items-center justify-center rounded-full border-[1.5px] leading-none">
            ?
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Content
        align="start"
        sideOffset={6}
        collisionPadding={16}
        className="z-[60] flex w-[520px] max-w-[calc(100vw-32px)] flex-col gap-3 p-3"
        onClick={(event) => event.stopPropagation()}
        onPointerDownOutside={(event) => {
          /* Zvětšený GIF je mimo okénko — klik do něj okénko nezavírá. */
          if ((event.target as HTMLElement | null)?.closest?.("[data-navod-velky]")) event.preventDefault();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <Text size="small" weight="plus">
            {tema.nazev}
          </Text>
          <button
            type="button"
            aria-label="Zavřít návod"
            onClick={() => setOpen(false)}
            className="text-ui-fg-muted hover:text-ui-fg-subtle -m-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md"
          >
            ×
          </button>
        </div>
        {tema.klipy.length > 1 && (
          <div className="bg-ui-bg-subtle flex rounded-lg p-0.5" role="tablist">
            {tema.klipy.map((k, index) => (
              <button
                key={k.klic}
                type="button"
                role="tab"
                aria-selected={index === vybrany}
                onClick={() => setVybrany(index)}
                className={`txt-compact-xsmall-plus min-h-[30px] flex-1 rounded-md px-2 ${
                  index === vybrany ? "bg-ui-bg-base shadow-borders-base text-ui-fg-base" : "text-ui-fg-subtle"
                }`}
              >
                {k.popis.split(" — ")[0]}
              </button>
            ))}
          </div>
        )}
        {klip && <NavodGif key={klip.klic} klic={klip.klic} popis={klip.popis} klipy={data?.klipy} />}
        {tema.proc && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {tema.proc}
          </Text>
        )}
        <Link
          to={`/navod#${tema.klic}`}
          onClick={() => setOpen(false)}
          className="text-ui-fg-interactive txt-compact-small hover:underline self-start"
        >
          Celý návod s kroky →
        </Link>
      </Popover.Content>
    </Popover>
  );
};
