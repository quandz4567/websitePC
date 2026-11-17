import {createPool, migrate} from './db.js';
const pool = await createPool();
try { await migrate(pool); console.log('Migration complete'); } finally { await pool.end(); }
