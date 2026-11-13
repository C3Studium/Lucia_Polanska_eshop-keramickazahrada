// Nahrávač, který most vstříkne do stránky v prohlížeči na PC (přes
// Page.addScriptToEvaluateOnNewDocument, takže i do každé další stránky).
// Vychází z nahrávače pro iPhone (valecms devices), s tím, co je na PC jinak:
//
// - Zásek se měří proti skutečné frekvenci monitoru, ne proti 60 Hz. Na 144 Hz
//   je snímek 6,9 ms a zaseknutý je už ten přes ~17 ms; pevná hranice 34 ms by
//   na rychlém monitoru propustila zásek o čtyřech snímcích.
// - Zásek se počítá při scrollu I při pohybu myši (shadery a kapalina reagují
//   na kurzor, ne na scroll).
// - Ztráta WebGL kontextu a dlouhé úlohy hlavního vlákna jsou vlastní události.
// - Lišta Safari tu není, takže se nesleduje.

function recorder() {
    if (window.__valecmsDevices) return 'already'
    const started = performance.now()
    const events = []
    const push = (type, data) => {
        events.push({ type, t: Math.round(performance.now() - started), y: Math.round(scrollY), ...data })
        if (events.length > 500) events.splice(0, events.length - 500)
    }
    const section = () => {
        const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
        const s = el && el.closest('section, [data-scroll-section], [aria-label], footer, header')
        if (!s) return null
        return s.getAttribute('data-scroll-label') || s.getAttribute('aria-label') || s.id || (s.className && String(s.className).split(' ')[0]) || s.tagName.toLowerCase()
    }

    let last = performance.now()
    let lastY = scrollY
    let frames = 0
    let fps = 0
    let windowStart = last
    let lastScrollAt = 0
    let lastPointerAt = 0
    let capturing = false
    let captureEnd = -1e9
    // Typický snímek: klouzavý průměr jen z „klidných" snímků, ať ho záseky
    // nevytáhnou nahoru. Startuje na 60 Hz a během vteřiny se usadí.
    let frameMs = 1000 / 60

    addEventListener('pointermove', () => (lastPointerAt = performance.now()), { passive: true, capture: true })

    const tick = (t) => {
        const dt = t - last
        last = t
        frames++
        if (t - windowStart >= 1000) {
            fps = Math.round((frames * 1000) / (t - windowStart))
            frames = 0
            windowStart = t
        }
        if (dt > 0 && dt < frameMs * 1.5) frameMs += (dt - frameMs) * 0.05
        const moved = scrollY !== lastY
        lastY = scrollY
        if (moved) lastScrollAt = t
        const scrolling = t - lastScrollAt < 150
        const pointing = t - lastPointerAt < 150
        // Zaseknutý = delší než dva a půl typického snímku (60 Hz → 42 ms, ale
        // nejvýš 34 ms jako u iPhonu; 144 Hz → 17 ms).
        const limit = Math.min(34, frameMs * 2.5)
        if ((scrolling || pointing) && dt > limit) {
            push('slow', { ms: Math.round(dt), frames: Math.round(dt / frameMs), during: scrolling ? 'scroll' : 'pointer', section: section(), ...(capturing || t - captureEnd < 150 ? { capture: true } : {}) })
        }
        requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    try {
        new PerformanceObserver((list) => {
            for (const e of list.getEntries()) if (e.duration >= 100) push('long', { ms: Math.round(e.duration), section: section() })
        }).observe({ type: 'longtask', buffered: false })
    } catch {}

    // webglcontextlost nebublá, ale v zachytávací fázi ho okno uvidí.
    addEventListener('webglcontextlost', (e) => push('webgl', { lost: true, canvas: (e.target && e.target.parentElement && String(e.target.parentElement.className).split(' ')[0]) || 'canvas' }), true)
    addEventListener('error', (e) => push('error', { text: String(e.message || e.error || e).slice(0, 300), at: e.filename ? `${e.filename.split('/').pop()}:${e.lineno}` : undefined }))
    addEventListener('unhandledrejection', (e) => push('error', { text: 'promise: ' + String((e.reason && (e.reason.stack || e.reason.message)) || e.reason).slice(0, 300) }))
    for (const level of ['error', 'warn']) {
        const orig = console[level]
        console[level] = function (...args) {
            try {
                push(level === 'error' ? 'console.error' : 'console.warn', { text: args.map((a) => (typeof a === 'string' ? a : (a && a.message) || JSON.stringify(a))).join(' ').slice(0, 300) })
            } catch {}
            return orig.apply(this, args)
        }
    }
    addEventListener('resize', () => push('resize', { size: `${innerWidth}×${innerHeight}` }))

    window.__valecmsDevices = {
        capture(on) {
            capturing = on
            if (!on) captureEnd = performance.now()
            return 0
        },
        drain() {
            const out = events.splice(0, events.length)
            const root = document.documentElement
            return {
                now: {
                    url: location.href,
                    title: document.title,
                    fps,
                    hz: Math.round(1000 / frameMs),
                    scrolling: performance.now() - lastScrollAt < 150,
                    y: Math.round(scrollY),
                    max: Math.max(0, root.scrollHeight - innerHeight),
                    width: innerWidth,
                    inner: innerHeight,
                    dpr: devicePixelRatio,
                    section: section(),
                    fx: root.dataset.fx ? `${root.dataset.fx}/${root.dataset.fxReason || ''}` : null,
                    canvases: document.querySelectorAll('canvas').length,
                },
                events: out,
            }
        },
    }
    push('load', { url: location.href })
    return 'installed'
}

export const RECORDER = `(${recorder.toString()})()`
