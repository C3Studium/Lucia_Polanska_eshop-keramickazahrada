import {
  ButtonRow,
  EmailButton,
  EmailH1,
  EmailLayout,
  Eyebrow,
  Greeting,
  Note,
  P,
  Signature,
} from "../components/email-ui"
import { storeLink } from "../../../lib/storefront-url"

interface WelcomeEmailProps {
  customerName?: string;
}

function WelcomeEmailComponent({ customerName }: WelcomeEmailProps) {
  const shopUrl = storeLink()
  return (
    <EmailLayout preview="Vítejte v Keramické zahradě — váš účet je připraven.">
      <Eyebrow>Váš účet</Eyebrow>
      <EmailH1 accent="v ateliéru.">Vítejte</EmailH1>

      <Greeting name={customerName} />
      <P>
        děkujeme, že jste si u nás vytvořili účet. Od této chvíle máte
        objednávky, adresy i oblíbené objekty přehledně na jednom místě.
      </P>

      <Note tone="olive">
        V píseckém ateliéru právě vzniká další várka objektů — přijďte se
        podívat.
      </Note>

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl}>Prohlédnout objekty</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        Tento e-mail vám posíláme, protože jste si vytvořili účet na
        keramickazahrada.cz.
      </P>
      <Signature />
    </EmailLayout>
  );
}

export const WelcomeEmail = (props: WelcomeEmailProps) => (
  <WelcomeEmailComponent {...props} />
);

// Mock data for preview/development
const mockWelcome: WelcomeEmailProps = {
  customerName: "Vážený zákazník",
};

export default () => <WelcomeEmailComponent {...mockWelcome} />;
