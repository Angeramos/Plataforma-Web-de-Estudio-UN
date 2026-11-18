import { db } from "@/server/db/prisma";
import { embedDocuments, toVectorLiteral } from "@/server/embeddings/client";
import { toFuenteDto } from "@/server/espacios/dto";
import { exigirEspacio } from "@/server/espacios/service";
import { env } from "@/server/env";
import { AppError } from "@/server/http/errors";
import { fragmentar, type Fragmento } from "./chunk";
import { extraerTexto } from "./extract";
import { detectarTipo } from "./tipo";

const MIN_CARACTERES = 50;
const VENCE_MS = 3 * 60 * 1000;

const limiteBytes = () => env().MAX_UPLOAD_MB * 1024 * 1024;

const tocarEspacio = (espacioId: string) => db().espacios.update({ where: { id: espacioId }, data: { updated_at: new Date() } });

// Una sola sentencia por fuente. SQL crudo porque `embedding` es Unsupported en Prisma.
// Si Gemini falla, el embedding queda NULL y la fuente igual queda `listo`: la cubre el FTS (D-033).
async function insertarFragmentos(fuenteId: string, espacioId: string, frags: Fragmento[]) {
  const vectores = await embedDocuments(frags.map((f) => f.contenido));
  const embeddings = vectores.map((v) => (v ? toVectorLiteral(v) : null));
  await db().$executeRaw`
    INSERT INTO fragmentos (fuente_id, espacio_id, orden, contenido, metadata, embedding)
    SELECT ${fuenteId}::uuid, ${espacioId}::uuid, f.orden, f.contenido, f.metadata::jsonb, f.embedding::vector
    FROM unnest(${frags.map((f) => f.orden)}::int[], ${frags.map((f) => f.contenido)}::text[],
                ${frags.map((f) => JSON.stringify(f.metadata))}::text[], ${embeddings}::text[])
      AS f(orden, contenido, metadata, embedding)`;
}

// Rechaza antes de leer el cuerpo cuando el tamaño declarado ya excede el límite.
export function rechazarSiExcede(contentLength: string | null) {
  if (Number(contentLength) > limiteBytes() + 64 * 1024) throw archivoMuyGrande();
}

const archivoMuyGrande = () => new AppError(413, "ARCHIVO_MUY_GRANDE", `El archivo supera ${env().MAX_UPLOAD_MB} MB`);

// Ingesta síncrona (D-021): la respuesta trae la fuente en su estado final, `listo` o `error`.
export async function subir(userId: string, espacioId: string, archivo: File) {
  await exigirEspacio(userId, espacioId);
  if (archivo.size > limiteBytes()) throw archivoMuyGrande();
  if (archivo.size === 0) throw new AppError(400, "VALIDACION", "archivo: está vacío");

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = detectarTipo(archivo.name, bytes);

  const fuente = await db().fuentes.create({ data: { espacio_id: espacioId, nombre_archivo: archivo.name, tipo } });
  let final;
  try {
    const frags = fragmentar(await extraerTexto(tipo, bytes));
    const caracteres = frags.reduce((n, f) => n + f.contenido.length, 0);
    if (caracteres < MIN_CARACTERES) {
      final = await marcarError(fuente.id, "No se pudo extraer texto (¿PDF escaneado?)");
    } else {
      await insertarFragmentos(fuente.id, espacioId, frags);
      final = await db().fuentes.update({ where: { id: fuente.id }, data: { estado: "listo" } });
    }
  } catch (err) {
    console.error("[fuentes] fallo en la ingesta", fuente.id, err);
    final = await marcarError(fuente.id, "No se pudo procesar el archivo");
  }
  await tocarEspacio(espacioId);
  return toFuenteDto(final);
}

const marcarError = (id: string, error: string) => db().fuentes.update({ where: { id }, data: { estado: "error", error } });

// Una fuente que lleva más de 3 min en `procesando` murió con su petición: se marca `error` (spec §4.3 paso 10).
export async function marcarVencidas(espacioId: string) {
  await db().fuentes.updateMany({
    where: { espacio_id: espacioId, estado: "procesando", created_at: { lt: new Date(Date.now() - VENCE_MS) } },
    data: { estado: "error", error: "El procesamiento no terminó; vuelve a subir el archivo" },
  });
}

export async function listar(userId: string, espacioId: string) {
  await exigirEspacio(userId, espacioId);
  await marcarVencidas(espacioId);
  const rows = await db().fuentes.findMany({ where: { espacio_id: espacioId }, orderBy: { created_at: "asc" } });
  return rows.map(toFuenteDto);
}

export async function eliminar(userId: string, fuenteId: string) {
  const fuente = await db().fuentes.findFirst({ where: { id: fuenteId, espacios: { user_id: userId } }, select: { espacio_id: true } });
  if (!fuente) throw new AppError(404, "NO_ENCONTRADO", "La fuente no existe");
  await db().fuentes.delete({ where: { id: fuenteId } }); // los fragmentos caen en cascada
  await tocarEspacio(fuente.espacio_id);
}
