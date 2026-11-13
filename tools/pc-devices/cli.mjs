#!/usr/bin/env node
// `devices` pro PC — prohlížeč na tomhle počítači, ovládaný a měřený stejně
// jako iPhone ve valecms devices. Stejné příkazy a stejné HTTP API (jen jiný
// port: 4601), aby se to dalo později přenést do valecms jako druhý cíl.
//
//   node tools/pc-devices/cli.mjs                 pustí prohlížeč + most (panel na localhost:4601)
//   node tools/pc-devices/cli.mjs status | shot | eval "…" | scroll 600 | trace scroll | …

import { spawn } from 'node:child_process'
import { request } from 'node:http'
import { launchBrowser } from './browser.mjs'

const DEFAULT_PORT = 4601
const DEFAULT_CDP = 9333

const HELP = `
  devices (PC) — prohlížeč na tomhle počítači, pro tebe i pro agenty

  node tools/pc-devices/cli.mjs [start]   pustí prohlížeč (vlastní profil) a most, panel na http://localhost:${DEFAULT_PORT}
      --url=ADRESA          co otevřít
      --size=1600,1000      velikost okna
      --port=${DEFAULT_PORT}            port panelu a API
      --cdp=${DEFAULT_CDP}             ladicí port prohlížeče
      --no-open             neotvírat panel

  Stejné jako u iPhonu:
  status                    stav: prohlížeč, stránka, viewport, scroll, sekce, fps, frekvence monitoru
  tabs | use N|text         záložky / přepnout
  open URL | reload         adresa / obnovit
  shot [soubor]             snímek viditelné stránky (PNG)
  eval "kód"                JavaScript ve stránce (await, příkazy i objekt jako v konzoli)
  tap X Y                   SKUTEČNÉ kliknutí myší na bod (CSS px)
  scroll DY [--at=X,Y]      kolečko myši (projde přes Lenis), volitelně nad bodem; scroll --to=Y = skok
  type "text" | key Enter   psaní do pole s fokusem / klávesa
  layers [N]                vrstvy kompozitoru: počet, odhad paměti, největší s důvodem
  log [--after=N] [--types=slow,long,webgl,error,crash] [--clear]
  preview off|on            živý náhled v panelu (výchozí vypnutý)

  Jen na PC:
  move X1 Y1 X2 Y2 [--ms=800]   myš po přímce v reálném čase (shadery, kapalina)
  move --circle [--ms=1500]     myš kolem středu okna
  trace [idle|scroll|move|load] [--s=3]    hlavní vlákno: styly, layout, kreslení, kdo vyvolal přepočet
  profile [idle|scroll|move|load] [--s=3]  nejdražší funkce JavaScriptu
  cpu N                     zpomalit procesor N× (1 = vypnout)
  viewport W H [DPR] | viewport reset
  gpu                       grafická karta, frekvence monitoru, verdikt shaderů webu
  stop                      ukončit most (i prohlížeč, který pustil)
`

const parse = (argv) => {
    const flags = {}
    const rest = []
    for (const a of argv) {
        if (a.startsWith('--no-')) flags[a.slice(5)] = false
        else if (a.startsWith('--')) {
            // Jen na prvním `=` — hodnota sama `=` obsahovat smí (`--url=…?step=address`).
            const i = a.indexOf('=')
            flags[i < 0 ? a.slice(2) : a.slice(2, i)] = i < 0 ? true : a.slice(i + 1)
        } else rest.push(a)
    }
    return { flags, rest }
}

// node:http bez keep-alive, ne fetch: ukončení procesu uprostřed zavírání
// spojení fetch hlásí Node na Windows jako „Assertion failed … async.c".
const api = (port, path, body) =>
    new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body)
        const req = request(
            { host: '127.0.0.1', port, path, method: payload ? 'POST' : 'GET', agent: false, headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {} },
            (res) => {
                let s = ''
                res.setEncoding('utf8')
                res.on('data', (d) => (s += d))
                res.on('end', () => {
                    let data = {}
                    try {
                        data = s ? JSON.parse(s) : {}
                    } catch {}
                    if (res.statusCode >= 400) reject(new Error(data.error || `HTTP ${res.statusCode}`))
                    else resolve(data)
                })
            }
        )
        req.on('error', () => reject(new Error('most neběží — pusť ho: node tools/pc-devices/cli.mjs')))
        if (payload) req.write(payload)
        req.end()
    })

