"use server"

import { backendUrl, sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { toCzechErrorMessage } from "@lib/util/error-messages"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { ipZHlavicek, vejdeSeDoStropu } from "@lib/util/reset-throttle"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeAuthToken,
  removeCartId,
  setAuthToken,
} from "./cookies"
import { v4 as uuidv4 } from "uuid"

const getSafeAuthRedirect = (formData: FormData): string | null => {
  const redirectTo = formData.get("redirect_to")

  if (
    typeof redirectTo === "string" &&
    /^\/[a-z]{2}\/cart(?:[/?#].*)?$/i.test(redirectTo)
  ) {
    return redirectTo
  }

  return null
}

/**
 * Attempts to refresh the auth token using Medusa SDK.
 * Returns the new token if successful, null otherwise.
 * Note: Does NOT remove the token on failure - the original token might still be valid.
 */
export const refreshAuthToken = async (): Promise<string | null> => {
  try {
    const newToken = await sdk.auth.refresh()
    if (newToken && typeof newToken === "string") {
      await setAuthToken(newToken)
      console.log("[Auth] Token refreshed successfully")
      return newToken
    }
    return null
  } catch (error) {
    // Refresh failed - but don't remove the token, it might still be valid
    // The token will naturally expire or be invalidated by the backend
    console.warn("[Auth] Token refresh failed, keeping existing token")
    return null
  }
}

export const retrieveCustomer = async (opts?: {
  forceFresh?: boolean
  _isRetry?: boolean
}): Promise<HttpTypes.StoreCustomer | null> => {
  const authHeaders = await getAuthHeaders()

  if (!authHeaders || !("authorization" in authHeaders)) return null

  const headers = {
    ...authHeaders,
  }

  const fetchCustomer = async () => {
    // If caller requests fresh data, bypass Next cache
    if (opts?.forceFresh) {
      return await sdk.client
        .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
          method: "GET",
          query: {
            fields: "*orders",
          },
          headers,
          cache: "no-store",
        })
        .then(({ customer }) => customer)
    }

    const next = {
      ...(await getCacheOptions("customers")),
    }

    return await sdk.client
      .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
        method: "GET",
        query: {
          fields: "*orders",
        },
        headers,
        next,
        cache: "force-cache",
      })
      .then(({ customer }) => customer)
  }

  try {
    return await fetchCustomer()
  } catch (error: any) {
    // Check if it's a 401 error and we haven't already retried
    const is401 =
      error?.response?.status === 401 || error?.message?.includes("401")

    if (is401 && !opts?._isRetry) {
      // Try to refresh the token
      const newToken = await refreshAuthToken()
      if (newToken) {
        // Retry with the new token
        return retrieveCustomer({ ...opts, _isRetry: true })
      }
    }

    return null
  }
}

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const updateRes = await sdk.store.customer
    .update(body, {}, headers)
    .then(({ customer }) => customer)
    .catch(medusaError)

  const cacheTag = await getCacheTag("customers")
  revalidateTag(cacheTag)

  return updateRes
}

/**
 * Registrace (přepsáno 2026-08-13 po Matějově hlášení).
 *
 * Průmyslový standard v Medusa 2: guest nákupy registraci NEblokují — guest
 * záznamy zůstávají (vlastní historii objednávek; admin lidi skládá podle
 * e-mailu) a registrace vedle nich založí vlastní záznam s has_account: true.
 * Dřívější mazání guest zákazníka přes upgrade-guest sirotčilo objednávky
 * a stejně řešilo neexistující konflikt.
 *
 * Ověřovací token se zapíše na NOVÝ registrovaný záznam při create — subscriber
 * customer.created podle něj pozná registraci (guesti token nemají) a pošle
 * ověřovací e-mail.
 */
