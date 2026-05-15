import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { SignJWT, jwtVerify } from 'jose';
import formidable from 'formidable';
import cookieParser from 'cookie-parser';
import { processZipAndImport } from './dataImport.js';
import { streamToStaging, confirmImport, cancelImport, getPreviewBatch } from './importStaging.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import * as cheerio from 'cheerio';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3001;

function buildDbConfig() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      user: url.username,
      password: url.password,
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      max: 20,
      idleTimeoutMillis: 30000,
    };
  }
  return {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'elruc_db',
    password: process.env.DB_PASSWORD || '0021071980gC',
    port: Number(process.env.DB_PORT || 5432),
    max: 20,
    idleTimeoutMillis: 30000,
  };
}

const dbConfig = buildDbConfig();

// Pool de conexiones PostgreSQL (reutiliza conexiones en vez de crear una por request)
const pool = new Pool(dbConfig);

function dbInfo() {
  return `${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
}

// Middlewares
app.set('trust proxy', true);
const CORS_ORIGIN = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : undefined);
if (CORS_ORIGIN) {
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
}
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  if (req.path.startsWith('/admin')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ message: 'Backend funcionando correctamente' });
});

// ENDPOINTS DE AUTENTICACIÓN
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT username, password FROM usuarios WHERE username = $1 LIMIT 1', [username]);

    if (result.rows.length > 0 && result.rows[0].password === password) {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const token = await new SignJWT({ user: username })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('2h')
        .sign(secret);
      
      res.cookie('admin_token', token, {
        httpOnly: true, path: '/', maxAge: 7200000, sameSite: 'strict'
      });
      res.cookie('admin_gate', token, {
        httpOnly: true, path: '/', maxAge: 7200000, sameSite: 'lax'
      });
      return res.status(200).json({ success: true });
    }
    return res.status(401).json({ error: 'Credenciales inválidas' });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/api/logout', (req, res) => {
  res.cookie('admin_token', '', { httpOnly: true, path: '/', maxAge: 0, sameSite: 'strict' });
  res.cookie('admin_gate', '', { httpOnly: true, path: '/', maxAge: 0, sameSite: 'lax' });
  return res.status(200).json({ success: true });
});

// ENDPOINT DE BÚSQUEDA
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 3) return res.status(200).json([]);

  try {
    const searchTerm = q.trim().toUpperCase();
    const isNumericOnly = /^\d+$/.test(searchTerm);
    const rucDvMatch = searchTerm.match(/^(\d+)-(\d)$/);

    let query, params;
    
    if (isNumericOnly) {
      query = `
        SELECT ruc, dv, razon_social, estado 
        FROM contribuyentes 
        WHERE ruc = $1
           OR ruc LIKE $2
        ORDER BY 
          CASE WHEN ruc = $1 THEN 0 ELSE 1 END,
          ruc ASC
        LIMIT 20;
      `;
      params = [searchTerm, searchTerm + '%'];
    } else if (rucDvMatch) {
      query = `
        SELECT ruc, dv, razon_social, estado 
        FROM contribuyentes 
        WHERE ruc = $1 AND dv = $2
        ORDER BY ruc ASC
        LIMIT 20;
      `;
      params = [rucDvMatch[1], rucDvMatch[2]];
    } else {
      const words = searchTerm.split(/\s+/).filter(w => w.length > 1);

      if (words.length === 1) {
        query = `
          SELECT ruc, dv, razon_social, estado 
          FROM contribuyentes 
          WHERE razon_social LIKE $1
          ORDER BY 
            similarity(razon_social, $2) DESC,
            razon_social ASC
          LIMIT 20;
        `;
        params = ['%' + searchTerm + '%', searchTerm];
      } else {
        const whereConditions = [];
        params = [];
        let idx = 1;

        for (const word of words) {
          whereConditions.push(`razon_social LIKE $${idx}`);
          params.push('%' + word + '%');
          idx++;
        }

        const searchTermIdx = idx;
        params.push(searchTerm);

        query = `
          WITH search_data AS (
            SELECT 
              ruc, dv, razon_social, estado,
              CASE 
                WHEN razon_social LIKE '%, %' 
                THEN CONCAT(
                  TRIM(SUBSTRING(razon_social FROM POSITION(',' IN razon_social) + 1)),
                  ' ',
                  SUBSTRING(razon_social FROM 1 FOR POSITION(',' IN razon_social) - 1)
                )
                ELSE razon_social
              END AS razon_flipped
            FROM contribuyentes 
            WHERE (${whereConditions.join(' AND ')})
          )
          SELECT ruc, dv, razon_social, estado
          FROM search_data
          ORDER BY 
            GREATEST(similarity(razon_social, $${searchTermIdx}), similarity(razon_flipped, $${searchTermIdx})) DESC,
            razon_social ASC
          LIMIT 20;
        `;
      }
    }
    const result = await pool.query(query, params);

    try {
      await pool.query(
        'INSERT INTO logs_consultas (termino, resultados, ip) VALUES ($1, $2, $3)',
        [q, result.rowCount, (req.ip || req.headers['x-forwarded-for'] || 'desconocida').replace(/^::ffff:/, '')]
      );
    } catch (logErr) {
      if (logErr.code !== '42P01') console.error('Error log consulta:', logErr.message);
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ENDPOINT DE ESTADÍSTICAS
app.get('/api/stats', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  try {
    const result = await pool.query('SELECT COUNT(*) as total FROM contribuyentes;');
    res.status(200).json({ total: result.rows[0].total });
  } catch (error) {
    console.error('Error en estadísticas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ENDPOINT DE ESCANEO DE URL
app.post('/api/scan-url', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Debe proveer una URL' });

  try {
    const fetchOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Referer': 'https://www.dnit.gov.py/',
      }
    };

    const response = await fetch(url, fetchOptions);
    if (!response.ok) return res.status(response.status).json({ error: `No se pudo acceder a la URL. Estado: ${response.status}` });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    const items = [];

    $('.list__item.search-item').each((_, el) => {
      const title = $(el).find('h3.item__title').text().trim();
      const description = $(el).find('p.item__description').text().trim();
      const linkEl = $(el).find('a.link[download]');
      let link = linkEl.attr('href');

      if (link) {
        link = new URL(link, url).href;
        items.push({ title, description, link });
      }
    });

    if (items.length === 0) return res.status(404).json({ error: 'No se detectaron archivos ZIP en esa página.' });
    res.status(200).json({ links: items });
  } catch (error) {
    console.error('Error escaneando URL:', error);
    res.status(500).json({ error: 'Fallo al escanear la URL indicada.' });
  }
});

// ENDPOINT DE SUBIDA PROTEGIDO
app.post('/api/upload', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  const form = formidable({ maxFileSize: 1024 * 1024 * 1024 }); // 1GB de límite de seguridad
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error de Formidable:', err);
      return res.status(500).json({ error: 'Error al subir archivo' });
    }
    
    const uploadedFiles = files.file || files.files; // Acepta la llave 'file' enviada desde el bucle
    if (!uploadedFiles) return res.status(400).json({ error: 'No hay archivo(s)' });

    const filesArray = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];

    let processed = 0;
    let errors = [];
    for (const f of filesArray) {
      try {
        await processZipAndImport(f.filepath);
        processed++;
      } catch (error) {
        console.error(`Error en ZIP ${f.originalFilename || f.filepath}:`, error.message);
        errors.push(f.originalFilename || f.filepath);
      } finally {
        try { fs.unlinkSync(f.filepath); } catch (e) {}
      }
    }
    if (errors.length > 0) {
      res.status(200).json({ message: `Procesados ${processed} de ${filesArray.length} archivo(s). Errores: ${errors.join(', ')}` });
    } else {
      res.status(200).json({ message: `Base de datos actualizada. Se procesaron ${processed} archivo(s).` });
    }
  });
});

// ENDPOINT DE IMPORTACIÓN POR URL
app.post('/api/import-url', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  const { links } = req.body;
  if (!links || !Array.isArray(links) || links.length === 0) {
    return res.status(400).json({ error: 'Debe proveer una lista de enlaces a archivos ZIP.' });
  }

  // Camuflamos las peticiones de descarga también
  const fetchOptions = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
  };

  let processed = 0;
  let errors = [];
  for (const link of links) {
    console.log(`Descargando y procesando: ${link}`);
    try {
      const zipRes = await fetch(link, fetchOptions);
      if (!zipRes.ok) {
        console.warn(`No se pudo descargar ${link}. Estado: ${zipRes.status}. Saltando...`);
        continue;
      }

      const safeFilename = link.split('?')[0].split('/').pop() || 'archivo.zip';
      const tmpFilePath = path.join(os.tmpdir(), `dnit_${Date.now()}_${safeFilename}`);
      const fileStream = fs.createWriteStream(tmpFilePath);
      await pipeline(Readable.fromWeb(zipRes.body), fileStream);

      await processZipAndImport(tmpFilePath);
      try { fs.unlinkSync(tmpFilePath); } catch (e) {}
      processed++;
    } catch (error) {
      console.error(`Error procesando ${link}:`, error.message);
      errors.push(link);
    }
  }
  res.status(200).json({ message: `Sincronización completada. Procesados ${processed} de ${links.length} archivos.${errors.length > 0 ? ` Errores: ${errors.join(', ')}` : ''}` });
});

// ENDPOINT DE ESTADÍSTICAS DEL SITIO (consultas, visitantes)
app.get('/api/admin/site-stats', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 15));
    const offset = (page - 1) * pageSize;
    const desde = req.query.desde || '';
    const hasta = req.query.hasta || '';

    let dateFilter = '';
    const params = [];
    let paramIdx = 0;

    if (desde && hasta) {
      paramIdx = 1;
      dateFilter = `WHERE fecha >= $${paramIdx} AND fecha < ($${paramIdx + 1}::date + interval '1 day')`;
      params.push(desde, hasta);
    } else if (desde) {
      paramIdx = 1;
      dateFilter = `WHERE fecha >= $${paramIdx}`;
      params.push(desde);
    } else if (hasta) {
      paramIdx = 1;
      dateFilter = `WHERE fecha < ($${paramIdx}::date + interval '1 day')`;
      params.push(hasta);
    }

    const countSql = `SELECT COUNT(*) as total FROM logs_consultas ${dateFilter}`;
    const dataSql = `SELECT id, fecha, termino, resultados, ip FROM logs_consultas ${dateFilter} ORDER BY fecha DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const [qToday, vToday, tQueries, countResult, recent] = await Promise.all([
      pool.query("SELECT COUNT(*) as total FROM logs_consultas WHERE fecha >= CURRENT_DATE"),
      pool.query("SELECT COUNT(DISTINCT ip) as total FROM logs_consultas WHERE fecha >= CURRENT_DATE"),
      pool.query("SELECT COUNT(*) as total FROM logs_consultas"),
      pool.query(countSql, params),
      pool.query(dataSql, [...params, pageSize, offset])
    ]);

    res.status(200).json({
      queriesToday: parseInt(qToday.rows[0]?.total || 0),
      visitorsToday: parseInt(vToday.rows[0]?.total || 0),
      totalQueries: parseInt(tQueries.rows[0]?.total || 0),
      recentQueries: recent.rows || [],
      totalRecords: parseInt(countResult.rows[0]?.total || 0),
      page,
      pageSize
    });
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(200).json({
        queriesToday: 0, visitorsToday: 0, totalQueries: 0, recentQueries: [], totalRecords: 0, page: 1, pageSize: 15
      });
    }
    console.error('Error en estadísticas del sitio:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ENDPOINT DE DATOS PARA GRÁFICOS (agregaciones)
app.get('/api/admin/chart-data', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  try {
    const [qByDay, topTerms, qByHour, resultsDist] = await Promise.all([
      pool.query(`
        SELECT DATE(fecha) as dia, COUNT(*) as total
        FROM logs_consultas
        WHERE fecha >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY dia ORDER BY dia ASC
      `),
      pool.query(`
        SELECT termino, COUNT(*) as total
        FROM logs_consultas
        GROUP BY termino ORDER BY total DESC LIMIT 10
      `),
      pool.query(`
        SELECT EXTRACT(HOUR FROM fecha) as hora, COUNT(*) as total
        FROM logs_consultas
        GROUP BY hora ORDER BY hora ASC
      `),
      pool.query(`
        SELECT
          CASE
            WHEN resultados = 0 THEN 'Sin resultados'
            WHEN resultados = 1 THEN '1 resultado'
            WHEN resultados <= 5 THEN '2-5'
            WHEN resultados <= 10 THEN '6-10'
            ELSE '10+'
          END as rango,
          COUNT(*) as total
        FROM logs_consultas
        GROUP BY rango ORDER BY rango
      `)
    ]);

    res.status(200).json({
      queriesByDay: qByDay.rows.map(r => ({ dia: r.dia, total: parseInt(r.total) })),
      topTerms: topTerms.rows.map(r => ({ termino: r.termino, total: parseInt(r.total) })),
      queriesByHour: qByHour.rows.map(r => ({ hora: parseInt(r.hora), total: parseInt(r.total) })),
      resultsDistribution: resultsDist.rows.map(r => ({ rango: r.rango, total: parseInt(r.total) }))
    });
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(200).json({ queriesByDay: [], topTerms: [], queriesByHour: [], resultsDistribution: [] });
    }
    console.error('Error en chart-data:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ENDPOINT PARA ELIMINAR LOGS DE CONSULTAS
app.post('/api/admin/delete-logs', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  const { ids, deleteAll, deleteYear, deleteMonths } = req.body;

  try {
    if (deleteAll) {
      await pool.query('DELETE FROM logs_consultas');
      return res.status(200).json({ message: 'Todos los registros fueron eliminados' });
    }

    if (deleteYear) {
      const result = await pool.query('DELETE FROM logs_consultas WHERE EXTRACT(YEAR FROM fecha) = $1', [deleteYear]);
      return res.status(200).json({ message: `Eliminados ${result.rowCount} registro(s) del año ${deleteYear}` });
    }

    if (Array.isArray(deleteMonths) && deleteMonths.length > 0) {
      const conditions = deleteMonths.map((_, i) => `(EXTRACT(YEAR FROM fecha) = $${i * 2 + 1} AND EXTRACT(MONTH FROM fecha) = $${i * 2 + 2})`);
      const params = deleteMonths.flatMap(m => m.split('-').map(Number));
      const result = await pool.query(`DELETE FROM logs_consultas WHERE ${conditions.join(' OR ')}`, params);
      return res.status(200).json({ message: `Eliminados ${result.rowCount} registro(s) de ${deleteMonths.length} mes(es)` });
    }

    if (Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      await pool.query(`DELETE FROM logs_consultas WHERE id IN (${placeholders})`, ids);
      return res.status(200).json({ message: `${ids.length} registro(s) eliminado(s)` });
    }

    res.status(400).json({ error: 'Envíe ids, deleteAll, deleteYear o deleteMonths' });
  } catch (error) {
    console.error('Error eliminando logs:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ENDPOINT PÚBLICO: devuelve noticias guardadas (sin auth)
app.get('/api/dnit/noticias', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT titulo, link, tipo, fecha_publicacion FROM noticias_dnit WHERE tipo = 'noticia' ORDER BY created_at DESC LIMIT 10"
    );
    res.status(200).json(result.rows || []);
  } catch (error) {
    if (error.code === '42P01') return res.status(200).json([]);
    console.error('Error leyendo noticias:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ENDPOINT PÚBLICO: devuelve normativas guardadas (sin auth)
app.get('/api/dnit/normativas', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT titulo, link, tipo, fecha_publicacion FROM noticias_dnit WHERE tipo = 'normativa' ORDER BY created_at DESC LIMIT 10"
    );
    res.status(200).json(result.rows || []);
  } catch (error) {
    if (error.code === '42P01') return res.status(200).json([]);
    console.error('Error leyendo normativas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ENDPOINT ADMIN: scrapea noticias de la DNIT
app.post('/api/dnit/scrape-noticias', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  try {
    const response = await fetch('https://www.dnit.gov.py/web/portal-institucional/noticias', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!response.ok) return res.status(response.status).json({ error: `Error ${response.status} al acceder a noticias` });

    const html = await response.text();
    const $ = cheerio.load(html);
    const items = [];

    $('article.novedad__item').each((_, el) => {
      const title = $(el).find('h2.novedad__title').text().trim();
      const linkEl = $(el).find('a.novedad__link');
      let link = linkEl.attr('href');
      const fecha = $(el).find('span.novedad__date').text().trim();
      if (title && link) {
        link = link.startsWith('http') ? link : new URL(link, 'https://www.dnit.gov.py').href;
        items.push({ titulo: title, link, fecha_publicacion: fecha });
      }
    });

    if (items.length === 0) return res.status(404).json({ error: 'No se detectaron noticias.' });

    const db = await pool.connect();
    try {
      await db.query('DELETE FROM noticias_dnit WHERE tipo = $1', ['noticia']);
      for (const item of items) {
        await db.query(
          'INSERT INTO noticias_dnit (titulo, link, tipo, fecha_publicacion) VALUES ($1, $2, $3, $4)',
          [item.titulo, item.link, 'noticia', item.fecha_publicacion]
        );
      }
    } finally {
      db.release();
    }
    res.status(200).json({ message: `Se actualizaron ${items.length} noticias.` });
  } catch (error) {
    console.error('Error scrapeando noticias:', error);
    res.status(500).json({ error: 'Fallo al scrapear noticias.' });
  }
});

// ENDPOINT ADMIN: scrapea normativas de la DNIT
app.post('/api/dnit/scrape-normativas', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
  const toAbs = (link, base) => link.startsWith('http') ? link : new URL(link, base).href;

  try {
    // Subpáginas a scrapear
    const subpages = [
      'https://www.dnit.gov.py/web/portal-institucional/decretos',
      'https://www.dnit.gov.py/web/portal-institucional/resoluciones',
    ];

    const allItems = [];

    for (const pageUrl of subpages) {
      const response = await fetch(pageUrl, { headers });
      if (!response.ok) {
        console.warn(`Error ${response.status} al acceder a ${pageUrl}. Saltando...`);
        continue;
      }
      const html = await response.text();
      const $ = cheerio.load(html);

      $('.list__item.search-item').each((_, el) => {
        const title = $(el).find('h3.item__title').text().trim();
        const desc = $(el).find('p.item__description').text().trim();
        const linkEl = $(el).find('a.link[download]');
        let link = linkEl.attr('href');
        if (title && link) {
          link = toAbs(link, 'https://www.dnit.gov.py');
          allItems.push({ titulo: title, link, fecha_publicacion: desc });
        }
      });
    }

    if (allItems.length === 0) return res.status(404).json({ error: 'No se detectaron normativas en las subpáginas.' });

    const db = await pool.connect();
    try {
      await db.query('DELETE FROM noticias_dnit WHERE tipo = $1', ['normativa']);
      for (const item of allItems) {
        await db.query(
          'INSERT INTO noticias_dnit (titulo, link, tipo, fecha_publicacion) VALUES ($1, $2, $3, $4)',
          [item.titulo, item.link, 'normativa', item.fecha_publicacion]
        );
      }
    } finally {
      db.release();
    }
    res.status(200).json({ message: `Se actualizaron ${allItems.length} normativas (Decretos + Resoluciones).` });
  } catch (error) {
    console.error('Error scrapeando normativas:', error);
    fs.appendFileSync('error_log.txt', new Date().toISOString() + ' NORM: ' + (error?.stack || error?.message || error) + '\n');
    res.status(500).json({ error: 'Fallo al scrapear normativas.' });
  }
});

// ENDPOINT DE MANTENIMIENTO DE BASE DE DATOS
app.get('/api/admin/db-stats', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }

  try {
    const [sizeRes, vacuumRes, idxRes, countRes, extRes] = await Promise.all([
      pool.query("SELECT pg_size_pretty(pg_total_relation_size('contribuyentes')) as total_size, pg_size_pretty(pg_relation_size('contribuyentes')) as table_size, pg_size_pretty(pg_indexes_size('contribuyentes')) as index_size"),
      pool.query("SELECT relname, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze FROM pg_stat_user_tables WHERE relname = 'contribuyentes'"),
      pool.query("SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as size, indexdef FROM pg_indexes WHERE tablename = 'contribuyentes' ORDER BY pg_relation_size(indexname::regclass) DESC"),
      pool.query("SELECT COUNT(*) as total FROM contribuyentes"),
      pool.query("SELECT n_live_tup, n_dead_tup FROM pg_stat_user_tables WHERE relname = 'contribuyentes'"),
    ]);

    res.json({
      size: sizeRes.rows[0],
      vacuum: vacuumRes.rows[0] || null,
      indexes: idxRes.rows,
      total: countRes.rows[0].total,
      stats: extRes.rows[0] || null,
    });
  } catch (error) {
    console.error('Error en db-stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

app.post('/api/admin/db-maintenance', async (req, res) => {
  console.log('db-maintenance called, body:', req.body);
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }

  const { action } = req.body;
  console.log('Action received:', action);

  try {
    const db = await pool.connect();
    try {
      console.log('Executing:', action);
      switch (action) {
        case 'vacuum':
          await db.query('VACUUM ANALYZE contribuyentes');
          res.json({ message: 'Vacío y análisis completado exitosamente' });
          break;
        case 'reindex':
          await db.query('REINDEX TABLE contribuyentes');
          res.json({ message: 'Reindexación completada exitosamente' });
          break;
        case 'analyze':
          await db.query('ANALYZE contribuyentes');
          res.json({ message: 'Análisis de tablas completado exitosamente' });
          break;
        default:
          res.status(400).json({ error: 'Acción no válida' });
      }
    } finally {
      db.release();
    }
  } catch (error) {
    console.error(`Error en db-maintenance (${action}):`, error);
    res.status(500).json({ error: `Error al ejecutar ${action}` });
  }
});

// ENDPOINT LISTA DATOS PAGINADOS
app.get('/api/admin/data-list', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }

  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 25;
    const offset = page * limit;
    const search = req.query.search || '';

    let dataRes, countRes;
    if (search) {
      const searchPattern = `%${search}%`;
      [dataRes, countRes] = await Promise.all([
        pool.query(`SELECT ruc, dv, TRIM(razon_social) as razon_social, TRIM(estado) as estado FROM contribuyentes WHERE ruc::text LIKE $1 OR ruc::text || '-' || dv LIKE $1 OR TRIM(razon_social) ILIKE $1 ORDER BY razon_social LIMIT $2 OFFSET $3`, [searchPattern, limit, offset]),
        pool.query(`SELECT COUNT(*) as total FROM contribuyentes WHERE ruc::text LIKE $1 OR ruc::text || '-' || dv LIKE $1 OR TRIM(razon_social) ILIKE $1`, [searchPattern])
      ]);
    } else {
      [dataRes, countRes] = await Promise.all([
        pool.query('SELECT ruc, dv, TRIM(razon_social) as razon_social, TRIM(estado) as estado FROM contribuyentes ORDER BY RANDOM() LIMIT $1 OFFSET $2', [limit, offset]),
        pool.query('SELECT COUNT(*) as total FROM contribuyentes')
      ]);
    }

    const cleanedData = dataRes.rows.map(row => ({
      ...row,
      razon_social: row.razon_social?.replace(/^["']+|["']+$/g, '') || '',
      estado: row.estado?.replace(/^["']+|["']+$/g, '') || ''
    }));
    res.json({
      data: cleanedData,
      total: parseInt(countRes.rows[0].total)
    });
  } catch (error) {
    console.error('Error en data-list:', error);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

// ENDPOINT DETALLE DE REGISTRO
app.get('/api/admin/data-record/:ruc', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }

  try {
    const { ruc } = req.params;
    const result = await pool.query('SELECT * FROM contribuyentes WHERE ruc = $1', [ruc]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error en data-record:', error);
    res.status(500).json({ error: 'Error al obtener registro' });
  }
});

// ENDPOINT ACTUALIZAR REGISTRO
app.put('/api/admin/data-record/:ruc', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }

  try {
    const { ruc } = req.params;
    const { razon_social, estado } = req.body;
    
    await pool.query(
      'UPDATE contribuyentes SET razon_social = $1, estado = $2 WHERE ruc = $3',
      [razon_social, estado, ruc]
    );
    res.json({ message: 'Registro actualizado correctamente' });
  } catch (error) {
    console.error('Error en update-record:', error);
    res.status(500).json({ error: 'Error al actualizar registro' });
  }
});

// ENDPOINT ELIMINAR REGISTRO
app.delete('/api/admin/data-record/:ruc', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }

  try {
    const { ruc } = req.params;
    await pool.query('DELETE FROM contribuyentes WHERE ruc = $1', [ruc]);
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    console.error('Error en delete-record:', error);
    res.status(500).json({ error: 'Error al eliminar registro' });
  }
});

// ENDPOINT LIMPIAR DATOS (QUITAR COMILLAS SIMPLES Y DOBLES AL INICIO/FINAL)
app.post('/api/admin/clean-data', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }

  try {
    const result = await pool.query(`
      UPDATE contribuyentes 
      SET razon_social = REGEXP_REPLACE(razon_social, '^[^[:alnum:]]+|[^[:alnum:]]+$', '', 'g'),
          estado = REGEXP_REPLACE(estado, '^[^[:alnum:]]+|[^[:alnum:]]+$', '', 'g')
      WHERE razon_social ~ '^[^[:alnum:]]' OR estado ~ '^[^[:alnum:]]'
    `);
    res.json({ message: `Se limpiaron ${result.rowCount} registros` });
  } catch (error) {
    console.error('Error en clean-data:', error);
    res.status(500).json({ error: 'Error al limpiar datos' });
  }
});

// ENDPOINT IMPORTAR PREVIEW — subir txt, comparar, mostrar diff
app.post('/api/admin/import-preview', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }

  const form = formidable({ maxFileSize: 2 * 1024 * 1024 * 1024, multiples: true });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Error al subir archivo' });
    const uploaded = files.files || files.file;
    if (!uploaded) return res.status(400).json({ error: 'No hay archivo' });

    const fileList = Array.isArray(uploaded) ? uploaded : [uploaded];

    try {
      let combinedResult = null;
      for (const f of fileList) {
        const result = await streamToStaging(f.filepath);
        if (!combinedResult) {
          combinedResult = result;
        } else {
          combinedResult.nuevos += result.nuevos;
          combinedResult.modificados += result.modificados;
          combinedResult.sinCambios += result.sinCambios;
          combinedResult.totalStaging += result.totalStaging;
        }
        try { fs.unlinkSync(f.filepath); } catch (e) {}
      }
      res.json(combinedResult);
    } catch (error) {
      console.error('Error en import-preview:', error);
      for (const f of fileList) {
        try { fs.unlinkSync(f.filepath); } catch (e) {}
      }
      res.status(500).json({ error: 'Error al procesar archivo' });
    }
  });
});

