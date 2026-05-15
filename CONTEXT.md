# Documentación de Contexto: Sistema ElRuc (Consulta DNIT)

## 📌 Resumen del Proyecto
ElRuc es un sistema web avanzado diseñado para buscar y consultar información de contribuyentes (RUC y Razón Social) de forma rápida y segura, a partir de los datos públicos proveídos por la DNIT (Dirección Nacional de Ingresos Tributarios). Cuenta con un portal público de búsqueda predictiva de alta velocidad, además de la visualización de noticias y normativas. Para la gestión, incluye un robusto panel de administración protegido que permite la actualización de la base de datos (subiendo el padrón oficial o descargándolo automáticamente), la visualización de estadísticas en tiempo real y herramientas avanzadas de depuración (debugging y mantenimiento de BD).

## 🏗️ Arquitectura y Stack Tecnológico
El proyecto utiliza una arquitectura limpia Cliente-Servidor con Frontend y Backend completamente separados.

### Frontend (Puerto 5173 - Desarrollo / Servido por Backend en Prod)
- **Framework:** React 18 empaquetado con Vite.
- **UI y Estilos:** Material UI (MUI v5), Emotion y CSS Vanilla.
- **Enrutamiento:** React Router DOM v6.
- **Conexión API:** Proxy en `vite.config.js` (`/api` apunta a `http://127.0.0.1:3001` en desarrollo).

### Backend (Puerto 3001)
- **Entorno:** Node.js (ES Modules con `"type": "module"`).
- **Framework:** Express.js v4.
- **Base de Datos Principal:** PostgreSQL (librería `pg`), con uso intensivo de la extensión `pg_trgm` para búsquedas eficientes (trigramas).
- **Base de Datos Externa (Opcional para Debug):** Conexión secundaria a PostgreSQL (`motora_tpv`) para comparar registros.
- **Autenticación:** JWT (`jose`) + cookies httpOnly (`cookie-parser`).
- **Procesamiento de Archivos:**
  - `formidable`: Recepción de archivos.
  - `unzipper` / `fs`: Descompresión y manejo de streams.
  - Procesamiento por lotes (batch) y Streaming para bajo consumo de memoria RAM.
- **Web Scraping:** `cheerio` para parsear el portal DNIT (descarga de ZIPs del padrón, extracción de noticias y normativas).

## 📂 Estructura del Proyecto

```text
D:\Sistema\ElRuc\
├── CONTEXT.md
├── backend/
│   ├── .env                 # Variables de entorno (DB, Port, JWT Secret)
│   ├── package.json
│   ├── add_ruc_trgm_index.sql # Scripts de base de datos
│   └── src/
│       ├── server.js        # Core de Express (Manejo de rutas de API completas)
│       ├── dataImport.js    # Lógica de descompresión ZIP + Upsert masivo batch
│       └── init-noticias.sql# Estructura para tabla de noticias
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx         # Raíz React + Theme + Router
        ├── App.jsx          # Layout Principal con fondo institucional
        ├── theme.js         # Tema MUI (colores institucionales)
        ├── Navbar.jsx       # Barra superior con logo
        ├── Footer.jsx       # Pie de página (con acceso a admin)
        ├── Home.jsx         # Landing page pública
        ├── SearchForm.jsx   # Buscador con resultados en tarjetas e historial
        ├── Login.jsx        # Acceso Admin
        ├── Import.jsx       # Panel Admin: Sincronización de padrón (Local/Web)
        ├── Stats.jsx        # Dashboard de estadísticas de uso
        ├── Debug.jsx        # Panel avanzado: mantenimiento DB, duplicados, comparación
        └── AnimatedBackgroundPhrases.jsx # Animación en fondo de Home
```

## 🔄 Flujos Principales

### 1. Búsqueda Pública
Usuario escribe ≥3 caracteres en `SearchForm` → fetch a `/api/search?q=...` → backend consulta PostgreSQL optimizado con índices btree (`ruc`) y gin/pg_trgm (`razon_social`). 
El sistema clasifica los resultados inteligentemente. Permite copiar al portapapeles con distintas variantes e incluye historial local. Además registra la consulta en `logs_consultas` para estadísticas.

### 2. Noticias y Normativas
El portal público muestra las últimas noticias y normativas (decretos/resoluciones) extraídas de la DNIT.
El Administrador puede forzar la sincronización (scraping) a través de rutas protegidas, almacenando los datos en la tabla `noticias_dnit`.

