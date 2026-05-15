import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'motora_tpv', password: '0021071980gC', port: 5432, max: 5, idleTimeoutMillis: 5000 });
try {
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'set_contribuyentes' ORDER BY ordinal_position");
  console.log('Columns:', res.rows.map(r => r.column_name + ' (' + r.data_type + ')').join('\n'));
} catch(e) { console.error('Error:', e.message); }
await pool.end();
