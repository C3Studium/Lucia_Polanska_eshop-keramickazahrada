import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Přihlášení, za kterým chybí zákazník.
 *
 * ## Co to je za stav
 *
 * Přihlašovací identita a zákaznický záznam jsou v Meduse dvě věci spojené
 * odkazem v `app_metadata.customer_id`. Když zákazník zmizí a identita
 * zůstane, přihlášení pořád projde a token je platný — jen `actor_id` v něm
 * ukazuje na někoho, kdo v databázi není. Každé `/store/customers/me` pak
 * vrátí „Customer with id ... was not found".
 *
 * Pro člověka to vypadá jako rozbité heslo. Zkusí ho změnit, e-mail dojde,
 * nové heslo se nastaví — a nepomůže to, protože heslo nikdy problém nebylo.
 * Bez tohohle souboru se to nepozná odnikud: obchod mlčí, administrace mlčí,
 * v logu je 404 mezi tisíci jiných.
 *
 * ## Proč to hlídá administrace a ne kód sám
 *
 * Opravit se to dá dvěma způsoby a **který je správně, ví jen člověk**:
 *
 * - Zákazníka někdo smazal omylem → obnovit ho (Medusa maže měkce, takže
 *   se vrátí i s adresami a objednávkami).
 * - Zákazníka někdo smazal schválně, třeba na žádost o výmaz údajů →
 *   obnovit ho by bylo porušení té žádosti. Správně je uvolnit e-mail,
 *   aby se dal založit účet nový.
 *
 * Automatika, která by si vybrala sama, by v jednom z těch dvou případů
 * udělala škodu. Proto se tady jen **hledá a nabízí**; rozhoduje obsluha
 * v Přehledu.
 *
 * ## Meze
 *
 * Prochází se všechny identity naráz. Pro obchod téhle velikosti (stovky
 * účtů) je to jeden dotaz a je to v pořádku; při desítkách tisíc by to
 * chtělo stránkovat.
 */

export type NalezenyUcet = {
  identityId: string
  email: string
  customerId: string
  /**
   * `mekce-smazany` — záznam je v databázi, jen označený jako smazaný.
   * `jiny-zakaznik` — původní je pryč, ale pod stejným e-mailem je jiný.
   * `chybi` — není ani jedno.
   */
  stav: "mekce-smazany" | "jiny-zakaznik" | "chybi"
  /** U `jiny-zakaznik` id toho, na který se dá odkaz přesměrovat. */
  nahradniId?: string
}

/** E-mail z identity — hledá se v provider identities, ne v app_metadata. */
const emailIdentity = (identity: any): string => {
  const provider = (identity.provider_identities ?? []).find(
    (p: any) => p.entity_id
  )
  return String(provider?.entity_id ?? "").toLowerCase()
}

