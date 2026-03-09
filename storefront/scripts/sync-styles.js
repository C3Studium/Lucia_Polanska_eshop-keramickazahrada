#!/usr/bin/env node
/**
 * Syncs all non-system style files into globals and injects shortcuts into each.
 *
 * - Prepends @use "pathToFile/system/_shortcuts.scss" as *to each discovered style file (once).
 * - Regenerates an auto-import block in src/styles/globals.scss with numeric aliases.
 */
const fs = require("fs");
const path = require("path");
const glob = require("glob");

const root = process.cwd();
const stylesRoot = path.join(root, "src", "styles");
const systemDir = path.join(stylesRoot, "system");
const globalsFile = path.join(stylesRoot, "globals.scss");
const autoStart = "// AUTO-IMPORT START";
const autoEnd = "// AUTO-IMPORT END";

const files = glob.sync("src/**/*.@(scss|css)", {
  cwd: root,
  absolute: true,
  nodir: true,
  ignore: [
    "src/styles/system/**/*",
    "src/styles/globals.scss",
    "**/node_modules/**",
    "**/.next/**",
  ],
});

const toPosix = (p) => p.replace(/\\/g, "/");

const shortcutPathFor = (file) => {
  const rel = toPosix(
    path.relative(path.dirname(file), path.join(systemDir, "_shortcuts.scss"))
  );
  // ensure a relative import starts with ./ or ../
  const normalized = rel.startsWith(".") ? rel : `./${rel}`;
  return `@use "${normalized}" as *;`;
};

async function ensureShortcuts(file) {
  const content = await fs.promises.readFile(file, "utf8");
  const importLine = shortcutPathFor(file);
  if (content.includes(importLine)) return;
  await fs.promises.writeFile(file, `${importLine}\n${content}`, "utf8");
}

async function regenerateGlobals(list) {
  let globals = "";
  try {
    globals = await fs.promises.readFile(globalsFile, "utf8");
  } catch {
    // file may not exist yet; start fresh
    globals = "";
  }

  // strip previous auto block
  const autoRegex = new RegExp(`${autoStart}[\\s\\S]*?${autoEnd}\\s*`, "m");
  globals = globals.replace(autoRegex, "").trimStart();

  const lines = list.map((file, idx) => {
    const rel = toPosix(path.relative(stylesRoot, file));
    return `@use "${rel}" as _s${idx};`;
  });

  const block = [
    autoStart,
    ...lines,
    autoEnd,
    "",
  ].join("\n");

  const output = `${block}${globals ? `\n${globals}` : ""}`;
  if (output !== (await fs.promises.readFile(globalsFile, "utf8").catch(() => ""))) {
    await fs.promises.writeFile(globalsFile, output, "utf8");
  }
}

async function main() {
  for (const f of files) {
    if (toPosix(f).includes("/styles/system/")) continue;
    await ensureShortcuts(f);
  }
  await regenerateGlobals(files);
  console.log(`Synced ${files.length} style files.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
