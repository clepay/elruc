import fs from 'fs';
import csv from 'csv-parser';
import pg from 'pg';

const { Pool } = pg;

function buildPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  }
  return new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    max: 10,
  });
}

const pool = buildPool();

const sessions = new Map();

function createTableName() {
  return `staging_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getSession(sessionId) {
  return sessions.get(sessionId);
}

export function destroySession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
}

export async function streamToStaging(filePath, onProgress) {
  const tableName = createTableName();
  const sessionId = tableName;

  const client = await pool.connect();

  await client.query(`CREATE TEMP TABLE ${tableName} (ruc varchar(50), dv varchar(1), razon_social varchar(255), estado varchar(50))`);

  return new Promise((resolve, reject) => {
    let batch = [];
    const BATCH_SIZE = 1000;
    let totalRows = 0;
    let readStream;

    const insertBatch = async (rows) => {
      if (rows.length === 0) return;
      const values = [];
      const params = [];
      let idx = 1;
      for (const row of rows) {
        values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        params.push(
          String(row.ruc || '').replace(/\0/g, '').replace(/^"|"$/g, '').trim(),
          row.dv ? String(row.dv).replace(/\0/g, '').replace(/^"|"$/g, '').trim() : '0',
          String(row.razon_social || '').replace(/\0/g, '').replace(/^"|"$/g, '').trim(),
          row.estado ? String(row.estado).replace(/\0/g, '').replace(/^"|"$/g, '').trim() : null
        );
      }
      await client.query(
        `INSERT INTO ${tableName} (ruc, dv, razon_social, estado) VALUES ${values.join(', ')}`,
        params
      );
    };

    const done = (err) => {
      client.release();
      if (err) reject(err);
    };

    readStream = fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(csv({ separator: '|', headers: ['ruc', 'razon_social', 'dv', 'codigo_viejo', 'estado'] }));

    readStream.on('data', (row) => {
      if (!row.ruc || !row.razon_social) return;
      batch.push(row);
      totalRows++;

      if (batch.length >= BATCH_SIZE) {
        readStream.pause();
        const currentBatch = batch;
        batch = [];
        insertBatch(currentBatch)
          .then(() => {
            if (onProgress) onProgress(totalRows);
            readStream.resume();
          })
          .catch(err => {
            console.error('Batch insert error:', err.message);
            readStream.resume();
          });
      }
    });

    readStream.on('end', async () => {
      try {
        if (batch.length > 0) {
          await insertBatch(batch);
          if (onProgress) onProgress(totalRows);
        }

        const countRes = await client.query(`SELECT COUNT(*) as total FROM ${tableName}`);
        const totalStaging = parseInt(countRes.rows[0].total);

        const nuevosRes = await client.query(`
          SELECT s.ruc, s.dv, s.razon_social, s.estado
          FROM ${tableName} s
          LEFT JOIN contribuyentes c ON s.ruc::bigint = c.ruc::bigint
          WHERE c.ruc IS NULL
          ORDER BY s.ruc
        `);
        const nuevos = nuevosRes.rows;

        const modificadosRes = await client.query(`
          SELECT s.ruc, s.dv, s.razon_social, s.estado,
                 c.razon_social as actual_razon, c.estado as actual_estado
          FROM ${tableName} s
          JOIN contribuyentes c ON s.ruc::bigint = c.ruc::bigint
          WHERE (s.razon_social IS DISTINCT FROM c.razon_social)
             OR (s.estado IS DISTINCT FROM c.estado)
          ORDER BY s.ruc
        `);
        const modificados = modificadosRes.rows;

        const sinCambiosRes = await client.query(`
          SELECT COUNT(*) as total
          FROM ${tableName} s
          JOIN contribuyentes c ON s.ruc::bigint = c.ruc::bigint
          WHERE s.razon_social IS NOT DISTINCT FROM c.razon_social
            AND s.estado IS NOT DISTINCT FROM c.estado
        `);
        const sinCambios = parseInt(sinCambiosRes.rows[0].total);

        sessions.set(sessionId, { tableName, filePath, createdAt: Date.now() });

        done();
        resolve({
          sessionId,
          totalStaging,
          nuevos: nuevos.length,
          modificados: modificados.length,
          sinCambios,
        });
      } catch (err) {
        done(err);
      }
    });

    readStream.on('error', async (err) => {
      try { await client.query(`DROP TABLE IF EXISTS ${tableName}`); } catch (e) {}
      done(err);
    });
  });
}

export async function getPreviewBatch(sessionId, page = 0, limit = 100) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Sesión no encontrada o expirada');
  const { tableName } = session;
  const offset = page * limit;

  const nuevosRes = await pool.query(`
    SELECT s.ruc, s.dv, s.razon_social, s.estado, 'nuevo' as tipo
    FROM ${tableName} s
    LEFT JOIN contribuyentes c ON s.ruc::bigint = c.ruc::bigint
    WHERE c.ruc IS NULL
    ORDER BY s.ruc
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  const modificadosRes = await pool.query(`
    SELECT s.ruc, s.dv, s.razon_social, s.estado, 'modificado' as tipo,
           c.razon_social as actual_razon, c.estado as actual_estado
    FROM ${tableName} s
    JOIN contribuyentes c ON s.ruc::bigint = c.ruc::bigint
    WHERE (s.razon_social IS DISTINCT FROM c.razon_social)
       OR (s.estado IS DISTINCT FROM c.estado)
    ORDER BY s.ruc
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  return {
    nuevos: nuevosRes.rows,
    modificados: modificadosRes.rows,
  };
}

export async function confirmImport(sessionId, batchRucs = null) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Sesión no encontrada o expirada');
  const { tableName, filePath } = session;

  const client = await pool.connect();
  try {
    let sourceCondition = '';
    let params = [];
    if (batchRucs && batchRucs.length > 0) {
      const placeholders = batchRucs.map((_, i) => `$${i + 1}`);
      sourceCondition = ` WHERE s.ruc IN (${placeholders.join(',')})`;
      params = batchRucs;
    }

    const result = await client.query(`
      INSERT INTO contribuyentes (ruc, dv, razon_social, estado)
      SELECT s.ruc, s.dv, s.razon_social, s.estado
      FROM ${tableName} s
      LEFT JOIN contribuyentes c ON s.ruc::bigint = c.ruc::bigint
      ${sourceCondition || 'WHERE c.ruc IS NULL OR (s.razon_social IS DISTINCT FROM c.razon_social OR s.estado IS DISTINCT FROM c.estado)'}
      ON CONFLICT (ruc) DO UPDATE SET
        dv = EXCLUDED.dv,
        razon_social = EXCLUDED.razon_social,
        estado = EXCLUDED.estado
    `, params);

    await client.query(`DROP TABLE IF EXISTS ${tableName}`);
  } finally {
    client.release();
  }

  try { fs.unlinkSync(filePath); } catch (e) {}

  sessions.delete(sessionId);

  return { message: 'Importación completada exitosamente' };
}

export async function cancelImport(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const { tableName, filePath } = session;

  const client = await pool.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS ${tableName}`);
  } finally {
    client.release();
  }

  try { fs.unlinkSync(filePath); } catch (e) {}
  sessions.delete(sessionId);
}

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > 3600000) {
      cancelImport(id).catch(() => {});
    }
  }
}, 600000);
