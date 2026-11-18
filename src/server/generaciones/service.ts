import { z } from "zod";
import type { generaciones, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/prisma";
import { env } from "@/server/env";
import { exigirCuota } from "@/server/cuota/service";
import { exigirEspacio } from "@/server/espacios/service";
import { AppError } from "@/server/http/errors";
import { pedirJson } from "@/server/llm/client";
import { promptGeneracion, type TipoGeneracion } from "@/server/llm/prompts";
import { salidaFlashcards, salidaQuiz, salidaResumen } from "@/server/llm/schemas";
import { citarGeneracion } from "@/server/rag/citas";
import { armarContexto } from "@/server/rag/context";

const tipo = z.enum(["resumen", "quiz", "flashcards"]);
export const generacionCreateSchema = z.object({ tipo, cantidad: z.number().int().min(1).max(20).optional() });
export const tipoQuerySchema = tipo.optional();

const CANTIDAD_POR_DEFECTO: Record<TipoGeneracion, number> = { resumen: 0, quiz: 5, flashcards: 10 };

const toGeneracionDto = (g: generaciones) => ({
  id: g.id,
  tipo: g.tipo,
  contenido: g.contenido,
  fuentesCitadas: g.fuentes_citadas,
  createdAt: g.created_at.toISOString(),
});

// Spec §4.4. Síncrono: contexto de todas las fuentes `listo` → LLM → validar → citas → guardar.
export async function generar(userId: string, espacioId: string, input: z.infer<typeof generacionCreateSchema>) {
  await exigirEspacio(userId, espacioId);
  // shortcut: carga todos los fragmentos del espacio (a escala de MVP son pocos MB); muestrear en SQL si crece.
  const frags = await db().fragmentos.findMany({
    where: { espacio_id: espacioId, fuentes: { estado: "listo" } },
    select: { fuente_id: true, orden: true, contenido: true, fuentes: { select: { nombre_archivo: true } } },
    orderBy: [{ fuentes: { created_at: "asc" } }, { orden: "asc" }],
  });
  if (!frags.length) throw new AppError(409, "SIN_FUENTES_LISTAS", "El espacio no tiene fuentes listas; sube un archivo primero");
  await exigirCuota(userId, "generacion");

  const { texto, fuentes } = armarContexto(
    frags.map((f) => ({ fuenteId: f.fuente_id, nombreArchivo: f.fuentes.nombre_archivo, orden: f.orden, contenido: f.contenido })),
    env().CONTEXT_MAX_CHARS,
  );
  const etiquetas = fuentes.map((f) => f.etiqueta);
  const cantidad = input.tipo === "resumen" ? 0 : (input.cantidad ?? CANTIDAD_POR_DEFECTO[input.tipo]);
  const prompt = promptGeneracion(input.tipo, texto, cantidad);

  const citada =
    input.tipo === "resumen"
      ? citarGeneracion("resumen", await pedirJson(prompt, salidaResumen()), fuentes, cantidad)
      : input.tipo === "quiz"
        ? citarGeneracion("quiz", await pedirJson(prompt, salidaQuiz(etiquetas)), fuentes, cantidad)
        : citarGeneracion("flashcards", await pedirJson(prompt, salidaFlashcards(etiquetas)), fuentes, cantidad);
  if (!citada) throw new AppError(502, "ERROR_LLM", "La IA devolvió una respuesta inválida; intenta de nuevo");

  const row = await db().generaciones.create({
    data: {
      espacio_id: espacioId,
      tipo: input.tipo,
      contenido: citada.contenido as Prisma.InputJsonValue,
      fuentes_citadas: citada.fuentesCitadas,
    },
  });
  return toGeneracionDto(row);
}

export async function listar(userId: string, espacioId: string, tipo?: TipoGeneracion) {
  await exigirEspacio(userId, espacioId);
  const rows = await db().generaciones.findMany({ where: { espacio_id: espacioId, tipo }, orderBy: { created_at: "desc" } });
  return rows.map(toGeneracionDto);
}

export async function eliminar(userId: string, id: string) {
  const { count } = await db().generaciones.deleteMany({ where: { id, espacios: { user_id: userId } } });
  if (count === 0) throw new AppError(404, "NO_ENCONTRADO", "La generación no existe");
}