// ENDPOINT OBTENER LOTE DE PREVIEW PAGINADO
app.get('/api/admin/import-preview-batch', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }

  try {
    const { sessionId, page, limit: l } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });
    const pageNum = parseInt(page) || 0;
    const limitNum = parseInt(l) || 100;
    const data = await getPreviewBatch(sessionId, pageNum, limitNum);
    res.json(data);
  } catch (error) {
    console.error('Error en import-preview-batch:', error);
    res.status(500).json({ error: error.message || 'Error al obtener lote' });
  }
});

// ENDPOINT CONFIRMAR IMPORTACIÓN
app.post('/api/admin/import-confirm', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }

  try {
    const { sessionId, batchRucs } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });
    const result = await confirmImport(sessionId, batchRucs || null);
    res.json(result);
  } catch (error) {
    console.error('Error en import-confirm:', error);
    res.status(500).json({ error: error.message || 'Error al confirmar importación' });
  }
});

// ENDPOINT CANCELAR IMPORTACIÓN
app.post('/api/admin/import-cancel', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }

  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });
    await cancelImport(sessionId);
    res.json({ message: 'Importación cancelada' });
  } catch (error) {
    console.error('Error en import-cancel:', error);
    res.status(500).json({ error: error.message || 'Error al cancelar' });
  }
});

