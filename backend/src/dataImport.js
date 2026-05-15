import 'dotenv/config';
import fs from 'fs';
import unzipper from 'unzipper';
import csv from 'csv-parser';
import pg from 'pg';

const { Client } = pg;
const dbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
};

// Nueva función para insertar registros por lotes (Bulk Insert masivo)
async function insertBatch(client, rows) {
  if (rows.length === 0) return;
  const values = [];
  const params = [];
  let paramIndex = 1;

  for (const row of rows) {
    const { ruc, razon_social, dv, estado } = row;
    if (ruc && razon_social) {
      values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      // Sanitizamos los datos para evitar caídas por caracteres invisibles o nulos
      params.push(
        String(ruc).replace(/\0/g, '').replace(/^"|"$/g, '').trim().substring(0, 50), 
        dv ? String(dv).replace(/\0/g, '').replace(/^"|"$/g, '').trim().substring(0, 1) : '0', 
        String(razon_social).replace(/\0/g, '').replace(/^"|"$/g, '').trim().substring(0, 255), 
        estado ? String(estado).replace(/\0/g, '').replace(/^"|"$/g, '').trim().substring(0, 50) : null
      );
    }
  }

  if (values.length === 0) return;

  const query = `
    INSERT INTO contribuyentes (ruc, dv, razon_social, estado) 
    VALUES ${values.join(', ')}
    ON CONFLICT (ruc) DO UPDATE SET 
      razon_social = EXCLUDED.razon_social, 
      dv = EXCLUDED.dv, 
      estado = EXCLUDED.estado;
  `;
  await client.query(query, params);
}

export async function processZipAndImport(zipFilePath) {
  const client = new Client(dbConfig);
  
  // Evitamos que cualquier caída de red inesperada mate el servidor completo
  client.on('error', err => console.error('⚠️ Error en PostgreSQL:', err.message));
  
  await client.connect();
  console.log(`Procesando: ${zipFilePath}`);

  return new Promise((resolve, reject) => {
    let fileFound = false;
    let processingPromises = [];

    fs.createReadStream(zipFilePath)
      .pipe(unzipper.Parse())
      .on('entry', function (entry) {
        const { path: fileName, type } = entry;

        if (type === 'File' && (fileName.toLowerCase().endsWith('.csv') || fileName.toLowerCase().endsWith('.txt'))) {
          fileFound = true;
          
          const processPromise = new Promise((resolveEntry, rejectEntry) => {
            let batch = [];
            const BATCH_SIZE = 1000; // 1000 es el balance perfecto para evitar saturación

            const csvStream = entry.pipe(csv({ separator: '|', headers: ['ruc', 'razon_social', 'dv', 'codigo_viejo', 'estado'] }));

            csvStream.on('data', (row) => {
              batch.push(row);
              if (batch.length >= BATCH_SIZE) {
                // Pausamos el flujo para que la base de datos "respire" y guarde el lote
                entry.pause();
                csvStream.pause();
                
                const currentBatch = batch;
                batch = [];
                
                insertBatch(client, currentBatch)
                  .then(() => {
                    entry.resume();
                    csvStream.resume();
                  })
                  .catch(err => {
                    console.error(`Error procesando lote en ${fileName}:`, err.message);
                    entry.resume();
                    csvStream.resume();
                  });
              }
            });

            csvStream.on('end', () => {
              if (batch.length > 0) {
                insertBatch(client, batch)
                  .then(resolveEntry)
                  .catch(err => {
                    console.error(`Error en lote final de ${fileName}:`, err.message);
                    resolveEntry();
                  });
              } else {
                resolveEntry();
              }
            });

            csvStream.on('error', rejectEntry);
          });

          processingPromises.push(processPromise);
          
          processPromise.then(() => console.log(`✅ Lotes de ${fileName} guardados exitosamente.`)).catch(() => {}); // Evita Unhandled Promise Rejection (Crasheo de Servidor)
        } else {
          entry.autodrain();
        }
      })
      .on('close', async () => {
        try {
          // Garantiza que la BD no se apague hasta que TODO se termine de procesar
          await Promise.all(processingPromises);
          if (!fileFound) console.log(`No se encontraron archivos válidos en ${zipFilePath}`);
          await client.end();
          resolve();
        } catch (err) {
          try { await client.end(); } catch(e) {}
          reject(err);
        }
      })
      .on('error', async (err) => {
        try { await client.end(); } catch (e) {}
        reject(err);
      });
  });
}