export async function signup(_currentState: unknown, formData: FormData) {
  const password = formData.get("password") as string
  const email = formData.get("email") as string
  const redirectTo = getSafeAuthRedirect(formData)
  let createdCustomer: HttpTypes.StoreCustomer | undefined
  const customerForm = {
    email,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: formData.get("phone") as string,
  }

  const token = uuidv4()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()

  try {
    // Existuje už REGISTROVANÝ účet? (Guest záznamy jsou tu neviditelné.)
    if (await isEmailRegistered(email)) {
      return "Účet s tímto e-mailem už existuje. Zkuste se prosím přihlásit."
    }

    let authToken: string
    try {
      authToken = (await sdk.auth.register("customer", "emailpass", {
        email,
        password,
      })) as string
    } catch {
      /*
       * Nedokončená dřívější registrace: auth identita existuje, zákazník ne.
       * Nárok na ni prokazuje heslo — když sedí, registrace pokračuje; když
       * ne, nemáme jak poznat vlastníka.
       */
      try {
        authToken = (await sdk.auth.login("customer", "emailpass", {
          email,
          password,
        })) as string
      } catch {
        return "Tento e-mail už má rozdělanou registraci s jiným heslem. Nechte si poslat nové heslo, nebo nám napište."
      }
    }

    await setAuthToken(authToken)

    const headers = {
      ...(await getAuthHeaders()),
    }

    const { customer } = await sdk.store.customer.create(
      {
        ...customerForm,
        metadata: {
          email_verified: false,
          email_verification_token: token,
          email_verification_expires_at: expiresAt,
        },
      },
      {},
      headers
    )
    createdCustomer = customer

    const loginToken = await sdk.auth.login("customer", "emailpass", {
      email,
      password,
    })

    await setAuthToken(loginToken as string)

    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)

    await transferCart()
  } catch (error: any) {
    return toCzechErrorMessage(error?.message ?? error?.toString())
  }

  if (redirectTo) {
    redirect(redirectTo)
  }

  return createdCustomer
}
/**
 * Stojí za přihlašovací identitou opravdu zákazník?
 *
 * Přihlášení a zákaznický záznam jsou v Meduse dvě různé věci spojené odkazem.
 * Když záznam zmizí a identita zůstane, `sdk.auth.login` vrátí 200 a platný
 * token — jen `actor_id` v něm ukazuje na někoho, kdo v databázi není.
 * Zaznamenáno naživo: token s actor_id cus_01K2YYP1CG6DC25MYH06ET684E
 * a odpověď „Customer with id ... was not found".
 *
 * Rozlišuje se 404 od ostatních selhání schválně. 404 je odpověď, ne porucha:
 * účet opravdu není. Cokoli jiného (výpadek sítě, pětistovka) je porucha na
 * cestě a kvůli ní se nikomu přihlášení brát nemá — proto `neznamo`, se
 * kterým se pokračuje dál.
 */
const overitZakaznika = async (): Promise<"ok" | "chybi" | "neznamo"> => {
  try {
    await sdk.client.fetch("/store/customers/me", {
      method: "GET",
      headers: await getAuthHeaders(),
      cache: "no-store",
    })
    return "ok"
  } catch (error: any) {
    const stav = error?.status ?? error?.response?.status
    const zprava = String(error?.message ?? "")

    if (stav === 404 || /was not found|not_found/i.test(zprava)) {
      return "chybi"
    }

    return "neznamo"
  }
}

export async function login(_currentState: unknown, formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const redirectTo = getSafeAuthRedirect(formData)

  try {
    await sdk.auth
      .login("customer", "emailpass", { email, password })
      .then(async (token) => {
        await setAuthToken(token as string)
        const customerCacheTag = await getCacheTag("customers")
        revalidateTag(customerCacheTag)
      })
  } catch (error: any) {
    // Try to extract a message from the error object
    if (error?.response) {
      try {
        const data = await error.response.json()
        return toCzechErrorMessage(data?.message)
      } catch {
        return toCzechErrorMessage(error.response.statusText)
      }
    }
    return toCzechErrorMessage(error?.message ?? error?.toString())
  }

  /* Heslo sedělo, ale účet za identitou chybí. Cookie se musí zase sundat —
     jinak by člověk zůstal „přihlášený" do něčeho, co neexistuje, a každá
     stránka účtu by mu vrátila 404. */
  if ((await overitZakaznika()) === "chybi") {
    await removeAuthToken()

    return (
      "Přihlášení k tomuto e-mailu existuje, ale účet k němu v obchodě chybí. " +
      "Napište nám prosím na info@keramickazahrada.cz, obnovíme ho."
    )
  }

  /* Převod košíku přihlášení NEBLOKUJE.
     Je to pohodlí — host měl něco v košíku a nemá o to po přihlášení přijít —,
     ne podmínka. Dřív se jeho selháním vracela chybová hláška, takže úspěšné
     přihlášení vypadalo jako špatné heslo, přestože cookie už byla nastavená.
     Přesně to se stalo u účtu s chybějícím zákazníkem: 404 na
     /store/carts/…/customer a člověk zůstal na přihlašovací stránce. */
  try {
    await transferCart()
  } catch (error: any) {
    console.error(
      "[přihlášení] košík se nepodařilo převést, pokračuji:",
      error?.message ?? error?.toString()
    )
  }

  if (redirectTo) {
    redirect(redirectTo)
  }
}
/**
 * Obnova hesla — tři kroky, všechny na serveru.
 *
 * Dřív si je stránky volaly samy z prohlížeče přes `sdk.auth`. To po Meduse
 * chce `AUTH_CORS` s originem obchodu, a ten na backendu povolený není:
 * preflight na `/auth/customer/emailpass/reset-password` se vrací 204, ale
 * BEZ `access-control-allow-origin`, takže požadavek prohlížeč zahodí ještě
 * před odesláním a uživatel vidí „Failed to fetch". Změřeno na produkčním
 * backendu pro localhost:8000, localhost:7001 i keramickazahrada.cz —
 * nepovolený je každý. `STORE_CORS` naopak localhost:8000 vrací, proto
 * zbytek webu chodí a rozbité je jen tohle.
 *
 * Ze serveru žádné CORS není — to je pravidlo prohlížeče, ne HTTP. Volání
 * tím zároveň zapadá k `login` a `signup` o kus výš, které přes server
 * chodily vždycky; obnova hesla byla jediná výjimka.
 *
 * Vrací `null` při úspěchu a českou hlášku při chybě, stejně jako `login`.
 */
