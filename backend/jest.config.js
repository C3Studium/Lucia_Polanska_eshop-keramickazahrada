/**
 * Minimal jest setup for unit specs (`*.unit.spec.ts`).
 *
 * The repo already had jest, @swc/jest and @medusajs/test-utils in
 * devDependencies and two unit specs on disk, but no config and no script —
 * so nothing ever ran them. This is the smallest config that does, following
 * Medusa's Testing Tools guide.
 *
 * Note that `tsconfig.json` excludes `**\/__tests__`, so specs are compiled by
 * swc here and are not part of `pnpm typecheck`. That is the pre-existing
 * convention and is left alone.
 *
 * Integration tests (medusa-test-runner, real database) arrive with P11-4.
 */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.[jt]sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true, decorators: true },
          transform: { react: { runtime: "automatic" } },
        },
        module: { type: "commonjs" },
      },
    ],
  },
  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json"],
  testMatch: ["**/__tests__/**/*.unit.spec.[jt]s?(x)"],
  modulePathIgnorePatterns: ["<rootDir>/.medusa/", "<rootDir>/dist/"],
}
