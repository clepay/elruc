-- Índice GIN trigram para búsqueda parcial en RUC (necesita pg_trgm)
-- Esto permite que WHERE ruc ILIKE '%123%' sea rápido
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contribuyentes_ruc_trgm
  ON contribuyentes USING gin (ruc gin_trgm_ops);
