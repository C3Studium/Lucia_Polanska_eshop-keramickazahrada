import { defineRouteConfig } from "@medusajs/admin-sdk";
import { MagnifyingGlass, QuestionMarkCircle } from "@medusajs/icons";
import { Container, Heading, Input, Text } from "@medusajs/ui";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { NavodObsah, useNavodKlipy } from "../../components/navod-tip";
import { NAVOD, SEKCE } from "../../lib/navod-katalog";

/**
 * Návod — všechno, co se v adminu dělá, s krátkým GIFem a kroky
 * (19. 11. 2026, Matěj). Stejná témata otevírají otazníky „?“ přímo
 * na stránkách; tady jsou pohromadě, po oddílech a s hledáním.
 * Odkaz /navod#<klíč> sroluje rovnou na téma.
 */

const bezDiakritiky = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const NavodPage = () => {
  const [hledat, setHledat] = useState("");
  const { data } = useNavodKlipy();
  const location = useLocation();

  const temata = useMemo(() => {
    const q = bezDiakritiky(hledat.trim());
    if (!q) return NAVOD;
    return NAVOD.filter((tema) =>
      bezDiakritiky([tema.nazev, tema.proc ?? "", ...tema.kroky, ...tema.klipy.map((k) => k.popis)].join(" ")).includes(q)
    );
  }, [hledat]);

  /* Odkaz z otazníku (#klíč) → sjet na téma, až je vykreslené. */
  useEffect(() => {
    const klic = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!klic) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`navod-${klic}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  const sekce = SEKCE.map((s) => ({ ...s, temata: temata.filter((t) => t.sekce === s.id) })).filter((s) => s.temata.length);

  return (
    <Container className="divide-y p-0">
      <header className="flex flex-col gap-3 px-6 pb-5 pt-6">
        <Heading>Návod</Heading>
        <Text size="small" className="text-ui-fg-subtle max-w-2xl">
          Každé téma má krátké video (GIF) s myší a očíslovanými kroky. Klikněte na video a zvětší se.
          Stejný návod otevřete i přímo na stránce otazníkem{" "}
          <span className="border-ui-fg-muted txt-compact-xsmall-plus inline-flex size-[18px] items-center justify-center rounded-full border-[1.5px] align-middle">
            ?
          </span>
          .
        </Text>
        <div className="relative max-w-md">
          <MagnifyingGlass className="text-ui-fg-muted pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            type="search"
            className="pl-8"
            placeholder="Hledat v návodu — např. sleva, štítek, poukaz…"
            value={hledat}
            onChange={(event) => setHledat(event.target.value)}
          />
        </div>
      </header>

      <div className="flex flex-col lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
        {/* Obsah — oddíly; na telefonu vodorovně nahoře. */}
        <nav aria-label="Oddíly návodu" className="border-ui-border-base flex gap-1 overflow-x-auto px-4 py-3 lg:sticky lg:top-0 lg:max-h-screen lg:flex-col lg:self-start lg:overflow-y-auto lg:border-r lg:py-5">
          {sekce.map((s) => (
            <a
              key={s.id}
              href={`#sekce-${s.id}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(`sekce-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="text-ui-fg-subtle hover:bg-ui-bg-base-hover hover:text-ui-fg-base txt-compact-small flex min-h-[36px] shrink-0 items-center justify-between gap-2 rounded-md px-2.5"
            >
              <span>{s.nazev}</span>
              <span className="text-ui-fg-muted txt-compact-xsmall tabular-nums">{s.temata.length}</span>
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-10 px-6 py-6">
          {sekce.length === 0 && (
            <Text className="text-ui-fg-subtle">Nic nenalezeno. Zkuste jiné slovo.</Text>
          )}
          {sekce.map((s) => (
            <section key={s.id} id={`sekce-${s.id}`} className="scroll-mt-4">
              <Heading level="h2">{s.nazev}</Heading>
              <Text size="small" className="text-ui-fg-subtle mb-4 mt-1">
                {s.popis}
              </Text>
              <div className="grid gap-4 xl:grid-cols-2">
                {s.temata.map((tema) => (
                  <article
                    key={tema.klic}
                    id={`navod-${tema.klic}`}
                    className={`shadow-borders-base bg-ui-bg-base flex scroll-mt-4 flex-col gap-3 rounded-lg p-4 ${
                      location.hash === `#${tema.klic}` ? "ring-ui-border-interactive ring-2" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Heading level="h3">{tema.nazev}</Heading>
                      {tema.kde && (
                        <Link to={tema.kde} className="text-ui-fg-interactive txt-compact-small shrink-0 hover:underline">
                          Otevřít →
                        </Link>
                      )}
                    </div>
                    <NavodObsah tema={tema} klipy={data?.klipy} />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Návod",
  icon: QuestionMarkCircle,
  // Úplně dole, pod Webem (100).
  rank: 110,
});

export default NavodPage;
