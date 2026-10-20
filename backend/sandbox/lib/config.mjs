// Sdílené konstanty sandboxu — porty, cesty, přístupy. Nic z toho není tajné:
// všechno platí jen pro lokální vestavěný Postgres a lokální procesy.
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

export const SANDBOX_DIR = path.resolve(here, "..")
export const BACKEND_DIR = path.resolve(SANDBOX_DIR, "..")
export const REPO_DIR = path.resolve(BACKEND_DIR, "..")
export const STOREFRONT_DIR = path.join(REPO_DIR, "storefront")

export const PG_DATA_DIR = path.join(SANDBOX_DIR, ".pgdata")
export const MAIL_DIR = path.join(SANDBOX_DIR, ".mail")
export const LOG_DIR = path.join(SANDBOX_DIR, ".logs")
export const RUN_DIR = path.join(SANDBOX_DIR, ".run")
export const ARTIFACTS_DIR = path.join(SANDBOX_DIR, ".artifacts")
export const GUARD_PATH = path.join(SANDBOX_DIR, "lib", "env-guard.cjs")

export const PORTS = {
  postgres: 54329,
  mail: 54400,
  backend: 9100,
  storefront: 8100,
}

export const PG = {
  user: "postgres",
  password: "sandbox",
  database: "medusa_sandbox",
  host: "127.0.0.1",
}

export const DATABASE_URL = `postgres://${PG.user}:${PG.password}@${PG.host}:${PORTS.postgres}/${PG.database}`

export const BACKEND_URL = `http://localhost:${PORTS.backend}`
export const STOREFRONT_URL = `http://localhost:${PORTS.storefront}`
// 127.0.0.1, ne localhost: zachytávač poslouchá jen na IPv4 smyčce.
export const MAIL_URL = `http://127.0.0.1:${PORTS.mail}`

/** Přihlášení do sandbox administrace (Admin API). */
export const ADMIN = {
  email: "admin@sandbox.test",
  password: "sandbox-admin-123",
}

/** E-maily, kam sandbox posílá upozornění pro majitelku / vývojáře. */
export const OWNER_EMAIL = "owner@sandbox.test"
export const DEV_EMAIL = "dev@sandbox.test"

/** Seed sem zapíše publishable key a id regionů (čte smoke test i storefront). */
export const SEED_STATE_FILE = path.join(RUN_DIR, "seed-state.json")

export const MEDUSA_CLI = path.join(BACKEND_DIR, "node_modules", "@medusajs", "cli", "cli.js")
export const NEXT_CLI = path.join(STOREFRONT_DIR, "node_modules", "next", "dist", "bin", "next")
