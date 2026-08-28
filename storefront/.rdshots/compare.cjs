/* Baseline vs final, rolled up by element, so a chrome problem that was always there is not
   confused with something this pass introduced. */
const base = require("./out/baseline-report.json")
const fin = require("./out/final-report.json")

function roll(r) {
  const tap = {}, tiny = {}
  for (const c of r) {
    for (const t of c.smallTargets || []) {
      const k = `${(t.cls || "(none)").split(" ")[0]}  ${t.w}x${t.h}`
      tap[k] = (tap[k] || 0) + 1
    }
    for (const t of c.tiny || []) {
      const k = `${t.px}px  ${t.tag}.${t.cls || "(none)"}`
      tiny[k] = (tiny[k] || 0) + 1
    }
  }
  return { tap, tiny }
}

const b = roll(base), f = roll(fin)

function diff(title, bm, fm) {
  console.log("\n" + title)
  const keys = new Set([...Object.keys(bm), ...Object.keys(fm)])
  const rows = [...keys].map((k) => ({ k, before: bm[k] || 0, after: fm[k] || 0 }))
  rows.sort((a, z) => (z.after - z.before) - (a.after - a.before) || z.after - a.after)
  for (const r of rows) {
    const mark = r.after === 0 ? "RESOLVED" : r.before === 0 ? "NEW     " : "        "
    console.log(`  ${mark}  ${String(r.before).padStart(4)} -> ${String(r.after).padStart(4)}   ${r.k}`)
  }
}

diff("SMALL TAP TARGETS (occurrences, 126 captures each)", b.tap, f.tap)
diff("TINY TEXT", b.tiny, f.tiny)

const bo = base.filter((c) => c.overflow).length
const fo = fin.filter((c) => c.overflow).length
console.log(`\nOVERFLOW: ${bo} -> ${fo}`)
console.log(`STOP MISMATCHES: ${base.filter(c=>c.stopOk===false).length} -> ${fin.filter(c=>c.stopOk===false).length}`)
