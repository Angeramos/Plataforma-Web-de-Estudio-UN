import { z } from "zod";
import { AppError } from "./errors";

// Mensajes de validación en español para el frontend (global para todo zod).
z.config(z.locales.es());

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError(400, "VALIDACION", "El cuerpo debe ser JSON válido");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const detalle = result.error.issues.map((i) => `${i.path.join(".") || "cuerpo"}: ${i.message}`).join("; ");
    throw new AppError(400, "VALIDACION", detalle);
  }
  return result.data;
}

const uuid = z.uuid();

// Un id que no es UUID no puede existir: 404, no 400 ni 500 (spec §3).
export function parseId(id: string): string {
  if (!uuid.safeParse(id).success) throw new AppError(404, "NO_ENCONTRADO", "Recurso no encontrado");
  return id;
}
