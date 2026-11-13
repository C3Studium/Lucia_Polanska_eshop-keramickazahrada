// Prohlížeč na PC s otevřeným ladicím rozhraním (Chrome DevTools Protocol).
//
// Chrome i Edge ho mají vestavěné — na rozdíl od iPhonu tu žádná proxy není.
// Spouští se s VLASTNÍM profilem (~/.valecms/pc-browser), takže se nedotkne
// běžného prohlížeče s přihlášeními, a s vypnutým uspáváním na pozadí:
// zakryté nebo neaktivní okno by jinak dostalo přiškrcené snímky a měření
// plynulosti by lhalo.
//
// Hledá se: VALECMS_BROWSER (cesta), Chrome, Edge.

import { existsSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import path from 'node:path'

export const PROFILE = path.join(homedir(), '.valecms', 'pc-browser')

const candidates = () => {
    const env = process.env
    if (process.platform === 'win32') {
        const roots = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean)
        return [
            ...roots.map((r) => path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe')),
            ...roots.map((r) => path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
        ]
    }
    if (process.platform === 'darwin') {
        return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
    }
    return ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge']
}

/** Cesta k prohlížeči, nebo null. */
export function findBrowser() {
    if (process.env.VALECMS_BROWSER && existsSync(process.env.VALECMS_BROWSER)) return process.env.VALECMS_BROWSER
    return candidates().find((p) => existsSync(p)) ?? null
}

/** Odpovídá na portu ladicí rozhraní? Vrací /json/version, nebo null. */
export async function version(port) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) })
        return res.ok ? await res.json() : null
    } catch {
        return null
    }
}

/**
 * Pustí prohlížeč (nebo použije už běžící na stejném portu).
 * `size` je velikost okna, ne viewportu — viewport přesně nastaví `viewport`.
 */
export async function launchBrowser({ port = 9333, url = 'about:blank', size = '1600,1000', exe = findBrowser() } = {}) {
    const running = await version(port)
    if (running) return { child: null, reused: true, info: running }
    if (!exe) throw new Error('nenašel jsem Chrome ani Edge — nastav VALECMS_BROWSER na cestu k prohlížeči')
    mkdirSync(PROFILE, { recursive: true })
    const args = [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${PROFILE}`,
        '--no-first-run',
        '--no-default-browser-check',
        // Zakryté / neaktivní okno nesmí škrtit snímky ani časovače.
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        `--window-size=${size}`,
        url,
    ]
    const child = spawn(exe, args, { stdio: 'ignore', windowsHide: false })
    for (let i = 0; i < 60; i++) {
        const info = await version(port)
        if (info) return { child, reused: false, info }
        if (child.exitCode !== null) break
        await new Promise((r) => setTimeout(r, 250))
    }
    child.kill()
    throw new Error('prohlížeč nenaběhl s ladicím rozhraním (neběží už stejný profil bez něj?)')
}

/** Otevřené stránky (jen záložky, ne service workery a rozšíření). */
export async function listTabs(port) {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) })
    const raw = await res.json()
    return raw
        .filter((t) => t.type === 'page' && !t.url.startsWith('devtools://'))
        .map((t, i) => ({ index: i, id: t.id, title: t.title, url: t.url, ws: t.webSocketDebuggerUrl }))
}

/** Nová záložka s adresou. */
export async function newTab(port, url = 'about:blank') {
    const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURI(url)}`, { method: 'PUT', signal: AbortSignal.timeout(3000) })
    return res.json()
}
