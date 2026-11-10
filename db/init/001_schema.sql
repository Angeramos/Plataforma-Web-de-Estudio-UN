-- Esquema v2: recuperacion semantica con embeddings (pgvector, 768 dim, Gemini gemini-embedding-001)
-- y busqueda de texto completo en espanol como respaldo.
-- Los archivos originales NO se guardan: solo texto fragmentado.
-- Se aplica una vez sobre un Postgres 14+ (p. ej. Neon o Supabase) con: psql "$DATABASE_URL" -f 001_schema.sql

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        NOT NULL,
  password_hash text        NOT NULL,
  name          text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_uidx ON users (lower(email));

-- ------------------------------------------------------------- espacios
CREATE TABLE espacios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nombre     text        NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 120),
  materia    text                 CHECK (materia IS NULL OR char_length(materia) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX espacios_user_idx ON espacios (user_id);

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER espacios_set_updated_at
  BEFORE UPDATE ON espacios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------- fuentes
CREATE TABLE fuentes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  espacio_id     uuid        NOT NULL REFERENCES espacios(id) ON DELETE CASCADE,
  nombre_archivo text        NOT NULL,
  tipo           text        NOT NULL CHECK (tipo IN ('pdf', 'docx', 'pptx', 'txt')),
  estado         text        NOT NULL DEFAULT 'procesando'
                             CHECK (estado IN ('procesando', 'listo', 'error')),
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fuentes_espacio_idx ON fuentes (espacio_id);

-- ------------------------------------------------------------ fragmentos
-- espacio_id denormalizado a proposito: buscar por espacio sin join.
-- contenido_tsv es una columna GENERADA: nunca se escribe desde la aplicacion.
-- embedding es NULL si el servicio de embeddings fallo: ese fragmento solo se encuentra por texto completo.
-- La dimension (768) debe coincidir con EMBEDDINGS_DIM; cambiarla obliga a recalcular todos los embeddings.
CREATE TABLE fragmentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente_id     uuid        NOT NULL REFERENCES fuentes(id)  ON DELETE CASCADE,
  espacio_id    uuid        NOT NULL REFERENCES espacios(id) ON DELETE CASCADE,
  orden         integer     NOT NULL,
  contenido     text        NOT NULL,
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,   -- ej: {"pagina": 14} o {"slide": 3}
  embedding     vector(768),
  contenido_tsv tsvector GENERATED ALWAYS AS (to_tsvector('spanish', contenido)) STORED
);
CREATE INDEX fragmentos_fuente_idx  ON fragmentos (fuente_id, orden);
CREATE INDEX fragmentos_espacio_idx ON fragmentos (espacio_id);
CREATE INDEX fragmentos_tsv_idx     ON fragmentos USING gin (contenido_tsv);
-- Sin indice vectorial (HNSW) a proposito: filtrando por espacio_id la busqueda exacta es rapida a escala de MVP.

-- ----------------------------------------------------------- generaciones
CREATE TABLE generaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  espacio_id      uuid        NOT NULL REFERENCES espacios(id) ON DELETE CASCADE,
  tipo            text        NOT NULL CHECK (tipo IN ('resumen', 'quiz', 'flashcards')),
  contenido       jsonb       NOT NULL,
  fuentes_citadas jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- [{fuenteId, nombreArchivo, pagina?}]
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX generaciones_espacio_tipo_idx ON generaciones (espacio_id, tipo, created_at DESC);

-- ---------------------------------------------------------- chat_mensajes
CREATE TABLE chat_mensajes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  espacio_id      uuid        NOT NULL REFERENCES espacios(id) ON DELETE CASCADE,
  rol             text        NOT NULL CHECK (rol IN ('user', 'assistant')),
  contenido       text        NOT NULL,
  fuentes_citadas jsonb,      -- solo rol 'assistant': [{fuenteId, nombreArchivo, pagina?, fragmento}]
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_mensajes_espacio_idx ON chat_mensajes (espacio_id, created_at);
