/**
 * Compile every stylesheet in the project against the modified design system.
 *
 * The system files changed under ~200 component stylesheets (new `qhd` stop, a new constraint
 * feature in the h() mixin, reworked typography mixins). A screenshot run only exercises the
 * pages it visits; this exercises every file that exists.
 *
 *   node .rdshots/compile-all.cjs
 */
const fs = require("fs")
const path = require("path")
const sass = require("sass")

const ROOT = path.join(__dirname, "..")
const SRC = path.join(ROOT, "src")

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue
      walk(p, out)
    } else if (entry.name.endsWith(".scss") && !entry.name.startsWith("_")) {
      out.push(p)
    }
  }
  return out
}

const files = walk(SRC)
let failures = 0
let deprecations = 0
const deprecationFiles = new Set()

for (const file of files) {
  try {
    const res = sass.compile(file, {
      loadPaths: [ROOT, SRC],
      quietDeps: true,
      logger: {
        warn(message, options) {
          if (options && options.deprecation) {
            deprecations += 1
            deprecationFiles.add(path.relative(ROOT, file))
          }
        },
      },
    })
    void res
  } catch (e) {
    failures += 1
    console.log(`FAIL  ${path.relative(ROOT, file)}`)
    console.log(`      ${String(e.message).split("\n")[0].slice(0, 160)}`)
  }
}

console.log(`\n${files.length - failures}/${files.length} stylesheets compiled`)
console.log(`deprecation warnings: ${deprecations} across ${deprecationFiles.size} files`)
if (deprecationFiles.size) {
  console.log("  " + [...deprecationFiles].slice(0, 12).join("\n  "))
}
process.exit(failures ? 1 : 0)
