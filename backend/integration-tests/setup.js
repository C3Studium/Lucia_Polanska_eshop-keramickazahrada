/**
 * Loads `.env.test` before the runner reads DB_* out of the environment.
 *
 * Kept out of `.env` so that running the app locally can never accidentally
 * point at the test database, and vice versa.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.test") })
