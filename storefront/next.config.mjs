import path from "node:path"
import { fileURLToPath } from "node:url"
import { withValeCms } from "@c3studium/valecms/install/next.mjs"

import checkEnvVariables from "./check-env-variables.js"

/*
 * Byl to `next.config.js` (CommonJS) — přepsaný na ESM, protože ValeCMS
 * dodává svůj wrapper jako `.mjs` v balíčku s `"type": "module"`, a ten
 * z CommonJS `require()` prostě nejde načíst. Instalátor si na to proto
 * netroufl a přepis nechal na nás; jiná cesta než `next.config.mjs` tu není
 * (leda asynchronní config s dynamickým `import()`, což je křehčí a část
 * nástrojů kolem Nextu s tím neumí).
 *
 * Co se z CommonJS muselo přeložit:
 * - `require()` → `import`
 * - `__dirname` v ESM neexistuje, dopočítává se z `import.meta.url`
 * - `module.exports` → `export default`
 *
 * `check-env-variables.js` zůstává CommonJS; Node ho přes výchozí import
 * načte správně, proto je v cestě uvedená i přípona.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))

checkEnvVariables()

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  /*
   * Kam se staví. `.next`, dokud někdo neřekne jinak.
   *
   * `next dev` a `next build` píšou do téhož adresáře a přepisují si navzájem
   * chunky. Když běží obojí, build spadne na `Cannot find module './7847.js'`
   * nebo `Cannot find module for page: /_document` — chybové hlášky, které
   * o skutečné příčině neřeknou nic a svádějí hledat je v kódu.
   *
   * Ověřit build s běžícím vývojem jde proto takhle:
   *
   *     NEXT_DIST_DIR=.next-check pnpm run build
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  sassOptions: {
    includePaths: [path.join(__dirname, "src")],
  },
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@modules": path.resolve(__dirname, "src/modules"),
      "@lib": path.resolve(__dirname, "src/lib"),
      "@pages": path.resolve(__dirname, "src/pages"),
    }
    return config
  },
  images: {
    // Product photography ships at quality 100 everywhere (2026-08-16 — the
    // old mix of 50–90 looked visibly compressed on retina screens); 75 stays
    // allowed for decorative images that don't pass an explicit quality.
    // Listing the values now is also what Next 16 will require.
    qualities: [75, 100],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      ...(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ? [{
        // Note: needed to serve images from /public folder
        protocol: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL.startsWith('https') ? 'https' : 'http',
        hostname: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL.replace(/^https?:\/\//, ''),
      }] : []),
      ...(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ? [{
        // Note: only needed when using local-file for product media
        protocol: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL.startsWith('https') ? 'https' : 'http',
        hostname: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL.replace(/^https?:\/\//, ''),
      }] : []),
      { // Note: can be removed after deleting demo products
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      { // Note: can be removed after deleting demo products
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      { // Note: can be removed after deleting demo products
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
        {
          protocol: "https",
          hostname: "bucket-production-2be7.up.railway.app",
        },
      ...(process.env.NEXT_PUBLIC_MINIO_ENDPOINT ? [{ // Note: needed when using MinIO bucket storage for media
        protocol: "https",
        hostname: process.env.NEXT_PUBLIC_MINIO_ENDPOINT,
      }] : []),
      ...(process.env.CMS_MEDIA_HOST ? [{ // Knihovna médií ValeCMS
        protocol: "https",
        hostname: process.env.CMS_MEDIA_HOST.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
      }] : []),
    ],
  }
}

/*
 * Wrapper nic z výše uvedeného nepřepisuje — ověřeno ve zdroji balíčku:
 * náš `webpack` hook si zavolá první a ke svému výsledku teprve přidá aliasy
 * `valecms.config` / `valecms.types`, `images.remotePatterns` rozšiřuje o
 * hostitele úložiště (naše položky zůstávají první) a případné `headers()`
 * skládá tak, že naše předchází jeho `noindex` pro /studio a /api/cms.
 */
export default withValeCms(nextConfig)
