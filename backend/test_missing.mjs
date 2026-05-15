import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'elruc_db', password: '0021071980gC', port: 5432, max: 5, idleTimeoutMillis: 5000 });
const externalPool = new Pool({ user: 'postgres', host: 'localhost', database: 'motora_tpv', password: '0021071980gC', port: 5432, max: 5, idleTimeoutMillis: 5000 });
try {
  const result = await Promise.all([
    externalPool.query(`
      SELECT COUNT(*)::bigint as total FROM set_contribuyentes c
      WHERE NOT EXISTS (SELECT 1 FROM contribuyentes WHERE ruc = c.ruc)
    `),
    pool.query('SELECT ruc FROM contribuyentes ORDER BY ruc'),
    externalPool.query(`
      SELECT c.ruc, c.dv, c.razon_social
      FROM set_contribuyentes c
      WHERE NOT EXISTS (SELECT 1 FROM contribuyentes WHERE ruc = c.ruc)
      ORDER BY c.ruc ASC
      LIMIT 50 OFFSET 0
    `),
  ]);
  console.log('Count result:', result[0].rows[0]);
  console.log('Local RUCs count:', result[1].rows.length);
  console.log('Missing sample:', result[2].rows.length, 'rows');
} catch(e) {
  console.error('Error:', e.message);
}
await pool.end();
await externalPool.end();
