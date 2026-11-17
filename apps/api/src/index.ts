import { createApp } from './app.js';
import { createPool } from './db.js';
const pool = await createPool();
const server = createApp(pool).listen(Number(process.env.PORT || 3001), () => console.log(`API listening on http://localhost:${process.env.PORT || 3001}`));
process.on('SIGTERM', () => {server.close(() => {void pool.end();});});
