# Plataforma Web de Estudio Inteligente

Proyecto de grado (Universidad del Norte). Plataforma estilo NotebookLM para estudiantes universitarios: el usuario crea **Espacios** (uno por materia o tema), sube **Fuentes** (PDF, DOCX, PPTX o TXT) y la plataforma genera **resumen, quiz y flashcards** y responde en un **chat**, siempre a partir de esas fuentes y citándolas (RAG).

## Stack

Next.js 16 (App Router) + TypeScript · API REST en `src/app/api/v1` · PostgreSQL en Neon con pgvector · Prisma 7 · Groq (`openai/gpt-oss-120b`, vía SDK `openai`) · embeddings de Gemini (`gemini-embedding-001`, 768 dimensiones) · JWT (`jose`) + bcryptjs · zod · vitest · Vercel.

## Puesta en marcha

Requisitos: Node 24 (en Windows, desde WSL), una base Postgres con pgvector (Neon), una clave de Groq y una de Google AI Studio.

```bash
npm install                          # también genera el cliente de Prisma
cp .env.example .env.local           # o `neon env pull`; completar las claves y JWT_SECRET (≥ 32 caracteres)
psql "$DATABASE_URL_UNPOOLED" -f db/init/001_schema.sql   # una vez por base
npm run dev                          # http://localhost:3000
```

Variables (detalle en `.env.example`): `DATABASE_URL` (con pooler, la usa la app), `DATABASE_URL_UNPOOLED` (directa, la usan Prisma CLI y psql), `JWT_SECRET`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `EMBEDDINGS_API_KEY`, `EMBEDDINGS_MODEL`, `EMBEDDINGS_DIM` (fija en 768), `CONTEXT_MAX_CHARS`, `MAX_UPLOAD_MB`, `GEN_DAILY_LIMIT`, `CHAT_DAILY_LIMIT`.

## Comandos

```bash
npm run test                          # pruebas unitarias (vitest)
npx eslint                            # lint
npx next build                        # build de producción
scripts/smoke.sh [URL base]           # prueba de humo del API con curl (por defecto http://localhost:3000/api/v1)
node scripts/backfill-embeddings.mjs  # rellena los embeddings que quedaron pendientes por la cuota de Gemini
```

`scripts/smoke.sh` usa las claves reales: recorre registro, espacios, subida de los cuatro tipos de archivo, generaciones, chat con citas, aislamiento entre usuarios y errores (57 verificaciones). Gasta 3 generaciones y 4 mensajes de la cuota del día.

## API

El contrato es [`openapi.yaml`](openapi.yaml). Resumen:

| Recurso | Rutas |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Espacios | `GET`/`POST /espacios`, `GET`/`PATCH`/`DELETE /espacios/{id}` |
| Fuentes | `GET`/`POST /espacios/{id}/fuentes` (multipart, campo `archivo`), `DELETE /fuentes/{id}` |
| Generaciones | `GET`/`POST /espacios/{id}/generaciones` (`{tipo: resumen\|quiz\|flashcards, cantidad?}`), `DELETE /generaciones/{id}` |
| Chat | `GET`/`POST`/`DELETE /espacios/{id}/chat` |

Todas bajo `/api/v1`, con `Authorization: Bearer <token>` salvo registro y login. Los errores siempre tienen la forma `{"error": {"codigo", "mensaje"}}`; un recurso de otro usuario responde 404.

## Cómo funciona

1. **Ingesta** (síncrona): se detecta el tipo por extensión y firma, se extrae el texto (por página en PDF, por diapositiva en PPTX), se fragmenta en trozos de ~1000 caracteres con solape y se calculan los embeddings con Gemini. Si Gemini falla, la fuente queda lista igual y esos fragmentos se buscan por texto completo.
2. **Generaciones:** se arma un contexto con fragmentos de todas las fuentes (muestreo uniforme si no caben en `CONTEXT_MAX_CHARS`), Groq responde JSON estricto y el servidor valida cada ítem y traduce sus etiquetas de fuente.
3. **Chat:** búsqueda vectorial de los 6 fragmentos más cercanos (respaldo: texto completo en español y, si no hay coincidencias, los primeros fragmentos); el modelo responde solo con ellos y cita `[C1]…`. Si no está en las fuentes, responde "No encontré eso en tus fuentes.".

## Estructura

```
src/server/        lógica del backend: auth, espacios, fuentes, embeddings, rag, llm, generaciones, chat, cuota
src/app/api/v1/    rutas HTTP (delgadas: validan y llaman a src/server)
db/init/           esquema SQL (fuente de verdad)
prisma/            esquema de Prisma (generado con `prisma db pull`)
scripts/           prueba de humo, archivos de prueba y backfill de embeddings
```

## Limitaciones conocidas

- Archivos de máximo 4 MB (Vercel rechaza cuerpos de más de 4.5 MB). Sin OCR: un PDF escaneado queda en `error`.
- Gemini en nivel gratuito: 100 textos por minuto por proyecto. Un archivo de más de ~100 fragmentos queda con parte de sus embeddings pendientes hasta correr el backfill.
- La cuota diaria de Groq es de toda la cuenta, no por usuario.
- Cuota diaria por usuario: 30 generaciones y 100 mensajes (borrar generaciones o limpiar el chat la libera).

## Estado

Backend completo y probado: 139 pruebas unitarias y la prueba de humo (57 verificaciones) en verde, también contra el build de producción. El contrato del API es [`openapi.yaml`](openapi.yaml). Pendiente: el frontend sobre `/api/v1` (hoy hay una página provisional).
