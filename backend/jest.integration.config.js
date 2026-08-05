/**
 * Integration tests — a real Medusa app against a real Postgres.
 *
 * Separate from `jest.config.js` because the two are nothing alike: unit specs
 * are milliseconds and pure, these boot the whole application and take minutes.
 * Mixing them means the fast feedback loop inherits the slow one's cost.
 *
 * ## The database
 *
 * `@medusajs/test-utils` deliberately ignores `DATABASE_URL`. It reads
 * DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD from `.env.test` (gitignored) and
 * then CREATEs a database it names itself — `medusa-<module>-integration-<n>`
 * — runs every migration into it, and DROPs it afterwards. Whatever database
 * is named in the URL you copied those credentials from is never touched.
 *
 * That is also what makes these tests worth having: the migrations run for
 * real, so a migration that cannot apply fails here rather than on deploy.
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
  // `medusa-config.js` imports `lib/constants` as a bare specifier, which
  // resolves through tsconfig's `paths: { "*": ["./src/*"] }`. Jest does not
  // read tsconfig, so it needs the same rule spelled out or the config file
  // cannot even be loaded.
  moduleDirectories: ["node_modules", "<rootDir>/src"],
  testMatch: ["**/integration-tests/**/*.spec.[jt]s"],
  modulePathIgnorePatterns: ["<rootDir>/.medusa/", "<rootDir>/dist/"],
  setupFiles: ["<rootDir>/integration-tests/setup.js"],
  // Booting the app and migrating is slow, and a timeout here reads as a
  // product bug when it is only impatience.
  testTimeout: 600000,
  maxWorkers: 1,
}
