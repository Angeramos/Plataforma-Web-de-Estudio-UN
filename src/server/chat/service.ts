import { z } from "zod";
import type { chat_mensajes } from "@/generated/prisma/client";
import { db } from "@/server/db/prisma";
import { exigirCuota } from "@/server/cuota/service";
import { exigirEspacio } from "@/server/espacios/service";
import { AppError } from "@/server/http/errors";
import { pedirTexto } from "@/server/llm/client";
import { promptChat, type Turno } from "@/server/llm/prompts";
import { citarChat, NO_ENCONTRE } from "@/server/rag/citas";
import { recuperar } from "@/server/rag/retrieve";

export const mensajeSchema = z.object({ mensaje: z.string().trim().min(1).max(4000) });

const HISTORIAL = 6;

const toMensajeDto = (m: chat_mensajes) => ({
  id: m.id,
  rol: m.rol,
  contenido: m.contenido,
  ...(m.rol === "assistant" ? { fuentesCitadas: m.fuentes_citadas ?? [] } : {}),
  createdAt: m.created_at.toISOString(),
});

// Spec §4.5. El mensaje `user` se guarda junto con la respuesta y solo si hay respuesta:
// si Groq falla, el historial no queda con una pregunta sin contestar (D-045).
export async function enviar(userId: string, espacioId: string, mensaje: string) {
  await exigirEspacio(userId, espacioId);
  const listas = await db().fuentes.count({ where: { espacio_id: espacioId, estado: "listo" } });
  if (!listas) throw new AppError(409, "SIN_FUENTES_LISTAS", "El espacio no tiene fuentes listas; sube un archivo primero");
  await exigirCuota(userId, "chat");

  const preguntadoEn = new Date();
  const previos = await db().chat_mensajes.findMany({ where: { espacio_id: espacioId }, orderBy: { created_at: "desc" }, take: HISTORIAL });
  const historial: Turno[] = previos.reverse().map((m) => ({ rol: m.rol as Turno["rol"], contenido: m.contenido }));

  const { modo, fragmentos } = await recuperar(espacioId, mensaje);
  console.info(`[chat] recuperación por ${modo}: ${fragmentos.length} fragmentos`);
  const respuesta = fragmentos.length
    ? await pedirTexto(
        promptChat(
          mensaje,
          fragmentos.map((f) => ({ contenido: f.contenido, nombreArchivo: f.nombreArchivo, pagina: f.metadata.pagina ?? null })),
          historial,
          NO_ENCONTRE,
        ),
      )
    : NO_ENCONTRE;
  const { contenido, fuentesCitadas } = citarChat(respuesta, fragmentos);

  const [, asistente] = await db().$transaction([
    db().chat_mensajes.create({ data: { espacio_id: espacioId, rol: "user", contenido: mensaje, created_at: preguntadoEn } }),
    db().chat_mensajes.create({ data: { espacio_id: espacioId, rol: "assistant", contenido, fuentes_citadas: fuentesCitadas, created_at: new Date() } }),
  ]);
  return toMensajeDto(asistente);
}

export async function listar(userId: string, espacioId: string) {
  await exigirEspacio(userId, espacioId);
  const rows = await db().chat_mensajes.findMany({ where: { espacio_id: espacioId }, orderBy: { created_at: "asc" } });
  return rows.map(toMensajeDto);
}

export async function limpiar(userId: string, espacioId: string) {
  await exigirEspacio(userId, espacioId);
  await db().chat_mensajes.deleteMany({ where: { espacio_id: espacioId } });
}
