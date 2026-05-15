import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ user: "postgres", host: "localhost", database: "elruc_db", password: "0021071980gC", port: 5432 });
try {
  const r = await pool.query("SELECT username, password FROM usuarios LIMIT 5");
  console.log(r.rows.map(u => u.username + ":" + u.password).join("\n"));
} catch(e) { console.error(e.message); }
await pool.end();