// ─── CALENDARIO PERPETUO ───

function calcularPascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

const FERIADOS_FIJOS = [
  { mes: 0, dia: 1, desc: 'Año Nuevo' },
  { mes: 2, dia: 1, desc: 'Día de los Héroes' },
  { mes: 4, dia: 1, desc: 'Día del Trabajador' },
  { mes: 4, dia: 14, desc: 'Independencia Nacional' },
  { mes: 4, dia: 15, desc: 'Independencia Nacional' },
  { mes: 5, dia: 12, desc: 'Paz del Chaco' },
  { mes: 7, dia: 15, desc: 'Fundación de Asunción' },
  { mes: 8, dia: 29, desc: 'Victoria de Boquerón' },
  { mes: 11, dia: 8, desc: 'Virgen de Caacupé' },
  { mes: 11, dia: 25, desc: 'Navidad' },
];

function generarFeriadosAnio(anio) {
  const fechas = [];
  for (const f of FERIADOS_FIJOS) {
    fechas.push({ fecha: new Date(anio, f.mes, f.dia), desc: f.desc });
  }
  const pascua = calcularPascua(anio);
  const jueves = new Date(pascua);
  jueves.setDate(pascua.getDate() - 3);
  const viernes = new Date(pascua);
  viernes.setDate(pascua.getDate() - 2);
  fechas.push({ fecha: jueves, desc: 'Jueves Santo' });
  fechas.push({ fecha: viernes, desc: 'Viernes Santo' });
  return fechas;
}