const print = (v) => console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2))

const openBrowser = (url) => {
    const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]]
    try {
        spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).unref()
    } catch {}
}

async function start(flags) {
    if (Number(process.versions.node.split('.')[0]) < 22) {
        console.error(`  potřebuje Node 22+ (WebSocket v Node). Teď běží ${process.versions.node}.`)
        return 1
    }
    const port = Number(flags.port) || DEFAULT_PORT
    const cdp = Number(flags.cdp) || DEFAULT_CDP
    const browser = await launchBrowser({ port: cdp, url: typeof flags.url === 'string' ? flags.url : 'about:blank', size: typeof flags.size === 'string' ? flags.size : undefined })
    console.log(`  ${browser.reused ? 'prohlížeč už běží — používám ho' : 'prohlížeč běží'}: ${browser.info.Browser} (ladicí port ${cdp})`)

    let stopping = false
    const { startBridge } = await import('./server.mjs')
    let bridge
    const stop = () => {
        if (stopping) return
        stopping = true
        bridge?.close()
        browser.child?.kill()
        setTimeout(() => process.exit(0), 200)
    }
    bridge = await startBridge({ port, cdp, tab: flags.tab, log: (m) => console.log(m), onStop: stop })
    if (!bridge.state.connected) console.log(`  zatím nepřipojeno: ${bridge.state.error}`)
    console.log(`\n  Panel:  ${bridge.url}`)
    console.log(`  Agenti: node tools/pc-devices/cli.mjs status | shot | eval "…" | trace scroll | log   (API ${bridge.url}/api)`)
    console.log('  Ukončit: Ctrl+C nebo `… cli.mjs stop`\n')
    if (flags.open !== false) openBrowser(bridge.url)
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
    await new Promise(() => {})
}

