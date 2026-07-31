#!/usr/bin/env node
/**
 * Keeps the zero-maintenance Sass workflow deterministic.
 *
 * Development runs this once before Next.js and then watches structural style
 * changes (add/remove/rename). Production runs the same one-shot sync before a
 * build, so generated imports are never environment-dependent.
 *
 * - Every SCSS file receives the concise responsive shortcut API.
 * - Relative shortcut paths are repaired when a file moves or is renamed.
 * - A sorted, generated manifest imports every global non-system style once.
 * - CSS Modules stay component-local and are never re-emitted globally.
 * - globals.scss keeps only a stable entrypoint instead of a large volatile list.
 */
const crypto = require("crypto")
const fs = require("fs")
const path = require("path")
const glob = require("glob")

const root = path.resolve(__dirname, "..")
const stylesRoot = path.join(root, "src", "styles")
const systemDir = path.join(stylesRoot, "system")
const globalsFile = path.join(stylesRoot, "globals.scss")
const generatedFile = path.join(stylesRoot, "_generated-styles.scss")

const legacyAutoStart = "// AUTO-IMPORT START"
const legacyAutoEnd = "// AUTO-IMPORT END"
const entryStart = "// STYLE-SYSTEM ENTRY START"
const entryEnd = "// STYLE-SYSTEM ENTRY END"

const toPosix = (value) => value.replace(/\\/g, "/")
const comparePaths = (left, right) => {
  const a = toPosix(path.relative(root, left))
  const b = toPosix(path.relative(root, right))
  return a < b ? -1 : a > b ? 1 : 0
}

const watchedEventIndex = process.argv.indexOf("--event")
const watchedEvent =
  watchedEventIndex === -1 ? null : process.argv[watchedEventIndex + 1]
const watchedPathIndex = process.argv.indexOf("--path")
const watchedPath =
  watchedPathIndex === -1 ? null : process.argv[watchedPathIndex + 1]
const structuralEvents = new Set(["add", "unlink", "addDir", "unlinkDir"])

const discoverStyles = () =>
  glob
    .sync("src/**/*.@(scss|css)", {
      cwd: root,
      absolute: true,
      nodir: true,
      ignore: [
        "src/styles/system/**/*",
        "src/styles/globals.scss",
        "src/styles/_generated-styles.scss",
        "**/node_modules/**",
        "**/.next/**",
      ],
    })
    .sort(comparePaths)

const isCssModule = (file) => /\.module\.(s?css)$/i.test(file)

const shortcutPathFor = (file) => {
  const relativePath = toPosix(
    path.relative(path.dirname(file), path.join(systemDir, "_shortcuts.scss"))
  )
  const normalized = relativePath.startsWith(".")
    ? relativePath
    : `./${relativePath}`

  return `@use "${normalized}" as *;`
}

const manifestPathFor = (file) => {
  const relativePath = toPosix(path.relative(stylesRoot, file))
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`
}

const stableAliasFor = (file) => {
  const relativePath = toPosix(path.relative(root, file))
  const hash = crypto
    .createHash("sha1")
    .update(relativePath)
    .digest("hex")
    .slice(0, 12)
  return `_style_${hash}`
}

async function writeIfChanged(file, output) {
  const current = await fs.promises.readFile(file, "utf8").catch(() => "")

  if (current === output) return false

  const temporaryFile = `${file}.${process.pid}.tmp`
  await fs.promises.writeFile(temporaryFile, output, "utf8")
  await fs.promises.rename(temporaryFile, file)
  return true
}

async function ensureShortcuts(file) {
  if (path.extname(file) !== ".scss") return false

  const content = await fs.promises.readFile(file, "utf8")
  const importLine = shortcutPathFor(file)
  const shortcutImport =
    /^@use\s+["'][^"'\n]*_shortcuts\.scss["']\s+as\s+\*;\r?\n?/gm
  const withoutOldShortcut = content.replace(shortcutImport, "")
  const output = `${importLine}\n${withoutOldShortcut}`

  return writeIfChanged(file, output)
}

async function regenerateManifest(list) {
  const imports = list.map((file) => {
    return `@use "${manifestPathFor(file)}" as ${stableAliasFor(file)};`
  })
  const output = [
    "// GENERATED FILE — DO NOT EDIT.",
    "// Updated by scripts/sync-styles.js after style files are added, removed, or renamed.",
    ...imports,
    "",
  ].join("\n")

  return writeIfChanged(generatedFile, output)
}

async function ensureGlobalsEntry() {
  let globals = await fs.promises.readFile(globalsFile, "utf8").catch(() => "")
  const legacyBlock = new RegExp(
    `${legacyAutoStart}[\\s\\S]*?${legacyAutoEnd}\\s*`,
    "m"
  )
  const managedEntry = new RegExp(`${entryStart}[\\s\\S]*?${entryEnd}\\s*`, "m")

  globals = globals.replace(legacyBlock, "").replace(managedEntry, "")

  // Clean up an unmarked entry from an interrupted migration before prepending it.
  globals = globals
    .split(/\r?\n/)
    .filter(
      (line) =>
        ![
          '@use "./system/layers";',
          '@use "./system/helpers";',
          '@use "./generated-styles";',
        ].includes(line.trim())
    )
    .join("\n")
    .trimStart()

  const entry = [
    entryStart,
    "// Global CSS emitters live here once; the shortcut API remains side-effect-free.",
    '@use "./system/layers";',
    '@use "./system/helpers";',
    '@use "./generated-styles";',
    entryEnd,
    "",
  ].join("\n")

  return writeIfChanged(globalsFile, `${entry}${globals}`)
}

async function main() {
  // Next/Sass already handles content edits. The development watcher only
  // regenerates imports when the file graph itself changes.
  if (watchedEvent && !structuralEvents.has(watchedEvent)) return
  if (watchedPath && !/\.(s?css)$/i.test(watchedPath)) return

  const files = discoverStyles()
  // CSS Modules are imported by their owning React components. Adding them to
  // the global Sass manifest removes Next.js' hashed isolation and lets generic
  // module names (for example `productChapter`) override live page components.
  const globalStyles = files.filter((file) => !isCssModule(file))
  const shortcutChanges = (
    await Promise.all(files.map((file) => ensureShortcuts(file)))
  ).filter(Boolean).length
  const manifestChanged = await regenerateManifest(globalStyles)
  const globalsChanged = await ensureGlobalsEntry()

  console.log(
    [
      `Synced ${files.length} style files (${globalStyles.length} global emitters)`,
      `${shortcutChanges} shortcut path${
        shortcutChanges === 1 ? "" : "s"
      } updated`,
      manifestChanged ? "manifest updated" : "manifest current",
      globalsChanged ? "global entry updated" : "global entry current",
    ].join(" · ")
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
