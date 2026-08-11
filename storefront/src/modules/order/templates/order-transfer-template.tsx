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
    eyebrow: "Čeká to na vaše rozhodnutí",
    title: "Objednávka",
    accent: "má přejít na vás.",
    description:
      "Někdo vás požádal, abyste si tuhle objednávku převzali. Než něco potvrdíte, přečtěte si, co to znamená.",
    status: "Čeká na vás",
    mark: "↗",
  },
  accepted: {
    eyebrow: "Hotovo",
    title: "Objednávka",
    accent: "je nyní vaše.",
    description:
      "Převod máme zapsaný. Objednávku teď najdete mezi svými a další zprávy o ní budou chodit vám.",
    status: "Převod přijat",
    mark: "✓",
  },
  declined: {
    eyebrow: "Žádost je uzavřená",
    title: "Objednávka",
    accent: "zůstává tam, kde byla.",
    description:
      "Převod jste odmítli. Nic se nezměnilo a s touhle žádostí už nemusíte nic dělat.",
    status: "Převod odmítnut",
    mark: "×",
  },
  error: {
    eyebrow: "Něco se nepovedlo",
    title: "Převod",
    accent: "se nepovedl.",
    description:
      "Odkaz nejspíš vypršel, nebo už byl použitý. Na objednávce jsme nic nezměnili.",
    status: "Nedokončeno",
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
              <h2>Co se změní, když to přijmete</h2>
              <span>
                Co je v objednávce, kvůli bezpečnosti neukazujeme, dokud převod
                nepotvrdíte.
              </span>
            </div>

            <div className={s.changeList}>
              <article>
                <span>01</span>
                <div>
                  <strong>Přístup</strong>
                  <p>Objednávka se připojí k účtu nového majitele.</p>
                </div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <strong>Oznámení</strong>
                  <p>Další zprávy o objednávce budou chodit jemu.</p>
                </div>
              </article>
              <article>
                <span>03</span>
                <div>
                  <strong>Správa</strong>
                  <p>Detaily objednávky uvidí nový majitel.</p>
                </div>
              </article>
            </div>

            <div className={s.actionPanel}>
              <div>
                <p>Je to na vás</p>
                <h2>Přijmout, nebo nechat být?</h2>
              </div>
              {canDecide && <TransferActions id={id} token={token!} />}
              <p className={s.securityNote}>
                Tenhle odkaz platí jen pro tuhle jednu žádost. Potvrzujte ho
                jen tehdy, když o převodu víte.
              </p>
            </div>
          </section>
        ) : (
          <section className={s.result}>
            <div>
              <p>Jak to dopadlo</p>
              <h2>{copy.status}</h2>
            </div>
            <p>
              {state === "accepted"
                ? "Máme to zapsané. Objednávku teď najdete ve svém účtu."
                : state === "declined"
                  ? "Víc už dělat nemusíte. Klidně se vraťte do obchodu."
                  : "Zkuste otevřít původní odkaz znovu. Kdyby to pořád nešlo, požádejte o novou žádost toho, kdo ji poslal."}
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
          <span>Odkaz jen pro vás</span>
          <span>Nic se nestane bez potvrzení</span>
          <span>Ateliér · Písek</span>
        </footer>
      </div>
    </main>
  )
}