async function main() {
    const { flags, rest } = parse(process.argv.slice(2))
    const sub = rest[0] || 'start'
    const args = rest.slice(1)
    const port = Number(flags.port) || DEFAULT_PORT
    const act = (a) => (['idle', 'scroll', 'move', 'load'].includes(a) ? a : 'idle')
    switch (sub) {
        case 'start':
            return start(flags)
        case 'help':
            console.log(HELP)
            return 0
        case 'status': {
            const s = await api(port, '/api/status')
            if (!s.connected) {
                console.log(`prohlížeč nepřipojený: ${s.error || '?'}`)
                return 1
            }
            const n = s.now || {}
            print({
                browser: s.device?.name,
                url: s.tab?.url,
                viewport: n.width && `${n.width}×${n.inner} @${n.dpr}x`,
                scroll: n.max !== undefined ? `${n.y} / ${n.max}` : undefined,
                section: n.section,
                fps: n.fps,
                monitorHz: n.hz,
                shaders: n.fx,
                canvases: n.canvases,
                lastEvent: s.lastEvent,
            })
            return 0
        }
        case 'tabs':
            print((await api(port, '/api/tabs')).map((t) => `${t.index}  ${t.title}  ${t.url}`).join('\n') || 'žádné záložky')
            return 0
        case 'use':
            print((await api(port, '/api/use', { tab: args[0] ?? null })).tab)
            return 0
        case 'shot': {
            const r = await api(port, '/api/shot', { file: args[0] })
            print(`${r.path}  (${r.width}×${r.height})`)
            return 0
        }
        case 'eval': {
            const code = args.join(' ')
            if (!code) throw new Error('chybí kód: eval "document.title"')
            print((await api(port, '/api/eval', { code, timeout: flags.timeout })).value)
            return 0
        }
        case 'open':
            print(await api(port, '/api/open', { url: args[0] }))
            return 0
        case 'reload':
            print(await api(port, '/api/reload', {}))
            return 0
        case 'tap':
            print((await api(port, '/api/tap', { x: Number(args[0]), y: Number(args[1]) })).hit ?? 'nic pod bodem')
            return 0
        case 'move': {
            const ms = Number(flags.ms) || (flags.circle ? 1500 : 800)
            if (flags.circle) {
                const s = await api(port, '/api/status')
                const w = s.now?.width || 1200
                const h = s.now?.inner || 800
                print(await api(port, '/api/move', { circle: { x: w / 2, y: h / 2, r: w * 0.25, ry: h * 0.25, turns: Number(flags.turns) || 1 }, ms }))
            } else {
                const [x1, y1, x2, y2] = args.map(Number)
                if ([x1, y1, x2, y2].some((v) => !Number.isFinite(v))) throw new Error('move X1 Y1 X2 Y2, nebo move --circle')
                print(await api(port, '/api/move', { from: [x1, y1], to: [x2, y2], ms }))
            }
            return 0
        }
        case 'scroll':
            print((await api(port, '/api/scroll', flags.to !== undefined ? { y: Number(flags.to) } : { dy: Number(args[0]), at: typeof flags.at === 'string' ? flags.at.split(',').map(Number) : undefined })).y)
            return 0
        case 'type':
            print((await api(port, '/api/type', { text: args.join(' ') })).result)
            return 0
        case 'key':
            print((await api(port, '/api/key', { key: args[0] })).result)
            return 0
        case 'layers': {
            const r = await api(port, `/api/layers?top=${Number(args[0]) || 8}`)
            console.log(`${r.count} vrstev (${r.drawing} kreslí), odhad ${r.mb} MB paměti GPU`)
            for (const l of r.top) console.log(`  ${String(l.mb).padStart(6)} MB  ${l.size.padEnd(11)} ${(l.element || '').padEnd(40)} [${l.reasons.join(', ')}]`)
            return 0
        }
        case 'trace': {
            const r = await api(port, '/api/trace', { action: act(args[0]), seconds: Number(flags.s) || 3 })
            print(r)
            return 0
        }
        case 'profile': {
            const r = await api(port, '/api/profile', { action: act(args[0]), seconds: Number(flags.s) || 3 })
            console.log(`${r.action}, ${r.seconds} s — nečinnost ${r.idleMs} ms\n  funkce (vlastní čas):`)
            r.top.forEach((l) => console.log('   ' + l))
            console.log('  soubory:')
            r.files.forEach((l) => console.log('   ' + l))
            return 0
        }
        case 'cpu':
            print(await api(port, '/api/cpu', { rate: Number(args[0]) || 1 }))
            return 0
        case 'viewport':
            print(await api(port, '/api/viewport', args[0] === 'reset' || !args[0] ? { width: 'reset' } : { width: Number(args[0]), height: Number(args[1]), dpr: Number(args[2]) || 0 }))
            return 0
        case 'gpu':
            print(await api(port, '/api/gpu'))
            return 0
        case 'preview': {
            const on = !/^(off|0|false|ne)$/i.test(args[0] ?? 'on')
            print((await api(port, '/api/preview', { on })).preview ? 'náhled zapnutý' : 'náhled vypnutý')
            return 0
        }
        case 'stop':
            print(await api(port, '/api/stop', {}))
            return 0
        case 'log': {
            if (flags.clear) {
                print(await api(port, '/api/log/clear', {}))
                return 0
            }
            const q = new URLSearchParams()
            if (flags.after) q.set('after', flags.after)
            if (flags.types) q.set('types', flags.types)
            const r = await api(port, `/api/log?${q}`)
            for (const e of r.events) {
                const { seq, type, t, y, ...rest } = e
                console.log(`#${seq} ${(t / 1000).toFixed(1)}s y${y} ${type} ${JSON.stringify(rest)}`)
            }
            console.log(`(poslední událost #${r.last})`)
            return 0
        }
        default:
            console.log(HELP)
            return 1
    }
}

main()
    .then((code) => {
        if (typeof code === 'number') process.exitCode = code
    })
    .catch((e) => {
        console.error(`  ${e.message}`)
        process.exitCode = 1
    })
