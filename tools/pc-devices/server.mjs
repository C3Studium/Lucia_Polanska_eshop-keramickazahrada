// Most k prohlížeči na PC: drží jedno ladicí spojení se záložkou a pouští ho
// dál — panel v prohlížeči a HTTP API pro agenty. Kostra je stejná jako u
// valecms devices pro iPhone (stejné cesty, stejné odpovědi), navíc měření,
// která jdou jen na PC.
//
// Poslouchá jen na 127.0.0.1: /api/eval spustí libovolný kód ve stránce.

import { createServer } from 'node:http'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ChromeDevice } from './cdp.mjs'
import { listTabs, newTab, version } from './browser.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MAX_EVENTS = 3000

export async function startBridge({ port = 4601, cdp = 9333, tab: wantedTab, out = process.cwd(), log = console.log, onStop = null } = {}) {
    const state = { device: null, tab: null, connected: false, error: null, now: null, events: [], seq: 0, preview: false }
    let device = null
    let wanted = wantedTab ?? null
    const clients = new Set()

    const broadcast = (payload) => {
        const line = `data: ${JSON.stringify(payload)}\n\n`
        for (const res of clients) res.write(line)
    }
    const record = (events) => {
        for (const e of events) state.events.push({ seq: ++state.seq, ...e })
        if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS)
    }
    const status = () => ({
        device: state.device,
        tab: state.tab && { index: state.tab.index, title: state.tab.title, url: state.tab.url },
        connected: state.connected,
        preview: state.preview,
        error: state.error,
        now: state.now,
        lastEvent: state.seq,
    })

    const pickTab = (tabs) => {
        if (!tabs.length) return null
        if (wanted === null || wanted === undefined || wanted === '') return tabs.find((t) => /^https?:/.test(t.url)) ?? tabs[0]
        if (/^\d+$/.test(String(wanted))) return tabs[Number(wanted)] ?? tabs[0]
        return tabs.find((t) => t.url.includes(wanted) || t.title.includes(wanted)) ?? tabs[0]
    }

    let connecting = null
    const connect = () => {
        if (connecting) return connecting
        connecting = (async () => {
            try {
                device?.close()
                device = null
                state.connected = false
                const info = await version(cdp)
                if (!info) throw new Error(`prohlížeč s ladicím rozhraním neběží na portu ${cdp}`)
                state.device = { name: info.Browser, os: process.platform }
                let tabs = await listTabs(cdp)
                if (!tabs.length) {
                    await newTab(cdp)
                    tabs = await listTabs(cdp)
                }
                const tab = pickTab(tabs)
                if (!tab) throw new Error('v prohlížeči není otevřená žádná záložka')
                const next = new ChromeDevice(tab)
                await next.connect()
                await next.front()
                device = next
                state.tab = tab
                state.connected = true
                state.error = null
                broadcast({ status: status() })
                log(`  připojeno: ${info.Browser} → ${tab.url}`)
            } catch (e) {
                state.error = e.message
                state.connected = false
                broadcast({ status: status() })
            } finally {
                connecting = null
            }
        })()
        return connecting
    }

    const needDevice = async () => {
        if (!device || device.closed) await connect()
        if (!device) throw new Error(state.error || 'prohlížeč není připojený')
        return device
    }

    let failures = 0
    const poll = async () => {
        try {
            if (!device || device.closed) await connect()
            if (device) {
                // Pád záložky („Jejda…" / Aw, Snap) ohlásí prohlížeč sám.
                if (device.crashed && !device.crashed.recorded) {
                    device.crashed.recorded = true
                    record([{ type: 'crash', t: 0, y: state.now?.y ?? 0, url: state.now?.url, section: state.now?.section }])
                    log(`  PÁD záložky: ${state.now?.url} (y ${state.now?.y}, ${state.now?.section || '?'})`)
                }
                const v = await device.drain()
                failures = 0
                if (v) {
                    if (state.tab && v.now.url !== state.tab.url) state.tab = { ...state.tab, url: v.now.url, title: v.now.title }
                    state.now = v.now
                    if (v.events.length) record(v.events)
                    broadcast({ now: v.now, events: state.events.slice(-v.events.length), status: v.events.length ? status() : undefined })
                }
            }
        } catch (e) {
            if (++failures >= 3) {
                state.error = e.message
                failures = 0
                device?.close()
                device = null
                state.connected = false
                broadcast({ status: status() })
            }
        }
        setTimeout(poll, 400)
    }

    const json = (res, code, body) => {
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(body))
    }
    const body = (req) =>
        new Promise((resolve) => {
            let s = ''
            req.on('data', (d) => (s += d))
            req.on('end', () => {
                try {
                    resolve(s ? JSON.parse(s) : {})
                } catch {
                    resolve({})
                }
            })
        })

    const routes = {
        'GET /': (req, res) => {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
            res.end(readFileSync(path.join(HERE, 'dashboard.html')))
        },
        'GET /api/status': (req, res) => json(res, 200, status()),
        'GET /api/tabs': async (req, res) => json(res, 200, await listTabs(cdp)),
        'POST /api/use': async (req, res) => {
            wanted = (await body(req)).tab ?? null
            await connect()
            json(res, 200, status())
        },
        'POST /api/preview': async (req, res) => {
            const { on } = await body(req)
            state.preview = on !== false
            broadcast({ status: status() })
            json(res, 200, { preview: state.preview })
        },
        'GET /api/frame': async (req, res) => {
            if (!state.preview) return json(res, 409, { error: 'náhled vypnutý — zapne ho `devices preview on`' })
            const d = await needDevice()
            const shot = await d.screenshot()
            res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' })
            res.end(shot.png)
        },
        'POST /api/shot': async (req, res) => {
            const d = await needDevice()
            const shot = await d.screenshot()
            const { file } = await body(req)
            const target = file ? path.resolve(out, file) : path.join(out, '.valecms', 'pc-devices', `shot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`)
            mkdirSync(path.dirname(target), { recursive: true })
            writeFileSync(target, shot.png)
            json(res, 200, { path: target, width: shot.width, height: shot.height })
        },
        'POST /api/eval': async (req, res) => {
            const { code, timeout } = await body(req)
            const d = await needDevice()
            json(res, 200, { value: await d.evaluate(String(code ?? ''), (Number(timeout) || 60) * 1000) })
        },
        'POST /api/open': async (req, res) => {
            const { url } = await body(req)
            const d = await needDevice()
            await d.navigate(String(url))
            json(res, 200, { ok: true, url })
        },
        'POST /api/reload': async (req, res) => {
            const d = await needDevice()
            await d.reload()
            json(res, 200, { ok: true })
        },
        'POST /api/tap': async (req, res) => {
            const { x, y } = await body(req)
            const d = await needDevice()
            json(res, 200, { hit: await d.tap(Number(x), Number(y)) })
        },
        'POST /api/move': async (req, res) => {
            const d = await needDevice()
            json(res, 200, await d.move(await body(req)))
        },
        'POST /api/scroll': async (req, res) => {
            const b = await body(req)
            const d = await needDevice()
            json(res, 200, { y: b.y !== undefined ? await d.scrollTo(b.y) : await d.scroll(b.dy, b.at) })
        },
        'POST /api/type': async (req, res) => {
            const { text } = await body(req)
            const d = await needDevice()
            json(res, 200, { result: await d.type(String(text ?? '')) })
        },
        'POST /api/key': async (req, res) => {
            const { key } = await body(req)
            const d = await needDevice()
            json(res, 200, { result: await d.key(String(key)) })
        },
        'GET /api/layers': async (req, res) => {
            const d = await needDevice()
            json(res, 200, await d.layers(Number(new URL(req.url, 'http://x').searchParams.get('top')) || 8))
        },
        'POST /api/trace': async (req, res) => {
            const d = await needDevice()
            json(res, 200, await d.trace(await body(req)))
        },
        'POST /api/profile': async (req, res) => {
            const d = await needDevice()
            json(res, 200, await d.profile(await body(req)))
        },
        'POST /api/cpu': async (req, res) => {
            const d = await needDevice()
            json(res, 200, await d.cpu((await body(req)).rate))
        },
        'POST /api/viewport': async (req, res) => {
            const b = await body(req)
            const d = await needDevice()
            json(res, 200, await d.viewport(b.width, b.height, b.dpr))
        },
        'GET /api/gpu': async (req, res) => {
            const d = await needDevice()
            json(res, 200, await d.gpu())
        },
        'GET /api/log': (req, res) => {
            const q = new URL(req.url, 'http://x').searchParams
            const after = Number(q.get('after') || 0)
            const types = q.get('types')?.split(',').filter(Boolean)
            json(res, 200, { events: state.events.filter((e) => e.seq > after && (!types || types.includes(e.type))), last: state.seq, now: state.now })
        },
        'POST /api/log/clear': (req, res) => {
            state.events = []
            broadcast({ cleared: true })
            json(res, 200, { ok: true, last: state.seq })
        },
        // Ukončí most (a prohlížeč, pokud ho most pustil) — agent nemusí hledat proces.
        'POST /api/stop': (req, res) => {
            json(res, 200, { ok: true })
            setTimeout(() => onStop?.(), 50)
        },
        'GET /api/stream': (req, res) => {
            res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
            res.write(`data: ${JSON.stringify({ status: status(), events: state.events.slice(-300) })}\n\n`)
            clients.add(res)
            req.on('close', () => clients.delete(res))
        },
    }

    const server = createServer(async (req, res) => {
        const key = `${req.method} ${req.url.split('?')[0]}`
        const route = routes[key]
        if (!route) return json(res, 404, { error: `neznámá cesta ${key}` })
        try {
            await route(req, res)
        } catch (e) {
            if (!res.headersSent) json(res, 500, { error: e.message })
            else res.end()
        }
    })
    await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, '127.0.0.1', resolve)
    })
    await connect()
    poll()
    return { server, url: `http://localhost:${port}`, state, close: () => (device?.close(), server.close()) }
}
