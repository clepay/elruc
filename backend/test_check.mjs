import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'elruc_db', password: '0021071980gC', port: 5432, max: 5 });
const r1 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'contribuyentes' ORDER BY ordinal_position");
console.log('contribuyentes:', r1.rows.map(c => c.column_name).join(', '));
await pool.end();
