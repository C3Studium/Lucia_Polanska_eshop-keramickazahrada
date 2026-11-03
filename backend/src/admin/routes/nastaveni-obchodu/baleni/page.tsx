import { SectionPage } from "../../../components/section-tabs";
import { Baleni } from "../../baleni-workbench/page";

/** Nastavení obchodu › Balení (bez vlastní položky v menu). */
const Page = () => (
  <SectionPage section="nastaveni" active="baleni">
    <Baleni />
  </SectionPage>
);

export default Page;