function diaSemana(d) {
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  return dias[d.getDay()];
}

function siguienteHabil(fecha, feriados) {
  const f = new Date(fecha);
  while (f.getDay() === 0 || f.getDay() === 6 || feriados.some(fe => fe.fecha.getTime() === f.getTime())) {
    f.setDate(f.getDate() + 1);
  }
  return f;
}

const TABLA_VENCIMIENTOS = [7, 9, 11, 13, 15, 17, 19, 21, 23, 25];

// ENDPOINT: Obtener vencimiento según RUC
function calcularVencimiento(ruc, feriados) {
  const rucBase = ruc.replace(/-.*$/, '').replace(/\D/g, '');
  if (!rucBase) return null;
  const digito = parseInt(rucBase.slice(-1));
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();
  let fechaVen = new Date(anio, mes, TABLA_VENCIMIENTOS[digito]);
  fechaVen = siguienteHabil(fechaVen, feriados);
  return {
    ruc,
    fecha: fechaVen.toISOString().split('T')[0],
    dia_semana: diaSemana(fechaVen),
  };
}

app.post('/api/obligaciones', async (req, res) => {
  try {
    const { ruc, rucs } = req.body;

    const { rows: feriadosRows } = await pool.query('SELECT fecha FROM feriados');
    const feriados = feriadosRows.map(r => ({ fecha: new Date(r.fecha + 'T00:00:00') }));

    if (rucs && Array.isArray(rucs)) {
      const results = rucs.map(r => calcularVencimiento(r, feriados)).filter(Boolean);
      return res.json(results);
    }

    if (!ruc) return res.status(400).json({ error: 'RUC requerido' });
    const result = calcularVencimiento(ruc, feriados);
    if (!result) return res.status(400).json({ error: 'RUC inválido' });
    res.json(result);
  } catch (error) {
    console.error('Error en obligaciones:', error);
    res.status(500).json({ error: 'Error al calcular vencimiento' });
  }
});

