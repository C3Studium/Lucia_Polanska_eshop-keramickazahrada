// Kam přepsat ukázkovou adresu Studia — viz `@lib/studio-preview/pages`.
//
// Volá to jen `middleware.ts`, s cookies redaktora. Odpověď:
//   { target: "/cz/order/order_…/confirmed?token=…" }      přepsat sem
//   { target: "/cz/account", cookies: { _medusa_jwt } }    přepsat a cookies vložit do požadavku
//   { cookies: { _medusa_cart_id } }                       neměnit adresu, jen vložit cookies
//   { missing: "rezervace kurzu" }                         ukázková data zatím nejsou
//   404                                                    není přihlášený redaktor / neznámá adresa
//
// Redaktor = platná session Studia (ValeCMS `getSessionUser`). Backend vydá data
// jen proti krátkodobému tokenu podepsanému sdíleným ADMIN_BRIDGE_SECRET.
import '@c3studium/valecms/server/registerSchemas.js'
import * as cmsServer from '@c3studium/valecms/server'
import { NextRequest, NextResponse } from 'next/server'

import { sdk } from '@lib/config'
import { getPublishedLegalRegistry } from '@lib/data/legal-registry'
import type { LegalSlug } from '@lib/legal/types'
import { signAdminBridgeToken } from '@lib/util/admin-bridge-token'
import {
    studioPreviewNeedsResolve,
    studioPreviewPageFor,
    type StudioPreviewData,
} from '@lib/studio-preview/pages'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const server = cmsServer as unknown as {
    getSessionUser: (req: { headers: Record<string, string> }) => Promise<{ email?: string } | null>
}

/* Data se mění pomalu a čte je jen pár redaktorů: chvíli v paměti procesu stačí. */
const DATA_TTL_MS = 60 * 1000
const CART_TTL_MS = 10 * 60 * 1000
/** Token zákazníka platí 15 minut; brát nový po deseti, ať nevyprší uprostřed náhledu. */
const CUSTOMER_TTL_MS = 10 * 60 * 1000
type Cached<T> = { at: number; value: T } | null
let dataCache: Cached<StudioPreviewData> = null
let cartCache: Cached<string | null> = null
let customerCache: Cached<{ token: string; order_id: string | null } | null> = null

const fresh = <T,>(cache: Cached<T>, ttl: number): cache is { at: number; value: T } =>
    Boolean(cache && Date.now() - cache.at < ttl)

const backend = async <T,>(email: string, query = ''): Promise<T> => {
    const secret = process.env.ADMIN_BRIDGE_SECRET ?? ''
    if (!secret) throw new Error('ADMIN_BRIDGE_SECRET není nastavený')
    const token = signAdminBridgeToken(
        { email: `studio:${email}`, exp: Math.floor(Date.now() / 1000) + 120 },
        secret
    )
    return sdk.client.fetch<T>(`/store/studio-preview${query}`, {
        headers: { 'x-studio-preview': token },
        cache: 'no-store',
    })
}

const NO_STORE = { 'Cache-Control': 'no-store' }
const none = () => new NextResponse(null, { status: 404, headers: NO_STORE })
const answer = (body: Record<string, unknown>, status = 200) =>
    NextResponse.json(body, { status, headers: NO_STORE })

export async function GET(request: NextRequest) {
    const page = studioPreviewPageFor(request.nextUrl.searchParams.get('p') ?? '')
    if (!page || !studioPreviewNeedsResolve(page)) return none()

    const user = await server
        .getSessionUser({ headers: { cookie: request.headers.get('cookie') ?? '' } })
        .catch(() => null)
    if (!user) return none()
    const email = String(user.email ?? '')
    const country = page.path.split('/')[1] || 'cz'
    const missing = () => answer({ missing: page.missing ?? 'ukázková data' })

    try {
        if (page.cart) {
            if (!fresh(cartCache, CART_TTL_MS)) {
                const { cart_id } = await backend<{ cart_id: string | null }>(email, '?cart=1')
                cartCache = { at: Date.now(), value: cart_id }
            }
            return cartCache!.value ? answer({ cookies: { _medusa_cart_id: cartCache!.value } }) : missing()
        }

        if (page.account) {
            if (!fresh(customerCache, CUSTOMER_TTL_MS)) {
                const { customer } = await backend<{ customer: { token: string; order_id: string | null } | null }>(
                    email,
                    '?customer=1'
                )
                customerCache = { at: Date.now(), value: customer }
            }
            const customer = customerCache!.value
            const target = customer ? page.account(customer.order_id, country) : null
            return customer && target ? answer({ target, cookies: { _medusa_jwt: customer.token } }) : missing()
        }

        if (page.legal) {
            const registry = await getPublishedLegalRegistry()
            const current = registry.currentVersion(page.legal as LegalSlug)
            return current ? answer({ target: `/${country}/pravni-dokument/${page.legal}/${current.version}` }) : missing()
        }

        if (!fresh(dataCache, DATA_TTL_MS)) {
            dataCache = { at: Date.now(), value: await backend<StudioPreviewData>(email) }
        }
        const target = page.target!(dataCache!.value, country)
        return target ? answer({ target }) : missing()
    } catch (error) {
        console.error(`[studio-preview] ${page.path}: ${(error as Error)?.message ?? error}`)
        return answer({ missing: 'spojení s backendem' }, 502)
    }
}
