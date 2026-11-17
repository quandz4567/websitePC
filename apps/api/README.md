# PC Store API

Express + TypeScript, Node 18+, PostgreSQL. Run commands from repository root:

```sh
npm run db:migrate
npm run db:seed
npm run dev:api
```

`DATABASE_URL` defaults to `postgresql://postgres:postgres@localhost:5432/pc_store`.
Scripts load `.env` from the working directory; npm workspace commands execute inside
`apps/api`, so export environment variables in your shell or use the root startup
instructions. Port defaults to 3001 and CORS origin to http://localhost:5173.
Migration can be rerun safely. Seed inserts missing products and preserves existing
stock and orders. To run concurrency tests, use a disposable freshly seeded database.

Set `DEMO_DB=memory` explicitly to start a disposable pg-mem demo. Startup automatically
migrates and seeds that in-process database. All data disappears on restart. Migration
and seed commands in this mode affect only their own short-lived processes.
The demo serializes order connections and restores snapshots on errors because
pg-mem does not implement PostgreSQL transaction isolation and rollback semantics.
It does **not** verify real PostgreSQL locks or production concurrency behavior.
Production and PostgreSQL concurrency checks must use a real PostgreSQL server.
The demo disables pg-mem AST coverage checks to permit repeated no-op CREATE TABLE
statements; verify schema behavior against PostgreSQL before production use.

Prices are integer VND. Orders trust database prices only and use COD. Real PostgreSQL
orders lock product rows in stable ID order, validate stock, conditionally decrement,
and persist order records inside one transaction.

Backend regression checks (from repository root, after building):

```sh
npm run build -w apps/api
node --test apps/api/tests/backend.test.mjs
```

These checks cover invalid input, client price forgery, failed basket rollback,
repeat-safe seeding, deterministic lock order and discarding connections after a
failed rollback. They use pg-mem and mocked connections, not real PostgreSQL locks.
