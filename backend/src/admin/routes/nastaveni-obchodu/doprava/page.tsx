import { SectionPage } from "../../../components/section-tabs";
import { DopravaPlatba } from "../../doprava-platba/page";

/** Nastavení obchodu › Doprava a platba (bez vlastní položky v menu). */
const Page = () => (
  <SectionPage section="nastaveni" active="doprava">
    <DopravaPlatba />
  </SectionPage>
);

export default Page;
