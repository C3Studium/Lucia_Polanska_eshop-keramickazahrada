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
    <EmailLayout preview="Účet máte hotový. Pár slov od mě, než se porozhlédnete.">
      <Eyebrow>Váš účet</Eyebrow>
      <EmailH1 accent="zahradě.">Vítejte v Keramické</EmailH1>

      <Greeting name={customerName} />
      <P>
        děkuji, že jste si u mě založili účet. Objednávky, adresy i oblíbené
        kousky teď najdete na jednom místě.
      </P>
      <P>
        Jsem Lucie, keramička z Písku. Všechno, co tu najdete, modeluju,
        glazuju a pálím sama u sebe v dílně — a sama taky balím a odpovídám
        na e-maily. Když mi napíšete, odpovím vám já.
      </P>

      <Note tone="olive">
        Každý kousek je trochu jiný než ten na fotce — tak to u ruční práce
        chodí.
      </Note>

      {shopUrl ? (
        <ButtonRow>
          <EmailButton href={shopUrl}>Prohlédnout nabídku</EmailButton>
        </ButtonRow>
      ) : null}

      <P small>
        Tento e-mail vám posílám, protože jste si vytvořili účet na
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
