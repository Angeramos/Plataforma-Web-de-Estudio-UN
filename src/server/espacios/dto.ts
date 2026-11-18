import type { espacios, fuentes } from "@/generated/prisma/client";

// Una sola función por recurso pasa de filas de la BD (snake_case) al contrato (camelCase). Nunca filas crudas.
export const toEspacioDto = (e: espacios & { _count: { fuentes: number } }) => ({
  id: e.id,
  nombre: e.nombre,
  materia: e.materia,
  fuentesCount: e._count.fuentes,
  updatedAt: e.updated_at.toISOString(),
});

export const toFuenteDto = (f: fuentes) => ({
  id: f.id,
  nombreArchivo: f.nombre_archivo,
  tipo: f.tipo,
  estado: f.estado,
  error: f.error,
  createdAt: f.created_at.toISOString(),
});
