import { generacionCreateSchema, generar, listar, tipoQuerySchema } from "@/server/generaciones/service";
import { requireUserId } from "@/server/http/auth";
import { AppError, handle } from "@/server/http/errors";
import { parseBody, parseId } from "@/server/http/validate";

// Generación síncrona: contexto + LLM (con un posible reintento) dentro de la petición.
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId(req);
  const espacioId = parseId((await ctx.params).id);
  const tipo = tipoQuerySchema.safeParse(new URL(req.url).searchParams.get("tipo") ?? undefined);
  if (!tipo.success) throw new AppError(400, "VALIDACION", "tipo: debe ser resumen, quiz o flashcards");
  return Response.json(await listar(userId, espacioId, tipo.data));
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId(req);
  const espacioId = parseId((await ctx.params).id);
  const input = await parseBody(req, generacionCreateSchema);
  return Response.json(await generar(userId, espacioId, input), { status: 201 });
});
