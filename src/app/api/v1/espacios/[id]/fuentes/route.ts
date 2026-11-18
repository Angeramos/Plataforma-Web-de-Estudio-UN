import { listar, rechazarSiExcede, subir } from "@/server/fuentes/service";
import { requireUserId } from "@/server/http/auth";
import { AppError, handle } from "@/server/http/errors";
import { parseId } from "@/server/http/validate";

// Ingesta síncrona: extraer + fragmentar dentro de la petición (D-021).
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId(req);
  return Response.json(await listar(userId, parseId((await ctx.params).id)));
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId(req);
  const espacioId = parseId((await ctx.params).id);
  rechazarSiExcede(req.headers.get("content-length"));
  const form = await req.formData().catch(() => null);
  const archivo = form?.get("archivo");
  if (!(archivo instanceof File)) throw new AppError(400, "VALIDACION", "archivo: se espera un archivo en multipart/form-data");
  return Response.json(await subir(userId, espacioId, archivo), { status: 202 });
});
