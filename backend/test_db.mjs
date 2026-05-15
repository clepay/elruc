import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function test() {
  const pool = new Pool({ database: 'elruc_db', user: 'postgres', password: '0021071980gC', host: 'localhost', port: 5432 });
  const extPool = new Pool({ database: 'motora_tpv', user: 'postgres', password: '0021071980gC', host: 'localhost', port: 5432 });

  try {
    const r = await pool.query("SELECT dblink_connect('host=localhost dbname=motora_tpv user=postgres password=0021071980gC port=5432') as ok");
    console.log('dblink connected:', r.rows[0].ok);
  } catch(e) {
    console.log('dblink error:', e.message);
  }

  try {
    const r = await pool.query("SELECT COUNT(*)::bigint as c FROM dblink('dbname=motora_tpv', 'SELECT 1') as t(x int)");
    console.log('dblink count works, result:', r.rows[0].c);
  } catch(e) {
    console.log('dblink count error:', e.message);
  }

  try {
    const r = await extPool.query("SELECT ruc, dv, razon_social FROM set_contribuyentes WHERE NOT EXISTS (SELECT 1 FROM elruc_db.public.contribuyentes WHERE ruc = set_contribuyentes.ruc) ORDER BY ruc LIMIT 3");
    console.log('extPool direct query (with schema), rows:', r.rows.length);
    if (r.rows.length > 0) console.log(JSON.stringify(r.rows[0]));
  } catch(e) {
    console.log('extPool direct query error:', e.message);
  }

  try {
    const r = await extPool.query("SELECT ruc, dv, razon_social FROM set_contribuyentes ORDER BY ruc LIMIT 3");
    console.log('Simple extPool query works, rows:', r.rows.length);
    if (r.rows.length > 0) console.log(JSON.stringify(r.rows[0]));
  } catch(e) {
    console.log('Simple extPool query error:', e.message);
  }

  await pool.end();
  await extPool.end();
}

test();