export const najdiOsireleUcty = async (
  container: MedusaContainer
): Promise<NalezenyUcet[]> => {
  const auth = container.resolve(Modules.AUTH)
  const customers = container.resolve(Modules.CUSTOMER)

  const identity = await auth.listAuthIdentities(
    {},
    { relations: ["provider_identities"] }
  )

  const sOdkazem = identity
    .map((i: any) => ({
      i,
      customerId: (i.app_metadata as Record<string, unknown> | null)
        ?.customer_id as string | undefined,
    }))
    .filter((z): z is { i: any; customerId: string } => Boolean(z.customerId))

  if (!sOdkazem.length) {
    return []
  }

  /* withDeleted: měkce smazaný zákazník se jinak tváří stejně jako
     neexistující, a jsou to dvě různé opravy. */
  const zaznamy = await customers.listCustomers(
    { id: sOdkazem.map((z) => z.customerId) },
    { withDeleted: true }
  )

  /* Typ mapy se píše ručně. Bez něj z ní TypeScript udělá Map<any, unknown>
     a čtení `deleted_at` o kus níž je pak chyba, kterou projektový překlad
     kvůli volnějšímu rozlišení modulů propustí a přísnější neprojde. */
  const podleId = new Map<string, { id: string; email?: string; deleted_at?: unknown }>(
    (zaznamy as any[]).map((c) => [c.id, c])
  )

  const podezreli = sOdkazem.filter((z) => {
    const c = podleId.get(z.customerId)
    return !c || Boolean(c.deleted_at)
  })

  if (!podezreli.length) {
    return []
  }

  /* Pro ty úplně chybějící se ještě zkusí, jestli pod týmž e-mailem
     nežije jiný záznam — to je běžný výsledek ručních zásahů a importů. */
  const emaily = podezreli.map((z) => emailIdentity(z.i)).filter(Boolean)
  const zive = emaily.length
    ? await customers.listCustomers({ email: emaily })
    : []
  const podleEmailu = new Map<string, any[]>()
  for (const c of zive as any[]) {
    const klic = String(c.email ?? "").toLowerCase()
    podleEmailu.set(klic, [...(podleEmailu.get(klic) ?? []), c])
  }

  return podezreli.map(({ i, customerId }) => {
    const email = emailIdentity(i)
    const zaznam = podleId.get(customerId)

    if (zaznam && zaznam.deleted_at) {
      return { identityId: i.id, email, customerId, stav: "mekce-smazany" as const }
    }

    const jini = (podleEmailu.get(email) ?? []).filter((c) => c.id !== customerId)

    if (jini.length === 1) {
      return {
        identityId: i.id,
        email,
        customerId,
        stav: "jiny-zakaznik" as const,
        nahradniId: jini[0].id,
      }
    }

    return { identityId: i.id, email, customerId, stav: "chybi" as const }
  })
}

export type Oprava = "obnovit" | "prepojit" | "uvolnit"

/**
 * Provede jednu opravu a vrátí větu, co se stalo.
 *
 * Každá varianta odpovídá jednomu nálezu; poslat jinou se dá, ale nedopadne
 * to — schválně se nehádá, co se asi myslelo.
 */
export const spravUcet = async (
  container: MedusaContainer,
  identityId: string,
  oprava: Oprava
): Promise<string> => {
  const auth = container.resolve(Modules.AUTH)
  const customers = container.resolve(Modules.CUSTOMER)

  const nalezy = await najdiOsireleUcty(container)
  const ucet = nalezy.find((u) => u.identityId === identityId)

  if (!ucet) {
    return "Tenhle účet už v pořádku je — mezitím se to spravilo jinak."
  }

  if (oprava === "obnovit") {
    if (ucet.stav !== "mekce-smazany") {
      return "Obnovit jde jen měkce smazaný záznam; tenhle v databázi není."
    }
    await customers.restoreCustomers([ucet.customerId])
    return `Zákazník ${ucet.customerId} obnoven i s adresami a objednávkami.`
  }

  if (oprava === "prepojit") {
    if (ucet.stav !== "jiny-zakaznik" || !ucet.nahradniId) {
      return "Přepojit není na co — pod tímhle e-mailem jiný zákazník není."
    }
    const [identity] = await auth.listAuthIdentities({ id: [identityId] })
    await auth.updateAuthIdentities({
      id: identityId,
      app_metadata: {
        ...((identity?.app_metadata as Record<string, unknown>) ?? {}),
        customer_id: ucet.nahradniId,
      },
    })
    return `Přihlášení přepojeno na zákazníka ${ucet.nahradniId}.`
  }

  /* uvolnit: identita pryč, e-mail je zase volný pro novou registraci.
     Heslo tím zaniká — je to jediná varianta, která něco maže, a proto ta,
     kterou administrace nabízí až jako poslední. */
  await auth.deleteAuthIdentities([identityId])
  return `E-mail ${ucet.email} uvolněn. Účet si na něj jde znovu založit.`
}
