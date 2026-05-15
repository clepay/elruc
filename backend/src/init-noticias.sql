CREATE TABLE IF NOT EXISTS noticias_dnit (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(500) NOT NULL,
  link VARCHAR(500) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'noticia',
  fecha_publicacion VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_noticias_tipo ON noticias_dnit(tipo);
CREATE INDEX IF NOT EXISTS idx_noticias_created ON noticias_dnit(created_at DESC);