/** Tvar adresy. Ne validace podle RFC — ta se dělá doručením. */
const TVAR_EMAILU = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const DELKA_EMAILU = 254

/**
 * Nejkratší doba, po které se odpovídá.
 *
 * Odpověď je pro existující i neexistující účet stejná, takže jediné, čím by
 * se dalo poznat, kdo u nás účet má, je ČAS: u existujícího se navíc zakládá
 * token a vypravuje událost. Sjednocené dno ten rozdíl schová. 400 ms je pod
 * hranicí, kdy se čekání začne číst jako zdržení, a nad rozptylem, který
 * mezi těmi dvěma větvemi vzniká.
 */
const NEJKRATSI_ODPOVED_MS = 400

const pockejDo = async (cas: number) => {
  const zbyva = cas - Date.now()
  if (zbyva > 0) {
    await new Promise((hotovo) => setTimeout(hotovo, zbyva))
  }
}

/**
 * Žádost o odkaz na nové heslo.
 *
 * ## Odpověď je vždycky stejná
 *
 * Krom vysloveně rozbitého tvaru adresy vrací `null` — tedy „hotovo" — ať
 * účet existuje, neexistuje, nebo backend spadl. Kdyby se rozlišovalo,
 * je z formuláře nástroj na zjišťování, kdo u obchodu nakupuje: stačí zkoušet
 * adresy a číst odpovědi. Skutečná chyba jde do serverového logu, kde patří.
 *
 * Na tvar adresy se odpovídá chybou schválně — to je informace o tom, co
 * člověk napsal, ne o tom, koho známe.
 *
 * ## Strop podle IP
 *
 * Backend počítá žádosti podle adresy příjemce; tady se počítají podle IP
 * odesílatele, protože skutečnou IP vidí jedině tahle strana. Rozdíl a meze
 * obou vrstev popisuje `lib/util/reset-throttle.ts`.
 *
 * Vyčerpaný strop se navenek tváří jako úspěch. Kdo klepe pošesté za čtvrt
 * hodiny, buď e-mail dávno má, nebo ho posílá někam, kam nemá — ani jednomu
 * není co vysvětlovat.
 */
export async function requestPasswordReset(email: string) {
  const dokdy = Date.now() + NEJKRATSI_ODPOVED_MS
  const adresa = (email ?? "").trim().toLowerCase()

  if (
    !adresa ||
    adresa.length > DELKA_EMAILU ||
    !TVAR_EMAILU.test(adresa)
  ) {
    return "Zadejte prosím platnou e-mailovou adresu."
  }

  try {
    const hlavicky = await headers()

    if (vejdeSeDoStropu(`obnova-hesla:${ipZHlavicek(hlavicky)}`)) {
      await sdk.auth.resetPassword("customer", "emailpass", {
        identifier: adresa,
      })
    } else {
      console.warn("[obnova hesla] strop podle IP vyčerpán — žádost neodeslána")
    }
  } catch (error: any) {
    /* Ven se to nedostane. Backendový 429 z tamního omezovače sem chodí
       úplně stejnou cestou jako výpadek — a v obou případech má člověk
       vidět tutéž větu. */
    console.error(
      "[obnova hesla] žádost selhala:",
      error?.message ?? error?.toString()
    )
  }

  await pockejDo(dokdy)

  return null
}

