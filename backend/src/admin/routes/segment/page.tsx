import {
  Button,
  Container,
  Heading,
  Text,
} from "@medusajs/ui";
import { movedTo } from "../../components/section-tabs";

/**
 * Návštěvnost webu — a signpost, not a dashboard. The numbers live in
 * Segment; this page says so in Czech and opens it in a new window.
 */
/** Obsah záložky Web › Návštěvnost. */
export const Navstevnost = () => {
  return (
    <Container className="flex flex-col p-0 overflow-hidden">
      <div className="p-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading>Návštěvnost webu</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-2 max-w-2xl">
            Kolik lidí na web chodí a co si prohlížejí, měří služba Segment.
            Tlačítkem ji otevřete v novém okně — přihlášení do ní má správce
            webu.
          </Text>
        </div>
        <a href="https://app.segment.com/matej-forejt/home"
          // WIP: update latter with the actual URL of the Segment account used in the project
            target="_blank"
            rel="noopener noreferrer"
        >
          <Button variant="secondary" size="small">
            Otevřít měření návštěvnosti
          </Button>
        </a>
      </div>
    </Container>
  );
};

/* Bez položky v menu — stránka je záložkou „Web"; stará adresa tam
   přesměruje. */
export default movedTo("/web/navstevnost");
