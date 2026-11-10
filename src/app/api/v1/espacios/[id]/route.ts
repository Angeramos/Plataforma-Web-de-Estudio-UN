import { actualizar, eliminar, espacioUpdateSchema, obtener } from "@/server/espacios/service";
import { requireUserId } from "@/server/http/auth";
import { handle } from "@/server/http/errors";
import { parseBody, parseId } from "@/server/http/validate";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId(req);
  return Response.json(await obtener(userId, parseId((await ctx.params).id)));
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId(req);
  const id = parseId((await ctx.params).id);
  return Response.json(await actualizar(userId, id, await parseBody(req, espacioUpdateSchema)));
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId(req);
  await eliminar(userId, parseId((await ctx.params).id));
  return new Response(null, { status: 204 });
});
