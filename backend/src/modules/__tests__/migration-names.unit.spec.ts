import fs from "fs"
import path from "path"

/**
 * No two module migrations may share a class name.
 *
 * MikroORM records executed migrations **by class name** in one shared
 * `mikro_orm_migrations` table per database. Two modules shipped
 * `Migration20260805090000` — product-review's and newsletter's — and
 * whichever ran second was silently skipped: no error, no table, and the
 * first request against the missing table was the only symptom. That
 * happened on the freshly migrated integration database, which means it
 * happened on every database, production included.
 *
 * Timestamps make collisions unlikely, not impossible — two migrations
 * written in the same minute of the same working session collide exactly
 * like these did. So the invariant is enforced here, where it fails a build
 * instead of a customer.
 */
describe("module migration names", () => {
  it("are unique across all modules", () => {
    const modulesDir = path.join(__dirname, "..")
    const seen = new Map<string, string>()
    const collisions: string[] = []

    for (const moduleName of fs.readdirSync(modulesDir)) {
      const migrationsDir = path.join(modulesDir, moduleName, "migrations")
      if (!fs.existsSync(migrationsDir)) continue

      for (const file of fs.readdirSync(migrationsDir)) {
        if (!file.endsWith(".ts")) continue
        const source = fs.readFileSync(
          path.join(migrationsDir, file),
          "utf-8"
        )
        for (const match of source.matchAll(
          /export class (Migration\w+)/g
        )) {
          const className = match[1]
          const where = `${moduleName}/${file}`
          const previous = seen.get(className)
          if (previous) {
            collisions.push(`${className}: ${previous} vs ${where}`)
          } else {
            seen.set(className, where)
          }
        }
      }
    }

    expect(collisions).toEqual([])
    // Sanity: the scan actually found migrations — an empty map would mean
    // the directory layout changed and this test went blind.
    expect(seen.size).toBeGreaterThan(5)
  })
})
