import { SectionPage } from "../../../components/section-tabs";
import { ZkusebniRezim } from "../../zkusebni-rezim/page";

/**
 * Nastavení obchodu › Zkušební režim (bez vlastní položky v menu).
 *
 * Záložka je vidět jen v expertním režimu, nebo když obchod právě jede
 * nanečisto — viz `components/section-tabs.tsx`. Adresa funguje vždycky.
 */
const Page = () => (
  <SectionPage section="nastaveni" active="zkusebni">
    <ZkusebniRezim />
  </SectionPage>
);

export default Page;
