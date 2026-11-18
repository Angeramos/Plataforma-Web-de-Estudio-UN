import { enviar, limpiar, listar, mensajeSchema } from "@/server/chat/service";
import { requireUserId } from "@/server/http/auth";
import { handle } from "@/server/http/errors";
import { parseBody, parseId } from "@/server/http/validate";

// Recuperación + LLM (con un posible reintento) dentro de la petición.
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId(req);
  return Response.json(await listar(userId, parseId((await ctx.params).id)));
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId(req);
  const espacioId = parseId((await ctx.params).id);
  const { mensaje } = await parseBody(req, mensajeSchema);
  return Response.json(await enviar(userId, espacioId, mensaje), { status: 201 });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId(req);
  await limpiar(userId, parseId((await ctx.params).id));
  return new Response(null, { status: 204 });
});