// ENDPOINT: Listar feriados
app.get('/api/admin/feriados', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }
  try {
    const result = await pool.query('SELECT id, fecha, descripcion FROM feriados ORDER BY fecha');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener feriados' });
  }
});

// ENDPOINT: Agregar feriado
app.post('/api/admin/feriados', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }
  try {
    const { fecha, descripcion } = req.body;
    if (!fecha || !descripcion) return res.status(400).json({ error: 'Fecha y descripción requeridas' });
    await pool.query('INSERT INTO feriados (fecha, descripcion) VALUES ($1, $2) ON CONFLICT (fecha) DO UPDATE SET descripcion = $2', [fecha, descripcion]);
    res.json({ message: 'Feriado agregado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar feriado' });
  }
});

// ENDPOINT: Eliminar feriado
app.delete('/api/admin/feriados/:id', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }
  try {
    await pool.query('DELETE FROM feriados WHERE id = $1', [req.params.id]);
    res.json({ message: 'Feriado eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar feriado' });
  }
});

// ENDPOINT: Generar feriados para un año
app.post('/api/admin/feriados/generar', async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
  } catch { return res.status(401).json({ error: 'Sesión inválida' }); }
  try {
    const anio = parseInt(req.body.anio) || new Date().getFullYear();
    const fechas = generarFeriadosAnio(anio);
    let count = 0;
    for (const f of fechas) {
      const fechaStr = f.fecha.toISOString().split('T')[0];
      await pool.query('INSERT INTO feriados (fecha, descripcion) VALUES ($1, $2) ON CONFLICT (fecha) DO UPDATE SET descripcion = $2', [fechaStr, f.desc]);
      count++;
    }
    res.json({ message: `Se generaron/actualizaron ${count} feriados para ${anio}` });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar feriados' });
  }
});

