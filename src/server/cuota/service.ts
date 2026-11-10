import { db } from "@/server/db/prisma";
import { env } from "@/server/env";
import { AppError } from "@/server/http/errors";
import { inicioDelDiaBogota } from "./dia";

// Cuota diaria por usuario, sumando todos sus espacios (spec §4.6, D-024). Protege el presupuesto diario
// de Groq, que es global de la cuenta (D-040).
// shortcut: cuenta filas guardadas; borrar generaciones o limpiar el chat libera cuota (D-046).
export async function exigirCuota(userId: string, tipo: "generacion" | "chat") {
  const desde = inicioDelDiaBogota(new Date());
  const delUsuario = { espacios: { user_id: userId }, created_at: { gte: desde } };
  const [usadas, limite] =
    tipo === "generacion"
      ? [await db().generaciones.count({ where: delUsuario }), env().GEN_DAILY_LIMIT]
      : [await db().chat_mensajes.count({ where: { ...delUsuario, rol: "user" } }), env().CHAT_DAILY_LIMIT];
  if (usadas >= limite) {
    const que = tipo === "generacion" ? "generaciones" : "mensajes de chat";
    throw new AppError(429, "CUOTA_DIARIA", `Alcanzaste el límite diario de ${que} (${limite}); vuelve a intentarlo mañana`);
  }
}
