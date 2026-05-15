import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'motora_tpv',
  password: '0021071980gC',
  port: 5432,
  max: 5,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 5000,
});
try {
  const client = await pool.connect();
  console.log('Connected to motora_tpv');
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('Tables:', res.rows.map(r => r.table_name).join(', '));
  try {
    const cnt = await client.query('SELECT COUNT(*) as cnt FROM set_contribuyentes');
    console.log('set_contribuyentes count:', cnt.rows[0].cnt);
  } catch(e) {
    console.log('set_contribuyentes error:', e.message);
  }
  client.release();
  await pool.end();
} catch(e) {
  console.error('Error connecting to motora_tpv:', e.message);
}
