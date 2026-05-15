import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'elruc_db', password: '0021071980gC', port: 5432, max: 5, idleTimeoutMillis: 5000 });
const externalPool = new Pool({ user: 'postgres', host: 'localhost', database: 'motora_tpv', password: '0021071980gC', port: 5432, max: 5, idleTimeoutMillis: 5000 });
try {
  // Test /compare/missing logic (has bug - references contribuyentes from externalPool)
  console.log('--- Testing missing (will fail) ---');
  try {
    const res = await externalPool.query(`
      SELECT COUNT(*)::bigint as total FROM set_contribuyentes c
      WHERE NOT EXISTS (SELECT 1 FROM contribuyentes WHERE ruc = c.ruc)
    `);
    console.log('Missing count:', res.rows[0].total);
  } catch(e) { console.error('Missing count error:', e.message); }

  // Test /compare/diff logic
  console.log('\n--- Testing diff ---');
  const extRows = await externalPool.query(
    `SELECT ruc, dv, razon_social, estado FROM set_contribuyentes WHERE ruc IS NOT NULL AND TRIM(ruc) != '\'''\'' ORDER BY ruc LIMIT 10 OFFSET 0`
  );
  console.log('Ext rows sample:', extRows.rows.length);
  
  const rucs = extRows.rows.map(r => r.ruc);
  const localRows = await pool.query(
    `SELECT ruc, dv, razon_social, estado FROM contribuyentes WHERE ruc = ANY($1)`,
    [rucs]
  );
  console.log('Local matches:', localRows.rows.length);

  // Test /compare/all logic  
  console.log('\n--- Testing all (count only) ---');
  const localCnt = await pool.query('SELECT COUNT(*) as cnt FROM contribuyentes');
  const extCnt = await externalPool.query('SELECT COUNT(*) as cnt FROM set_contribuyentes');
  console.log('Local count:', localCnt.rows[0].cnt, 'External count:', extCnt.rows[0].cnt);
} catch(e) { console.error('Error:', e.message); }
await pool.end();
await externalPool.end();
