import { AppError } from "@/server/http/errors";

// Fuentes elegidas por el usuario para una generación (D-053).
// undefined = sin selección: se usan todas las fuentes `listo` del espacio, como antes.
// Un id que no sea fuente `listo` del espacio es un 400: no se ignora en silencio.
export function validarSeleccion(pedidas: string[] | undefined, disponibles: string[]): string[] | undefined {
  if (!pedidas) return undefined;
  const unicas = [...new Set(pedidas)];
  if (unicas.some((id) => !disponibles.includes(id))) {
    throw new AppError(400, "VALIDACION", "fuenteIds: incluye fuentes que no están listas en este espacio");
  }
  return unicas;
}