/**
 * Nastavení nového hesla podle tokenu z e-mailu.
 *
 * Token nese odkaz v e-mailu a jde do hlavičky `Authorization` — proto se
 * předává zvlášť, ne v těle.
 */
/**
 * Meze hesla.
 *
 * Osm znaků je totéž, co slibuje nápis v poli — pravidlo, které formulář
 * ukazuje a server nevynucuje, není pravidlo. Horní mez není o síle hesla,
 * ale o tom, že se heslo hashuje: bez stropu je z přihlašovacího pole
 * levný způsob, jak serveru zadat práci na několik megabajtů.
 */
const HESLO_MIN = 8
const HESLO_MAX = 128

export async function updatePasswordWithToken(
  email: string,
  password: string,
  token: string
) {
  /* Kontroly se opakují i na klientovi — tyhle jsou ty platné. Klientské
     jsou kvůli rychlé odezvě, ne kvůli bezpečnosti; obejít je znamená
     otevřít nástroje pro vývojáře. */
  if (!token) {
    return "Odkaz není celý — otevřete ho prosím z e-mailu znovu."
  }

  if (password.length < HESLO_MIN) {
    return `Heslo musí mít aspoň ${HESLO_MIN} znaků.`
  }

  if (password.length > HESLO_MAX) {
    return `Heslo může mít nejvýš ${HESLO_MAX} znaků.`
  }

  if (password.trim().toLowerCase() === (email ?? "").trim().toLowerCase()) {
    return "Heslo nemůže být stejné jako e-mail."
  }

  try {
    await sdk.auth.updateProvider(
      "customer",
      "emailpass",
      { email, password },
      token
    )
  } catch (error: any) {
    return toCzechErrorMessage(error?.message ?? error?.toString())
  }

  return null
}

/**
 * Přihlášení hned po změně hesla.
 *
 * Nejde jen o CORS. `sdk.auth.login` v prohlížeči vrátí token do JS, jenže
 * aplikace čte přihlášení z httpOnly cookie `_medusa_jwt`, kterou z JS
 * nastavit nejde — takže i kdyby CORS povolený byl, člověk by se „přihlásil"
 * a stránka účtu by ho stejně poslala zpátky na přihlášení. Cookie umí
 * nastavit jen server, přes `setAuthToken`.
 *
 * Tělo je záměrně tytéž kroky jako v `login` bez formuláře a přesměrování;
 * `login` zůstává nedotčený, protože je to cesta, kterou chodí všichni.
 */
export async function loginAfterPasswordReset(email: string, password: string) {
  try {
    const token = await sdk.auth.login("customer", "emailpass", {
      email,
      password,
    })
    await setAuthToken(token as string)

    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)
  } catch (error: any) {
    return toCzechErrorMessage(error?.message ?? error?.toString())
  }

  try {
    await transferCart()
  } catch (error: any) {
    return toCzechErrorMessage(error?.message ?? error?.toString())
  }

  return null
}

export async function signout(countryCode: string) {
  try {
    await sdk.auth.logout()
  } catch {
    // Always clear the local session, even if the deleted/expired remote
    // identity can no longer accept a logout request.
  }

  await removeAuthToken()

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  await removeCartId()

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  redirect(`/${countryCode}/account`)
}

export async function transferCart() {
  const cartId = await getCartId()

  if (!cartId) {
    return
  }

  const headers = await getAuthHeaders()

  await sdk.store.cart.transferCart(cartId, {}, headers)

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
}

