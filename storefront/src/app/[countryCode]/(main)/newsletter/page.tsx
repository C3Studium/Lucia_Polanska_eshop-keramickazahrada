import { Metadata } from "next"

import { getPageCopy } from "@lib/data/site-copy"
import { itemFieldPath, itemNote, itemValue } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import OrderStateShell from "@modules/order/components/order-state-shell"

/**
 * Where the links from newsletter e-mails land: the backend's
 * `GET /newsletter/confirm` and `GET /newsletter/unsubscribe` do their work
 * and 302 here with `?stav=…` — and so does `GET /email-optout` (odmítnutí
 * proseb o recenzi, poklesu ceny a připomenutí košíku, `?stav=odhlaseno-
 * upozorneni&druh=…`) (mirroring how the balance-payment flow
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
  // Odmítnutí e-mailů z oprávněného zájmu (backend `GET /email-optout`):
  // prosby o hodnocení, upozornění na nižší cenu, připomenutí košíku. Popis
  // doplní `druh` z adresy (OPTOUT_KIND_LABEL).
  "odhlaseno-upozorneni": {
    status: "success",
    kicker: "Odhlášení proběhlo",
    title: "Tyhle e-maily",
    accent: "už nepřijdou.",
    description: "Hotovo — tyhle e-maily vám už posílat nebudeme.",
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

/**
 * Druhy z backendu (`lib/email-optout-link.ts`, `EMAIL_OPTOUT_KIND_LABEL`) —
 * co přesně zákazník odmítl. Neznámý druh = obecná věta, nic se nevypisuje
 * z adresy doslova.
 */
const OPTOUT_KIND_LABEL: Record<string, string> = {
  review_request: "prosby o hodnocení nákupu",
  price_drop: "upozornění na nižší cenu výrobků v oblíbených",
  abandoned_cart: "připomenutí nedokončeného nákupu",
}

type Props = {
  searchParams: Promise<{ stav?: string; druh?: string }>
}

/*
 * Texty stavů z CMS — blok `newsletter.stavy`, položky klíčované popiskem
 * jako u `global.prihlaseni`: `<stav>.stitek` (řádek nad nadpisem),
 * `<stav>.nadpis` (nadpis v `value`, zvýrazněný konec v `note`) a `<stav>.text`
 * (odstavec). Výchozí stránka bez `?stav` je `vychozi`. Stav, který blok
 * nemá, si nechá texty z kódu.
 *
 * Co v CMS není: odstavec u odmítnutí upozornění (`odhlaseno-upozorneni`).
 * Říká, které e-maily přestanou chodit a že potvrzení objednávek chodit dál
 * budou — je to odpověď na námitku proti zpracování, ne redakční text.
 * `status` (barva a značka) a skladba stránky jsou logika, ne slova.
 */
const fromCms = (block: CopyBlock | undefined, key: string, base: StatusCopy): StatusCopy => ({
  ...base,
  kicker: itemValue(block, `${key}.stitek`)?.trim() || base.kicker,
  title: itemValue(block, `${key}.nadpis`)?.trim() || base.title,
  accent: itemNote(block, `${key}.nadpis`)?.trim() || base.accent,
  description:
    key === "odhlaseno-upozorneni"
      ? base.description
      : itemValue(block, `${key}.text`)?.trim() || base.description,
})

export default async function NewsletterStatusPage(props: Props) {
  const { stav, druh } = await props.searchParams
  // Jen vlastní klíče — hodnota z adresy nesmí sáhnout na zděděné vlastnosti
  // objektu (`?stav=constructor`).
  const own = (record: object, key?: string): key is string =>
    Boolean(key) && Object.prototype.hasOwnProperty.call(record, key as string)
  const block = (await getPageCopy("newsletter"))["newsletter.stavy"]
  const stateKey = own(COPY, stav) ? stav : "vychozi"
  const base = fromCms(block, stateKey, own(COPY, stav) ? COPY[stav] : DEFAULT_COPY)
  const optOut = stav === "odhlaseno-upozorneni"
  const kindLabel = own(OPTOUT_KIND_LABEL, druh) ? OPTOUT_KIND_LABEL[druh] : undefined
  const copy: StatusCopy =
    optOut && kindLabel
      ? {
          ...base,
          description: `Hotovo — tyhle e-maily (${kindLabel}) vám už posílat nebudeme. Potvrzení objednávek a zprávy o jejich stavu vám chodit dál budou.`,
        }
      : optOut
        ? {
            ...base,
            description:
              "Hotovo — tyhle e-maily vám už posílat nebudeme. Potvrzení objednávek a zprávy o jejich stavu vám chodit dál budou.",
          }
        : base

  return (
    <OrderStateShell
      eyebrow={optOut ? "E-maily" : "Newsletter"}
      kicker={copy.kicker}
      title={copy.title}
      accent={copy.accent}
      description={copy.description}
      status={copy.status}
      primary={{ href: "/store", label: "Prohlédnout objekty" }}
      secondary={{ href: "/", label: "Na úvodní stránku" }}
      editDoc={block?.id ?? null}
      editFields={{
        kicker: itemFieldPath(block, `${stateKey}.stitek`),
        title: itemFieldPath(block, `${stateKey}.nadpis`),
        accent: itemFieldPath(block, `${stateKey}.nadpis`, "note"),
        description: optOut ? undefined : itemFieldPath(block, `${stateKey}.text`),
      }}
    />
  )
}
