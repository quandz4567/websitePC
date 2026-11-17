import 'dotenv/config';
import pg from 'pg';
import { newDb } from 'pg-mem';
import { readFile } from 'node:fs/promises';
import { products } from './data.js';
export async function migrate(pool: pg.Pool) {
  await pool.query(await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8'));
}
export async function seed(pool: pg.Pool) {
  for (const p of products) {
    await pool.query('INSERT INTO products (id,name,category,brand,price,stock,description,specs,image) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING', [...p.slice(0,7), JSON.stringify(p[7]), '']);
  }
}
export async function createPool() : Promise<pg.Pool> {
  if (process.env.DEMO_DB === 'memory') {
    // pg-mem otherwise rejects constraints in repeated CREATE TABLE IF NOT EXISTS
    // statements even though those statements correctly do nothing.
    const db = newDb({noAstCoverageCheck:true});
    const adapter = db.adapters.createPg();
    const pool = new adapter.Pool() as unknown as pg.Pool;
    await migrate(pool); await seed(pool);
    // pg-mem does not implement transaction isolation/rollback. Serialize demo
    // order connections and restore a snapshot on failure; this is demo-only.
    const connect = pool.connect.bind(pool);
    let tail = Promise.resolve();
    pool.connect = (async () => {
      const previous = tail;
      let unlock!: () => void;
      tail = new Promise<void>(resolve => {unlock = resolve;});
      await previous;
      const client = await connect();
      const query = client.query.bind(client);
      const release = client.release.bind(client);
      let backup: ReturnType<typeof db.backup> | undefined;
      client.query = (async (sql: string, values?: unknown[]) => {
        if (sql === 'BEGIN') {backup = db.backup(); return {rows:[],rowCount:0};}
        if (sql === 'ROLLBACK') {backup?.restore(); return {rows:[],rowCount:0};}
        if (sql === 'COMMIT') {backup = undefined; return {rows:[],rowCount:0};}
        return query(sql, values);
      }) as typeof client.query;
      client.release = () => {client.query = query; client.release = release; release(); unlock();};
      return client;
    }) as typeof pool.connect;
    console.warn('DEMO_DB=memory: ephemeral data; PostgreSQL transactions/row locking are not validated.');
    return pool;
  }
  return new pg.Pool({connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pc_store'});
}
