import { Metadata } from "next"

import OrderStateShell from "@modules/order/components/order-state-shell"

/**
 * Where the links from newsletter e-mails land: the backend's
 * `GET /newsletter/confirm` and `GET /newsletter/unsubscribe` do their work
 * and 302 here with `?stav=…` (mirroring how the balance-payment flow
 * returns to the order page). One page for both flows, so every state of
 * "vztah s newsletterem" answers in the same voice.
 *
 * Server component on purpose — the status is in the URL, there is nothing
 * to verify client-side, and the copy must render even with JS disabled
 * (it is opened from an e-mail client).
 */

export const metadata: Metadata = {
  title: "Odběr novinek",
  description: "Stav vašeho odběru novinek z Keramické zahrady.",
  robots: { index: false },
}

type StatusCopy = {
  status: "pending" | "success" | "canceled"
  kicker: string
  title: string
  accent: string
  description: string
}

const COPY: Record<string, StatusCopy> = {
  potvrzeno: {
    status: "success",
    kicker: "Odběr potvrzen",
    title: "Jste blízko",
    accent: "ateliéru.",
    description:
      "Děkujeme za potvrzení. Ozveme se, když z pece vyjdou nové objekty nebo když vypíšeme termíny kurzů — a jinak mlčíme. Odhlásit se můžete kdykoli odkazem v patičce každé zprávy.",
  },
  odhlaseno: {
    status: "success",
    kicker: "Odhlášení proběhlo",
    title: "Rozcházíme se",
    accent: "v dobrém.",
    description:
      "Žádné další zprávy z ateliéru už vám chodit nebudou. Kdybyste si to rozmysleli, formulář v patičce e-shopu na vás počká.",
  },
  "jiz-odhlaseno": {
    status: "pending",
    kicker: "Tady se nic nestalo",
    title: "Tento e-mail je",
    accent: "odhlášený.",
    description:
      "Potvrzovací odkaz patří k odběru, který byl mezitím odhlášen, takže jsme ho nechali být. Pokud novinky chcete, přihlaste se prosím znovu ve formuláři v patičce — přijde vám čerstvý potvrzovací e-mail.",
  },
  "neplatny-odkaz": {
    status: "canceled",
    kicker: "Odkaz nesedí",
    title: "Tenhle odkaz",
    accent: "není platný.",
    description:
      "Nejspíš se při kopírování nepřenesl celý. Zkuste jej otevřít z e-mailu znovu, nebo nám napište na info@keramickazahrada.cz a vyřešíme to ručně.",
  },
  chyba: {
    status: "canceled",
    kicker: "Něco se pokazilo",
    title: "Tohle se",
    accent: "nepovedlo.",
    description:
      "Na naší straně se něco zadrhlo a změna se neuložila. Zkuste odkaz otevřít ještě jednou; kdyby to nepomohlo, napište nám na info@keramickazahrada.cz.",
  },
}

const DEFAULT_COPY: StatusCopy = {
  status: "pending",
  kicker: "Novinky z ateliéru",
  title: "Zůstaňte blízko",
  accent: "ateliéru.",
  description:
    "K odběru novinek se přihlásíte formulářem v patičce e-shopu. Přijde vám e-mail s potvrzovacím odkazem — a teprve po jeho kliknutí se ozýváme.",
}

type Props = {
  searchParams: Promise<{ stav?: string }>
}

export default async function NewsletterStatusPage(props: Props) {
  const { stav } = await props.searchParams
  const copy = (stav && COPY[stav]) || DEFAULT_COPY

  return (
    <OrderStateShell
      eyebrow="Newsletter"
      kicker={copy.kicker}
      title={copy.title}
      accent={copy.accent}
      description={copy.description}
      status={copy.status}
      primary={{ href: "/store", label: "Prohlédnout objekty" }}
      secondary={{ href: "/", label: "Na úvodní stránku" }}
    />
  )
}
