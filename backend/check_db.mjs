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

const dbUrl = `${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

(async () => {
  const client = new Client(dbConfig);
  try {
    await client.connect();
  } catch (error) {
    console.error(`No se pudo conectar a PostgreSQL en ${dbUrl}:`, formatError(error));
    process.exit(1);
  }
  
  const tableInfo = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'contribuyentes' ORDER BY ordinal_position"
  );
  console.log('Table structure:');
  tableInfo.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
  
  const count = await client.query('SELECT COUNT(*) as total FROM contribuyentes');
  console.log(`\nTotal records: ${count.rows[0].total}`);
  
  const sample = await client.query('SELECT * FROM contribuyentes LIMIT 3');
  console.log('\nSample records:');
  sample.rows.forEach((r, i) => {
    console.log(`${i+1}. ruc=${r.ruc}, dv=${r.dv}, razon_social=${r.razon_social?.substring(0, 50)}, estado=${r.estado}`);
  });
  
  const nullRs = await client.query("SELECT COUNT(*) as total FROM contribuyentes WHERE razon_social IS NULL OR razon_social = ''");
  console.log(`\nRecords with empty/null razon_social: ${nullRs.rows[0].total}`);
  
  const nullRuc = await client.query("SELECT COUNT(*) as total FROM contribuyentes WHERE ruc IS NULL OR ruc = ''");
  console.log(`Records with empty/null ruc: ${nullRuc.rows[0].total}`);
  
  const nullEstado = await client.query("SELECT COUNT(*) as total FROM contribuyentes WHERE estado IS NULL");
  console.log(`Records with null estado: ${nullEstado.rows[0].total}`);
  
  await client.end();
})();
