import { db } from "@/server/db/prisma";
import { embedQuery, toVectorLiteral } from "@/server/embeddings/client";

// Único lugar con SQL de búsqueda vectorial y de texto completo (regla 6). Consultas de la spec §4.5.
const TOP = 6;
const PRIMEROS = 4;

export type Recuperado = {
  id: string;
  fuenteId: string;
  orden: number;
  contenido: string;
  metadata: { pagina?: number };
  nombreArchivo: string;
};
export type Modo = "vector" | "fts" | "primeros";

type Fila = { id: string; fuente_id: string; orden: number; contenido: string; metadata: Recuperado["metadata"]; nombre_archivo: string };
const aRecuperado = (f: Fila): Recuperado => ({
  id: f.id,
  fuenteId: f.fuente_id,
  orden: f.orden,
  contenido: f.contenido,
  metadata: f.metadata,
  nombreArchivo: f.nombre_archivo,
});

export type Consultas = {
  embedQuery: (texto: string) => Promise<number[]>;
  porVector: (espacioId: string, vector: string) => Promise<Recuperado[]>;
  porTexto: (espacioId: string, pregunta: string) => Promise<Recuperado[]>;
  primeros: (espacioId: string) => Promise<Recuperado[]>;
};

// Sin umbral de similitud por ahora [Pendiente P-02]: el prompt obliga a decir "no encontré" si no hay respaldo.
const porVector = async (espacioId: string, vector: string) =>
  (
    await db().$queryRaw<Fila[]>`
      SELECT f.id, f.fuente_id, f.orden, f.contenido, f.metadata, fu.nombre_archivo
      FROM fragmentos f JOIN fuentes fu ON fu.id = f.fuente_id
      WHERE f.espacio_id = ${espacioId}::uuid AND fu.estado = 'listo' AND f.embedding IS NOT NULL
      ORDER BY f.embedding <=> ${vector}::vector
      LIMIT ${TOP}`
  ).map(aRecuperado);

// Consulta OR: con AND, una sola palabra ausente (o "mas" sin tilde, que no es palabra vacía) deja todo en cero (P-02).
const porTexto = async (espacioId: string, pregunta: string) =>
  (
    await db().$queryRaw<Fila[]>`
      SELECT f.id, f.fuente_id, f.orden, f.contenido, f.metadata, fu.nombre_archivo
      FROM fragmentos f JOIN fuentes fu ON fu.id = f.fuente_id
      CROSS JOIN (SELECT replace(plainto_tsquery('spanish', ${pregunta})::text, ' & ', ' | ')::tsquery AS tq) q
      WHERE f.espacio_id = ${espacioId}::uuid AND fu.estado = 'listo' AND f.contenido_tsv @@ q.tq
      ORDER BY ts_rank_cd(f.contenido_tsv, q.tq) DESC
      LIMIT ${TOP}`
  ).map(aRecuperado);

const primeros = async (espacioId: string) =>
  (
    await db().$queryRaw<Fila[]>`
      SELECT f.id, f.fuente_id, f.orden, f.contenido, f.metadata, fu.nombre_archivo
      FROM fragmentos f JOIN fuentes fu ON fu.id = f.fuente_id
      WHERE f.espacio_id = ${espacioId}::uuid AND fu.estado = 'listo'
      ORDER BY fu.created_at, f.orden
      LIMIT ${PRIMEROS}`
  ).map(aRecuperado);

export const consultas: Consultas ={ embedQuery, porVector, porTexto, primeros };

// D-025: vector → FTS (si el vector falla o no trae filas) → primeros fragmentos. Un fallo de FTS sí se propaga.
export async function recuperar(espacioId: string, pregunta: string, deps: Consultas = consultas): Promise<{ modo: Modo; fragmentos: Recuperado[] }> {
  try {
    const vector = toVectorLiteral(await deps.embedQuery(pregunta));
    const fragmentos = await deps.porVector(espacioId, vector);
    if (fragmentos.length) return { modo: "vector", fragmentos };
  } catch (err) {
    console.error("[rag] búsqueda vectorial falló; uso FTS", err);
  }
  const fragmentos = await deps.porTexto(espacioId, pregunta);
  if (fragmentos.length) return { modo: "fts", fragmentos };
  return { modo: "primeros", fragmentos: await deps.primeros(espacioId) };
}
