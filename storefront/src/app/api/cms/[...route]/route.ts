// Každá serverová operace CMS na jedné catch-all routě.
//
// Obsluha je psaná proti `(req, res)`; `asAppRoute` z ní udělá obsluhu, kterou
// App Router čeká. Překládá se rozhraní, ne obsluha — jinak by existovaly dvě
// verze téhož a ta druhá by byla správná do první úpravy.
//
// `registerSchemas` resetuje registr typů dřív, než se typy vyhodnotí.
import '@c3studium/valecms/server/registerSchemas.js'
import { handleCmsRequest } from '@c3studium/valecms/server/handlers/index.js'
import { asAppRoute } from '@c3studium/valecms/runtime/appRoute.js'

const handler = asAppRoute(handleCmsRequest)

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE }

// Data se čtou při každém požadavku; statická odpověď by vracela cizí obsah.
export const dynamic = 'force-dynamic'
