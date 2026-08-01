#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { spawn } = require("child_process")

const command = process.argv[2]
const commandArgs = process.argv.slice(3)

if (!command || !["build", "dev", "start"].includes(command)) {
  console.error("Usage: run-next-with-storefront-env.js <build|dev|start> [...args]")
  process.exit(1)
}

function loadLocalEnvironment() {
  const environment =
    process.env.NODE_ENV || (command === "dev" ? "development" : "production")
  const candidates = [
    `.env.${environment}.local`,
    ".env.local",
    `.env.${environment}`,
    ".env",
  ]

  for (const filename of candidates) {
    const filepath = path.resolve(process.cwd(), filename)

    if (!fs.existsSync(filepath)) {
      continue
    }

    for (const line of fs.readFileSync(filepath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)

      if (!match || match[1] in process.env) {
        continue
      }

      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "")
    }
  }
}

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

async function fetchPublishableKey(backendUrl) {
  const timeout = Number(process.env.STOREFRONT_BOOTSTRAP_TIMEOUT_MS || 180000)
  const deadline = Date.now() + timeout
  const endpoint = `${backendUrl.replace(/\/$/, "")}/key-exchange`
  let lastError

  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        throw new Error(`Backend returned HTTP ${response.status}`)
      }

      const data = await response.json()

      if (typeof data.publishableApiKey !== "string" || !data.publishableApiKey) {
        throw new Error("The backend did not return the Webshop publishable key")
      }

      return data.publishableApiKey
    } catch (error) {
      lastError = error
      await delay(5000)
    }
  }

  throw new Error(
    `Could not retrieve the Medusa publishable key from ${endpoint}: ${
      lastError instanceof Error ? lastError.message : "unknown error"
    }`
  )
}

async function main() {
  loadLocalEnvironment()

  const childEnvironment = { ...process.env }

  if (!childEnvironment.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY) {
    const backendUrl =
      childEnvironment.MEDUSA_BACKEND_URL ||
      childEnvironment.NEXT_PUBLIC_MEDUSA_BACKEND_URL

    if (!backendUrl) {
      throw new Error(
        "Set MEDUSA_BACKEND_URL or NEXT_PUBLIC_MEDUSA_BACKEND_URL so the storefront can retrieve its publishable key"
      )
    }

    console.log("Retrieving the Medusa publishable key from the configured backend...")
    childEnvironment.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY =
      await fetchPublishableKey(backendUrl)
    console.log("Medusa publishable key retrieved successfully.")
  }

  const nextBinary = require.resolve("next/dist/bin/next")
  const child = spawn(process.execPath, [nextBinary, command, ...commandArgs], {
    env: childEnvironment,
    stdio: "inherit",
  })

  child.on("error", (error) => {
    console.error(error)
    process.exit(1)
  })

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 1)
  })
}

main().catch((error) => {
  console.error(`Storefront bootstrap failed: ${error.message}`)
  process.exit(1)
})
