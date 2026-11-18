// Rellena los embeddings que quedaron NULL (cuota de Gemini agotada o fragmentos del Corte A; D-041, P-12).
// Se corre una vez y espera solo: cuando Gemini responde 429, aguarda el `retryDelay` que indica y sigue.
// Uso (desde la raíz, en WSL): node scripts/backfill-embeddings.mjs
// shortcut: repite la llamada de src/server/embeddings/client.ts porque un .mjs no puede importar el TS con alias "@/".
import { existsSync } from "node:fs";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const KEY = process.env.EMBEDDINGS_API_KEY?.trim();
const MODEL = process.env.EMBEDDINGS_MODEL?.trim() || "gemini-embedding-001";
const DIM = 768;
const LOTE = 100;
const MAX_ESPERAS = 10; // 429 seguidos antes de rendirse (p. ej. si se agotó la cuota diaria)
if (!KEY) throw new Error("Falta EMBEDDINGS_API_KEY");

const db = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
await db.connect();
const dormir = (s) => new Promise((r) => setTimeout(r, s * 1000));

async function embed(textos) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`, {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({
      requests: textos.map((text) => ({ model: `models/${MODEL}`, content: { parts: [{ text }] }, taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: DIM })),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 429) {
    const retry = body.error?.details?.find((d) => d.retryDelay)?.retryDelay; // p. ej. "17s"
    return { esperar: (parseFloat(retry) || 60) + 1 };
  }
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${body.error?.message ?? ""}`);
  return {
    vectores: body.embeddings.map(({ values }) => {
      if (values.length !== DIM) throw new Error(`dimensión inesperada: ${values.length}`);
      const norma = Math.hypot(...values);
      return `[${values.map((x) => x / norma).join(",")}]`;
    }),
  };
}

const { rows: [{ n: total }] } = await db.query("SELECT count(*)::int n FROM fragmentos WHERE embedding IS NULL");
console.log(`Fragmentos sin embedding: ${total}`);
let hechos = 0;
let esperas = 0;
try {
  for (;;) {
    const { rows } = await db.query("SELECT id, contenido FROM fragmentos WHERE embedding IS NULL ORDER BY fuente_id, orden LIMIT $1", [LOTE]);
    if (!rows.length) break;
    const r = await embed(rows.map((f) => f.contenido));
    if (r.esperar) {
      if (++esperas > MAX_ESPERAS) throw new Error("Gemini sigue rechazando por cuota; vuelve a intentarlo más tarde");
      console.log(`  cuota por minuto agotada; espero ${r.esperar} s`);
      await dormir(r.esperar);
      continue;
    }
    esperas = 0;
    await db.query(
      "UPDATE fragmentos g SET embedding = u.v::vector FROM unnest($1::uuid[], $2::text[]) AS u(id, v) WHERE g.id = u.id",
      [rows.map((f) => f.id), r.vectores],
    );
    hechos += rows.length;
    console.log(`  ${hechos}/${total}`);
  }
  console.log("Listo: no quedan fragmentos sin embedding.");
} finally {
  await db.end();
}
