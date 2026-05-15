import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ user: "postgres", host: "localhost", database: "elruc_db", password: "0021071980gC", port: 5432, max: 5 });
const externalPool = new Pool({ user: "postgres", host: "localhost", database: "motora_tpv", password: "0021071980gC", port: 5432, max: 5 });

const extClient = await externalPool.connect();
try {
  // Create temp table
  await extClient.query("CREATE TEMP TABLE _tmp_test_rucs (ruc VARCHAR(20) PRIMARY KEY) ON COMMIT DROP");
  console.log("Temp table created");

  // Insert local RUCs in batches
  const localRucs = await pool.query("SELECT ruc FROM contribuyentes WHERE ruc IS NOT NULL AND TRIM(ruc) != '\'''\'' ORDER BY ruc LIMIT 10000");
  console.log("Local RUCs sample:", localRucs.rows.length);

  const batch = localRucs.rows.map(r => r.ruc);
  const values = batch.map((_, j) => `($${j + 1})`).join(",");
  await extClient.query(`INSERT INTO _tmp_test_rucs (ruc) VALUES ${values} ON CONFLICT DO NOTHING`, batch);
  console.log("Inserted", batch.length, "RUCs into temp table");

  // Count missing
  const countResult = await extClient.query(`
    SELECT COUNT(*)::bigint as total FROM set_contribuyentes c
    WHERE NOT EXISTS (SELECT 1 FROM _tmp_test_rucs t WHERE t.ruc = c.ruc)
  `);
  console.log("Missing count:", countResult.rows[0].total);

  // Get page
  const extRows = await extClient.query(`
    SELECT c.ruc, c.dv, c.razon_social
    FROM set_contribuyentes c
    WHERE NOT EXISTS (SELECT 1 FROM _tmp_test_rucs t WHERE t.ruc = c.ruc)
    ORDER BY c.ruc ASC
    LIMIT 5 OFFSET 0
  `);
  console.log("Page records:", extRows.rows.length);
  if (extRows.rows.length > 0) console.log("First:", JSON.stringify(extRows.rows[0]));
} catch(e) {
  console.error("ERROR:", e.message);
  console.error("Stack:", e.stack);
} finally {
  extClient.release();
  await pool.end();
  await externalPool.end();
}