// ENDPOINT: Puerta de acceso secreta al panel admin
app.post('/api/admin/gate', async (req, res) => {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const gateToken = await new SignJWT({ gate: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .sign(secret);
    res.cookie('admin_gate', gateToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/'
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error al generar gate token:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Servir frontend de producción (build de Vite)
const frontendDist = path.resolve('..', 'frontend', 'dist');
const SITE_DOMAIN = process.env.DOMAIN || 'elruc.com.py';

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    'User-agent: *\n' +
    'Disallow: /admin/\n' +
    `Sitemap: https://${SITE_DOMAIN}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    '  <url>\n' +
    `    <loc>https://${SITE_DOMAIN}/</loc>\n` +
    '    <priority>1.0</priority>\n' +
    '  </url>\n' +
    '</urlset>\n'
  );
});

app.use(express.static(frontendDist));

async function verifyAdminGate(req) {
  const gateToken = req.cookies?.admin_gate;
  if (!gateToken) return false;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(gateToken, secret);
    return true;
  } catch {
    return false;
  }
}

app.get('*', async (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API no encontrada' });

  if (req.path.startsWith('/admin')) {
    const hasGate = await verifyAdminGate(req);
    if (!hasGate) {
      return res.status(404).type('text/html').send(`<!DOCTYPE html>
<html lang="es-PY">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>El Ruc - Página no encontrada</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.80)),
                url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="33.33" fill="%23d52b1e"/><rect y="33.33" width="100" height="33.33" fill="%23ffffff"/><rect y="66.66" width="100" height="33.34" fill="%230038a8"/></svg>') center/cover no-repeat fixed;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .card {
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    padding: 48px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
    max-width: 420px;
    width: 100%;
  }
  h1 { font-size: 72px; color: #d52b1e; font-weight: 800; line-height: 1; }
  h2 { font-size: 20px; color: #1a1a2e; margin: 16px 0 8px; font-weight: 600; }
  p { font-size: 14px; color: #666; line-height: 1.5; margin-bottom: 24px; }
  .bar {
    height: 4px; border-radius: 2px; background: #e0e0e0; overflow: hidden; margin: 0 auto 24px; max-width: 200px;
  }
  .bar-inner {
    height: 100%; width: 0; background: linear-gradient(90deg, #d52b1e, #0038a8);
    border-radius: 2px; animation: fillBar 4s ease forwards;
  }
  @keyframes fillBar { to { width: 100%; } }
  a {
    display: inline-block; padding: 10px 28px; background: #0038a8; color: #fff;
    text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;
    transition: background 0.2s;
  }
  a:hover { background: #002880; }
</style>
</head>
<body>
<div class="card">
  <h1>404</h1>
  <h2>Página no encontrada</h2>
  <p>El contenido que buscas no está disponible o ha sido movido.</p>
  <div class="bar"><div class="bar-inner"></div></div>
  <a href="/">Volver al inicio</a>
</div>
<script>setTimeout(function(){ window.location.href = '/'; }, 5000);</script>
</body>
</html>`);
    }
  }

  res.sendFile(path.join(frontendDist, 'index.html'));
});

async function ensureTables() {
  try {
    const db = await pool.connect();
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS feriados (
          id SERIAL PRIMARY KEY,
          fecha DATE NOT NULL UNIQUE,
          descripcion VARCHAR(200) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // tabla feriados lista
    } catch (tblErr) {
      console.warn('⚠️ No se pudo crear tabla feriados:', tblErr.message);
    } finally {
      db.release();
    }
  } catch (err) {
    console.warn('⚠️ No se pudo conectar para crear tablas:', err.message);
  }
}

async function ensureIndexes() {
  try {
    const db = await pool.connect();
    try {
      await db.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_contribuyentes_razon_trgm
        ON contribuyentes USING gin (razon_social gin_trgm_ops)
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_contribuyentes_ruc
        ON contribuyentes USING btree (ruc)
      `);
      // índices listos
    } catch (idxErr) {
      if (idxErr.code !== '42P17' && idxErr.code !== '42710') {
        console.warn('⚠️ No se pudo crear índice trigram:', idxErr.message);
      }
    } finally {
      db.release();
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.warn(`⚠️ No se pudo conectar a PostgreSQL en ${dbInfo()}. Asegúrate de que el servicio esté activo y que las credenciales en .env sean correctas.`);
    } else {
      console.warn('⚠️ No se pudo conectar para crear índices:', err.message);
    }
  }
}

async function startServer() {
  console.log('Inicializando base de datos...');
  await ensureTables();
  await ensureIndexes();
  app.listen(PORT, () => {
    console.log('Servidor funcionando en puerto', PORT);
  });
}
startServer();