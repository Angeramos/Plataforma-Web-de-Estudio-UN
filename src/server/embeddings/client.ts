import { env } from "@/server/env";

// Única puerta a Gemini (regla 5). REST verificado en D-040: batchEmbedContents / embedContent, cabecera x-goog-api-key.
const LOTE = 100; // shortcut: el máximo por lote no está publicado; si Gemini lo rechaza, ese lote queda sin embedding.
const TIMEOUT_MS = 20_000;

type Tarea = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

// Puro. gemini-embedding-001 no normaliza los vectores reducidos a 768 (D-040).
export function normalizar(v: number[]): number[] {
  const norma = Math.hypot(...v);
  if (!norma) throw new Error("vector de norma cero");
  return v.map((x) => x / norma);
}

// Puro. Literal de texto que acepta `'[...]'::vector`.
export function toVectorLiteral(v: number[]): string {
  if (v.length !== env().EMBEDDINGS_DIM || !v.every(Number.isFinite)) throw new Error(`vector inválido (${v.length} valores)`);
  return `[${v.join(",")}]`;
}

const pedido = (texto: string, tarea: Tarea) => ({
  model: `models/${env().EMBEDDINGS_MODEL}`,
  content: { parts: [{ text: texto }] },
  taskType: tarea,
  outputDimensionality: env().EMBEDDINGS_DIM,
});

async function llamar(metodo: "batchEmbedContents" | "embedContent", body: unknown): Promise<unknown> {
  const key = env().EMBEDDINGS_API_KEY;
  if (!key) throw new Error("EMBEDDINGS_API_KEY no configurada");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env().EMBEDDINGS_MODEL}:${metodo}`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Gemini ${metodo} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function validar(values: unknown): number[] {
  if (!Array.isArray(values) || values.length !== env().EMBEDDINGS_DIM) throw new Error("dimensión inesperada");
  return normalizar(values as number[]);
}

// Nunca lanza: un lote que falla queda en null y la fuente sigue `listo`, con FTS de respaldo (D-033).
export async function embedDocuments(textos: string[]): Promise<(number[] | null)[]> {
  if (!textos.length) return [];
  if (!env().EMBEDDINGS_API_KEY) {
    console.error("[embeddings] sin EMBEDDINGS_API_KEY: fragmentos sin embedding");
    return textos.map(() => null);
  }
  const out: (number[] | null)[] = [];
  for (let i = 0; i < textos.length; i += LOTE) {
    const lote = textos.slice(i, i + LOTE);
    try {
      const data = (await llamar("batchEmbedContents", { requests: lote.map((t) => pedido(t, "RETRIEVAL_DOCUMENT")) })) as {
        embeddings?: { values: unknown }[];
      };
      if (data.embeddings?.length !== lote.length) throw new Error("cantidad de vectores inesperada");
      out.push(...data.embeddings.map((e) => validar(e.values)));
    } catch (err) {
      console.error(`[embeddings] lote ${i / LOTE} falló; ${lote.length} fragmentos sin embedding`, err);
      out.push(...lote.map(() => null));
    }
  }
  return out;
}

// Lanza si falla: quien recupera (rag/retrieve) cae a FTS.
export async function embedQuery(texto: string): Promise<number[]> {
  const data = (await llamar("embedContent", pedido(texto, "RETRIEVAL_QUERY"))) as { embedding?: { values: unknown } };
  return validar(data.embedding?.values);
}
