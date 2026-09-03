// Režim prohlížeče pro Studio — viz valecms/server/studio.
import '@c3studium/valecms/server/registerSchemas.js'
import { handleAsof } from '@c3studium/valecms/server/studio/index.js'
import { asAppRoute } from '@c3studium/valecms/runtime/appRoute.js'

const handler = asAppRoute(handleAsof)

export { handler as GET, handler as POST }
export const dynamic = 'force-dynamic'
