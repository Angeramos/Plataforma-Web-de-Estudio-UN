import { eliminar } from "@/server/generaciones/service";
import { requireUserId } from "@/server/http/auth";
import { handle } from "@/server/http/errors";
import { parseId } from "@/server/http/validate";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId(req);
  await eliminar(userId, parseId((await ctx.params).id));
  return new Response(null, { status: 204 });
});
