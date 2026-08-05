import { Client } from "pg"

async function getDatabaseClient() {
  // Synchronous by design — see below. This function drops a database a few
  // lines later, so the check must be able to stop it.
  testEnvChecks()
  const env = getEnv()
  const client = new Client(env.superuser)
  await client.connect()
  return client
}

function getEnv() {
  return {
    host: process.env.TEST_POSTGRES_HOST || "localhost",
    // Was reading TEST_POSTGRES_HOST here, so a configured host produced
    // Number("localhost") === NaN as the port. The variable in .env.example is
    // misspelled TEST_POSTGREST_PORT; both spellings are accepted rather than
    // silently ignoring whichever one somebody used.
    port: Number(
      process.env.TEST_POSTGRES_PORT || process.env.TEST_POSTGREST_PORT || 5432
    ),
    user: process.env.TEST_POSTGRES_USER || "test_medusa_user",
    testDatabase: process.env.TEST_POSTGRES_DATABASE || "test_medusa_db",
    testDatabaseTemplate:
      process.env.TEST_POSTGRES_DATABASE_TEMPLATE || "test_medusa_db_template",
    productionDatabase: process.env.PRODUCTION_POSTGRES_DATABASE || "medusa_db",
    superuser: {
      host: process.env.PGHOST || "localhost",
      port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "password",
      database: process.env.PGDATABASE || "postgres",
    },
  }
}

/**
 * The only thing standing between `pnpm test-e2e` and a dropped database.
 *
 * This was `async` and called without `await`. A rejected promise is not a
 * thrown error: both checks below would "fail" into an unhandled rejection
 * while execution carried on to `createTestDatabase`, which issues
 * `DROP DATABASE`. The guard ran, printed, and stopped nothing.
 *
 * Kept synchronous — it awaits nothing — so it cannot be reintroduced by
 * dropping an `await`.
 */
function testEnvChecks() {
  const env = getEnv()
  if (!env.testDatabase.startsWith("test_")) {
    const msg =
      "Please make sure your test environment database name starts with test_"
    console.error(msg)
    throw new Error(msg)
  }
  if (env.testDatabase === env.productionDatabase) {
    const msg =
      "Please make sure your test environment database and production environment database names are not equal"
    console.error(msg)
    throw new Error(msg)
  }
}

async function createTemplateDatabase(client: Client) {
  const { user, testDatabase, testDatabaseTemplate } = getEnv()
  try {
    // close current connections
    await client.query(`
      ALTER DATABASE ${testDatabase} WITH ALLOW_CONNECTIONS false;
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname='${testDatabase}';
    `)
    await client.query(`
      CREATE DATABASE ${testDatabaseTemplate} WITH
        OWNER=${user}
        TEMPLATE=${testDatabase}
        IS_TEMPLATE=true;
    `)
  } catch (e: any) {
    // duplicate database code
    if (e.code === "42P04") {
      return
    }
    throw e
  }
}

async function createTestDatabase(client: Client) {
  const { user, testDatabase, testDatabaseTemplate } = getEnv()
  const deleteDatabase = `${testDatabase}_del`
  // drop connections and alter database name
  await client.query(`
    SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname='${testDatabase}';
    ALTER DATABASE ${testDatabase}
      RENAME TO ${deleteDatabase};
  `)
  await client.query(`
    CREATE DATABASE ${testDatabase}
      WITH OWNER ${user}
      TEMPLATE=${testDatabaseTemplate};
  `)
  await client.query(`DROP DATABASE ${deleteDatabase}`)
}

export async function resetDatabase() {
  const client = await getDatabaseClient()
  await createTemplateDatabase(client)
  await createTestDatabase(client)
  await client.end()
}

export async function dropTemplate() {
  const client = await getDatabaseClient()
  const env = getEnv()
  await client.query(
    `ALTER DATABASE ${env.testDatabaseTemplate} is_template false`
  )
  await client.query(`DROP DATABASE ${env.testDatabaseTemplate}`)
  await client.end()
}
