# Integration tests

```bash
pnpm test:integration
```

Boots the real application against a real Postgres, runs every migration into a
fresh database, exercises the HTTP surface, then drops it.

## Setup

Create `backend/.env.test` (gitignored — **never commit it**):

```
DB_HOST=<host>
DB_PORT=<port>
DB_USERNAME=<user>
DB_PASSWORD=<password>

# Comgate's provider refuses to load without these. Fake values are correct
# here: nothing in these tests talks to Comgate.
COMGATE_MERCHANT=test-merchant
COMGATE_SECRET=test-secret
COMGATE_TEST=true

# Empty on purpose. `.env` points this at Railway's internal host, which does
# not resolve from a developer machine, and dotenv will not override a variable
# that is already set. Empty is falsy, so Medusa uses its in-memory event bus
# and cache — which is what these tests want anyway.
REDIS_URL=
```

The account needs `CREATEDB`.

## What it does to your database

**Nothing.** `@medusajs/test-utils` ignores `DATABASE_URL` entirely. It builds
its own connection from the four `DB_*` variables above and then creates a
database it names itself — `medusa-<ulid>-integration-<worker>` — migrates into
that, and drops it at the end. The database in the connection string those
credentials came from is never opened.

That is worth knowing before pointing this at anything you care about, and it is
why the credentials live in their own file rather than in `.env`: running the
app and running the tests can never be pointed at each other by accident.

## Why it is one file

Every `medusaIntegrationTestRunner` call is a full boot — create database,
migrate, start app, drop database. Four spec files meant four of those, and
against a remote Postgres the later ones died partway through migrating with
`Client has encountered a connection error and is not queryable`. The routes
were fine; the churn was not. One boot, shared by every test, runs in a quarter
of the time and stops failing for reasons unrelated to the code.

## What it catches that nothing else does

- **A migration that cannot apply.** They run for real here, so a bad one fails
  in this suite rather than on deploy.
- **A route that is not mounted**, or one whose handler throws.
- **A `query.graph` projection naming a field the entity does not have.** This
  is the failure this project keeps meeting: invisible to `tsc`, to
  `medusa build`, and to any unit spec with a mocked container, and visible only
  when something makes a request.
- **An admin route that is not actually protected.** Every one is asserted to
  refuse an anonymous caller, because that is a middleware registration a person
  can forget and nothing else would notice.

## A note on skips

The admin cases once "passed" 34 times without asserting anything, because the
helper that creates an admin returned `null` and every case skipped itself. A
skip that reports as a pass is worse than a failure. There is now a test whose
only job is to assert the session exists — if admin auth breaks, the suite goes
red instead of quietly green.