### 3. Acceso y Panel de Administración
Login en `/admin/login` → validación y JWT en cookie httpOnly. Redirige a las herramientas administrativas.

### 4. Importación de Datos (Padrón DNIT)
- **Subida Manual:** Subir ZIPs → `/api/upload` → `dataImport.js` procesa e inserta (UPSERT batch) línea por línea.
- **Extracción Automática:** Escanea URL DNIT, extrae link del ZIP, descarga al vuelo en `/api/import-url` y lo procesa.

### 5. Monitoreo y Mantenimiento (NUEVO)
- **Dashboard Estadístico (`/admin/stats`):** Muestra cantidad de consultas, visitantes únicos diarios y tabla de consultas recientes.
- **Debug y Consistencia (`/admin/debug`):** Permite operaciones de mantenimiento (VACUUM, REINDEX, ANALYZE), detección/eliminación de RUCs duplicados, comparación de registros locales vs externos (`motora_tpv`), reparación de registros mal formateados (caracteres "pegados") y edición manual de registros.

## 🧩 Componentes y Endpoints Clave

### Frontend (React + MUI)
- **SearchForm.jsx:** Buscador avanzado, predictivo, con tarjetas de resultados interactivas y chips de estado (ACTIVO, CANCELADO, etc.).
- **Stats.jsx:** Paneles estadísticos visuales con contadores (hoy, totales) y tabla de últimas búsquedas.
- **Debug.jsx:** Interfaz dividida en pestañas (General, Duplicados, Comparar DB, Registros, Logs) para gestión técnica profunda.
- **Import.jsx:** Control de actualizaciones del padrón con barras de progreso detalladas y cancelación de promesas.

### Backend (Endpoints Express)

| Categoría | Endpoints Principales | Descripción |
|-----------|-----------------------|-------------|
| **Público** | `/api/search` | Búsqueda principal (ILIKE + pg_trgm). |
| | `/api/dnit/noticias` <br> `/api/dnit/normativas` | Retorna los comunicados almacenados. |
| **Auth** | `/api/login` <br> `/api/logout` | Manejo de sesión JWT por cookies. |
| **Admin - Padrón** | `/api/upload` <br> `/api/scan-url` <br> `/api/import-url` | Subida, escaneo web y procesamiento de ZIPs. |
| **Admin - Stats** | `/api/stats` <br> `/api/admin/site-stats` | Estadísticas totales del padrón y de tráfico. |
| **Admin - Scrape** | `/api/dnit/scrape-noticias` <br> `/api/dnit/scrape-normativas` | Fuerza la lectura y actualización de noticias de la web DNIT. |
| **Admin - DB & Debug** | `/api/admin/db-stats` <br> `/api/admin/db-maintenance` | Consultas de rendimiento (pg_stat, size) y comandos (VACUUM, REINDEX). |
| | `/api/admin/debug/duplicates` <br> `/api/admin/debug/remove-duplicates` | Gestión de colisiones de RUC. |
| | `/api/admin/debug/external/*` | Integración y comparación con base de datos externa (`motora_tpv`). |
| | `/api/admin/debug/records` <br> `/api/admin/debug/record/:ruc` | CRUD para examinar y corregir contribuyentes puntuales. |

### Lógica de Importación (`dataImport.js`)
Procesa el CSV interno del ZIP usando stream de lectura, limpiando caracteres nulos (`\x00`), segmentando mediante separador `|` y realizando `INSERT ON CONFLICT DO UPDATE` en bloques (batch). Genera logs de error en base de datos si falla un registro.

## ✅ Hitos Alcanzados Recientes
- Integración completa de extensión `pg_trgm` para búsquedas en texto mucho más precisas y performantes.
- Implementación del sistema completo de métricas y estadísticas (rastreo de IPs, términos buscados, visitas diarias).
- Adición de un robusto panel de Debugging (`Debug.jsx`) para limpieza de base de datos y reparación de registros corrompidos.
- Scraping automatizado no solo del padrón, sino de **Noticias** y **Normativas** de la web oficial de DNIT.
- Migración a uso de un pool de base de datos externa para comprobación de integridad.
- Rediseño estético global (Fondo de bandera Paraguaya con degradados institucionales).

## 🚀 Pendientes / Próximos Pasos
- Despliegue en producción (PM2, Docker, Nginx).
- Habilitar Redis para cacheo de búsquedas ultra-frecuentes (opcional).
- Sistema automático programado (Cron Job) que ejecute el web-scraping diariamente en horas de bajo tráfico.