export const addCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const isDefaultBilling = (currentState.isDefaultBilling as boolean) || false
  const isDefaultShipping = (currentState.isDefaultShipping as boolean) || false

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
    is_default_billing: isDefaultBilling,
    is_default_shipping: isDefaultShipping,
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .createAddress(address, {}, headers)
    .then(async ({ customer }) => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const deleteCustomerAddress = async (
  addressId: string
): Promise<void> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.customer
    .deleteAddress(addressId, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const addressId =
    (currentState.addressId as string) || (formData.get("addressId") as string)

  if (!addressId) {
    return { success: false, error: "Address ID is required" }
  }

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
  } as HttpTypes.StoreUpdateCustomerAddress

  const phone = formData.get("phone") as string

  if (phone) {
    address.phone = phone
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .updateAddress(addressId, address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

/**
 * Existuje pro adresu registrovaný účet? Backend vrací jen boolean — dřív
 * odsud tekl celý záznam zákazníka (a s force-cache klidně zastaralý), teď
 * není co cachovat ani co vyzradit.
 */
export async function isEmailRegistered(email: string): Promise<boolean> {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return await sdk.client
    .fetch<{ registered: boolean }>(
      `store/customers/by-email?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      }
    )
    .then(({ registered }) => registered)
    .catch(() => false)
}

export async function resendVerification(
  email: string
): Promise<{ success: boolean; message: string }> {
  try {
    const headers = await getAuthHeaders()

    // Use sdk.client.fetch for internal Medusa API call
    const res = await sdk.client.fetch<{ message: string }>(
      "store/customers/resend-verification-email",
      {
        method: "POST",
        headers,
        body: { email },
      }
    )

    return { success: true, message: res.message }
  } catch (e: any) {
    // If sdk.client.fetch throws, try to extract the error message
    return { success: false, message: toCzechErrorMessage(e?.message) }
  }
}

export async function verifyCustomerEmail(token: string, email: string) {
  const headers = {
    ...(await getAuthHeaders()),
  }
  try {
    const res = await sdk.client.fetch<{ ok: boolean; message?: string }>(
      "store/customers/verify-email",
      {
        method: "POST",
        headers,
        body: { token, email },
      }
    )
    // Ensure 'ok' is always present for frontend logic
    const result = { ok: res.ok ?? true, message: res.message }

    // If verification succeeded, revalidate customer cache so updated metadata is visible
    if (result.ok) {
      try {
        const cacheTag = await getCacheTag("customers")
        revalidateTag(cacheTag)
      } catch (e) {
        // non-fatal: log and continue
        // eslint-disable-next-line no-console
        console.warn(
          "verifyCustomerEmail: failed to revalidate customer cache",
          e
        )
      }
    }

    return result
  } catch (e: any) {
    return { ok: false, message: toCzechErrorMessage(e?.message) }
  }
}

/* restoreCustomer je pryč (2026-08-13): volal relativní fetch na
   /api/store/... — cestu, která nikde neexistovala, z server action, kde
   relativní fetch stejně nefunguje. Jeho jediná větev v signup byla mrtvá,
   protože listCustomers smazané účty vůbec nevrací. */

export async function deleteAccount(): Promise<{
  success: boolean
  message: string
}> {
  try {
    const headers = await getAuthHeaders()
    if (!headers || !("authorization" in headers)) {
      return { success: false, message: "Unauthorized." }
    }

    await sdk.client.fetch<{ success: boolean; message: string }>(
      "/store/customers/delete-account",
      {
        method: "POST",
        headers,
        cache: "no-store",
      }
    )

    return { success: true, message: "Your account has been deleted." }
  } catch (e: any) {
    return {
      success: false,
      message: toCzechErrorMessage(e?.message),
    }
  }
}

export const getCustomerWishlistItems = async (): Promise<any[]> => {
  const authHeaders = await getAuthHeaders()

  if (!authHeaders) return []

  /*
   * Publikovatelný klíč patří i sem.
   *
   * `/store/*` si ho vynucuje bez ohledu na přihlášení — přihlášený zákazník
   * bez něj dostane 400, ne 401. Volání níž vrací při neúspěchu prázdné pole,
   * takže by se to neprojevilo jako chyba, ale jako „nemáte nic uloženého",
   * což je ta horší varianta: vypadá jako platná odpověď.
   *
   * Ostatní čtení jdou přes SDK, které si klíč bere z konfigurace samo; tohle
   * je jeden ze tří syrových `fetch` v celém `lib/data`, a proto se na něj
   * zapomnělo. (Stejná příčina jako u `shop-status`.)
   */
  const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  const headers = {
    ...authHeaders,
    ...(pk ? { "x-publishable-api-key": pk, "x-publishable-key": pk } : {}),
  }

  try {
    const res = await fetch(
      `${backendUrl}/store/customers/me/wishlists`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      }
    )

    if (!res.ok) {
      return []
    }

    const data = await res.json()
    return data.wishlist?.items ?? []
  } catch (error) {
    console.error("Failed to fetch wishlist items:", error)
    return []
  }
}
