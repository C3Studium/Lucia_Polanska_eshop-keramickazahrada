#!/usr/bin/env node

/*
 * Otisk sestavení.
 *
 * Jedna krátká hodnota, která se změní vždy, když vyjde nová verze obchodu.
 * Zapéká se do klientského balíku jako `NEXT_PUBLIC_BUILD_STAMP` a prohlížeč
 * podle ní pozná, že to, co má uložené, patří k předchozí verzi.
 *
 * Proč je v tom i časové razítko a nejen hash commitu: nasazení se neváže
 * jen na commit. Railway přestaví obraz i při pouhé změně proměnných a nová
 * verze backendu se může objevit pod stejným commitem storefrontu. Otisk,
 * který by se v takovém případě nezměnil, by tichounce nechal návštěvníkovi
 * starý stav — což je přesně ta chyba, kvůli které tohle vzniklo. Hash je
 * v otisku kvůli lidem: v logu nasazení je hned vidět, co je vlastně živé.
 *
 * `NEXT_PUBLIC_BUILD_STAMP` v prostředí má přednost — kdo chce reprodukovatelný
 * build, dosadí si vlastní hodnotu a tohle se nespustí.
 */

const { execFileSync } = require("child_process")

const zaklad36 = () => Date.now().toString(36)

const commitHash = () => {
  try {
    return execFileSync("git", ["rev-parse", "--short=8", "HEAD"], {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim()
  } catch {
    // Docker build bez .git, nebo git není v obrazu. Není to chyba.
    return null
  }
}

/**
 * @param {"dev"|"build"|"start"} command
 * @returns {string}
 */
function resolveBuildStamp(command) {
  const explicit = process.env.NEXT_PUBLIC_BUILD_STAMP

  if (explicit && explicit.trim()) {
    return explicit.trim().slice(0, 40)
  }

  // Vývoj: každý start `pnpm dev` je nová verze. Restart serveru tak sám
  // uklidí, co po sobě nechala ta předchozí.
  if (command === "dev") {
    return `dev-${zaklad36()}`
  }

  const sha =
    (process.env.RAILWAY_GIT_COMMIT_SHA || "").slice(0, 8) ||
    commitHash() ||
    "nogit"

  return `${sha}-${zaklad36()}`
}

module.exports = { resolveBuildStamp }

// Spuštěné přímo vypíše otisk — na ladění a pro skripty nasazení.
if (require.main === module) {
  process.stdout.write(resolveBuildStamp(process.argv[2] || "build") + "\n")
}
