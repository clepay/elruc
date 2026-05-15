import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'elruc_db',
  password: process.env.DB_PASSWORD || '0021071980gC',
  port: Number(process.env.DB_PORT || 5432),
};

function formatError(error) {
  if (!error) return 'Error desconocido';
  if (error.message) return error.message;
  if (error.errors && Array.isArray(error.errors)) {
    return error.errors.map(err => err.message || String(err)).join(' | ');
  }
  return String(error);
}

const c = new Client(dbConfig);
const dbUrl = `${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

(async () => {
  try {
    await c.connect();
  } catch (error) {
    console.error(`No se pudo conectar a PostgreSQL en ${dbUrl}:`, formatError(error));
    process.exit(1);
  }

  const idx = await c.query(
    "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'contribuyentes'"
  );
  console.log('INDEXES:');
  idx.rows.forEach(r => console.log('  ' + r.indexname + ': ' + r.indexdef));

  const size = await c.query(
    "SELECT pg_size_pretty(pg_total_relation_size('contribuyentes')) as total_size"
  );
  console.log('\nTable size: ' + size.rows[0].total_size);

  const stats = await c.query(
    "SELECT reltuples::bigint as approx_rows FROM pg_class WHERE relname = 'contribuyentes'"
  );
  console.log('Approx rows: ' + stats.rows[0].approx_rows);

  console.log('\nTiming ILIKE search (with %q% prefix wildcard)...');
  const start = Date.now();
  await c.query(
    'SELECT ruc, dv, razon_social, estado FROM contribuyentes WHERE razon_social ILIKE $1 OR ruc LIKE $1 LIMIT 20',
    ['%test%']
  );
  console.log('Query time: ' + (Date.now() - start) + 'ms');

  const ext = await c.query("SELECT * FROM pg_extension WHERE extname = 'pg_trgm'");
  console.log('\npg_trgm extension installed: ' + (ext.rows.length > 0));

  // Check if there's a primary key / unique constraint
  const pk = await c.query(
    "SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = 'contribuyentes'"
  );
  console.log('\nConstraints:');
  pk.rows.forEach(r => console.log('  ' + r.constraint_name + ': ' + r.constraint_type));

  await c.end();
})();
