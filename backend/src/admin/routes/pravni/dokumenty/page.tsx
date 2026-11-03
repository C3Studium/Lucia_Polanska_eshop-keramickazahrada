import { SectionPage } from "../../../components/section-tabs";
import { Dokumenty } from "../../dokumenty/page";

/** Právní věci › Dokumenty ke stažení (bez vlastní položky v menu). */
const Page = () => (
  <SectionPage section="pravni" active="dokumenty">
    <Dokumenty />
  </SectionPage>
);

export default Page;
