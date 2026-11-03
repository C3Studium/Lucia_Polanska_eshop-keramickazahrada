import { SectionPage } from "../../../components/section-tabs";
import { EmailyObchodu } from "../../emaily-prijemci/page";

/** Nastavení obchodu › E-maily obchodu (bez vlastní položky v menu). */
const Page = () => (
  <SectionPage section="nastaveni" active="emaily">
    <EmailyObchodu />
  </SectionPage>
);

export default Page;
