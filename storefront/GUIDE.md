When developing use this script: 

{
  "name": "pk_website",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "sync:styles": "node scripts/sync-styles.js",
    "watch:styles": "chokidar \"src/**/*.@(scss|css)\" -i \"src/styles/system/**\" -i \"**/node_modules/**\" -i \"**/.next/**\" -c \"npm run sync:styles\"",
    "dev:next": "next dev --turbopack",
    "dev": "npm-run-all -p watch:styles dev:next",
    "build": "npm run sync:styles && next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@vercel/analytics": "^1.5.0",
    "framer-motion": "^12.5.0",
    "js-cookie": "^3.0.5",
    "lenis": "^1.2.3",
    "next": "^15.5.9",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "regl": "^2.1.1",
    "resend": "^4.2.0",
    "sass": "^1.85.1",
    "sonner": "^2.0.2"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3",
    "@types/react": "19.2.7",
    "chokidar-cli": "^3.0.0",
    "eslint": "^9",
    "eslint-config-next": "15.2.2",
    "npm-run-all": "^4.1.5"
  }
}


when running on production: 


{
  "name": "pk_website",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@vercel/analytics": "^1.5.0",
    "framer-motion": "^12.5.0",
    "js-cookie": "^3.0.5",
    "lenis": "^1.2.3",
    "next": "^15.5.9",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "regl": "^2.1.1",
    "resend": "^4.2.0",
    "sass": "^1.85.1",
    "sonner": "^2.0.2"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3",
    "@types/react": "19.2.7",
    "chokidar-cli": "^3.0.0",
    "eslint": "^9",
    "eslint-config-next": "15.2.2",
    "npm-run-all": "^4.1.5"
  }
}



########################

## What This System Does
Layered responsive Sass: breakpoints ordered small → large with smt/mdt specials; layers guarantee larger viewports win.

Auto-scaling typography: sys.font scales across breakpoints via the layered mixins.
Shortcut helpers: concise mixins for per-breakpoint styles (h-layer, h-prop, h-block, plus compact aliases).

JS breakpoint helper: mirrors the Sass breakpoints (including height guards) for matchMedia/Framer logic.
Auto-wiring styles: a sync script injects shortcuts into new style files and regenerates imports into globals.scss.


## Key Files to Copy
_breakpoints.scss – breakpoint maps.
_mixins.scss – layered mixins (h/v, h-layer/v-layer, h-prop/v-prop, h-block/v-block), layer order, smt/mdt caps.

_typography.scss – font tokens + font mixin that scales via the layers.
_shortcuts.scss – shorthand helpers (h/v, hb/vb, compact xxs-h etc., font).
sync-styles.js – injects shortcuts into new styles and regenerates auto-import block in globals.
package.json scripts – sync:styles, watch:styles, dev, build (with pre-sync).
next.config.mjs – Sass includePath + additionalData if you want; ESM-safe __dirname.
checkViewport.js – JS breakpoint mirror for matchMedia logic.

## How It Works

# Helpers: 
Use include h(...) / h-layer / h-prop / h-block (and vertical counterparts) or the compact aliases (xxs-h, lg-h, etc.). Fonts via @include font(token).

# Auto-wiring: 
sync-styles.js prepends _shortcuts.scss" as *; to non-system style files and inserts @use "...relative-path..." as _sN; into an auto block in globals.scss. Watcher (watch:styles) runs on add/remove events; build runs sync:styles once.

# JS helper: 
checkViewport.js exports bpH/bpV, matchesH/V, currentH/V, and media query lists, matching the Sass maps (including smt/mdt height conditions).
Usage (Sass)
No per-file @use needed if the sync script injected shortcuts. Otherwise: _shortcuts.scss" as *;.

## Set styles inline:
.nav {
  @include hb((
    xxs: (height: 6vh, flex-direction: column),
    smt: (height: 5vh),
    lg:  (height: 6vh)
  ));
  @include vb((
    xxs: (height: 6vh, flex-direction: column),
    smt: (height: 5vh),
    lg:  (height: 6vh)
  ));
  @include font(Nav);
}


## Usage (JS/Framer)
Import from checkViewport.js:
import { currentH, matchesH } from "@/helpers/checkViewport";
const bp = currentH();        // e.g., "lg"
const isLgUp = matchesH("lg");

## Vision
A self-contained responsive system for Next/React combining layered Sass (larger wins), auto-scaling typography, JS breakpoint parity, and automated wiring of styles—no off-the-shelf package needed, but packaged for reuse as a custom toolkit.