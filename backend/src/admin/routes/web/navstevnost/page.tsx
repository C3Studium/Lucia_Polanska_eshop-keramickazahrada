import { SectionPage } from "../../../components/section-tabs";
import { Navstevnost } from "../../segment/page";

/** Web › Návštěvnost (bez vlastní položky v menu). */
const Page = () => (
  <SectionPage section="web" active="navstevnost">
    <Navstevnost />
  </SectionPage>
);

export default Page;
