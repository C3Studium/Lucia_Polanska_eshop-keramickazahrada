// Spojení se záložkou prohlížeče na PC (Chrome DevTools Protocol).
//
// Stejné rozhraní jako `Device` pro iPhone ve valecms devices (drain,
// screenshot, evaluate, navigate, reload, tap, scroll, scrollTo, type, layers,
// close), takže server a příkazy jsou pro oba cíle stejné. Navíc to, co na PC
// jde a na iPhonu ne: skutečná myš a kolečko (projdou přes Lenis a do shaderů),
// trace hlavního vlákna s invalidacemi stylu, profil JS, zpomalení CPU
// a přesná velikost viewportu.

import { RECORDER } from './recorder.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export class ChromeDevice {
    constructor(tab) {
        this.tab = tab
        this.ws = null
        this.seq = 0
        this.pending = new Map()
        this.listeners = new Set()
        this.closed = false
        this.crashed = null
        this.layerTree = null
    }

    async connect() {
        this.ws = new WebSocket(this.tab.ws)
        await new Promise((resolve, reject) => {
            this.ws.onerror = () => reject(new Error('spojení se záložkou se nepovedlo (nemá ji otevřenou DevTools?)'))
            this.ws.onopen = () => resolve()
        })
        this.ws.onmessage = (ev) => this.#receive(JSON.parse(String(ev.data)))
        this.ws.onclose = () => {
            this.closed = true
            for (const [, p] of this.pending) p.reject(new Error('spojení se záložkou se zavřelo'))
            this.pending.clear()
        }
        await this.send('Page.enable')
        await this.send('Runtime.enable')
        await this.send('Inspector.enable').catch(() => {})
        // Do každé další stránky v záložce (navigace, obnovení) automaticky.
        await this.send('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER })
        await this.inject()
        return this
    }

    #receive(msg) {
        if (msg.id !== undefined && this.pending.has(msg.id)) {
            const p = this.pending.get(msg.id)
            this.pending.delete(msg.id)
            clearTimeout(p.timer)
            if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message || JSON.stringify(msg.error)}`))
            else p.resolve(msg.result)
            return
        }
        if (msg.method === 'Inspector.targetCrashed') this.crashed = { at: Date.now() }
        if (msg.method === 'LayerTree.layerTreeDidChange' && msg.params?.layers) this.layerTree = msg.params.layers
        for (const fn of this.listeners) fn(msg)
    }

    on(fn) {
        this.listeners.add(fn)
        return () => this.listeners.delete(fn)
    }

    send(method, params = {}, timeout = 30000) {
        if (this.closed) return Promise.reject(new Error('spojení se záložkou je zavřené'))
        return new Promise((resolve, reject) => {
            const id = ++this.seq
            const timer = setTimeout(() => {
                this.pending.delete(id)
                reject(new Error(`${method}: prohlížeč neodpověděl`))
            }, timeout)
            this.pending.set(id, { resolve, reject, timer, method })
            this.ws.send(JSON.stringify({ id, method, params }))
        })
    }

    /** Výraz → hodnota (JSON). */
    async raw(expression, timeout = 8000) {
        const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeout)
        if (r.exceptionDetails) throw new Error('chyba ve stránce: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
        return r.result?.value
    }

    /**
     * Libovolný kód → hodnota. `replMode` dělá totéž co konzole v DevTools:
     * funguje `await` na nejvyšší úrovni, příkazy i holý objektový literál.
     */
    async evaluate(code, timeout = 60000) {
        let r = await this.send('Runtime.evaluate', { expression: code, replMode: true, awaitPromise: true, returnByValue: true, userGesture: true }, timeout)
        if (r.exceptionDetails) throw new Error('chyba ve stránce: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
        // V režimu konzole se čeká jen na `await` na nejvyšší úrovni — vrácený Promise
        // (třeba z `(async () => …)()`) přijde jako objekt `{}`. Dočkat se ho tady.
        if (r.result?.subtype === 'promise' && r.result.objectId) {
            r = await this.send('Runtime.awaitPromise', { promiseObjectId: r.result.objectId, returnByValue: true }, timeout)
            if (r.exceptionDetails) throw new Error('chyba ve stránce: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
        }
        return r.result?.value ?? null
    }

    inject() {
        return this.raw(RECORDER)
    }

    async drain() {
        const v = await this.raw('window.__valecmsDevices ? window.__valecmsDevices.drain() : null')
        if (v) return v
        await this.inject().catch(() => {})
        return null
    }

    /** PNG viditelné části stránky. Na PC stránku nezastavuje, jen stojí čas GPU. */
    async screenshot() {
        const [w, h] = await this.raw('[innerWidth, innerHeight]')
        await this.raw('window.__valecmsDevices && window.__valecmsDevices.capture(true)').catch(() => {})
        try {
            const r = await this.send('Page.captureScreenshot', { format: 'png' })
            return { png: Buffer.from(r.data, 'base64'), width: w, height: h }
        } finally {
            this.raw('window.__valecmsDevices && window.__valecmsDevices.capture(false)').catch(() => {})
        }
    }

    async navigate(url) {
        this.crashed = null
        await this.front()
        await this.send('Page.navigate', { url })
    }

    /** Záložku dopředu (jinak nedostává snímky — fps 0 a měření i klikání lžou). */
    async front() {
        await this.send('Page.bringToFront').catch(() => {})
    }

    async reload() {
        this.crashed = null
        await this.send('Page.reload', {})
    }

    async #describe(x, y) {
        return this.raw(`(() => {
            const el = document.elementFromPoint(${x}, ${y})
            if (!el) return null
            return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/)[0] : '') + (el.getAttribute('aria-label') ? ' [' + el.getAttribute('aria-label') + ']' : '') + ' ' + (el.textContent || '').trim().slice(0, 40)
        })()`)
    }

    /** Skutečné kliknutí myší na bod (CSS px viewportu) — důvěryhodná událost, ne syntetická. */
    async tap(x, y) {
        // Ve skryté záložce se nekreslí a časovače se škrtí — klik musí jít do přední.
        await this.front()
        const hit = await this.#describe(x, y)
        await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
        await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
        await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
        return hit
    }

    /**
     * Myš po dráze v reálném čase: přímka z bodu do bodu, nebo kruh kolem
     * středu. Shadery a kapalina reagují na pohyb, ne na kliknutí.
     */
    async move({ from, to, circle, ms = 1000 }) {
        const step = 1000 / 120
        const n = Math.max(2, Math.round(ms / step))
        const t0 = performance.now()
        for (let i = 0; i <= n; i++) {
            let x, y
            if (circle) {
                const a = (i / n) * Math.PI * 2 * (circle.turns ?? 1)
                x = circle.x + Math.cos(a) * circle.r
                y = circle.y + Math.sin(a) * (circle.ry ?? circle.r)
            } else {
                x = from[0] + ((to[0] - from[0]) * i) / n
                y = from[1] + ((to[1] - from[1]) * i) / n
            }
            await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(x), y: Math.round(y) })
            const wait = t0 + (i + 1) * step - performance.now()
            if (wait > 0) await sleep(wait)
        }
        return { steps: n + 1, ms: Math.round(performance.now() - t0) }
    }

    /**
     * Kolečko myši — projde přes Lenis stejně jako u návštěvníka. Velký posun
     * se rozdělí na „cvaknutí" po 120 px s rozestupem jako při točení kolečkem
     * a počká se, až se stránka zastaví.
     */
    async scroll(dy, at) {
        dy = Number(dy) || 0
        // `at` = [x, y]: točit kolečkem nad konkrétním místem (vnořený posuvný panel).
        const [w, h] = at ? [at[0] * 2, at[1] * 2] : await this.raw('[innerWidth, innerHeight]')
        const notch = 120 * Math.sign(dy)
        let left = dy
        while (Math.abs(left) > 0) {
            const d = Math.abs(left) > 120 ? notch : left
            await this.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(w / 2), y: Math.round(h / 2), deltaX: 0, deltaY: d })
            left -= d
            await sleep(40)
        }
        return this.#settle()
    }

    async scrollTo(y) {
        await this.raw(`(window.lenis ? window.lenis.scrollTo(${Number(y) || 0}, { immediate: true }) : window.scrollTo(0, ${Number(y) || 0}), 0)`)
        return this.#settle()
    }

    async #settle() {
        let prev = null
        for (let i = 0; i < 40; i++) {
            const y = await this.raw('Math.round(scrollY)')
            if (y === prev) return y
            prev = y
            await sleep(80)
        }
        return prev
    }

    async type(text) {
        await this.send('Input.insertText', { text })
        return 'ok'
    }

    /** Klávesa (Enter, Escape, Tab, ArrowDown…). */
    async key(name) {
        const codes = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Space: 32 }
        const p = { key: name === 'Space' ? ' ' : name, code: name, windowsVirtualKeyCode: codes[name] ?? 0 }
        await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...p })
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...p })
        return 'ok'
    }

    /**
     * Vrstvy kompozitoru: počet, odhad paměti (šířka × výška × 4 B × dpr²
     * u vrstev, které kreslí) a největší i s důvodem.
     */
    async layers(top = 8) {
        await this.send('DOM.enable').catch(() => {})
        await this.send('DOM.getDocument', { depth: 0 }).catch(() => {})
        this.layerTree = null
        await this.send('LayerTree.enable')
        // Strom přijde událostí; drobný posun ji vyvolá i na stránce v klidu.
        for (let i = 0; i < 30 && !this.layerTree; i++) {
            if (i === 5) await this.raw('(scrollBy(0, 1), scrollBy(0, -1), 0)').catch(() => {})
            await sleep(100)
        }
        const layers = this.layerTree || []
        const dpr = (await this.raw('devicePixelRatio').catch(() => 1)) || 1
        const bytes = (l) => (l.drawsContent ? l.width * l.height * 4 * dpr * dpr : 0)
        const total = layers.reduce((s, l) => s + bytes(l), 0)
        const out = []
        for (const l of [...layers].sort((a, b) => bytes(b) - bytes(a)).slice(0, top)) {
            const why = await this.send('LayerTree.compositingReasons', { layerId: l.layerId }).catch(() => null)
            let element = ''
            if (l.backendNodeId) {
                const d = await this.send('DOM.describeNode', { backendNodeId: l.backendNodeId }).catch(() => null)
                const n = d?.node
                if (n) {
                    const a = n.attributes || []
                    const ci = a.indexOf('class')
                    element = n.nodeName.toLowerCase() + (ci >= 0 ? '.' + a[ci + 1].trim().split(/\s+/)[0] : '')
                }
            }
            out.push({ mb: Math.round(bytes(l) / 1e5) / 10, size: `${Math.round(l.width)}×${Math.round(l.height)}`, paints: l.paintCount, element, reasons: why?.compositingReasonIds || why?.compositingReasons || [] })
        }
        await this.send('LayerTree.disable').catch(() => {})
        return { count: layers.length, drawing: layers.filter((l) => l.drawsContent).length, mb: Math.round(total / 1e5) / 10, top: out }
    }

    /** Co se během měření děje: nic, scroll kolečkem, kroužení myší, nebo načtení stránky. */
    async #act(action, ms) {
        if (action === 'scroll') {
            // Rovnoměrně jako člověk: cvaknutí kolečka (120 px) každých 120 ms.
            const [w, h] = await this.raw('[innerWidth, innerHeight]')
            const end = performance.now() + ms
            while (performance.now() < end) {
                await this.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(w / 2), y: Math.round(h / 2), deltaX: 0, deltaY: 120 })
                await sleep(120)
            }
        } else if (action === 'move') {
            const [w, h] = await this.raw('[innerWidth, innerHeight]')
            await this.move({ circle: { x: w / 2, y: h / 2, r: w * 0.25, ry: h * 0.25, turns: ms / 1500 }, ms })
        } else if (action === 'load') {
            await this.reload()
            await sleep(ms)
        } else await sleep(ms)
    }

    /**
     * Trace hlavního vlákna: kolik stojí skripty, přepočet stylů, layout,
     * kreslení a skládání vrstev, a KDO přepočty stylů vyvolal (invalidace
     * s prvkem a důvodem). Tohle odhalilo patičku, která při scrollu
     * procházela celou sekci nad sebou.
     */
    async trace({ action = 'idle', seconds = 3 } = {}) {
        const events = []
        const off = this.on((m) => m.method === 'Tracing.dataCollected' && events.push(...m.params.value))
        const done = new Promise((resolve) => {
            const stop = this.on((m) => m.method === 'Tracing.tracingComplete' && (stop(), resolve()))
        })
        await this.send('Tracing.start', {
            categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking',
            transferMode: 'ReportEvents',
        })
        await this.#act(action, seconds * 1000)
        await this.send('Tracing.end')
        await done
        off()

        // Hlavní vlákno stránky = CrRendererMain. Ve viditelném prohlížeči má
        // víc práce vlákno GPU nebo prohlížeče, takže „nejrušnější vlákno" by
        // ukázalo jejich čísla, ne čísla stránky.
        const renderer = new Set(events.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map((e) => `${e.pid}:${e.tid}`))
        const tasks = new Map()
        for (const e of events) if (e.ph === 'X' && e.name === 'RunTask' && (!renderer.size || renderer.has(`${e.pid}:${e.tid}`))) tasks.set(`${e.pid}:${e.tid}`, (tasks.get(`${e.pid}:${e.tid}`) || 0) + e.dur)
        const mainKey = [...tasks.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
        if (!mainKey) return { action, seconds, error: 'trace je prázdný' }
        const [pid, tid] = mainKey.split(':').map(Number)
        const mine = events.filter((e) => e.pid === pid && e.tid === tid && e.ph === 'X')
        const sum = new Map()
        for (const e of mine) if (e.name !== 'RunTask') sum.set(e.name, (sum.get(e.name) || 0) + (e.dur || 0))
        const ms = (us) => Math.round(us / 1000)
        const pick = ['FunctionCall', 'EvaluateScript', 'FireAnimationFrame', 'EventDispatch', 'TimerFire', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'Commit', 'ParseHTML', 'MajorGC', 'MinorGC', 'IntersectionObserverController::computeIntersections']
        const cost = {}
        for (const k of pick) if (sum.get(k)) cost[k] = ms(sum.get(k))
        const inv = new Map()
        for (const e of events) {
            if (!/StyleRecalcInvalidationTracking/.test(e.name)) continue
            const d = e.args?.data || {}
            const k = `${(d.nodeName || '?').slice(0, 60)} | ${d.reason || ''}`
            inv.set(k, (inv.get(k) || 0) + 1)
        }
        const frames = mine.filter((e) => e.name === 'RunTask' && e.dur > 50000).length
        const biggest = mine.filter((e) => e.name === 'UpdateLayoutTree' || e.name === 'Layout').sort((a, b) => b.dur - a.dur).slice(0, 5).map((e) => `${e.name} ${(e.dur / 1000).toFixed(1)} ms${e.args?.elementCount ? ` (${e.args.elementCount} prvků)` : ''}`)
        return {
            action,
            seconds,
            mainThreadMs: ms(tasks.get(mainKey)),
            tasksOver50ms: frames,
            costMs: cost,
            biggest,
            styleInvalidations: [...inv.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${v}×  ${k}`),
        }
    }

    /** Profil JavaScriptu: nejdražší funkce (vlastní čas) a soubory. */
    async profile({ action = 'idle', seconds = 3 } = {}) {
        await this.send('Profiler.enable')
        await this.send('Profiler.setSamplingInterval', { interval: 200 })
        await this.send('Profiler.start')
        await this.#act(action, seconds * 1000)
        const { profile } = await this.send('Profiler.stop')
        const byId = new Map(profile.nodes.map((n) => [n.id, n]))
        const self = new Map()
        const files = new Map()
        profile.samples.forEach((id, i) => {
            const f = byId.get(id).callFrame
            const dt = profile.timeDeltas[i] || 0
            const file = f.url.split('/').pop() || '(prohlížeč)'
            const k = `${f.functionName || '(anonymní)'}  ${file}:${f.lineNumber + 1}:${f.columnNumber + 1}`
            self.set(k, (self.get(k) || 0) + dt)
            files.set(file, (files.get(file) || 0) + dt)
        })
        const ms = (us) => Math.round(us / 1000)
        const skip = /^\((idle|program|garbage collector|root)\)/
        return {
            action,
            seconds,
            idleMs: ms([...self.entries()].filter(([k]) => k.startsWith('(idle)')).reduce((a, [, v]) => a + v, 0)),
            top: [...self.entries()].filter(([k]) => !skip.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => `${String(ms(v)).padStart(5)} ms  ${k}`),
            files: [...files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${String(ms(v)).padStart(5)} ms  ${k}`),
        }
    }

    /** Zpomalení procesoru (1 = vypnuto; 4 ≈ slabý notebook / telefon). */
    async cpu(rate) {
        await this.send('Emulation.setCPUThrottlingRate', { rate: Math.max(1, Number(rate) || 1) })
        return { rate: Math.max(1, Number(rate) || 1) }
    }

    /** Přesný viewport (CSS px + hustota), nebo `reset` zpět na okno. */
    async viewport(width, height, dpr) {
        if (width === 'reset' || !width) {
            await this.send('Emulation.clearDeviceMetricsOverride')
            return this.raw('({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })')
        }
        await this.send('Emulation.setDeviceMetricsOverride', { width: Number(width), height: Number(height), deviceScaleFactor: Number(dpr) || 0, mobile: false })
        return this.raw('({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })')
    }

    /** Grafika a shadery: GPU, verdikt brány shaderů na webu, frekvence monitoru. */
    gpu() {
        return this.evaluate(`
            const c = document.createElement('canvas')
            const gl = c.getContext('webgl2')
            const d = gl && gl.getExtension('WEBGL_debug_renderer_info')
            const renderer = gl ? (d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : null
            gl && gl.getExtension('WEBGL_lose_context') && gl.getExtension('WEBGL_lose_context').loseContext()
            const hz = await new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => (++n, performance.now() - t0 < 1000 ? requestAnimationFrame(f) : r(Math.round(n * 1000 / (performance.now() - t0)))); requestAnimationFrame(f) })
            const root = document.documentElement
            ;({ renderer, hz, dpr: devicePixelRatio, fx: root.dataset.fx || null, fxReason: root.dataset.fxReason || null, canvases: [...document.querySelectorAll('canvas')].map((x) => (x.parentElement && String(x.parentElement.className).split(' ')[0]) + ' ' + x.width + '×' + x.height) })
        `)
    }

    close() {
        this.closed = true
        try {
            this.ws?.close()
        } catch {}
    }
}
