/* Roll the per-capture findings up by element, so a problem that appears on every page is
   counted once as one problem rather than read as 126 separate ones. */
const r = require("./out/baseline-report.json")

const tap = {}
const tiny = {}

for (const c of r) {
  for (const t of c.smallTargets || []) {
    const k = `${(t.cls || "(no class)").split(" ")[0]}  ${t.w}x${t.h}`
    tap[k] = (tap[k] || 0) + 1
  }
  for (const t of c.tiny || []) {
    const k = `${t.px}px  ${t.tag}.${t.cls || "(no class)"}`
    tiny[k] = (tiny[k] || 0) + 1
  }
}

function show(o, title) {
  console.log("\n" + title)
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([k, n]) => console.log(String(n).padStart(4) + "  " + k))
}

show(tap, "SMALL TAP TARGETS — occurrences across 126 captures")
show(tiny, "TINY TEXT — occurrences across 126 captures")
console.log("")
