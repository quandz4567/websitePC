import {createPool, seed} from './db.js';
const pool = await createPool();
try { await seed(pool); console.log('Seed complete (existing products preserved)'); } finally { await pool.end(); }
