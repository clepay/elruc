import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ user: "postgres", host: "localhost", database: "elruc_db", password: "0021071980gC", port: 5432, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });
const externalPool = new Pool({ user: "postgres", host: "localhost", database: "motora_tpv", password: "0021071980gC", port: 5432, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });

try {
  // 1. Test /compare/missing logic (scan-based)
  console.log("=== /compare/missing logic ===");
  const extCnt = await externalPool.query("SELECT COUNT(*)::bigint as total FROM set_contribuyentes");
  const localCnt = await pool.query("SELECT COUNT(*)::bigint as total FROM contribuyentes");
  const localRucs = await pool.query("SELECT ruc FROM contribuyentes WHERE ruc IS NOT NULL AND TRIM(ruc) != '\'''\''");
  const localSet = new Set(localRucs.rows.map(r => r.ruc));
  console.log("External:", extCnt.rows[0].total, "Local:", localCnt.rows[0].total, "Estimated missing:", parseInt(extCnt.rows[0].total) - parseInt(localCnt.rows[0].total));
  
  // Scan first 2000 external to find missing
  const batch = await externalPool.query("SELECT ruc, dv, razon_social FROM set_contribuyentes WHERE ruc IS NOT NULL AND TRIM(ruc) != '\'''\'' ORDER BY ruc LIMIT 2000 OFFSET 0");
  let missingCount = 0;
  for (const row of batch.rows) {
    if (!localSet.has(row.ruc)) missingCount++;
  }
  console.log("Missing in first 2000 external records:", missingCount);

  // 2. Test /compare/diff logic
  console.log("\n=== /compare/diff logic ===");
  const norm = s => s ? s.trim().toUpperCase().replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ") : "";
  const extD = await externalPool.query("SELECT ruc, dv, razon_social FROM set_contribuyentes WHERE ruc IS NOT NULL AND TRIM(ruc) != '\'''\'' ORDER BY ruc LIMIT 10 OFFSET 0");
  const rucs = extD.rows.map(r => r.ruc);
  const locD = await pool.query("SELECT ruc, dv, razon_social, estado FROM contribuyentes WHERE ruc = ANY($1)", [rucs]);
  const locMap = new Map(locD.rows.map(r => [r.ruc, r]));
  for (const ext of extD.rows) {
    const loc = locMap.get(ext.ruc);
    if (!loc) console.log(ext.ruc, "-> only external");
    else {
      const dvDiff = String(loc.dv || "") !== String(ext.dv || "");
      const razDiff = norm(loc.razon_social) !== norm(ext.razon_social);
      if (dvDiff || razDiff) console.log(ext.ruc, "-> diff (dv:", dvDiff, "raz:", razDiff, ")");
      else console.log(ext.ruc, "-> same");
    }
  }

  // 3. Test /compare/all logic (batch-based)
  console.log("\n=== /compare/all logic (first batch) ===");
  let onlyExt = 0, diff = 0, same = 0;
  for (const ext of extD.rows) {
    const loc = locMap.get(ext.ruc);
    if (!loc) onlyExt++;
    else {
      const dvDiff = String(loc.dv || "") !== String(ext.dv || "");
      const razDiff = norm(loc.razon_social) !== norm(ext.razon_social);
      if (dvDiff || razDiff) diff++; else same++;
    }
  }
  // Count onlyLocal
  const extRucSet = new Set(extD.rows.map(r => r.ruc));
  let onlyLoc = 0;
  for (const [ruc] of locMap) { if (!extRucSet.has(ruc)) onlyLoc++; }
  console.log("onlyExternal:", onlyExt, "diff:", diff, "same:", same, "onlyLocal:", onlyLoc);
  
  console.log("\n=== ALL OK ===");
} catch(e) {
  console.error("ERROR:", e.message);
}
await pool.end();
await externalPool.end();
