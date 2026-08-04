import fs from "fs"
import path from "path"

/**
 * Every workflow must survive being imported.
 *
 * `createWorkflow` runs its composer function **once, at module load**, to
 * build the graph. Anything illegal in there — most commonly putting a
 * `WorkflowData` placeholder inside a template literal instead of a
 * `transform` — throws while the file is being imported, which takes the whole
 * server down at boot.
 *
 * Neither `tsc` nor `medusa build` can see that: they compile the file without
 * ever importing it, and `WorkflowData<string>` is *typed* as `string`, so an
 * interpolation type-checks perfectly. That hole let a boot-crash through the
 * gate and into a deploy (`send-order-confirmation`, „object is not a
 * function"). This spec closes it: importing the module is the test.
 *
 * It deliberately has no assertions about behaviour. If the import throws, the
 * test fails, and that is the entire point.
 */

// Some workflows reach `lib/constants`, which asserts these at import time.
// Values are irrelevant — nothing here connects to anything.
process.env.DATABASE_URL ||= "postgres://test:test@localhost:5432/test"
process.env.JWT_SECRET ||= "test"
process.env.COOKIE_SECRET ||= "test"

const workflowsDir = path.join(__dirname, "..")

const collectWorkflowFiles = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // `steps/` is composed by the workflows that use it, and __tests__ is
        // this file's own home.
        return entry.name === "__tests__" ? [] : collectWorkflowFiles(full)
      }

      return entry.isFile() && entry.name.endsWith(".ts") ? [full] : []
    })

const files = collectWorkflowFiles(workflowsDir)

describe("workflow composition", () => {
  it("finds workflow files to check", () => {
    // Guards against the walk silently matching nothing and the suite passing
    // for the wrong reason.
    expect(files.length).toBeGreaterThan(10)
  })

  it.each(files.map((file) => [path.relative(workflowsDir, file), file]))(
    "composes %s",
    (_name, file) => {
      expect(() => require(file)).not.toThrow()
    }
  )
})
