// Každá serverová operace CMS na jedné catch-all routě.
//
// Obsluha je psaná proti `(req, res)`; `asAppRoute` z ní udělá obsluhu, kterou
// App Router čeká. Překládá se rozhraní, ne obsluha — jinak by existovaly dvě
// verze téhož a ta druhá by byla správná do první úpravy.
//
// `registerSchemas` resetuje registr typů dřív, než se typy vyhodnotí.
//
// ## Zámek právních dokumentů
//
// ValeCMS publikovaný dokument zamknout neumí a háčky nemá, takže tahle routa
// je jediné místo, kde jde vydané znění právního dokumentu ochránit: před
// obsluhou se zeptá `guardLegalCmsRequest` (pravidla v `@lib/legal/cms-guard`).
// Odmítnutí má tvar chyby ValeCMS, takže ho Studio ukáže jako svou hlášku.
// Ostatní typy dokumentů a všechna čtení projdou beze změny.
import '@c3studium/valecms/server/registerSchemas.js'
import { handleCmsRequest } from '@c3studium/valecms/server/handlers/index.js'
import { asAppRoute } from '@c3studium/valecms/runtime/appRoute.js'

import { guardLegalCmsRequest } from '@lib/data/legal-cms-guard'
import { ohlasit } from '@lib/server/live-bus'

const cmsHandler = asAppRoute(handleCmsRequest)

type RouteContext = { params: Promise<Record<string, string | string[]>> }

/*
 * Publikování ze Studia → otevřené záložky si obsah obnoví hned (18. 11. 2026,
 * `lib/server/live-bus`). Jen to, co mění veřejný web: přechod dokumentu
 * (publish, unpublish, archive, restore) a nastavení webu. Ukládání konceptu
 * je vidět jen ve Studiu, to záložky nebudí.
 */
const VEREJNE_PRECHODY = new Set(['publish', 'unpublish', 'archive', 'restore'])

const menilVerejnyWeb = (request: Request, params: Record<string, string | string[]>) => {
    if (request.method === 'GET' || request.method === 'HEAD') return false
    const casti = ([] as string[]).concat(params.route ?? [])
    if (casti[0] === 'settings') return true
    return casti[0] === 'documents' && VEREJNE_PRECHODY.has(String(casti[2] ?? ''))
}

const handler = async (request: Request, context: RouteContext): Promise<Response> => {
    const params = await context.params
    const refused = await guardLegalCmsRequest(request, params)
    if (refused) return refused
    const response = await cmsHandler(request, context)
    if (response.ok && menilVerejnyWeb(request, params)) ohlasit('changed', { cms: true })
    return response
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE }

// Data se čtou při každém požadavku; statická odpověď by vracela cizí obsah.
export const dynamic = 'force-dynamic'
