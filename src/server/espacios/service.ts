import { z } from "zod";
import { db } from "@/server/db/prisma";
import { AppError } from "@/server/http/errors";
import { toEspacioDto, toFuenteDto } from "./dto";

const nombre = z.string().trim().min(1).max(120);
const materia = z.string().trim().max(120);

export const espacioCreateSchema = z.object({ nombre, materia: materia.optional() });
export const espacioUpdateSchema = z.object({ nombre: nombre.optional(), materia: materia.optional() });

const conConteo = { _count: { select: { fuentes: true } } } as const;
const noEncontrado = () => new AppError(404, "NO_ENCONTRADO", "El espacio no existe");

// Toda consulta filtra por user_id: un espacio ajeno es indistinguible de uno inexistente (404).
export async function exigirEspacio(userId: string, espacioId: string) {
  const espacio = await db().espacios.findFirst({ where: { id: espacioId, user_id: userId }, select: { id: true } });
  if (!espacio) throw noEncontrado();
}

export async function listar(userId: string) {
  const rows = await db().espacios.findMany({ where: { user_id: userId }, orderBy: { updated_at: "desc" }, include: conConteo });
  return rows.map(toEspacioDto);
}

export async function crear(userId: string, input: z.infer<typeof espacioCreateSchema>) {
  const row = await db().espacios.create({ data: { user_id: userId, nombre: input.nombre, materia: input.materia || null }, include: conConteo });
  return toEspacioDto(row);
}

export async function obtener(userId: string, id: string) {
  const row = await db().espacios.findFirst({
    where: { id, user_id: userId },
    include: { ...conConteo, fuentes: { orderBy: { created_at: "asc" } } },
  });
  if (!row) throw noEncontrado();
  return { ...toEspacioDto(row), fuentes: row.fuentes.map(toFuenteDto) };
}

export async function actualizar(userId: string, id: string, input: z.infer<typeof espacioUpdateSchema>) {
  const data = { nombre: input.nombre, materia: input.materia === undefined ? undefined : input.materia || null };
  const { count } = await db().espacios.updateMany({ where: { id, user_id: userId }, data });
  if (count === 0) throw noEncontrado();
  return toEspacioDto(await db().espacios.findUniqueOrThrow({ where: { id }, include: conConteo }));
}

// Fuentes, fragmentos, generaciones y chat se borran en cascada en la BD.
export async function eliminar(userId: string, id: string) {
  const { count } = await db().espacios.deleteMany({ where: { id, user_id: userId } });
  if (count === 0) throw noEncontrado();
}
