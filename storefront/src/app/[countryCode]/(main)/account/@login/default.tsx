import { getPageCopy } from "@lib/data/site-copy"
import LoginTemplate from "@modules/account/templates/login-template"

/**
 * What this slot renders for any account URL it has no segment of its own for.
 *
 * `@login` is a single `page.tsx` at /account, while `@dashboard` has a segment for wishlist,
 * orders, profile, reviews, addresses and kurzy. When the layout picks this slot — no customer —
 * on one of those deeper URLs, Next has nothing here to match and, without a `default`, renders
 * the slot as missing: the page comes back broken instead of asking anyone to sign in.
 *
 * The middleware sends signed-out visitors back to /account before they get here, so in practice
 * this catches the two cases a cookie check cannot: a client-side navigation that never reaches
 * the middleware, and a `_medusa_jwt` that is present but no longer valid — where the cookie gate
 * lets the request through and only the server's `retrieveCustomer()` finds out otherwise.
 */
export default async function LoginDefault() {
  // Stejné bloky jako `page.tsx` vedle — hero globální, věty formuláře z účtu.
  const [global, ucet] = await Promise.all([getPageCopy("global"), getPageCopy("ucet")])
  return <LoginTemplate block={global["global.prihlaseni"]} form={ucet["ucet.formular"]} />
}
