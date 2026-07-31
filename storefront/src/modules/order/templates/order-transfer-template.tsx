import LocalizedClientLink from "@modules/common/components/localized-client-link"
import TransferActions from "@modules/order/components/transfer-actions"
import s from "./styles/order-transfer.module.scss"

export type OrderTransferState = "pending" | "accepted" | "declined" | "error"

type OrderTransferTemplateProps = {
  id: string
  token?: string
  state?: OrderTransferState
  error?: string | null
}

const stateCopy: Record<
  OrderTransferState,
  {
    eyebrow: string
    title: string
    accent: string
    description: string
    status: string
    mark: string
  }
> = {
  pending: {
    eyebrow: "Soukromá žádost · čeká na vaše rozhodnutí",
    title: "Objednávka",
    accent: "má změnit majitele.",
    description:
      "Někdo vás požádal o převzetí této objednávky. Než se cokoliv změní, zkontrolujte si, co přijetí převodu znamená.",
    status: "Čeká na rozhodnutí",
    mark: "↗",
  },
  accepted: {
    eyebrow: "Převod byl bezpečně dokončen",
    title: "Objednávka",
    accent: "je nyní vaše.",
    description:
      "Převod jsme zaznamenali. Objednávku nyní najdete mezi svými objednávkami a další zprávy budou směřovat k novému majiteli.",
    status: "Převod přijat",
    mark: "✓",
  },
  declined: {
    eyebrow: "Žádost byla uzavřena",
    title: "Objednávka",
    accent: "zůstává původnímu majiteli.",
    description:
      "Převod jste odmítli. Vlastnictví ani přístup k objednávce se nezměnily a tato žádost už nevyžaduje další krok.",
    status: "Převod odmítnut",
    mark: "×",
  },
  error: {
    eyebrow: "Žádost se nepodařilo zpracovat",
    title: "Převod",
    accent: "potřebuje nový pokus.",
    description:
      "Odkaz mohl vypršet nebo už byl použit. Vlastnictví objednávky jsme nezměnili.",
    status: "Akce nebyla dokončena",
    mark: "!",
  },
}

export default function OrderTransferTemplate({
  id,
  token,
  state = "pending",
  error,
}: OrderTransferTemplateProps) {
  const copy = stateCopy[state]
  const reference = id.length > 10 ? `…${id.slice(-10).toUpperCase()}` : id
  const canDecide = state === "pending" && Boolean(token)

  return (
    <main className={s.root} data-state={state}>
      <div className={s.container}>
        <header className={s.masthead}>
          <span>Převod objednávky · {reference}</span>
          <span className={s.status}>{copy.status}</span>
        </header>

        <section className={s.hero}>
          <div className={s.copy}>
            <p className={s.eyebrow}>{copy.eyebrow}</p>
            <h1>
              <span>{copy.title}</span>
              <em>{copy.accent}</em>
            </h1>
            <p className={s.description}>{copy.description}</p>
          </div>

          <div className={s.mark} aria-hidden="true">
            <span />
            <span />
            <span />
            <strong>{copy.mark}</strong>
          </div>
        </section>

        <section className={s.facts} aria-label="Údaje převodu">
          <div>
            <span>Reference objednávky</span>
            <strong>{reference}</strong>
          </div>
          <div>
            <span>Typ žádosti</span>
            <strong>Změna vlastníka</strong>
          </div>
          <div>
            <span>Aktuální stav</span>
            <strong>{copy.status}</strong>
          </div>
          <div>
            <span>Zpracování</span>
            <strong>Po vašem potvrzení</strong>
          </div>
        </section>

        {state === "pending" ? (
          <section className={s.decision}>
            <div className={s.decisionIntro}>
              <p>Než se rozhodnete</p>
              <h2>Co se přijetím změní</h2>
              <span>
                Obsah objednávky zůstává z bezpečnostních důvodů skrytý, dokud
                není převod potvrzen.
              </span>
            </div>

            <div className={s.changeList}>
              <article>
                <span>01</span>
                <div>
                  <strong>Přístup</strong>
                  <p>Objednávka se přiřadí k účtu nového majitele.</p>
                </div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <strong>Oznámení</strong>
                  <p>Další důležité zprávy obdrží nový majitel.</p>
                </div>
              </article>
              <article>
                <span>03</span>
                <div>
                  <strong>Správa</strong>
                  <p>Nový majitel převezme přístup k detailům objednávky.</p>
                </div>
              </article>
            </div>

            <div className={s.actionPanel}>
              <div>
                <p>Vaše rozhodnutí</p>
                <h2>Přijmout, nebo ponechat beze změny?</h2>
              </div>
              {canDecide && <TransferActions id={id} token={token!} />}
              <p className={s.securityNote}>
                Tento odkaz je určený pouze pro vyřízení této žádosti.
                Potvrzujte jej jen tehdy, pokud převod očekáváte.
              </p>
            </div>
          </section>
        ) : (
          <section className={s.result}>
            <div>
              <p>Výsledek žádosti</p>
              <h2>{copy.status}</h2>
            </div>
            <p>
              {state === "accepted"
                ? "Změna je zapsaná. Pro další práci s objednávkou přejděte do svého účtu."
                : state === "declined"
                  ? "Není potřeba nic dalšího. Můžete bezpečně pokračovat zpět do obchodu."
                  : "Zkuste otevřít původní odkaz znovu. Pokud potíže přetrvají, požádejte původního majitele o novou žádost."}
            </p>
            {error && <p className={s.errorDetail}>{error}</p>}
            <div className={s.resultActions}>
              {state === "accepted" && (
                <LocalizedClientLink href="/account/orders">
                  Moje objednávky <span aria-hidden="true">↗</span>
                </LocalizedClientLink>
              )}
              <LocalizedClientLink href="/store">
                Zpět do obchodu <span aria-hidden="true">↗</span>
              </LocalizedClientLink>
            </div>
          </section>
        )}

        <footer className={s.footer}>
          <span>Soukromý odkaz</span>
          <span>Bezpečné rozhodnutí</span>
          <span>Ateliér · Písek</span>
        </footer>
      </div>
    </main>
  )
}
