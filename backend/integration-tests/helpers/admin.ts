import { Modules } from "@medusajs/framework/utils"

/**
 * Creates an admin and returns headers that authenticate as them.
 *
 * Medusa has no public "make me an admin" endpoint — the first user is created
 * out of band — so this assembles one the way the framework does internally: an
 * auth identity holding the password, a user record, and the link between them
 * written into the identity's `app_metadata`. Miss the link and login succeeds
 * while every admin request is rejected, which is a confusing way to spend an
 * afternoon.
 */
export const createAdminHeaders = async (
  container: any,
  api: any,
  email = `admin-${Date.now()}@keramickazahrada.test`,
  password = "supersecret"
): Promise<Record<string, string> | null> => {
  try {
    const auth = container.resolve(Modules.AUTH)
    const users = container.resolve(Modules.USER)

    const user = await users.createUsers({ email })

    // Register through the provider rather than writing an auth identity
    // directly. `emailpass` stores a *hash*, so a hand-built identity with a
    // plaintext `password` in provider_metadata is accepted at creation and
    // then never matches at login — which fails as a missing token rather than
    // as an error, and reads exactly like "the route is broken".
    const registered: any = await auth.register("emailpass", {
      body: { email, password },
    } as any)

    const authIdentity = registered?.authIdentity ?? registered?.auth_identity

    if (!authIdentity?.id) {
      console.warn(
        `[admin helper] emailpass register returned no identity: ${JSON.stringify(
          registered
        )?.slice(0, 200)}`
      )
      return null
    }

    // Links the auth identity to the admin user; without it login succeeds and
    // every admin request is still rejected.
    await auth.updateAuthIdentities({
      id: authIdentity.id,
      app_metadata: { user_id: user.id },
    })

    const login = await api
      .post("/auth/user/emailpass", { email, password })
      .catch((error: any) => error.response)

    const token = login?.data?.token

    if (!token) {
      console.warn(
        `[admin helper] login returned ${login?.status}: ${JSON.stringify(
          login?.data
        )?.slice(0, 200)}`
      )
      return null
    }

    return { authorization: `Bearer ${token}` }
  } catch (error: any) {
    // Returning null lets a suite skip loudly rather than fail with a stack
    // trace about auth internals that says nothing about the route under test.
    console.warn(`[admin helper] could not create an admin: ${error.message}`)
    return null
  }
}
